#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

REPORT_DIR="data/reports"
REPORT_FILE="$REPORT_DIR/session-start-report.md"
REPORT_TMP="$REPORT_FILE.tmp.$$"
DOWNLOADS_DIR="$HOME/Downloads/FitPo50-reports"
DOWNLOADS_LATEST="$DOWNLOADS_DIR/session-start-report.md"

mkdir -p "$REPORT_DIR"
mkdir -p "$DOWNLOADS_DIR"

timestamp="$(date '+%Y-%m-%d %H:%M:%S %z')"
stamp_file="$(date '+%Y%m%d-%H%M%S')"
DOWNLOADS_ARCHIVE="$DOWNLOADS_DIR/session-start-report-$stamp_file.md"

git_pull_output="$(git pull --ff-only origin main 2>&1 || true)"
git_status_output="$(git status --short 2>&1 || true)"
mirror_output="$(npm run assets:mirror:sync 2>&1 || true)"
predeploy_output="$(npm run predeploy:check 2>&1 || true)"

trap 'rm -f "$REPORT_TMP"' EXIT
cat > "$REPORT_TMP" <<EOF
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
mv "$REPORT_TMP" "$REPORT_FILE"
trap - EXIT

cp "$REPORT_FILE" "$DOWNLOADS_LATEST.tmp.$$"
mv "$DOWNLOADS_LATEST.tmp.$$" "$DOWNLOADS_LATEST"
cp "$REPORT_FILE" "$DOWNLOADS_ARCHIVE.tmp.$$"
mv "$DOWNLOADS_ARCHIVE.tmp.$$" "$DOWNLOADS_ARCHIVE"

echo "Raport zapisany: $REPORT_FILE"
echo "Raport skopiowany: $DOWNLOADS_LATEST"
echo "Raport archiwalny: $DOWNLOADS_ARCHIVE"
