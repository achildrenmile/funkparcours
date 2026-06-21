import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { symbolkarte, symbolkarteConfigSchema, cellKey } from "./games/symbolkarte.js";

const cfg = (over = {}) => symbolkarteConfigSchema.parse({ rows: 5, cols: 5, symbolCount: 6, ...over });

describe("symbolkarte.generate", () => {
  it("is deterministic for the same seed", () => {
    const a = symbolkarte.generate(cfg(), createRng("seed-1"));
    const b = symbolkarte.generate(cfg(), createRng("seed-1"));
    expect(a).toEqual(b);
  });

  it("differs across seeds", () => {
    const a = symbolkarte.generate(cfg(), createRng("seed-1"));
    const b = symbolkarte.generate(cfg(), createRng("seed-2"));
    expect(a).not.toEqual(b);
  });

  it("fills exactly symbolCount cells, single stack when stacking off", () => {
    const p = symbolkarte.generate(cfg({ symbolCount: 7, stacking: false }), createRng("x"));
    const keys = Object.keys(p.cells);
    expect(keys.length).toBe(7);
    for (const k of keys) expect(p.cells[k].length).toBe(1);
  });

  it("respects maxStack when stacking on", () => {
    const p = symbolkarte.generate(
      cfg({ symbolCount: 10, stacking: true, maxStack: 3 }),
      createRng("y"),
    );
    for (const k of Object.keys(p.cells)) {
      expect(p.cells[k].length).toBeGreaterThanOrEqual(1);
      expect(p.cells[k].length).toBeLessThanOrEqual(3);
    }
  });

  it("only uses configured shapes/colors", () => {
    const p = symbolkarte.generate(
      cfg({ shapes: ["kreis"], colors: ["rot"], symbolCount: 5 }),
      createRng("z"),
    );
    for (const k of Object.keys(p.cells)) {
      for (const s of p.cells[k]) {
        expect(s.shape).toBe("kreis");
        expect(s.color).toBe("rot");
      }
    }
  });
});

describe("symbolkarte.compare", () => {
  it("accuracy 1 for an exact rebuild", () => {
    const p = symbolkarte.generate(cfg(), createRng("seed-1"));
    const r = symbolkarte.compare(p, { cells: p.cells });
    expect(r.accuracy).toBe(1);
  });

  it("accuracy < 1 when a cell is wrong", () => {
    const p = symbolkarte.generate(cfg({ symbolCount: 5 }), createRng("seed-1"));
    const key = Object.keys(p.cells)[0];
    const broken = structuredClone(p.cells);
    broken[key] = [{ shape: "stern", color: "schwarz" }];
    const r = symbolkarte.compare(p, { cells: broken });
    expect(r.accuracy).toBeLessThan(1);
    expect((r.detail as any).heatmap[key]).toBe(false);
  });

  it("penalizes wrong stack order", () => {
    const p = symbolkarte.generate(
      cfg({ symbolCount: 12, stacking: true, maxStack: 3 }),
      createRng("ord"),
    );
    // a stack whose reverse actually differs (not two identical symbols)
    const key = Object.keys(p.cells).find((k) => {
      const s = p.cells[k];
      return s.length >= 2 && JSON.stringify(s) !== JSON.stringify(s.slice().reverse());
    })!;
    expect(key).toBeDefined();
    const reversed = structuredClone(p.cells);
    reversed[key] = reversed[key].slice().reverse();
    const r = symbolkarte.compare(p, { cells: reversed });
    expect((r.detail as any).heatmap[key]).toBe(false);
  });

  it("counts empty-vs-empty as correct", () => {
    const p = symbolkarte.generate(cfg({ symbolCount: 1 }), createRng("empty"));
    const r = symbolkarte.compare(p, { cells: p.cells });
    expect(r.accuracy).toBe(1);
    // an unrelated empty cell is in the heatmap as correct
    const emptyKey = cellKey("E", "5");
    expect((r.detail as any).heatmap[emptyKey]).toBe(true);
  });
});
