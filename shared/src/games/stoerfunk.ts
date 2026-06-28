import { z } from "zod";
import type { GameType } from "../gametype.js";
import { relais, similarity } from "./relais.js";

/**
 * Interference copy drill ("Störfunk"). The platform renders the message as
 * noisy radio audio (server-side TTS + DSP); the Leit plays the clip over the
 * real radio, the receiver copies what it can make out and types it. The
 * receiver never gets the text — only audio bytes (see the /audio route).
 * Scoring: normalized similarity of the transcription to the original.
 */

export const stoerfunkConfigSchema = z.object({
  length: z.enum(["kurz", "normal", "lang"]).default("kurz"),
  /** interference strength 0..1 */
  noise: z.number().min(0).max(1).default(0.4),
});
export type StoerfunkConfig = z.infer<typeof stoerfunkConfigSchema>;

export const stoerfunkPayloadSchema = z.object({
  text: z.string(),
  noise: z.number(),
});
export type StoerfunkPayload = z.infer<typeof stoerfunkPayloadSchema>;

export const stoerfunkAnswerSchema = z.object({ text: z.string() });
export type StoerfunkAnswer = z.infer<typeof stoerfunkAnswerSchema>;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const stoerfunk: GameType<StoerfunkConfig, StoerfunkPayload, StoerfunkAnswer> = {
  id: "stoerfunk",
  label: "Störfunk (Mithören)",
  verification: "auto",
  configSchema: stoerfunkConfigSchema,
  payloadSchema: stoerfunkPayloadSchema,
  answerSchema: stoerfunkAnswerSchema,

  generate(config, rng) {
    const text = relais.generate({ length: config.length }, rng).incoming ?? "";
    return { text, noise: config.noise };
  },

  compare(payload, answer) {
    const ref = norm(payload.text);
    const got = norm(answer.text);
    const accuracy = ref === "" ? 1 : similarity(ref, got);
    return { accuracy, detail: { received: answer.text, chars: ref.length } };
  },

  samplePerfectAnswer(payload) {
    return { text: payload.text };
  },
};
