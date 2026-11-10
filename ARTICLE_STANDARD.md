# ARTICLE STANDARD (FitPo50)

Ten dokument definiuje standard przygotowania treści i technicznego dodania artykułów FitPo50. Portal prowadzi jedna osoba; kontrole dobieramy do zadania i rzeczywistego wpływu zmian.

## Podział odpowiedzialności i kontroli

- Pisarz odpowiada za logikę, treści zdrowotne, źródła, dowody, FAQ, intencję SEO i opisy ilustracji. Ilustrator odpowiada za zgodność obrazów z materiałem; Grzegorz zatwierdza obrazy i ostateczny wygląd.
- Zwykłe `article:add` odbiera gotową paczkę i sprawdza ją technicznie: składnia i obsługiwane struktury JSON, pola i typy wymagane przez importer, slug/kategoria/nazwy/ścieżki, konstrukcja HTML w polach, istnienie plików, czytelność i wymiary wariantów AVIF/WebP/JPG oraz kompletność HTML/PDF i `_site`.
- `article:add`, importer i hooki nie oceniają ponownie claimów, źródeł, pochodzenia FAQ, liczby zdań, intencji SEO, kanibalizacji ani znaczenia obrazów. Nie pobierają źródeł z internetu i nie zmieniają treści JSON-u. Reguły redakcyjne, w tym limity tekstów SEO i wymagania dowodowe, są zadaniem Pisarza oraz jawnie zleconej redakcji, a nie ukrytymi blokerami technicznego dodania.
- Audyt wejściowy zbiera wszystkie niezależnie wykrywalne błędy techniczne naraz. Niesprawdzone zależności wymienia jawnie. Jednoznaczne reguły wejścia wykorzystuje także importer; staging zbiera błędy wynikowe HTML/PDF, których nie można ustalić przed generowaniem.
- Pełna kontrola redakcyjna pozostaje osobnym zadaniem. `popraw-seo` i `napraw paczkę N` zachowują swój jawnie zlecony zakres redakcyjny; nie zmieniamy ich mechanizmu w ramach uproszczenia nowego `article:add`.
- Zachowaj tożsamość istniejącej strony i tryb aktualizacji. Nie wymyślaj dowodów, źródeł, researchu FAQ ani wyników review dla uzyskania PASS. Centra zachowują własny kontrakt.
- Wynik kontroli opisuje faktycznie wykonany zakres. Techniczny PASS nie potwierdza prawdziwości treści; niewykonanej kontroli redakcyjnej nie oznaczaj jako PASS i nie zamieniaj jej błędu w warning.
- Aktualny wynik wykorzystuj ponownie tylko przy zgodnych parametrach i hashach danych, właściwego kodu oraz konfiguracji. Zmiana unieważnia wynik etapu i etapów zależnych. Sam marker lub identyczny JSON bez zgodności zależności nie wystarcza.

To zatwierdzony kontrakt uproszczenia. Wdrożenie profilu technicznego, zakresu publikacji i wznowienia w kodzie oraz testy następują w częściach 3–9 planu w Downloads. Sam zapis zasad nie potwierdza gotowości mechanizmu. Sprawdzian wykonamy na innym artykule; błonnik pozostaje zamknięty.

## 0. Zero Generic Text
- Każda zmiana w tekście artykułu musi być konkretna, logiczna i oparta o treść artykułu, dane GSC/PAA/autocomplete, sprawdzone źródło, konkretną liczbę/próg albo jasny warunek bezpieczeństwa.
- Zakaz dotyczy także drobnych edycji technicznych, SEO/AEO/GEO/AIO, title/meta, leadów, quick answers, FAQ, H2, linkowania, anchorów, opisów grafik, tabel, Evidence Box, calloutów i podpisów.
- Nie wolno dopisywać ogólników, zapychaczy ani „ładnych” zdań, które nie wnoszą konkretnej informacji dla czytelnika.
- Jeśli brakuje danych lub źródeł do poprawki, oznacz `INSUFFICIENT_DATA` i zatrzymaj edycję zamiast zgadywać.

