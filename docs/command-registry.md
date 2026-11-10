# FitPo50 Command Registry

Ten plik jest kanonicznym rejestrem komend `package.json`. Każda komenda ma dokładnie jeden status sprawdzany przez `npm run command:contract:check`.

## Znaczenie statusów

- `PUBLIC` — bezpieczne, udokumentowane wejście, które można uruchomić bezpośrednio.
- `INTERNAL` — etap wywoływany przez kontroler lub bramkę; nie jest samodzielnym workflow.
- `RECOVERY` — procedura tylko dla opisanej awarii i z jej dodatkowymi zabezpieczeniami.
- `RETIRED` — komenda historyczna zablokowana albo zastąpiona.

## Kanoniczne wejścia

Zasady i techniczny przebieg `article:add` są zaimplementowane lokalnie (części 2–4). Kontroler przekazuje profil `technical` przez przygotowanie, dry-run, preflight, importer i walidację artefaktów. Nie uruchamia wczesnego sprawdzania dowodów. Walidatory HTML używane w hookach rozpoznają profil z manifestu zgodnego z hashem HTML; jawne kontrole redakcyjne zachowują własne reguły. Klasyfikacja, jedna lista zakresu, warunkowy NEWS i ponowne użycie aktualnych wyników są zaimplementowane lokalnie w częściach 5–7. Wznowienie wydania jest zaimplementowane lokalnie w części 8; sprawdzian na nowym artykule pozostaje w części 9.

Część 5: `change-scope.js` klasyfikuje przekazaną listę z jawną mapą znanych modułów i przypisanych testów. Artykuł i kod łączą zakresy; raport publikacji nie uruchamia pełnego audytu, dokumentacja nie buduje strony, a szablon/CSS artykułów rozszerza kontrolę artykułów bez NEWS. Każdy plik ma powód doboru; nieznany plik wymaga ustalenia wpływu przed kosztownymi kontrolami i przygotowaniem markera. Sonda eksportu pozostaje dla eksportera.

Część 6: agent ustala zakres i przekazuje wewnętrznie `--task-files-json '<tablica ścieżek>'` do `publikuj`; przy artykule lista łączy się z jego istniejącym manifestem. Ta sama lista wraz z markerami trafia do `deployment:prepare -- --files-json '<tablica>'` i dokładnego git add. Marker zapisuje `release_files` i hashe; precommit sprawdza staged, a prepush bierze listę z remote/local SHA przekazanych przez Git i porównuje ją z markerem. Runner dostarcza tę listę walidatorom, bez ponownego zbierania working tree. Agent obsługuje argumenty techniczne; Grzegorz mówi „publikuj”. Różnica staged lub wysyłanego pliku względem sprawdzanej kopii zatrzymuje kontrolę; cudze staged nie są automatycznie usuwane.

Część 7: NEWS/FTPS oraz kontrola NEWS live są uruchamiane dla NEWS lub wspólnej infrastruktury, zgodnie z klasyfikatorem. Inne wydania zachowują zapisany snapshot NEWS; jego brak zgłasza NEWS_SNAPSHOT_MISSING bez połączenia FTPS. Audyt, przygotowanie JSON i wynik stagingu są związane z hashami danych, właściwego kodu, konfiguracji i parametrami; sam marker nie wystarcza. Istniejący runner zapisuje prywatne wyniki w `data/reports/local/validation-results/` i raportuje EXECUTED/REUSED. Ponownie wykorzystuje wyniki stagingu dla precommit i kontroli HTML/schema, składnię JS oraz jawnie opisane testy izolowanego mechanizmu. Pozostałe testy i kontrole sieci/Git są wykonywane, gdy są potrzebne; brak prawidłowego wyniku uruchamia właściwą kontrolę. Schema jest sprawdzana raz w technicznym stagingu dodawanego artykułu. Jawne kontrole redakcyjne pozostają osobne.


