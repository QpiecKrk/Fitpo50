#!/usr/bin/env bash
set -euo pipefail

./scripts/export_site.sh
npm run assets:mirror:sync
npm run deployment:prepare
npm run predeploy:check

# Nowe pliki nie mogą zniknąć z commita tylko dlatego, że git add -u ich nie widzi.
# Nie dodajemy ich automatycznie: lista ma zostać świadomie sprawdzona i dodana przed push_one.
untracked_files="$(git ls-files --others --exclude-standard)"
if [[ -n "$untracked_files" ]]; then
  echo "STOP: są nowe nieśledzone pliki, których push_one nie może pominąć:"
  echo "$untracked_files"
  echo "Dodaj właściwe pliki jawnie przez git add, a potem ponów push_one."
  exit 1
fi

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
git push

echo "OK: Git gotowy."
echo "Hostinger wdraża main automatycznie. Uruchamiam twardą kontrolę produkcji bez IndexNow."
npm run deployment:finalize
echo "OK: produkcja i ekspozycja plików sprawdzone. IndexNow uruchom osobno: npm run indexnow:release"
