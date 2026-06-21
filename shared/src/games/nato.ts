import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

export const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "Xray",
  Y: "Yankee", Z: "Zulu",
  "0": "Null", "1": "Eins", "2": "Zwo", "3": "Drei", "4": "Vier",
  "5": "Fünf", "6": "Sechs", "7": "Sieben", "8": "Acht", "9": "Neun",
};

const WORDS = [
  "FUNK", "MELDUNG", "LAGE", "TRUPP", "STATION", "ANTENNE", "KANAL", "EMPFANG",
  "SENDER", "BATTERIE", "NOTRUF", "PEILUNG", "RELAIS", "FREQUENZ", "SPRUCH",
  "ALARM", "POSITION", "ABSCHNITT", "BEREICH", "EINSATZ",
];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

export const natoConfigSchema = z.object({
  mode: z.enum(["rufzeichen", "woerter", "mix"]).default("mix"),
  count: z.number().int().min(1).max(20).default(4),
  minLen: z.number().int().min(2).max(12).default(4),
  maxLen: z.number().int().min(2).max(12).default(7),
  /** show the NATO reference table on the Leit view */
  showReference: z.boolean().default(true),
});
export type NatoConfig = z.infer<typeof natoConfigSchema>;

export const natoPayloadSchema = z.object({
  showReference: z.boolean(),
  items: z.array(z.string()),
});
export type NatoPayload = z.infer<typeof natoPayloadSchema>;

export const natoAnswerSchema = z.object({ items: z.array(z.string()) });
export type NatoAnswer = z.infer<typeof natoAnswerSchema>;

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

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");

export const nato: GameType<NatoConfig, NatoPayload, NatoAnswer> = {
  id: "nato",
  label: "Buchstabieren (NATO)",
  verification: "auto",
  configSchema: natoConfigSchema,
  payloadSchema: natoPayloadSchema,
  answerSchema: natoAnswerSchema,

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
    let correctChars = 0;
    let totalChars = 0;
    let perfectWords = 0;
    const perWord: { ok: boolean; correctChars: number; total: number }[] = [];
    payload.items.forEach((truthRaw, i) => {
      const truth = norm(truthRaw);
      const given = norm(answer.items[i] ?? "");
      let wc = 0;
      for (let c = 0; c < truth.length; c++) if (given[c] === truth[c]) wc++;
      correctChars += wc;
      totalChars += truth.length;
      const ok = wc === truth.length && given.length === truth.length;
      if (ok) perfectWords++;
      perWord.push({ ok, correctChars: wc, total: truth.length });
    });
    return {
      accuracy: totalChars === 0 ? 1 : correctChars / totalChars,
      detail: { perWord, perfectWords, totalWords: payload.items.length },
    };
  },
};