Część 8: `publikuj` zapisuje prywatny postęp w `data/reports/local/publikuj-state.json` i korzysta z dotychczasowej transakcji artykułu. Gotowy artykuł z tożsamością paczki oraz zgodnymi hashami artefaktów pomija import. Istniejący commit pozostaje do wysłania, bez tworzenia kolejnego. Proces zwykłego pusha zapisuje PID, pełny log `publikuj-push.log` i kod zakończenia; aktywny push/hook jest odbierany. Niepotwierdzony start bez PID zatrzymuje się bez uruchomienia drugiego pusha. Potwierdzenie SHA przez `ls-remote` pozwala pominąć wysyłkę już przyjętego commita. Zmiana zawartości przed commitem wymaga nowej zgody, a niedokończone wydanie nie przyjmuje nowego zakresu. Wznowienie po CDN ponawia wyłącznie kontrolę live i bezpieczeństwa, bez importu/commita/pusha; dokumentacja bez efektu publicznego kończy się po potwierdzeniu pusha. Lista URL-i i przypomnienie o ręcznym GSC są gotowe dopiero po potwierdzeniu wszystkich celów live oraz bezpieczeństwa. Nie zgłasza GSC ani IndexNow.

- Nowy artykuł lokalnie: `npm run article:add -- --file <draft.fitpo50.json>`. Jeden zbiorczy audyt techniczny JSON-u i plików → jeden staging HTML/PDF, listingów, sitemapy, indeksów i `_site` → atomowe dodanie. Treść, źródła i FAQ są odpowiedzialnością Pisarza, a obrazy i wygląd zatwierdza Grzegorz. Zwykłe dodanie nie ocenia ich ponownie ani nie pobiera źródeł w sieci.
- Publikacja dla jednej osoby: `npm run publikuj -- [katalog-artykulu]`. Agent ustala dokładne pliki artykułu i powiązanego kodu/testów/dokumentacji. Po jednym pytaniu `Publikujemy? tak/nie` następują marker, dokładny commit, zwykły push z hookiem i kontrola efektu właściwa dla zmian. Jedna lista plików służy markerowi i commitowi, a hook potwierdza rzeczywiście wysyłane zmiany i przekazuje je walidatorom. Gotowy artykuł nie jest importowany ponownie; dokumentacja bez wpływu publicznego nie wymaga CDN. Bez `git add -A`, dodatkowego `prepush:local`, powtórnej finalizacji i automatycznego IndexNow/GSC.
- Korekta JSON bez publikacji: `npm run article:prepare-json -- --file <draft.fitpo50.json>`.
- Audyt wyłącznie techniczny: `npm run package:audit -- --file <draft.fitpo50.json> --assets-dir <katalog> --profile technical`. Zwraca `TECHNICAL_READY`, `TECHNICAL_BLOCKED` albo `ENVIRONMENT_FAILURE`; gotowość dotyczy wejścia, a HTML/PDF wymagają jeszcze stagingu. Zapisuje osobny raport `.technical.json`. Bez `--profile` pozostaje dotychczasowy audyt redakcyjny.
- Gotowy artefakt `CONTENT_READY` również przekazuje się do `article:add`. Ponowne wykorzystanie wyników wymaga zgodności hashy danych, właściwego kodu, konfiguracji i parametrów; sam marker lub identyczny JSON nie wystarcza. Nazwa statusu nie jest potwierdzeniem kontroli redakcyjnej.
- Odrębna kontrola przed pushem: `npm run prepush:local`. Dobiera zadania przez istniejący `change-scope.js`; nie uruchamiaj jej dodatkowo przed normalnym hookiem `publikuj`.
- Pełny eksport i parity: `npm run check:build-export`.
- Kontrola produkcji bez zgłoszenia URL-i: `npm run deployment:verify`.
- Odrębne domknięcie wdrożenia: `npm run deployment:finalize` (live i ekspozycja bezpieczeństwa, bez IndexNow). Nie powtarzaj finalizacji już wykonanej przez kontrolowany przebieg publikacji.
- Zgłoszenie wdrożonego wydania: `npm run indexnow:release` (osobno, dopiero po udanej finalizacji).
- Zwykły deploy następuje automatycznie z `main`; `hostinger:recovery` dotyczy wyłącznie awarii.
- NEWS, w tym odczyt FTPS, sprawdzamy tylko przy zmianach NEWS lub rzeczywistym wpływie wspólnej infrastruktury. Zakres artykułu i powiązanego kodu sumuje się. Nie dobieraj całego portalu ze względu na sam katalog `scripts/` lub raport publikacji. Sprawdzian uproszczenia odbędzie się na innym artykule; błonnik jest zamknięty.

