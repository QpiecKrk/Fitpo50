# GSC CSV Inbox

Wrzuć tutaj cotygodniowe eksporty CSV z Google Search Console (zakres 28 dni):

1. `Queries` (zapytania): kolumny `query, clicks, impressions, ctr, position`
2. `Pages` (strony): kolumny `page, clicks, impressions, ctr, position`
3. `Queries + Pages` (mapowanie): kolumny `query, page, clicks, impressions, ctr, position`

Format plików:
- Akceptowane nazwy dowolne, byle `.csv`.
- Skrypt sam wykrywa typ po nagłówkach (EN/PL) i bierze **najnowszy** plik dla każdego typu.

Generowanie raportu:

```bash
npm run gsc:weekly:report
```

Wynik:
- `data/reports/gsc-weekly-report.json`
- `data/reports/gsc-weekly-report.md`

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
