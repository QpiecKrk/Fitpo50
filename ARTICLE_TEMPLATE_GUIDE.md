# Article Template Guide (FitPo50)

Dokument serwisowy wyłącznie dla ręcznych prototypów HTML. Nie stosuj go do JSON-u od Claude ani do polecenia `dodaj artykuł`; kanoniczny workflow JSON-first jest w `ARTICLE_STANDARD.md` i używa `article:add`.

## Pliki
- Szablon: `article-template-bento.html`
- Generator: `scripts/create-article-from-template.js`
- Walidator: `scripts/validate-article-standard.js`

## Ręczny workflow serwisowy (niepublikacyjny)
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

4. Nie publikuj ani nie synchronizuj tą ścieżką. Gotową treść przenieś do JSON-first i uruchom `article:add`.

## Kategorie
- `ruch`
- `jedzenie`
- `zdrowie`
- `ciekawe`
