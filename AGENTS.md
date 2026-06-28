# AGENTS.md — FunkParcours

Working context for agents (and humans). Load this before changing anything; it
holds the invariants, commands, and the plugin recipe so each turn starts grounded.

## What this is

A server-authoritative platform for radio (Funk) training games. The **Leitstation**
reads a generated template aloud over a real radio; the **Empfangstrupp** rebuilds it.
The platform scores the rebuild. The radio is the channel — the app never transmits
the content between the two stations.

Monorepo, npm workspaces: `shared/` (pure game logic + scoring), `server/` (Fastify +
Postgres/Drizzle + WS), `web/` (React/Vite SPA).

## Architecture invariants (do not break)

- **The Funkgerät is the channel.** The app never sends the template from Leit to Trupp; only the radio carries it.
- **The Trupp never receives `payload`.** Not via REST, not in a WS message, not in a reconnect snapshot, in any round state. (`server/test/station-invariants.test.ts`)
- **Leit gets `payload` only after `started_at`.** Revealing starts the server-side timer; before that the template is withheld.
- **State lives in the DB.** Postgres is the source of truth; a restart or reconnect loses nothing. WS holds no authoritative state.
- **REST mutates, WS pushes consequences.** Clients change state over REST and then pull a fresh REST snapshot; WS only carries live signals (`round_started`, `submission_scored`, `leaderboard_update`, `chain_advanced`).
- **Timing is server-authoritative.** `duration_ms = submitted(server now) − started_at`; a client-sent duration/timestamp is ignored.
- **Anti-cheat seeding.** `unique_per_group` → `seed = partId:groupId` (distinct template per group); `same_for_all` → `seed = partId:shared` (identical template).
- **`shared/` is pure.** Game `generate`/`compare` import nothing from `web/`, touch no DOM and no I/O. Enforced by the contract test + ESLint.

> Any change under `server/` that touches a station/round/scoring path needs an
> invariant test in `server/test/` (see Issue #2). A green route is not enough — the
> test must assert the *property* (e.g. the Trupp response carries no answer), never
> just status 200.

## Commands

| task | command |
|------|---------|
| dev server (watch) | `npm run dev:server` |
| dev web (Vite) | `npm run dev:web` |
| run DB migrations | `npm run migrate` (needs `DATABASE_URL`) |
| lint (eslint + typecheck) | `npm run lint` |
| test (all workspaces) | `npm test` |
| build (all workspaces) | `npm run build` |

- `npm run lint` = `eslint .` then `tsc -b` (shared+server) then `tsc -p web/tsconfig.json --noEmit`.
- `npm test` runs every workspace's tests (`npm test --workspaces --if-present`).
- **Server tests need Postgres.** They migrate the DB themselves (`server/test/global-setup.ts`) and read `DATABASE_URL`. Locally: `docker run -d -e POSTGRES_USER=funk -e POSTGRES_PASSWORD=funk -e POSTGRES_DB=funkparcours_test -p 5433:5432 postgres:16-alpine`, then `DATABASE_URL=postgres://funk:funk@localhost:5433/funkparcours_test npm test -w server`.
- CI (`.github/workflows/ci.yml`) runs lint → test → build on every push to `main` and every PR, with a Postgres service container.

## Adding a GameType (plugin recipe)

A game type is a self-contained plugin with two halves — backend logic and frontend
views — each registered in its own registry.

1. **Backend** — `shared/src/games/<id>.ts`: implement `GameType` (`configSchema`,
   `payloadSchema`, `answerSchema`, `generate(config, rng)`, `compare(payload, answer)`,
   `samplePerfectAnswer(payload)`). Keep it pure. `generate` must be deterministic given
   `(config, rng(seed))`.
2. **Register backend** — export it from `shared/src/index.ts` and add it to the list in
   `registerBuiltinGameTypes()`.
3. **Frontend** — `web/src/gametypes/<id>.tsx`: `LeitView`, `TruppView`, `ConfigForm`.
   Add an `FeGameType` entry to `REGISTRY` in `web/src/gametypes/registry.tsx`
   (`id`, `label`, `description`, `defaultConfig`, the three views).
4. **Contract is automatic.** The registry-driven contract test
   (`shared/src/games-contract.test.ts`) iterates every registered type, so a new type
   inherits the laws for free: determinism, perfect-answer → 1.0, garbage → < 1.0,
   accuracy clamped to [0,1], `configSchema.parse({})` valid, purity. It cannot compile
   without `samplePerfectAnswer` — that's the contract enforcing completeness.

The `LeitView` renders the (revealed) `payload`; the `TruppView` renders only from
`config` and submits an `answer` matching `answerSchema`. The Trupp view must never need
`payload`.

## Scoring contract

`scoringConfig` (per game) selects one mode; `scorePart()` in `shared/src/scoring.ts`
scores every group on a part, `totalScores()` aggregates across parts.

- **`time`** — fastest `durationMs` wins; score `1/(1+seconds)`.
- **`accuracy_gate`** — entries with `accuracy ≥ min_accuracy` (default 0.9) are ordered ahead (by speed) of those below; every entry then scores by reverse rank `n−i`, so passing-and-faster scores higher (failers aren't zeroed, just ranked last).
- **`weighted`** — `w_acc·accuracy + w_speed·speed`, where `speed = clamp((t_max − durationMs)/(t_max − t_min), 0, 1)` (defaults `w_acc 0.7`, `w_speed 0.3`, `t_min 10s`, `t_max 120s`).
- **`points_rank`** — gate by `min_accuracy`; gated entries score by reverse rank (1st of `n` gets `n` points); entries below the gate score 0.

**Tie-break (deterministic, everywhere):** primary metric → higher `accuracy` →
shorter `durationMs` → `groupId` ascending. Not-submitted entries score 0 and stay
unranked.

## Map

- `shared/src/gametype.ts` — `GameType` interface + registry (`registerGameType`, `getGameType`, `listGameTypes`).
- `shared/src/games/*.ts` — the 13 game types. `shared/src/scoring.ts` — scoring + tie-break. `shared/src/rng.ts` — seeded RNG.
- `server/src/app.ts` — `buildApp()` (used by tests via `fastify.inject()`). `server/src/routes/station.ts` — the Leit/Trupp endpoints (the security surface). `server/src/services/game.ts` — rounds, seeding, timing, scoring orchestration. `server/src/db/schema.ts` — Drizzle schema.
- `web/src/gametypes/registry.tsx` — frontend view registry.
- `SPEC.md` — original spec. `README.md` — feature/setup overview.
