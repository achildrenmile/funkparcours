import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const colLabels = (n: number) => Array.from({ length: n }, (_, i) => ALPHA[i]);
const rowLabels = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
export const koordKey = (c: string, r: string) => `${c}${r}`;

export const koordinatenConfigSchema = z.object({
  rows: z.number().int().min(2).max(20).default(8),
  cols: z.number().int().min(2).max(20).default(8),
  markerCount: z.number().int().min(1).max(40).default(5),
});
export type KoordinatenConfig = z.infer<typeof koordinatenConfigSchema>;

export const koordinatenPayloadSchema = z.object({
  rows: z.number().int(),
  cols: z.number().int(),
  colLabels: z.array(z.string()),
  rowLabels: z.array(z.string()),
  markers: z.array(z.string()),
});
export type KoordinatenPayload = z.infer<typeof koordinatenPayloadSchema>;

export const koordinatenAnswerSchema = z.object({ markers: z.array(z.string()) });
export type KoordinatenAnswer = z.infer<typeof koordinatenAnswerSchema>;

export const koordinaten: GameType<
  KoordinatenConfig,
  KoordinatenPayload,
  KoordinatenAnswer
> = {
  id: "koordinaten",
  label: "Koordinaten",
  verification: "auto",
  configSchema: koordinatenConfigSchema,
  payloadSchema: koordinatenPayloadSchema,
  answerSchema: koordinatenAnswerSchema,

  generate(config, rng: SeededRng) {
    const cols = colLabels(config.cols);
    const rows = rowLabels(config.rows);
    const all: string[] = [];
    for (const c of cols) for (const r of rows) all.push(koordKey(c, r));
    const markers = rng.shuffle(all).slice(0, Math.min(config.markerCount, all.length));
    return { rows: config.rows, cols: config.cols, colLabels: cols, rowLabels: rows, markers };
  },

  compare(payload, answer) {
    // cell-wise correctness over the whole grid: penalizes both misses and false marks
    const truth = new Set(payload.markers);
    const given = new Set(answer.markers);
    const total = payload.rows * payload.cols;
    let correct = 0;
    let hits = 0;
    const heatmap: Record<string, "hit" | "miss" | "false" | "empty"> = {};
    for (const c of payload.colLabels) {
      for (const r of payload.rowLabels) {
        const k = koordKey(c, r);
        const t = truth.has(k);
        const g = given.has(k);
        if (t && g) { correct++; hits++; heatmap[k] = "hit"; }
        else if (!t && !g) { correct++; heatmap[k] = "empty"; }
        else if (t && !g) heatmap[k] = "miss";
        else heatmap[k] = "false";
      }
    }
    return {
      accuracy: total === 0 ? 1 : correct / total,
      detail: { heatmap, hits, markers: truth.size, falseMarks: given.size - hits },
    };
  },
};
