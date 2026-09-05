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

## 7. Kanoniczna procedura dodawania nowego artykułu

- Jedno polecenie użytkownika `dodaj artykuł` uruchamia `npm run article:add -- --file "<draft.fitpo50.json>"`. Obrazy są pobierane z katalogu JSON-u, chyba że agent jawnie poda `--assets-dir`.
- Nie używaj dla draftów starej ręcznej ścieżki generator → osobny importer → osobny PDF → ręczna synchronizacja. Skrypty składowe pozostają wyłącznie implementacją i narzędziami serwisowymi.
- Faza przygotowania nie dotyka publicznego HTML. Kontrole logiczne, dowody, FAQ, intencję, linki i preflight treści wykonuje przed konwersją mediów. Agent ogląda obrazy i koryguje prawdziwe podpisy; nie generuje zamienników bez polecenia użytkownika.
- Dopiero kompletny `CONTENT_READY` uruchamia jeden staging i atom obejmujący HTML, daty ISO 8601, media, PDF, listingi, sitemap, indeksy, `llms.txt`, monitoring i `_site`.
- Po sukcesie usuń roboczy pakiet JSON; przy `BLOCKED` zachowaj jedną najnowszą wersję do poprawy.

## 7a. Wewnętrzne fazy bezpiecznego przyjęcia JSON-u
- JSON od autora lub modelu jest zawsze statusem `DRAFT`, nigdy gotowym artykułem.
- Korekta i publikacja są oddzielnymi fazami technicznymi, ale pełne `dodaj artykuł` obsługuje je jedną komendą. `article:prepare-json` służy tylko do świadomego zatrzymania po korekcie; `article:publish` tylko do wznowienia gotowego artefaktu.
- Korekta nie tworzy ani nie modyfikuje HTML. Zapisuje nowy, trwały JSON oraz raport `.fitpo50.report.json` i `.fitpo50.report.md` z pełną listą zmian.
- Statusy procesu to: `DRAFT`, `CONTENT_READY`, `BLOCKED`.
- Domyślne `force=false` blokuje kolizję z istniejącym slugiem. `--force true` wymaga świadomego podania i służy wyłącznie kontrolowanej aktualizacji.
- Publikator przyjmuje tylko artefakt `CONTENT_READY`; sprawdza powiązany raport i SHA-256, więc ręczna zmiana JSON-u po korekcie blokuje import.
- Plik wejściowy pozostaje bez zmian. Domyślnie istnieje jeden stabilny pakiet roboczy dla slugu, aktualizowany przy kolejnej próbie; wersje `-r2`, `-r3` powstają wyłącznie po jawnym `--keep-revisions true`.
- Poprawne kontrole dostępności URL-i są przechowywane w lokalnym, niecommitowanym cache przez 7 dni. Zmienione obrazy odświeżają warianty; niezmienione warianty są używane ponownie. Po nieudanym atomie cały niezmieniony hashami `CONTENT_READY` może zostać użyty ponownie bez fazy przygotowania. Zmiana JSON-u lub któregokolwiek obrazu unieważnia tę pamięć. Tanie bramki treści zawsze uruchamiają się podczas nowego przygotowania.
- Po pełnej publikacji zakończonej wszystkimi walidacjami pipeline usuwa wykorzystany JSON `CONTENT_READY` oraz oba jego raporty. Przy błędzie lub `BLOCKED` zachowuje je do dalszej naprawy.

## 7b. Regression Learning Loop — obowiązkowa naprawa systemowa

- Każdy nowy błąd ujawniony podczas `dodaj artykuł`, `Obal mit`, `UPDATE`, stagingu albo walidacji musi zostać poprawiony zarówno w bieżącym artykule, jak i w mechanizmie, który go przepuścił lub błędnie zgłosił.
- Najpierw określ klasę przyczyny: dane JSON, logika treści, dowody/FAQ, intencja/linki, media, importer/fixer, szablon HTML, PDF, transakcja publikacji albo monitoring.
- Jeśli przypadek jest wykrywalny maszynowo, dodaj minimalny test regresji lub fixture odtwarzający problem. Test powinien nie przechodzić przed poprawką i przechodzić po niej.
- Nie wolno: naprawić wyłącznie finalnego HTML-a, dodać wyjątku dla jednego slugu, zmienić błędu na warning ani obniżyć progu jakości tylko po to, aby publikacja przeszła.
- Jeśli bezpieczna automatyzacja nie jest możliwa, dodaj jednoznaczną ręczną kontrolę do właściwej sekcji tego dokumentu i wskaż ją w raporcie publikacji.
- Po zmianie uruchom test jednostkowy/regresyjny, `npm run test:pipeline-blockers`, walidację artykułu, mirror i `predeploy:check`. Zadanie jest zakończone dopiero po PASS bieżącego artykułu i zabezpieczenia przyszłych publikacji.

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
  - jeden krótki akapit podsumowania (`p`) złożony z 1–3 pełnych, konkretnych zdań; kropka dziesiętna nie jest końcem zdania.
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

