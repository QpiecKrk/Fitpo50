# FitPo50 Project Memory

Ten plik zbiera stałe ustalenia projektowe do stosowania przy kolejnych zmianach.

## Artykuly

- W headerze artykulu pokazujemy tylko:
  - dzial
  - czas czytania
- Nie pokazujemy widocznej daty publikacji lub aktualizacji na gorze artykulu.
- Daty moga byc obecne tylko w kodzie SEO i schema.

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
  - `meta property="article:author"` jesli stosowane w pozostalych artykulach

## SEO stron zbiorczych i glownej

- Strona glowna powinna miec:
  - `title`
  - `meta name="description"`
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
- Strony zbiorcze (`porady.html`, `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`) powinny miec:
  - `title`
  - `meta name="description"`
  - `meta name="robots" content="index,follow"`
  - `link rel="canonical"`
  - komplet `og:*`
  - komplet `twitter:*`
  - schema `CollectionPage`
- `porady.html` powinno uzywac `CollectionPage` z `mainEntity` typu `ItemList`.
- Strony 3 krokow (`rusz-sie.html`, `jedzenie.html`, `zdrowie.html`) powinny uzywac prostego `CollectionPage` z `isPartOf` wskazujacym `WebSite`.

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
- Dla stron zbiorczych utrzymujemy:
  - `CollectionPage`
- Nie mieszamy typow schema bez potrzeby. Jesli strona jest lista tresci, preferujemy `CollectionPage`, a nie `Article`.

## Zrodla

- Sekcja `Zrodla` powinna byc obecna w artykulach, gdy to zasadne.
- Jesli da sie pewnie wskazac zrodlo, link powinien byc klikalny.
- Dla linkow otwieranych w nowej karcie zawsze stosujemy:
  - `target="_blank"`
  - `rel="noopener noreferrer"`
- Nie zgadujemy konkretnych publikacji, jesli nie da sie ich uczciwie ustalic bez weryfikacji.
- Gdy nie da sie podac konkretnego artykulu, mozna linkowac strone czasopisma, DOI albo strone instytucji.
- Nie podajemy pozornie precyzyjnych cytowan typu "badanie z 2025", jesli w kodzie nie wskazujemy konkretnej publikacji.
- W tematach zdrowotnych i suplementacyjnych preferujemy zrodla instytucjonalne, DOI, PubMed, czasopisma i przeglady systematyczne.

## Obrazy

### Format: `<picture>` z AVIF/WebP/PNG

**Każdy obraz hero/featured musi używać elementu `<picture>`** z następującym schematem:

```html
<picture>
  <source srcset="./assets/NAZWA.avif" type="image/avif">
  <source srcset="./assets/NAZWA.webp" type="image/webp">
  <img src="./assets/NAZWA.png" alt="..." loading="eager" width="W" height="H">
</picture>
```

- **AVIF** — priorytetowy format (najmniejszy, ~40× mniejszy od PNG) — Safari 16+, Chrome, Firefox
- **WebP** — fallback dla starszych przeglądarek
- **PNG** — ostateczny fallback
- `loading="eager"` dla hero, `loading="lazy"` dla pozostałych
- `width` i `height` zawsze podajemy, aby uniknąć CLS

### Generowanie AVIF i WebP

Po wygenerowaniu nowego obrazu PNG, konwertujemy od razu:
```bash
ffmpeg -i NAZWA.png -c:v libaom-av1 -crf 30 -b:v 0 NAZWA.avif
ffmpeg -i NAZWA.png -quality 85 NAZWA.webp
```
### Automatyzacja dla AI (Instrukcja dla agenta)

Kiedy użytkownik poprosi o nowe zdjęcie, wykonaj te kroki:

1.  **Generowanie**: Użyj narzędzia `generate_image`, aby stworzyć obraz PNG o odpowiednich wymiarach (np. 1024x1024 lub 1920x1080).
2.  **Konwersja**:
    - Sprawdź, czy `ffmpeg` jest dostępny. Jeśli tak, wykonaj konwersję do AVIF i WebP.
    - Jeśli narzędzia brak, poproś użytkownika o zgodę na instalację przez `brew install ffmpeg`.
