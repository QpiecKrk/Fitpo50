# ARTICLE STANDARD (FitPo50)

Ten dokument definiuje kanoniczny standard artykułów. Obowiązuje dla wszystkich nowych publikacji.

## 1. Golden template
- Strona referencyjna (golden): `wydolnosc-vo2max-starzenie-po-50.html`
- Szablon techniczny do tworzenia nowych artykułów: `article-template-bento.html`
- Każdy nowy artykuł powstaje wyłącznie z szablonu.
- Zakaz ręcznych wariantów layoutu.

## 2. Jeden system stylów
- `style.css`: shell, topbar/menu, czytelnia, bottom-nav, tokeny globalne, mapowanie kategorii.
- `article.css`: wyłącznie środek artykułu (intro bento, hero, content, FAQ/callouty, typografia treści).
- W artykułach nie używamy inline CSS (`style="..."`).
- Docelowo nie używamy lokalnych bloków `<style>` w artykułach.

## 3. Twardy szkielet HTML
Kolejność elementów jest stała:
1. `.shell`
2. `.topbar`
3. `.article-intro-grid` (małe bento + hero)
4. `#quick-answer.quick-answer.reveal` (sekcja "Szybka odpowiedź")
5. `.article-content`
6. `.reading-room.porady-preview.section-padding` (jak na `index.html`)
7. `.bottom-nav`
8. `.site-footer-bento` (wewnątrz `body`)

## 4. Wymagane klasy i znaczniki
- `body` musi mieć klasy: `article-template` + `article--{kategoria}`
- Kategoria na bento: `.article-kicker-card--{kategoria}`
- Czytelnia ma nagłówek index-style:
  - `.reading-room__head`
  - `.title-with-icon`
  - `.title-icon`
- Footer musi być przed `</body>`.

## 5. Kategorie i kolory (1:1)
- `article--ruch`: `#2f6f99` / `#ffffff`
- `article--jedzenie`: `rgba(201, 109, 49, 0.94)` / `#ffffff`
- `article--zdrowie`: `rgba(228, 188, 74, 0.96)` / `#4e3a04`
- `article--ciekawe`: `rgba(67, 149, 84, 0.94)` / `#ffffff`

## 6. Tokeny i globalna edycja
Zmiany globalne robimy przez tokeny CSS w `style.css`:
- fonty: `--font-display`, `--font-body`, `--font-ui`
- breakpointy: `--bp-mobile`, `--bp-phone-dark`, `--bp-topbar-collapse`
- promienie/spacing/typografia: `--radius-*`, `--space-*`, `--text-*`
- kolory kategorii: `--category-*`

Zasada: „zmień raz, zmień wszędzie”.

## 7. Procedura dodawania nowego artykułu
1. Generator:
`node scripts/create-article-from-template.js --slug <slug> --title "<tytuł>" --category <ruch|jedzenie|zdrowie|ciekawe> --description "<opis>"`
2. Uzupełnienie treści i SEO.
3. Ustaw daty publikacji:
`article:published_time` i `BlogPosting.datePublished` = faktyczna data publikacji.
`article:modified_time` i `BlogPosting.dateModified` = data ostatniej istotnej aktualizacji.
Format obowiązkowy: pełny ISO 8601 z godziną i strefą czasową (np. `2026-04-24T08:00:00+02:00`).
4. Podpięcie nawigacyjne:
- dodaj wpis na stronie kategorii i w `porady.html`,
- ustaw `data-order = max + 1` (unikalne) na obu listach,
- dodaj URL do `sitemap.xml` i wpis do `llms.txt`.
5. Walidacja standardu:
`node scripts/validate-article-standard.js <plik.html>`
6. PDF + przycisk pobierania (obowiązkowe):
`python3 scripts/sync_article_pdfs_and_buttons.py --slug <slug>`
albo hurtowo:
`npm run article:pdf:sync`
7. Synchronizacja do `_site`.
8. Kontrola końcowa:
- nowy wpis jest widoczny w `porady.html` i na stronie kategorii,
- sekcja "Nowy artykuł" na `index.html` wskazuje ten wpis.

## 8. Bramka jakości (fail conditions)
Artykuł nie przechodzi, jeśli:
- ma inline style,
- ma lokalny `<style>`,
- nie ma wymaganych sekcji,
- footer jest poza `body`,
- nagłówek czytelni nie jest index-style,
- nie ma prawidłowej klasy kategorii.

## 8a. Quick Answer Contract (obowiązkowe)
- Sekcja ma istnieć dokładnie raz:
  - `<section id="quick-answer" class="quick-answer reveal" aria-label="Szybka odpowiedź">`
- Wymagana zawartość:
  - jedno `h2` o treści `Szybka odpowiedź`,
  - jeden krótki akapit podsumowania (`p`).
- Pozycja kanoniczna:
  - po bloku PDF (`.pdf-hero-download`) i przed główną treścią.
- Reguła anty-regresji layoutu:
  - jeśli w starszym artykule `quick-answer` jest poza `.article-content`, musi być wyrównany do tej samej szerokości i paddingu co `.article-content` (obsługiwane przez `article.css`).

## 9. Guardrails SEO/AEO (obowiązkowe)
- `<title>`: celuj w 55-65 znaków (max 65).
- `meta name="description"`: celuj w 140-160 znaków (max 160).
- W `BlogPosting` dodawaj `speakable` (`SpeakableSpecification`) ze wskazaniem:
  - `.article-header__title`
  - `.article-content > p:first-of-type`
  - `.key-takeaways h2`
  - `.key-takeaways li`
- Sekcja `.key-takeaways` ma być wysoko w treści:
  - po leadzie/wstępie, przed pierwszym głównym blokiem sekcji.
