# FitPo50 Memory - PORADY

Ten plik dotyczy tylko modulu "Porady" i klasycznych artykulow publikowanych jako pojedyncze strony.

## Zakres

- Dotyczy: `porady.html`, artykuly w root (np. `*.html` poza `sukcesy/`), sekcje promocyjne i nawigacja do porad.
- Nie dotyczy: kalendarza i stron dnia w `Moje Sukcesy`.

## Zasady tresci i layoutu

- Artykul to pojedyncza strona docelowa.
- W headerze artykulu pokazujemy tylko:
  - dzial
  - czas czytania
- Nie pokazujemy widocznej daty publikacji/aktualizacji na gorze artykulu.
- Na dole artykulu (nad footerem) zawsze sekcja "Czytelnia" (`.porady-preview.section-padding`) z 3 kafelkami.
- Interlinking w tresci: docelowo 2-4 linki wewnetrzne osadzone w akapitach na naturalnych slowach kluczowych; same linki z bloku "Czytaj tez"/"Czytelnia" nie wystarczaja.
- Dopuszczamy bardziej wyrazisty styl artykulu (kolory, callouty, typografia, tabele), ale:
  - zachowujemy spojnosc z designem serwisu,
  - trzymamy max 2-3 rodziny fontow na artykul,
  - nie rozwalamy layoutu stylami inline (szczegolnie w sekcji "Czytelnia"),
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

## Kafelki i indeks porad

- Na `porady.html` utrzymujemy stabilny uklad karuzeli/paginacji.
- Karty kategorii musza byc spojne wizualnie.
- Nie uzywamy `scrollIntoView()` pod nawigacja karuzeli.
- Dla Safari pilnujemy `min-width: 0` na kluczowych kontenerach/gridach.

## Obrazy

- Preferowany `picture`: `avif` -> `webp` -> fallback `jpg/png`.
- Hero: `loading="eager"`.
- Pozostale: `loading="lazy"`.
- Gdzie mozliwe podajemy `width` i `height`.

## Aktualizacja przy nowym artykule

- Zawsze zaktualizuj:
  - Jedzenie
  - Zdrowie
  - Ciekawe
- To NIE jest tag pomocniczy. To osobna kategoria i osobna strona zbiorcza.
- Aktualizacja przy nowym artykule:
  - odpowiednia strona kategorii (Ruch/Jedzenie/Zdrowie/Ciekawe),
  - `porady.html`,
  - `sitemap.xml`,
  - `index.html`:
    - sekcja `featured-article`,
    - pierwszy kafelek w dolnej sekcji 3 kart (`articles-grid-preview`),
    - cala sekcja ma zawsze pokazywac 3 najnowsze wpisy wg daty publikacji.
