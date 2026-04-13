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
