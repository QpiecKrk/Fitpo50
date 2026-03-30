# FitPo50 Memory - MOJE SUKCESY

Ten plik dotyczy tylko modulu "Moje Sukcesy" (kalendarz + strony dnia).

## Zakres

- Dotyczy:
  - `moje-sukcesy.html`,
  - generowania `sukcesy/YYYY-MM-DD.html`,
  - logiki admina odpowiedzialnej za publikacje dnia i synchronizacje kalendarza.
- Nie dotyczy klasycznych artykulow "Porady".

## Zasada produktu

- "Dzien" traktujemy jako finalna strone zbiorcza.
- Klik fistaszka prowadzi do strony dnia (`/sukcesy/YYYY-MM-DD.html`).
- Na stronie dnia wpisy sa jeden pod drugim i czytelnie oddzielone separatorem.
- Uzytkownik nie powinien byc zmuszany do drugiego kliku tylko po to, by zobaczyc tresc dnia.

## Kalendarz i synchronizacja

- Blok wpisow w `moje-sukcesy.html` utrzymujemy przez markery:
  - `// ENTRIES_START`
  - `// ENTRIES_END`
- Aktualizacja listy dni powinna byc oparta o bezpieczny `json_encode`, bez "kruchych" regexow ingerujacych w JS.
- Przy publikacji/wycofaniu/usunieciu wpisu zawsze odswiezamy:
  - strone dnia,
  - kalendarz.
- Gdy fistaszki znikaja mimo wpisow `published`, najpierw sprawdzamy:
  - czy `let userEntries` nie jest puste w `moje-sukcesy.html`,
  - czy `calendar-entries.json` zawiera aktualne dni,
  - czy sync zapisuje do wlasciwego `SITE_ROOT`.
- Utrzymujemy narzedzie diagnostyczne `admin/sync-manual.php` do recznego wymuszenia synchronizacji i podgladu liczby dni.
- `sync-manual.php` wykonuje synchronizacje tylko przez `POST + CSRF`.
- `sync-manual.php` ma raportowac osobno:
  - liczbe dni w kalendarzu,
  - liczbe wpisow `/sukcesy/` w `sitemap.xml`,
  - i alarmowac niespojnosc (`published > 0`, a kalendarz pusty).
- `calendarRebuild()` ma byc odporny na awarie zapisu:
  - atomowy zapis (`.tmp` + `rename`),
  - walidacja pliku po zapisie,
  - twardy blad przy probie zapisu pustego kalendarza, gdy sa wpisy `published`.
- Fallback self-heal:
  - glownym zrodlem dni jest `calendar-entries.json` (same-origin, bez CORS),
  - gdy JSON jest pusty/niedostepny, `moje-sukcesy.html` pobiera dane z `admin/api/calendar-entries.php`,
  - API zwraca tylko dane read-only (`date`, `url`) dla opublikowanych dni.

## Strony dnia (`sukcesy/`)

- Assety musza uzywac sciezek, ktore dzialaja z podkatalogu `sukcesy/`:
  - preferuj URL oparte o `SITE_URL` zamiast relatywnych `./...`.
- Strona dnia ma byc spojna wizualnie z serwisem i poprawna na mobile/Safari.
- Logika mediow we wpisie:
  - `0` zdjec: brak sekcji mediow,
  - `1` zdjecie: statyczny hero,
  - `2+` zdjec: karuzela nad trescia.
- W karuzeli:
  - zdjecia maja byc widoczne w calosci (`contain`, bez cropa),
  - na mobile dzialaja swipe + strzalki + kropki,
  - kropki maja byc czytelne na jasnych i ciemnych kadrach.
- Dla kompatybilnosci przegladarek i CORS:
  - obrazy na stronach dnia i w artykulach ladowane z `https://fitpo50.pl/admin/uploads/...`,
  - fallback `onerror` na `https://admin.fitpo50.pl/uploads/...`.
- Dla mobile landscape:
  - karuzela ma byc nizsza (`21/9`, `max-height: 65vh`),
  - kontrolki mniejsze, bez zmiany logiki JS.
- Dla `day-list` wpisy dnia utrzymujemy kompaktowo (mniejsze odstepy miedzy wpisami niz w standardowym artykule).

## Testy po zmianach

- Po kazdej zmianie w module sprawdz:
  - czy fistaszek otwiera poprawna strone dnia,
  - czy wpisy dnia sa kompletne i oddzielone wizualnie,
  - czy CSS/JS na `sukcesy/YYYY-MM-DD.html` laduja sie bez 404,
  - czy kalendarz dalej renderuje miesiace i nawigacje.
- Dodatkowo dla karuzeli:
  - pionowe i poziome zdjecia nie sa obcinane,
  - nawigacja (strzalki, kropki, swipe) dziala na telefonie,
  - wiele karuzel na jednej stronie dnia dziala niezaleznie.
- Dodatkowo dla synchronizacji:
  - po `sync-manual.php` sprawdzamy, czy `sitemap.xml` zawiera `/sukcesy/YYYY-MM-DD.html`,
  - po publikacji/wycofaniu/usunieciu wpisu sprawdzamy, czy liczba dni w kalendarzu i sitemapie jest spojna.

## Granice modulow

- Nie mieszamy logiki `Porady` i `Moje Sukcesy`.
- Zmiany w jednym module nie moga psuc drugiego.
