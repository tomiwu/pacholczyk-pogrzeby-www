#!/usr/bin/env bash
# Start the Sandcastle loop of pacholczyk-pogrzeby-www one time. Safe to call many times at the same moment.
# Fixed paths (the loop-health routine reads them):
#   pid    /tmp/pacholczyk-www-loop.pid
#   status /tmp/pacholczyk-www-loop.status.json (lastOutputAt)
#   log    /workspace/pacholczyk-www-loop.log (appended)
# Image: localhost/sandcastle:pacholczyk-pogrzeby-www
# This script does not build the image. If the image is missing, it exits.
#
# Secrets:
#   GH_TOKEN              from /workspace/pacholczyk-www-secrets/gh-pat
#   LOOP_WEBHOOK_URL/KEY  from the same secrets dir, exported to the
#                         orchestrator process only. They must not appear in
#                         .sandcastle/.env (that file is injected into containers).
set -euo pipefail
NAME=pacholczyk-www
IMAGE=localhost/sandcastle:pacholczyk-pogrzeby-www
DIR="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="${SECRETS:-/workspace/pacholczyk-www-secrets}"
PAT_FILE="${PAT_FILE:-$SECRETS/gh-pat}"
WEBHOOK_URL_FILE="${WEBHOOK_URL_FILE:-$SECRETS/loop-webhook-url}"
WEBHOOK_KEY_FILE="${WEBHOOK_KEY_FILE:-$SECRETS/loop-webhook-key}"
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
# The box GH_TOKEN is invalid for loop pushes. Drop it, then load model/Claude settings.
unset GH_TOKEN
[ -f .sandcastle/.env ] || { echo ".sandcastle/.env is missing" >&2; exit 1; }
if grep -qE '^[[:space:]]*LOOP_WEBHOOK_(URL|KEY)=' .sandcastle/.env; then
  echo "LOOP_WEBHOOK_* must not be in .sandcastle/.env (it would enter containers)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .sandcastle/.env
set +a
# Orchestrator and containers: PAT from the secrets file (source of truth).
[ -f "$PAT_FILE" ] || { echo "PAT file is missing" >&2; exit 1; }
GH_TOKEN="$(tr -d '\n\r' < "$PAT_FILE")"
[ -n "$GH_TOKEN" ] || { echo "GH_TOKEN is empty in the PAT file" >&2; exit 1; }
export GH_TOKEN
# Keep .sandcastle/.env in sync so containers receive the same PAT (keys already
# in that file are the only ones injected into the sandbox). Never print it.
python3 - "$PAT_FILE" .sandcastle/.env << 'PY'
import pathlib, sys, tempfile, os
pat = pathlib.Path(sys.argv[1]).read_text().replace("\r", "").rstrip("\n")
path = pathlib.Path(sys.argv[2])
lines = path.read_text().splitlines(keepends=True)
out, seen = [], False
for line in lines:
    if line.startswith("GH_TOKEN="):
        out.append("GH_TOKEN=" + pat + "\n")
        seen = True
    else:
        out.append(line)
if not seen:
    if out and not out[-1].endswith("\n"):
        out[-1] += "\n"
    out.append("GH_TOKEN=" + pat + "\n")
fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".env.")
try:
    os.write(fd, "".join(out).encode())
    os.close(fd)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
except Exception:
    try:
        os.close(fd)
    except OSError:
        pass
    try:
        os.unlink(tmp)
    except OSError:
        pass
    raise
PY
# Webhook values: orchestrator process only. Not written to .sandcastle/.env.
[ -f "$WEBHOOK_URL_FILE" ] || { echo "webhook URL file is missing" >&2; exit 1; }
[ -f "$WEBHOOK_KEY_FILE" ] || { echo "webhook key file is missing" >&2; exit 1; }
LOOP_WEBHOOK_URL="$(tr -d '\n\r' < "$WEBHOOK_URL_FILE")"
LOOP_WEBHOOK_KEY="$(tr -d '\n\r' < "$WEBHOOK_KEY_FILE")"
[ -n "$LOOP_WEBHOOK_URL" ] || { echo "LOOP_WEBHOOK_URL is empty" >&2; exit 1; }
[ -n "$LOOP_WEBHOOK_KEY" ] || { echo "LOOP_WEBHOOK_KEY is empty" >&2; exit 1; }
export LOOP_WEBHOOK_URL LOOP_WEBHOOK_KEY
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
