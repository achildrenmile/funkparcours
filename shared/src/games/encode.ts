import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";
import { NATO } from "./nato.js";

/**
 * Active spelling drill ("Encode") — the mirror of the `nato` game.
 * The sender reads a plain word/callsign over radio; the receiver must produce
 * its NATO phonetic spelling (Foxtrot Uniform November Kilo). Scoring is
 * word-wise: did the right NATO word land in each position.
 */

const WORDS = [
  "FUNK", "MELDUNG", "LAGE", "TRUPP", "STATION", "ANTENNE", "KANAL", "EMPFANG",
  "SENDER", "BATTERIE", "NOTRUF", "PEILUNG", "RELAIS", "FREQUENZ", "SPRUCH",
  "ALARM", "POSITION", "ABSCHNITT", "BEREICH", "EINSATZ",
];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

export const encodeConfigSchema = z.object({
  mode: z.enum(["rufzeichen", "woerter", "mix"]).default("mix"),
  count: z.number().int().min(1).max(20).default(4),
  minLen: z.number().int().min(2).max(12).default(4),
  maxLen: z.number().int().min(2).max(12).default(7),
  /** show the NATO reference table on the Leit view */
  showReference: z.boolean().default(true),
});
export type EncodeConfig = z.infer<typeof encodeConfigSchema>;

export const encodePayloadSchema = z.object({
  showReference: z.boolean(),
  items: z.array(z.string()),
});
export type EncodePayload = z.infer<typeof encodePayloadSchema>;

export const encodeAnswerSchema = z.object({ items: z.array(z.string()) });
export type EncodeAnswer = z.infer<typeof encodeAnswerSchema>;

function randomCallsign(rng: SeededRng): string {
  const letters = (n: number) => Array.from({ length: n }, () => rng.pick(LETTERS.split(""))).join("");
  return `${letters(rng.int(1, 2))}${rng.pick(DIGITS.split(""))}${letters(rng.int(2, 3))}`;
}
function randomWord(rng: SeededRng, minLen: number, maxLen: number): string {
  const fit = WORDS.filter((w) => w.length >= minLen && w.length <= maxLen);
  if (fit.length) return rng.pick(fit);
  const len = rng.int(minLen, maxLen);
  return Array.from({ length: len }, () => rng.pick(LETTERS.split(""))).join("");
}

/** NATO phonetic word per character (uppercased for comparison). */
export const encodeChar = (ch: string) => (NATO[ch.toUpperCase()] ?? ch).toUpperCase();

/** split a free-text answer into NATO-word tokens (accept space/-/,/ as separators). */
const tokenize = (s: string) =>
  s
    .toUpperCase()
    .replace(/[-,/]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const encode: GameType<EncodeConfig, EncodePayload, EncodeAnswer> = {
  id: "encode",
  label: "Buchstabieren aktiv (NATO)",
  verification: "auto",
  configSchema: encodeConfigSchema,
  payloadSchema: encodePayloadSchema,
  answerSchema: encodeAnswerSchema,

  generate(config, rng) {
    const items: string[] = [];
    for (let i = 0; i < config.count; i++) {
      const wantCall =
        config.mode === "rufzeichen" || (config.mode === "mix" && rng.chance(0.5));
      items.push(wantCall ? randomCallsign(rng) : randomWord(rng, config.minLen, config.maxLen));
    }
    return { showReference: config.showReference, items };
  },

  compare(payload, answer) {
    let correctWords = 0;
    let totalWords = 0;
    let perfectItems = 0;
    const perItem: { ok: boolean; correctWords: number; total: number }[] = [];
    payload.items.forEach((truthRaw, i) => {
      const expected = truthRaw.replace(/\s+/g, "").split("").map(encodeChar);
      const given = tokenize(answer.items[i] ?? "");
      let wc = 0;
      for (let c = 0; c < expected.length; c++) if (given[c] === expected[c]) wc++;
      correctWords += wc;
      totalWords += expected.length;
      const ok = wc === expected.length && given.length === expected.length;
      if (ok) perfectItems++;
      perItem.push({ ok, correctWords: wc, total: expected.length });
    });
    return {
      accuracy: totalWords === 0 ? 1 : correctWords / totalWords,
      detail: { perItem, perfectItems, totalItems: payload.items.length },
    };
  },
};
