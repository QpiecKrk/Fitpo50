#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APPLY=0
if [[ "${1:-}" == "--apply" ]]; then APPLY=1; shift; fi
if [[ "$#" -ne 0 ]]; then echo "Użycie: npm run hostinger:recovery [-- --apply]" >&2; exit 2; fi
fail() { echo "[RECOVERY][BLOCKED] $*" >&2; exit 2; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "To nie jest repozytorium Git."
TOP="$(git rev-parse --show-toplevel)"
[[ "$TOP" == "$ROOT_DIR" ]] || fail "Skrypt musi być uruchomiony w katalogu głównym repozytorium."
[[ "$(git branch --show-current)" == "main" ]] || fail "Wymagana gałąź main."
REMOTE="$(git remote get-url origin 2>/dev/null || true)"
[[ "$REMOTE" =~ (^|[:/])QpiecKrk/Fitpo50(\.git)?$ ]] || fail "Nieprawidłowy origin: ${REMOTE:-MISSING}."
[[ -f .fitpo50-hostinger-deploy ]] || fail "Brak serwerowego markera .fitpo50-hostinger-deploy. To nie jest potwierdzony katalog wdrożeniowy."
[[ "$(tr -d '[:space:]' < .fitpo50-hostinger-deploy)" == "fitpo50.pl" ]] || fail "Nieprawidłowa treść markera serwerowego."

echo "[RECOVERY] Tryb: $([[ "$APPLY" == "1" ]] && echo APPLY || echo DRY-RUN)"
echo "[RECOVERY] Repo: $TOP"
echo "[RECOVERY] Origin: $REMOTE"
git fetch origin main
git merge-base --is-ancestor HEAD origin/main || fail "Lokalny HEAD jest rozbieżny z origin/main; potrzebny ręczny przegląd."
echo "[RECOVERY] Zmiany oczekujące z origin/main:"
git diff --name-status HEAD..origin/main || true
echo "[RECOVERY] Lokalne zmiany i pliki nieśledzone:"
git status --short || true

if [[ "$APPLY" != "1" ]]; then echo "[RECOVERY][DRY-RUN] Nie zmieniono plików ani HEAD."; exit 0; fi
[[ "${FITPO50_HOSTINGER_RECOVERY:-}" == "APPLY_APPROVED" ]] || fail "Brak FITPO50_HOSTINGER_RECOVERY=APPLY_APPROVED."
STATUS_WITHOUT_MARKER="$(git status --porcelain | grep -v '^?? \.fitpo50-hostinger-deploy$' || true)"
[[ -z "$STATUS_WITHOUT_MARKER" ]] || fail "Repo ma lokalne zmiany. Niczego nie usunięto; wykonaj ręczny przegląd."

BACKUP_DIR="/tmp/fitpo50-deploy-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/files"
RUNTIME_PATHS=(data/news-live.json data/news-backups assets/data/news-fallback.json _site/data/news-live.json _site/assets/data/news-fallback.json assets/news)
for relative_path in "${RUNTIME_PATHS[@]}"; do
  if [[ -e "$relative_path" ]]; then
    mkdir -p "$BACKUP_DIR/files/$(dirname "$relative_path")"
    cp -R "$relative_path" "$BACKUP_DIR/files/$relative_path"
  fi
done
(
  cd "$BACKUP_DIR/files"
  : > "$BACKUP_DIR/SHA256SUMS"
  while IFS= read -r -d '' backup_file; do shasum -a 256 "$backup_file" >> "$BACKUP_DIR/SHA256SUMS"; done < <(find . -type f -print0 | sort -z)
  [[ ! -s "$BACKUP_DIR/SHA256SUMS" ]] || shasum -a 256 -c "$BACKUP_DIR/SHA256SUMS"
)

git merge --ff-only origin/main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || fail "HEAD nie odpowiada origin/main."
if [[ "${FITPO50_RECOVERY_SKIP_PROJECT_CHECKS:-}" == "1" ]]; then
  [[ "${FITPO50_RECOVERY_TEST:-}" == "1" ]] || fail "Pominięcie kontroli jest dozwolone tylko w testach."
else
  npm run predeploy:check
  npm run assets:mirror:check
fi
echo "[RECOVERY][PASS] Bezpieczny fast-forward zakończony."
echo "[RECOVERY] Zweryfikowany backup: $BACKUP_DIR"
