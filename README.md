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

## Qualität: Tests, Lint & CI

Jeder Push auf `main` und jeder Pull Request durchläuft ein automatisches Tor
(`.github/workflows/ci.yml`): **lint → test → build** über alle Workspaces, mit einem
Postgres-Service-Container. `main` ist branch-protected — der `build`-Check **muss** grün
sein, sonst ist kein Merge möglich.

### Befehle

```bash
npm run lint      # eslint . (typbewusst, u.a. no-floating-promises) + tsc -b + web-Typecheck
npm test          # Vitest über alle Workspaces (shared + server)
npm run build     # shared → server → web
npm run test:e2e  # Playwright (erfordert laufenden Stack, s.u.)
```

### Test-Ebenen

1. **`shared` — rein & deterministisch.** Pro-Typ-Tests plus ein **registry-getriebener
   Vertragstest** (`shared/src/games-contract.test.ts`), der über `listGameTypes()`
   iteriert. Jeder registrierte `GameType` erbt die Gesetze automatisch: deterministisches
   `generate`, perfekte Antwort → `accuracy 1.0`, Müll-Antwort → `< 1.0`, `accuracy` immer
   in `[0,1]` (nie `NaN`), `configSchema.parse({})` valide, und Reinheit (kein `web/`-,
   DOM- oder I/O-Import). Ein neuer Typ kann den Vertrag nicht überspringen — `samplePerfectAnswer`
   ist im Interface **Pflicht**, der Code kompiliert sonst nicht.

2. **`server` — Integration (`fastify.inject()` + Postgres).** Sicherheits- und
   Fairness-**Invarianten**, die die Eigenschaft prüfen, nie nur Status 200: der Trupp
   bekommt `payload` in **keinem** Zustand (pending/transmitting/scored, Reconnect-Snapshot,
   WS-Socket); die Leitstation erst **nach** `started_at`; `duration_ms` ist
   server-autoritativ (gefälschte Client-Zeit wirkt nicht); `unique_per_group` vs
   `same_for_all` erzeugen unterschiedliche bzw. identische Seeds/Payloads; Rate-Limits auf
   Login/Submit greifen. Die Suite migriert die DB selbst und braucht nur eine Postgres-URL:

   ```bash
   docker run -d --name fp-test-pg \
     -e POSTGRES_USER=funk -e POSTGRES_PASSWORD=funk -e POSTGRES_DB=funkparcours_test \
     -p 5433:5432 postgres:16-alpine
   DATABASE_URL=postgres://funk:funk@localhost:5433/funkparcours_test npm test -w server
   ```

3. **e2e — Playwright (gated, nicht pro PR).** `e2e/tests/happy-path.spec.ts` fährt den
   Symbolkarte-Happy-Path durch die echte UI (Spiel anlegen → konfigurieren → starten →
   Leit deckt auf → Trupp gibt ab → Leaderboard zeigt Score) und spiegelt die
   Server-Invariante: keine Antwort an den Trupp enthält die Vorlage (Netzwerk-Check auf
   `payload`/`cells`). Gegen einen laufenden Stack:

   ```bash
   docker compose up -d --build                       # App + Postgres auf :3000
   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
   ```

   In CI läuft das **nicht** bei jedem PR, sondern via `.github/workflows/e2e.yml`
   **nightly + manuell + bei Release** — bewusst gated, weil teuer/langsamer; bei Rot wird
   ein Playwright-Trace als Artefakt hochgeladen (`npx playwright show-trace <trace.zip>`).
   Manuell starten: **Actions → e2e → Run workflow**, oder
   `gh workflow run e2e.yml --ref main`.

### Kontext für Agenten/Mitwirkende

`AGENTS.md` hält die Invarianten, Befehle, das Plugin-Rezept und den Wertungsvertrag an
einer Stelle fest — vor Änderungen lesen. Eine Änderung unter `server/` an einem
Station-/Runden-/Wertungspfad braucht einen Invarianten-Test (Ebene 2 oben), der die
*Eigenschaft* prüft.

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
  samplePerfectAnswer(payload): Answer;  // Pflicht: speist den Vertragstest
}
```

### Einen neuen Spieltyp als Plugin hinzufügen

1. **Logik** (`shared/src/games/<typ>.ts`): `configSchema`, `payloadSchema`,
   `answerSchema`, `generate`, `compare` und `samplePerfectAnswer`. In
   `shared/src/index.ts` per `registerGameType` in `registerBuiltinGameTypes()`
   registrieren.
2. **Vertrag automatisch** — der registry-getriebene Vertragstest deckt den neuen Typ
   sofort ab (Determinismus, perfekt→1.0, Müll→<1.0, Clamp, Reinheit). Eigene
   Detail-Tests in `shared/src/<typ>.test.ts` ergänzen nach Bedarf.
3. **Frontend** (`web/src/gametypes/<typ>.tsx`): `LeitView` (read-only) und `TruppView`
   (interaktiv, ruft `onSubmit(answer)`), plus `ConfigForm`. In
   `web/src/gametypes/registry.tsx` eintragen.
4. Fertig — Server-Kern, Routen, Wertung und Realtime bleiben unverändert.

`manual_photo` (für künftiges `lego`/`schaltung`): Foto-Upload + Admin-Bewertung
0..1 statt `compare`. Interface vorbereitet, UI-Pfad folgt.

---

## Deployment

Containerisiert auf **`host-node-02`**, öffentlich über den **bestehenden Cloudflare-Tunnel
von oeradio.at** unter **`https://funkparcours.oeradio.at`**. Kein offener Port nach außen,
TLS terminiert Cloudflare. Stack: `docker-compose.prod.yml` (app + postgres), Auslieferung
per `deploy.sh`.