## 0A. Logic Gate
- Przy przygotowaniu lub jawnie zleconej redakcji tekst z JSON-a, Claude albo innego modelu wymaga kontroli logicznej akapit po akapicie. W zwykłym `article:add` odpowiada za nią Pisarz; kontrola techniczna nie powtarza tego zadania.
- Każdy akapit musi być zrozumiały sam w miejscu, w którym stoi. Jeśli zaczyna się od „ta obietnica”, „ta reklama”, „taki przekaz”, „to zdanie”, „ten wniosek” albo „haczyk jest prosty”, musi w tym samym akapicie jasno nazwać konkretną obietnicę, twierdzenie, mechanizm lub liczbę, do której się odnosi.
- Metafora lub analogia musi być domknięta mechanizmem. Nie wystarczy napisać, że coś „nie jest korkiem w zlewie”; ten sam fragment musi dopowiedzieć, co naprawdę robi limfa, tłuszcz, energia, deficyt albo inny opisywany mechanizm.
- Wniosek musi wynikać z poprzedniego zdania, źródła, liczby, warunku bezpieczeństwa albo fizjologii opisanej w tekście. Niedopuszczalne są skoki typu: prawdziwe pojęcie -> fałszywy wniosek bez wyjaśnienia przejścia.
- Blok „Najważniejsze”, tabela, podpis grafiki, FAQ i quick answer podlegają tej samej kontroli. Krótkie podsumowanie nie może ucinać logiki ani zostawiać czytelnika z pytaniem „jaka obietnica?”, „jaka reklama?”, „dlaczego?”.
- W profilu redakcyjnym `article-preflight` traktuje wykryte skróty logiczne jako błąd. Profil techniczny nie uruchamia tej oceny.

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

- Jedno polecenie użytkownika `dodaj artykuł` uruchamia `npm run article:add -- --file "<draft.fitpo50.json>"`. Obrazy są pobierane z katalogu JSON-u, chyba że agent jawnie poda `--assets-dir`. Paczka wejściowa zawiera już każdy obraz we wszystkich wymaganych formatach AVIF, WebP i JPG; pipeline wyłącznie je sprawdza i nie generuje brakujących wariantów.
- Pierwsza bramka korzysta z technicznego profilu istniejącego `package-audit.js`, zbiera błędy JSON-u i plików naraz i wskazuje odpowiedzialnego autora poprawki. Nie uruchamia kontroli redakcyjnej, źródeł ani oglądania obrazów; lokalny pipeline tworzy techniczny `media_manifest`.
- Grzegorz zatwierdza obrazy przed przekazaniem paczki. Pipeline nie zatrzymuje nowego slugu na `AWAITING_MEDIA_REVIEW`; sprawdza automatycznie komplet AVIF/WebP/JPG, hashe, wymiary i zgodność wariantów, a następnie tworzy `media_manifest.version=3`.
- Nie używaj dla draftów starej ręcznej ścieżki generator → osobny importer → osobny PDF → ręczna synchronizacja. Skrypty składowe pozostają wyłącznie implementacją i narzędziami serwisowymi.
- Faza przygotowania sprawdza paczkę technicznie i pracuje na kontrolowanej kopii. Nie zmienia wejściowego JSON-u, treści ani podpisów. Linkowanie może wyłącznie opakować istniejącą frazę linkiem do istniejącej strony, bez dopisków dla licznika.
- Gotowy pakiet roboczy uruchamia jeden staging i atom obejmujący HTML, daty ISO 8601, media, PDF, listingi, sitemap, indeksy, `llms.txt`, monitoring i `_site`. Błędy renderowania trafiają do raportu wynikowego; po audycie nie pojawiają się dodatkowe bramki redakcyjne.
- Po lokalnym sukcesie zachowaj pakiet do potwierdzenia live i osobnego polecenia sprzątania. Przy `BLOCKED` zachowaj jedną najnowszą wersję do poprawy.

