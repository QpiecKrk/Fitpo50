# FitPo50 Command Registry

Ten plik jest kanonicznym rejestrem komend `package.json`. Każda komenda ma dokładnie jeden status sprawdzany przez `npm run command:contract:check`.

## Znaczenie statusów

- `PUBLIC` — bezpieczne, udokumentowane wejście, które można uruchomić bezpośrednio.
- `INTERNAL` — etap wywoływany przez kontroler lub bramkę; nie jest samodzielnym workflow.
- `RECOVERY` — procedura tylko dla opisanej awarii i z jej dodatkowymi zabezpieczeniami.
- `RETIRED` — komenda historyczna zablokowana albo zastąpiona.

## Kanoniczne wejścia

- Nowy artykuł: `npm run article:add -- --file <draft.fitpo50.json>`.
- Korekta JSON bez publikacji: `npm run article:prepare-json -- --file <draft.fitpo50.json>`.
- Wznowienie gotowego artefaktu: `npm run article:publish -- --file <CONTENT_READY.fitpo50.json>`; po `VISUAL_REVIEW_PENDING` kontroler podaje wariant z `--promote-stage <zarządzany-staging>` do wznowienia tej samej transakcji.
- Pełna bramka przed pushem: `npm run prepush:local`.
- Pełny eksport i parity: `npm run check:build-export`.
- Kontrola produkcji: `npm run deployment:verify`.
- Zwykły deploy następuje automatycznie z `main`; `hostinger:recovery` dotyczy wyłącznie awarii.

## Granice synchronizacji

- Pełny HTML i czysty eksport tworzy `scripts/export_site.sh`, wywoływany przez bramki publikacyjne.
- `assets:mirror:sync` synchronizuje PDF, NEWS i jawnie obsługiwane assety; nie naprawia HTML.
- `check:build-export` tworzy świeży eksport i porównuje każdy plik z `_site`, rozróżniając HTML, PDF, dane i assety.

## Pełny rejestr

### PUBLIC

