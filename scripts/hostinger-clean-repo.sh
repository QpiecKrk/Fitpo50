#!/usr/bin/env bash
set -euo pipefail

# Czyści repo na serwerze do stanu origin/main, po wcześniejszym backupie
# lokalnie modyfikowanych plików NEWS.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="/tmp/fitpo50-deploy-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "[1/4] Backup lokalnych plików NEWS do: $BACKUP_DIR"
cp -R \
  data/news-live.json \
  assets/data/news-fallback.json \
  _site/data/news-live.json \
  _site/assets/data/news-fallback.json \
  assets/news \
  "$BACKUP_DIR"/ 2>/dev/null || true

echo "[2/4] Pobieram najnowszy stan origin/main"
git fetch origin

echo "[3/4] Czyszczę working tree do origin/main"
git reset --hard origin/main
git clean -fd

echo "[4/4] Aktualny status repo"
git status --short

echo "OK: repo przygotowane do deployu. Backup: $BACKUP_DIR"
