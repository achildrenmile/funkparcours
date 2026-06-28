import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeApp, req, resetDb, seedGame, startGroup } from "./helpers.js";

afterAll(closeApp);
beforeEach(resetDb);

// Anti-abuse limits are per-route and keyed by client IP. A *fixed* IP accumulates
// one bucket; a distinct IP per test keeps them independent.
describe("rate-limit — abuse-prone endpoints return 429", () => {
  it("login is throttled (tightLimit max 10/min)", async () => {
    const s = await seedGame();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await req({
        method: "POST",
        url: `/api/games/${s.code}/login`,
        payload: { password: "wrong" },
        ip: "203.0.113.10",
      });
      codes.push(res.statusCode);
    }
    // first 10 pass the limiter (401 wrong password), then the limiter trips
    expect(codes.slice(0, 10).every((c) => c !== 429)).toBe(true);
    expect(codes).toContain(429);
    expect(codes[codes.length - 1]).toBe(429);
  });

  it("submit is throttled (max 20/min)", async () => {
    const s = await seedGame({ type: "symbolkarte", maxAttempts: 1 });
    const g = s.groups[0];
    await startGroup(s.partId, g.id);

    const codes: number[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await req({
        method: "POST",
        url: `/api/station/${g.truppToken}/submit`,
        payload: { answer: { cells: {} } },
        ip: "203.0.113.20",
      });
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 20).every((c) => c !== 429)).toBe(true);
    expect(codes).toContain(429);
    expect(codes[codes.length - 1]).toBe(429);
  });
});