3.  **Implementacja**: Wstaw obraz do kodu HTML, używając skrótu `<picture>` z AVIF/WebP/PNG i dodaj `loading="lazy"` (chyba że to Hero).
4.  **Optymalizacja**: Upewnij się, że `width` i `height` są zgodne z faktycznym rozmiarem wygenerowanego pliku.


Used for featured links within subpages or where a full-width grid isn't appropriate.

- **Container**: `max-width: 320px` (for single card) or `minmax(200px, 1fr)` in a grid.
- **Padding**: `var(--space-4)`.
- **Title**: `font-family: var(--font-display)`, `font-size: 1rem`, `line-height: 1.2`, `color: var(--color-primary)`.
- **Description**: `font-size: 0.85rem`, `color: var(--color-text-muted)`, `line-height: 1.4`.
- **Label (Eyebrow)**: `font-size: 0.65rem`, `font-weight: 700`, uppercase, `background: var(--color-accent)`.
- **CTA**: "Czytaj artykuł →" with a small SVG arrow (`14px` size, `stroke-width: 2`).
- **Hover**: `transform: translateY(-2px)`, `box-shadow: 0 8px 20px rgba(14, 143, 170, 0.12)`, `border-color: var(--color-primary-light)`.
- **Usage**: See `rusz-sie.html` for the "Motywacja" card implementation.

- Hero moze miec `loading="eager"`.
- Obrazy nizej w tresci i karty artykulow powinny miec `loading="lazy"` jesli to ma sens.
- Gdzie to mozliwe, dodajemy `width` i `height`.
- Hero, featured, listing i inline images powinny miec jawne `width` i `height`, zeby ograniczac CLS.
- Dla kart artykulow i ilustracji wewnatrz tresci preferujemy:
  - `loading="lazy"`
  - zachowanie proporcji zgodnych z faktycznym plikiem
- Dla logo tez warto podawac rozmiary, jesli nie koliduje to z obecnym layoutem.

## Procedura dodawania nowego artykułu (Workflow)

Dodanie nowego wpisu wymaga aktualizacji w 3-4 miejscach (zasada automatyzacji manualnej):

1.  **Nowy plik HTML**: Stworzenie artykułu na bazie szablonu (np. `sen-po-50.html`).
2.  **Strona kategorii**: Jeśli artykuł to "Zdrowie", musi trafić na `zdrowie.html` jako kafelk/tile.
3.  **Strona zbiorcza**: Każdy nowy artykuł MUSI zostać dodany do listy na `porady.html` (z odpowiednim `data-category`).
4.  **Sitemap**: Aktualizacja `sitemap.xml`.

## Wygląd kafelków (Design Patterns)

Mamy dwa główne typy linków do artykułów, które musimy zachować:

- **Pełna Karta (`article-promo-card`)**: Używana na stronie głównej w "Czytelni". Zawiera zdjęcie, odznakę kategorii i animację `reveal`.
- **Kompaktowy Kafel (`Compact Article Tile`)**: Używany na stronach kategorii (`rusz-sie.html`, etc.).
    - **Bez zdjęcia**.
    - **Eyebrow**: Mała, pomarańczowa odznaka kategorii na górze.
    - **CTA**: Zawsze "Czytaj artykuł →".
    - **Spójność**: Wszystkie kafelki na stronie kategorii muszą być identyczne graficznie (marginesy, zaokrąglenia, kolory).

## Sekcja: Najnowszy Artykuł (Featured)

Używana na stronie głównej pod BIO. Prowadzi bezpośrednio do najświeższego wpisu. Przy każdym nowym artykule należy rozważyć podmianę linku w tej sekcji, aby promować najnowszą treść.

## Stan projektu i nawigacja

