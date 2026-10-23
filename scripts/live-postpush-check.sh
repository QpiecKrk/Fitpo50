#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://fitpo50.pl}"
RETRIES="${RETRIES:-1}"
DELAY_SECONDS="${DELAY:-3}"
TIMEOUT_SECONDS="${TIMEOUT:-10}"

node scripts/deployment-live-verify.js \
  --base-url "$BASE_URL" \
  --retries "$RETRIES" \
  --delay-ms "$((DELAY_SECONDS * 1000))" \
  --timeout-ms "$((TIMEOUT_SECONDS * 1000))"
node scripts/security-exposure-check.js "$BASE_URL"
