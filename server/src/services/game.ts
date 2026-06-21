import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import {
  getGameType,
  scorePart,
  totalScores,
  scoringConfigSchema,
  type PartEntry,
  type ScoredEntry,
} from "@funkparcours/shared";

const { games, gameParts, groups, rounds, submissions, events } = schema;

export async function loadGameByCode(code: string) {
  const [game] = await db.select().from(games).where(eq(games.code, code));
  if (!game) return null;
  const parts = await db
    .select()
    .from(gameParts)
    .where(eq(gameParts.gameId, game.id))
    .orderBy(gameParts.orderIndex);
  const grps = await db.select().from(groups).where(eq(groups.gameId, game.id));
  return { game, parts, groups: grps };
}

export async function logEvent(gameId: string, type: string, data: unknown = {}) {
  await db.insert(events).values({ gameId, type, data: data as object });
}

/** Build (idempotently) one round per group for a part, seeding per anti-cheat mode. */
export async function ensureRoundsForPart(gameId: string, partId: string) {
  const [part] = await db.select().from(gameParts).where(eq(gameParts.id, partId));
  if (!part) throw new Error("part not found");
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  const grps = await db.select().from(groups).where(eq(groups.gameId, gameId));
  const existing = await db.select().from(rounds).where(eq(rounds.gamePartId, partId));
  const have = new Set(existing.map((r) => r.groupId));

  const gt = getGameType(part.type);
  const config = gt.configSchema.parse(part.config);

  const toInsert = [];
  for (const grp of grps) {
    if (have.has(grp.id)) continue;
    const seed =
      game.antiCheatMode === "same_for_all"
        ? `${part.id}:shared`
        : `${part.id}:${grp.id}`;
    const payload = gt.generate(config, makeRng(seed));
    toInsert.push({
      gamePartId: part.id,
      groupId: grp.id,
      payload: payload as object,
      seed,
      status: "pending" as const,
    });
  }
  if (toInsert.length) await db.insert(rounds).values(toInsert);
}

// lazy import to keep shared's createRng tree-shake-friendly
import { createRng } from "@funkparcours/shared";
function makeRng(seed: string) {
  return createRng(seed);
}

export async function startGame(gameId: string) {
  const parts = await db
    .select()
    .from(gameParts)
    .where(eq(gameParts.gameId, gameId))
    .orderBy(gameParts.orderIndex);
  if (parts.length === 0) throw new Error("no parts configured");
  const first = parts[0];
  await ensureRoundsForPart(gameId, first.id);
  await db
    .update(games)
    .set({ status: "running", currentPartId: first.id })
    .where(eq(games.id, gameId));
  await logEvent(gameId, "game_started", { partId: first.id });
  return first.id;
}

export async function advancePart(gameId: string): Promise<string | null> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  const parts = await db
    .select()
    .from(gameParts)
    .where(eq(gameParts.gameId, gameId))
    .orderBy(gameParts.orderIndex);
  const idx = parts.findIndex((p) => p.id === game.currentPartId);
  const next = parts[idx + 1];
  if (!next) {
    await db.update(games).set({ status: "finished" }).where(eq(games.id, gameId));
    await logEvent(gameId, "game_finished", {});
    return null;
  }
  await ensureRoundsForPart(gameId, next.id);
  await db.update(games).set({ currentPartId: next.id }).where(eq(games.id, gameId));
  await logEvent(gameId, "part_changed", { partId: next.id });
  return next.id;
}

/** Leit reveals: set started_at once. Idempotent (won't reset a running timer). */
export async function startTransmission(roundId: string): Promise<Date> {
  const [r] = await db.select().from(rounds).where(eq(rounds.id, roundId));
  if (!r) throw new Error("round not found");
  if (r.startedAt) return r.startedAt;
  const now = new Date();
  await db
    .update(rounds)
    .set({ startedAt: now, status: "transmitting" })
    .where(eq(rounds.id, roundId));
  return now;
}

export interface SubmitResult {
  accuracy: number;
  durationMs: number;
  score: number;
  detail: unknown;
  attemptNo: number;
}

/**
 * Score a trupp submission. Timing is server-side (startedAt..now). Enforces
 * max_attempts and final-per-round. Recomputes the whole part afterwards since
 * relative modes (rank/time) depend on the field.
 */