## 7a. Wewnętrzne fazy bezpiecznego przyjęcia JSON-u
- `DRAFT` oznacza wejście od autora, a `CONTENT_READY` jest dotychczasową nazwą przygotowanego pakietu roboczego. Żadna z tych nazw ani techniczny PASS nie zastępuje oceny merytorycznej Pisarza.
- Techniczne przygotowanie i lokalne dodanie obsługuje jedno `article:add`. `article:prepare-json` pozostaje świadomie zleconym przygotowaniem; `article:publish` jest wewnętrznym silnikiem kontrolera. Zgoda na commit i push jest osobna.
- Korekta nie tworzy ani nie modyfikuje HTML. Zapisuje nowy, trwały JSON oraz raport `.fitpo50.report.json` i `.fitpo50.report.md` z pełną listą zmian.
- Statusy procesu to: `DRAFT`, `CONTENT_READY`, `BLOCKED`.
- Domyślne `force=false` blokuje kolizję z istniejącym slugiem. `--force true` wymaga świadomego podania i służy wyłącznie kontrolowanej aktualizacji.
- Publikator przyjmuje tylko artefakt `CONTENT_READY`; sprawdza powiązany raport oraz SHA-256 całej paczki (JSON i wszystkie pliki z `media_manifest`), więc późniejsza zmiana tekstu lub obrazu blokuje import.
- Zapis importera jest prywatnym etapem kontrolera: wymaga aktywnego manifestu stagingu, krótkotrwałej capability związanej z katalogiem i osobnego uprawnienia operacji. Sama flaga środowiskowa, bezpośrednie wywołanie `import-article.js` albo wskazanie poprawnego `CONTENT_READY` nie wystarcza.
- Plik wejściowy pozostaje bez zmian. Domyślnie istnieje jeden stabilny pakiet roboczy dla slugu, aktualizowany przy kolejnej próbie; wersje `-r2`, `-r3` powstają wyłącznie po jawnym `--keep-revisions true`.
- Kontrole dostępności źródeł i ich cache należą do osobnego profilu redakcyjnego. Zwykłe dodanie nie sprawdza ich w sieci i nie generuje dostarczonych wariantów obrazów. Po nieudanym atomie aktualny pakiet może zostać użyty ponownie przy zgodności hashy oraz właściwego kodu, konfiguracji i parametrów kontroli. Zmiana unieważnia tylko właściwy etap i etapy zależne.
- Po lokalnej promocji pipeline zachowuje wykorzystaną paczkę `CONTENT_READY` ze stanem `AWAITING_LIVE_CONFIRMATION`. Dopiero po potwierdzonym `LIVE_DEPLOYED_AND_VALIDATED` i osobnym poleceniu użytkownika `npm run article:cleanup-input -- --slug <slug>` wolno usunąć wejście; przy błędzie lub `BLOCKED` pozostaje ono do dalszej naprawy.
- Kontroler kończy kodem `0` po sukcesie, `10` przy `AWAITING_MEDIA_REVIEW` albo późniejszym `AWAITING_REVIEW`, `20` dla blokera treści/paczki i `30` dla awarii środowiska. Raport statusu zawiera strukturalne `next_action` i `next_args`, bez wykonywalnej komendy tekstowej.

## 7b. Regression Learning Loop — obowiązkowa naprawa systemowa