## Granice synchronizacji

- Pełny HTML i czysty eksport tworzy `scripts/export_site.sh`, wywoływany przez bramki publikacyjne.
- `assets:mirror:sync` synchronizuje PDF, NEWS i jawnie obsługiwane assety; nie naprawia HTML.
- `check:build-export` tworzy świeży eksport i porównuje każdy plik z `_site`, rozróżniając HTML, PDF, dane i assety.

## Pełny rejestr

### PUBLIC

- [PUBLIC] `npm run admin:doctor` — Bezpośrednia komenda robocza lub odczytowa (node scripts/admin-doctor.js).
- [PUBLIC] `npm run adsense:absence` — Blokuje publikację kodu AdSense i pliku `ads.txt` w źródle oraz eksporcie (node scripts/adsense-absence-check.js).
- [PUBLIC] `npm run agent:context` — Bezpośrednia komenda robocza lub odczytowa (node scripts/agent-context.js).
- [PUBLIC] `npm run aio:full-audit` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js full-audit).
- [PUBLIC] `npm run article:add` — Lokalne wejście dla artykułu. Zatwierdzony kontrakt: zbiorczy audyt techniczny, jedno przygotowanie, atomowy staging i lokalne domknięcie; stan wdrożenia profilu opisano w „Kanonicznych wejściach”.
- [PUBLIC] `npm run publikuj` — Jedno wejście publikacyjne: automatyczny zakres artykułu lub bezpiecznych zmian kodu/testów/dokumentacji, wznowienie gotowego artykułu bez reimportu, marker, jedno pytanie, dokładny commit, zwykły push i właściwa kontrola efektu; bez `git add -A`, dodatkowego `prepush:local`, `deployment:finalize` i IndexNow.
- [PUBLIC] `npm run article:cleanup-input` — Na jawne polecenie usuwa wejściową paczkę sluga wyłącznie po zapisanym `AWAITING_LIVE_CONFIRMATION` i zgodnym `LIVE_DEPLOYED_AND_VALIDATED`; nigdy nie uruchamia się automatycznie.
- [PUBLIC] `npm run package:audit` — Odczytowy audyt paczki; `--profile technical` zbiera błędy struktury JSON-u i plików bez kontroli redakcyjnej i bez zmian wejścia. Domyślny profil `editorial` zachowuje istniejące kontrole. `article:add` wybiera profil techniczny jawnie.
- [PUBLIC] `npm run article:coverage:report` — Informacyjny raport pokrycia produkcyjnego katalogu BlogPosting oraz rozdzielonych statusów preview, publikacji, walidacji, wdrożenia i GSC; nie jest bramką publikacyjną.
- [PUBLIC] `npm run article:contract:diff` — Bezpośrednia komenda robocza lub odczytowa (node scripts/run-article-contract-diff.js).
- [PUBLIC] `npm run article:evidence:verify` — Bezpośrednia komenda robocza lub odczytowa (node scripts/verify-article-evidence.js).
- [PUBLIC] `npm run article:guard:diff` — Bezpośrednia komenda robocza lub odczytowa (node scripts/run-article-guard-diff.js).
- [PUBLIC] `npm run article:prepare-json` — Wyjątkowe przygotowanie artefaktu CONTENT_READY bez publikacji.
- [PUBLIC] `npm run article:validate` — Bezpośrednia komenda robocza lub odczytowa (node scripts/validate-article-standard.js).
- [PUBLIC] `npm run assets:audit` — Bezpośrednia komenda robocza lub odczytowa (node scripts/assets-audit.js --report data/reports/assets-audit.json).
- [PUBLIC] `npm run assets:audit:apply` — Bezpośrednia komenda robocza lub odczytowa (node scripts/assets-audit.js --apply --report data/reports/assets-audit.json).
- [PUBLIC] `npm run assets:mirror:check` — Odczytowo sprawdza mirrory PDF/NEWS i wskazanych assetów.
- [PUBLIC] `npm run assets:mirror:sync` — Synchronizuje wyłącznie mirrory PDF/NEWS i innych wskazanych assetów do _site; nie eksportuje HTML.
- [PUBLIC] `npm run assets:trash:prune` — Domyślny dry-run retencji 14 dni; pokazuje kandydatów bez kasowania.
- [PUBLIC] `npm run assets:trash:prune:apply` — Jawnie usuwa wyłącznie pliki starsze niż 14 dni z chronionych katalogów assets/trash.
- [PUBLIC] `npm run assets:trash:prune:dry` — Jawny alias odczytowego dry-run retencji 14 dni.
- [PUBLIC] `npm run broken-links:crawl` — Bezpośrednia komenda robocza lub odczytowa (node scripts/broken-links-crawler.js _site).
- [PUBLIC] `npm run build` — Bezpośrednia komenda robocza lub odczytowa (npm run build:esbuild).
- [PUBLIC] `npm run build:strict` — Bezpośrednia komenda robocza lub odczytowa (npm run typecheck && npm run build:esbuild).
- [PUBLIC] `npm run check:build-export` — Buduje świeży eksport, porównuje go deterministycznie z _site i wykonuje pełne kontrole.
- [PUBLIC] `npm run check:build-export:fast` — Jak check:build-export, lecz bez crawl linków; nadal wymaga pełnej zgodności source/_site.
- [PUBLIC] `npm run content:freshness:report` — Bezpośrednia komenda robocza lub odczytowa (node scripts/content-freshness-bot.js).
- [PUBLIC] `npm run cwv:budget` — Bezpośrednia komenda robocza lub odczytowa (node scripts/cwv-performance-budget.js).
- [PUBLIC] `npm run deployment:verify` — Odczytowa kontrola wdrożonego commita, markera i kluczowych plików produkcji.
- [PUBLIC] `npm run deployment:finalize` — Domyka wdrożenie po pushu: kontrola live i kontrola ekspozycji, bez wysyłania IndexNow.
- [PUBLIC] `npm run faq:refresh:report` — Bezpośrednia komenda robocza lub odczytowa (node scripts/faq-refresh-report.js).
- [PUBLIC] `npm run fitpo50:doctor` — Bezpośrednia komenda robocza lub odczytowa (node scripts/fitpo50-doctor.js).
- [PUBLIC] `npm run external:config:check` — Sprawdza wyłącznie obecność nazw lokalnych zmiennych GSC/IndexNow; nigdy nie wypisuje wartości.
- [PUBLIC] `npm run growth:ai-visibility-test` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js ai-visibility-test).
- [PUBLIC] `npm run growth:audit-ai` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js audit-ai).
- [PUBLIC] `npm run growth:entities` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js entities).
- [PUBLIC] `npm run growth:full-audit` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js full-audit).
- [PUBLIC] `npm run growth:gsc-generative-ai` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js gsc-generative-ai).
- [PUBLIC] `npm run growth:hubs` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js hubs).
- [PUBLIC] `npm run growth:llms-check` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js llms-check).
- [PUBLIC] `npm run growth:originality-score` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js originality-score).
- [PUBLIC] `npm run growth:perplexity-monitor` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js perplexity-monitor).
- [PUBLIC] `npm run growth:quick-answer-score` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js quick-answer-score).
- [PUBLIC] `npm run growth:report` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js report).
- [PUBLIC] `npm run growth:structured-score` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js structured-score).
- [PUBLIC] `npm run growth:topical-map` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js topical-map).
- [PUBLIC] `npm run growth:verify` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js verify).
- [PUBLIC] `npm run gsc:auto` — Bezpośrednia komenda robocza lub odczytowa (node scripts/gsc-auto-report.js).
- [PUBLIC] `npm run gsc:data:check` — Bezpośrednia komenda robocza lub odczytowa (node scripts/gsc-data-contract.js).
- [PUBLIC] `npm run gsc:data:migrate-v2` — Jawnie migruje manifest GSC v1 do v2 dopiero po potwierdzeniu raportu `OK_VERIFIED/DATASET`, kompletności oraz świeżości CSV poniżej 72 godzin.
- [PUBLIC] `npm run gsc:indexing:watchdog` — Bezpośrednia komenda robocza lub odczytowa (node scripts/gsc-indexing-watchdog.js).
- [PUBLIC] `npm run gsc:post-publication` — Bezpośrednia komenda robocza lub odczytowa (node scripts/post-publication-monitor.js).
- [PUBLIC] `npm run gsc:priority-map` — Bezpośrednia komenda robocza lub odczytowa (node scripts/gsc-priority-map.js).
- [PUBLIC] `npm run gsc:weekly:api:local` — Bezpośrednia komenda robocza lub odczytowa (bash scripts/with-local-env.sh node scripts/gsc-weekly-api-report.js).
- [PUBLIC] `npm run hooks:install` — Bezpośrednia komenda robocza lub odczytowa (bash scripts/install-git-hooks.sh).
- [PUBLIC] `npm run json:gate:diff` — Bezpośrednia komenda robocza lub odczytowa (node scripts/json-fitpo50-gate-diff.js).
- [PUBLIC] `npm run json:gate:file` — Bezpośrednia komenda robocza lub odczytowa (node scripts/json-fitpo50-gate-diff.js --file "$npm_config_file").
- [PUBLIC] `npm run live:latest:check` — Bezpośrednia komenda robocza lub odczytowa (node scripts/live-latest-article-check.js --base-url https://fitpo50.pl).
- [PUBLIC] `npm run indexnow:release` — Osobno wysyła URL-e wyłącznie dla wydania z potwierdzonym live i `SECURITY_EXPOSURE_PASS`; zapisuje dowód i blokuje duplikaty.
- [PUBLIC] `npm run live:postpush:check` — Alias kontroli wdrożenia i ekspozycji (npm run deployment:finalize), bez IndexNow.
- [PUBLIC] `npm run llms:full` — Bezpośrednia komenda robocza lub odczytowa (node scripts/generate-llms-full.js).
- [PUBLIC] `npm run news:integrity` — Bezpośrednia komenda robocza lub odczytowa (node scripts/news-integrity-check.js).
- [PUBLIC] `npm run news:pull` — Pobiera wyłącznie dozwolone dane NEWS przez szyfrowany FTPS, waliduje całą paczkę i atomowo aktualizuje lokalne pliki; `--dry-run` niczego nie zapisuje.
- [PUBLIC] `npm run popraw-seo` — Tworzy raport i kolejkę SEO bez edycji HTML przed zatwierdzeniem ID.
- [PUBLIC] `npm run popraw-seo:gsc-local` — Bezpośrednia komenda robocza lub odczytowa (bash scripts/with-local-env.sh node scripts/gsc-auto-report.js).
- [PUBLIC] `npm run predeploy:check` — Bezpośrednia komenda robocza lub odczytowa (node scripts/predeploy-gate.js).
- [PUBLIC] `npm run prepush:local` — Odrębna lokalna bramka przed pushem; zatwierdzony kontrakt dobiera kontrole do rzeczywistego wpływu zmian, bez dodatkowego uruchamiania przed normalnym hookiem publikuj.
- [PUBLIC] `npm run prepush:worktree` — Bezpośrednia komenda robocza lub odczytowa (node scripts/prepush-parallel-checks.js --worktree).
- [PUBLIC] `npm run quick-answer:backlog` — Bezpośrednia komenda robocza lub odczytowa (node scripts/audit-quick-answer-backlog.js).
- [PUBLIC] `npm run reading-room:verify` — Bezpośrednia komenda robocza lub odczytowa (node scripts/reading-room-link-verifier.js --diff).
- [PUBLIC] `npm run reports:prune` — Domyślny dry-run raportów starszych niż 30 dni; pokazuje kandydatów bez kasowania.
- [PUBLIC] `npm run reports:prune:apply` — Jawnie usuwa wyłącznie nieśledzone raporty z allowlisty po ponownej kontroli Git i ścieżek; nigdy nie obejmuje aktywnego `data/reports/local/gsc-current`.
- [PUBLIC] `npm run reports:prune:dry` — Jawny alias odczytowego dry-run raportów.
- [PUBLIC] `npm run schema:validate` — Bezpośrednia komenda robocza lub odczytowa (node scripts/schema-validator.js --diff).
- [PUBLIC] `npm run seo:aeo:guard` — Bezpośrednia komenda robocza lub odczytowa (node scripts/seo-aeo-guard.js).
- [PUBLIC] `npm run seo:aio:machine` — Bezpośrednia komenda robocza lub odczytowa (node scripts/seo-aio-command-center.js).
- [PUBLIC] `npm run seo:aio:wave:proposal` — Generuje wyłącznie propozycję ze statusem AWAITING_USER_APPROVAL; nie wdraża zmian ani nie tworzy produkcyjnej kolejki GSC.
- [PUBLIC] `npm run seo:crawl` — Bezpośrednia komenda robocza lub odczytowa (node scripts/broken-links-crawler.js _site).
- [PUBLIC] `npm run session:start` — Lekki start diagnostyczny, nie jest rozpoczęciem sesji agenta i nie zastępuje odczytowej procedury z `PROJECT_MEMORY.md`.
- [PUBLIC] `npm run site:full-audit` — Bezpośrednia komenda robocza lub odczytowa (npm run check:build-export && npm run broken-links:crawl && npm run workflow:maintenance && npm run aio:full-audit).
- [PUBLIC] `npm run sitemap:lastmod:check` — Bezpośrednia komenda robocza lub odczytowa (node scripts/sync-sitemap-lastmod.js --check).
- [PUBLIC] `npm run smoke:static` — Bezpośrednia komenda robocza lub odczytowa (node scripts/static-smoke-check.js _site).
- [PUBLIC] `npm run test:article-architecture` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/article-intent-links.test.js).
- [PUBLIC] `npm run test:article-evidence` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/article-evidence.test.js).
- [PUBLIC] `npm run test:article-json-workflow` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/article-json-workflow.test.js).
- [PUBLIC] `npm run test:article-media` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/article-media.test.js).
- [PUBLIC] `npm run test:article-staging` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/article-staging.test.js).
- [PUBLIC] `npm run test:deployment-safety` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/deployment-safety.test.js).
- [PUBLIC] `npm run test:gsc:data-contract` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/gsc-data-contract.test.js tests/gsc-workflow-contract.test.js tests/gsc-full-coverage.test.js tests/gsc-generative-ai.test.js).
- [PUBLIC] `npm run test:importer-faq-research` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/import-article-faq-research.test.js).
- [PUBLIC] `npm run test:pipeline-blockers` — Testy blokad publikacji, w tym hash-bound desktop/mobile, wszystkie obrazy oraz komplet stron PDF.
- [PUBLIC] `npm run test:popraw-seo-automation` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/popraw-seo-automation.test.js tests/popraw-seo-mechanism-2.test.js tests/seo-aio-wave-autopilot.test.js).
- [PUBLIC] `npm run test:publishing-engine` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/publishing-engine.test.js).
- [PUBLIC] `npm run test:runtime-safety` — Testuje destrukcyjne komendy, workspace tymczasowe, cykl Playwright i bezpieczną równoległość.
- [PUBLIC] `npm run test:system-contract` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/pipeline-capability.test.js tests/export-parity.test.js tests/command-contract.test.js).
- [PUBLIC] `npm run tmp:cleanup` — Domyślny odczytowy dry-run bez usuwania katalogów.
- [PUBLIC] `npm run tmp:cleanup:apply` — Jawne usunięcie wyłącznie zweryfikowanych workspace’ów oznaczonych `COMPLETED`, minimum 12 godzin od `completed_at`; aktywne, oczekujące i bez daty zakończenia są chronione.
- [PUBLIC] `npm run tmp:cleanup:dry` — Bezpośrednia komenda robocza lub odczytowa (node scripts/tmp-cleanup.js --dry-run).
- [PUBLIC] `npm run typecheck` — Bezpośrednia komenda robocza lub odczytowa (tsc --noEmit --pretty false).
- [PUBLIC] `npm run visual:regression:gate` — Bezpośrednia komenda robocza lub odczytowa (node scripts/visual-regression-gate.js).
- [PUBLIC] `npm run workflow:maintenance` — Bezpośrednia komenda robocza lub odczytowa (node scripts/workflow-maintenance-check.js).

