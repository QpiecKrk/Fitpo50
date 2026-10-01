#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"
GSC_ENV_FILE="$HOME/.fitpo50-gsc.env"

if [[ ! -f "$ENV_FILE" && ! -f "$GSC_ENV_FILE" ]]; then
  echo "[FAIL] Brak .env.local i ~/.fitpo50-gsc.env. Skonfiguruj co najmniej jeden lokalny plik sekretów." >&2
  exit 1
fi

set -a
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
if [[ -f "$GSC_ENV_FILE" ]]; then
  # GSC ma jeden kanoniczny lokalny plik; ładowany jako ostatni.
  # shellcheck disable=SC1090
  source "$GSC_ENV_FILE"
fi
set +a

exec "$@"
