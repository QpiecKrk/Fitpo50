#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://fitpo50.pl}"
exec node scripts/deployment-live-verify.js --base-url "$BASE_URL"
