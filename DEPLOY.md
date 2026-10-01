# Deploy

Standardem jest automatyczne wdrożenie przez integrację Hostinger po pushu do gałęzi `main`. Publiczny eksport pozostaje w `_site`, a jego zgodność ze źródłem jest obowiązkowa.

## Standardowy workflow

```bash
./scripts/export_site.sh
npm run assets:mirror:sync
npm run deployment:prepare
npm run predeploy:check
git diff --check
git add -A
git commit -m "<konkretny opis>"
git push origin main
npm run deployment:verify
```

`deployment:prepare` zapisuje ten sam unikalny marker do `deployment.json` i `_site/deployment.json`. Marker musi wejść do tego samego commita co paczka.

Znaczenie wyników:

- `PUSHED` — commit jest na GitHubie, ale serwer nie pokazuje jeszcze markera paczki;
- `DEPLOYED` — marker dotarł, lecz kontrola produkcyjna ma blokery;
- `LIVE_DEPLOYED_AND_VALIDATED` — wdrożenie i pełna kontrola produkcji przeszły;
- `NOT_PUSHED` — `origin/main` nie odpowiada oczekiwanemu commitowi.

Sam push i zielony panel Hostinger nie potwierdzają produkcji. Pełny kontrakt opisuje `docs/deployment-status-contract.md`.

## Awaria integracji Hostinger

Komenda `npm run hostinger:clean-repo` jest wycofana i zawsze kończy się blokadą. Nie wolno automatycznie czyścić serwerowego repo.

Zacznij od bezpiecznej analizy:

```bash
npm run hostinger:recovery
```

Dry-run wymaga lokalnego markera serwera `.fitpo50-hostinger-deploy` o treści `fitpo50.pl`, sprawdza właściwe repo, branch, `origin`, historię i pokazuje lokalne zmiany. Niczego nie modyfikuje. Tryb apply wymaga dodatkowo czystego drzewa oraz jawnego przełącznika:

```bash
FITPO50_HOSTINGER_RECOVERY=APPLY_APPROVED npm run hostinger:recovery -- --apply
```

Procedura wykonuje zweryfikowany backup danych runtime i wyłącznie fast-forward. Nie usuwa nieznanych plików. Brudne repo lub rozbieżna historia zatrzymują naprawę.