- **3 Filary**: Strona opiera się na trzech głównych kategoriach: **Ruch**, **Jedzenie**, **Zdrowie**.
- **Kategoria Wiedza**: Została usunięta. Artykuły wcześniej przypisane do "Wiedzy" (np. Badania przed treningiem) są teraz w kategorii **Zdrowie**.
- **Nawigacja**: Menu główne i kafelki na stronie głównej ("3 Podstawowe Kroki") prowadzą do substadiów tych trzech filarów.
- **Czytelnia na stronie głównej**: Sekcja „Najnowsze Porady i Artykuły” na `index.html` musi zawsze zawierać **tylko 3 najnowsze** kafelki. Przy dodawaniu nowego artykułu, najstarszy z tej sekcji musi zostać usunięty.

## Kompatybilność (Safari)

- **Aspect-ratio**: Dla zdjęć stosujemy `width: 100%` i `aspect-ratio`, ale w sekcjach krytycznych (jak Bio) dodajemy jawne `max-width`, aby uniknąć problemów na Safari < 15.
- **Flex Gap**: Starsze wersje Safari nie wspierają `gap` w Flexboxie. W sekcjach takich jak `steps-banner__actions` stosujemy fallbacki oparte na marginesach (`@supports not (gap: 1rem)`).
- **Zabezpieczenia Grid**: Dla kontenerów z tekstem w Gridzie stosujemy `min-width: 0`, aby zapobiec rozciąganiu layoutu w Safari.

## Standard Artykułu (Layout & Komponenty)

Aby zachować 100% spójności wizualnej (zgodnie z projektami w PDF/zrzutach), stosujemy następujące klasy i strukturę:

### 1. Nagłówek i Intro
- **Wrapper**: `.article-page`
- **Meta**: `.article-header__meta` (Dział, ikona zegara, czas czytania).
- **Tytuł**: `.article-header__title` (H1 z fontem `Zodiak`).
- **Pierwszy akapit**: Klasa `.drop-cap` dla efektownego inicjału.

### 2. Elementy Wyróżnione (Callouts)
- **Cytat / Ważna myśl**: Klasa `.article-quote`. Stosowana do bloków tekstu na szarym/zielonym tle z paskiem z boku (widoczne na zrzutach jako kluczowe wnioski).
- **Motto na zdjęciu**: Klasa `.hero-motto` wewnątrz `.article-hero`. Zawsze z lewym obramowaniem `var(--color-accent)`.

### 3. Struktura Treści
- **Nagłówki sekcji**: 
  - `H2`: Główne sekcje (mają automatyczną linię dekoracyjną pod spodem w CSS).
  - `H3`: Podsekcje (kolor `var(--color-accent)`).
- **Tabele danych**: Używamy standardowego tagu `table` wewnątrz `.article-content`. Nagłówki `th` powinny mieć tło `var(--bg-surface)`.

### 4. Stopka Artykułu
- **Źródła**: Lista `<ol>` na końcu artykułu z małym fontem (`0.85rem`) i kolorem `var(--color-text-faint)`.
- **Nota medyczna**: Klasa `.medical-disclaimer` na samym dole.
- **Kafelki promujące (Czytelnia)**: Sekcja `.porady-preview` na dole strony musi zawierać kafelki (`.article-promo-card`) identyczne z tymi na stronie głównej: obrazek (z `transition: transform 0.5s ease`), etykieta kategorii, czas czytania (ikona + minuty), tytuł, krótki opis oraz przycisk `.btn--outline` z ikoną strzałki SVG. Standardowo umieszczamy 3 najbardziej adekwatne artykuły.

## Automatyzacja tworzenia artykułów

