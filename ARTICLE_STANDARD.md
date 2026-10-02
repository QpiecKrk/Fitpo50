# ARTICLE STANDARD (FitPo50)

Ten dokument definiuje kanoniczny standard artykułów. Obowiązuje dla wszystkich nowych publikacji oraz całych artykułów aktualizowanych dowolną ścieżką, w tym przez `popraw-seo` i `napraw paczkę N`, niezależnie od wielkości zmiany.

## Pełna walidacja nowych i aktualizowanych artykułów

- Każdy nowy artykuł i każdy artykuł zmieniany przez import, ręczną aktualizację, `popraw-seo` lub `napraw paczkę N` musi spełnić wszystkie aktualne wymagania tego dokumentu i przejść ten sam pełny zestaw bramek. Dotyczy to całej strony, także niezmienionych sekcji i stron otrzymujących link przychodzący w ramach zatwierdzonej naprawy. Wiek publikacji, wcześniejszy PASS ani drobna korekta title/meta nie zwalniają z żadnej bramki.
- Zakres obejmuje logikę i kompletność treści; weryfikację źródeł i mapowanie twierdzeń do dowodów; bezpieczeństwo, liczby, ceny i aktualność; pochodzenie FAQ; intencję, SEO/AEO/GEO/AIO, kanibalizację i linkowanie; tytuły, opisy, nagłówki i dane strukturalne; szablon, semantykę, tabele i dostępność; rzeczywistą kontrolę obrazów, ich wariantów, wymiarów, altów i podpisów; staging desktop/mobile; PDF oraz obejrzenie wszystkich jego stron; daty, listingi, indeksy, sitemap i zgodność HTML/PDF/mediów z `_site`; pełne walidatory i kontrolę produkcji. Ta lista nie ogranicza pozostałych wymagań standardu.
- Dla istniejącego HTML-a odtwórz roboczy pakiet walidacyjny z aktualnej treści, rzeczywistych mediów i zweryfikowanych źródeł, jeżeli wymaga go bramka nowych artykułów. Nie wymyślaj `evidence_claims`, `faq_research`, wyników kontroli obrazów ani innych deklaracji tylko po to, aby uzyskać PASS. Brak starego JSON-u nie uprawnia do pominięcia preflight treści, dowodów lub architektury.
- Kontrole automatyczne i rzeczywisty przegląd redakcyjny oraz wizualny są obowiązkowe łącznie. Sam PASS walidatora HTML, poprawny HTTP źródła lub wypełniony formularz dowodów nie potwierdzają jakości merytorycznej.
- Dla każdego URL-a zapisz wyniki wszystkich bramek, dowody kontroli oraz wersję lub hashe sprawdzonych plików. Brak wykonanej kontroli oznacza etap nieukończony; błąd blokuje publikację. Napraw wykryte problemy w zatwierdzonym zakresie, ponów właściwe kontrole i dopiero po pełnym PASS przejdź do kolejnego etapu. Jeśli naprawa jest zablokowana, podaj konkretną przyczynę; nie osłabiaj wymagań ani nie oznaczaj pominiętej kontroli jako PASS.
- Walidacja istniejącej strony nie oznacza tworzenia nowego URL-a ani ponownego generowania poprawnych obrazów. Zachowaj tożsamość artykułu i używaj trybu aktualizacji. Niezmienione materiały mogą zostać użyte ponownie, jeśli spełniają aktualne wymagania i zostały objęte kontrolą. Centra tematyczne przechodzą właściwy kontrakt centrów zamiast szablonu zwykłego artykułu.
- Zatwierdzenie ID lub paczki uruchamia pełny proces naprawy i walidacji; nie stanowi potwierdzenia jakości istniejącej treści.

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
- Zapis importera jest prywatnym etapem kontrolera: wymaga aktywnego manifestu stagingu, krótkotrwałej capability związanej z katalogiem i osobnego uprawnienia operacji. Sama flaga środowiskowa, bezpośrednie wywołanie `import-article.js` albo wskazanie poprawnego `CONTENT_READY` nie wystarcza.
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
- Liczba głównych sekcji wynika wyłącznie z intencji i zakresu tematu. Nie obowiązuje minimalna liczba sekcji. Artykuł ma wyczerpywać istotne pytania bez dopisywania bloków dla długości, symetrii szablonu lub wyniku walidatora.
- Każda sekcja musi wnosić konkretną odpowiedź, mechanizm, decyzję praktyczną, ograniczenie dowodu albo potrzebny kontekst. Generyczne wstępy, powtórzenia, parafrazy wcześniejszych sekcji i tekst bez sprawdzalnej wartości blokują publikację.
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
- Wymagany jest dokładnie jeden obraz `hero` oraz jeden odrębny obraz dla każdej merytorycznej sekcji głównej. Sekcje użytkowe, takie jak szybka odpowiedź, udostępnianie, źródła, disclaimer i czytelnia, nie tworzą zapotrzebowania na osobny obraz. Liczba obrazów wynika z realnej architektury tematu, a nie ze stałego minimum. `filename_base` jest dokładną nazwą kebab-case, a każdy wpis obrazu wymaga konkretnego tematu, techniki, kompozycji, celu, proporcji, altu i podpisu.
- Przed `CONTENT_READY` lokalna kontrola rzeczywistych plików zapisuje `media_manifest`: placement, temat, technikę, cel, nazwę źródła, wymiary, SHA-256, warianty oraz udokumentowany `visual_review`. Manifestu nie generuje Claude.
- Kontrola wizualna ocenia zgodność obrazu z sekcją, prawdziwość widocznego tekstu i liczb, poprawność anatomii oraz sprzętu, kadr i brak mylących logo. Nowy lub zmieniony przegląd jest częścią raportu preview `version=3`. Każdy obraz deklaruje `embedded_text.kind`: `NONE`, `WATERMARK_ONLY` albo `CONTENT`. Tekst treściowy zawierający liczbę lub twierdzenie wymaga transkrypcji, zgodności z artykułem i URL-i dowodów. Sam watermark nie jest błędem blokującym. Dawne raporty v1/v2 są zamrożonym legacy i nie wolno ich odtwarzać po zmianie HTML albo obrazu.
- Każdy obraz wymaga AVIF, WebP i fallbacku JPG o zgodnych wymiarach. Hero ma minimum 1080×600 px, obraz sekcji minimum 900×500 px, a proporcja krajobrazowa mieści się w zakresie 1.2-2.1 i zgadza z deklaracją.
- Obrazy w `assets/` są wysyłane z rocznym cache `immutable`. Zmiana zawartości obrazu wymaga nowej, wersjonowanej nazwy pliku oraz aktualizacji wszystkich odwołań w źródle, metadanych, manifeście mediów i `_site`. Nie wolno nadpisywać istniejącego obrazu pod tym samym publicznym URL-em.
- Hash i sygnatura wizualna blokują duplikaty 1:1, niemal ten sam kadr oraz wariant przedstawiający inny obraz. Spójna seria może używać tej samej techniki lub stylu; review blokuje powtarzalne kadry, generyczność i obrazy bez wartości, a nie nazwy technik wpisane w manifeście.
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
- Klasa `.sources-list` należy wyłącznie do elementu `<ol>`. Nie wolno nadawać jej zewnętrznemu wrapperowi, ponieważ podwójne marginesy i wcięcia powodują przepełnienie na mobile; długie adresy źródeł muszą mieć wymuszone bezpieczne zawijanie.
- Fixer/importer nie może owijać bloków `table`, `div`, `figure`, `aside`, list, `blockquote` ani `pre` znacznikiem `<p>`.
- PDF powstaje wyłącznie ze stagingowego HTML. Błąd renderowania tabeli lub ilustracji zatrzymuje generowanie; generator nie zamienia tabeli po cichu na tekst rozdzielony kreskami i nie pomija niedziałającego obrazu.
- Każda strona PDF jest renderowana przez Poppler do PNG. Bramka kontroluje liczbę stron, A4, osadzenie fontów z mapą Unicode, granice każdego słowa, margines treści, komplet ilustracji oraz minimum 98% zgodności tekstu HTML→PDF.
- Bramka stagingowa zbiera niezależnie błędy HTML i PDF. Wykryty wcześniej błąd mobilny nie może przerwać kontroli struktury, tekstu, obrazów ani renderów PDF.
- Wszystkie wyrenderowane strony PDF trzeba obejrzeć. Lista źródeł wraz z disclaimerem ma pozostać czytelnym blokiem i nie może być przypadkowo rozdzielona między strony.
- HTML source i `_site` oraz PDF source i `_site` muszą być identyczne 1:1. Kanoniczny raport `data/reports/article-preview/<slug>.json|md` ma `version=3`: automat może nadać wyłącznie `TECHNICAL_PASS` i `VISUAL_REVIEW_PENDING`. `PREVIEW_READY` powstaje dopiero po osobnym `VISUAL_REVIEW_VERIFIED` z `reviewed_by`, `reviewed_at`, metodą, wynikiem desktopu, mobile, każdego obrazu z kanonicznego DOM inventory i każdej strony PDF. Zmiana kontrolowanego pliku lub kontekstu unieważnia właściwy dowód. Po zmianie wyłącznie meta/SEO wolno przenieść wcześniejszy review konkretnego obrazu tylko przy identycznym `inventory_sha256` i z zachowaniem pierwotnych danych reviewera; desktop, mobile i PDF wymagają bieżącego potwierdzenia. Rendery pozostają prywatne w zarządzanym stagingu do końca aktywnej transakcji i nie trafiają do Git ani `_site`. Raporty v1/v2 są wyłącznie zamrożonym legacy.
- Walidatory HTML nie mogą zależeć od kolejności atrybutów w poprawnym znaczniku. Meta, linki, nagłówki, wrappery tabel i pozostałe kontrakty rozpoznają atrybuty po nazwie i wartości.
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
- Kontrola końcowa tworzy świeży, pełny eksport i porównuje go z `_site` plik po pliku. Osobno raportuje brak, nadmiar i różnicę zawartości w klasach HTML, PDF, dane i assety; synchronizacja wybranych assetów nie może maskować różnicy HTML.

