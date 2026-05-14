# FitPo50

Statyczny serwis `fitpo50.pl` o zdrowiu, treningu i odżywianiu po 50. roku życia, z publicznym frontem, eksportem do katalogu `_site/` oraz panelem administracyjnym do wybranych obszarów treści.

## Jak działa projekt

- pliki stron publicznych znajdują się głównie w katalogu głównym repo,
- zasoby statyczne są w `assets/`,
- skrypty automatyzujące, walidatory i workflow publikacyjny są w `scripts/`,
- kod źródłowy TypeScript znajduje się w `src/`,
- skompilowane pliki frontendu są utrzymywane w `dist/`,
- katalog `_site/` jest czystym outputem do wdrożenia.

## Struktura katalogów

```text
fitpo50.pl/
├── admin/          # panel administracyjny i helpery publikacyjne
├── assets/         # obrazy, PDF-y, dane pomocnicze
├── data/           # raporty, cache i dane robocze
├── dist/           # zbudowane skrypty JS używane przez frontend
├── scripts/        # eksport, walidacje, publikacja, maintenance
├── src/            # źródła TypeScript
├── sukcesy/        # dzienne strony "Moje Sukcesy"
├── templates/      # szablony pomocnicze
├── _site/          # publiczny output do deployu
└── *.html          # strony publiczne i artykuły
```

## Uruchomienie lokalne

1. Zainstaluj zależności:

```bash
npm install
```

2. Zbuduj frontend:

```bash
npm run build
```

3. Uruchom podstawowe kontrole:

```bash
npm run assets:mirror:sync
npm run predeploy:check
```

## Eksport i wdrożenie

Pełny eksport produkcyjny:

```bash
./scripts/export_site.sh
```

Wynik trafia do `_site/`. Na serwer wysyłana powinna być zawartość `_site/`, nie cały katalog repozytorium.

Awaryjnie, gdy świadomie chcesz pominąć kompilację TypeScript:

```bash
SKIP_TS_BUILD=1 ./scripts/export_site.sh
```

## Najważniejsze strony

- `index.html` — strona główna
- `porady.html` — czytelnia i artykuły
- `jedzenie.html`, `rusz-sie.html`, `zdrowie.html`, `ciekawe.html` — strony kategorii
- `dziennik.html`, `moje-sukcesy.html` — sekcje dziennikowe
- `admin/` — panel pomocniczy dla wybranych workflow

## Dodawanie lub aktualizacja artykułu

Najbezpieczniejsza ścieżka publikacyjna przebiega przez skrypty z `scripts/`. W praktyce workflow opiera się na:

```bash
node scripts/import-article.js --file "<plik.fitpo50.json>" --publish true --run-internal-links auto --validate true
```

Po zmianach artykułów warto uruchomić:

```bash
npm run assets:mirror:sync
npm run predeploy:check
```

## Dodatkowe uwagi

- część plików dokumentacyjnych w repo opisuje wewnętrzne standardy redakcyjne i workflow publikacyjny,
- `dist/` oraz `_site/` są częścią ustalonego procesu projektu i nie powinny być traktowane jak zwykłe śmieci builda bez wcześniejszej analizy,
- publiczny serwis live: `https://fitpo50.pl`
