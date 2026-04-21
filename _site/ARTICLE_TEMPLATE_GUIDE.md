# Article Template Guide (FitPo50)

Dokument pomocniczy. Kanoniczne zasady są w `ARTICLE_STANDARD.md`.

## Pliki
- Szablon: `article-template-bento.html`
- Generator: `scripts/create-article-from-template.js`
- Walidator: `scripts/validate-article-standard.js`

## Szybki workflow
1. Tworzenie nowego artykułu:
```bash
node scripts/create-article-from-template.js \
  --slug nowy-artykul \
  --title "Tytuł artykułu" \
  --category zdrowie \
  --description "Krótki opis SEO"
```

2. Uzupełnij treść i dane SEO.

3. Walidacja standardu:
```bash
node scripts/validate-article-standard.js nowy-artykul.html
```

4. Synchronizacja do `_site`.

## Kategorie
- `ruch`
- `jedzenie`
- `zdrowie`
- `ciekawe`
