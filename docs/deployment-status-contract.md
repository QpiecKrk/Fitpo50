# Kontrakt wdrożenia FitPo50

## Standardowy proces

Hostinger automatycznie wdraża gałąź `main`. Po przygotowaniu eksportu należy utworzyć unikalny marker wydania, zatwierdzić go razem z paczką, wykonać push i uruchomić twardą kontrolę produkcji:

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

Kontrola nie zamienia błędów sieci na PASS. Porównuje `origin/main` z lokalnym commitem, sprawdza unikalny `deployment.json`, HTTP 200, canonical i pliki bazowe. Jeśli commit zmienia artykuły, sprawdza też `dateModified`, sitemap `lastmod`, PDF oraz wszystkie obrazy użyte przez te artykuły.

## Statusy

- `PUSHED` — oczekiwany commit jest na `origin/main`, ale marker nie dotarł jeszcze na produkcję.
- `DEPLOYED` — marker bieżącej paczki jest na serwerze, ale co najmniej jedna kontrola produkcyjna nie przeszła.
- `LIVE_DEPLOYED_AND_VALIDATED` — commit, marker i wszystkie wymagane kontrole produkcji są zgodne.
- `NOT_PUSHED` — `origin/main` nie odpowiada oczekiwanemu commitowi.

Adresy do GSC wolno przekazać dopiero po `LIVE_DEPLOYED_AND_VALIDATED`.

## Awaryjne odzyskanie integracji Hostinger

Stara komenda `npm run hostinger:clean-repo` jest trwale wycofana. Nie wolno automatycznie usuwać ani nadpisywać zmian na serwerze.

Najpierw uruchom wyłącznie analizę:

```bash
npm run hostinger:recovery
```

Dry-run wymaga lokalnego, niecommitowanego pliku `.fitpo50-hostinger-deploy` o treści `fitpo50.pl`, sprawdza repo, gałąź, `origin`, rozbieżność historii oraz pokazuje dokładną listę zmian. Nie zmienia HEAD ani plików roboczych.

Tryb naprawczy jest przeznaczony wyłącznie dla właściwego repo wdrożeniowego. Drzewo robocze musi być czyste. Dopiero wtedy można jawnie wykonać:

```bash
FITPO50_HOSTINGER_RECOVERY=APPLY_APPROVED npm run hostinger:recovery -- --apply
```

Procedura tworzy i sprawdza backup danych runtime, wykonuje tylko `git merge --ff-only origin/main`, sprawdza zgodność HEAD z `origin/main` i uruchamia bramki projektu. Nie usuwa nieznanych plików. Jakakolwiek lokalna zmiana lub rozbieżna historia zatrzymuje proces i wymaga ręcznego przeglądu.
