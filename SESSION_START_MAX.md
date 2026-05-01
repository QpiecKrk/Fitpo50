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
2) Jesli `git pull` zatrzyma sie przez konflikt "untracked files would be overwritten" (zwykle `assets/news/news_20*`):
   BACKUP_TMP="/tmp/fitpo50-news-backup-$(date +%Y%m%d-%H%M%S)"
   mkdir -p "$BACKUP_TMP"
   git ls-files --others --exclude-standard -- assets/news/news_20* > /tmp/fitpo50-untracked-news.txt
   while IFS= read -r f; do [ -n "$f" ] || continue; mkdir -p "$BACKUP_TMP/$(dirname "$f")"; mv "$f" "$BACKUP_TMP/$f"; done < /tmp/fitpo50-untracked-news.txt
   git pull --ff-only origin main
   git status --short
3) Pokaz mi wynik i dopiero potem przejdz do pracy.

Przed rozpoczeciem pracy zawsze najpierw przeczytaj `PROJECT_MEMORY.md`.
Nastepnie:
- jesli zadanie dotyczy Porady, przeczytaj `MEMORY_PORADY.md`,
- jesli zadanie dotyczy Moje Sukcesy, przeczytaj `MEMORY_MOJE_SUKCESY.md`,
- jesli zadanie dotyczy NEWS, przeczytaj `MEMORY_NEWSY.md`.
- jesli zadanie dotyczy artykulow, przeczytaj tez `ARTICLE_STANDARD.md`.

Zasady:
- nie zgaduj,
- nie pomijaj konfliktow z dokumentem,
- nie rozszerzaj zakresu bez potrzeby,
- trzymaj zmiany minimalne i zgodne z projektem,
- sygnalizuj ryzyka, zalozenia i wplyw zmian na reszte systemu,
- nie wykonuj `git commit` ani `git push` bez mojej wyraznej komendy,
- nie uzywaj polecen destrukcyjnych bez mojej wyraznej zgody.
- Gdy wydaje komenda `git push`, najpierw uruchamiasz gate i raport:
  - `npm run predeploy:check`
  - jesli PASS: wykonaj `git add -A` -> `git commit` (automatyczny komunikat) -> `git push`,
  - jesli FAIL: STOP, raport bledow i brak push.
  - bezpiecznik: jesli commit obejmuje nienaturalnie duzy zakres (duzo plikow niezwiazanych z biezacym taskiem), STOP i krotkie pytanie o zgode.

Publikacja artykulow:
- kanoniczny flow publikacji artykulow: `scripts/import-article.js` (`.fitpo50.json` + precheck); `article-template-bento.html` / `create-article-from-template.js` tylko do recznych szkicow,
- preferuj szybki pipeline jednej komendy: `node scripts/article-pipeline.js --file "<sciezka/do/pliku.fitpo50.json>" --category <ruch|jedzenie|zdrowie|ciekawe> --force <true|false>`,
- obowiazkowo uruchom walidator standardu: `node scripts/validate-article-standard.js <plik.html>`,
- obowiazkowo generuj PDF artykulu i podpinaj duzy przycisk w hero: `python3 scripts/sync_article_pdfs_and_buttons.py --slug <slug>` (albo hurtowo: `npm run article:pdf:sync`),
- FAQ ma byc oparte o realne pytania z sieci (autocomplete/PAA), nie wymyslane; wymagane `faq_research[]` (min. 4 wpisy: `question`, `source_label`, `source_url`),
- w imporcie trzymaj `--faq-strict true` (domyslnie), czyli brak `faq_research[]` lub placeholdery FAQ = twardy FAIL,
- placeholdery redakcyjne (np. "Do uzupełnienia redakcyjnego", "Pytanie do doprecyzowania", "Odpowiedź do uzupełnienia", `{{...}}`) sa twardym FAIL importu w całym artykule (nie tylko FAQ),
- tytul urwany (np. konczacy sie na "i cofnąć") jest traktowany jako blad blokujacy,
- artykul nie przechodzi, jesli ma inline CSS lub lokalny `<style>`,
- naglowek "Czytelnia" ma byc index-style (`reading-room__head` z ikona),
- footer `site-footer-bento` musi byc wewnatrz `<body>`,
- dla nowego artykulu `datePublished` i `article:published_time` ustawiaj na faktyczna date publikacji,
- `dateModified` i `article:modified_time` aktualizuj przy kazdej istotnej zmianie merytorycznej,
- wszystkie 4 pola daty zapisuj jako pelny ISO 8601 z godzina i strefa (np. `2026-04-24T08:00:00+02:00`),
- kazdy claim liczbowy (%, dni, ryzyko, wzrost/spadek) musi miec zrodlo z URL; bez zrodla nie podawaj liczby,
- nowy artykul = obowiazkowa synchronizacja: strona kategorii + `porady.html` + `index.html` (`featured-article` i 3 kafelki) + `sitemap.xml` + eksport do `_site`,
- w `porady.html` pilnuj spojnosci: `numberOfItems` = liczba kart `data-article-item` = `data-article-count`; `data-order` ma byc unikalne,
- nowy wpis dostaje `data-order = max + 1` (bez duplikatow) na `porady.html` i stronie kategorii,
- "Nowy artykul" na `index.html` bierze kolejnosc z `sitemap.xml` + `article:published_time`/`datePublished` (nie z `data-order`),
- dlatego przy publikacji ustawiaj faktyczne daty publikacji (`article:published_time`, `datePublished`) oraz aktualizuj `dateModified`/`article:modified_time`,
- SEO guardrails: `<title>` max 65 znakow, `meta description` max 160 znakow,
- AEO guardrails: w `BlogPosting` dodawaj `speakable`, a sekcje `.key-takeaways` umieszczaj po wstepie (nie na samym dole),
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
