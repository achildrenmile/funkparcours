import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import { hashPassword, verifyPassword, type AdminClaims } from "../auth.js";
import { gameCode, stationToken } from "../tokens.js";
import { scoringConfigSchema, getGameType } from "@funkparcours/shared";
import {
  startGame,
  advancePart,
  buildDashboard,
  loadGameByCode,
} from "../services/game.js";
import { hub } from "../rooms.js";

const { games, gameParts, groups } = schema;

const COOKIE = "fp_admin";

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<AdminClaims> {
  const token = req.cookies[COOKIE];
  if (!token) {
    reply.code(401).send({ error: "not authenticated" });
    throw new Error("unauth");
  }
  try {
    const claims = req.server.jwt.verify<AdminClaims>(token);
    const code = (req.params as { code: string }).code;
    if (claims.code !== code) {
      reply.code(403).send({ error: "wrong game" });
      throw new Error("forbidden");
    }
    return claims;
  } catch {
    reply.code(401).send({ error: "invalid session" });
    throw new Error("unauth");
  }
}

function joinLinks(gs: (typeof groups.$inferSelect)[]) {
  return gs.map((g) => ({
    groupId: g.id,
    name: g.name,
    leitUrl: `${env.PUBLIC_BASE_URL}/s/${g.leitToken}`,
    truppUrl: `${env.PUBLIC_BASE_URL}/s/${g.truppToken}`,
  }));
}

