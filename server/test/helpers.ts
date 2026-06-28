import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { registerBuiltinGameTypes } from "@funkparcours/shared";
import { buildApp } from "../src/app.js";
import { db, schema, sql } from "../src/db/index.js";
import { startGame, startTransmission } from "../src/services/game.js";

// seedGame drives the services directly (no app), so the game-type registry must
// be populated before any seeding. Idempotent — buildApp() also calls it.
registerBuiltinGameTypes();

const { games, gameParts, groups, rounds } = schema;

/** One app instance for the whole functional suite (rate-limit tests build their own). */
let app: FastifyInstance | null = null;
export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function closeApp(): Promise<void> {
  if (app) await app.close();
  app = null;
}

/** Drop all rows. FK cascade from games clears parts/rounds/groups/submissions/events. */
export async function resetDb(): Promise<void> {
  await sql.unsafe("TRUNCATE games CASCADE");
}

// Functional requests must NOT share a rate-limit bucket, or accumulated calls
// across tests would spuriously 429. @fastify/rate-limit keys on client IP and the
// app runs trustProxy, so a unique X-Forwarded-For per call = an independent bucket.
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.0.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

type InjectOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  payload?: unknown;
  /** Fix the bucket IP (rate-limit tests). Default: a unique IP per request. */
  ip?: string;
  headers?: Record<string, string>;
};

export async function req(opts: InjectOpts) {
  const a = await getApp();
  return a.inject({
    method: opts.method ?? "GET",
    url: opts.url,
    payload: opts.payload as object | undefined,
    headers: { "x-forwarded-for": opts.ip ?? freshIp(), ...(opts.headers ?? {}) },
  });
}

export interface SeededGroup {
  id: string;
  name: string;
  leitToken: string;
  truppToken: string;
}

export interface Seeded {
  gameId: string;
  code: string;
  partId: string;
  groups: SeededGroup[];
}

export interface SeedOpts {
  type?: string;
  antiCheatMode?: "unique_per_group" | "same_for_all";
  groupCount?: number;
  maxAttempts?: number;
  config?: Record<string, unknown>;
}

/**
 * Seed a *running* game with one part and N groups, with rounds generated via the
 * real service (so seeds/payloads are realistic). Rounds start un-transmitted.
 */
export async function seedGame(o: SeedOpts = {}): Promise<Seeded> {
  const type = o.type ?? "symbolkarte";
  const groupCount = o.groupCount ?? 2;
  const code = `T${randomUUID().slice(0, 8)}`;

  const [game] = await db
    .insert(games)
    .values({
      code,
      adminPasswordHash: "$argon2id$bogus", // verifyPassword returns false on bad hash
      title: "Test Game",
      status: "draft",
      antiCheatMode: o.antiCheatMode ?? "unique_per_group",
    })
    .returning();

  const [part] = await db
    .insert(gameParts)
    .values({
      gameId: game.id,
      orderIndex: 0,
      type,
      config: (o.config ?? {}) as object,
      maxAttempts: o.maxAttempts ?? 1,
    })
    .returning();

  const seededGroups: SeededGroup[] = [];
  for (let i = 0; i < groupCount; i++) {
    const [g] = await db
      .insert(groups)
      .values({
        gameId: game.id,
        name: `Gruppe ${i + 1}`,
        leitToken: `leit_${randomUUID()}`,
        truppToken: `trupp_${randomUUID()}`,
      })
      .returning();
    seededGroups.push({
      id: g.id,
      name: g.name,
      leitToken: g.leitToken,
      truppToken: g.truppToken,
    });
  }

  // startGame sets status=running, currentPartId, and generates one round per group.
  await startGame(game.id);

  return { gameId: game.id, code, partId: part.id, groups: seededGroups };
}

/** Reveal (start the server-side timer) for one group's round on the current part. */
export async function startGroup(partId: string, groupId: string): Promise<Date> {
  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.gamePartId, partId), eq(rounds.groupId, groupId)));
  return startTransmission(round.id);
}

/** The generated round row for a group (source of truth incl. payload + seed). */
export async function roundOf(partId: string, groupId: string) {
  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.gamePartId, partId), eq(rounds.groupId, groupId)));
  return round;
}

export { db, schema, sql };
