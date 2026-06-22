import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { env } from "./env.js";
import { registerBuiltinGameTypes } from "@funkparcours/shared";
import { adminRoutes } from "./routes/admin.js";
import { stationRoutes } from "./routes/station.js";
import { wsRoutes } from "./routes/ws.js";
import { superadminRoutes } from "./routes/superadmin.js";

export async function buildApp() {
  registerBuiltinGameTypes();

  const app = Fastify({
    logger: {
      level: env.isProd ? "info" : "debug",
      transport: env.isProd ? undefined : { target: "pino-pretty" },
    },
    trustProxy: true,
  });

  await app.register(cookie);
  await app.register(jwt, { secret: env.JWT_SECRET, cookie: { cookieName: "fp_admin", signed: false } });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: () => false,
  });
  await app.register(websocket);

  // Error handler must be set before route plugins so it applies to their
  // encapsulated contexts too. Zod failures -> 400 (no internal details leaked).
  app.setErrorHandler((err: any, _req, reply) => {
    if (err?.validation || err?.name === "ZodError" || Array.isArray(err?.issues)) {
      return reply.code(400).send({ error: "Ungültige Eingabe" });
    }
    if (err?.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    app.log.error(err);
    reply.code(500).send({ error: "interner Fehler" });
  });

  app.get("/healthz", async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(adminRoutes);
  await app.register(stationRoutes);
  await app.register(wsRoutes);
  await app.register(superadminRoutes);

  // serve built frontend if present (single-container prod)
  await serveStatic(app);

  return app;
}

async function serveStatic(app: FastifyInstance) {
  const here = dirname(fileURLToPath(import.meta.url));
  const dist = resolve(here, "../../web/dist");
  if (!existsSync(dist)) {
    app.log.warn(`web/dist not found at ${dist}; serving API only`);
    return;
  }
  const { default: fastifyStatic } = await import("@fastify/static");
  await app.register(fastifyStatic, { root: dist, wildcard: false });
  // SPA fallback for client routes
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/ws")) {
      return reply.code(404).send({ error: "not found" });
    }
    const html = await readFile(resolve(dist, "index.html"), "utf8");
    return reply.type("text/html").send(html);
  });
}
