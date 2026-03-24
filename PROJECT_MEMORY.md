x# FitPo50 Project Memory

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

## Standardy obrazow i mediow

- **Logo (`logo.jpg`):**
  - Oryginalne wymiary: 693x693px (kwadrat).
  - W nagłówku (`.logo__img`): zawsze `width="48" height="48"`.
  - W stopce (`.logo__img--footer`): zawsze `width="72" height="72"`.
- **Zdjecia w artykulach:**
  - Zawsze stosujemy `loading="lazy"`.
  - Zawsze podajemy `width` i `height` odpowiadajace proporcjom obrazu.
  - Rekomendowany format: `picture` z AVIF/WebP jako sourcami i fallbackiem <img>.

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
  - **Linkowanie wewnętrzne (Interlinking)**: W treści artykułu stosujemy maksymalnie 4 linki do innych artykułów wewnątrz serwisu. Linkujemy słowa kluczowe naturalnie występujące w tekście, nie zmieniając jego brzmienia (np. słowo „siłownia” staje się linkiem do artykułu o tym, jak zacząć).

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

## Porady.html (Karuzela i Paginacja)

- `porady.html` to czytelnia i główny katalog wszystkich artykułów (obecnie równo 11 artykułów). Złote zasady:
  1. **Zgodność liczników i warstwy SEO**: Licznik w HTML (np. `data-article-count`), rzeczywista liczba kafli na stronie oraz deklaracja wpisów w sekcji `<script type="application/ld+json">` (elementy `"numberOfItems"` oraz ich `"position"`) MUSZĄ się zawsze zgadzać co do sztuki. Jeśli oddajesz nowy artykuł, dopisz go na pozycję nr 1 w schemacie JSON-LD i wymuś przesunięcie pozostałych układów.
  2. **Struktura kart HTML**: Używamy pełnej zwięzłej struktury dla kafelków (`.article-index-card`): pomarańczowa odznaka `.article-index-card__label`, czysty tekst czasu `.article-index-card__meta` (bez ikon SVG), a CTA dolne to tekst "Otwórz ->". 
  3. **Wymogi ułożenia CSS Grid**: Karty KATEGORYCZNIE układają się w sztywnym podziale. Żeby pojedyncze artykuły na końcu karuzeli się nie rozciągały, definiujemy twardą siatkę: `grid-template-columns: repeat(4, 1fr)` (desktop), `repeat(2, 1fr)` (tablet), oraz `1fr` dla mobile. **Zakaz korzystania z `auto-fit`** w klasie `.carousel-page`.
  4. **Zapobieganie awariom Grid w Safari**: Z powodu znanego wycieku szerokości WebKit/Safari, klasa kontenerowa `.carousel-page` (bedąca elementem list flex) MUSI posiadać atrybuty `min-width: 0;` oraz `max-width: 100%;`. Dodatkowo same obiekty `.article-index-card` też używają `min-width: 0;`. Skutecznie blokuje to przedziury (blowouty) karuzeli w 1 wielki, rozciągnięty ciąg na urządzeniach Apple.
  5. **Nawigacja JS**: Stronicowanie (zmiana translateZ) obsługiwane jest gładkim przesuwaniem, logiki skryptu grupującej po max 8 elementów na okienko. **Surowy zakaz** używania polecenia `.scrollIntoView()` pod guzikami "Dalej" i "Wróć", ponieważ powoduje to szkodliwe "skoki" ekranu użytkownika w pionie.

Nie zostawiamy starych, duplikujących się bloków zaplecza, ani martwych linków do archiwalnego HTML, którego w bazie nie ma!

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
- **KRYTYCZNE**: Nigdy nie pomijamy `article:modified_time` oraz `dateModified` w schema.
- **KRYTYCZNE**: Obrazy MUSZA isc przez tag `<picture>` z AVIF i WebP. Nigdy nie zostawiamy samych `<img>` bez wymiarow i lazy loading.
- **KRYTYCZNE**: W sekcjach "Więcej Porad" (stopka artykułu) używamy klasy `.articles-grid-preview`. NIGDY nie dodajemy tam stylów inline typu `grid-template-columns`. Układem zarządza centralnie `style.css` (1 kolumna na telefonie, 2 na tablecie, 3 na desktopie). CTA kart promocyjnych to zawsze tekstowe "Czytaj artykuł ->", a nazwa sekcji nie może zawierać słowa "Wiedza".
- **KRYTYCZNE**: Sekcja Hero na `index.html` korzysta z animacji wejściowych (klasa `.hero__eyebrow`, `.hero__title` itd.) oraz efektu paralaksy (skrypt na dole strony). Przy edycji nagłówka należy zachować klasę `.floating` dla badge'a oraz dbać o to, by obraz tła miał `will-change: transform`.
- **KRYTYCZNE**: Sekcja `featured-article` (pod biogramem na `index.html`) musi zawsze zawierać absolutnie najnowszy artykuł. Ponadto pierwsza karta w sekcji `articles-grid-preview` (Czytelnia) powinna być tym samym lub drugim w kolejności najnowszym wpisem.
- **KRYTYCZNE**: Wszystkie nagłówki sekcji (`section-header`) muszą posiadać element `<div class="section-header__line"></div>` oraz sub-klasy animacyjne. Standard to: etykieta (slide), tytuł (fade-up), linia (scale-out) i opis (fade-in), wyzwalane przez klasę `.reveal`.
- Zmiany techniczne, SEO i wizualne nie powinny przypadkiem zmieniac sensu tresci.
