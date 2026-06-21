import { describe, it, expect } from "vitest";
import { scorePart, totalScores, scoringConfigSchema, type PartEntry } from "./scoring.js";

const entries: PartEntry[] = [
  { groupId: "a", accuracy: 1.0, durationMs: 30_000 },
  { groupId: "b", accuracy: 0.95, durationMs: 20_000 },
  { groupId: "c", accuracy: 0.8, durationMs: 15_000 },
  { groupId: "d", accuracy: 0.92, durationMs: 60_000 },
];

const rankOf = (res: ReturnType<typeof scorePart>, id: string) =>
  res.find((e) => e.groupId === id)!.rank;

describe("scoring: time", () => {
  it("fastest first", () => {
    const cfg = scoringConfigSchema.parse({ mode: "time" });
    const res = scorePart(entries, cfg);
    expect(rankOf(res, "c")).toBe(1); // 15s
    expect(rankOf(res, "b")).toBe(2); // 20s
    expect(rankOf(res, "a")).toBe(3); // 30s
    expect(rankOf(res, "d")).toBe(4); // 60s
  });
});

describe("scoring: accuracy_gate", () => {
  it("only passers (>=0.9) ranked by time, ahead of failers", () => {
    const cfg = scoringConfigSchema.parse({ mode: "accuracy_gate", min_accuracy: 0.9 });
    const res = scorePart(entries, cfg);
    // passers: b(.95,20s), d(.92,60s), a(1.0,30s) -> by time: b, a, d
    expect(rankOf(res, "b")).toBe(1);
    expect(rankOf(res, "a")).toBe(2);
    expect(rankOf(res, "d")).toBe(3);
    // c fails the gate -> last
    expect(rankOf(res, "c")).toBe(4);
    expect(res.find((e) => e.groupId === "b")!.score).toBeGreaterThan(
      res.find((e) => e.groupId === "c")!.score,
    );
  });
});

describe("scoring: weighted", () => {
  it("combines accuracy and speed", () => {
    const cfg = scoringConfigSchema.parse({
      mode: "weighted",
      w_acc: 0.5,
      w_speed: 0.5,
      t_min: 10_000,
      t_max: 70_000,
    });
    const res = scorePart(entries, cfg);
    // manual: speed=(70000-d)/60000
    // a: .5*1 + .5*(40/60)=0.833 ; b: .5*.95+.5*(50/60)=0.892 ; c: .5*.8+.5*(55/60)=0.858 ; d: .5*.92+.5*(10/60)=0.543
    expect(rankOf(res, "b")).toBe(1);
    expect(rankOf(res, "c")).toBe(2);
    expect(rankOf(res, "a")).toBe(3);
    expect(rankOf(res, "d")).toBe(4);
  });

  it("clamps speed at duration beyond t_max", () => {
    const cfg = scoringConfigSchema.parse({
      mode: "weighted",
      w_acc: 0,
      w_speed: 1,
      t_min: 10_000,
      t_max: 50_000,
    });
    const res = scorePart([{ groupId: "slow", accuracy: 1, durationMs: 999_000 }], cfg);
    expect(res[0].score).toBe(0); // clamped, not negative
  });
});

describe("scoring: points_rank", () => {
  it("awards N..1 points by rank with gate", () => {
    const cfg = scoringConfigSchema.parse({ mode: "points_rank", min_accuracy: 0.9 });
    const res = scorePart(entries, cfg);
    // gated (>=.9): a(1.0), b(.95), d(.92) sorted by tieKey (-acc, dur): a, b, d -> 3,2,1
    expect(res.find((e) => e.groupId === "a")!.score).toBe(3);
    expect(res.find((e) => e.groupId === "b")!.score).toBe(2);
    expect(res.find((e) => e.groupId === "d")!.score).toBe(1);
    expect(res.find((e) => e.groupId === "c")!.score).toBe(0); // gated out
  });
});

describe("pending + totals", () => {
  it("unsubmitted groups get score 0 and no rank", () => {
    const cfg = scoringConfigSchema.parse({ mode: "time" });
    const res = scorePart(
      [
        { groupId: "x", accuracy: 1, durationMs: 5000 },
        { groupId: "y", accuracy: null, durationMs: null },
      ],
      cfg,
    );
    const y = res.find((e) => e.groupId === "y")!;
    expect(y.score).toBe(0);
    expect(y.rank).toBeUndefined();
  });

  it("totals sum across parts and sort desc", () => {
    const cfg = scoringConfigSchema.parse({ mode: "points_rank", min_accuracy: 0 });
    const p1 = scorePart(entries, cfg);
    const p2 = scorePart(entries, cfg);
    const totals = totalScores([p1, p2]);
    expect(totals[0].total).toBeGreaterThanOrEqual(totals[1].total);
    expect(totals.reduce((s, t) => s + t.parts, 0)).toBe(8);
  });
});
