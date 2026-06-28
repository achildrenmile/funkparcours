import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRng } from "./rng.js";
import { listGameTypes, registerBuiltinGameTypes } from "./index.js";

// The contract is registry-driven: every registered GameType inherits the same
// laws automatically. A new plugin added to the registry gets this suite for free
// — and can't even compile without samplePerfectAnswer (required on the interface).
registerBuiltinGameTypes();
const types = listGameTypes();

const SEED_A = "contract-seed-A";
const SEED_B = "contract-seed-B";

/**
 * Generic "garbage" answer: replace every string with a non-overlapping control
 * sequence (so even fuzzy/similarity scorers can't match it) and bump every
 * number out of range. Strong enough that any type with real content scores < 1.
 */
function corrupt(v: unknown): unknown {
  if (typeof v === "string") return "";
  if (typeof v === "number") return v + 97;
  if (Array.isArray(v)) return v.map(corrupt);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>)) {
      out[k] = corrupt((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

const inUnit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;

describe("GameType registry is populated", () => {
  it("registers every built-in type with a unique id", () => {
    expect(types.length).toBeGreaterThanOrEqual(13);
    const ids = types.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
  });
});

describe.each(types.map((gt) => [gt.id, gt] as const))("GameType contract: %s", (_id, gt) => {
  const defaultConfig = () => gt.configSchema.parse({});

  it("configSchema.parse({}) yields valid defaults", () => {
    const cfg = defaultConfig();
    expect(cfg).toBeTypeOf("object");
    expect(cfg).not.toBeNull();
  });

  it("generate is deterministic for a fixed (config, seed)", () => {
    const a = gt.generate(defaultConfig(), createRng(SEED_A));
    const b = gt.generate(defaultConfig(), createRng(SEED_A));
    expect(a).toEqual(b);
  });

  it("samplePerfectAnswer scores exactly 1.0", () => {
    const payload = gt.generate(defaultConfig(), createRng(SEED_A));
    const { accuracy } = gt.compare(payload, gt.samplePerfectAnswer(payload));
    expect(inUnit(accuracy)).toBe(true);
    expect(accuracy).toBe(1);
  });

  it("a garbage answer scores below 1.0", () => {
    const payload = gt.generate(defaultConfig(), createRng(SEED_A));
    const garbage = corrupt(gt.samplePerfectAnswer(payload));
    const { accuracy } = gt.compare(payload, garbage as never);
    expect(inUnit(accuracy)).toBe(true); // clamped + not NaN even on junk input
    expect(accuracy).toBeLessThan(1);
  });

  it("accuracy stays in [0,1] and never NaN on a second seed", () => {
    // corrupt() keeps the answer structurally schema-shaped (keys/arrays intact),
    // only the values are junk — so this exercises the scorer, not a type error.
    const payload = gt.generate(defaultConfig(), createRng(SEED_B));
    for (const ans of [gt.samplePerfectAnswer(payload), corrupt(gt.samplePerfectAnswer(payload))]) {
      const { accuracy } = gt.compare(payload, ans as never);
      expect(inUnit(accuracy)).toBe(true);
    }
  });
});

describe("GameType purity (no frontend / DOM / IO coupling)", () => {
  const dir = fileURLToPath(new URL("./games", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("there is one source file per registered type at least", () => {
    expect(files.length).toBeGreaterThanOrEqual(types.length);
  });

  it.each(files)("%s imports no web/DOM/IO", (file) => {
    const src = readFileSync(`${dir}/${file}`, "utf8");
    // no cross-layer import into the frontend
    expect(src).not.toMatch(/from\s+["'][^"']*\bweb\//);
    // no DOM globals
    expect(src).not.toMatch(/\b(document|window|localStorage)\b/);
    // no node IO / filesystem
    expect(src).not.toMatch(/from\s+["']node:/);
    expect(src).not.toMatch(/from\s+["'](fs|path|child_process)["']/);
  });
});
