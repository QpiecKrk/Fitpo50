# Bramka pre-push dla `main`

Lokalny hak `.githooks/pre-push` zawsze uruchamia dotychczasowy pełny zestaw `scripts/run-all-prepush.js`. Po jego sukcesie przekazuje informacje o wysyłanych referencjach do `scripts/prepush-main-guard.js`.

Dla gałęzi innych niż `main` oraz tagów dodatkowa bramka kończy się bez kontroli wdrożenia. Dla `main` wymaga łącznie:

- wysyłania dokładnie aktualnego `HEAD`;
- pliku `deployment.json` obecnego w wysyłanym commicie;
- zgodnego stanu publikacji przygotowanego przez `deployment:prepare`;
- zgodnego odcisku publicznego eksportu `_site`;
- świeżej, zdalnej kontroli synchronizacji NEWS.

Usunięcie zdalnej gałęzi `main`, brak markera, niezgodność odcisku, różnica NEWS, brak poświadczeń albo awaria sieci blokują push. Błędy NEWS zachowują kody `20` (dane) i `30` (środowisko lub sieć). Marker może być przygotowany na rodzicu commita zawierającego marker, jeżeli stan publikacji i odciski są zgodne.

## Granica ochrony

Polecenie `git push --no-verify` omija lokalny hak. Twardą ochronę przed takim obejściem zapewni dopiero ruleset GitHuba opisany w etapie A1.1. Do tego czasu bramka jest ochroną lokalnego standardowego przepływu, a nie zabezpieczeniem serwera GitHub.
