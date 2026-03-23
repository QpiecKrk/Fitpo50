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

## Zrodla

- Sekcja `Zrodla` powinna byc obecna w artykulach, gdy to zasadne.
- Jesli da sie pewnie wskazac zrodlo, link powinien byc klikalny.
- Dla linkow otwieranych w nowej karcie zawsze stosujemy:
  - `target="_blank"`
  - `rel="noopener noreferrer"`
- Nie zgadujemy konkretnych publikacji, jesli nie da sie ich uczciwie ustalic bez weryfikacji.
- Gdy nie da sie podac konkretnego artykulu, mozna linkowac strone czasopisma, DOI albo strone instytucji.

## Obrazy

### Compact Article Tile (No-Image)
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

## Sekcja: Najnowszy Artykuł (Featured)

- Umieszczana pod sekcją BIO na stronie głównej.
- **Badge**: Zawsze zawiera napis "UWAGA: nowy artykuł" z animacją `pulse-glow-intense`.
- **Zdjecie**: Zawiera miniaturę (tilted/przekrzywioną) z najnowszego artykułu, z białą ramką (6px solid white) i cieniem.
- **Hook**: Powinien być krótki, angażujący i nakierowany na korzyść czytelnika.
- **Przycisk**: Nowoczesny CTA prowadzący bezpośrednio do pełnej treści artykułu.

## Zasady pracy

- Najpierw sprawdz aktualny stan plikow, potem edytuj.
- Nie cofaj tych ustalen bez wyraznej prosby.
- Zachowuj spojny standard SEO i on-page w calym repo.
