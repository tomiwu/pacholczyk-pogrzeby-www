#!/usr/bin/env bash
# Quick checks for the Stop hook. Keep this short. The full gate is .sandcastle/checks.json.
set -euo pipefail
npm run --silent format:check
npm run --silent typecheck
npm run --silent lint
