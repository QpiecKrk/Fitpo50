# ARTICLE STANDARD (FitPo50)

Ten dokument definiuje kanoniczny standard artykułów. Obowiązuje dla wszystkich nowych publikacji.

## 0. Zero Generic Text
- Każda zmiana w tekście artykułu musi być konkretna, logiczna i oparta o treść artykułu, dane GSC/PAA/autocomplete, sprawdzone źródło, konkretną liczbę/próg albo jasny warunek bezpieczeństwa.
- Zakaz dotyczy także drobnych edycji technicznych, SEO/AEO/GEO/AIO, title/meta, leadów, quick answers, FAQ, H2, linkowania, anchorów, opisów grafik, tabel, Evidence Box, calloutów i podpisów.
- Nie wolno dopisywać ogólników, zapychaczy ani „ładnych” zdań, które nie wnoszą konkretnej informacji dla czytelnika.
- Jeśli brakuje danych lub źródeł do poprawki, oznacz `INSUFFICIENT_DATA` i zatrzymaj edycję zamiast zgadywać.

## 0A. Logic Gate
- Tekst z JSON-a, Claude albo innego modelu zewnętrznego jest tylko draftem. Nie wolno uznać go za gotowy bez kontroli logicznej akapit po akapicie.
- Każdy akapit musi być zrozumiały sam w miejscu, w którym stoi. Jeśli zaczyna się od „ta obietnica”, „ta reklama”, „taki przekaz”, „to zdanie”, „ten wniosek” albo „haczyk jest prosty”, musi w tym samym akapicie jasno nazwać konkretną obietnicę, twierdzenie, mechanizm lub liczbę, do której się odnosi.
- Metafora lub analogia musi być domknięta mechanizmem. Nie wystarczy napisać, że coś „nie jest korkiem w zlewie”; ten sam fragment musi dopowiedzieć, co naprawdę robi limfa, tłuszcz, energia, deficyt albo inny opisywany mechanizm.
- Wniosek musi wynikać z poprzedniego zdania, źródła, liczby, warunku bezpieczeństwa albo fizjologii opisanej w tekście. Niedopuszczalne są skoki typu: prawdziwe pojęcie -> fałszywy wniosek bez wyjaśnienia przejścia.
- Blok „Najważniejsze”, tabela, podpis grafiki, FAQ i quick answer podlegają tej samej kontroli. Krótkie podsumowanie nie może ucinać logiki ani zostawiać czytelnika z pytaniem „jaka obietnica?”, „jaka reklama?”, „dlaczego?”.
- `article-preflight` ma traktować wykryte skróty logiczne jako błąd blokujący dla nowych JSON-ów.

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
- `article--mity`: `#b4233a` / `#ffffff`

## 6. Tokeny i globalna edycja
Zmiany globalne robimy przez tokeny CSS w `style.css`:
- fonty: `--font-display`, `--font-body`, `--font-ui`
- breakpointy: `--bp-mobile`, `--bp-phone-dark`, `--bp-topbar-collapse`
- promienie/spacing/typografia: `--radius-*`, `--space-*`, `--text-*`
- kolory kategorii: `--category-*`

Zasada: „zmień raz, zmień wszędzie”.

## 7. Procedura dodawania nowego artykułu
1. Generator:
`node scripts/create-article-from-template.js --slug <slug> --title "<tytuł>" --category <ruch|jedzenie|zdrowie|ciekawe|mity> --description "<opis>"`
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
`npm run article:pdf:builder -- --slug <slug>`
albo hurtowo:
`npm run article:pdf:sync`
7. Synchronizacja do `_site`.
8. Kontrola końcowa:
- nowy wpis jest widoczny w `porady.html` i na stronie kategorii,
- sekcja "Nowy artykuł" na `index.html` wskazuje ten wpis.
- Po publikacji nie zostawiaj w repo roboczego JSON-a z `data/import/*.fitpo50.json`, jeśli finalny HTML jest gotowy i JSON nie jest potrzebny do produkcji.

## 7a. Bezpieczne przyjęcie JSON-u
- JSON od autora lub modelu jest zawsze statusem `DRAFT`, nigdy gotowym artykułem.
- Korekta i publikacja są dwoma osobnymi poleceniami:
  1. `npm run article:prepare-json --file="<draft.fitpo50.json>"`
  2. po otrzymaniu statusu `CONTENT_READY`: `npm run article:publish --file="<gotowy.fitpo50.json>"`
