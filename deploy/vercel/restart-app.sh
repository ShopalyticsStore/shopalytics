#!/usr/bin/env bash
# Restarts the application alone, so a rebuilt candidate is served while Postgres
# and its dataset keep running, and exits once the new process answers health.
set -euo pipefail
SUPERVISOR_PID="$(cat /run/shopalytics-supervisor.pid)"
PREVIOUS_APP="$(cat /run/shopalytics-app.pid)"
kill -USR1 "$SUPERVISOR_PID"
for tenth in $(seq 1 600); do
  CURRENT_APP="$(cat /run/shopalytics-app.pid 2>/dev/null || true)"
  if [ -n "$CURRENT_APP" ] && [ "$CURRENT_APP" != "$PREVIOUS_APP" ] \
    && curl -fsS http://127.0.0.1:3300/api/health > /dev/null 2>&1; then
    echo "restarted in $((tenth / 10)).$((tenth % 10))s"
    exit 0
  fi
  sleep 0.1
done
echo "the application did not come back within 60s" >&2
exit 1
