# Bezpieczeństwo katalogów tymczasowych i procesów

## Zarządzany workspace

Każdy katalog roboczy publikacji, eksportu, workbencha, GSC i renderowania PDF ma dwa lokalne pliki właściciela:

- `.fitpo50-workspace.json` — typ procesu, PID, czas utworzenia, katalog projektu, slug i status,
- `.fitpo50-workspace.lock` — aktywna blokada procesu.

Status `ACTIVE` oznacza trwającą pracę. `AWAITING_REVIEW` i `AWAITING_LIVE_CONFIRMATION` oznaczają celowo zachowane artefakty nadal potrzebne procesowi; takie katalogi nie są kandydatami do cleanupu. Wznowienie tej samej transakcji przywraca `ACTIVE`. Retencja może usunąć wyłącznie workspace jawnie oznaczony `COMPLETED`, gdy od prawidłowego `completed_at` minęło co najmniej 12 godzin; brak `completed_at` chroni katalog. `ACTIVE`, oba statusy oczekiwania i `FAILED` pozostają zachowane niezależnie od wieku. Jeśli proces zostanie przerwany, manifest i lock pozwalają go zdiagnozować bez zgadywania po samej nazwie katalogu.

Automatyczne sprzątanie własnego workspace bieżącej operacji nie jest usuwaniem danych użytkownika ani plików repozytorium. Ręczne wywołanie `tmp:cleanup` oraz każdy tryb `--apply` nadal wymagają osobnego „tak” użytkownika; dry-run uruchamiany wewnątrz `prepush:local` jest dozwolony.

## Cleanup

Bezargumentowe wywołanie jest zawsze tylko odczytowe:

```bash
npm run tmp:cleanup
```

Usunięcie kwalifikujących się katalogów wymaga jawnej komendy:

```bash
npm run tmp:cleanup:apply
```

Katalog może zostać usunięty tylko wtedy, gdy:

- ma znany prefiks,
- zawiera prawidłowy manifest właściciela,
- należy do bieżącego projektu,
- ma co najmniej 12 godzin,
- zapisany PID i PID locka nie działają.

CLI dodatkowo akceptuje wyłącznie bieżący root FitPo50 oraz systemowy katalog tymczasowy lub jego podkatalog. Nieznane argumenty, połączenie `--apply` z `--dry-run`, symlink albo ścieżka wychodząca poza katalog tymczasowy kończą działanie błędem przed usuwaniem.

Świeże katalogi, aktywne procesy, katalogi `AWAITING_REVIEW`, inne projekty, błędne manifesty, błędne locki i katalogi bez manifestu są pomijane. Pliki tymczasowe znalezione wewnątrz repo bez danych właściciela są raportowane, ale nie są automatycznie usuwane.

## Chromium

Każdy skrypt Playwright korzysta z `scripts/lib/playwright-lifecycle.js`. Wrapper zamyka przeglądarkę w `finally` po sukcesie, błędzie i timeout. Test regresji blokuje dodanie bezpośredniego `chromium.launch()` w innym pliku.

## Eksport

`scripts/export_site.sh` może czyścić wyłącznie repozytoryjny `_site` albo katalog `site` należący do aktywnego zarządzanego workspace typu `build-export-check` lub `prepush-export`. Dowolny katalog, root repozytorium, katalog domowy, zwykły katalog tymczasowy i symlink są blokowane przed buildem, `rm -rf` i `rsync --delete`.

## Równoległość

Zadania `prepush-parallel-checks` muszą deklarować `access: read` albo `access: write`. Zadania odczytowe mogą działać równolegle. Zadania zapisujące są wykonywane sekwencyjnie. Eksporty i fixture używają unikalnych katalogów tworzonych przez systemowy `mkdtemp`.