- [PUBLIC] `npm run admin:doctor` — Bezpośrednia komenda robocza lub odczytowa (node scripts/admin-doctor.js).
- [PUBLIC] `npm run adsense:readiness` — Bezpośrednia komenda robocza lub odczytowa (node scripts/adsense-readiness-check.js).
- [PUBLIC] `npm run agent:context` — Bezpośrednia komenda robocza lub odczytowa (node scripts/agent-context.js).
- [PUBLIC] `npm run aio:full-audit` — Bezpośrednia komenda robocza lub odczytowa (node scripts/growth-tool.js full-audit).
- [PUBLIC] `npm run article:add` — Jedyne domyślne wejście dla nowego artykułu; przygotowuje draft i prowadzi pełną publikację atomową.
- [PUBLIC] `npm run article:coverage:report` — Informacyjny raport pokrycia produkcyjnego katalogu BlogPosting oraz rozdzielonych statusów preview, publikacji, walidacji, wdrożenia i GSC; nie jest bramką publikacyjną.
- [PUBLIC] `npm run article:contract:diff` — Bezpośrednia komenda robocza lub odczytowa (node scripts/run-article-contract-diff.js).
- [PUBLIC] `npm run article:evidence:verify` — Bezpośrednia komenda robocza lub odczytowa (node scripts/verify-article-evidence.js).
- [PUBLIC] `npm run article:guard:diff` — Bezpośrednia komenda robocza lub odczytowa (node scripts/run-article-guard-diff.js).
- [PUBLIC] `npm run article:prepare-json` — Wyjątkowe przygotowanie artefaktu CONTENT_READY bez publikacji.
- [PUBLIC] `npm run article:publish` — Publikacja CONTENT_READY przez izolowany staging; po rzeczywistym review wznawia tę samą transakcję przez podane przez kontroler `--promote-stage`.
- [PUBLIC] `npm run article:validate` — Bezpośrednia komenda robocza lub odczytowa (node scripts/validate-article-standard.js).
- [PUBLIC] `npm run assets:audit` — Bezpośrednia komenda robocza lub odczytowa (node scripts/assets-audit.js --report data/reports/assets-audit.json).
- [PUBLIC] `npm run assets:audit:apply` — Bezpośrednia komenda robocza lub odczytowa (node scripts/assets-audit.js --apply --report data/reports/assets-audit.json).
- [PUBLIC] `npm run assets:mirror:check` — Odczytowo sprawdza mirrory PDF/NEWS i wskazanych assetów.
- [PUBLIC] `npm run assets:mirror:sync` — Synchronizuje wyłącznie mirrory PDF/NEWS i innych wskazanych assetów do _site; nie eksportuje HTML.
- [PUBLIC] `npm run assets:trash:prune` — Bezpośrednia komenda robocza lub odczytowa (node scripts/assets-trash-retention.js --days 14).
- [PUBLIC] `npm run assets:trash:prune:dry` — Bezpośrednia komenda robocza lub odczytowa (node scripts/assets-trash-retention.js --days 14 --dry-run).
- [PUBLIC] `npm run broken-links:crawl` — Bezpośrednia komenda robocza lub odczytowa (node scripts/broken-links-crawler.js _site).
- [PUBLIC] `npm run build` — Bezpośrednia komenda robocza lub odczytowa (npm run build:esbuild).
- [PUBLIC] `npm run build:strict` — Bezpośrednia komenda robocza lub odczytowa (npm run typecheck && npm run build:esbuild).
- [PUBLIC] `npm run check:build-export` — Buduje świeży eksport, porównuje go deterministycznie z _site i wykonuje pełne kontrole.
- [PUBLIC] `npm run check:build-export:fast` — Jak check:build-export, lecz bez crawl linków; nadal wymaga pełnej zgodności source/_site.
- [PUBLIC] `npm run content:freshness:report` — Bezpośrednia komenda robocza lub odczytowa (node scripts/content-freshness-bot.js).
- [PUBLIC] `npm run cwv:budget` — Bezpośrednia komenda robocza lub odczytowa (node scripts/cwv-performance-budget.js).
- [PUBLIC] `npm run deployment:verify` — Odczytowa kontrola wdrożonego commita, markera i kluczowych plików produkcji.
- [PUBLIC] `npm run dev:article` — Bezpośrednia komenda robocza lub odczytowa (node scripts/dev-article-watch.js).
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
- [PUBLIC] `npm run gsc:indexing:watchdog` — Bezpośrednia komenda robocza lub odczytowa (node scripts/gsc-indexing-watchdog.js).
- [PUBLIC] `npm run gsc:post-publication` — Bezpośrednia komenda robocza lub odczytowa (node scripts/post-publication-monitor.js).
- [PUBLIC] `npm run gsc:priority-map` — Bezpośrednia komenda robocza lub odczytowa (node scripts/gsc-priority-map.js).
- [PUBLIC] `npm run gsc:weekly:api:local` — Bezpośrednia komenda robocza lub odczytowa (bash scripts/with-local-env.sh node scripts/gsc-weekly-api-report.js).
- [PUBLIC] `npm run hooks:install` — Bezpośrednia komenda robocza lub odczytowa (bash scripts/install-git-hooks.sh).
- [PUBLIC] `npm run json:gate:diff` — Bezpośrednia komenda robocza lub odczytowa (node scripts/json-fitpo50-gate-diff.js).
- [PUBLIC] `npm run json:gate:file` — Bezpośrednia komenda robocza lub odczytowa (node scripts/json-fitpo50-gate-diff.js --file "$npm_config_file").
- [PUBLIC] `npm run live:latest:check` — Bezpośrednia komenda robocza lub odczytowa (node scripts/live-latest-article-check.js --base-url https://fitpo50.pl).
- [PUBLIC] `npm run live:postpush:check` — Bezpośrednia komenda robocza lub odczytowa (npm run deployment:verify).
- [PUBLIC] `npm run llms:full` — Bezpośrednia komenda robocza lub odczytowa (node scripts/generate-llms-full.js).
- [PUBLIC] `npm run news:integrity` — Bezpośrednia komenda robocza lub odczytowa (node scripts/news-integrity-check.js).
- [PUBLIC] `npm run popraw-seo` — Tworzy raport i kolejkę SEO bez edycji HTML przed zatwierdzeniem ID.
- [PUBLIC] `npm run popraw-seo:gsc-local` — Bezpośrednia komenda robocza lub odczytowa (bash scripts/with-local-env.sh node scripts/gsc-auto-report.js).
- [PUBLIC] `npm run predeploy:check` — Bezpośrednia komenda robocza lub odczytowa (node scripts/predeploy-gate.js).
- [PUBLIC] `npm run prepush:local` — Kanoniczna pełna lokalna bramka przed pushem.
- [PUBLIC] `npm run prepush:worktree` — Bezpośrednia komenda robocza lub odczytowa (node scripts/prepush-parallel-checks.js --worktree).
- [PUBLIC] `npm run quick-answer:backlog` — Bezpośrednia komenda robocza lub odczytowa (node scripts/audit-quick-answer-backlog.js).
- [PUBLIC] `npm run reading-room:verify` — Bezpośrednia komenda robocza lub odczytowa (node scripts/reading-room-link-verifier.js --diff).
- [PUBLIC] `npm run reports:prune` — Bezpośrednia komenda robocza lub odczytowa (node scripts/reports-prune.js).
- [PUBLIC] `npm run reports:prune:dry` — Bezpośrednia komenda robocza lub odczytowa (node scripts/reports-prune.js --dry-run).
- [PUBLIC] `npm run schema:validate` — Bezpośrednia komenda robocza lub odczytowa (node scripts/schema-validator.js --diff).
- [PUBLIC] `npm run seo:aeo:guard` — Bezpośrednia komenda robocza lub odczytowa (node scripts/seo-aeo-guard.js).
- [PUBLIC] `npm run seo:aio:apply-wave` — Bezpośrednia komenda robocza lub odczytowa (node scripts/seo-aio-wave-autopilot.js).
- [PUBLIC] `npm run seo:aio:machine` — Bezpośrednia komenda robocza lub odczytowa (node scripts/seo-aio-command-center.js).
- [PUBLIC] `npm run seo:crawl` — Bezpośrednia komenda robocza lub odczytowa (node scripts/broken-links-crawler.js _site).
- [PUBLIC] `npm run session:start` — Lekki start diagnostyczny sesji: kontekst i doctor.
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
- [PUBLIC] `npm run test:runtime-safety` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/temp-workspace.test.js tests/playwright-lifecycle.test.js tests/prepush-concurrency.test.js).
- [PUBLIC] `npm run test:system-contract` — Bezpośrednia komenda robocza lub odczytowa (node --test tests/pipeline-capability.test.js tests/export-parity.test.js tests/command-contract.test.js).
- [PUBLIC] `npm run tmp:cleanup` — Domyślny odczytowy dry-run bez usuwania katalogów.
- [PUBLIC] `npm run tmp:cleanup:apply` — Jawne usunięcie wyłącznie zweryfikowanych, osieroconych workspace’ów.
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
- [INTERNAL] `npm run article:preview:gate` — Wspólny etap preview v3: generuje TECHNICAL_PASS/VISUAL_REVIEW_PENDING, a z jawnym plikiem review potwierdza VISUAL_REVIEW_VERIFIED/PREVIEW_READY.
- [INTERNAL] `npm run article:validate:center` — Techniczny etap kontrolowanego workflow (node scripts/validate-article.js).
- [INTERNAL] `npm run build:esbuild` — Techniczny etap kontrolowanego workflow (esbuild src/app.ts src/cmp.ts src/footer.ts src/search.ts --outdir=dist --target=es2018 --format=iife --log-level=error && esbuild src/protein-calculator.ts --bundle --outfile=dist/protein-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/phenoage-calculator.ts --bundle --outfile=dist/phenoage-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/blood-pressure-diary.ts --bundle --outfile=dist/blood-pressure-diary.js --target=es2018 --format=iife --log-level=error && esbuild src/lab-results-interpreter.ts --bundle --outfile=dist/lab-results-interpreter.js --target=es2018 --format=iife --log-level=error && esbuild src/waist-height-calculator.ts --bundle --outfile=dist/waist-height-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/walking-pace-calculator.ts --bundle --outfile=dist/walking-pace-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/relative-strength-calculator.ts --bundle --outfile=dist/relative-strength-calculator.js --target=es2018 --format=iife --log-level=error && esbuild src/lipid-markers-explainer.ts --bundle --outfile=dist/lipid-markers-explainer.js --target=es2018 --format=iife --log-level=error).
- [INTERNAL] `npm run check:site:fast` — Techniczny etap kontrolowanego workflow (npm run build && node scripts/static-smoke-check.js _site).
- [INTERNAL] `npm run command:contract:check` — Wewnętrzna bramka zgodności package.json z tym rejestrem.
- [INTERNAL] `npm run deployment:prepare` — Etap workflow push tworzący marker wydania; nie jest samodzielnym wejściem publikacyjnym.
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

- [RETIRED] `npm run hostinger:clean-repo` — Zablokowana historyczna komenda; zawsze odmawia wykonania.
- [RETIRED] `npm run prepush:strict` — Wycofany wariant złożony; zastąpiony przez prepush:local.
