#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/_site}"

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
  --exclude="package.json" \
  --exclude="tsconfig.json" \
  --exclude="src/" \
  --exclude="scripts/" \
  --exclude="_site/" \
  "$ROOT_DIR/" "$OUTPUT_DIR/"

echo "Exported clean site to: $OUTPUT_DIR"