### Einmalige Vorbereitung auf dem Host

```bash
ssh achildrenmile@host-node-02
mkdir -p /home/achildrenmile/funkparcours && cd $_
# .env mit Prod-Secrets anlegen (bleibt NUR hier, nie im Repo):
cat > .env <<'EOF'
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://funkparcours.oeradio.at
JWT_SECRET=<openssl rand -hex 32>
COOKIE_SECURE=true
POSTGRES_USER=funk
POSTGRES_PASSWORD=<starkes-passwort>
POSTGRES_DB=funkparcours
EOF
```
`deploy.sh` überschreibt diese `.env` **niemals**.

### Deploy

Lokal `.env.deploy` aus `.env.deploy.example` anlegen, dann:

```bash
./deploy.sh
```
Ablauf (idempotent, gefahrlose Re-Runs): Vorbedingungen (sauberer Git-Stand, Branch, SSH)
→ Code auf den Host (git pull falls Remote-Klon, sonst rsync) → `docker compose build`
→ Migrations als One-shot → `up -d` → Health-Check gegen den internen Port (Abbruch mit
Exit≠0 bei Fehler) → `docker image prune`. Build standardmäßig **auf dem Host** (kein
Registry-Zwang; ghcr optional).

### Cloudflared — Ist-Zustand auf host-node-02 (verifiziert 2026-06-21)

cloudflared läuft hier **als Container pro App** (kein Host-Dienst, kein remote-managed
Tunnel): `oeradioat-cloudflared`, `status-cloudflared`, `wavelog-cloudflared`. Jede App hat
ihren **eigenen, lokal gemanagten Tunnel** mit `cloudflared/config.yml` + Credentials-JSON
(im jeweiligen App-Ordner, ins App-Docker-Netz gehängt, App per Service-Name erreicht).

`docker-compose.prod.yml` von FunkParcours folgt exakt diesem Muster: `funkparcours-app` +
`funkparcours-db` + `funkparcours-cloudflared` auf `funkparcours-net`; cloudflared erreicht
die App als `http://funkparcours-app:3000`. Der cloudflared-Dienst liegt hinter dem
Compose-Profil **`tunnel`**, damit App+DB schon ohne Tunnel-Creds deployen.

**Status: live** unter `https://funkparcours.oeradio.at` (REST + WebSocket end-to-end
verifiziert). Umgesetzt wurde Variante „bestehenden Tunnel mitnutzen": Statt eines eigenen
Tunnels hängt `funkparcours-app` zusätzlich am Docker-Netz `oeradioat_oeradioat-network`
(in `docker-compose.prod.yml` als external network deklariert), und der laufende
`oeradioat-cloudflared` bekam eine Ingress-Regel `funkparcours.oeradio.at →
http://funkparcours-app:3000` (vor der catch-all-Regel). DNS: proxied CNAME
`funkparcours` → `<oeradioat-tunnel-UUID>.cfargotunnel.com`.

> **Wichtig:** cloudflared auf host-node-02 lädt Config **nicht** per `SIGHUP` sauber neu
> (Tunnel ging dabei auf 502) — Config-Änderungen mit **`docker restart oeradioat-cloudflared`**
> übernehmen, nicht mit HUP.

Der ursprünglich vorgesehene dedizierte Tunnel (eigener `funkparcours-cloudflared`, Profil
`tunnel`) bleibt als Alternative im Compose; dafür wäre der folgende einmalige Schritt nötig
(braucht Cloudflare-Login/Token — auf dem Host liegt kein `cert.pem`):