export async function adminRoutes(app: FastifyInstance) {
  // --- create game ---
  app.post("/api/games", async (req, reply) => {
    const body = z
      .object({ title: z.string().min(1).max(120), adminPassword: z.string().min(4).max(200) })
      .parse(req.body);
    let code = gameCode();
    // retry on the (very unlikely) collision
    for (let i = 0; i < 5; i++) {
      const [exists] = await db.select({ id: games.id }).from(games).where(eq(games.code, code));
      if (!exists) break;
      code = gameCode();
    }
    const hash = await hashPassword(body.adminPassword);
    const expiresAt =
      env.DEFAULT_EXPIRY_DAYS > 0
        ? new Date(Date.now() + env.DEFAULT_EXPIRY_DAYS * 86_400_000)
        : null;
    const [game] = await db
      .insert(games)
      .values({ code, adminPasswordHash: hash, title: body.title, expiresAt })
      .returning();
    const tok = req.server.jwt.sign({ gameId: game.id, code, role: "admin" } satisfies AdminClaims);
    setAdminCookie(reply, tok);
    return reply.send({ code, gameId: game.id });
  });

  // --- login ---
  app.post("/api/games/:code/login", async (req, reply) => {
    const { code } = req.params as { code: string };
    const { password } = z.object({ password: z.string() }).parse(req.body);
    const [game] = await db.select().from(games).where(eq(games.code, code));
    if (!game || !(await verifyPassword(game.adminPasswordHash, password))) {
      return reply.code(401).send({ error: "falscher Code oder Passwort" });
    }
    const tok = req.server.jwt.sign({ gameId: game.id, code, role: "admin" } satisfies AdminClaims);
    setAdminCookie(reply, tok);
    return reply.send({ ok: true, gameId: game.id });
  });

  // --- read full game (config view) ---
  app.get("/api/games/:code", async (req, reply) => {
    await requireAdmin(req, reply);
    const { code } = req.params as { code: string };
    const loaded = await loadGameByCode(code);
    if (!loaded) return reply.code(404).send({ error: "not found" });
    const links = joinLinks(loaded.groups);
    const qr: Record<string, { leit: string; trupp: string }> = {};
    for (const l of links) {
      qr[l.groupId] = {
        leit: await QRCode.toDataURL(l.leitUrl),
        trupp: await QRCode.toDataURL(l.truppUrl),
      };
    }
    return reply.send({
      game: {
        code: loaded.game.code,
        title: loaded.game.title,
        status: loaded.game.status,
        scoringConfig: loaded.game.scoringConfig,
        antiCheatMode: loaded.game.antiCheatMode,
        currentPartId: loaded.game.currentPartId,
      },
      parts: loaded.parts,
      groups: loaded.groups.map((g) => ({ id: g.id, name: g.name })),
      links,
      qr,
    });
  });

  // --- configure (draft only) ---
  app.put("/api/games/:code/config", async (req, reply) => {
    const claims = await requireAdmin(req, reply);
    const { code } = req.params as { code: string };
    const [game] = await db.select().from(games).where(eq(games.code, code));
    if (!game) return reply.code(404).send({ error: "not found" });
    if (game.status !== "draft") {
      return reply.code(409).send({ error: "Konfiguration nur im Entwurf möglich" });
    }
    const body = z
      .object({
        title: z.string().min(1).max(120).optional(),
        scoringConfig: scoringConfigSchema,
        antiCheatMode: z.enum(["unique_per_group", "same_for_all"]),
        groups: z.array(z.object({ name: z.string().min(1).max(60) })).min(1).max(50),
        parts: z
          .array(
            z.object({
              type: z.string(),
              config: z.record(z.unknown()).default({}),
              verification: z.enum(["auto", "manual_photo"]).default("auto"),
              maxAttempts: z.number().int().min(1).max(10).default(1),
            }),
          )
          .min(1)
          .max(30),
      })
      .parse(req.body);

    // validate each part's config against its game type
    for (const p of body.parts) {
      const gt = getGameType(p.type);
      gt.configSchema.parse(p.config);
    }

    await db
      .update(games)
      .set({
        title: body.title ?? game.title,
        scoringConfig: body.scoringConfig,
        antiCheatMode: body.antiCheatMode,
      })
      .where(eq(games.id, game.id));

    // replace parts
    await db.delete(gameParts).where(eq(gameParts.gameId, game.id));
    await db.insert(gameParts).values(
      body.parts.map((p, i) => ({
        gameId: game.id,
        orderIndex: i,
        type: p.type,
        config: getGameType(p.type).configSchema.parse(p.config) as object,
        verification: p.verification,
        maxAttempts: p.maxAttempts,
      })),
    );

    // groups: keep existing tokens, add/rename to match desired list by index
    const existing = await db.select().from(groups).where(eq(groups.gameId, game.id));
    for (let i = 0; i < body.groups.length; i++) {
      const desired = body.groups[i];
      if (existing[i]) {
        await db.update(groups).set({ name: desired.name }).where(eq(groups.id, existing[i].id));
      } else {
        await db.insert(groups).values({
          gameId: game.id,
          name: desired.name,
          leitToken: stationToken(),
          truppToken: stationToken(),
        });
      }
    }

    void claims;
    return reply.send({ ok: true });
  });

  // --- lifecycle ---
  app.post("/api/games/:code/start", async (req, reply) => {
    await requireAdmin(req, reply);
    const [game] = await db.select().from(games).where(eq(games.code, (req.params as any).code));
    if (!game) return reply.code(404).send({ error: "not found" });
    const partId = await startGame(game.id);
    hub.toGame(game.id, { type: "game_started", partId });
    hub.toGame(game.id, { type: "leaderboard_update" });
    return reply.send({ ok: true, currentPartId: partId });
  });

  app.post("/api/games/:code/next", async (req, reply) => {
    await requireAdmin(req, reply);
    const [game] = await db.select().from(games).where(eq(games.code, (req.params as any).code));
    if (!game) return reply.code(404).send({ error: "not found" });
    const partId = await advancePart(game.id);
    hub.toGame(game.id, { type: partId ? "part_changed" : "game_finished", partId });
    return reply.send({ ok: true, currentPartId: partId });
  });

  app.post("/api/games/:code/finish", async (req, reply) => {
    await requireAdmin(req, reply);
    const [game] = await db.select().from(games).where(eq(games.code, (req.params as any).code));
    if (!game) return reply.code(404).send({ error: "not found" });
    await db.update(games).set({ status: "finished" }).where(eq(games.id, game.id));
    hub.toGame(game.id, { type: "game_finished", partId: null });
    return reply.send({ ok: true });
  });

  // --- dashboard ---
  app.get("/api/games/:code/dashboard", async (req, reply) => {
    await requireAdmin(req, reply);
    const [game] = await db.select().from(games).where(eq(games.code, (req.params as any).code));
    if (!game) return reply.code(404).send({ error: "not found" });
    return reply.send(await buildDashboard(game.id));
  });

  // --- CSV export ---
  app.get("/api/games/:code/stats.csv", async (req, reply) => {
    await requireAdmin(req, reply);
    const [game] = await db.select().from(games).where(eq(games.code, (req.params as any).code));
    if (!game) return reply.code(404).send({ error: "not found" });
    const dash = await buildDashboard(game.id);
    const lines = ["group,part_index,part_id,accuracy,duration_ms,score,rank"];
    dash.perPartScores.forEach((part, pi) => {
      for (const e of part.entries) {
        lines.push(
          [
            csv(e.name),
            pi,
            part.partId,
            e.accuracy ?? "",
            e.durationMs ?? "",
            e.score.toFixed(3),
            e.rank ?? "",
          ].join(","),
        );
      }
    });
    lines.push("");
    lines.push("group,total,parts");
    for (const t of dash.totals) lines.push([csv(t.name), t.total.toFixed(3), t.parts].join(","));
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="funkparcours-${game.code}.csv"`);
    return reply.send(lines.join("\n"));
  });
}

function setAdminCookie(reply: FastifyReply, token: string) {
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
    maxAge: 12 * 3600,
  });
}

function csv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
