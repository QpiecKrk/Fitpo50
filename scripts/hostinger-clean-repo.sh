#!/usr/bin/env bash
set -euo pipefail

echo "[RETIRED] Ta komenda została wycofana, ponieważ mogła usuwać nieznane zmiany i pliki." >&2
echo "Uruchom najpierw bezpieczny dry-run: npm run hostinger:recovery" >&2
echo "Tryb naprawczy wymaga osobnej, jawnej procedury opisanej w DEPLOY.md." >&2
exit 2
