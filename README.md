# FunkParcours

Multimandantenfähiges Web-Tool für **Funkübungen**. Eine **Leitstation** sieht eine
Aufgabe am Bildschirm und gibt sie **über echtes Funkgerät** an einen **Empfangstrupp**
durch, der die Aufgabe an seinem eigenen Bildschirm nachbaut.

> **Kernmechanik:** Das Funkgerät ist der Kanal — die Plattform überträgt die Nachricht
> **nie**. Sie ist nur **Quelle der Wahrheit**, **Prüfung** und **Wertung**. Zwischen
> Leit- und Empfangs-View gibt es **keinen** Daten-Sync der Aufgabeninhalte. Die einzigen
> Realtime-Signale sind Start, Timer, Submit und Leaderboard.

Status: **v1-Spieltypen vollständig** — `symbolkarte`, `nato`, `meldung`, `koordinaten`
laufen end-to-end (Generator, Leit-/Trupp-View, Auto-Wertung, Live-Leaderboard) über ein
gemeinsames Plugin-Interface. `lego`/`schaltung` (`manual_photo`) folgen als reine Plugins.

---

## Architektur

Monorepo (npm workspaces):

| Workspace | Inhalt |
|-----------|--------|
| `shared/` | Zod-Schemas, `GameType`-Plugin-Interface, Seeded-RNG, **Wertungs-Engine**, Spieltyp-Logik (`generate`/`compare`, FE-frei). Von Server **und** Web genutzt. |
| `server/` | Fastify + WebSocket (`@fastify/websocket`), Drizzle ORM + Postgres, argon2-Auth, Pino. **Aller State in der DB** → neustart-fest. |
| `web/`    | Vite + React + Tailwind, dnd-kit, react-router. Pro Spieltyp `LeitView`/`TruppView`. |

Datenfluss: Mutationen laufen über **REST** (idempotent, server-seitig Zod-validiert);
der WebSocket pusht nur die Folgen (`game_started`, `round_started`, `submission_scored`,
`leaderboard_update`). Bei (Re-)Connect zieht der Client einen **frischen REST-Snapshot**
— ein verlorener Socket oder Server-Neustart kostet keinen State.

```
Browser (Leit)  ─REST/WS─┐
Browser (Trupp) ─REST/WS─┤→  Fastify  ─Drizzle─  Postgres
Browser (Admin) ─REST/WS─┘     (shared: generate/compare/scoring)
```

---

## Datenmodell (Postgres)

- **games** — `code` (kurz, uniq), `admin_password_hash` (argon2id), `title`, `status`
  (`draft|running|finished`), `scoring_config` (jsonb), `anti_cheat_mode`
  (`unique_per_group` | `same_for_all`), `current_part_id`, `expires_at`.
- **game_parts** — `game_id`, `order_index`, `type`, `config` (jsonb, typ-spezifisch),
  `verification` (`auto|manual_photo`), `max_attempts`.
- **groups** (Funkgruppen) — `game_id`, `name`, `leit_token`, `trupp_token` (je 128-bit,
  base62, nicht erratbar).
- **rounds** — `game_part_id`, `group_id`, `payload` (jsonb = generierte Vorlage =
  Wahrheit), `seed`, `started_at` (gesetzt beim Aufdecken), `status`
  (`pending|transmitting|submitted|scored`).
- **submissions** — `round_id`, `answer` (jsonb = Nachbau), `submitted_at`, `attempt_no`,
  `accuracy`, `duration_ms`, `score`, `detail` (jsonb, z.B. Heatmap).
- **events** — Live-Feed/Audit je Spiel.

**Defaults & Garantien**
- **Anti-Cheat** `unique_per_group`: jede Gruppe bekommt eine eigene zufällige Vorlage
  *gleicher Schwierigkeit* (Seed = `partId:groupId`). Auf derselben Frequenz kann man
  sich so nicht abschauen. `same_for_all` (Seed = `partId:shared`) für fairen
  Direktvergleich.
- **Timer server-seitig**: läuft von `rounds.started_at` (Leit deckt auf) bis
  `submissions.submitted_at`. Versetzter Start bleibt fair, Client-Uhr irrelevant.
- **Submit final pro Runde**, `max_attempts` (Default 1).
- Der Empfangstrupp bekommt die **Vorlage nie** über die API — nur die Render-Metadaten
  (Rastergröße, Palette). Die Leitstation sieht die Vorlage erst **nach** dem Aufdecken.

---

## Lokales Dev-Setup

Voraussetzungen: Node ≥ 20, Docker.

```bash
cp .env.example .env

# Variante A — alles in Docker (App + Postgres, Migrations laufen automatisch):
docker compose up --build
#   → http://localhost:3000

# Variante B — Hot-Reload-Dev:
docker compose up -d postgres            # nur DB
npm install
npm run migrate -w @funkparcours/server  # einmalig (DATABASE_URL aus .env)
npm run dev:server                        # Fastify :3000
npm run dev:web                           # Vite :5173 (proxyt /api + /ws nach :3000)
#   → http://localhost:5173
```

