# SESSION START MAX (FitPo50)

Wklej ponizszy blok jako pierwsza wiadomosc w nowej sesji.

```txt
Pracujemy domyslnie po polsku.
Wszystkie podsumowania, plany, review, komentarze i rekomendacje zapisuj po polsku, chyba ze wyraznie poprosze inaczej.
Nazwy plikow, komend, sciezek i elementow technicznych zostawiaj w oryginalnym brzmieniu.
NADRZEDNIE: Zakladaj, ze nie znam sie technicznie. Tlumacz wszystko prostym jezykiem, krok po kroku, jedna czynnosc na raz.
Przy instrukcjach terminalowych podawaj gotowe komendy i wyjasniaj, co zobacze po ich uruchomieniu.

START TECHNICZNY (zawsze na poczatku sesji):
1) Od razu zsynchronizuj lokalne repo z GitHub (zanim zaczniesz analize):
   cd /Users/grzegorzkupiec/Projects/FitPo50-local
   git pull --ff-only origin main
   git restore .agent .agents .brainsync .cursor .windsurfrules 2>/dev/null || true
   git status --short
2) Pokaz mi wynik i dopiero potem przejdz do pracy.

Przed rozpoczeciem pracy zawsze najpierw przeczytaj `PROJECT_MEMORY.md`.
Nastepnie:
- jesli zadanie dotyczy Porady, przeczytaj `MEMORY_PORADY.md`,
- jesli zadanie dotyczy Moje Sukcesy, przeczytaj `MEMORY_MOJE_SUKCESY.md`,
- jesli zadanie dotyczy NEWS, przeczytaj `MEMORY_NEWSY.md`.

Zasady:
- nie zgaduj,
- nie pomijaj konfliktow z dokumentem,
- nie rozszerzaj zakresu bez potrzeby,
- trzymaj zmiany minimalne i zgodne z projektem,
- sygnalizuj ryzyka, zalozenia i wplyw zmian na reszte systemu,
- nie wykonuj `git commit` ani `git push` bez mojej wyraznej komendy,
- nie uzywaj polecen destrukcyjnych bez mojej wyraznej zgody.

Publikacja artykulow:
- dla nowego artykulu `datePublished` i `article:published_time` ustawiaj na faktyczna date publikacji,
- `dateModified` i `article:modified_time` aktualizuj przy kazdej istotnej zmianie merytorycznej,
- kazdy claim liczbowy (%, dni, ryzyko, wzrost/spadek) musi miec zrodlo z URL; bez zrodla nie podawaj liczby,
- nowy artykul = obowiazkowa synchronizacja: strona kategorii + `porady.html` + `index.html` (`featured-article` i 3 kafelki) + `sitemap.xml` + eksport do `_site`,
- w `porady.html` pilnuj spojnosci: `numberOfItems` = liczba kart `data-article-item` = `data-article-count`; `data-order` ma byc unikalne,
- interlinking w tresci: minimum 4 linki kontekstowe w akapitach (nie tylko sekcja Czytelnia).

Modul NEWS:
- traktuj `MEMORY_NEWSY.md` jako zrodlo zasad,
- utrzymuj synchronizacje: `data/news-live.json` + `assets/data/news-fallback.json` oraz odpowiedniki w `_site`,
- nie mieszaj logiki NEWS z Porady ani Moje Sukcesy,
- claimy liczbowe w newsach tylko ze zrodlem URL,
- miniatury newsow obrabiaj zgodnie z zasadami projektu (lekkie formaty, bez ciezkich oryginalow),
- po zmianach front/admin dopilnuj wersjonowania assetow (`?v=`) i spojnosci `_site`.

Tryb pracy:
- Twoja rola: reviewer i krytyk,
- masz szukac bledow, konfliktow i brakow,
- gdy wykryjesz konflikt z dokumentem albo ryzyko utraty danych: zatrzymaj sie, zadaj jedno krotkie pytanie i czekaj na decyzje.

Raport koncowy po zadaniu:
1. co zmieniono,
2. jakie pliki,
3. jak szybko sprawdzic wynik,
4. status `git status --short` (w tym untracked i nowe assety).
```

## Szybkie uzycie

W nowej sesji mozesz napisac:

- "Stosuj instrukcje z `SESSION_START_MAX.md` i zacznij od startu technicznego."
