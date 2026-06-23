import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { getGameType } from "@funkparcours/shared";
import { startTransmission, submitAnswer } from "../services/game.js";
import { hub } from "../rooms.js";

const { games, gameParts, groups, rounds, submissions } = schema;

export interface ResolvedStation {
  group: typeof groups.$inferSelect;
  role: "leit" | "trupp";
}

export async function resolveStation(token: string): Promise<ResolvedStation | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(or(eq(groups.leitToken, token), eq(groups.truppToken, token)));
  if (!group) return null;
  return { group, role: group.leitToken === token ? "leit" : "trupp" };
}

export async function stationRoutes(app: FastifyInstance) {
  // --- resolve role + current state. Trupp NEVER receives the payload. ---
  app.get("/api/station/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const st = await resolveStation(token);
    if (!st) return reply.code(404).send({ error: "ungültiger Link" });
    const [game] = await db.select().from(games).where(eq(games.id, st.group.gameId));

    const base = {
      role: st.role,
      groupId: st.group.id,
      groupName: st.group.name,
      gameTitle: game.title,
      gameStatus: game.status,
    };

    if (game.status !== "running" || !game.currentPartId) {
      return reply.send({ ...base, part: null });
    }

    const [part] = await db.select().from(gameParts).where(eq(gameParts.id, game.currentPartId));
    const [round] = await db
      .select()
      .from(rounds)
      .where(and(eq(rounds.gamePartId, part.id), eq(rounds.groupId, st.group.id)));

    if (!round) return reply.send({ ...base, part: null });

    const part_common = {
      partId: part.id,
      roundId: round.id,
      type: part.type,
      label: getGameType(part.type).label,
      verification: part.verification,
      maxAttempts: part.maxAttempts,
      startedAt: round.startedAt,
      roundStatus: round.status,
      // config is render metadata (grid size, palette) — not the answer
      config: part.config,
    };

    if (st.role === "leit") {
      // relais: this group can only transmit once the chain reached it
      const ready = part.type === "relais" ? (round.payload as { incoming?: unknown })?.incoming != null : true;
      // payload (the filled template) only after the timer started
      return reply.send({
        ...base,
        part: { ...part_common, ready, payload: round.startedAt ? round.payload : null },
      });
    }

    // trupp: include own last submission result if any (for feedback screen)
    const subs = await db
      .select()
      .from(submissions)
      .where(eq(submissions.roundId, round.id));
    const last = subs.sort((a, b) => b.attemptNo - a.attemptNo)[0];
    return reply.send({
      ...base,
      part: {
        ...part_common,
        attemptsUsed: subs.length,
        lastResult: last
          ? {
              accuracy: Number(last.accuracy),
              durationMs: last.durationMs,
              score: Number(last.score ?? 0),
              detail: last.detail,
            }
          : null,
      },
    });
  });

  // --- leit: start transmission (reveal + start server-side timer) ---
  app.post("/api/station/:token/start", async (req, reply) => {
    const { token } = req.params as { token: string };
    const st = await resolveStation(token);
    if (!st || st.role !== "leit") return reply.code(403).send({ error: "nur Leitstation" });
    const [game] = await db.select().from(games).where(eq(games.id, st.group.gameId));
    if (game.status !== "running" || !game.currentPartId) {
      return reply.code(409).send({ error: "Spiel läuft nicht" });
    }
    const [round] = await db
      .select()
      .from(rounds)
      .where(and(eq(rounds.gamePartId, game.currentPartId), eq(rounds.groupId, st.group.id)));
    if (!round) return reply.code(404).send({ error: "keine Runde" });
    const [curPart] = await db.select().from(gameParts).where(eq(gameParts.id, game.currentPartId));
    if (curPart?.type === "relais" && (round.payload as { incoming?: unknown })?.incoming == null) {
      return reply.code(409).send({ error: "Vorherige Gruppe in der Kette ist noch nicht fertig." });
    }
    const startedAt = await startTransmission(round.id);
    hub.toGroup(game.id, st.group.id, {
      type: "round_started",
      groupId: st.group.id,
      roundId: round.id,
      startedAt: startedAt.toISOString(),
    });
    return reply.send({ ok: true, startedAt });
  });

  // --- trupp: submit rebuild ---
  app.post(
    "/api/station/:token/submit",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
    const { token } = req.params as { token: string };
    const st = await resolveStation(token);
    if (!st || st.role !== "trupp") return reply.code(403).send({ error: "nur Empfangstrupp" });
    const { answer } = z.object({ answer: z.unknown() }).parse(req.body);
    const [game] = await db.select().from(games).where(eq(games.id, st.group.gameId));
    if (!game.currentPartId) return reply.code(409).send({ error: "Spiel läuft nicht" });
    const [round] = await db
      .select()
      .from(rounds)
      .where(and(eq(rounds.gamePartId, game.currentPartId), eq(rounds.groupId, st.group.id)));
    if (!round) return reply.code(404).send({ error: "keine Runde" });
    try {
      const result = await submitAnswer(round.id, answer);
      hub.toGroup(game.id, st.group.id, {
        type: "submission_scored",
        groupId: st.group.id,
        accuracy: result.accuracy,
      });
      // relais: wake the next group in the chain — its input is now available
      if (result.nextGroupId) {
        hub.toGroup(game.id, result.nextGroupId, { type: "chain_advanced", groupId: result.nextGroupId });
      }
      hub.toGame(game.id, { type: "leaderboard_update" });
      return reply.send(result);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
    },
  );
}
