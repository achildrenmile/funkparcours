import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeApp, req, resetDb, roundOf, seedGame, startGroup } from "./helpers.js";

afterAll(closeApp);
beforeEach(resetDb);

/**
 * These are security/fairness invariants, not smoke tests. Each asserts the
 * *property* (the answer never reaches the Trupp; the template is gated on the
 * server-side timer; timing is server-authoritative) — never merely status 200.
 */
describe("station GET — Trupp never receives the payload", () => {
  for (const status of ["pending", "transmitting"] as const) {
    it(`hides the template from the Trupp (${status})`, async () => {
      const s = await seedGame({ type: "symbolkarte", groupCount: 2 });
      const g = s.groups[0];
      if (status === "transmitting") await startGroup(s.partId, g.id);

      // The generated template (the answer) — must NOT appear in the Trupp view.
      const truth = await roundOf(s.partId, g.id);
      const truthCellsJson = JSON.stringify((truth.payload as { cells: unknown }).cells);
      expect(truthCellsJson.length).toBeGreaterThan(2); // sanity: there IS an answer to leak

      const res = await req({ url: `/api/station/${g.truppToken}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();

      expect(body.role).toBe("trupp");
      // 1. no `payload` field anywhere the Trupp can read
      expect(body.part?.payload).toBeUndefined();
      // 2. the truth's cell map never appears in the serialized response, in ANY shape
      expect(JSON.stringify(body)).not.toContain('"cells"');
      expect(JSON.stringify(body)).not.toContain(truthCellsJson);
    });
  }

  it("Trupp snapshot stays answer-free AFTER a submission (scored state, heatmap path)", async () => {
    // The scored state returns lastResult.detail (a heatmap keyed by cell). Make sure
    // the actual answer (symbol stacks) still never appears, even via that field.
    const s = await seedGame({ type: "symbolkarte" });
    const g = s.groups[0];
    await startGroup(s.partId, g.id);
    const truth = await roundOf(s.partId, g.id);
    const truthCellsJson = JSON.stringify((truth.payload as { cells: unknown }).cells);

    // submit a deliberately wrong answer to reach the scored/feedback path
    await req({
      method: "POST",
      url: `/api/station/${g.truppToken}/submit`,
      payload: { answer: { cells: {} } },
    });

    const res = await req({ url: `/api/station/${g.truppToken}` });
    const body = res.json();
    expect(body.part?.lastResult).toBeTruthy(); // we ARE on the scored path
    expect(body.part?.payload).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(truthCellsJson); // answer stays hidden
  });

  it("Trupp snapshot stays answer-free even after the timer started (reconnect path)", async () => {
    // The WS reconnect contract is: client pulls THIS REST snapshot. So a started
    // round must still hide the template from the Trupp.
    const s = await seedGame({ type: "symbolkarte" });
    const g = s.groups[0];
    await startGroup(s.partId, g.id);
    const res = await req({ url: `/api/station/${g.truppToken}` });
    expect(res.json().part?.payload).toBeUndefined();
    expect(JSON.stringify(res.json())).not.toContain('"cells"');
  });
});

describe("station GET — Leit gets the payload only after started_at", () => {
  it("withholds the payload before transmission, reveals it after", async () => {
    const s = await seedGame({ type: "symbolkarte" });
    const g = s.groups[0];

    const before = await req({ url: `/api/station/${g.leitToken}` });
    expect(before.statusCode).toBe(200);
    expect(before.json().part).not.toBeNull();
    // Before the Leit presses start: no template.
    expect(before.json().part.payload).toBeNull();

    await startGroup(s.partId, g.id);

    const after = await req({ url: `/api/station/${g.leitToken}` });
    expect(after.json().part.payload).toBeTruthy();
    expect(after.json().part.payload.cells).toBeTruthy();
  });
});

describe("seeding — anti-cheat seed modes", () => {
  it("unique_per_group: each group gets a different seed AND payload", async () => {
    const s = await seedGame({ antiCheatMode: "unique_per_group", groupCount: 2 });
    const r0 = await roundOf(s.partId, s.groups[0].id);
    const r1 = await roundOf(s.partId, s.groups[1].id);
    expect(r0.seed).toBe(`${s.partId}:${s.groups[0].id}`);
    expect(r1.seed).toBe(`${s.partId}:${s.groups[1].id}`);
    expect(r0.seed).not.toBe(r1.seed);
    expect(JSON.stringify(r0.payload)).not.toBe(JSON.stringify(r1.payload));
  });

  it("same_for_all: every group shares one seed AND an identical payload", async () => {
    const s = await seedGame({ antiCheatMode: "same_for_all", groupCount: 2 });
    const r0 = await roundOf(s.partId, s.groups[0].id);
    const r1 = await roundOf(s.partId, s.groups[1].id);
    expect(r0.seed).toBe(`${s.partId}:shared`);
    expect(r1.seed).toBe(`${s.partId}:shared`);
    expect(JSON.stringify(r0.payload)).toBe(JSON.stringify(r1.payload));
  });
});

describe("submit — timing is server-authoritative", () => {
  it("computes duration_ms from server timestamps; client-sent timing is ignored", async () => {
    const s = await seedGame({ type: "symbolkarte" });
    const g = s.groups[0];
    const startedAt = await startGroup(s.partId, g.id);

    // Build the PERFECT answer from the server-side truth (test-side read only).
    const truth = await roundOf(s.partId, g.id);
    const perfect = { cells: (truth.payload as { cells: unknown }).cells };

    // A cheating client forges a huge duration and an early submittedAt to game
    // time-based scoring. The server must ignore both.
    const FORGED = 9_999_999;
    const res = await req({
      method: "POST",
      url: `/api/station/${g.truppToken}/submit`,
      payload: {
        answer: perfect,
        durationMs: FORGED,
        submittedAt: new Date(startedAt.getTime() - 3_600_000).toISOString(),
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.accuracy).toBe(1); // perfect answer scores 1.0
    const realElapsed = Date.now() - startedAt.getTime();
    // recorded duration tracks the SERVER clock, within tolerance — not the forged value
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
    expect(body.durationMs).not.toBe(FORGED);
    expect(body.durationMs).toBeLessThanOrEqual(realElapsed + 1000);
  });
});
