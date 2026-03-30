#!/usr/bin/env bash
set -euo pipefail

./scripts/export_site.sh

# Dodaj tylko zmiany w już śledzonych plikach
git add -u

# Blokada: nie pozwalaj commitować plików narzędziowych
if git diff --cached --name-only | grep -E '^((\.agent|\.agents|\.brainsync|\.cursor)/|\.windsurfrules$)'; then
  echo "STOP: w stage są pliki narzędziowe. Oczyść je i spróbuj ponownie."
  exit 1
fi

if git diff --cached --quiet; then
  echo "Brak zmian do commita."
  exit 0
fi

git commit -m "Aktualizacja strony"
git pull --rebase --autostash origin main
git push

echo "OK: Git gotowy. Teraz kliknij 'Wdróż' w Hostingerze."
