# Memory NEWSY

## Zakres modułu
- Moduł `NEWS` dotyczy wyłącznie sekcji szybkich newsów na `index.html` (kotwica `#news`) oraz panelu admin dla newsów.
- Logika NEWS jest oddzielona od modułów `Porady` i `Moje Sukcesy`.
- Nie mieszamy tabel/biznes-logiki `entries/media` z danymi newsów.

## Architektura danych
- Dane live: `data/news-live.json`.
- Fallback front/SEO warstwy sekcji: `assets/data/news-fallback.json`.
- Backupy danych newsów: `data/news-backups/`.
- Miniatury newsów: `assets/news/` (`.avif`, `.webp`, `.jpg`).

## Panel admin NEWS
- Dostęp pod tym samym logowaniem co obecny panel.
- Podstawowe operacje: dodaj/edytuj/usuń/news status (`draft`/`published`).
- Edytor treści ma wspierać tylko:
  - `bold`,
  - `italic`,
  - 4 presety koloru,
  - link wewnętrzny (do istniejących artykułów).
- Zewnętrzne URL-e podajemy wyłącznie w sekcji `Źródła`.

## Miniatury i media
- Po uploadzie miniatura jest automatycznie konwertowana do lekkich plików (`.avif`, `.webp`, `.jpg`).
- Oryginał uploadu nie jest trzymany.
- Jeżeli konwersja się nie powiedzie, zapis/publikacja newsa ma zostać zablokowana z błędem.
- Obraz na karcie newsa nie otwiera lightboxa i nie jest klikalny.

## Frontend sekcji NEWS
- Stała szerokość kontenera zgodna z layoutem strony.
- Feed pionowy, przewijany wewnątrz kontenera.
- Karty newsów:
  - pełna szerokość kontenera,
  - wysokość zależna od treści,
  - miniatura o stałych proporcjach,
  - naprzemienne, bardzo delikatne tła: pastelowa zieleń / pastelowy niebieski.
- Brak kategorii i brak wyróżnionego newsa.
- Klikalne są wyłącznie linki w treści i źródłach.

## SEO / AEO / GEO / AIO
- Newsy muszą być czytelne semantycznie i mieć crawlowalne linki.
- Claimy liczbowe publikujemy wyłącznie ze źródłem URL.
- W module utrzymujemy podejście hybrydowe:
  - live feed z panelu,
  - fallback JSON dla warstwy statycznej sekcji.

## Operacyjne
- Nie wykonujemy `git commit` ani `git push` bez wyraźnej komendy użytkownika.
- Po zmianach frontowych pamiętamy o aktualizacji `_site` przez eksport.
