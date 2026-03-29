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
  - odpowiednia strone kategorii,
  - `porady.html`,
  - `sitemap.xml`,
  - sekcje featured na `index.html` (jesli nowy wpis jest najnowszy).
