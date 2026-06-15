#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

REPORT_DIR="data/reports"
REPORT_FILE="$REPORT_DIR/session-start-report.md"
DOWNLOADS_DIR="$HOME/Downloads/FitPo50-reports"

mkdir -p "$REPORT_DIR"
mkdir -p "$DOWNLOADS_DIR"

timestamp="$(date '+%Y-%m-%d %H:%M:%S %z')"
stamp_file="$(date '+%Y%m%d-%H%M%S')"

git_pull_output="$(git pull --ff-only origin main 2>&1 || true)"
git_status_output="$(git status --short 2>&1 || true)"
mirror_output="$(npm run assets:mirror:sync 2>&1 || true)"
predeploy_output="$(npm run predeploy:check 2>&1 || true)"

cat > "$REPORT_FILE" <<EOF
# Session Start Report

- Timestamp: $timestamp

## git pull --ff-only origin main
\`\`\`txt
$git_pull_output
\`\`\`

## git status --short
\`\`\`txt
$git_status_output
\`\`\`

## npm run assets:mirror:sync
\`\`\`txt
$mirror_output
\`\`\`

## npm run predeploy:check
\`\`\`txt
$predeploy_output
\`\`\`
EOF

cp "$REPORT_FILE" "$DOWNLOADS_DIR/session-start-report.md"
cp "$REPORT_FILE" "$DOWNLOADS_DIR/session-start-report-$stamp_file.md"

echo "Raport zapisany: $REPORT_FILE"
echo "Raport skopiowany: $DOWNLOADS_DIR/session-start-report.md"
echo "Raport archiwalny: $DOWNLOADS_DIR/session-start-report-$stamp_file.md"
