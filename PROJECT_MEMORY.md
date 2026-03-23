# FitPo50 Project Memory

Ten plik zbiera stale ustalenia projektowe do stosowania przy kolejnych zmianach.

## Zasady ogolne

- Zachowujemy obecny kierunek serwisu: praktyczny, czytelny, bez nadmiaru ozdobnikow.
- Nie cofamy ustalen projektowych i SEO bez wyraznej prosby.
- Przy kazdej zmianie najpierw sprawdzamy stan pliku, potem edytujemy.

## Architektura serwisu

- Serwis opiera sie na trzech glownych filarach:
  - `rusz-sie.html`
  - `jedzenie.html`
  - `zdrowie.html`
- Strona zbiorcza artykulow to `porady.html`.
- Kategoria `Wiedza` zostala usunieta. Powiazane tresci wpadaja do jednego z trzech filarow, najczesciej do `Zdrowie`.
- Na stronie glownej sekcja "Najnowsze Porady i Artykuly" ma zawierac tylko 3 najnowsze kafelki.

## Artykuly

- W headerze artykulu pokazujemy tylko:
  - dzial
  - czas czytania
- Nie pokazujemy widocznej daty publikacji lub aktualizacji na gorze artykulu.
- Daty moga byc obecne tylko w SEO i schema.
- Uklad artykulu ma byc spojny z istniejacym standardem wizualnym.

## SEO artykulow

- Kazdy artykul powinien miec:
  - `title`
  - `meta name="description"`
  - `meta name="robots" content="index,follow"`
  - `link rel="canonical"`
  - `og:title`
  - `og:description`
  - `og:type`
  - `og:url`
  - `og:image`
  - `og:locale`
  - `twitter:card`
  - `twitter:title`
  - `twitter:description`
  - `twitter:image`
  - `article:published_time`
  - `article:modified_time`
- Jesli w innych artykulach jest stosowane `article:author`, utrzymujemy ten sam wzorzec.

## SEO strony glownej i stron zbiorczych

- Strona glowna powinna miec:
  - `title`
  - `meta name="description"`
  - `meta name="robots" content="index,follow"`
  - `link rel="canonical"`
  - komplet `og:*`
  - komplet `twitter:*`
- Strony zbiorcze (`porady.html`, `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`) powinny miec:
  - `title`
  - `meta name="description"`
  - `meta name="robots" content="index,follow"`
  - `link rel="canonical"`
  - komplet `og:*`
  - komplet `twitter:*`
  - schema `CollectionPage`

## Schema

- Dla artykulow stosujemy `BlogPosting`.
- W `BlogPosting` powinny byc:
  - `headline`
  - `description`
  - `inLanguage`
  - `mainEntityOfPage`
  - `url`
  - `image`
  - `datePublished`
  - `dateModified`
  - `keywords`
  - `author`
  - `publisher`
- Dla strony glownej utrzymujemy:
  - `WebSite`
  - `Organization`
- Dla stron zbiorczych utrzymujemy `CollectionPage`.
- `porady.html` powinno uzywac `CollectionPage` z `mainEntity` typu `ItemList`.
- Dane w schema musza zgadzac sie z realna zawartoscia strony:
  - liczba elementow
  - lista artykulow
  - kolejnosc

## Zrodla

- Sekcja `Zrodla` powinna byc obecna tam, gdzie to zasadne.
- Jesli da sie pewnie wskazac konkretne zrodlo, link powinien byc klikalny.
- Dla linkow otwieranych w nowej karcie zawsze stosujemy:
  - `target="_blank"`
  - `rel="noopener noreferrer"`
- Nie zgadujemy publikacji, jesli nie da sie ich uczciwie ustalic.
- Gdy nie da sie podac konkretnego artykulu, mozna linkowac DOI, PubMed, PMC, strone instytucji albo strone czasopisma.
- W tematach zdrowotnych i suplementacyjnych preferujemy:
  - PubMed
  - PMC
  - DOI
  - instytucje
  - przeglady systematyczne
  - dobre czasopisma naukowe

## Obrazy

- Hero, featured i wazne obrazy w tresci powinny uzywac:
  - `picture`
  - `AVIF`
  - `WebP`
  - oryginalnego fallbacku (`png` albo `jpg`)
- Standard:

```html
<picture>
  <source srcset="./assets/NAZWA.avif" type="image/avif">
  <source srcset="./assets/NAZWA.webp" type="image/webp">
  <img src="./assets/NAZWA.png" alt="..." loading="eager" width="W" height="H">
</picture>
```