## 10a. Intent, Linking & Topic Center Contract
- Przed statusem `CONTENT_READY` JSON musi mieć `search_intent`, jedną `primary_keyword` długości 2-8 słów oraz 3-8 unikalnych `supporting_keywords`.
- Claude ani inny model zewnętrzny nie podaje linków wewnętrznych i nie zgaduje slugów. Linkowanie powstaje lokalnie przez `scripts/prepare-article-architecture.js` na podstawie aktualnych artykułów `BlogPosting` w repozytorium.
- Skill Claude `docs/skills/fitpo50-article-draft/` jest kontraktem oszczędnego draftu: zwraca jeden JSON `DRAFT`, notatki wyłącznie w `editorial_notes`, realne źródła/FAQ oraz plan obrazów z `PENDING_LOCAL_REVIEW`. Jego `DRAFT_VALID` nie omija lokalnych bramek i nie jest statusem publikacyjnym.
- Przed ustaleniem finalnego title/H1 pipeline porównuje frazę główną z tytułami, H1, treścią oraz trwałą mapą właścicieli intencji z `popraw-seo`. Mocny konflikt wymaga jawnego `intent_differentiation`; bez niego JSON pozostaje `BLOCKED`.
- Przy `UPDATE` własny `${slug}.html` jest wyłączony z listy kandydatów kanibalizacji; pozostałe URL-e o podobnej intencji nadal wymagają decyzji.
- Minimum 4 linki musi prowadzić do istniejących artykułów, mieć unikalne cele i naturalne anchory obecne już w konkretnych akapitach. Brak naturalnego miejsca daje `INSUFFICIENT_CONTEXTUAL_LINKS`; system nie dopisuje zdania-zapychacza.
- `internal_link_plan[]` zapisuje target, anchor, dokładną lokalizację i podstawę doboru. `incoming_link_suggestions[]` wskazuje istniejące strony, które po publikacji powinny zostać ręcznie sprawdzone jako źródła linku przychodzącego.
- Dopasowanie do centrum zapisuje `topic_center_assessment`. Tylko `STRONG` tworzy propozycję `AWAITING_USER_APPROVAL`; nie blokuje zwykłej publikacji i nie zmienia konfiguracji centrum.
- Link do `centrum-*.html` bez `topic_center_approval.status = APPROVED_BY_USER` jest błędem. Pipeline nigdy nie dodaje hub-linku tylko po to, by wypełnić limit czterech linków.

## 11. Media + Syntax Contract v2.0 (obowiązkowe)
- JSON i wszystkie obrazy wejściowe tworzą jeden katalog artykułu. Pipeline nie szuka plików rekurencyjnie, nie normalizuje przybliżonych nazw i nie pobiera zastępstwa z globalnego `assets/`.
- Wymagany jest dokładnie jeden obraz `hero` oraz jeden odrębny obraz dla każdej sekcji. `filename_base` jest dokładną nazwą kebab-case, a każdy wpis obrazu wymaga konkretnego tematu, techniki, kompozycji, celu, proporcji, altu i podpisu.
- Przed `CONTENT_READY` lokalna kontrola rzeczywistych plików zapisuje `media_manifest`: placement, temat, technikę, cel, nazwę źródła, wymiary, SHA-256, warianty oraz udokumentowany `visual_review`. Manifestu nie generuje Claude.
- Każdy obraz wymaga AVIF, WebP i fallbacku JPG o zgodnych wymiarach. Hero ma minimum 1080×600 px, obraz sekcji minimum 900×500 px, a proporcja krajobrazowa mieści się w zakresie 1.2-2.1 i zgadza z deklaracją.
- Hash i sygnatura wizualna blokują duplikaty 1:1, niemal ten sam kadr oraz wariant przedstawiający inny obraz. Dla pakietu min. 3 obrazów wymagane są min. 3 techniki i 3 kompozycje; jedna nie może zajmować więcej niż połowy pakietu.
- `alt` i `caption` muszą opisywać realną zawartość oraz mieć związek z konkretną sekcją. `visual_review.status=VERIFIED` wolno nadać dopiero po rzeczywistym obejrzeniu pliku i zapisaniu konkretnej notatki.
- Obraz z mylącą liczbą, niepowiązanym tekstem, niezgodnym kadrem lub fałszywą pewnością jest odrzucany. Pipeline nie używa go jako fallbacku.
- Obrazy w treści artykułu mają korzystać ze standardu:
  - `<picture>` + `<source type="image/avif">` + `<source type="image/webp">` + fallback `<img>`.
