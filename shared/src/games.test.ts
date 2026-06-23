import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { nato, natoConfigSchema } from "./games/nato.js";
import { meldung, meldungConfigSchema } from "./games/meldung.js";
import { koordinaten, koordinatenConfigSchema } from "./games/koordinaten.js";
import { zahlen, zahlenConfigSchema } from "./games/zahlen.js";
import { encode, encodeConfigSchema, encodeChar } from "./games/encode.js";
import { zeit, zeitConfigSchema } from "./games/zeit.js";
import { spruch, spruchConfigSchema } from "./games/spruch.js";
import { skizze, skizzeConfigSchema } from "./games/skizze.js";

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

describe("zahlen", () => {
  const cfg = (o = {}) => zahlenConfigSchema.parse(o);
  it("deterministic + count honored", () => {
    const a = zahlen.generate(cfg({ count: 6 }), createRng("z"));
    const b = zahlen.generate(cfg({ count: 6 }), createRng("z"));
    expect(a).toEqual(b);
    expect(a.items.length).toBe(6);
  });
  it("ziffern mode = pure digit blocks of groupSize", () => {
    const p = zahlen.generate(cfg({ mode: "ziffern", count: 5, groupSize: 4 }), createRng("z"));
    for (const it of p.items) expect(it).toMatch(/^\d{4}$/);
  });
  it("frequenz mode contains a comma", () => {
    const p = zahlen.generate(cfg({ mode: "frequenz", count: 5 }), createRng("f"));
    for (const it of p.items) expect(it).toMatch(/^\d+,\d{3}$/);
  });
  it("exact answer -> accuracy 1, all perfect", () => {
    const p = zahlen.generate(cfg({ count: 5 }), createRng("z"));
    const r = zahlen.compare(p, { items: p.items });
    expect(r.accuracy).toBe(1);
    expect((r.detail as any).perfectItems).toBe(5);
  });
  it("char-wise partial credit; spaces ignored, comma significant", () => {
    const p = { showSpelling: true, items: ["145,500"] };
    const r = zahlen.compare(p, { items: [" 145,5 0 9 "] }); // last digit wrong
    expect(r.accuracy).toBeCloseTo(6 / 7);
    expect((r.detail as any).perfectItems).toBe(0);
  });
});

describe("encode", () => {
  const cfg = (o = {}) => encodeConfigSchema.parse(o);
  it("deterministic + count honored", () => {
    const a = encode.generate(cfg({ count: 5 }), createRng("e"));
    const b = encode.generate(cfg({ count: 5 }), createRng("e"));
    expect(a).toEqual(b);
    expect(a.items.length).toBe(5);
  });
  it("correct NATO spelling -> accuracy 1, all perfect", () => {
    const p = encode.generate(cfg({ count: 4 }), createRng("e"));
    const answer = p.items.map((w) => w.split("").map(encodeChar).join(" "));
    const r = encode.compare(p, { items: answer });
    expect(r.accuracy).toBe(1);
    expect((r.detail as any).perfectItems).toBe(4);
  });
  it("word-wise partial credit; separators flexible, case-insensitive", () => {
    const p = { showReference: true, items: ["FUNK"] }; // Foxtrot Uniform November Kilo
    const r = encode.compare(p, { items: ["foxtrot-uniform, november XXX"] }); // last wrong
    expect(r.accuracy).toBeCloseTo(3 / 4);
    expect((r.detail as any).perfectItems).toBe(0);
  });
  it("callsign digits encode to German number words", () => {
    expect(encodeChar("2")).toBe("ZWO");
    const r = encode.compare({ showReference: true, items: ["A1"] }, { items: ["Alfa Eins"] });
    expect(r.accuracy).toBe(1);
  });
});

