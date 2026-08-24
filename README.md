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

Najbezpieczniejsza ścieżka jest dwustopniowa: najpierw powstaje chroniony artefakt `CONTENT_READY`, a dopiero potem HTML:

```bash
npm run article:prepare-json --file="<draft.fitpo50.json>"
npm run article:publish --file="<CONTENT_READY.fitpo50.json>"
```

Po zmianach artykułów warto uruchomić:

```bash
npm run assets:mirror:sync
npm run predeploy:check
```

## Publishing Policy Engine

System publikacyjny FitPo50 działa dziś wokół centralnego silnika reguł:

- `scripts/lib/article-policy.js` jest kanonicznym źródłem limitów, regexów i walidatorów,
- `scripts/lib/article-intent-links.js` buduje lokalne inventory `BlogPosting`, kontroluje właściciela intencji, naturalne linki i propozycję centrum,
- `scripts/lib/article-media.js` egzekwuje jeden katalog pakietu, dokładne nazwy, manifest, warianty, jakość, zgodność i różnorodność obrazów,
- `scripts/lib/article-staging.js` tworzy izolowaną kopię witryny i promuje zatwierdzone artefakty transakcyjnie dopiero po wszystkich bramkach,
- `scripts/article-preview-gate.js` renderuje desktop/mobile, kontroluje semantykę tabel oraz renderuje i porównuje każdą stronę PDF,
- `scripts/article-json-workbench.js` przygotowuje chroniony JSON bez tworzenia HTML,
- `scripts/article-preflight.js` sprawdza JSON wejściowy przed importem,
- `scripts/import-article.js` generuje HTML według tych samych reguł,
- `scripts/validate-article-standard.js` weryfikuje gotowy artykuł,
- `scripts/predeploy-gate.js` jest końcową bramką przed publikacją,
- `scripts/article-sync-pro.js` synchronizuje SEO i listingi na podstawie `data/import/*.json`.

Docelowy przepływ to:

```text
draft.fitpo50.json
  -> article-json-workbench
  -> prepare-article-media (dokładne pliki + AVIF/WebP/JPG + media_manifest)
  -> prepare-article-architecture
  -> CONTENT_READY.fitpo50.json
  -> article-preflight
  -> izolowany staging poza repo
  -> import-article + stagingowy HTML/PDF
  -> validate-article-standard
  -> predeploy-gate
  -> render desktop/mobile + wszystkie strony PDF
  -> PREVIEW_READY
  -> transakcyjna promocja do repo
  -> publish
```

Ważne zasady operacyjne:

- `article-policy.js` traktujemy jako Single Source of Truth dla reguł publikacji,
- model zewnętrzny deklaruje intencję i frazy, ale nie zgaduje linków FitPo50 ani członkostwa w centrum,
- lokalny etap architektury wymaga 4 istniejących celów i naturalnych anchorów; propozycja centrum zawsze czeka na akceptację,
- `article-sync-pro.js` działa w trybie fail-fast i nie ma miękkich fallbacków dla polityki,
- przy zmianach SEO i listingów preferowany workflow to najpierw `--dry-run`, a dopiero potem zapis:

```bash
node scripts/article-sync-pro.js --slug <slug> --sync-seo --sync-listings --dry-run
node scripts/article-sync-pro.js --slug <slug> --sync-seo --sync-listings
```

Minimalny pakiet testów regresyjnych dla tego obszaru:

```bash
npm run test:publishing-engine
```

## Dodatkowe uwagi

- część plików dokumentacyjnych w repo opisuje wewnętrzne standardy redakcyjne i workflow publikacyjny,
- `dist/` oraz `_site/` są częścią ustalonego procesu projektu i nie powinny być traktowane jak zwykłe śmieci builda bez wcześniejszej analizy,
- publiczny serwis live: `https://fitpo50.pl`