export async function submitAnswer(
  roundId: string,
  answer: unknown,
): Promise<SubmitResult> {
  const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId));
  if (!round) throw new Error("round not found");
  if (!round.startedAt) throw new Error("transmission not started");

  const [part] = await db.select().from(gameParts).where(eq(gameParts.id, round.gamePartId));
  const prior = await db
    .select()
    .from(submissions)
    .where(eq(submissions.roundId, roundId));
  if (prior.length >= part.maxAttempts) throw new Error("max attempts reached");

  const gt = getGameType(part.type);
  const parsedAnswer = gt.answerSchema.parse(answer);
  const { accuracy, detail } = gt.compare(round.payload, parsedAnswer);
  const durationMs = Date.now() - round.startedAt.getTime();
  const attemptNo = prior.length + 1;

  await db.insert(submissions).values({
    roundId,
    answer: parsedAnswer as object,
    accuracy: String(accuracy),
    durationMs,
    attemptNo,
    detail: detail as object,
  });
  await db.update(rounds).set({ status: "submitted" }).where(eq(rounds.id, roundId));

  await rescorePart(round.gamePartId);

  // read back the score we just computed
  const [mine] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.roundId, roundId), eq(submissions.attemptNo, attemptNo)));

  await db.update(rounds).set({ status: "scored" }).where(eq(rounds.id, roundId));
  return {
    accuracy,
    durationMs,
    score: Number(mine.score ?? 0),
    detail,
    attemptNo,
  };
}

/** best (latest scored) submission per round for a part */
async function bestSubmissionsForPart(partId: string) {
  const partRounds = await db.select().from(rounds).where(eq(rounds.gamePartId, partId));
  const roundIds = partRounds.map((r) => r.id);
  const subs = roundIds.length
    ? await db.select().from(submissions).where(inArray(submissions.roundId, roundIds))
    : [];
  // pick the highest-attempt submission per round
  const byRound = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    const cur = byRound.get(s.roundId);
    if (!cur || s.attemptNo > cur.attemptNo) byRound.set(s.roundId, s);
  }
  return { partRounds, byRound };
}

/** Recompute every group's score for a part and persist into submissions.score. */
export async function rescorePart(partId: string) {
  const [part] = await db.select().from(gameParts).where(eq(gameParts.id, partId));
  const [game] = await db.select().from(games).where(eq(games.id, part.gameId));
  const config = scoringConfigSchema.parse(game.scoringConfig);
  const { partRounds, byRound } = await bestSubmissionsForPart(partId);

  const entries: PartEntry[] = partRounds.map((r) => {
    const s = byRound.get(r.id);
    return {
      groupId: r.groupId,
      accuracy: s ? Number(s.accuracy) : null,
      durationMs: s ? s.durationMs : null,
    };
  });
  const scored = scorePart(entries, config);
  const scoreByGroup = new Map(scored.map((s) => [s.groupId, s.score]));

  for (const r of partRounds) {
    const s = byRound.get(r.id);
    if (!s) continue;
    await db
      .update(submissions)
      .set({ score: String(scoreByGroup.get(r.groupId) ?? 0) })
      .where(eq(submissions.id, s.id));
  }
  return scored;
}

export interface DashboardGroup {
  groupId: string;
  name: string;
  status: "wartet" | "sendet" | "abgegeben";
  accuracy: number | null;
  durationMs: number | null;
}

export async function buildDashboard(gameId: string) {
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  const parts = await db
    .select()
    .from(gameParts)
    .where(eq(gameParts.gameId, gameId))
    .orderBy(gameParts.orderIndex);
  const grps = await db.select().from(groups).where(eq(groups.gameId, gameId));
  const nameOf = new Map(grps.map((g) => [g.id, g.name]));

  const perPart: ScoredEntry[][] = [];
  const currentGroups: DashboardGroup[] = [];

  for (const part of parts) {
    const { partRounds, byRound } = await bestSubmissionsForPart(part.id);
    const config = scoringConfigSchema.parse(game.scoringConfig);
    const entries: PartEntry[] = partRounds.map((r) => {
      const s = byRound.get(r.id);
      return {
        groupId: r.groupId,
        accuracy: s ? Number(s.accuracy) : null,
        durationMs: s ? s.durationMs : null,
      };
    });
    perPart.push(scorePart(entries, config));

    if (part.id === game.currentPartId) {
      for (const r of partRounds) {
        const s = byRound.get(r.id);
        const status: DashboardGroup["status"] = s
          ? "abgegeben"
          : r.startedAt
            ? "sendet"
            : "wartet";
        currentGroups.push({
          groupId: r.groupId,
          name: nameOf.get(r.groupId) ?? "?",
          status,
          accuracy: s ? Number(s.accuracy) : null,
          durationMs: s ? s.durationMs : null,
        });
      }
    }
  }

  const totals = totalScores(perPart).map((t) => ({
    ...t,
    name: nameOf.get(t.groupId) ?? "?",
  }));

  return {
    game,
    parts: parts.map((p) => ({
      id: p.id,
      type: p.type,
      orderIndex: p.orderIndex,
      verification: p.verification,
    })),
    currentPartId: game.currentPartId,
    currentGroups,
    perPartScores: perPart.map((part, i) => ({
      partId: parts[i].id,
      entries: part.map((e) => ({ ...e, name: nameOf.get(e.groupId) ?? "?" })),
    })),
    totals,
  };
}
