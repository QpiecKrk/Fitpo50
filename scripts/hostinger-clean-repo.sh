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

echo "[4/5] Przywracam lokalne drafty NEWS (jesli istnieja backupy)"
if [[ -f "$BACKUP_DIR/news-live.json" ]]; then
  php -r '
    $root = getcwd();
    $backup = "'"$BACKUP_DIR"'/news-live.json";
    $live = $root . "/data/news-live.json";
    $liveSite = $root . "/_site/data/news-live.json";

    if (!is_file($backup) || !is_file($live)) { exit(0); }

    $backupData = json_decode((string)file_get_contents($backup), true);
    $liveData = json_decode((string)file_get_contents($live), true);
    if (!is_array($backupData) || !is_array($liveData)) { exit(0); }

    $backupItems = is_array($backupData["items"] ?? null) ? $backupData["items"] : [];
    $liveItems = is_array($liveData["items"] ?? null) ? $liveData["items"] : [];

    $indexById = [];
    foreach ($liveItems as $idx => $item) {
      $id = trim((string)($item["id"] ?? ""));
      if ($id !== "") { $indexById[$id] = $idx; }
    }

    $changed = false;
    foreach ($backupItems as $item) {
      if (!is_array($item)) { continue; }
      if ((string)($item["status"] ?? "") !== "draft") { continue; }
      $id = trim((string)($item["id"] ?? ""));
      if ($id === "") {
        $liveItems[] = $item;
        $changed = true;
        continue;
      }
      if (array_key_exists($id, $indexById)) {
        if ((string)($liveItems[$indexById[$id]]["status"] ?? "") === "draft") {
          $liveItems[$indexById[$id]] = array_replace($liveItems[$indexById[$id]], $item);
          $changed = true;
        }
      } else {
        $liveItems[] = $item;
        $changed = true;
      }
    }

    if (!$changed) { exit(0); }
    $liveData["version"] = 1;
    $liveData["updatedAt"] = date("c");
    $liveData["items"] = $liveItems;
    $json = json_encode($liveData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) { exit(0); }
    file_put_contents($live, $json . PHP_EOL);
    if (is_dir(dirname($liveSite))) {
      file_put_contents($liveSite, $json . PHP_EOL);
    }
  '
fi

if [[ -d "$BACKUP_DIR/news" ]]; then
  mkdir -p assets/news _site/assets/news
  cp -n "$BACKUP_DIR"/news/* assets/news/ 2>/dev/null || true
  cp -n "$BACKUP_DIR"/news/* _site/assets/news/ 2>/dev/null || true
fi

echo "[5/5] Aktualny status repo"
git status --short

echo "OK: repo przygotowane do deployu. Backup: $BACKUP_DIR"
