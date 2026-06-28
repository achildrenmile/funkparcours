import { buildApp } from "./app.js";
import { env } from "./env.js";
import { cleanupExpiredGames } from "./services/game.js";

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`FunkParcours server on :${env.PORT} (${env.NODE_ENV})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// hourly cleanup of expired games
const cleanup = setInterval(
  () => {
    cleanupExpiredGames()
      .then((n) => n > 0 && app.log.info(`cleaned up ${n} expired game(s)`))
      .catch((e) => app.log.error(e));
  },
  60 * 60 * 1000,
);
cleanup.unref();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    void (async () => {
      app.log.info(`${sig} received, shutting down`);
      await app.close();
      process.exit(0);
    })();
  });
}
