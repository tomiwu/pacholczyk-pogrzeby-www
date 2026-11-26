#!/usr/bin/env bash
# Start the Sandcastle loop of pacholczyk-pogrzeby-www one time. Safe to call many times at the same moment.
# Fixed paths (the loop-health routine reads them):
#   pid    /tmp/pacholczyk-www-loop.pid
#   status /tmp/pacholczyk-www-loop.status.json (lastOutputAt)
#   log    /workspace/pacholczyk-www-loop.log (appended)
# Image: localhost/sandcastle:pacholczyk-pogrzeby-www
# This script does not build the image. If the image is missing, it exits.
set -euo pipefail
NAME=pacholczyk-www
IMAGE=localhost/sandcastle:pacholczyk-pogrzeby-www
DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEBHOOK_KEY_FILE="${WEBHOOK_KEY_FILE:-/workspace/pacholczyk-www-secrets/loop-webhook-key}"
exec 9>"/tmp/${NAME}-loop.lock"
flock -n 9 || { echo "locked: another start is in progress"; exit 0; }
PIDFILE="/tmp/${NAME}-loop.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "running: pid $(cat "$PIDFILE")"; exit 0
fi
if pgrep -f "${DIR}/.sandcastle/node_modules/.bin/tsx .sandcastle/main.mts" >/dev/null; then
  echo "running: a loop process exists without a pid file"; exit 0
fi
podman image exists "$IMAGE" || {
  echo "image missing: $IMAGE (do not build until disk space is checked)" >&2
  exit 1
}
cd "$DIR"
# The box GH_TOKEN is invalid for loop pushes. Drop it, then load the project file (PAT, Claude token).
unset GH_TOKEN
[ -f .sandcastle/.env ] || { echo ".sandcastle/.env is missing" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source .sandcastle/.env
set +a
[ -n "${GH_TOKEN:-}" ] || { echo "GH_TOKEN is missing in .sandcastle/.env" >&2; exit 1; }
# Webhook sender key lives outside .sandcastle/.env.
if [ -f "$WEBHOOK_KEY_FILE" ]; then
  LOOP_WEBHOOK_KEY="$(tr -d '\n' < "$WEBHOOK_KEY_FILE")"
  export LOOP_WEBHOOK_KEY
fi
export PROJECT="${PROJECT:-pacholczyk-pogrzeby-www}"
export STATUS_FILE="/tmp/${NAME}-loop.status.json"
export AUTO_MERGE=0
[ -x .sandcastle/node_modules/.bin/tsx ] || (cd .sandcastle && npm install --no-audit --no-fund)
LOG="/workspace/${NAME}-loop.log"
echo "=== start $(date -Is) ===" >>"$LOG"
setsid nohup bash -c "cd '$DIR' && exec '$DIR/.sandcastle/node_modules/.bin/tsx' .sandcastle/main.mts" >>"$LOG" 2>&1 9>&- &
echo $! >"$PIDFILE"
sleep 5
echo "started: pid $(cat "$PIDFILE") log $LOG"