Jeśli użytkownik poda tekst artykułu (np. ze zrzutu ekranu lub dokumentu):
1.  **Analiza Treści**: Agent wyodrębnia tytuł, wstęp, śródtytuły, tabele i źródła.
2.  **Strukturyzacja**: Mapuje treść na powyższe komponenty wizualne.
3.  **SEO**: Automatycznie generuje meta opisy, tagi społecznościowe i JSON-LD (BlogPosting).
4.  **Bezpieczeństwo**: Treść pozostaje niezmieniona, chyba że użytkownik prosi o redakcję.
5.  **Logika i Rozmieszczenie Zdjęć**: Jeśli użytkownik poprosi o wygenerowanie zdjęć do artykułu, agent umieszcza je w tekście w miejscach, które najlepiej ilustrują dany fragment (logiczne wplecenie w treść), stosując tag `<picture>` i klasę `inline-img`.
6.  **Linkowanie Wewnętrzne**: Agent wyszukuje w tekście słowa kluczowe (np. „Siłownia”, „Dieta”, „Sen”) i zamienia je na linki do istniejących już artykułów (celujemy w ok. 4 linki na artykuł). Nie tworzymy nowych zdań — wykorzystujemy naturalne wystąpienia słów w dostarczonej treści.

## Mobile Responsiveness (kluczowe breakpointy)

- **`< 480px`**: `footer__inner` i `articles-grid-preview` przechodzą na `1fr` (1 kolumna).
- **`< 640px`**: `.featured-article__content` przechodzi na `grid-template-columns: 1fr`, obrazek wycentrowany z `margin-inline: auto`, przyciski na `width: 100%`. `.about-promo` przechodzi na `grid-template-columns: 1fr`.
- **`< 360px`**: Dodatkowe zmniejszenia paddingów, fontów i badgy dla iPhone SE.
- **`@supports not (gap: 1rem)`**: Fallback margin-based dla starszego Safari w `.steps-banner__actions`.
- **Kafelki pod artykułem (np. bieganie)**: Sekcja dolna "Czytaj dalej" musi zawierać takie same kafelki w każdym artykule, spójne z ogólnym standardem kafelków.
- **Karuzela katalogu (porady.html) - Złote Zasady**:
    1. **HTML Kafelka**: Zawsze używamy pełnej struktury z odznaką (`.article-index-card__label` - pomarańczowe jajo) i czystym tekstem czasu (`.article-index-card__meta` np. "10 min czytania", bez ikon SVG). Przycisk dolny to niebieski napis "Otwórz ->".
    2. **CSS Siatki (Grid)**: Karty MUSZĄ układać się precyzyjnie w kolumnach bez rozciągania. Bezwzględnie unikamy `auto-fit`, który rozciąga pojedyncze elementy (np. 9. kafelek) na pełną stronę. Używamy explicit grid w media queries: `repeat(4, 1fr)` (desktop), `repeat(2, 1fr)` (tablet), `1fr` (mobile). Domyślnie `repeat(auto-fill, minmax(220px, 1fr))`.
    3. **JavaScript (Nawigacja)**: Grupowanie po 8 elementów (`initialVisibleArticles = 8`). JavaScript zarządza wyłącznie stylami `transform` (translacja X). **Zakaz** używania funkcji `scrollIntoView()` przy klikaniu przycisków karuzeli ("Wróć"/"Dalej"), aby zapobiec nagłym i nienaturalnym "skokom" strony w górę. Oraz dbamy by karuzela nie miała zduplikowanych starych kontenerów na zapleczu HTML.

## Sitemap Standard

- `sitemap.xml` musi zawierać **wszystkie** publiczne strony.
- Format wpisu: `<loc>` + `<lastmod>YYYY-MM-DD</lastmod>`.
- `<lastmod>` aktualizujemy za każdym razem, gdy zmieniamy daną stronę.
- Obecne strony w sitemap: `/`, `rusz-sie`, `jedzenie`, `zdrowie`, `porady`, `jak-zaczac-na-silowni-po-50`, `badania-po-50`, `bledy-50`, `silownia-dla-ludzi`, `motywacja-po-50`, `dieta-po-50`, `suplementacja-po-50`, `sen-po-50`, `bieganie-niszczy-kolana`.