- Każdy nowy błąd ujawniony podczas `dodaj artykuł`, `Obal mit`, `UPDATE`, stagingu albo walidacji musi zostać poprawiony zarówno w bieżącym artykule, jak i w mechanizmie, który go przepuścił lub błędnie zgłosił.
- Najpierw określ klasę przyczyny: dane JSON, logika treści, dowody/FAQ, intencja/linki, media, importer/fixer, szablon HTML, PDF, transakcja publikacji albo monitoring.
- Jeśli przypadek jest wykrywalny maszynowo, dodaj minimalny test regresji lub fixture odtwarzający problem. Test powinien nie przechodzić przed poprawką i przechodzić po niej.
- Nie wolno: naprawić wyłącznie finalnego HTML-a, dodać wyjątku dla jednego slugu, zmienić błędu na warning ani obniżyć progu jakości tylko po to, aby publikacja przeszła.
- Jeśli bezpieczna automatyzacja nie jest możliwa, dodaj jednoznaczną ręczną kontrolę do właściwej sekcji tego dokumentu i wskaż ją w raporcie publikacji.
- Po zmianie uruchom testy zmienionego mechanizmu i kontrole wynikające z jego rzeczywistego wpływu. Nie powtarzaj aktualnych testów ani całego portalu bez nowej przyczyny. Naprawa mechanizmu musi mieć adekwatny dowód; nie wymaga ponownego importu zamkniętego artykułu.

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
  - jeden krótki akapit podsumowania (`p`) złożony z 1–5 pełnych, konkretnych zdań; kropka dziesiętna nie jest końcem zdania.
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
- Skrót specjalistyczny trzeba rozwinąć przy pierwszym widocznym użyciu. Nagłówek nie może wymagać od czytelnika znajomości niewyjaśnionego akronimu; jeśli skrót pojawia się po raz pierwszy w H2, nagłówek lub bezpośrednia odpowiedź pod nim musi podać pełną polską nazwę i, gdy pomaga, nazwę źródłową.
- Pytające nagłówki H2 (np. zaczynające się od `Czy`, `Jak`, `Dlaczego`, `Ile`, `Kiedy`) muszą kończyć się `?`.
- Pierwszy akapit pod każdym H2 (lead sekcji) musi bezpośrednio i konkretnie odpowiadać na pytanie H2.
- Zakres 30–70 słów jest zaleceniem redakcyjnym, nie samodzielnym blokerem: krótsza kompletna odpowiedź i dłuższa wartościowa odpowiedź mogą przejść.
- Brak odpowiedzi, odpowiedź generyczna, powtórzony lead, niedomknięta myśl albo twierdzenie bez dowodu blokują publikację.
- Liczba linków wynika z naturalnego planu. Mniej niż dwa sensowne linki do istniejących artykułów daje ostrzeżenie, nie blokadę; system nie dopisuje tekstu dla licznika.
- Linki wewnętrzne w treści mają być wyłącznie względne (`href="slug-artykulu.html"`), bez `https://fitpo50.pl/...`.
- Tabele w artykułach mają być dopracowane wizualnie: wrapper `.article-table-wrap`, tabela `.article-table` oraz w razie potrzeby `.article-table--compact`; każda tabela wymaga konkretnego `<caption>`, krótkich komórek, czytelnych nagłówków i nie może być zawinięta w `<p><table>`.

## 10a. Intent, Linking & Topic Center Contract
- Przy przygotowaniu redakcyjnym Pisarz określa `search_intent`, jedną `primary_keyword` długości 2-8 słów oraz 3-8 unikalnych `supporting_keywords`. Lokalny audyt sprawdza wyłącznie strukturę pól używanych technicznie, bez oceny intencji lub liczby fraz dla wyniku SEO.
- Claude ani inny model zewnętrzny nie podaje linków wewnętrznych i nie zgaduje slugów. Linkowanie powstaje lokalnie przez `scripts/prepare-article-architecture.js` na podstawie aktualnych artykułów `BlogPosting` w repozytorium.
- Skill Pisarza `docs/skills/fitpo50-article-draft/` zwraca jeden JSON `DRAFT`, realne źródła, FAQ wynikające z GSC/PAA/autocomplete oraz plan obrazów. `manual_research` jest zabronione przy tworzeniu pytań; bez realnych pytań FAQ może być puste. Za źródła i pochodzenie FAQ odpowiada Pisarz. Lokalny pipeline przygotowuje linkowanie bez dopisywania treści i bez ponownej kontroli dowodów.
- Porównanie intencji z tytułami, H1 i mapą właścicieli z `popraw-seo` należy do planowania i jawnej redakcji. Nie jest bramką technicznego dodania; lokalny importer nie zmienia title/H1 z powodu oceny kanibalizacji.
- W analizie redakcyjnej przy `UPDATE` własny `${slug}.html` jest wyłączony z kandydatów kanibalizacji; konflikt z innymi URL-ami rozstrzygamy w tym zadaniu, nie w technicznym imporcie.
- Linki wynikające z planu muszą prowadzić do istniejących artykułów, mieć unikalne cele i naturalne anchory obecne już w konkretnych akapitach. Finalny HTML musi odpowiadać `internal_link_plan` co do celu, anchora i lokalizacji; importer nie uruchamia PHP ani alfabetycznego „Zobacz też”. Mniej niż dwa linki daje ostrzeżenie `LOW_CONTEXTUAL_LINK_COUNT`; system nie dopisuje zdania-zapychacza.
- `internal_link_plan[]` zapisuje target, anchor, dokładną lokalizację i podstawę doboru. `incoming_link_suggestions[]` wskazuje istniejące strony, które po publikacji powinny zostać ręcznie sprawdzone jako źródła linku przychodzącego.
- Dopasowanie do centrum zapisuje `topic_center_assessment`. Tylko `STRONG` tworzy propozycję `AWAITING_USER_APPROVAL`; nie blokuje zwykłej publikacji i nie zmienia konfiguracji centrum.
- Link do `centrum-*.html` bez `topic_center_approval.status = APPROVED_BY_USER` jest błędem. Pipeline nigdy nie dodaje hub-linku tylko po to, by poprawić licznik linków.

