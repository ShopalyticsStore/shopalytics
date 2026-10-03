#!/usr/bin/env bash
# Starts the Shopalytics preview runtime: Postgres 17, then the built
# application, in one Vercel Sandbox. The control plane runs it as a detached
# root command, because Vercel Sandbox does not run the image's entrypoint.
#
# Required environment:
#   SHOPALYTICS_SEED_TARGET          base | candidate
#   UTRACE_PROFILE                   production | preview
# Required when UTRACE_PROFILE=preview:
#   UTRACE_PREVIEW_HANDOFF_SECRET    signs the one-time handoff and the session
#   UTRACE_PREVIEW_ROUTE_SIGNING_SECRET  verifies x-utrace-route-context
# Required once UTRACE_SERVER_BOOTSTRAP_CREDENTIAL is present:
#   UTRACE_SERVER_CONTROL_URL            wss:// origin of the control plane
#   UTRACE_SERVER_INGEST_URL             https:// origin of telemetry ingestion
#   UTRACE_SERVER_SERVICE_NAME           the manifest service_key this process claims
#   UTRACE_SERVER_MANIFEST_TRUST_ANCHOR  base64url JSON trust anchor for the manifest
#
# The Server SDK's activation binds one Interview Session and one preview
# origin, and neither exists while a runtime waits unclaimed in a warm pool. The
# prepared-preview environment therefore writes .utrace-activation into the
# application directory when it claims the runtime and restarts it, and this
# script sources that file before it checks anything. Without the file there is
# no bootstrap credential, so the packaged SDK stays dormant by its own
# contract; the control plane's readiness probes are what refuse to route a
# runtime whose Server SDK never activated.
#
# `base` uses the dataset baked into the image. `candidate` reinstalls the same
# manifest identity so the runtime records that it is a candidate. Either way
# the seed verifies the manifest and fails loudly if it does not reproduce.

set -euo pipefail

APP_DIR=/srv/shopalytics
# The manifest pins the application port; the npm start scripts bind it.
APP_PORT=3300
PGDATA="${PGDATA:-/srv/pgdata}"
DB_NAME="${POSTGRES_DB:-shopalytics}"
DB_USER="${POSTGRES_USER:-shopalytics}"

log() { printf '[supervisor] %s\n' "$*"; }
fail() { printf '[supervisor] ERROR: %s\n' "$*" >&2; exit 1; }

# Keep a copy of the supervisor's own output inside the sandbox, appended and
# marked per start, because the interesting case is a second start failing
# where the first succeeded.
SUPERVISOR_LOG="${SUPERVISOR_LOG:-/tmp/utrace-supervisor.log}"
exec > >(tee -a "$SUPERVISOR_LOG") 2>&1
log "--- start $(date -u +%Y-%m-%dT%H:%M:%SZ) pid $$ target ${SHOPALYTICS_SEED_TARGET:-unset} ---"

: "${SHOPALYTICS_SEED_TARGET:?SHOPALYTICS_SEED_TARGET must be base or candidate}"
: "${UTRACE_PROFILE:?UTRACE_PROFILE must be production or preview}"

case "$SHOPALYTICS_SEED_TARGET" in
  base|candidate) ;;
  *) fail "SHOPALYTICS_SEED_TARGET must be base or candidate, received '$SHOPALYTICS_SEED_TARGET'" ;;
esac

ACTIVATION_FILE="$APP_DIR/.utrace-activation"
if [ -f "$ACTIVATION_FILE" ]; then
  log "reading the prepared-preview activation"
  set -a
  # shellcheck disable=SC1090
  . "$ACTIVATION_FILE"
  set +a
fi

if [ "$UTRACE_PROFILE" = "preview" ]; then
  : "${UTRACE_PREVIEW_HANDOFF_SECRET:?UTRACE_PREVIEW_HANDOFF_SECRET is required in the preview profile}"
  : "${UTRACE_PREVIEW_ROUTE_SIGNING_SECRET:?UTRACE_PREVIEW_ROUTE_SIGNING_SECRET is required in the preview profile}"
  if [ -n "${UTRACE_SERVER_BOOTSTRAP_CREDENTIAL:-}" ]; then
    : "${UTRACE_SERVER_CONTROL_URL:?UTRACE_SERVER_CONTROL_URL is required alongside the bootstrap credential}"
    : "${UTRACE_SERVER_INGEST_URL:?UTRACE_SERVER_INGEST_URL is required alongside the bootstrap credential}"
    : "${UTRACE_SERVER_SERVICE_NAME:?UTRACE_SERVER_SERVICE_NAME is required alongside the bootstrap credential}"
    : "${UTRACE_SERVER_MANIFEST_TRUST_ANCHOR:?UTRACE_SERVER_MANIFEST_TRUST_ANCHOR is required alongside the bootstrap credential}"
    log "the Server SDK will activate as $UTRACE_SERVER_SERVICE_NAME"
  else
    log "no bootstrap credential: the Server SDK stays dormant"
  fi
fi

cd "$APP_DIR"

# shellcheck disable=SC1091
[ -f "$APP_DIR/.build-identity" ] && . "$APP_DIR/.build-identity"
export SHOPALYTICS_FIXTURE_MANIFEST_HASH

export DATABASE_URL="postgres://$DB_USER@127.0.0.1:5432/$DB_NAME"
export DATABASE_SSL=false

# A sandbox restored from a snapshot keeps its filesystem and loses its process
# table, so the postmaster.pid of the run before the snapshot survives with no
# postmaster behind it. Postgres refuses to start while that file names a live PID, and a
# restarted sandbox numbers its processes from 1 again, so the recorded PID is
# routinely reused by an unrelated process and the file is never cleared. The
# recorded PID is therefore checked against what that process actually is.
clear_stale_postmaster_lock() {
  local lock="$PGDATA/postmaster.pid" recorded
  [ -f "$lock" ] || return 0
  recorded="$(head -n 1 "$lock")"
  if [ "$(cat "/proc/$recorded/comm" 2>/dev/null || true)" = "postgres" ]; then
    fail "postgres is already running in $PGDATA as pid $recorded"
  fi
  log "clearing the postmaster.pid left by a previous run (pid $recorded)"
  rm -f "$lock"
}

log "starting postgres"
mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql "$PGDATA"
clear_stale_postmaster_lock
su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -p 5432' -w start"

shutdown() {
  log "stopping"
  [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null || true
  su postgres -c "pg_ctl -D $PGDATA -m fast -w stop" 2>/dev/null || true
}
trap shutdown EXIT INT TERM

if [ "$SHOPALYTICS_SEED_TARGET" = "candidate" ]; then
  log "installing the candidate dataset"
  SHOPALYTICS_CANDIDATE_DATABASE_URL="$DATABASE_URL" npm run db:seed:candidate
else
  log "using the base dataset baked into the image"
fi

if [ "$UTRACE_PROFILE" = "preview" ]; then
  log "starting the application on port $APP_PORT in the preview profile"
  npm run start:preview &
else
  log "starting the application on port $APP_PORT in the production profile"
  npm run start &
fi
APP_PID=$!

for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$APP_PORT/api/health" > /dev/null; then
    log "healthy after ${attempt}s"
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    fail "the application exited before becoming healthy"
  fi
  sleep 1
  [ "$attempt" -eq 60 ] && fail "the application did not become healthy within 60s"
done

wait "$APP_PID"
