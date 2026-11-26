#!/usr/bin/env bash
# Claude Code Stop hook for the Sandcastle loop (tomiwu 2026-11-13).
# Exit 2 + stderr: Claude continues in the same session and fixes the problem (exit 1 ends the task).
# Active only when LOOP_STOP_GATE=1. One forced retry: when stop_hook_active is true, allow the stop
# (the host checks and the fixer phase catch what is left).
# Env from the loop: LOOP_PHASE (implementer, reviewer, fixer-N, early-fixer-N), LOOP_BASE_SHA.
set -uo pipefail
[ "${LOOP_STOP_GATE:-0}" = "1" ] || exit 0
input=$(cat)
# No jq or python needed: the hook input is one JSON object.
if printf '%s' "$input" | grep -Eq '"stop_hook_active" *: *true'; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
phase="${LOOP_PHASE:-}"
base="${LOOP_BASE_SHA:-}"
block() { printf 'Stop gate (%s): %s\n' "$phase" "$1" >&2; exit 2; }

# Collect every problem, so that the one forced retry can fix all of them.
problems=""
add() { problems="${problems}- $1"$'\n'; }
dirty=$(git status --porcelain --untracked-files=normal -- . ':(exclude).sandcastle/context' 2>/dev/null)
[ -z "$dirty" ] || add "The work tree has changes that are not committed: $(printf '%s' "$dirty" | head -10 | tr '\n' ' '). Commit them (or remove them)."
if [ "$phase" = "implementer" ] && [ -n "$base" ]; then
  n=$(git rev-list --count "$base..HEAD" 2>/dev/null || echo 0)
  verified=$(git log --format=%B "$base..HEAD" 2>/dev/null | grep -c '^## Verification' || true)
  [ "$n" -gt 0 ] || [ -n "$dirty" ] || add "There is no commit for this issue. Finish the work and commit (message starts with RALPH: #<issue>)."
  [ "${verified:-0}" -gt 0 ] || add "The commit message needs a '## Verification' section: the command you ran and a fenced block with the pasted tail of its real output (before/after numbers for a performance issue)."
fi
[ -z "$problems" ] || block "fix these items, then stop:
$problems"

# Fast project checks on this branch (the full gate runs on the host later).
# PROJECT: put the quick format/lint/test commands for the changed code in .claude/hooks/fast-checks.sh.
fast="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/fast-checks.sh"
[ -x "$fast" ] || exit 0
out=$(LOOP_RANGE="${base:-HEAD~1}" "$fast" 2>&1) || block "the fast checks fail (.claude/hooks/fast-checks.sh). Fix the cause (do not weaken a test) and commit.
$(printf '%s\n' "$out" | tail -n 60)"
exit 0
