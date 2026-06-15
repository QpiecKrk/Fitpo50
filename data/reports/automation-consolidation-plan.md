# FitPo50 — plan konsolidacji automatyzacji

Data: 2026-06-15

## Nowe centra sterowania

- `scripts/validate-article.js` — wspolny punkt wejscia dla walidacji artykulow.
- `scripts/sync-article-metadata.js` — wspolny punkt wejscia dla metadanych artykulu.
- `scripts/article-manager.js` — wspolny punkt wejscia dla importu/tworzenia/preflight JSON.
- `scripts/article-pdf-builder.py` — wspolny punkt wejscia dla PDF.
- `scripts/prepush-checks.js` — wspolny punkt wejscia dla prepush/predeploy.
- `scripts/gsc-tool.js` — wspolny punkt wejscia dla GSC/SEO.

## Zasada przejscia

Stare skrypty zostaja jako aliasy kompatybilnosci do czasu kilku poprawnych publikacji i pushy.
Nie usuwamy ich w tym samym kroku, zeby nie zerwac ukrytych zaleznosci w `package.json`, pipeline i dokumentacji.

## Przypomnienie o sprzataniu

- Plik przypomnienia: `data/reports/automation-migration-reminder.json`.
- Data przegladu: 2026-06-29.
- Data docelowego sprzatania: 2026-07-06.
- Warunek praktyczny przed usuwaniem: minimum 3 poprawne publikacje artykulu, 3 poprawne `git push` i 2 poprawne przebiegi GSC przez nowe centra sterowania.
- `npm run fitpo50:doctor` ma przypominac o przegladzie po dacie `review_after` i o sprzataniu po dacie `cleanup_after`.

## Kandydaci do pozniejszego usuniecia albo zamiany na aliasy

- Walidacja: `seo-aeo-guard.js`, `article-publish-guard.js`, `article-fast-gate.js`, `article-final-check.js`.
- Metadata: `sync-article-title-breadcrumb.js`, `sync-article-head-descriptions.js`, `article-meta-set.js`, `date-modified-guard.js`.
- Import: `create-article-from-template.js`, `article-preflight.js`, `fix-fitpo50-json.js`, `json-autofix-strict.js`.
- PDF: `generate_article_pdf.py`, `sync_article_pdfs_and_buttons.py`.
- Prepush: `run-all-prepush.js`, `prepush-parallel-checks.js`, `prepush-diff-guard.js`, `predeploy-gate.js`.
- GSC: `seo-aio-command-center.js`, `seo-aio-wave-autopilot.js`, `gsc-auto-report.js`, `gsc-indexing-watchdog.js`, `gsc-priority-map.js`, `gsc-weekly-api-report.js`, `gsc-weekly-csv-report.js`.

## Komendy kontrolne dla agenta

```bash
node --check scripts/validate-article.js scripts/sync-article-metadata.js scripts/article-manager.js scripts/prepush-checks.js scripts/gsc-tool.js
python3 -m py_compile scripts/article-pdf-builder.py
node scripts/validate-article.js --help
node scripts/sync-article-metadata.js --help
node scripts/article-manager.js --help
node scripts/prepush-checks.js --help
node scripts/gsc-tool.js --help
python3 scripts/article-pdf-builder.py --help
npm run fitpo50:doctor
```

## Status kontroli

- `node --check` dla nowych centrów JS: PASS.
- `python3 -m py_compile` dla `article-pdf-builder.py`: PASS z `PYTHONPYCACHEPREFIX=/tmp/fitpo50-pycache`.
- Tryby `--help` dla nowych centrów: PASS.
- Skróty `npm run ... -- --help` dla nowych centrów: PASS.
- `npm run fitpo50:doctor`: YELLOW tylko dlatego, ze sa robocze zmiany w repo; gate techniczne w raporcie doctor sa PASS.
