import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import type { AdminClaims } from "../auth.js";

const { games, gameParts, groups, rounds, submissions, events } = schema;

const COOKIE = "fp_super";
const SESSION_EXPIRES_IN = "8h";
const SESSION_MAX_AGE = 8 * 3600;

interface SuperClaims {
  role: "superadmin";
  user: string;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function requireSuper(req: FastifyRequest, reply: FastifyReply): SuperClaims {
  if (!env.superadminEnabled) {
    reply.code(503).send({ error: "Superadmin nicht konfiguriert" });
    throw new Error("disabled");
  }
  const token = req.cookies[COOKIE];
  if (!token) {
    reply.code(401).send({ error: "not authenticated" });
    throw new Error("unauth");
  }
  try {
    const claims = req.server.jwt.verify<SuperClaims>(token);
    if (claims.role !== "superadmin") throw new Error("role");
    return claims;
  } catch {
    reply.code(401).send({ error: "invalid session" });
    throw new Error("unauth");
  }
}

function setCookie(reply: FastifyReply, token: string) {
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function superadminRoutes(app: FastifyInstance) {
  const tight = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  app.post("/api/super/login", tight, async (req, reply) => {
    if (!env.superadminEnabled) {
      return reply.code(503).send({ error: "Superadmin nicht konfiguriert" });
    }
    const { username, password } = z
      .object({ username: z.string(), password: z.string() })
      .parse(req.body);
    const ok = safeEqual(username, env.SUPERADMIN_USER) && safeEqual(password, env.SUPERADMIN_PASSWORD);
    if (!ok) return reply.code(401).send({ error: "falscher Benutzer oder Passwort" });
    const tok = req.server.jwt.sign(
      { role: "superadmin", user: env.SUPERADMIN_USER } satisfies SuperClaims,
      { expiresIn: SESSION_EXPIRES_IN },
    );
    setCookie(reply, tok);
    return reply.send({ ok: true });
  });

  app.post("/api/super/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/api/super/me", async (req, reply) => {
    const claims = requireSuper(req, reply);
    return reply.send({ ok: true, user: claims.user });
  });

  // --- overview: stats + all games with counts ---
  app.get("/api/super/overview", async (req, reply) => {
    requireSuper(req, reply);
    const [allGames, allGroups, allParts, allRounds, allSubs, allEvents] = await Promise.all([
      db.select().from(games),
      db.select().from(groups),
      db.select().from(gameParts),
      db.select().from(rounds),
      db.select().from(submissions),
      db.select().from(events),
    ]);

    const partIdsByGame = new Map<string, Set<string>>();
    for (const p of allParts) {
      if (!partIdsByGame.has(p.gameId)) partIdsByGame.set(p.gameId, new Set());
      partIdsByGame.get(p.gameId)!.add(p.id);
    }
    const roundCountByGame = new Map<string, number>();
    const subRoundIds = new Set(allSubs.map((s) => s.roundId));
    const roundGameOf = new Map<string, string>(); // roundId -> gameId
    for (const r of allRounds) {
      // find game via part
      for (const [gid, set] of partIdsByGame) {
        if (set.has(r.gamePartId)) {
          roundGameOf.set(r.id, gid);
          roundCountByGame.set(gid, (roundCountByGame.get(gid) ?? 0) + 1);
          break;
        }
      }
    }
    const subCountByGame = new Map<string, number>();
    for (const s of allSubs) {
      const gid = roundGameOf.get(s.roundId);
      if (gid) subCountByGame.set(gid, (subCountByGame.get(gid) ?? 0) + 1);
    }
    const count = (arr: { gameId: string }[]) => {
      const m = new Map<string, number>();
      for (const x of arr) m.set(x.gameId, (m.get(x.gameId) ?? 0) + 1);
      return m;
    };
    const groupsBy = count(allGroups);
    const partsBy = count(allParts);
    const eventsBy = count(allEvents);

    const list = allGames
      .map((g) => ({
        id: g.id,
        code: g.code,
        title: g.title,
        status: g.status,
        antiCheatMode: g.antiCheatMode,
        scoringMode: (g.scoringConfig as any)?.mode ?? "?",
        createdAt: g.createdAt,
        expiresAt: g.expiresAt,
        groups: groupsBy.get(g.id) ?? 0,
        parts: partsBy.get(g.id) ?? 0,
        rounds: roundCountByGame.get(g.id) ?? 0,
        submissions: subCountByGame.get(g.id) ?? 0,
        events: eventsBy.get(g.id) ?? 0,
      }))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return reply.send({
      stats: {
        games: allGames.length,
        groups: allGroups.length,
        parts: allParts.length,
        rounds: allRounds.length,
        submissions: allSubs.length,
        events: allEvents.length,
        submittedRounds: subRoundIds.size,
      },
      games: list,
    });
  });

  // --- drill-down: everything for one game ---
  app.get("/api/super/games/:id", async (req, reply) => {
    requireSuper(req, reply);
    const { id } = req.params as { id: string };
    const [game] = await db.select().from(games).where(eq(games.id, id));
    if (!game) return reply.code(404).send({ error: "not found" });
    const grps = await db.select().from(groups).where(eq(groups.gameId, id));
    const parts = await db
      .select()
      .from(gameParts)
      .where(eq(gameParts.gameId, id))
      .orderBy(gameParts.orderIndex);
    const partIds = parts.map((p) => p.id);
    const rnds = partIds.length
      ? await db.select().from(rounds).where(inArray(rounds.gamePartId, partIds))
      : [];
    const roundIds = rnds.map((r) => r.id);
    const subs = roundIds.length
      ? await db.select().from(submissions).where(inArray(submissions.roundId, roundIds))
      : [];
    const evs = await db.select().from(events).where(eq(events.gameId, id)).orderBy(events.createdAt);
    const groupName = new Map(grps.map((g) => [g.id, g.name]));

    return reply.send({
      game: { ...game, adminPasswordHash: "***" }, // never expose the hash
      groups: grps,
      parts,
      rounds: rnds.map((r) => ({
        id: r.id,
        groupId: r.groupId,
        groupName: groupName.get(r.groupId) ?? "?",
        gamePartId: r.gamePartId,
        status: r.status,
        seed: r.seed,
        startedAt: r.startedAt,
      })),
      submissions: subs.map((s) => ({
        id: s.id,
        roundId: s.roundId,
        attemptNo: s.attemptNo,
        accuracy: s.accuracy,
        durationMs: s.durationMs,
        score: s.score,
        submittedAt: s.submittedAt,
      })),
      events: evs,
    });
  });

  // --- impersonate: mint a normal admin session for any game, so the
  //     superadmin can fully manage it (config/start/dashboard/links) ---
  app.post("/api/super/games/:id/admin-session", async (req, reply) => {
    requireSuper(req, reply);
    const { id } = req.params as { id: string };
    const [game] = await db.select().from(games).where(eq(games.id, id));
    if (!game) return reply.code(404).send({ error: "not found" });
    const tok = req.server.jwt.sign(
      { gameId: game.id, code: game.code, role: "admin" } satisfies AdminClaims,
      { expiresIn: "7d" },
    );
    reply.setCookie("fp_admin", tok, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.COOKIE_SECURE,
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
    return reply.send({ ok: true, code: game.code, status: game.status });
  });

  // --- delete a game (cascades to parts/groups/rounds/submissions/events) ---
  app.delete("/api/super/games/:id", async (req, reply) => {
    requireSuper(req, reply);
    const { id } = req.params as { id: string };
    const deleted = await db.delete(games).where(eq(games.id, id)).returning({ id: games.id });
    if (!deleted.length) return reply.code(404).send({ error: "not found" });
    return reply.send({ ok: true });
  });
}
