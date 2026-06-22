import { z } from "zod";

export const scoringConfigSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("time") }),
  z.object({
    mode: z.literal("accuracy_gate"),
    min_accuracy: z.number().min(0).max(1).default(0.9),
  }),
  z.object({
    mode: z.literal("weighted"),
    w_acc: z.number().min(0).default(0.7),
    w_speed: z.number().min(0).default(0.3),
    t_min: z.number().min(0).default(10_000),
    t_max: z.number().min(1).default(120_000),
  }),
  z.object({
    mode: z.literal("points_rank"),
    min_accuracy: z.number().min(0).max(1).default(0),
  }),
]);

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

/** One group's result on one game part. duration null = not submitted yet. */
export interface PartEntry {
  groupId: string;
  accuracy: number | null;
  durationMs: number | null;
}

export interface ScoredEntry {
  groupId: string;
  accuracy: number | null;
  durationMs: number | null;
  /** part score per the configured mode (0 if not submitted / gated out) */
  score: number;
  /** 1-based rank within the part (undefined if not submitted) */
  rank?: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

interface SubmittedEntry {
  groupId: string;
  accuracy: number;
  durationMs: number;
}

/**
 * Score one game part across all groups. Tie-breaks are deterministic:
 * primary metric, then higher accuracy, then shorter duration, then groupId asc.
 */
export function scorePart(entries: PartEntry[], config: ScoringConfig): ScoredEntry[] {
  const submitted: SubmittedEntry[] = entries
    .filter((e) => e.durationMs != null && e.accuracy != null)
    .map((e) => ({ groupId: e.groupId, accuracy: e.accuracy!, durationMs: e.durationMs! }));
  const pending = entries.filter((e) => e.durationMs == null || e.accuracy == null);

  // Deterministic ordering helper for ties.
  const tieKey = (e: SubmittedEntry) => [-e.accuracy, e.durationMs, e.groupId] as const;
  const byTie = (a: SubmittedEntry, b: SubmittedEntry) => {
    const [a0, a1, a2] = tieKey(a);
    const [b0, b1, b2] = tieKey(b);
    return a0 - b0 || a1 - b1 || (a2 < b2 ? -1 : a2 > b2 ? 1 : 0);
  };

  let ranked: { groupId: string; accuracy: number; durationMs: number; score: number }[] = [];

  switch (config.mode) {
    case "time": {
      // fastest wins; tie-break higher accuracy. score = 1/(1+seconds) as a stable number.
      const order = submitted
        .slice()
        .sort(
          (a, b) =>
            a.durationMs - b.durationMs ||
            b.accuracy - a.accuracy ||
            (a.groupId < b.groupId ? -1 : 1),
        );
      ranked = order.map((e) => ({
        groupId: e.groupId,
        accuracy: e.accuracy,
        durationMs: e.durationMs,
        score: 1 / (1 + e.durationMs / 1000),
      }));
      break;
    }
    case "accuracy_gate": {
      const pass = submitted.filter((e) => e.accuracy >= config.min_accuracy);
      const fail = submitted.filter((e) => e.accuracy < config.min_accuracy);
      pass.sort(
        (a, b) =>
          a.durationMs - b.durationMs ||
          b.accuracy - a.accuracy ||
          (a.groupId < b.groupId ? -1 : 1),
      );
      fail.sort(byTie);
      const order = [...pass, ...fail];
      const n = order.length;
      // Passers ranked ahead; score by reverse rank so leaderboard sums sensibly.
      ranked = order.map((e, i) => ({
        groupId: e.groupId,
        accuracy: e.accuracy,
        durationMs: e.durationMs,
        score: n - i,
      }));
      break;
    }
    case "weighted": {
      const span = Math.max(1, config.t_max - config.t_min);
      const scored = submitted.map((e) => {
        const speed = clamp((config.t_max - e.durationMs) / span, 0, 1);
        const score = config.w_acc * e.accuracy + config.w_speed * speed;
        return { groupId: e.groupId, accuracy: e.accuracy, durationMs: e.durationMs, score };
      });
      scored.sort(
        (a, b) =>
          b.score - a.score ||
          b.accuracy - a.accuracy ||
          a.durationMs - b.durationMs ||
          (a.groupId < b.groupId ? -1 : 1),
      );
      ranked = scored;
      break;
    }
    case "points_rank": {
      const gated = submitted.filter((e) => e.accuracy >= config.min_accuracy);
      const out = submitted.filter((e) => e.accuracy < config.min_accuracy);
      gated.sort(byTie);
      const n = gated.length;
      const gatedScored = gated.map((e, i) => ({
        groupId: e.groupId,
        accuracy: e.accuracy,
        durationMs: e.durationMs,
        score: n - i, // 1st of n gets n points
      }));
      const outScored = out
        .slice()
        .sort(byTie)
        .map((e) => ({
          groupId: e.groupId,
          accuracy: e.accuracy,
          durationMs: e.durationMs,
          score: 0,
        }));
      ranked = [...gatedScored, ...outScored];
      break;
    }
  }

  const result: ScoredEntry[] = ranked.map((e, i) => ({
    groupId: e.groupId,
    accuracy: e.accuracy,
    durationMs: e.durationMs,
    score: e.score,
    rank: i + 1,
  }));
  for (const p of pending) {
    result.push({ groupId: p.groupId, accuracy: p.accuracy, durationMs: p.durationMs, score: 0 });
  }
  return result;
}

export interface GroupTotal {
  groupId: string;
  total: number;
  parts: number;
}

/** Sum part scores into an overall leaderboard. */
export function totalScores(perPart: ScoredEntry[][]): GroupTotal[] {
  const totals = new Map<string, GroupTotal>();
  for (const part of perPart) {
    for (const e of part) {
      const t = totals.get(e.groupId) ?? { groupId: e.groupId, total: 0, parts: 0 };
      t.total += e.score;
      t.parts += 1;
      totals.set(e.groupId, t);
    }
  }
  return [...totals.values()].sort(
    (a, b) => b.total - a.total || (a.groupId < b.groupId ? -1 : 1),
  );
}