### INTERNAL

- [INTERNAL] `npm run article:architecture` — Etap pipeline’u ustalający intencję i linkowanie; wywołuje go kontroler artykułu.
- [INTERNAL] `npm run article:assets:prepare` — Etap pipeline’u przygotowujący warianty mediów; bezpośrednie użycie nie jest wejściem publikacyjnym.
- [INTERNAL] `npm run article:content-consistency:all` — Techniczny etap kontrolowanego workflow (node scripts/article-content-consistency-all.js).
- [INTERNAL] `npm run article:contract` — Techniczny etap kontrolowanego workflow (node scripts/article-contract-check.js).
- [INTERNAL] `npm run article:guard` — Techniczny etap kontrolowanego workflow (node scripts/article-publish-guard.js).
- [INTERNAL] `npm run article:head:sync` — Fragmentaryczna synchronizacja head/schema; używana wyłącznie w kontrolowanym procesie.
- [INTERNAL] `npm run article:lint:placeholders` — Techniczny etap kontrolowanego workflow (node scripts/lint-editorial-placeholders.js).
- [INTERNAL] `npm run article:media` — Etap pipeline’u budujący manifest mediów; wywołuje go kontroler artykułu.
- [INTERNAL] `npm run article:meta:set` — Fragmentaryczny fixer metadanych; używany wyłącznie w kontrolowanym procesie.
- [INTERNAL] `npm run article:meta:sync` — Fragmentaryczna synchronizacja metadanych; używana wyłącznie w kontrolowanym procesie.
- [INTERNAL] `npm run article:pdf:builder` — Techniczny etap kontrolowanego workflow (python3 scripts/article-pdf-builder.py).
- [INTERNAL] `npm run article:pdf:sync` — Techniczny etap kontrolowanego workflow (python3 scripts/sync_article_pdfs_and_buttons.py).
- [INTERNAL] `npm run article:preflight` — Techniczny etap kontrolowanego workflow (node scripts/article-preflight.js).
- [INTERNAL] `npm run article:preview:gate` — Techniczna kontrola desktop/mobile/PDF; standardowy artykuł kończy się po TECHNICAL_PASS/PREVIEW_READY bez osobnego review Codexa. Odrębny zakres redakcyjny korzysta z właściwego przebiegu.
- [INTERNAL] `npm run article:publish` — Silnik stagingu i atomowej promocji wywoływany przez `article:add`; nie jest osobnym workflow użytkownika.
- [INTERNAL] `npm run article:validate:center` — Techniczny etap kontrolowanego workflow (node scripts/validate-article.js).
- [INTERNAL] `npm run build:esbuild` — Techniczny etap kontrolowanego workflow (esbuild src/app.ts src/cmp.ts src/footer.ts src/search.ts --outdir=dist --target=es2018 --format=iife --log-level=error && esbuild src/protein-calculator.ts --bundle --outfile=dist/protein-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/phenoage-calculator.ts --bundle --outfile=dist/phenoage-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/blood-pressure-diary.ts --bundle --outfile=dist/blood-pressure-diary.js --target=es2018 --format=iife --log-level=error && esbuild src/lab-results-interpreter.ts --bundle --outfile=dist/lab-results-interpreter.js --target=es2018 --format=iife --log-level=error && esbuild src/waist-height-calculator.ts --bundle --outfile=dist/waist-height-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/walking-pace-calculator.ts --bundle --outfile=dist/walking-pace-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/relative-strength-calculator.ts --bundle --outfile=dist/relative-strength-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/lipid-markers-explainer.ts --bundle --outfile=dist/lipid-markers-explainer.js --target=es2018 --format=iife --log-level=error).
- [INTERNAL] `npm run check:site:fast` — Techniczny etap kontrolowanego workflow (npm run build && node scripts/static-smoke-check.js _site).
- [INTERNAL] `npm run command:contract:check` — Wewnętrzna bramka zgodności package.json z tym rejestrem.
- [INTERNAL] `npm run deployment:prepare` — Etap workflow push tworzący marker wydania; nie jest samodzielnym wejściem publikacyjnym.
- [INTERNAL] `npm run security:exposure:check` — Sprawdza, czy produkcja nie udostępnia plików repozytorium, konfiguracji ani kopii _site.
- [INTERNAL] `npm run eeat:citation:enhance` — Techniczny etap kontrolowanego workflow (node scripts/eeat-citation-enhancer.js).
- [INTERNAL] `npm run growth` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js).
- [INTERNAL] `npm run growth:apply` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js apply --write).
- [INTERNAL] `npm run growth:apply:dry` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js apply).
- [INTERNAL] `npm run growth:autopilot` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js autopilot).
- [INTERNAL] `npm run growth:evidence-plan` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js evidence-plan).
- [INTERNAL] `npm run growth:gsc-refresh` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js gsc-refresh).
- [INTERNAL] `npm run growth:link-assets` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js link-assets).
- [INTERNAL] `npm run growth:post-deploy-kpi` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js post-deploy-kpi).
- [INTERNAL] `npm run growth:snippet-controls` — Techniczny etap kontrolowanego workflow (node scripts/growth-tool.js snippet-controls).
- [INTERNAL] `npm run gsc:tool` — Techniczny etap kontrolowanego workflow (node scripts/gsc-tool.js).
- [INTERNAL] `npm run gsc:weekly:api` — Techniczny etap kontrolowanego workflow (node scripts/gsc-weekly-api-report.js).
- [INTERNAL] `npm run gsc:weekly:report` — Techniczny etap kontrolowanego workflow (node scripts/gsc-weekly-csv-report.js).
- [INTERNAL] `npm run interlinking:optimize` — Techniczny etap kontrolowanego workflow (node scripts/global-link-topology-optimizer.js).
- [INTERNAL] `npm run json:autofix:strict` — Techniczny etap kontrolowanego workflow (node scripts/json-autofix-strict.js).
- [INTERNAL] `npm run json:fix` — Techniczny etap kontrolowanego workflow (node scripts/fix-fitpo50-json.js).
- [INTERNAL] `npm run popraw-seo:apply` — Techniczny zapis zatwierdzonego manifestu SEO; kontrolowany workflow przekazuje argumenty bezpośrednio po `--`, np. `npm run popraw-seo:apply -- --ids "BOOST 1,NAPRAWA 2" --confirm APPLY_APPROVED_SEO`.
- [INTERNAL] `npm run popraw-seo:apply:dry` — Techniczny dry-run bez zapisu; argumenty są przekazywane bezpośrednio po `--`, np. `npm run popraw-seo:apply:dry -- --ids "BOOST 1,NAPRAWA 2"`.
- [INTERNAL] `npm run popraw-seo:live` — Techniczny etap kontrolowanego workflow (node scripts/popraw-seo-live-verify.js).
- [INTERNAL] `npm run postinstall` — Techniczny etap kontrolowanego workflow (bash scripts/install-git-hooks.sh || true).
- [INTERNAL] `npm run prepush:checks` — Techniczny etap kontrolowanego workflow (node scripts/prepush-checks.js).
- [INTERNAL] `npm run prepush:diff-guard` — Techniczny etap kontrolowanego workflow (node scripts/prepush-diff-guard.js).
- [INTERNAL] `npm run prepush:parallel:checks` — Techniczny etap kontrolowanego workflow (node scripts/prepush-parallel-checks.js).
- [INTERNAL] `npm run preview:hubs` — Techniczny etap kontrolowanego workflow (node scripts/build-preview-hubs.js).
- [INTERNAL] `npm run search:index` — Techniczny etap kontrolowanego workflow (node scripts/generate-search-index.js).
- [INTERNAL] `npm run sitemap:lastmod:sync` — Techniczny etap kontrolowanego workflow (node scripts/sync-sitemap-lastmod.js).
- [INTERNAL] `npm run topic-centers:sync` — Techniczny etap kontrolowanego workflow (node scripts/sync-topic-centers.js).
- [INTERNAL] `npm run visual:regression:update-baseline` — Techniczny etap kontrolowanego workflow (node scripts/visual-regression-gate.js --update-baseline true).

### RECOVERY

- [RECOVERY] `npm run hostinger:recovery` — Awaryjna procedura Hostingera; domyślnie dry-run i tylko dla udokumentowanej awarii.
- [RECOVERY] `npm run sync:local:safe` — Awaryjna synchronizacja lokalnego checkoutu zgodnie z jej osobnym kontraktem bezpieczeństwa.

### RETIRED

- [RETIRED] `bash scripts/push_one.sh` — Wycofana ścieżka publikacji; kod 2 bez zapisu, commita ani pusha. Obowiązuje jeden commit treści i markera oraz jeden push według SESSION_START_MAX.md.

- [RETIRED] `npm run hostinger:clean-repo` — Zablokowana historyczna komenda; zawsze odmawia wykonania.
- [RETIRED] `npm run prepush:strict` — Wycofany wariant złożony; zastąpiony przez prepush:local.
- [RETIRED] `npm run seo:aio:apply-wave` — Myląca historyczna nazwa; zawsze odmawia wykonania i wskazuje seo:aio:wave:proposal.