## 11. Media + Syntax Contract v2.0 (obowiązkowe)
- JSON i wszystkie obrazy wejściowe tworzą jeden katalog artykułu. Pipeline nie szuka plików rekurencyjnie, nie normalizuje przybliżonych nazw i nie pobiera zastępstwa z globalnego `assets/`.
- Wymagany jest dokładnie jeden obraz `hero` oraz co najmniej jeden odrębny obraz dla każdej merytorycznej sekcji głównej. Sekcja może mieć kolejne obrazy, wykresy lub infografiki, gdy wnoszą nową informację; używają placementu `sekcja-N-obraz-M`, gdzie `M >= 2`. Sekcje użytkowe, takie jak szybka odpowiedź, udostępnianie, źródła, disclaimer i czytelnia, nie tworzą zapotrzebowania na osobny obraz. Liczba obrazów wynika z realnej architektury tematu, a nie ze stałego minimum ani maksimum. `filename_base` jest dokładną nazwą kebab-case, a każdy wpis obrazu wymaga konkretnego tematu, techniki, kompozycji, celu, proporcji, altu i podpisu.
- JSON może oznaczyć sekcję jako `section_role: main|utility`; brak pola oznacza `main`. Tylko rzeczywiście użytkowa sekcja może pominąć osobny obraz. Plan obrazu zachowuje także `season_and_time`, `mood`, `evidence_source_urls` i `requires_exact_data_render`. Wykres lub infografika oznaczona `requires_exact_data_render=true` wymaga dokładnego `overlay_text_pl`, źródeł obecnych w `sources[]` oraz zgodnej transkrypcji podczas kontroli wizualnej.
- Lokalna kontrola plików zapisuje techniczny `media_manifest`: placement, metadane otrzymane od autora, nazwę źródła, wymiary, SHA-256 i warianty. Zachowujemy istniejącą wersję kontraktu manifestu bez osobnego review Codexa. Nie dopisujemy pozornego potwierdzenia wizualnego. Opublikowany artykuł z manifestem v2 nie jest migrowany. Manifestu nie generuje Claude.
- Ilustrator i Grzegorz oceniają zgodność obrazu z sekcją, napisy i liczby, anatomię, sprzęt oraz kadr. Przygotowanie redakcyjne może deklarować `embedded_text.kind`: `NONE`, `WATERMARK_ONLY`, `INCIDENTAL_ENVIRONMENT` albo `CONTENT`. Naturalne napisy środowiskowe są dozwolone, jeśli nie reklamują i nie przekazują mylących twierdzeń. Dane na grafice wymagają podstawy u autora. Techniczny import nie wykonuje transkrypcji, oceny merytorycznej ani osobnego wpisu review; nie odtwarza dawnych raportów v1/v2 i nie przypisuje sobie akceptacji Grzegorza.
- Każdy obraz jest dostarczany w paczce wejściowej jako AVIF, WebP i fallback JPG o zgodnych wymiarach. Pipeline sprawdza kompletność i zgodność wariantów, ale ich nie dorabia. Dla hero zalecane jest co najmniej 1080×600 px, a bezpieczny zakres zaczyna się od 1024×560 px; dla obrazu sekcji zalecane jest 900×500 px, a bezpieczny zakres zaczyna się od 800×450 px. Drobna różnica od zalecenia daje ostrzeżenie, nie samodzielny bloker. Proporcja krajobrazowa nadal musi mieścić się w zakresie 1.2-2.1 i zgadzać z deklaracją.
- `listing_title` ma bezpieczny zakres 45-80 znaków, z zalecanym celem 55-70. Krótszy lub dłuższy, ale kompletny i czytelny tytuł w bezpiecznym zakresie nie jest samodzielnym blokerem.
- Zmiany wymiarów, napisów środowiskowych i `listing_title` działają forward-only dla nowych i właśnie edytowanych artykułów. Nie uruchamiają migracji, regeneracji obrazów ani masowej edycji starszych publikacji tylko po to, by dostosować historyczne artefakty do nowszego kontraktu.
- Obrazy w `assets/` są wysyłane z rocznym cache `immutable`. Zmiana zawartości obrazu wymaga nowej, wersjonowanej nazwy pliku oraz aktualizacji wszystkich odwołań w źródle, metadanych, manifeście mediów i `_site`. Nie wolno nadpisywać istniejącego obrazu pod tym samym publicznym URL-em.
- Hash identyfikuje rzeczywiste pliki i umożliwia kontrolę integralności. Ocenę podobieństwa kadrów, generyczności, wartości i merytorycznej zgodności wariantów wykonują Ilustrator i Grzegorz; techniczny import nie powtarza tej oceny.
- `alt` i `caption` muszą opisywać realną zawartość oraz mieć związek z konkretną sekcją. Akceptacja wizualna należy do Grzegorza; pipeline nie wymaga od Codexa ponownego wpisu `visual_review.status=VERIFIED`.
- Ilustrator i Grzegorz odrzucają obraz z mylącymi danymi lub niezgodnym kadrem przed przekazaniem paczki. Pipeline nie podmienia obrazu na ukryty fallback.
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
- Standardowy PDF przechodzi automatyczną kontrolę kompletności, tekstu, fontów, marginesów i ilustracji. Zmiana generatora, szablonu lub nietypowy komponent rozszerza adekwatne kontrole techniczne. Ostateczny wygląd ocenia Grzegorz.
- HTML source i `_site` oraz PDF source i `_site` muszą być identyczne 1:1. Kanoniczny raport `data/reports/article-preview/<slug>.json|md` zapisuje `TECHNICAL_PASS`; standardowy artykuł nie czeka na osobny `VISUAL_REVIEW_VERIFIED`. Rendery pozostają prywatne w zarządzanym stagingu i nie trafiają do Git ani `_site`.
- Walidatory HTML nie mogą zależeć od kolejności atrybutów w poprawnym znaczniku. Meta, linki, nagłówki, wrappery tabel i pozostałe kontrakty rozpoznają atrybuty po nazwie i wartości.
- Poprawki `popraw-seo` po akceptacji mogą być wdrażane wyłącznie przez manifest dokładnych operacji `replace_exact` z SHA-256 wersji wejściowej i udokumentowaną podstawą. Automat nie generuje tekstu podczas aplikacji i nie używa generycznych łączników.
- Każdy zmieniony artykuł — target oraz strona źródłowa z nowym linkiem — otrzymuje nowe `dateModified`, PDF, mirror, sitemap lastmod, render desktop/mobile/PDF i walidację.
- Lokalny PASS nie potwierdza produkcji. Komenda `publikuj` sprawdza jeden URL artykułu i wymaga zgodności SHA-256 produkcyjnego HTML z lokalnym `_site`; IndexNow pozostaje osobnym krokiem.
- Promocja do repo jest transakcyjna: przed zapisem system sprawdza, czy żaden plik docelowy nie zmienił się podczas stagingu, kopiuje wyłącznie dozwolone artefakty i przy błędzie przywraca wcześniejsze wersje.

