#!/usr/bin/env bash
# Builds the application from the files written into it, in the environment the
# image built it in, reusing the build cache the image's own build left in
# .next/cache. A candidate runtime runs it after the control plane writes a
# candidate's files, then restarts the application with shopalytics-restart-app.
set -euo pipefail
cd /srv/shopalytics
set -a
# shellcheck disable=SC1091
. ./.build-environment
set +a
exec npm run build
