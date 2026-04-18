#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/_site}"

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" && -x "/opt/homebrew/bin/node" ]]; then
  NODE_BIN="/opt/homebrew/bin/node"
fi
if [[ -z "$NODE_BIN" ]]; then
  echo "ERROR: node nie jest dostępny w PATH ani w /opt/homebrew/bin/node." >&2
  exit 1
fi

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

echo "Uruchamiam walidację SEO hardening (Sprint 1)..."
(
  cd "$ROOT_DIR"
  "$NODE_BIN" scripts/check_sprint1_hardening.mjs
)

echo "Uruchamiam walidację AEO/GEO hardening (Sprint 2)..."
(
  cd "$ROOT_DIR"
  "$NODE_BIN" scripts/check_sprint2_aeo_geo.mjs
)

echo "Uruchamiam walidację AIO/GEO hardening (Sprint 3)..."
(
  cd "$ROOT_DIR"
  "$NODE_BIN" scripts/check_sprint3_aio_geo.mjs
)

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
  --exclude="MEMORY_NEWSY.md" \
  --exclude="SESSION_START_MAX.md" \
  --exclude="audit_*.md" \
  --exclude="test-tts.mp3" \
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
