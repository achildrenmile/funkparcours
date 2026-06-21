export * from "./rng.js";
export * from "./gametype.js";
export * from "./scoring.js";
export * from "./games/symbolkarte.js";

import { registerGameType, hasGameType } from "./gametype.js";
import { symbolkarte } from "./games/symbolkarte.js";

/**
 * Register all built-in game types. Idempotent so it's safe to call from both
 * the server boot and tests. Future plugins (nato, meldung, koordinaten, lego,
 * schaltung) get added here.
 */
export function registerBuiltinGameTypes(): void {
  if (!hasGameType(symbolkarte.id)) registerGameType(symbolkarte);
}