describe("zeit", () => {
  const cfg = (o = {}) => zeitConfigSchema.parse(o);
  it("deterministic + count honored", () => {
    const a = zeit.generate(cfg({ count: 6 }), createRng("t"));
    const b = zeit.generate(cfg({ count: 6 }), createRng("t"));
    expect(a).toEqual(b);
    expect(a.items.length).toBe(6);
  });
  it("uhrzeit mode = HH:MM", () => {
    const p = zeit.generate(cfg({ mode: "uhrzeit", count: 5 }), createRng("t"));
    for (const it of p.items) expect(it).toMatch(/^\d{2}:\d{2}$/);
  });
  it("datum mode = DD.MM.", () => {
    const p = zeit.generate(cfg({ mode: "datum", count: 5 }), createRng("t"));
    for (const it of p.items) expect(it).toMatch(/^\d{2}\.\d{2}\.$/);
  });
  it("exact answer -> accuracy 1, all perfect", () => {
    const p = zeit.generate(cfg({ count: 5 }), createRng("t"));
    const r = zeit.compare(p, { items: p.items });
    expect(r.accuracy).toBe(1);
    expect((r.detail as any).perfectItems).toBe(5);
  });
  it("char-wise partial credit; spaces ignored, separators significant", () => {
    const p = { items: ["14:32"] };
    const r = zeit.compare(p, { items: [" 14 : 3 9 "] }); // last digit wrong
    expect(r.accuracy).toBeCloseTo(4 / 5);
    expect((r.detail as any).perfectItems).toBe(0);
  });
});

describe("spruch", () => {
  const cfg = (o = {}) => spruchConfigSchema.parse(o);
  // build the perfect answer from a generated payload
  const solve = (p: any) =>
    p.items.map((it: any) =>
      Object.fromEntries(it.tokens.filter((t: any) => t.type === "slot").map((t: any) => [t.key, t.value])),
    );
  it("deterministic + one item per templateId", () => {
    const a = spruch.generate(cfg({ templateIds: ["ruf", "lage"] }), createRng("p"));
    const b = spruch.generate(cfg({ templateIds: ["ruf", "lage"] }), createRng("p"));
    expect(a).toEqual(b);
    expect(a.items.map((i) => i.id)).toEqual(["ruf", "lage"]);
  });
  it("exact answer -> accuracy 1", () => {
    const p = spruch.generate(cfg(), createRng("p"));
    const r = spruch.compare(p, { items: solve(p) });
    expect(r.accuracy).toBe(1);
  });
  it("slot-wise partial credit", () => {
    const p = spruch.generate(cfg({ templateIds: ["ruf"] }), createRng("p")); // 2 slots
    const ans = solve(p);
    ans[0].s1 = "völlig falsch xyz"; // break one of the two slots
    const r = spruch.compare(p, { items: ans });
    expect(r.accuracy).toBeCloseTo(1 / 2);
  });
  it("fuzzy tolerates a small typo", () => {
    const p = spruch.generate(cfg({ templateIds: ["standort"], fuzzy: true, fuzzyThreshold: 0.8 }), createRng("p"));
    const ans = solve(p);
    ans[0].s0 = ans[0].s0 + "x"; // one extra char
    expect(spruch.compare(p, { items: ans }).accuracy).toBe(1);
  });
});

describe("skizze", () => {
  const cfg = (o = {}) => skizzeConfigSchema.parse(o);
  it("deterministic + count honored", () => {
    const a = skizze.generate(cfg({ count: 6 }), createRng("s"));
    const b = skizze.generate(cfg({ count: 6 }), createRng("s"));
    expect(a).toEqual(b);
    expect(Object.keys(a.cells).length).toBe(6);
  });
  it("arrows always carry a direction; others never", () => {
    const p = skizze.generate(cfg({ rows: 8, cols: 8, count: 30 }), createRng("s"));
    for (const cell of Object.values(p.cells)) {
      if (cell.kind === "pfeil") expect(cell.dir).toBeTruthy();
      else expect(cell.dir).toBeUndefined();
    }
  });
  it("exact rebuild -> accuracy 1", () => {
    const p = skizze.generate(cfg(), createRng("s"));
    const r = skizze.compare(p, { cells: p.cells });
    expect(r.accuracy).toBe(1);
  });
  it("wrong direction counts as wrong; empty answer = empties only", () => {
    const p = skizze.generate(cfg({ rows: 4, cols: 4, count: 3 }), createRng("s"));
    const r0 = skizze.compare(p, { cells: {} });
    expect(r0.accuracy).toBeCloseTo((16 - 3) / 16);
    // flip one arrow's direction (or change a kind) -> still wrong
    const [k, v] = Object.entries(p.cells)[0];
    const broken = { ...p.cells, [k]: v.kind === "pfeil" ? { kind: "ziel" } : { kind: "pfeil", dir: "nord" } };
    const r1 = skizze.compare(p, { cells: broken as any });
    expect(r1.accuracy).toBeLessThan(1);
  });
});
