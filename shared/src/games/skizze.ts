import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

/**
 * Tactical sketch ("Lageskizze"). The sender describes a small situation map —
 * directional arrows, hazards, assembly points, objectives on a labelled grid —
 * and the receiver rebuilds it cell by cell. Cell-wise auto scoring (kind +
 * direction must match; empty cells must stay empty). Extends the symbolkarte /
 * koordinaten grid idea with oriented elements.
 */

export const ELEMENTS = ["pfeil", "gefahr", "sammelplatz", "ziel"] as const;
export const DIRS = ["nord", "ost", "sued", "west"] as const;
export type Element = (typeof ELEMENTS)[number];
export type Dir = (typeof DIRS)[number];

export const skizzeCellSchema = z.object({
  kind: z.enum(ELEMENTS),
  /** only meaningful for kind === "pfeil" */
  dir: z.enum(DIRS).optional(),
});
export type SkizzeCell = z.infer<typeof skizzeCellSchema>;

export const skizzeConfigSchema = z.object({
  rows: z.number().int().min(2).max(12).default(6),
  cols: z.number().int().min(2).max(12).default(6),
  /** number of filled cells */
  count: z.number().int().min(1).max(48).default(5),
});
export type SkizzeConfig = z.infer<typeof skizzeConfigSchema>;

export const skizzePayloadSchema = z.object({
  rows: z.number().int(),
  cols: z.number().int(),
  colLabels: z.array(z.string()),
  rowLabels: z.array(z.string()),
  /** keyed "A1" -> element */
  cells: z.record(skizzeCellSchema),
});
export type SkizzePayload = z.infer<typeof skizzePayloadSchema>;

export const skizzeAnswerSchema = z.object({ cells: z.record(skizzeCellSchema) });
export type SkizzeAnswer = z.infer<typeof skizzeAnswerSchema>;

const COL_ALPHA = "ABCDEFGHIJKL";
const colLabels = (cols: number) => Array.from({ length: cols }, (_, i) => COL_ALPHA[i]);
const rowLabels = (rows: number) => Array.from({ length: rows }, (_, i) => String(i + 1));
export const cellKey = (col: string, row: string) => `${col}${row}`;

const cellsEqual = (a: SkizzeCell | undefined, b: SkizzeCell | undefined): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && (a.dir ?? "") === (b.dir ?? "");
};

export const skizze: GameType<SkizzeConfig, SkizzePayload, SkizzeAnswer> = {
  id: "skizze",
  label: "Lageskizze",
  verification: "auto",
  configSchema: skizzeConfigSchema,
  payloadSchema: skizzePayloadSchema,
  answerSchema: skizzeAnswerSchema,

  generate(config, rng) {
    const cols = colLabels(config.cols);
    const rows = rowLabels(config.rows);
    const allKeys: string[] = [];
    for (const c of cols) for (const r of rows) allKeys.push(cellKey(c, r));

    const filled = Math.min(config.count, allKeys.length);
    const chosen = rng.shuffle(allKeys).slice(0, filled);

    const cells: Record<string, SkizzeCell> = {};
    for (const key of chosen) {
      const kind = rng.pick(ELEMENTS);
      cells[key] = kind === "pfeil" ? { kind, dir: rng.pick(DIRS) } : { kind };
    }
    return { rows: config.rows, cols: config.cols, colLabels: cols, rowLabels: rows, cells };
  },

  compare(payload, answer) {
    const total = payload.rows * payload.cols;
    let correct = 0;
    const heatmap: Record<string, "ok" | "miss" | "false" | "wrong"> = {};
    for (const c of payload.colLabels) {
      for (const r of payload.rowLabels) {
        const key = cellKey(c, r);
        const truth = payload.cells[key];
        const given = answer.cells[key];
        if (cellsEqual(truth, given)) {
          correct++;
          if (truth) heatmap[key] = "ok";
        } else if (truth && !given) heatmap[key] = "miss";
        else if (!truth && given) heatmap[key] = "false";
        else heatmap[key] = "wrong";
      }
    }
    return {
      accuracy: total === 0 ? 1 : correct / total,
      detail: { heatmap, correct, total },
    };
  },
};
