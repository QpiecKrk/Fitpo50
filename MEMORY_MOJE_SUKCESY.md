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
  - czy `const userEntries` nie jest puste w `moje-sukcesy.html`,
  - czy sync zapisuje do wlasciwego `SITE_ROOT`.
- Utrzymujemy narzedzie diagnostyczne `admin/sync-manual.php` do recznego wymuszenia synchronizacji i podgladu liczby dni.

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

## Granice modulow

- Nie mieszamy logiki `Porady` i `Moje Sukcesy`.
- Zmiany w jednym module nie moga psuc drugiego.
