import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

/**
 * Radio phrase drill ("Lückentext"). A fixed Funkspruch formula has variable
 * slots; the sender reads the complete phrase over radio, the receiver fills
 * only the blanks. Trains procedure (the fixed wording is given) plus catching
 * the key values. Slot-wise auto scoring with optional fuzzy tolerance.
 *
 * The phrase skeleton (fixed text + slot kinds) lives in the config so the
 * receiver can render it WITHOUT seeing the values — the random values are
 * generated per round into the (trupp-hidden) payload.
 */

const CALLSIGNS = ["Florian 1", "Leitstelle Nord", "Pelikan 3", "Adler 7", "Basis 1", "Rotkreuz 2"];
const PLACES = ["Hauptplatz", "Bahnhof", "Kreuzung B1", "Sägewerk", "Seeufer", "Industriestraße 4", "Waldweg 12"];
const PHRASES = ["Brand im Erdgeschoss", "Person vermisst", "Verkehrsunfall", "Hochwasser steigend", "Stromausfall", "Sturmschaden"];
const PRIORITIES = ["Sofort", "Dringend", "Normal"];
const STATUS = ["Einsatzbereit", "Am Einsatzort", "Auf Anfahrt", "Wieder frei"];

/** Phrase templates: literal strings + variable slots (by kind). Stable ids. */
export const SPRUCH_TEMPLATES: { id: string; parts: (string | { kind: string })[] }[] = [
  { id: "ruf", parts: [{ kind: "callsign" }, " von ", { kind: "callsign" }, ", kommen."] },
  { id: "standort", parts: ["Hier ", { kind: "callsign" }, ", Standort ", { kind: "ort" }, ", kommen."] },
  { id: "lage", parts: [{ kind: "callsign" }, ", Lage ", { kind: "lage" }, ", Priorität ", { kind: "prio" }, ", Ende."] },
  { id: "personen", parts: ["Verstanden, ", { kind: "anzahl" }, " Personen am ", { kind: "ort" }, ", kommen."] },
  { id: "treffpunkt", parts: [{ kind: "callsign" }, " an ", { kind: "callsign" }, ": Treffpunkt ", { kind: "ort" }, " um ", { kind: "zeit" }, ", kommen."] },
  { id: "status", parts: [{ kind: "callsign" }, " meldet ", { kind: "status" }, ", Ende."] },
];
const TEMPLATE_IDS = SPRUCH_TEMPLATES.map((t) => t.id);
const byId = (id: string) => SPRUCH_TEMPLATES.find((t) => t.id === id);

const pad = (n: number) => String(n).padStart(2, "0");
function fill(kind: string, rng: SeededRng): string {
  switch (kind) {
    case "callsign": return rng.pick(CALLSIGNS);
    case "ort": return rng.pick(PLACES);
    case "lage": return rng.pick(PHRASES);
    case "prio": return rng.pick(PRIORITIES);
    case "status": return rng.pick(STATUS);
    case "anzahl": return String(rng.int(1, 40));
    case "zeit": return `${pad(rng.int(0, 23))}:${pad(rng.int(0, 59))}`;
    default: return "";
  }
}

const textToken = z.object({ type: z.literal("text"), text: z.string() });
const slotToken = z.object({ type: z.literal("slot"), key: z.string(), kind: z.string(), value: z.string() });
const tokenSchema = z.discriminatedUnion("type", [textToken, slotToken]);

export const spruchConfigSchema = z.object({
  templateIds: z.array(z.enum(TEMPLATE_IDS as [string, ...string[]])).min(1).default([...TEMPLATE_IDS].slice(0, 4)),
  fuzzy: z.boolean().default(true),
  fuzzyThreshold: z.number().min(0).max(1).default(0.8),
});
export type SpruchConfig = z.infer<typeof spruchConfigSchema>;

export const spruchPayloadSchema = z.object({
  fuzzy: z.boolean(),
  fuzzyThreshold: z.number(),
  items: z.array(z.object({ id: z.string(), tokens: z.array(tokenSchema) })),
});
export type SpruchPayload = z.infer<typeof spruchPayloadSchema>;

export const spruchAnswerSchema = z.object({ items: z.array(z.record(z.string())) });
export type SpruchAnswer = z.infer<typeof spruchAnswerSchema>;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** normalized Levenshtein similarity 0..1 */
function similarity(a: string, b: string): number {
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

export const spruch: GameType<SpruchConfig, SpruchPayload, SpruchAnswer> = {
  id: "spruch",
  label: "Funkspruch (Lückentext)",
  verification: "auto",
  configSchema: spruchConfigSchema,
  payloadSchema: spruchPayloadSchema,
  answerSchema: spruchAnswerSchema,

  generate(config, rng) {
    const items = config.templateIds.map((id) => {
      const template = byId(id);
      let s = 0;
      const tokens = (template?.parts ?? []).map((part) =>
        typeof part === "string"
          ? { type: "text" as const, text: part }
          : { type: "slot" as const, key: `s${s++}`, kind: part.kind, value: fill(part.kind, rng) },
      );
      return { id, tokens };
    });
    return { fuzzy: config.fuzzy, fuzzyThreshold: config.fuzzyThreshold, items };
  },

  compare(payload, answer) {
    let correct = 0;
    let total = 0;
    const perItem: { key: string; ok: boolean; sim: number }[][] = [];
    payload.items.forEach((item, i) => {
      const slots = item.tokens.filter((t): t is Extract<typeof t, { type: "slot" }> => t.type === "slot");
      const given = answer.items[i] ?? {};
      const detail = slots.map((slot) => {
        const truth = norm(slot.value);
        const ans = norm(given[slot.key] ?? "");
        const sim = similarity(truth, ans);
        const ok = truth === ans || (payload.fuzzy && sim >= payload.fuzzyThreshold);
        total++;
        if (ok) correct++;
        return { key: slot.key, ok, sim };
      });
      perItem.push(detail);
    });
    return {
      accuracy: total === 0 ? 1 : correct / total,
      detail: { perItem, correct, total },
    };
  },

  samplePerfectAnswer(payload) {
    return {
      items: payload.items.map((item) =>
        Object.fromEntries(
          item.tokens
            .filter((t): t is Extract<typeof t, { type: "slot" }> => t.type === "slot")
            .map((slot) => [slot.key, slot.value]),
        ),
      ),
    };
  },
};
