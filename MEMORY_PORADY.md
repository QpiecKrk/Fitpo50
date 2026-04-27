# FitPo50 Memory - PORADY

Ten plik dotyczy tylko modulu "Porady" i klasycznych artykulow publikowanych jako pojedyncze strony.

## Zakres

- Dotyczy: `porady.html`, artykuly w root (np. `*.html` poza `sukcesy/`), sekcje promocyjne i nawigacja do porad.
- Nie dotyczy: kalendarza i stron dnia w `Moje Sukcesy`.

## Zasady tresci i layoutu

- Artykul to pojedyncza strona docelowa.
- Obowiazuje kanoniczny standard z `ARTICLE_STANDARD.md` (bez recznych wariantow layoutu).
- Kanoniczny flow publikacji: `scripts/import-article.js` z plikow `.fitpo50.json` (zawsze z precheck).
- Regula importera dla "Czytelni": linki z JSON (`related_articles` / `related`) sa ignorowane; importer dobiera 3 karty tylko z lokalnie istniejacych artykulow.
- `article-template-bento.html` / `node scripts/create-article-from-template.js ...` stosujemy tylko do recznych szkicow i materialow roboczych.
- Przed oddaniem artykulu uruchamiamy walidator:
  - `node scripts/validate-article-standard.js <plik.html>`
- Przed publikacja artykulu obowiazkowo generujemy PDF i podpinamy przycisk hero:
  - `python3 scripts/sync_article_pdfs_and_buttons.py --slug <slug>`
  - albo hurtowo: `npm run article:pdf:sync`
- W headerze artykulu pokazujemy tylko:
  - dzial
  - czas czytania
- Nie pokazujemy widocznej daty publikacji/aktualizacji na gorze artykulu.
- Na dole artykulu (nad footerem) zawsze sekcja "Czytelnia" (`.porady-preview.section-padding`) z 3 kafelkami.
- Naglowek sekcji "Czytelnia" ma byc index-style (`.reading-room__head` + ikona), nie wariant alternatywny.
- Interlinking w tresci: minimum 4 linki wewnetrzne osadzone w akapitach na naturalnych slowach kluczowych; same linki z bloku "Czytaj tez"/"Czytelnia" nie wystarczaja.
- Crosslinki wewnetrzne dopinamy recznie po imporcie (kontrola redakcyjna); nie przenosimy automatycznie linkow z promptu/modelu.
- Dopuszczamy bardziej wyrazisty styl artykulu (kolory, callouty, typografia, tabele), ale:
  - zachowujemy spojnosc z designem serwisu,
  - trzymamy max 2-3 rodziny fontow na artykul,
  - nie rozwalamy layoutu stylami inline (zakaz `style=\"...\"`, szczegolnie w sekcji "Czytelnia"),
  - tabelki musza byc responsywne i czytelne na mobile.

## Standard wizualny artykulu (obowiazuje od 2026-04-17)

Wzorcem referencyjnym dla stylu premium jest:
- `powrot-do-formy-po-50-kompletny-przewodnik.html` (ogolny klimat i rytm),
- `trening-3x30-dla-50-plus.html` (konkretne klasy dla wyroznien i sekcji treningowych).

Elementy obowiazkowe (minimum):
- Hero z haslem (`.hero-motto`) i wyraznym kontrastem.
- Pierwszy akapit z `drop-cap`.
- Co najmniej 2 callouty (`.highlight-box` / modyfikatory) w kluczowych miejscach tekstu.
- Mocny cytat koncowy (`.article-quote`).
- Co najmniej 4 kontekstowe linki wewnetrzne osadzone w akapitach.
- Sekcja `Zrodla` + `medical-disclaimer` + `Czytelnia` (3 karty).

Typografia:
- Bazowo:
  - display: `var(--font-display)` / Zodiak,
  - body: `Work Sans`,
  - akcent cytatowy/odreczny: `Caveat`.
- Nie przekraczamy 3 rodzin fontow w jednym artykule.
- Hierarchia ma byc czytelna: mocny H1/H2, spokojny body, wyrazne akcenty.

System wyroznien tekstu:
- Stosujemy klasy tonalne zamiast przypadkowych inline:
  - `.tone-strong`
  - `.tone-primary`
  - `.tone-accent`
  - `.tone-success`
- Dla list zasad typu "Po pierwsze..." stosujemy etykiety `pill`:
  - `.rule-tag`
- Dla fragmentow treningowych typu "Cwiczenie 1..." stosujemy:
  - `.exercise-tag`
- Zasada czytelnosci:
  - max 1 mocny akcent tonalny na akapit (poza linkami),
  - nie malujemy calego akapitu, tylko frazy nozne.

Callouty i bloki pomocnicze:
- Standard:
  - `.highlight-box`
- Warianty:
  - `.highlight-box--primary`
  - `.highlight-box--success`
- Uzywamy ich do:
  - podsumowania sekcji,
  - sygnalu "co najwazniejsze",
  - praktycznej wskazowki do wdrozenia.

Obrazy i separatory:
- Gdy w sekcji wystepuja 2+ obrazki pod rzad, grupujemy je:
  - wrapper `.figure-stack`,
  - podpis grupy `.figure-stack__label`,
  - obrazki jako `.inline-figure`.
