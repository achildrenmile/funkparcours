import { z } from "zod";
import type { GameType } from "../gametype.js";
import type { SeededRng } from "../rng.js";

export const SHAPES = ["kreis", "dreieck", "quadrat", "stern"] as const;
export const COLORS = ["rot", "blau", "gruen", "gelb", "schwarz", "weiss"] as const;
export type Shape = (typeof SHAPES)[number];
export type Color = (typeof COLORS)[number];

export const symbolSchema = z.object({
  shape: z.enum(SHAPES),
  color: z.enum(COLORS),
});
export type Symbol = z.infer<typeof symbolSchema>;

export const symbolkarteConfigSchema = z.object({
  rows: z.number().int().min(1).max(12).default(5),
  cols: z.number().int().min(1).max(12).default(5),
  shapes: z.array(z.enum(SHAPES)).min(1).default([...SHAPES]),
  colors: z.array(z.enum(COLORS)).min(1).default(["rot", "blau", "gruen", "gelb"]),
  /** number of filled cells */
  symbolCount: z.number().int().min(1).max(64).default(6),
  stacking: z.boolean().default(false),
  maxStack: z.number().int().min(1).max(5).default(3),
});
export type SymbolkarteConfig = z.infer<typeof symbolkarteConfigSchema>;

/** bottom-first stack of symbols on a cell */
const stackSchema = z.array(symbolSchema);

export const symbolkartePayloadSchema = z.object({
  rows: z.number().int(),
  cols: z.number().int(),
  /** e.g. ["A","B","C","D","E"] */
  colLabels: z.array(z.string()),
  /** e.g. ["1","2","3","4","5"] */
  rowLabels: z.array(z.string()),
  /** keyed "A1" (col label + row label) -> stack */
  cells: z.record(stackSchema),
});
export type SymbolkartePayload = z.infer<typeof symbolkartePayloadSchema>;

export const symbolkarteAnswerSchema = z.object({
  cells: z.record(stackSchema),
});
export type SymbolkarteAnswer = z.infer<typeof symbolkarteAnswerSchema>;

const COL_ALPHA = "ABCDEFGHIJKL";

function colLabels(cols: number): string[] {
  return Array.from({ length: cols }, (_, i) => COL_ALPHA[i]);
}
function rowLabels(rows: number): string[] {
  return Array.from({ length: rows }, (_, i) => String(i + 1));
}
export function cellKey(col: string, row: string): string {
  return `${col}${row}`;
}

function stacksEqual(a: Symbol[], b: Symbol[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].shape !== b[i].shape || a[i].color !== b[i].color) return false;
  }
  return true;
}

export const symbolkarte: GameType<SymbolkarteConfig, SymbolkartePayload, SymbolkarteAnswer> = {
  id: "symbolkarte",
  label: "Symbolkarte",
  verification: "auto",
  configSchema: symbolkarteConfigSchema,
  payloadSchema: symbolkartePayloadSchema,
  answerSchema: symbolkarteAnswerSchema,

  generate(config, rng: SeededRng): SymbolkartePayload {
    const cols = colLabels(config.cols);
    const rows = rowLabels(config.rows);
    const allKeys: string[] = [];
    for (const c of cols) for (const r of rows) allKeys.push(cellKey(c, r));

    const filledCount = Math.min(config.symbolCount, allKeys.length);
    const chosen = rng.shuffle(allKeys).slice(0, filledCount);

    const cells: Record<string, Symbol[]> = {};
    for (const key of chosen) {
      const stackSize = config.stacking ? rng.int(1, config.maxStack) : 1;
      const stack: Symbol[] = [];
      for (let i = 0; i < stackSize; i++) {
        stack.push({
          shape: rng.pick(config.shapes),
          color: rng.pick(config.colors),
        });
      }
      cells[key] = stack;
    }

    return {
      rows: config.rows,
      cols: config.cols,
      colLabels: cols,
      rowLabels: rows,
      cells,
    };
  },

  compare(payload, answer) {
    const total = payload.rows * payload.cols;
    let correct = 0;
    const heatmap: Record<string, boolean> = {};
    for (const c of payload.colLabels) {
      for (const r of payload.rowLabels) {
        const key = cellKey(c, r);
        const truth = payload.cells[key] ?? [];
        const given = answer.cells[key] ?? [];
        const ok = stacksEqual(truth, given);
        heatmap[key] = ok;
        if (ok) correct++;
      }
    }
    return {
      accuracy: total === 0 ? 1 : correct / total,
      detail: { heatmap, correct, total },
    };
  },

  samplePerfectAnswer(payload) {
    return { cells: { ...payload.cells } };
  },
};
