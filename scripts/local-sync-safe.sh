#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/Users/grzegorzkupiec/Projects/FitPo50-local"

cd "$REPO_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/fitpo50-backup-$TS"
mkdir -p "$BACKUP_DIR"
cp -R data assets/data assets/news "$BACKUP_DIR/" 2>/dev/null || true

git pull --ff-only origin main
git restore .agent/skills/auto/shell/SKILL.md 2>/dev/null || true

# Twarda synchronizacja mirroru i blokada na niespójnościach NEWS/assetów.
npm run assets:mirror:sync
npm run predeploy:check

git status --short

echo
echo "[PASS] local-sync-safe: repo zsynchronizowane i przeszło predeploy gate."
echo "Backup: $BACKUP_DIR"

