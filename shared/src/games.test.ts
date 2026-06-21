import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { nato, natoConfigSchema } from "./games/nato.js";
import { meldung, meldungConfigSchema } from "./games/meldung.js";
import { koordinaten, koordinatenConfigSchema } from "./games/koordinaten.js";

describe("nato", () => {
  const cfg = (o = {}) => natoConfigSchema.parse(o);
  it("deterministic + count honored", () => {
    const a = nato.generate(cfg({ count: 5 }), createRng("s"));
    const b = nato.generate(cfg({ count: 5 }), createRng("s"));
    expect(a).toEqual(b);
    expect(a.items.length).toBe(5);
  });
  it("rufzeichen mode contains a digit", () => {
    const p = nato.generate(cfg({ mode: "rufzeichen", count: 6 }), createRng("rz"));
    for (const it of p.items) expect(/[0-9]/.test(it)).toBe(true);
  });
  it("exact answer -> accuracy 1, all perfect", () => {
    const p = nato.generate(cfg({ count: 4 }), createRng("s"));
    const r = nato.compare(p, { items: p.items });
    expect(r.accuracy).toBe(1);
    expect((r.detail as any).perfectWords).toBe(4);
  });
  it("char-wise partial credit, case-insensitive", () => {
    const p = { showReference: true, items: ["BRAVO"] };
    const r = nato.compare(p, { items: ["bravX"] });
    expect(r.accuracy).toBeCloseTo(4 / 5);
    expect((r.detail as any).perfectWords).toBe(0);
  });
});

describe("meldung", () => {
  const cfg = (o = {}) => meldungConfigSchema.parse(o);
  it("deterministic + fills all fields", () => {
    const a = meldung.generate(cfg(), createRng("m"));
    const b = meldung.generate(cfg(), createRng("m"));
    expect(a).toEqual(b);
    for (const f of a.fields) expect(a.values[f.key]).toBeTruthy();
  });
  it("exact -> 1", () => {
    const p = meldung.generate(cfg(), createRng("m"));
    expect(meldung.compare(p, { values: p.values }).accuracy).toBe(1);
  });
  it("fuzzy tolerates a small typo", () => {
    const p = meldung.generate(cfg({ fuzzy: true, fuzzyThreshold: 0.8 }), createRng("m"));
    const k = p.fields[0].key;
    const v = { ...p.values, [k]: p.values[k] + "x" }; // one extra char
    expect(meldung.compare(p, { values: v }).accuracy).toBe(1);
  });
  it("fuzzy off -> typo counts wrong", () => {
    const p = meldung.generate(cfg({ fuzzy: false }), createRng("m"));
    const k = p.fields[0].key;
    const v = { ...p.values, [k]: p.values[k] + "x" };
    expect(meldung.compare(p, { values: v }).accuracy).toBeLessThan(1);
  });
});

describe("koordinaten", () => {
  const cfg = (o = {}) => koordinatenConfigSchema.parse(o);
  it("deterministic + markerCount honored", () => {
    const a = koordinaten.generate(cfg({ markerCount: 5 }), createRng("k"));
    const b = koordinaten.generate(cfg({ markerCount: 5 }), createRng("k"));
    expect(a).toEqual(b);
    expect(a.markers.length).toBe(5);
  });
  it("exact -> 1", () => {
    const p = koordinaten.generate(cfg(), createRng("k"));
    expect(koordinaten.compare(p, { markers: p.markers }).accuracy).toBe(1);
  });
  it("false marks reduce accuracy", () => {
    const p = koordinaten.generate(cfg({ rows: 4, cols: 4, markerCount: 2 }), createRng("k"));
    const wrong = p.markers.concat(["A1", "B2", "C3"].filter((x) => !p.markers.includes(x)));
    const r = koordinaten.compare(p, { markers: wrong });
    expect(r.accuracy).toBeLessThan(1);
    expect((r.detail as any).falseMarks).toBeGreaterThan(0);
  });
  it("empty answer = correct empties only", () => {
    const p = koordinaten.generate(cfg({ rows: 4, cols: 4, markerCount: 3 }), createRng("k"));
    const r = koordinaten.compare(p, { markers: [] });
    expect(r.accuracy).toBeCloseTo((16 - 3) / 16);
    expect((r.detail as any).hits).toBe(0);
  });
});