- `loading="eager"` stosujemy dla hero.
- `loading="lazy"` stosujemy dla obrazow nizej w tresci, kart i ilustracji, jesli ma to sens.
- `width` i `height` podajemy zawsze tam, gdzie to mozliwe, aby ograniczac CLS.
- Po podmianie obrazu na `picture` trzeba sprawdzic, czy wrapper nadal poprawnie wypelnia ramke, szczegolnie w Safari.
- Dla logo tez warto podawac wymiary, jesli nie rozwala to layoutu.

## Konwersja obrazow

- Przy optymalizacji obrazow generujemy:
  - `AVIF` jako format priorytetowy
  - `WebP` jako fallback
- Jesli narzedzia sa dostepne, mozna uzywac:
  - `avifenc`
  - `cwebp`
  - albo `ffmpeg`
- Po wygenerowaniu nowych plikow trzeba podpiac je do HTML przez `picture`, a nie tylko zostawic w katalogu `assets`.

## Standard artykulu

- Wrapper strony artykulu: `.article-page`
- Meta header: `.article-header__meta`
- Tytul: `.article-header__title`
- Pierwszy akapit moze uzywac `.drop-cap`
- Wazne callouty i mocne cytaty: `.article-quote`
- Motto na hero artykulu: `.hero-motto`
- H2 to glowne sekcje
- H3 to podsekcje
- Tabele robimy standardowym `table` wewnatrz `.article-content`
- Na dole artykulu:
  - sekcja `Zrodla`
  - `.medical-disclaimer`
  - sekcja `.porady-preview` z 3 adekwatnymi kafelkami

## Kafelki i linkowanie artykulow

- Na stronie glownej uzywamy pelnych kart promocyjnych.
- Na stronach kategorii uzywamy kompaktowych kafelkow bez zdjec.
- Kafelki na jednej stronie kategorii musza byc graficznie spojne.
- CTA w kompaktowych kafelkach: `Czytaj artykul ->`
- Przy dodaniu nowego artykulu aktualizujemy:
  - odpowiednia strone kategorii
  - `porady.html`
  - `sitemap.xml`
- `porady.html` musi byc zgodne we wszystkich warstwach:
  - liczba kart w HTML
  - licznik na stronie
  - schema `ItemList`
  - linki do realnie istniejacych plikow

## Featured na stronie glownej

- Sekcja "Najnowszy Artykul" pod BIO promuje najnowszy wpis.
- Przy nowym artykule trzeba rozwazyc podmiane tej sekcji na swiezsza tresc.

## Mobile i Safari

- Dla krytycznych sekcji pilnujemy poprawnego zachowania na mobile i w Safari.
- W sekcjach gridowych z tekstem stosujemy `min-width: 0`, zeby unikac rozpychania layoutu.
- Przy bardzo malych ekranach:
  - footer ma przechodzic do jednej kolumny
  - siatki kart maja schodzic do jednej kolumny, jesli dwie robia sie zbyt ciasne
  - featured i podobne sekcje maja przechodzic do jednego slupka
- Przy `picture` i wrapperach obrazow sprawdzamy:
  - `display: block`
  - `width: 100%`
  - `height: 100%`
  - `object-fit: cover`
- Dla starszego Safari trzeba uwazac na:
  - `aspect-ratio`
  - `gap` w flexie
  - elementy grid/flex bez `min-width: 0`

## Porady.html

- `porady.html` to czytelnia i katalog wszystkich artykulow.
- Karty maja miec spojna strukture:
  - odznaka kategorii
  - czas czytania jako tekst
  - tytul
  - krotki opis
  - CTA `Otworz`
- Karuzela i filtrowanie nie moga prowadzic do martwych linkow.
- Nie zostawiamy starych, zduplikowanych kontenerow ani nieaktualnych licznikow.
- Nie uzywamy rozwiazan, ktore robia nienaturalne skoki strony przy nawigacji karuzeli.

## Sitemap

- `sitemap.xml` musi zawierac wszystkie publiczne strony.
- Kazdy wpis ma miec:
  - `<loc>`
  - `<lastmod>YYYY-MM-DD</lastmod>`
- `lastmod` aktualizujemy przy zmianie danej strony.

## Workflow nowego artykulu

Przy dodawaniu nowego artykulu aktualizujemy:

1. nowy plik HTML artykulu
2. odpowiednia strone kategorii
3. `porady.html`
4. `sitemap.xml`

Jesli artykul ma obrazy:

1. generujemy lub przygotowujemy plik zrodlowy
2. robimy `AVIF` i `WebP`
3. podpinamy przez `picture`
4. dodajemy poprawne `width`, `height` i `loading`

## Zasada koncowa

- Tresci artykulow pozostaja merytorycznie nietkniete, jesli uzytkownik nie prosi o redakcje.
- Zmiany techniczne, SEO i wizualne nie powinny przypadkiem zmieniac sensu tresci.