- Korekta nie tworzy ani nie modyfikuje HTML. Zapisuje nowy, trwały JSON oraz raport `.fitpo50.report.json` i `.fitpo50.report.md` z pełną listą zmian.
- Statusy procesu to: `DRAFT`, `CONTENT_READY`, `BLOCKED`.
- Domyślne `force=false` blokuje kolizję z istniejącym slugiem. `--force true` wymaga świadomego podania i służy wyłącznie kontrolowanej aktualizacji.
- Publikator przyjmuje tylko artefakt `CONTENT_READY`; sprawdza powiązany raport i SHA-256, więc ręczna zmiana JSON-u po korekcie blokuje import.
- Plik wejściowy pozostaje bez zmian. Kolejne wyniki dostają wersje `-r2`, `-r3` itd.; narzędzie nie nadpisuje ani nie usuwa jedynej poprawionej wersji.
- Po pełnej publikacji zakończonej wszystkimi walidacjami pipeline usuwa wykorzystany JSON `CONTENT_READY` oraz oba jego raporty. Przy błędzie lub `BLOCKED` zachowuje je do dalszej naprawy.

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
- Reguła wizualna (obowiązkowa):
  - akapit `quick-answer` ma być zawsze wyróżniony jako box (jasne tło, lewa belka akcentu, obramowanie, zaokrąglenie),
  - nagłówek `Szybka odpowiedź` ma mieć dolny akcent (krótka linia),
  - niedozwolony jest wariant „zwykły paragraf bez wyróżnienia”.

## 8b. Hero + Share Contract (obowiązkowe)
- Motto pod hero (`.hero-motto`):
  - styl ma być czytelny i elegancki, bez fontu odręcznego,
  - obowiązuje wariant display italic z `article.css` (bez lokalnych nadpisań inline).
- Akcje pod hero:
  - wymagany wrapper `.article-primary-actions`,
  - wymagane dwa elementy obok siebie (desktop) / jeden pod drugim (mobile):
    - `a.pdf-hero-download` (Pobierz PDF),
    - `button#share-article-top.pdf-hero-download.pdf-hero-download--share` (Udostępnij).
- Badge przycisku „Udostępnij”:
  - ma mieć ten sam styl i czytelność co badge `PDF`,
  - różni się wyłącznie etykietą `SHARE` (bez zmiany kolorystyki badge).
- Sekcja udostępniania przed źródłami:
  - obowiązkowa sekcja `section.share-article-section` z nagłówkiem `Udostępnij artykuł`,
  - musi znajdować się przed sekcją `Źródła`,
  - ma zawierać kanały: Facebook, LinkedIn, WhatsApp, mail, kopiowanie linku.

## 9. Guardrails SEO/AEO (obowiązkowe)
- `<title>`: celuj w 55-65 znaków (max 65).
- `meta name="description"`: wymagane 145-160 znaków, pełne zdanie zakończone `.`, `!` lub `?`.
- Opis SEO musi być identyczny 1:1 w 4 polach:
  - `<meta name="description">`
  - `<meta property="og:description">`
  - `<meta name="twitter:description">`
  - `BlogPosting.description` w JSON-LD
- W `BlogPosting` dodawaj `speakable` (`SpeakableSpecification`) ze wskazaniem:
  - `.article-header__title`
  - `.article-content > p:first-of-type`
  - `.key-takeaways h2`
  - `.key-takeaways li`
- Sekcja `.key-takeaways` ma być wysoko w treści:
  - po leadzie/wstępie, przed pierwszym głównym blokiem sekcji.

## 10. Content + Linking Contract v2.0 (obowiązkowe)
- Pytające nagłówki H2 (np. zaczynające się od `Czy`, `Jak`, `Dlaczego`, `Ile`, `Kiedy`) muszą kończyć się `?`.
- Pierwszy akapit pod każdym H2 (lead sekcji) musi mieć 30-70 słów.
- Każdy artykuł musi mieć min. 4 sensowne linki wewnętrzne do istniejących artykułów.
- Linki wewnętrzne w treści mają być wyłącznie względne (`href="slug-artykulu.html"`), bez `https://fitpo50.pl/...`.
- Tabele w artykułach mają być dopracowane wizualnie: wrapper `.article-table-wrap`, tabela `.article-table` oraz w razie potrzeby `.article-table--compact`; każda tabela wymaga konkretnego `<caption>`, krótkich komórek, czytelnych nagłówków i nie może być zawinięta w `<p><table>`.

## 11. Media + Syntax Contract v2.0 (obowiązkowe)
- Obrazy w treści artykułu mają korzystać ze standardu:
  - `<picture>` + `<source type="image/avif">` + `<source type="image/webp">` + fallback `<img>`.
- W fallback `<img>` wymagane: poprawny `alt` oraz `loading="lazy"`.
- Zakaz używania tagu `</source>` i deklaracji `<?xml ... ?>` w plikach HTML.