```bash
# 1) einmalig: Tunnel-Verwaltung autorisieren (öffnet eine URL im Browser -> cert.pem)
docker run -it --rm -v ~/.cloudflared:/home/nonroot/.cloudflared \
  cloudflare/cloudflared:latest tunnel login

# 2) dedizierten Tunnel anlegen (schreibt <UUID>.json)
docker run -it --rm -v ~/.cloudflared:/home/nonroot/.cloudflared \
  cloudflare/cloudflared:latest tunnel create funkparcours

# 3) DNS-Route setzen
docker run -it --rm -v ~/.cloudflared:/home/nonroot/.cloudflared \
  cloudflare/cloudflared:latest tunnel route dns funkparcours funkparcours.oeradio.at

# 4) Creds + config in den App-Ordner, dann cloudflared-Container starten
cp ~/.cloudflared/<UUID>.json /home/achildrenmile/funkparcours/cloudflared/
cp cloudflared/config.yml.example /home/achildrenmile/funkparcours/cloudflared/config.yml
#   in config.yml <TUNNEL_UUID> ersetzen
cd /home/achildrenmile/funkparcours && \
  docker compose --env-file .env -f docker-compose.prod.yml --profile tunnel up -d cloudflared
```

Danach ist `https://funkparcours.oeradio.at` live. **Alternative:** ein Cloudflare-API-Token
mit *Tunnel*- + *DNS-Edit*-Rechten bereitstellen — dann lässt sich Schritt 1–3 ohne Browser
automatisieren.

### Cloudflared-Ingress — generische Varianten (Referenz)

`docker-compose.prod.yml` bindet die App auf **`127.0.0.1:3000`**. Wie cloudflared an die App
kommt, hängt von der Betriebsart auf dem Host ab — **auf dem Host prüfen** und die passende
Variante wählen:

```bash
# läuft cloudflared als Host-Dienst oder als Container?
systemctl status cloudflared 2>/dev/null
docker ps --filter name=cloudflared
# lokal gemanagter Tunnel hat eine config.yml:
sudo find /etc/cloudflared ~/.cloudflared -name 'config.yml' 2>/dev/null
```

**A — Lokal gemanagter Tunnel als Host-Dienst (`config.yml`):** App auf `127.0.0.1:3000`
lassen, Ingress-Regel **vor** der catch-all-Regel ergänzen:

```yaml
# /etc/cloudflared/config.yml
ingress:
  - hostname: funkparcours.oeradio.at
    service: http://127.0.0.1:3000
  # ... weitere bestehende Regeln ...
  - service: http_status:404        # catch-all bleibt letzte Regel
```
DNS-Route + Reload:
```bash
cloudflared tunnel route dns <tunnel-name> funkparcours.oeradio.at
sudo systemctl reload cloudflared      # oder: cloudflared tunnel ingress validate
```

**B — cloudflared als Container:** App nicht auf Loopback binden, sondern beide an dasselbe
Docker-Netz hängen und per Service-Name zeigen. In `docker-compose.prod.yml` die
`ports: 127.0.0.1:3000:3000`-Zeile beim `app`-Service entfernen, dem Netz des
cloudflared-Containers beitreten, und in der Tunnel-Config:
```yaml
  - hostname: funkparcours.oeradio.at
    service: http://funkparcours-app:3000
```

**C — Remote gemanagter Tunnel (Dashboard/API):** Ingress liegt nicht lokal. Im Cloudflare
Zero-Trust-Dashboard → Networks → Tunnels → (Tunnel) → **Public Hostname hinzufügen**:
`funkparcours.oeradio.at` → Service `HTTP` → `127.0.0.1:3000` (Host-Dienst) bzw.
`funkparcours-app:3000` (Container). DNS legt Cloudflare automatisch an.

> Welche Variante auf host-node-02 aktiv ist, **vor dem ersten Deploy verifizieren** und das
> genutzte Snippet hier festhalten.

### Backup / Restore

```bash
# Backup
ssh achildrenmile@host-node-02 \
  "cd /home/achildrenmile/funkparcours && docker compose -f docker-compose.prod.yml exec -T postgres \
   pg_dump -U funk funkparcours" > backup-$(date +%F).sql
# Restore
cat backup-YYYY-MM-DD.sql | ssh achildrenmile@host-node-02 \
  "cd /home/achildrenmile/funkparcours && docker compose -f docker-compose.prod.yml exec -T postgres \
   psql -U funk -d funkparcours"
```

### Rollback

```bash
# git-Modus: auf dem Host auf vorherigen Stand zurück, dann neu deployen
ssh achildrenmile@host-node-02 "cd /home/achildrenmile/funkparcours && git reset --hard <commit>"
./deploy.sh
# Das Postgres-Volume (pgdata) bleibt erhalten; Migrations sind additiv.
```

### Troubleshooting

- **502 von Cloudflare:** App-Container unten oder falsche Service-URL im Ingress.
  `docker compose -f docker-compose.prod.yml logs app`, Ziel-Port prüfen.
- **Health-Check schlägt fehl:** meist DB nicht erreichbar — `DATABASE_URL`/Postgres-Health
  prüfen. Migrations-Log im `app`-Start ansehen.
- **Cookies/Login gehen nicht:** `COOKIE_SECURE=true` braucht HTTPS (über Cloudflare ok),
  `PUBLIC_BASE_URL` muss der öffentlichen URL entsprechen.