- W fallback `<img>` wymagane: poprawny `alt`, `loading="lazy"` oraz prawdziwe `width` i `height` z manifestu.
- Zakaz używania tagu `</source>` i deklaracji `<?xml ... ?>` w plikach HTML.

## 11a. Staging HTML, wygląd i PDF
- `article:publish` nie zapisuje pierwszej wersji HTML, listingów, sitemap, assetów ani PDF bezpośrednio do repozytorium. Najpierw klonuje witrynę do izolowanego katalogu systemowego z pominięciem `.git` i wykonuje tam pełny import.
- Bezpośredni zapis przez `scripts/import-article.js` i ręczne uruchomienie prywatnego `--staging-internal` są blokowane. Publiczne pliki mogą zostać promowane wyłącznie przez kontroler stagingu.
- Staging renderuje pełną stronę przy 1440 px i 390 px. Bramka blokuje przepełnienie poziome, tekst mniejszy niż 10 px, niezaładowane fonty, uszkodzone ilustracje i niezgodne proporcje `width`/`height`.
- Animacje `reveal` oraz obrazy lazy-load są aktywowane przed zrzutem, aby screenshot przedstawiał finalny układ, a nie niewidoczne elementy oczekujące na IntersectionObserver.
- Każda tabela musi pozostać semantycznym HTML w `.article-table-wrap` i mieć bezpośrednie `caption`, `thead`, `tbody`, nagłówki `th`, `scope="col"` w `thead` oraz `scope="row"` dla nagłówków w `tbody`. Obraz udający tabelę nie spełnia kontraktu.
- Fixer/importer nie może owijać bloków `table`, `div`, `figure`, `aside`, list, `blockquote` ani `pre` znacznikiem `<p>`.
- PDF powstaje wyłącznie ze stagingowego HTML. Błąd renderowania tabeli lub ilustracji zatrzymuje generowanie; generator nie zamienia tabeli po cichu na tekst rozdzielony kreskami i nie pomija niedziałającego obrazu.
- Każda strona PDF jest renderowana przez Poppler do PNG. Bramka kontroluje liczbę stron, A4, osadzenie fontów z mapą Unicode, granice każdego słowa, margines treści, komplet ilustracji oraz minimum 98% zgodności tekstu HTML→PDF.
- Wszystkie wyrenderowane strony PDF trzeba obejrzeć. Lista źródeł wraz z disclaimerem ma pozostać czytelnym blokiem i nie może być przypadkowo rozdzielona między strony.
- HTML source i `_site` oraz PDF source i `_site` muszą być identyczne 1:1. Po pełnym PASS powstaje raport `data/reports/article-preview/<slug>.json|md` ze statusem `PREVIEW_READY`.
- Poprawki `popraw-seo` po akceptacji mogą być wdrażane wyłącznie przez manifest dokładnych operacji `replace_exact` z SHA-256 wersji wejściowej i udokumentowaną podstawą. Automat nie generuje tekstu podczas aplikacji i nie używa generycznych łączników.
- Każdy zmieniony artykuł — target oraz strona źródłowa z nowym linkiem — otrzymuje nowe `dateModified`, PDF, mirror, sitemap lastmod, render desktop/mobile/PDF i walidację.
- Lokalny PASS nie tworzy kolejki GSC. Wymagany jest dowód produkcyjny `LIVE_DEPLOYED_AND_VALIDATED`: HTTP 200, canonical, zgodne `dateModified`, obecność zatwierdzonego fragmentu, sitemap lastmod oraz prawidłowy PDF.
- Promocja do repo jest transakcyjna: przed zapisem system sprawdza, czy żaden plik docelowy nie zmienił się podczas stagingu, kopiuje wyłącznie dozwolone artefakty i przy błędzie przywraca wcześniejsze wersje.