## 12. Schema Citation Contract v2.0 (obowiązkowe)
- `BlogPosting.citation` musi być zsynchronizowane z listą źródeł w HTML.
- Wymagane minimum 4 URL-e w citation, jeśli faktycznie istnieją w materiale źródłowym.
- Kategoryczny zakaz dopisywania zmyślonych źródeł tylko po to, by dobić do minimum.

## 12a. Logic, Evidence & FAQ Contract
- Każdy akapit, quick answer, wniosek, FAQ, info box, takeaway i podpis grafiki przechodzi kontrolę logiczną.
- Odniesienia typu „ta obietnica”, „ta reklama”, „taki przekaz”, „to zdanie” i „ten wniosek” muszą w tym samym fragmencie nazwać dokładne twierdzenie.
- Metafora musi w tym samym fragmencie zostać domknięta rzeczywistym mechanizmem. Sam obraz „korka”, „silnika”, „resetu” albo „tarczy” jest błędem blokującym.
- Każde twierdzenie medyczne, dotyczące bezpieczeństwa, liczby, ceny, mechanizmu lub statystyki wymaga wpisu w `evidence_claims[]`:
```json
{
  "claim": "Badanie wykazało zmniejszenie ryzyka o 20%",
  "location": "sections[0].paragraphs_html[0]",
  "claim_type": "medical",
  "source_urls": ["https://pubmed.ncbi.nlm.nih.gov/..."]
}
```
- `claim` musi występować w dokładnie wskazanym fragmencie, a każdy URL musi istnieć również w `sources[]`.
- Każde `sources[]` wymaga pól `label`, `url`, `evidence_level`, `checked_at`, `url_status`, `http_status`. `evidence_level` musi nazywać faktyczny rodzaj dowodu, np. `guideline`, `systematic_review`, `randomized_trial`, `cohort`, `official_statistics`, `price_list` albo `technical_documentation`. Kontrola adresu jest ważna maksymalnie 180 dni.
- Jeśli wniosek wynika z wcześniejszych akapitów zamiast z bezpośredniego źródła, JSON wymaga `logic_links[]` z `conclusion_location`, listą `premise_locations` i konkretnym `reasoning` opisującym przejście od przesłanek do wniosku.
- Każde źródło musi wspierać co najmniej jedno `evidence_claims`; niewykorzystana, dekoracyjna bibliografia blokuje publikację.
- Twierdzenia `medical` i `safety` wymagają silnego źródła naukowego lub instytucjonalnego oraz jawnego `evidence_level`. Dla tematów medycznych minimum 67% źródeł i co najmniej dwa źródła muszą spełniać ten warunek.
- FAQ nie jest nigdy generowane ani uzupełniane automatycznie. `answer_blocks[]` i `faq_research[]` muszą odpowiadać sobie 1:1.
- Każdy wpis `faq_research[]` wymaga `source_type`: `autocomplete`, `paa`, `gsc` albo `manual_research`, a także `checked_at`, `url_status` i `http_status`.
- `gsc` wymaga realnego `query` i `impressions >= 1`; `paa` wymaga `query` i opisu kontroli; `manual_research` wymaga konkretnego `research_note`; `autocomplete` wymaga rzeczywistego endpointu Google Suggest z pytaniem w parametrze `q`.
- Pytania zawierające sztuczne oznaczenia typu „wariant 2” są błędem blokującym.
- URL-e sprawdza polecenie: `npm run article:evidence:verify -- --file <plik.fitpo50.json> --write true`.

## 13. Myth Article Contract (`Mity`)
- Kategoria `Mity` jest osobnym działem (`mity.html`), nie aliasem `Ciekawe`.
- Wymagane oznaczenia techniczne:
  - `body.article--mity`,
  - `article:section` = `Mity`,
  - karta w `porady.html` i `mity.html` z `data-category="mity"`,
  - wpis w `llms.txt` z `section: "Mity"`.
- Rytm treści:
  1. nazwij mit bez atakowania ludzi,
  2. daj krótki werdykt FitPo50,
  3. pokaż fizjologię i jakość dowodów,
  4. zakończ praktycznym "co działa zamiast tego".
- Ton: spokojny, kumpelski, bez moralizowania i bez języka oskarżającego konkretne firmy/osoby.
- `ClaimReview` dodawaj tylko wtedy, gdy artykuł obala jedno precyzyjne, popularne twierdzenie i da się podać jasny werdykt oraz źródła. Przy artykułach zbiorczych typu "5 mitów" nie dodawaj jednego sztucznego `ClaimReview`.
