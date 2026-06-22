#!/usr/bin/env bash
# Idempotent deploy of FunkParcours to a remote host running Docker.
# Config via .env.deploy (see .env.deploy.example). Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

# --- load config ---
if [[ ! -f .env.deploy ]]; then
  echo "✗ .env.deploy fehlt. Kopiere .env.deploy.example -> .env.deploy und anpassen." >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env.deploy; set +a

: "${HOST:?HOST nicht gesetzt}"
: "${USER:?USER nicht gesetzt}"
: "${REMOTE_DIR:?REMOTE_DIR nicht gesetzt}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/healthz}"
SSH="ssh ${USER}@${HOST}"
REMOTE="${USER}@${HOST}"

log() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- preconditions ---
log "Vorbedingungen prüfen"
if [[ -n "$(git status --porcelain)" ]]; then
  die "Arbeitsverzeichnis nicht sauber. Erst committen/stashen."
fi
CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$CUR_BRANCH" == "$BRANCH" ]] || die "Auf Branch '$CUR_BRANCH', erwartet '$BRANCH'."
$SSH "echo ok" >/dev/null 2>&1 || die "SSH zu $REMOTE nicht erreichbar."
ok "Sauberer Stand, Branch $BRANCH, SSH ok"

# --- ship code ---
log "Code auf den Host bringen"
$SSH "mkdir -p '$REMOTE_DIR'"
if $SSH "test -d '$REMOTE_DIR/.git'"; then
  # preferred: remote is a git clone -> fetch + hard-reset to our HEAD's branch
  log "git-Modus (remote ist ein Klon)"
  $SSH "cd '$REMOTE_DIR' && git fetch --all --prune && git checkout '$BRANCH' && git reset --hard 'origin/$BRANCH'"
else
  # fallback: rsync (excludes node_modules, build output, secrets)
  log "rsync-Modus (kein git auf dem Host)"
  rsync -az --delete \
    --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
    --exclude '.env' --exclude '.env.deploy' \
    ./ "$REMOTE:$REMOTE_DIR/"
fi
ok "Code aktualisiert"

# --- .env must exist remotely and is NEVER overwritten ---
$SSH "test -f '$REMOTE_DIR/.env'" || die ".env fehlt auf dem Host ($REMOTE_DIR/.env). Einmalig anlegen (Secrets!)."
ok ".env auf dem Host vorhanden (bleibt unangetastet)"

DC="docker compose --env-file .env -f $COMPOSE_FILE"

# --- build + migrate + up ---
APP_VERSION="$(git rev-parse --short HEAD)"
log "Image bauen (Version $APP_VERSION)"
$SSH "cd '$REMOTE_DIR' && APP_VERSION=$APP_VERSION $DC build"

log "Migrations laufen lassen (one-shot)"
$SSH "cd '$REMOTE_DIR' && $DC run --rm app node server/dist/db/migrate.js"

log "Container starten"
$SSH "cd '$REMOTE_DIR' && $DC up -d"

# --- health check against the internal port ---
log "Health-Check ($HEALTH_URL)"
HEALTHY=""
for i in $(seq 1 20); do
  if $SSH "curl -fsS '$HEALTH_URL' >/dev/null 2>&1"; then HEALTHY=1; break; fi
  sleep 2
done
[[ -n "$HEALTHY" ]] || { $SSH "cd '$REMOTE_DIR' && $DC logs --tail=50 app" || true; die "Health-Check fehlgeschlagen."; }
ok "App ist gesund"

# --- cleanup ---
log "Alte Images aufräumen"
$SSH "docker image prune -f" >/dev/null
ok "Deploy abgeschlossen → https://funkparcours.oeradio.at"
echo
echo "Rollback: auf dem Host 'git reset --hard <vorheriger-commit>' (git-Modus) bzw."
echo "          früheres Image taggen/zurücksetzen, dann erneut: ./deploy.sh"