## 11b. Safe Publication & Rollback Contract
- Publikacja ma dwa jawne tryby: `CREATE` dla nowego slugu oraz `UPDATE` dla istniejącego slugu. `UPDATE` wymaga `--force true`; bez tego pipeline zatrzymuje się przed stagingiem.
- Jedna transakcja obejmuje cały zestaw: HTML artykułu, media AVIF/WebP/JPG, PDF, `index.html`, `porady.html`, stronę kategorii, `sitemap.xml`, `llms.txt`, `llms-full.txt`, indeks wyszukiwarki, raport podglądu, log publikacji oraz odpowiadające pliki w `_site`.
- Przed pierwszym zapisem powstaje backup wszystkich nadpisywanych plików wraz z SHA-256. Backup pozostaje aktywny aż do zakończenia walidacji już promowanego repozytorium.
- Transakcja prowadzi dziennik w ignorowanym przez Git katalogu `.tmp/article-publication-transactions`. Po nagłym przerwaniu następne uruchomienie najpierw przywraca stan sprzed publikacji; niezależnie zmieniony plik blokuje automatyczne cofnięcie zamiast zostać nadpisany.
- Po promocji ponownie przechodzą: standard artykułu, kontrakt source/`_site`, kontrola mirroru, gate `predeploy` i kompletność całego zestawu. Błąd któregokolwiek kroku wywołuje rollback wszystkich plików, w tym usunięcie plików utworzonych przez nieudaną publikację.
- Udana transakcja zapisuje `data/reports/article-publications/<slug>.json`. Manifest podaje `CREATE`/`UPDATE`, identyfikator transakcji, wszystkie zmienione pliki, akcję `CREATE`/`UPDATE`, rozmiar oraz hashe przed i po publikacji.
- Backup i dziennik są usuwane dopiero po statusie `COMMITTED`. IndexNow i usunięcie wykorzystanego artefaktu `CONTENT_READY` następują dopiero po zatwierdzeniu transakcji.
- Półgotowy zestaw nie może być uznany za publikację: brak artykułu w listingu, sitemapie, `llms`, indeksie wyszukiwarki, brak PDF/media albo rozjazd wymaganej pary source/`_site` jest błędem blokującym.

## 12. Schema Citation Contract v2.0 (obowiązkowe)
- `BlogPosting.citation` musi być zsynchronizowane z listą źródeł w HTML.
- Wymagane minimum 4 realne, zweryfikowane i wykorzystane URL-e w `citation` oraz liście źródeł HTML.
- Kategoryczny zakaz dopisywania zmyślonych źródeł tylko po to, by dobić do minimum.

## 12a. Logic, Evidence & FAQ Contract
- Kontrola odwołań „poniżej”/„powyżej” obejmuje także sekcję źródeł: odsyłacz musi odpowiadać rzeczywistemu położeniu FAQ w HTML i PDF. Przy zmianie układu użyj jednoznacznej nazwy sekcji.
- Centrum tematyczne zachowuje układ `hub-shell/main/hub-title` i przechodzi [kontrakt centrów](docs/topic-center-pipeline.md), w tym research, mapę tez, źródła, PDF i pełną kontrolę desktop/mobile. Nie wolno naprawiać go przez wymuszanie klas szablonu zwykłego artykułu.
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
- Błąd transportu otrzymuje status `verification_failed`, a rzeczywista odpowiedź HTTP wskazująca niedostępny adres status `broken`; obu nie wolno traktować jako `reachable`.
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
- Artykuł mitu zawiera semantyczną tabelę `MIT`–`FAKT/DOWODY` oraz wyjaśnienie mechanizmu w FAQ tylko wtedy, gdy istnieje realne pytanie z GSC/PAA/autocomplete/udokumentowanego researchu.
- Ton: spokojny, kumpelski, bez moralizowania i bez języka oskarżającego konkretne firmy/osoby.
- `ClaimReview` dodawaj tylko wtedy, gdy artykuł obala jedno precyzyjne, popularne twierdzenie i da się podać jasny werdykt oraz źródła. Przy artykułach zbiorczych typu "5 mitów" nie dodawaj jednego sztucznego `ClaimReview`.