## 11b. Safe Publication & Rollback Contract
- Publikacja ma dwa jawne tryby: `CREATE` dla nowego slugu oraz `UPDATE` dla istniejącego slugu. `UPDATE` wymaga `--force true`; bez tego pipeline zatrzymuje się przed stagingiem.
- Jedna transakcja obejmuje cały zestaw: HTML artykułu, media AVIF/WebP/JPG, PDF, `index.html`, `porady.html`, stronę kategorii, `sitemap.xml`, `llms.txt`, `llms-full.txt`, indeks wyszukiwarki, raport podglądu, log publikacji oraz odpowiadające pliki w `_site`.
- Przed pierwszym zapisem powstaje backup wszystkich nadpisywanych plików wraz z SHA-256. Backup pozostaje aktywny aż do zakończenia walidacji już promowanego repozytorium.
- Transakcja prowadzi dziennik w ignorowanym przez Git katalogu `.tmp/article-publication-transactions`. Po nagłym przerwaniu następne uruchomienie najpierw przywraca stan sprzed publikacji; niezależnie zmieniony plik blokuje automatyczne cofnięcie zamiast zostać nadpisany.
- Po promocji sprawdzamy integralność przeniesionych plików i kompletność zestawu. Wykorzystujemy aktualne wyniki stagingu powiązane z hashami; nie uruchamiamy ponownie zakończonych kontroli dla niezmienionych artefaktów i zależności. Rzeczywisty błąd transakcji wywołuje rollback całego zestawu.
- Udana transakcja zapisuje `data/reports/article-publications/<slug>.json`. Manifest podaje `CREATE`/`UPDATE`, identyfikator transakcji, wszystkie zmienione pliki, akcję `CREATE`/`UPDATE`, rozmiar oraz hashe przed i po publikacji.
- Backup i dziennik są usuwane dopiero po zatwierdzeniu lokalnej transakcji. Wykorzystany artefakt `CONTENT_READY` pozostaje do ręcznego `article:cleanup-input`, które wymaga zgodnego dowodu `LIVE_DEPLOYED_AND_VALIDATED` dla sluga. IndexNow pozostaje osobnym etapem po pushu, `LIVE_DEPLOYED_AND_VALIDATED` i `SECURITY_EXPOSURE_PASS`; uruchamia go wyłącznie `npm run indexnow:release`.
- Półgotowy zestaw nie może być uznany za publikację: brak artykułu w listingu, sitemapie, `llms`, indeksie wyszukiwarki, brak PDF/media albo rozjazd wymaganej pary source/`_site` jest błędem blokującym.
- Kontrola końcowa obejmuje source/`_site` i pliki należące do zadania. Świeży, pełny eksport oraz szersze parity wykonujemy przy rzeczywistym wpływie na wspólny eksport; sonda porównuje wynik ze stanem sprzed operacji. Synchronizacja assetów nie może maskować różnicy HTML.