## 12. Schema Citation Contract v2.0 (obowiązkowe)
- `BlogPosting.citation` musi być zsynchronizowane z listą źródeł w HTML.
- Przy aktualizacji istniejącego HTML-a sprawdź także `BlogPosting.mentions`, `about` i FAQ schema: nie mogą zachowywać usuniętych źródeł ani twierdzeń sprzecznych z widoczną treścią. Dla każdego PMID/PMCID/DOI porównaj tytuł, autorów i rok z rekordem wydawcy lub bazy bibliograficznej, a następnie oceń zgodność badanej populacji i wyników z konkretnym twierdzeniem. Sam HTTP 200, istnienie identyfikatora lub podobieństwo tematyczne nie potwierdza dowodu; zamiana URL-a bez ponownej oceny claimu nie jest naprawą bibliografii.
- Dla kategorycznych tez (np. „nigdy”, „nie ma efektu”, „zawsze”) sprawdź także późniejsze badania i wyniki przeciwne. Zapisz populację, interwencję, porównanie, wynik i ograniczenia; nie przenoś wyników ćwiczeń na masaż, biomarkerów na korzyści kliniczne ani małych grup na całą populację 50+. Sprzeczności wymagają rzetelnego omówienia, nie wyboru tylko wygodnego źródła.
- Bibliografia wskazuje konkretne publikacje lub dokumenty. Strona wyszukiwania PubMed/PMC nie zastępuje źródła, nawet jeśli zwraca HTTP 200. `http_status` oznacza końcowy kod 2xx po przekierowaniach; samo `url_status: reachable` nie unieważnia błędu HTTP.
- Wymagane minimum 4 realne, zweryfikowane i wykorzystane URL-e w `citation` oraz liście źródeł HTML.
- Kategoryczny zakaz dopisywania zmyślonych źródeł tylko po to, by dobić do minimum.

## 12a. Logic, Evidence & FAQ Contract
- W tematach medycznych preferuj w tej kolejności: aktualne wytyczne uznanych towarzystw naukowych i instytucji publicznych, przeglądy systematyczne lub metaanalizy, właściwe badania pierwotne oraz oficjalne rejestry i dokumenty. Źródło komercyjne może potwierdzać wyłącznie własną cenę, skład, instrukcję lub status produktu; nie stanowi samodzielnego dowodu skuteczności, bezpieczeństwa ani mechanizmu medycznego.
- Autorytet domeny nie zastępuje dopasowania dowodu. Źródło musi dotyczyć tej samej populacji, interwencji, porównania i wyniku, które opisuje twierdzenie, a ograniczenia badania muszą być widoczne w tekście.
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
