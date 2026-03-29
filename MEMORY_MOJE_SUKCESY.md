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

## Strony dnia (`sukcesy/`)

- Assety musza uzywac sciezek, ktore dzialaja z podkatalogu `sukcesy/`:
  - preferuj URL oparte o `SITE_URL` zamiast relatywnych `./...`.
- Strona dnia ma byc spojna wizualnie z serwisem i poprawna na mobile/Safari.

## Testy po zmianach

- Po kazdej zmianie w module sprawdz:
  - czy fistaszek otwiera poprawna strone dnia,
  - czy wpisy dnia sa kompletne i oddzielone wizualnie,
  - czy CSS/JS na `sukcesy/YYYY-MM-DD.html` laduja sie bez 404,
  - czy kalendarz dalej renderuje miesiace i nawigacje.

## Granice modulow

- Nie mieszamy logiki `Porady` i `Moje Sukcesy`.
- Zmiany w jednym module nie moga psuc drugiego.
