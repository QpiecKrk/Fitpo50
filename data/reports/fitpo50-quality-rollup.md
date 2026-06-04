# FitPo50 Quality Rollup

- Wygenerowano: 2026-06-04 10:53 CEST
- Zakres: SEO crawl + SEO/AEO guard + quick answers + FAQ refresh + content freshness + CWV budget + predeploy gate
- Status końcowy: **PASS**

## Podsumowanie

| Obszar | Status | Wynik |
|---|---|---|
| SEO crawl | PASS | 88 HTML, broken links: 0, canonical errors: 0, duplicate titles: 0, duplicate descriptions: 0, orphan pages: 0 |
| SEO/AEO guard | PASS | 76 artykułów sprawdzonych, brak błędów blokujących |
| Quick answers | PASS | fail: 0, fixed/OK: 76 |
| FAQ refresh | PASS | 76 artykułów, stale FAQ: 0, low FAQ count: 0 |
| Content freshness | PASS | critical: 0, stale: 0, unknown: 0, needsRefreshNow: 0 |
| CWV budget | PASS | 20 URL-i, fail: 0, warn: 0 |
| Predeploy gate | PASS | brak błędów blokujących |

## Wdrożone poprawki P0/P1

- P0: brak problemów do naprawy.
- P1: poprawiono `scripts/broken-links-crawler.js`, żeby nie raportował jako orphan stron technicznych `noindex`, przekierowań i plików weryfikacji Google.
- P1: poprawiono `scripts/faq-refresh-report.js`, żeby nie liczył `article-template-bento.html` jako opublikowanego artykułu.
- P1: poprawiono `scripts/content-freshness-bot.js`, żeby nie liczył `article-template-bento.html` jako opublikowanego artykułu.

## Finalne raporty źródłowe

- `data/reports/seo-crawl-report.md`
- `data/reports/seo-crawl-report.json`
- `data/reports/cwv-budget.md`
- `data/reports/cwv-budget.json`
- `data/reports/quick-answer-backlog.md`
- `data/reports/quick-answer-backlog.json`
- `data/reports/faq-refresh-report.json`
- `data/reports/content-freshness-report.json`
