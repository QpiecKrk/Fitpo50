# FitPo50 Command Registry

Ten plik porzadkuje najwazniejsze komendy, zeby agenci i czlowiek nie wybierali przypadkowo starych albo mylacych skryptow.

## Start pracy

- `npm run session:start` - lekki start techniczny: kontekst agenta i doctor.
- `npm run fitpo50:doctor` - szybki status systemu. GREEN/YELLOW mozna czytac jako stan roboczy, RED blokuje push/deploy.

## Publikacja i push

- `npm run prepush:local` - glowna lokalna bramka przed pushem. Robi diff guard, doctor, build, gate'y rownolegle z trybem worktree, swiezy export do katalogu tymczasowego i smoke test tego exportu.
- `npm run prepush:worktree` - szybka rownolegla bramka dla staged + unstaged zmian w lokalnym drzewie roboczym.
- `npm run site:full-audit` - pelny audyt techniczny: build/export check, crawler linkow, workflow maintenance i audyt AIO.
- `npm run predeploy:check` - bramka przed wdrozeniem, bez pelnego builda.
- `npm run assets:mirror:sync` - synchronizuje aktywa zrodlowe do `_site`.
- `npm run assets:mirror:check` - sprawdza, czy mirror jest spojny.
- `npm run sitemap:lastmod:sync` - aktualizuje daty w sitemap.
- `npm run sitemap:lastmod:check` - sprawdza sitemap bez zapisu.

## Artykuly

- `npm run article:prepare-json --file=<draft.fitpo50.json>` - poprawia draft do trwałego artefaktu `CONTENT_READY`; nie tworzy HTML.
- `python3 docs/skills/fitpo50-article-draft/scripts/validate_fitpo50_draft.py <draft.fitpo50.json>` - sprawdza draft z importowego skilla Claude; `DRAFT_VALID` nadal wymaga lokalnego `article:prepare-json`.
- `npm run article:preflight -- --file <plik.fitpo50.json> --assets-dir <katalog>` - kontrola JSON i obrazow przed importem.
- `npm run article:ready-check -- --file <plik.fitpo50.json> --assets-dir <katalog>` - szybka kontrola JSON i assetow na kopii roboczej, bez importu HTML/PDF i bez zmiany oryginalnego pliku.
- `npm run article:publish --file=<plik.fitpo50.json>` - pelny import/publikacja artykulu przez pipeline.
- `npm run article:validate` - walidacja standardu artykulow.
- `npm run article:contract:diff` - kontrakt tylko dla zmienionych HTML.
- `npm run article:guard:diff` - guard publikacyjny tylko dla zmienionych HTML.
- `npm run article:pdf:sync` - synchronizacja PDF i przyciskow PDF. Starych artykulow nie przerabia sie bez osobnej decyzji.

## SEO, AEO, GEO, AIO

- `npm run gsc:auto` - kanoniczny workflow polecenia `GSC`: pobranie/synchronizacja, kontrola kontraktu danych 7/28/90, raporty i monitoring po publikacji. Dane robocze pozostają w `~/Downloads/gsc-auto-input`.
- `npm run gsc:data:check` - sprawdza typy CSV, manifest, hashe, świeżość i spójność cohortu przed analizą.
- `npm run gsc:priority-map -- --input-dir ~/Downloads/gsc-auto-input --output-dir data/reports` - raport z CSV z GSC.
- `npm run gsc:weekly:api:local` - pobiera dane z GSC API, uzywajac sekretow z lokalnego `.env.local`.
- `npm run seo:aio:machine -- --input-dir ~/Downloads/gsc-auto-input --output-dir data/reports` - centrum decyzji SEO/AEO/GEO/AIO.
- `npm run seo:aio:apply-wave` - tylko raport propozycji. Stary zapis `safe-links` jest zablokowany, bo tworzył generyczny akapit.
- `npm run popraw-seo` - diagnozuje wszystkie indeksowalne `BlogPosting` i przypisuje każdy URL do `BOOST`, `ROKUJE`, `NAPRAWA` albo `MONITORING`. Bramka wymaga `omitted_articles = 0`; komenda nie edytuje HTML bez zatwierdzenia konkretnych ID.
- `npm run popraw-seo:apply --ids="BOOST 1,NAPRAWA 2" --confirm=APPLY_APPROVED_SEO` - techniczna komenda agenta: atomowo stosuje zatwierdzony manifest konkretnych patchy, regeneruje PDF/mirror/sitemap i wykonuje walidatory. Użytkownik nie musi jej pamiętać.
- `npm run popraw-seo:live` - techniczna kontrola produkcji; dopiero `LIVE_DEPLOYED_AND_VALIDATED` tworzy końcową listę GSC. Uruchamia ją automatycznie workflow po pushu.
- `npm run popraw-seo:gsc-local` - pobiera GSC przez API z `.env.local`, przebudowuje priority-map, SEO/AIO command center i raport `popraw-seo`.
- `npm run seo:aeo:guard` - kontrola szybkich odpowiedzi, FAQ i elementow AEO.
- `npm run quick-answer:backlog` - raport brakow w szybkich odpowiedziach.
- `npm run llms:full` - regeneruje `llms-full.txt`; plik jest lokalnym artefaktem i nie jest commitowany.
- `npm run gsc:post-publication` - aktualizuje monitoring opublikowanych URL-i i checkpointy 7/14/28.
- `npm run test:pipeline-blockers` - sprawdza osiem obowiązkowych blokad błędnego JSON-u/publikacji.
- `npm run growth:ai-visibility-test` - techniczna część monitoringu `popraw-ai`; wynik nie upoważnia do edycji bez danych i akceptacji użytkownika.

## Growth i raporty robocze

- `npm run growth:verify` - sprawdza komplet elementow growth.
- `npm run growth:llms-check` - kontrola warstwy AIO/LLMS.
- `npm run aio:full-audit` - pelny raport SEO/AEO/GEO/AIO: encje, structured data, quick answers, topical map, llms-check, verify i growth report.
- `npm run growth:perplexity-monitor` - kolejka monitoringu AI visibility; bez `PERPLEXITY_API_KEY` nie wykonuje zewnetrznych zapytan.
- Raporty growth domyslnie trafiaja do `data/reports/growth/`. Ten katalog jest ignorowany przez git.
- Dane CSV pobrane z GSC API trafiaja do `data/gsc/`. Ten katalog jest ignorowany przez git.
- `FITPO50_GROWTH_REPORT_DIR=<katalog>` pozwala tymczasowo zapisac raporty w innym miejscu.

## Sprzatanie

- `npm run reports:prune:dry` - pokazuje robocze raporty starsze niz 30 dni, ktore mozna usunac.
- `npm run reports:prune` - usuwa tylko bezpieczne, niecommitowane raporty robocze starsze niz 30 dni.
- `npm run tmp:cleanup:dry` - pokazuje tymczasowe pliki do sprzatniecia.
- `npm run tmp:cleanup` - sprzata tymczasowe pliki techniczne.

## Komendy, ktorych nie traktujemy jako glownego workflow

- `npm run prepush:strict` - starszy wariant laczony; preferuj `npm run prepush:local`.
- `npm run check:build-export` - szeroki check techniczny; do codziennego push wystarcza `prepush:local`.
- `npm run growth:*` inne niz wymienione wyzej - tylko gdy wiadomo, jaki raport lub akcja jest potrzebna.
