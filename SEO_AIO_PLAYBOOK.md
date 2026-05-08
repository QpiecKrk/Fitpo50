# SEO/AIO Playbook (FitPo50)

## 1) Checklista "AI-ready article" (redakcja)

Stosuj dla nowego artykulu i dla aktualizacji starszego URL.

### A. Intencja i odpowiedz
- [ ] Glowna intencja pytania jest jedna i konkretna.
- [ ] Na gorze artykulu jest blok "Szybka odpowiedz" (40-60 slow).
- [ ] "Szybka odpowiedz" odpowiada 1:1 na glowne pytanie bez wodolejstwa.

### B. Struktura pod ekstrakcje AI
- [ ] H2 sa zapisane jako pytania (np. "Czy...?", "Jak...?", "Kiedy...?").
- [ ] Po kazdym H2 jest krotka odpowiedz (2-4 zdania), potem dopiero rozwiniecie.
- [ ] W artykule sa minimum 4 linki wewnetrzne osadzone w akapitach.
- [ ] Jest sekcja FAQ dla czytelnika (min. 4 pytania).

### C. Schema i wiarygodnosc
- [ ] `BlogPosting` jest kompletne i spojne z HTML.
- [ ] `FAQPage` jest 1:1 zgodne z widocznym FAQ.
- [ ] `SpeakableSpecification` zawiera:
  - `.article-header__title`
  - `.article-content > p:first-of-type`
  - `.key-takeaways h2`
  - `.key-takeaways li`
- [ ] Daty sa poprawne ISO (`datePublished`, `dateModified`, `article:*_time`).
- [ ] Sekcja `Zrodla` ma realne linki URL do publikacji/instytucji.

### D. CTR i klikalnosc
- [ ] `title` <= 65 znakow, jasny benefit i obietnica konkretu.
- [ ] `meta description` 145-160 znakow, jezyk korzysci i konkret.
- [ ] Wstep nie duplikuje title; dodaje kontekst "dla kogo i po co".

### E. Operacyjnie (repo)
- [ ] Artykul jest zsynchronizowany w source i `_site`.
- [ ] `porady.html`, strona kategorii, `index.html`, `sitemap.xml`, `llms.txt` sa zaktualizowane (jesli dotyczy nowego wpisu).
- [ ] PDF jest wygenerowany i jest w `assets/pdf/` oraz `_site/assets/pdf/`.
- [ ] PASS: `npm run assets:mirror:sync` i `npm run predeploy:check`.

---

## 2) Poniedzialkowy audyt GSC (60-90 min)

## Cel
Wylapac 3 typy szans:
1. zapytania z pozycja 1-3 i 0 klikow,
2. kanibalizacja (2+ URL na jedno zapytanie),
3. wysokie impresje i brak dedykowanego artykulu (content gap).

## Krok po kroku
1. Eksport z GSC (zakres 28 dni):
   - Queries: `query, clicks, impressions, ctr, position`
   - Pages: `page, clicks, impressions, ctr, position`
   - Queries + Pages (zestawienie query->url)
2. Wrzucenie CSV do Claude/ChatGPT z promptem:
   - "Znajdz: (a) P1-3 i 0 klikow, (b) kanibalizacje, (c) CTR-problemy dla URL z top impresjami."
3. Priorytetyzacja:
   - Priorytet A: `position <= 3.0` AND `clicks = 0` AND `impressions >= 100`
   - Priorytet B: `position <= 10` i CTR ponizej mediany dla tego typu strony
   - Priorytet C: query z impresjami bez dedykowanego URL
4. Plan tygodnia:
   - 2-3 nowe artykuly pod content gap
   - 3-5 aktualizacji URL pod CTR i AI extraction
5. Po wdrozeniu:
   - recrawl: GSC "Request indexing"
   - kontrola po 7 i 14 dniach (mini-retro)

## Tabela robocza (kopiuj co tydzien)

| Typ | Query | URL | Clicks | Impressions | CTR | Position | Decyzja |
|---|---|---|---:|---:|---:|---:|---|
| P1-3/0 click |  |  |  |  |  |  | Quick Answer + title/description + FAQ |
| Kanibalizacja |  |  |  |  |  |  | Scal/rozroznij intencje URL |
| Content gap |  |  |  |  |  |  | Nowy artykul |

---

## 3) Pierwsze 10 URL-i do optymalizacji (kolejnosc startowa)

Uwaga: to kolejka startowa oparta o potencjal zapytan i szerokosc intencji. Po pierwszym eksporcie GSC doprecyzujemy ja liczbowo.

1. `https://fitpo50.pl/powrot-do-formy-po-50-kompletny-przewodnik.html`
2. `https://fitpo50.pl/jak-zaczac-na-silowni-po-50.html`
3. `https://fitpo50.pl/trening-3x30-dla-50-plus.html`
4. `https://fitpo50.pl/suplementacja-po-50.html`
5. `https://fitpo50.pl/sen-po-50.html`
6. `https://fitpo50.pl/dieta-po-50.html`
7. `https://fitpo50.pl/bieganie-niszczy-kolana.html`
8. `https://fitpo50.pl/siedem-bledow-silownia-po-50.html`
9. `https://fitpo50.pl/sila-chwytu-po-50.html`
10. `https://fitpo50.pl/badania-po-50.html`

## Co zrobic na kazdym z 10 URL (szablon)
- Dodac/udoskonalic "Szybka odpowiedz" 40-60 slow.
- Przepisac H2 na pytania (bez zmiany sensu merytoryki).
- Sprawdzic FAQ (min. 4 Q/A) + schema `FAQPage` 1:1.
- Podbic CTR: test 1 nowego title + 1 nowej meta description.
- Dodac 2-3 mocne linki wewnetrzne z URL o wysokich impresjach.
