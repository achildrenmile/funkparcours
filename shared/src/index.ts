export * from "./rng.js";
export * from "./gametype.js";
export * from "./scoring.js";
export * from "./games/symbolkarte.js";
export * from "./games/nato.js";
export * from "./games/meldung.js";
export * from "./games/koordinaten.js";

import { registerGameType, hasGameType, type GameType } from "./gametype.js";
import { symbolkarte } from "./games/symbolkarte.js";
import { nato } from "./games/nato.js";
import { meldung } from "./games/meldung.js";
import { koordinaten } from "./games/koordinaten.js";

/**
 * Register all built-in game types. Idempotent so it's safe to call from both
 * the server boot and tests. Future plugins (lego, schaltung) get added here.
 */
export function registerBuiltinGameTypes(): void {
  const all: GameType<any, any, any>[] = [symbolkarte, nato, meldung, koordinaten];
  for (const gt of all) if (!hasGameType(gt.id)) registerGameType(gt);
}
