import type { ZodType, ZodTypeDef } from "zod";
import type { SeededRng } from "./rng.js";

/** A zod schema whose parsed output is `T` (input may differ via defaults). */
type Schema<T> = ZodType<T, ZodTypeDef, any>;

export type Verification = "auto" | "manual_photo";

export interface CompareResult {
  /** normalized 0..1 */
  accuracy: number;
  /** type-specific breakdown, e.g. per-field heatmap */
  detail: unknown;
}

/**
 * A game type is a self-contained plugin. The backend uses `generate` (to build
 * the round payload = source of truth) and `compare` (auto scoring). The frontend
 * supplies a matching LeitView/TruppView via its own registry keyed by `id`.
 */
export interface GameType<Config = unknown, Payload = unknown, Answer = unknown> {
  id: string;
  label: string;
  /** admin-facing config schema */
  configSchema: Schema<Config>;
  /** shape of the generated template */
  payloadSchema: Schema<Payload>;
  /** shape the trupp submits */
  answerSchema: Schema<Answer>;
  verification: Verification;

  /** deterministic given (config, rng) */
  generate(config: Config, rng: SeededRng): Payload;

  /** only meaningful for verification === "auto" */
  compare(payload: Payload, answer: Answer): CompareResult;

  /**
   * The answer that scores a perfect 1.0 against `payload`. Used by the registry
   * contract test to verify generate/compare agree. Required by design: a new
   * plugin can't compile without it, so it can never skip the contract.
   */
  samplePerfectAnswer(payload: Payload): Answer;
}

const registry = new Map<string, GameType<any, any, any>>();

export function registerGameType(gt: GameType<any, any, any>): void {
  if (registry.has(gt.id)) throw new Error(`game type already registered: ${gt.id}`);
  registry.set(gt.id, gt);
}

export function getGameType(id: string): GameType<any, any, any> {
  const gt = registry.get(id);
  if (!gt) throw new Error(`unknown game type: ${id}`);
  return gt;
}

export function hasGameType(id: string): boolean {
  return registry.has(id);
}

export function listGameTypes(): GameType<any, any, any>[] {
  return [...registry.values()];
}
