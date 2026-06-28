import { z } from "zod";
import type { GameType } from "../gametype.js";

/**
 * Relay / "Stille Post". One original radio message travels down a chain of
 * groups: each group transcribes what it received (Leit reads → own Trupp
 * writes), and that transcription becomes the next group's input. Drift
 * accumulates along the chain. Every group is scored against the TRUE original
 * (not the degraded text it was handed) — so the leaderboard shows the drift.
 *
 * The chain linkage lives in the server (a group's round payload is filled from
 * the previous group's submission); this module only generates the original and
 * scores a transcription against a reference via normalized similarity.
 */

const CALLSIGNS = ["Florian 1", "Leitstelle Nord", "Pelikan 3", "Adler 7", "Basis 1", "Rotkreuz 2"];
const PLACES = ["Hauptplatz", "Bahnhof", "Kreuzung B1", "Sägewerk", "Seeufer", "Industriestraße 4"];
const PHRASES = ["Brand im Erdgeschoss", "Person vermisst", "Verkehrsunfall", "Hochwasser steigend", "Stromausfall"];
const PRIORITIES = ["Sofort", "Dringend", "Normal"];

export const relaisConfigSchema = z.object({
  length: z.enum(["kurz", "normal", "lang"]).default("normal"),
});
export type RelaisConfig = z.infer<typeof relaisConfigSchema>;

export const relaisPayloadSchema = z.object({
  /** the message THIS group received and must relay; null until the chain reaches it */
  incoming: z.string().nullable(),
});
export type RelaisPayload = z.infer<typeof relaisPayloadSchema>;

export const relaisAnswerSchema = z.object({ text: z.string() });
export type RelaisAnswer = z.infer<typeof relaisAnswerSchema>;

const pad = (n: number) => String(n).padStart(2, "0");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** normalized Levenshtein similarity 0..1 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[m][n] / Math.max(m, n);
}

export const relais: GameType<RelaisConfig, RelaisPayload, RelaisAnswer> = {
  id: "relais",
  label: "Relais (Stille Post)",
  verification: "auto",
  configSchema: relaisConfigSchema,
  payloadSchema: relaisPayloadSchema,
  answerSchema: relaisAnswerSchema,

  /** generates the ORIGINAL message (used only for the chain head). */
  generate(config, rng) {
    const von = rng.pick(CALLSIGNS);
    const an = rng.pick(CALLSIGNS);
    const lage = rng.pick(PHRASES);
    let msg = `${von} an ${an}: ${lage}, kommen.`;
    if (config.length === "normal" || config.length === "lang") {
      const anzahl = rng.int(1, 30);
      const ort = rng.pick(PLACES);
      msg = `${von} an ${an}: ${anzahl} Personen am ${ort}, Lage ${lage}, kommen.`;
    }
    if (config.length === "lang") {
      const prio = rng.pick(PRIORITIES);
      const zeit = `${pad(rng.int(0, 23))}:${pad(rng.int(0, 59))}`;
      msg = msg.replace(/, kommen\.$/, `, Priorität ${prio}, Uhrzeit ${zeit}, Ende.`);
    }
    return { incoming: msg };
  },

  /** scores a transcription against a reference (the server passes the ORIGINAL as `incoming`). */
  compare(payload, answer) {
    const ref = norm(payload.incoming ?? "");
    const got = norm(answer.text);
    const accuracy = ref === "" ? 1 : similarity(ref, got);
    return { accuracy, detail: { received: answer.text, chars: ref.length } };
  },

  samplePerfectAnswer(payload) {
    return { text: payload.incoming ?? "" };
  },
};