## 12. Schema Citation Contract v2.0 (obowiązkowe)
- `BlogPosting.citation` musi być zsynchronizowane z listą źródeł w HTML.
- Przy aktualizacji istniejącego HTML-a sprawdź także `BlogPosting.mentions`, `about` i FAQ schema: nie mogą zachowywać usuniętych źródeł ani twierdzeń sprzecznych z widoczną treścią. Dla każdego PMID/PMCID/DOI porównaj tytuł, autorów i rok z rekordem wydawcy lub bazy bibliograficznej, a następnie oceń zgodność badanej populacji i wyników z konkretnym twierdzeniem. Sam HTTP 200, istnienie identyfikatora lub podobieństwo tematyczne nie potwierdza dowodu; zamiana URL-a bez ponownej oceny claimu nie jest naprawą bibliografii.
- Dla kategorycznych tez (np. „nigdy”, „nie ma efektu”, „zawsze”) sprawdź także późniejsze badania i wyniki przeciwne. Zapisz populację, interwencję, porównanie, wynik i ograniczenia; nie przenoś wyników ćwiczeń na masaż, biomarkerów na korzyści kliniczne ani małych grup na całą populację 50+. Sprzeczności wymagają rzetelnego omówienia, nie wyboru tylko wygodnego źródła.
- Bibliografia wskazuje konkretne publikacje lub dokumenty. Strona wyszukiwania PubMed/PMC nie zastępuje źródła, nawet jeśli zwraca HTTP 200. `http_status` oznacza końcowy kod 2xx po przekierowaniach; samo `url_status: reachable` nie unieważnia błędu HTTP.
- Wymagane minimum 4 realne, zweryfikowane i wykorzystane URL-e w `citation` oraz liście źródeł HTML.
- Kategoryczny zakaz dopisywania zmyślonych źródeł tylko po to, by dobić do minimum.

