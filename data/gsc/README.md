# GSC CSV — format techniczny

Produkcyjny katalog roboczy znajduje się poza repozytorium: `~/Downloads/gsc-auto-input`. Kanoniczny zestaw 90-dniowy zawiera:

1. `Queries` (zapytania): kolumny `query, clicks, impressions, ctr, position`
2. `Pages` (strony): kolumny `page, clicks, impressions, ctr, position`
3. `Queries + Pages` (mapowanie): kolumny `query, page, clicks, impressions, ctr, position`

4. `gsc-data-manifest.json`: data generacji, property, zakresy 7/28/90, liczby wierszy, SHA-256 i diagnostyka paginacji.

Luźne CSV bez manifestu nie są akceptowane. Nie wolno kopiować raportu stron jako `query-pages.csv`. Oba aliasy `query-pages.csv` i `query_pages.csv`, jeśli istnieją równolegle, muszą mieć identyczną zawartość.

Generowanie raportu:

```bash
npm run gsc:data:check -- --input-dir ~/Downloads/gsc-auto-input
npm run gsc:auto
```

Kontrakt blokuje raport, jeśli dane mają ponad 72 godziny, końcowa data zakresu jest starsza niż 3 dni, pliki nie pochodzą z jednego cohortu albo okna 7/28/90 są niespójne.

## Pelny automat (bez CSV) - GSC API

Dostepny jest tez raport API (bez recznego eksportu):

```bash
npm run gsc:weekly:api
```

Wymagane zmienne srodowiskowe / sekrety:
- `GSC_SITE_URL` - np. `sc-domain:fitpo50.pl` lub `https://fitpo50.pl/`

Tryb A (service account):
- `GSC_SERVICE_ACCOUNT_JSON_B64` - caly JSON klucza service account zakodowany base64

Tryb B (OAuth refresh token, gdy GSC nie przyjmuje service account):
- `GSC_OAUTH_CLIENT_ID`
- `GSC_OAUTH_CLIENT_SECRET`
- `GSC_OAUTH_REFRESH_TOKEN`

W GitHub Actions:
- workflow: `.github/workflows/gsc-weekly-reminder.yml`
- cron: poniedzialek 06:00 UTC
- output: aktualizacja issue `SEO/AEO: Poniedzialkowy raport GSC`

Wazne:
- dla Trybu A: service account musi byc dodany w Google Search Console jako uzytkownik z uprawnieniem `Read`.
- dla Trybu B: konto Google, ktore wygenerowalo refresh token, musi miec co najmniej `Read` w GSC.
- warstwa property pokazuje wynik całej usługi; warstwa pages odpowiada za URL-e, a ujawnione query pozostają niepełne z powodu anonimizacji.
- osiągnięcie limitu 50 000 wierszy jest raportowane jako ostrzeżenie o możliwym ucięciu, nie jako pełna tabela zapytań.
