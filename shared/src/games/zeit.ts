import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

/**
 * Time/date transcription drill. The sender reads times/dates in radio format
 * ("14:32", "15.06.", "15.06. 14:32"); the receiver types them back. Char-wise
 * auto scoring — spaces ignored, the ":" and "." separators are significant.
 */

export const zeitConfigSchema = z.object({
  mode: z.enum(["uhrzeit", "datum", "datum_zeit", "mix"]).default("mix"),
  count: z.number().int().min(1).max(20).default(5),
});
export type ZeitConfig = z.infer<typeof zeitConfigSchema>;

export const zeitPayloadSchema = z.object({
  items: z.array(z.string()),
});
export type ZeitPayload = z.infer<typeof zeitPayloadSchema>;

export const zeitAnswerSchema = z.object({ items: z.array(z.string()) });
export type ZeitAnswer = z.infer<typeof zeitAnswerSchema>;

const pad = (n: number) => String(n).padStart(2, "0");
function uhrzeit(rng: SeededRng): string {
  return `${pad(rng.int(0, 23))}:${pad(rng.int(0, 59))}`;
}
function datum(rng: SeededRng): string {
  return `${pad(rng.int(1, 28))}.${pad(rng.int(1, 12))}.`;
}

/** strip spaces; the ":" and "." separators stay significant. */
const norm = (s: string) => s.replace(/\s+/g, "");

export const zeit: GameType<ZeitConfig, ZeitPayload, ZeitAnswer> = {
  id: "zeit",
  label: "Uhrzeit / Datum",
  verification: "auto",
  configSchema: zeitConfigSchema,
  payloadSchema: zeitPayloadSchema,
  answerSchema: zeitAnswerSchema,

  generate(config, rng) {
    const items: string[] = [];
    for (let i = 0; i < config.count; i++) {
      const mode =
        config.mode === "mix" ? rng.pick(["uhrzeit", "datum", "datum_zeit"] as const) : config.mode;
      if (mode === "uhrzeit") items.push(uhrzeit(rng));
      else if (mode === "datum") items.push(datum(rng));
      else items.push(`${datum(rng)} ${uhrzeit(rng)}`);
    }
    return { items };
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

  samplePerfectAnswer(payload) {
    return { items: [...payload.items] };
  },
};
