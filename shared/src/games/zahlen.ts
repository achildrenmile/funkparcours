import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

/** German radio digit pronunciation (note: 2 = "Zwo", to avoid drei/zwei mix-up). */
export const DIGIT_WORDS: Record<string, string> = {
  "0": "Null", "1": "Eins", "2": "Zwo", "3": "Drei", "4": "Vier",
  "5": "Fünf", "6": "Sechs", "7": "Sieben", "8": "Acht", "9": "Neun",
  ",": "Komma",
};

/** Plausible band prefixes for the "frequenz" mode (2m / 70cm / PMR / CB). */
const FREQ_PREFIXES = ["145", "144", "433", "438", "439", "446", "27"];

const DIGITS = "0123456789";

export const zahlenConfigSchema = z.object({
  mode: z.enum(["ziffern", "frequenz", "kanal", "mix"]).default("mix"),
  count: z.number().int().min(1).max(20).default(5),
  /** digits per block in "ziffern" mode */
  groupSize: z.number().int().min(2).max(8).default(4),
  /** show the digit pronunciation table on the Leit view */
  showSpelling: z.boolean().default(true),
});
export type ZahlenConfig = z.infer<typeof zahlenConfigSchema>;

export const zahlenPayloadSchema = z.object({
  showSpelling: z.boolean(),
  items: z.array(z.string()),
});
export type ZahlenPayload = z.infer<typeof zahlenPayloadSchema>;

export const zahlenAnswerSchema = z.object({ items: z.array(z.string()) });
export type ZahlenAnswer = z.infer<typeof zahlenAnswerSchema>;

function digits(rng: SeededRng, n: number): string {
  return Array.from({ length: n }, () => rng.pick(DIGITS.split(""))).join("");
}
function randomFrequenz(rng: SeededRng): string {
  return `${rng.pick(FREQ_PREFIXES)},${digits(rng, 3)}`;
}
function randomKanal(rng: SeededRng): string {
  return String(rng.int(1, 80));
}

/** strip spaces; the comma in frequencies is significant. */
const norm = (s: string) => s.replace(/\s+/g, "");

export const zahlen: GameType<ZahlenConfig, ZahlenPayload, ZahlenAnswer> = {
  id: "zahlen",
  label: "Zahlen / Frequenzen",
  verification: "auto",
  configSchema: zahlenConfigSchema,
  payloadSchema: zahlenPayloadSchema,
  answerSchema: zahlenAnswerSchema,

  generate(config, rng) {
    const items: string[] = [];
    for (let i = 0; i < config.count; i++) {
      const mode =
        config.mode === "mix" ? rng.pick(["ziffern", "frequenz", "kanal"] as const) : config.mode;
      if (mode === "frequenz") items.push(randomFrequenz(rng));
      else if (mode === "kanal") items.push(randomKanal(rng));
      else items.push(digits(rng, config.groupSize));
    }
    return { showSpelling: config.showSpelling, items };
  },

  compare(payload, answer) {
    let correctChars = 0;
    let totalChars = 0;
    let perfectItems = 0;
    const perItem: { ok: boolean; correctChars: number; total: number }[] = [];
    payload.items.forEach((truthRaw, i) => {
      const truth = norm(truthRaw);
      const given = norm(answer.items[i] ?? "");
      let wc = 0;
      for (let c = 0; c < truth.length; c++) if (given[c] === truth[c]) wc++;
      correctChars += wc;
      totalChars += truth.length;
      const ok = wc === truth.length && given.length === truth.length;
      if (ok) perfectItems++;
      perItem.push({ ok, correctChars: wc, total: truth.length });
    });
    return {
      accuracy: totalChars === 0 ? 1 : correctChars / totalChars,
      detail: { perItem, perfectItems, totalItems: payload.items.length },
    };
  },
};