- `inline-figure` ma miec subtelna ramke/cien; bez "golego" obrazka.
- Obowiazkowo `picture` (`avif -> webp -> fallback`) oraz sensowne `alt`.

Responsywnosc:
- Kazdy artykul musi byc czytelny mobile-first:
  - brak poziomego scrolla przez ozdobniki,
  - boxy i tagi nie moga "pekac" layoutu,
  - obrazki i tabele skaluja sie poprawnie.

Czego nie robimy:
- Brak losowych kolorow i stylu "kazdy blok inny".
- Brak nadmiaru inline CSS, jesli da sie uzyc klas.
- Brak upychania 4-5 linkow wewnetrznych w jednym akapicie.
- Brak "sciany obrazkow" bez odstepu i separatora.

Szybka checklista przed oddaniem artykulu:
1. Czy jest hero, drop-cap, co najmniej 2 callouty i mocny cytat?
2. Czy "Po pierwsze..." / "Cwiczenie 1..." sa wizualnie oznaczone?
3. Czy linki wewnetrzne sa rozlozone naturalnie po tekscie?
4. Czy bloki obrazow pod rzad maja `.figure-stack`?
5. Czy finalny wyglad jest spojny z referencja i nie psuje mobile?

## SEO i schema

- Artykuly: `BlogPosting` + komplet meta (`title`, `description`, canonical, og, twitter, article times).
- `porady.html`: `CollectionPage` + `ItemList`.
- Liczniki i schema musza byc zgodne z realna liczba kart.
- Anty-regresja SEO:
  - `<title>` artykulu: docelowo 55-65 znakow (nie przekraczaj 65).
  - `meta description`: docelowo 140-160 znakow (nie przekraczaj 160).
- Anty-regresja AEO:
  - `BlogPosting` ma zawierac `speakable` (`SpeakableSpecification`).
  - Sekcja `key-takeaways` ma byc wysoko w tresci (po wstepie), nie dopiero pod koniec artykulu.

## Kafelki i indeks porad

- Na `porady.html` utrzymujemy stabilny uklad karuzeli/paginacji.
- Karty kategorii musza byc spojne wizualnie.
- Nie uzywamy `scrollIntoView()` pod nawigacja karuzeli.
- Dla Safari pilnujemy `min-width: 0` na kluczowych kontenerach/gridach.
- Przy przebudowie kolejnych stron kategorii na wzorzec nowego `index.html` utrzymujemy ta sama zasade nocnego tla:
  - na telefonach dopuszczamy ciemne tlo (warstwa strony + warstwa kontenera),
  - na desktopie domyslnie zostaje jasny wariant.

## Obrazy

- Preferowany `picture`: `avif` -> `webp` -> fallback `jpg/jpeg` (PNG tylko dla logo/ikon technicznych).
- Hero: `loading="eager"`.
- Pozostale: `loading="lazy"`.
- Gdzie mozliwe podajemy `width` i `height`.

## Aktualizacja przy nowym artykule

- Aktualizacja przy nowym artykule:
  - odpowiednia strona kategorii (Ruch/Jedzenie/Zdrowie/Ciekawe),
  - `porady.html`,
  - PDF artykulu (`assets/pdf/<slug>.pdf`) + przycisk pobierania na hero z aktualnym rozmiarem pliku w KB,
  - `sitemap.xml`,
  - `index.html`:
    - sekcja `featured-article`,
    - pierwszy kafelek w dolnej sekcji 3 kart (`articles-grid-preview`),
    - cala sekcja ma zawsze pokazywac 3 najnowsze wpisy wg daty publikacji.

## Anty-regresja (obowiazkowe przy kazdym nowym wpisie)

- `data-order`:
  - na `porady.html` i stronie kategorii `data-order` musi byc unikalne,
  - nowy wpis dostaje `max + 1`,
  - nie zostawiamy duplikatow (np. dwa wpisy z tym samym numerem).

- Daty publikacji (krytyczne dla "Nowy artykul" na `index.html`):
  - ustawiaj:
    - `meta property="article:published_time"` = faktyczna data publikacji,
    - `BlogPosting.datePublished` = ta sama data,
    - `article:modified_time` i `BlogPosting.dateModified` = data aktualizacji.
    - wszystkie pola daty zapisujemy jako pełny ISO 8601 z godziną i strefą (np. `2026-04-24T08:00:00+02:00`).
  - Bez poprawnych dat nowy wpis nie pojawi sie jako najnowszy na `index.html`.

- `index.html` - zasada dzialania:
  - "Nowy artykul" sortuje po `sitemap.xml` + `published_time/datePublished`,
  - nie po kolejnosci kart na `porady.html`.

- Koncowa kontrola przed oddaniem:
  - nowy wpis widoczny na stronie kategorii,
  - nowy wpis widoczny na `porady.html` z najwyzszym `data-order`,
  - URL obecny w `sitemap.xml`,
  - nowy wpis wskakuje do sekcji "Nowy artykul" na `index.html`,
  - source i `_site` sa zsynchronizowane 1:1.
