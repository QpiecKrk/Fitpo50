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

run_minification() {
  local cleancss_bin="$ROOT_DIR/node_modules/.bin/cleancss"
  local terser_bin="$ROOT_DIR/node_modules/.bin/terser"

  if [[ ! -x "$cleancss_bin" || ! -x "$terser_bin" ]]; then
    echo "Pominięto minifikację (brak clean-css-cli lub terser)."
    return 0
  fi

  echo "Minifikuję CSS/JS w katalogu eksportu..."

  if [[ -f "$OUTPUT_DIR/style.css" ]]; then
    "$cleancss_bin" -O2 "$OUTPUT_DIR/style.css" -o "$OUTPUT_DIR/style.css"
  fi

  if [[ -f "$OUTPUT_DIR/article.css" ]]; then
    "$cleancss_bin" -O2 "$OUTPUT_DIR/article.css" -o "$OUTPUT_DIR/article.css"
  fi

  if [[ -d "$OUTPUT_DIR/dist" ]]; then
    local js_file
    while IFS= read -r -d '' js_file; do
      "$terser_bin" "$js_file" --compress --mangle -o "$js_file"
    done < <(find "$OUTPUT_DIR/dist" -type f -name "*.js" -print0)
  fi
}

echo "Uruchamiam aktualną walidację predeploy..."
(
  cd "$ROOT_DIR"
  "$NODE_BIN" scripts/predeploy-gate.js
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
  --exclude=".github/" \
  --exclude=".githooks/" \
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

run_minification

echo "Exported clean site to: $OUTPUT_DIR"