## 12a. Logic, Evidence & FAQ Contract

To wymagania przygotowania materiału przez Pisarza i osobnego zadania redakcyjnego. Techniczny import oraz hooki nie oceniają ich ponownie.

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
- `404/410` otrzymuje status `broken`; `401/403/405` — `blocked_by_publisher`; `429` i `5xx` — `temporarily_unavailable`; DNS, timeout, TLS i błąd połączenia — `verification_failed`. Po ponowieniu przez GET odpowiedź 403/405 jest ostrzeżeniem, jeżeli źródło ma DOI/PMID albo pochodzi z domeny urzędowej lub naukowej; tylko takie zablokowane źródło liczy się do minimum czterech. 404/410 blokuje jako martwy adres, a błąd sieci kończy kodem 30 bez zapisu JSON-u. Sam HTTP 200 nigdy nie potwierdza zgodności źródła z twierdzeniem.
- Jeśli wniosek wynika z wcześniejszych akapitów zamiast z bezpośredniego źródła, JSON wymaga `logic_links[]` z `conclusion_location`, listą `premise_locations` i konkretnym `reasoning` opisującym przejście od przesłanek do wniosku.
- Każde źródło musi wspierać co najmniej jedno `evidence_claims`; niewykorzystana, dekoracyjna bibliografia blokuje publikację.
- Twierdzenia `medical` i ogólne twierdzenia `safety` wymagają silnego źródła naukowego lub instytucjonalnego oraz jawnego `evidence_level`. Wyłącznie modelowo swoista instrukcja obsługi lub konfiguracji urządzenia medycznego może opierać się na `technical_documentation` producenta, jeśli fragment i źródło wskazują ten sam jednoznaczny model; dokumentacja producenta nie potwierdza ogólnej skuteczności ani bezpieczeństwa klinicznego. Dla tematów medycznych minimum 67% źródeł i co najmniej dwa źródła muszą spełniać ten warunek.
- FAQ nie jest nigdy generowane ani uzupełniane automatycznie przez lokalny pipeline. Liczba pytań wynika z researchu, może wynosić zero, a `answer_blocks[]` i `faq_research[]` zawsze odpowiadają sobie 1:1.
- Każdy wpis `faq_research[]` nowego materiału wymaga `source_type`: `autocomplete`, `paa` albo `gsc`, a także `checked_at`, `url_status` i `http_status`. `manual_research` jest zabronione przy tworzeniu i redakcji; w sześciu opublikowanych centrach zmiany linków i list artykułów zachowują wyjątek baseline tylko wtedy, gdy FAQ, jego JSON-LD i research są identyczne z HEAD.
- `gsc` wymaga realnego `query` i `impressions >= 1`; `paa` wymaga `query` i opisu kontroli; `autocomplete` wymaga rzeczywistego endpointu Google Suggest z pytaniem w parametrze `q`.
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
- Artykuł mitu zawiera semantyczną tabelę `MIT`–`FAKT/DOWODY` oraz wyjaśnienie mechanizmu w FAQ tylko wtedy, gdy istnieje realne pytanie z GSC/PAA/autocomplete.
- Ton: spokojny, kumpelski, bez moralizowania i bez języka oskarżającego konkretne firmy/osoby.
- `ClaimReview` dodawaj tylko wtedy, gdy artykuł obala jedno precyzyjne, popularne twierdzenie i da się podać jasny werdykt oraz źródła. Przy artykułach zbiorczych typu "5 mitów" nie dodawaj jednego sztucznego `ClaimReview`.
