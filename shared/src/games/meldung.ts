import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

/** Field kinds the generator knows how to fill plausibly + compare. */
export const MELDUNG_FIELDS = {
  von: { label: "Von", kind: "callsign" },
  an: { label: "An", kind: "callsign" },
  datum_zeit: { label: "Datum/Zeit", kind: "datetime" },
  ort: { label: "Ort", kind: "place" },
  lage: { label: "Lage", kind: "phrase" },
  anzahl_personen: { label: "Anzahl Personen", kind: "number" },
  prioritaet: { label: "Priorität", kind: "priority" },
  meldetext: { label: "Meldetext", kind: "sentence" },
} as const;
export type MeldungFieldKey = keyof typeof MELDUNG_FIELDS;
export const MELDUNG_FIELD_KEYS = Object.keys(MELDUNG_FIELDS) as MeldungFieldKey[];

const CALLSIGNS = ["Florian 1", "Leitstelle Nord", "Pelikan 3", "Adler 7", "Basis 1", "Rotkreuz 2"];
const PLACES = ["Hauptplatz", "Bahnhof", "Kreuzung B1", "Sägewerk", "Seeufer", "Industriestraße 4", "Waldweg 12"];
const PHRASES = ["Brand im Erdgeschoss", "Person vermisst", "Verkehrsunfall", "Hochwasser steigend", "Stromausfall", "Sturmschaden"];
const PRIORITIES = ["Sofort", "Dringend", "Normal"];
const SENTENCES = [
  "Zwei Fahrzeuge angefordert.",
  "Zufahrt über Nordseite frei.",
  "Verletzte werden versorgt.",
  "Lage unter Kontrolle.",
  "Nachschub erforderlich.",
  "Warte auf weitere Anweisung.",
];

export const meldungConfigSchema = z.object({
  fields: z
    .array(z.enum(MELDUNG_FIELD_KEYS as [string, ...string[]]))
    .min(1)
    .default(["von", "an", "ort", "lage", "anzahl_personen", "prioritaet"]),
  /** allow small typos via normalized Levenshtein ratio */
  fuzzy: z.boolean().default(true),
  fuzzyThreshold: z.number().min(0).max(1).default(0.8),
});
export type MeldungConfig = z.infer<typeof meldungConfigSchema>;

export const meldungPayloadSchema = z.object({
  fields: z.array(z.object({ key: z.string(), label: z.string(), kind: z.string() })),
  values: z.record(z.string()),
  // scoring tolerance carried in the payload so compare stays pure on (payload, answer)
  fuzzy: z.boolean().default(true),
  fuzzyThreshold: z.number().default(0.85),
});
export type MeldungPayload = z.infer<typeof meldungPayloadSchema>;

export const meldungAnswerSchema = z.object({ values: z.record(z.string()) });
export type MeldungAnswer = z.infer<typeof meldungAnswerSchema>;

function fill(kind: string, rng: SeededRng): string {
  switch (kind) {
    case "callsign": return rng.pick(CALLSIGNS);
    case "place": return rng.pick(PLACES);
    case "phrase": return rng.pick(PHRASES);
    case "priority": return rng.pick(PRIORITIES);
    case "number": return String(rng.int(1, 40));
    case "sentence": return rng.pick(SENTENCES);
    case "datetime": {
      const d = String(rng.int(1, 28)).padStart(2, "0");
      const mo = String(rng.int(1, 12)).padStart(2, "0");
      const h = String(rng.int(0, 23)).padStart(2, "0");
      const mi = String(rng.int(0, 59)).padStart(2, "0");
      return `${d}.${mo}. ${h}:${mi}`;
    }
    default: return "";
  }
}

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
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return 1 - dp[m][n] / Math.max(m, n);
}

export const meldung: GameType<MeldungConfig, MeldungPayload, MeldungAnswer> = {
  id: "meldung",
  label: "Meldung",
  verification: "auto",
  configSchema: meldungConfigSchema,
  payloadSchema: meldungPayloadSchema,
  answerSchema: meldungAnswerSchema,

  generate(config, rng) {
    const fields = config.fields.map((key) => {
      const def = MELDUNG_FIELDS[key as MeldungFieldKey];
      return { key, label: def.label, kind: def.kind };
    });
    const values: Record<string, string> = {};
    for (const f of fields) values[f.key] = fill(f.kind, rng);
    return { fields, values, fuzzy: config.fuzzy, fuzzyThreshold: config.fuzzyThreshold };
  },

  compare(payload, answer) {
    const fields = payload.fields;
    let correct = 0;
    const perField: Record<string, { ok: boolean; sim: number }> = {};
    for (const f of fields) {
      const truth = norm(payload.values[f.key] ?? "");
      const given = norm(answer.values[f.key] ?? "");
      const sim = similarity(truth, given);
      const ok = truth === given || (payload.fuzzy && sim >= payload.fuzzyThreshold);
      perField[f.key] = { ok, sim };
      if (ok) correct++;
    }
    return {
      accuracy: fields.length === 0 ? 1 : correct / fields.length,
      detail: { perField, correct, total: fields.length },
    };
  },
};
