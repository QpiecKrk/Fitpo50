# Bezpieczeństwo katalogów tymczasowych i procesów

## Zarządzany workspace

Każdy katalog roboczy publikacji, eksportu, workbencha, GSC i renderowania PDF ma dwa lokalne pliki właściciela:

- `.fitpo50-workspace.json` — typ procesu, PID, czas utworzenia, katalog projektu, slug i status,
- `.fitpo50-workspace.lock` — aktywna blokada procesu.

Status `ACTIVE` oznacza trwającą pracę. Prawidłowo zakończony proces zapisuje `COMPLETED` albo `FAILED`, usuwa lock i usuwa własny katalog. Jeśli proces zostanie przerwany, manifest i lock pozwalają rozpoznać osieroconą pracę bez zgadywania po samej nazwie katalogu.

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

Świeże katalogi, aktywne procesy, inne projekty, błędne manifesty, błędne locki i katalogi bez manifestu są pomijane. Pliki tymczasowe znalezione wewnątrz repo bez danych właściciela są raportowane, ale nie są automatycznie usuwane.

## Chromium

Każdy skrypt Playwright korzysta z `scripts/lib/playwright-lifecycle.js`. Wrapper zamyka przeglądarkę w `finally` po sukcesie, błędzie i timeout. Test regresji blokuje dodanie bezpośredniego `chromium.launch()` w innym pliku.

## Równoległość

Zadania `prepush-parallel-checks` muszą deklarować `access: read` albo `access: write`. Zadania odczytowe mogą działać równolegle. Zadania zapisujące są wykonywane sekwencyjnie. Eksporty i fixture używają unikalnych katalogów tworzonych przez systemowy `mkdtemp`.
