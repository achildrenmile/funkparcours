# FunkParcours — SPEC

Multimandantenfähiges Web-Tool für Funkübungen. **Das Funkgerät ist der Kanal, die
Plattform ist Quelle der Wahrheit + Wertung.** Kein Daten-Sync der Aufgabeninhalte
zwischen Leit- und Empfangs-View — nur Start/Timer/Submit/Leaderboard sind Realtime.

## Architektur

Monorepo (npm workspaces):

- `shared/` — Zod-Schemas, `GameType`-Plugin-Interface, Seeded-RNG, Wertungs-Engine,
  Spieltyp-Implementierungen (generate + compare, FE-frei). Von FE **und** BE genutzt.
- `server/` — Fastify + WS (`@fastify/websocket`), Drizzle ORM + Postgres, argon2-Auth,
  Pino. Aller State in DB → neustart-fest.
- `web/` — Vite + React + Tailwind, dnd-kit, react-router. Pro Typ `LeitView`/`TruppView`.

## Datenmodell (Postgres / Drizzle)

- `games` — id, code (uniq, kurz), admin_password_hash, title, status
  (`draft|running|finished`), scoring_config jsonb, anti_cheat_mode
  (`unique_per_group|same_for_all`), current_part_id, created_at, expires_at.
- `game_parts` — id, game_id, order_index, type, config jsonb, verification
  (`auto|manual_photo`), max_attempts (default 1).
- `groups` — id, game_id, name, leit_token (uniq), trupp_token (uniq), created_at.
- `rounds` — id, game_part_id, group_id, payload jsonb (= Vorlage / Wahrheit),
  seed, started_at, status (`pending|transmitting|submitted|scored`).
- `submissions` — id, round_id, answer jsonb, submitted_at, attempt_no, accuracy num,
  duration_ms, score num, detail jsonb.
- `events` — id, game_id, type, data jsonb, created_at (Live-Feed/Audit).

Defaults: Anti-Cheat `unique_per_group` (eigene zufällige Vorlage gleicher Schwierigkeit
pro Gruppe). Timer server-seitig: `rounds.started_at` → `submissions.submitted_at`.
Submit final pro Runde; `max_attempts` default 1.

## API-Routen (REST)

- `POST /api/games` — Spiel anlegen {title, adminPassword} → {code, gameId}.
- `POST /api/games/:code/login` — {password} → Admin-JWT-Cookie.
- `GET  /api/games/:code` — Admin: Game inkl. parts + groups (auth).
- `PUT  /api/games/:code/config` — parts + groups + scoring + antiCheat setzen (auth).
- `POST /api/games/:code/start` — status→running, erste Runden generieren (auth).
- `POST /api/games/:code/next` — nächster Spielteil (auth).
- `POST /api/games/:code/finish` — status→finished (auth).
- `GET  /api/games/:code/dashboard` — Live-State + Leaderboard (auth).
- `GET  /api/games/:code/stats.csv` — CSV-Export (auth).
- `GET  /api/station/:token` — Rolle + minimal-State auflösen. **Leit** bekommt Payload
  erst nach `started_at`; **Trupp** bekommt Payload **nie**.
- `POST /api/station/:token/start` — Leit: `leit_start_transmission` (setzt started_at).
- `POST /api/station/:token/submit` — Trupp: Answer → server berechnet accuracy/score.
- `GET  /healthz` — Health.

Alle Eingaben server-seitig per Zod validiert. Rate-Limit auf login/join/submit.

## WS-Events

Room je Spiel. Client verbindet mit `?token=` (Station) oder Admin-JWT.
- S→C: `game_started`, `part_changed`, `round_started` (an Gruppe), `submission_scored`,
  `leaderboard_update`, `state` (Snapshot bei Connect/Reconnect).
- C→S: nur Steuer-Pings; Mutationen laufen über REST (einfacher, idempotent). WS pusht
  Folgen davon. Reconnect lädt State frisch aus DB.

## GameType-Interface (`shared`)

```ts
interface GameType<Config, Payload, Answer> {
  id; label; configSchema; verification;
  generate(config, rng): Payload;
  compare(payload, answer): { accuracy: number; detail: unknown };
}
```

Generator seeded/deterministisch. FE-Komponenten `LeitView`/`TruppView` pro Typ in `web`,
über Registry an `id` gekoppelt.

## Wertungsmodi (`scoring_config.mode`)

- `time` — nur Zeit; Tie-break Genauigkeit.
- `accuracy_gate` — `min_accuracy` Gate, dann Zeit, Rest nach Genauigkeit.
- `weighted` — `w_acc*acc + w_speed*speed`, `speed=clamp((t_max-d)/(t_max-t_min),0,1)`.
- `points_rank` — Rangpunkte je Runde (1.=N, 2.=N-1…), Summe; optionales acc-Gate.

Gesamt = Summe der Spielteil-Scores. Tie-breaks deterministisch + dokumentiert.

## v1-Spieltypen

`symbolkarte` (Vertical Slice), dann `nato`, `meldung`, `koordinaten`. Später als reine
Plugins: `lego`, `schaltung` (Interface vorbereitet, `manual_photo`-Pfad als Stub).

## Done (Vertical Slice / Phase 5)

`docker compose up` → App+Postgres+Migrations. Admin legt Spiel an, konfiguriert Gruppen
+ symbolkarte-Teil, startet. Leit+Trupp joinen per Token. Start live gepusht, Leit deckt
auf (Timer), Trupp baut nach + gibt ab, Auto-Wertung liefert accuracy+Zeit, Leaderboard
live. Server-Neustart verliert keinen State. Vitest deckt symbolkarte-Generator/-Compare
+ alle vier Wertungsmodi.
