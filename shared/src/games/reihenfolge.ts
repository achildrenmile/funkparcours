import { z } from "zod";
import type { GameType } from "../gametype.js";

/**
 * Order drill ("Reihenfolge / Marschtabelle"). The known set of stations/steps
 * lives in the config (so the receiver can see the items). The sender reads the
 * correct sequence over radio; the receiver reorders the items to match. The
 * target order is randomized per round into the (trupp-hidden) payload.
 * Position-wise auto scoring: items in their correct absolute slot.
 */

export const reihenfolgeConfigSchema = z.object({
  items: z
    .array(z.string().min(1))
    .min(2)
    .max(12)
    .default(["Sammelplatz", "Brücke Nord", "Bahnhof", "Kreuzung B1", "Funkmast", "Ziel Waldweg"]),
});
export type ReihenfolgeConfig = z.infer<typeof reihenfolgeConfigSchema>;

export const reihenfolgePayloadSchema = z.object({
  /** the items in their correct (target) sequence */
  order: z.array(z.string()),
});
export type ReihenfolgePayload = z.infer<typeof reihenfolgePayloadSchema>;

export const reihenfolgeAnswerSchema = z.object({ order: z.array(z.string()) });
export type ReihenfolgeAnswer = z.infer<typeof reihenfolgeAnswerSchema>;

export const reihenfolge: GameType<ReihenfolgeConfig, ReihenfolgePayload, ReihenfolgeAnswer> = {
  id: "reihenfolge",
  label: "Reihenfolge",
  verification: "auto",
  configSchema: reihenfolgeConfigSchema,
  payloadSchema: reihenfolgePayloadSchema,
  answerSchema: reihenfolgeAnswerSchema,

  generate(config, rng) {
    return { order: rng.shuffle(config.items) };
  },

  compare(payload, answer) {
    const total = payload.order.length;
    let correct = 0;
    const perPos: boolean[] = [];
    for (let i = 0; i < total; i++) {
      const ok = (answer.order[i] ?? "") === payload.order[i];
      perPos.push(ok);
      if (ok) correct++;
    }
    return {
      accuracy: total === 0 ? 1 : correct / total,
      detail: { perPos, correct, total },
    };
  },

  samplePerfectAnswer(payload) {
    return { order: [...payload.order] };
  },
};