Ablauf zum Ausprobieren:
1. `/` → **Neues Spiel** anlegen (Titel + Admin-Passwort) → Spiel-Code.
2. Konfiguration: Funkgruppen, Spielteil **Symbolkarte**, Wertungsmodus, Anti-Cheat,
   speichern → pro Gruppe zwei **Join-Links + QR-Codes**.
3. **Spiel starten** → Live-Dashboard.
4. Leit-Link auf Gerät A, Trupp-Link auf Gerät B öffnen.
5. Leit: **Übertragung starten** (Vorlage aufgedeckt, Timer läuft) → über Funk durchgeben.
6. Trupp: Symbole per Drag&Drop (oder Tap) aufs Raster, **Abgeben** → Genauigkeit + Zeit.
7. Dashboard aktualisiert Leaderboard live.

---

## Tests

```bash
npm test                # Vitest: Generator + Vergleicher (symbolkarte) + 4 Wertungsmodi
```

---

## Env-Variablen

Siehe `.env.example` (App/Auth/DB/Rate-Limit) und `.env.deploy.example` (Deploy-Targets).
Secrets liegen **nur** in `.env` auf dem Zielhost — nie im Repo.

---

## Wertungsmodi (`scoring_config`)

| `mode` | Verhalten | Parameter |
|--------|-----------|-----------|
| `time` | Schnellster gewinnt | – (Tie-break: Genauigkeit) |
| `accuracy_gate` | `min_accuracy`-Gate, dann nach Zeit; Rest dahinter | `min_accuracy` |
| `weighted` | `w_acc*acc + w_speed*speed`, `speed=clamp((t_max−d)/(t_max−t_min),0,1)` | `w_acc`, `w_speed`, `t_min`, `t_max` |
| `points_rank` | Rangpunkte je Runde (1.=N … N.=1), Summe; optionales Gate | `min_accuracy` |

Beispiel:
```json
{ "mode": "weighted", "w_acc": 0.6, "w_speed": 0.4, "t_min": 10000, "t_max": 120000 }
```
Gesamtwertung = Summe der Spielteil-Scores. Tie-breaks sind deterministisch
(Genauigkeit → Zeit → Gruppen-ID).

---

### v1-Spieltypen

| Typ | Aufgabe | Genauigkeit |
|-----|---------|-------------|
| `symbolkarte` | Beschriftetes Raster, Formen×Farben, optional Stapel (Z-Reihenfolge) | korrekte Felder / gesamt |
| `nato` | Rufzeichen/Wörter buchstabieren (Modus + Anzahl + Länge) | korrekte Zeichen / gesamt (+ perfekte Wörter) |
| `meldung` | Strukturierte Notfunk-Meldung, Felder konfigurierbar | korrekte Felder / gesamt (Text normalisiert, optional fuzzy) |
| `koordinaten` | Beschriftetes Raster, Marker setzen (Schiffe-versenken-Stil) | zellweise korrekt (Treffer + Falschmarker) |

## Spieltypen & Plugin-Architektur

Jeder Spieltyp implementiert das gemeinsame Interface in `shared/src/gametype.ts`:

```ts
interface GameType<Config, Payload, Answer> {
  id; label; configSchema; payloadSchema; answerSchema;
  verification: "auto" | "manual_photo";
  generate(config, rng): Payload;        // deterministisch (seeded)
  compare(payload, answer): { accuracy: number; detail: unknown };  // nur "auto"
}
```

### Einen neuen Spieltyp als Plugin hinzufügen

1. **Logik** (`shared/src/games/<typ>.ts`): `configSchema`, `payloadSchema`,
   `answerSchema`, `generate`, `compare`. In `shared/src/index.ts` per
   `registerGameType` in `registerBuiltinGameTypes()` registrieren.
2. **Tests** (`shared/src/<typ>.test.ts`): Generator deterministisch, `compare`
   liefert korrekte Genauigkeit.
3. **Frontend** (`web/src/gametypes/<typ>.tsx`): `LeitView` (read-only) und `TruppView`
   (interaktiv, ruft `onSubmit(answer)`), plus `ConfigForm`. In
   `web/src/gametypes/registry.tsx` eintragen.
4. Fertig — Server-Kern, Routen, Wertung und Realtime bleiben unverändert.

`manual_photo` (für künftiges `lego`/`schaltung`): Foto-Upload + Admin-Bewertung
0..1 statt `compare`. Interface vorbereitet, UI-Pfad folgt.

---

## Deployment

Wird in der Deploy-Phase ergänzt: containerisiert auf `<deploy-host>`, öffentlich über den
bestehenden Cloudflare-Tunnel unter `funkparcours.oeradio.at`
(`docker-compose.prod.yml` + `deploy.sh`). `docker-compose.prod.yml` bindet die App nur
auf `127.0.0.1:3000`; cloudflared terminiert TLS und routet das Public Hostname dorthin.
