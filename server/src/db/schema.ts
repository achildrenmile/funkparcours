import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  adminPasswordHash: text("admin_password_hash").notNull(),
  title: text("title").notNull(),
  // draft | running | finished
  status: text("status").notNull().default("draft"),
  scoringConfig: jsonb("scoring_config").notNull().default({ mode: "weighted" }),
  // unique_per_group | same_for_all
  antiCheatMode: text("anti_cheat_mode").notNull().default("unique_per_group"),
  currentPartId: uuid("current_part_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const gameParts = pgTable(
  "game_parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    type: text("type").notNull(),
    config: jsonb("config").notNull().default({}),
    // auto | manual_photo
    verification: text("verification").notNull().default("auto"),
    maxAttempts: integer("max_attempts").notNull().default(1),
  },
  (t) => ({
    byGame: index("game_parts_game_idx").on(t.gameId, t.orderIndex),
  }),
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    leitToken: text("leit_token").notNull().unique(),
    truppToken: text("trupp_token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byGame: index("groups_game_idx").on(t.gameId),
  }),
);

export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gamePartId: uuid("game_part_id")
      .notNull()
      .references(() => gameParts.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    // generated template = source of truth
    payload: jsonb("payload").notNull(),
    seed: text("seed").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    // pending | transmitting | submitted | scored
    status: text("status").notNull().default("pending"),
  },
  (t) => ({
    uniq: uniqueIndex("rounds_part_group_idx").on(t.gamePartId, t.groupId),
  }),
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    answer: jsonb("answer").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    attemptNo: integer("attempt_no").notNull().default(1),
    accuracy: numeric("accuracy"),
    durationMs: integer("duration_ms"),
    score: numeric("score"),
    detail: jsonb("detail"),
  },
  (t) => ({
    byRound: index("submissions_round_idx").on(t.roundId),
  }),
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byGame: index("events_game_idx").on(t.gameId, t.createdAt),
  }),
);

export type Game = typeof games.$inferSelect;
export type GamePart = typeof gameParts.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
