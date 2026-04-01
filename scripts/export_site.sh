#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/_site}"

run_ts_build() {
  if [[ "${SKIP_TS_BUILD:-0}" == "1" ]]; then
    echo "SKIP_TS_BUILD=1 -> pomijam build TypeScript."
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm nie jest dostępny. Zainstaluj Node.js + npm." >&2
    exit 1
  fi

  if [[ ! -x "$ROOT_DIR/node_modules/.bin/tsc" ]]; then
    echo "Brak lokalnego TypeScript. Instaluję zależności npm..."
    (
      cd "$ROOT_DIR"
      npm install --no-audit --no-fund
    )
  fi

  echo "Buduję TypeScript (src -> dist)..."
  (
    cd "$ROOT_DIR"
    npm run build
  )
}

run_ts_build

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

rsync -a \
  --delete \
  --exclude=".git/" \
  --exclude=".gitignore" \
  --exclude=".agent/" \
  --exclude=".agent-mem/" \
  --exclude=".agents/" \
  --exclude=".brainsync/" \
  --exclude=".cursor/" \
  --exclude=".vscode/" \
  --exclude=".clinerules" \
  --exclude=".cursorrules" \
  --exclude=".windsurfrules" \
  --exclude=".DS_Store" \
  --exclude="AGENT.md" \
  --exclude="CLAUDE.md" \
  --exclude="DEPLOY.md" \
  --exclude="PROJECT_MEMORY.md" \
  --exclude="MEMORY_PORADY.md" \
  --exclude="MEMORY_MOJE_SUKCESY.md" \
  --exclude="package.json" \
  --exclude="tsconfig.json" \
  --exclude="src/" \
  --exclude="scripts/" \
  --exclude="check.js" \
  --exclude="clean.js" \
  --exclude="copy_pngs.sh" \
  --exclude="_site/" \
  "$ROOT_DIR/" "$OUTPUT_DIR/"

echo "Exported clean site to: $OUTPUT_DIR"
