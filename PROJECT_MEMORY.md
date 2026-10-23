# FitPo50 — aktywna pamięć projektu

## TWARDE ZASADY (czytaj na starcie każdej sesji, wygrywają przy sprzeczności)

- Bez osobnego „tak” użytkownika w czacie: zero commitów na `main`, pushy, deployów, merge'ów, IndexNow, usuwania plików lub gałęzi ani `tmp:cleanup`. Akceptacja ID lub raportu nie jest zgodą.
- Każda sesja zaczyna się tylko od odczytu: przeczytaj te zasady, pokaż `git status` oraz porównanie `main` z `origin/main`, a potem czekaj na zadanie.
- Pracuj wyłącznie w zakresie polecenia. Problem poza zakresem zgłoś, ale niczego w nim nie zmieniaj.
- Deploy: `prepush:local` PASS → `_site` bez plików technicznych → `gitpush` → osobny marker → `deployment:finalize` z `LIVE_DEPLOYED_AND_VALIDATED` i `SECURITY_EXPOSURE_PASS`.
- Z `_site` wykluczaj: `HANDOFF.md`, `requirements*.txt`, fonty PDF, `.venv`, `__pycache__`, pliki `.py`/`.pyc` oraz `admin/*.md`.
- Artykuł wymaga minimum 4 realnych źródeł z mapowaniem twierdzenie → źródło. Linkowanie wewnętrzne tworzy tylko lokalny pipeline. Publikacja obejmuje kafel strony głównej, `porady.html`, właściwy dział, sitemapę, `llms.txt` i `llms-full.txt`.
- FAQ korzysta wyłącznie ze wspólnego kontraktu `gsc`/`paa`/`autocomplete`; `manual_research` jest zabronione. Baseline ma dokładnie 32 artykuły legacy i 6 centrów.
- `popraw-seo`: fala obejmuje 3 pozycje według zysku i 2 rotacyjne spoza top 20; dane pochodzą z `data/reports/local/gsc-current`, a stan rotacji z `data/reports/local/seo-state/priority-rotation.json` i jest zużywany wyłącznie przez `--approve-round`.
- Bramka patchy wymaga podstawy `SOURCE` z URL-em, linków z lokalnej mapy, zakazuje podmiany całego dokumentu i sprawdza właściciela celu.
- `article:add --force` jest blokowane dla stron z wdrożonymi poprawkami SEO; wyjątek wymaga jawnej flagi `--allow-overwrite-seo-patches`.
- Tag `p:domain_verify` w `index.html` zostaje na stałe.
- Git sync panelu pozostaje wyłączony. `.htaccess` blokuje dotfiles poza `/.well-known/`, pliki `*.md`, szablon Bento i `admin/init-*.php`.
- Kody wyjścia: `0` = `READY`, `10` = `AWAITING_REVIEW`, `20` = błąd treści, `30` = błąd środowiska.
- Raportuj krótko, prosto i bez żargonu; zawsze podaj ryzyko oraz informację, czy zmianę można cofnąć.

Ten plik zawiera wyłącznie aktualne decyzje. Nie jest kroniką zmian. Szczegółowe kontrakty artykułów są w `ARTICLE_STANDARD.md`, komendy w `docs/command-registry.md`, a monitoring publikacji w `docs/post-publication-monitoring.md`.

## 1. Cel projektu

- FitPo50 ma być widoczne w Google i zdobywać kliknięcia dzięki wiarygodnym, użytecznym treściom dla osób 50+.
- SEO, AEO, GEO i AIO są środkami do wzrostu widoczności i kliknięć, nie celem samym w sobie.
- Jakość merytoryczna, bezpieczeństwo medyczne i czytelność mają pierwszeństwo przed szybkością publikacji.
- Zakazane są generyczne dopiski. Każda zmiana treści musi wynikać z artykułu, danych GSC/PAA/autocomplete, realnego źródła, konkretnej liczby/progu albo jasnego warunku bezpieczeństwa.

## 2. Hierarchia dokumentów

W razie rozbieżności obowiązuje kolejność:

1. bieżące polecenie użytkownika,
2. sekcja „TWARDE ZASADY” w tym pliku,
3. `AGENTS.md`,
4. pozostałe sekcje `PROJECT_MEMORY.md`,
5. `ARTICLE_STANDARD.md`,
6. pamięć modułowa: `MEMORY_PORADY.md`, `MEMORY_NEWSY.md`, `MEMORY_MOJE_SUKCESY.md`,
7. `docs/command-registry.md` i dokumentacja konkretnego mechanizmu,
8. historyczne raporty — wyłącznie jako dane, nigdy jako aktywne instrukcje.

`SESSION_START_MAX.md` jest skrótem operacyjnym rozpoczynającym sesję i ma być zgodny z powyższymi plikami.

## 3. Architektura serwisu

- Kategorie artykułów: `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`, `mity.html`.
- `mity.html` jest osobną kategorią, nie częścią `ciekawe.html`.
- `porady.html` jest zbiorczą stroną artykułów.
- `_site/` jest publicznym eksportem i musi być zgodny ze źródłem.
- Pełny HTML publikuje wyłącznie `export_site.sh`; `assets:mirror:sync` obsługuje PDF/NEWS i jawne mirrory assetów, nie naprawia HTML. `check:build-export` oraz `prepush:local` porównują świeży eksport z `_site` plik po pliku i blokują brak, nadmiar lub różnicę treści.
- Każda komenda `package.json` ma dokładnie jeden status w `docs/command-registry.md`: `PUBLIC`, `INTERNAL`, `RECOVERY` albo `RETIRED`. Rejestr i `package.json` muszą przechodzić `command:contract:check`.
- `Moje Sukcesy`, `Porady` i `NEWS` są oddzielnymi modułami. Nie wolno mieszać ich danych ani logiki.
- Nie zmieniamy publicznych URL-i ani design systemu bez wyraźnej potrzeby i planu migracji.
- Pliki prywatne, szczególnie `admin/config.php`, `.env*`, klucze i dane użytkowników, nigdy nie trafiają do Git ani `_site`.

## 4. Start pracy

Na początku nowej sesji:

1. przeczytaj sekcję „TWARDE ZASADY”,
2. pokaż `git status` i porównanie `main` z `origin/main`,
3. czekaj na zadanie użytkownika.

Start sesji jest wyłącznie odczytowy. Nie wykonuj wtedy `pull`, `restore`, eksportu, synchronizacji ani walidatora zapisującego pliki. Pozostałe dokumenty właściwe dla zadania czytaj po jego otrzymaniu.

## 5. Publikacja artykułu z JSON-u

- Nowe artykuły, aktualizacje, `popraw-seo` i `napraw paczkę N` przechodzą jeden wspólny, pełny Quality Gate z `ARTICLE_STANDARD.md`. Kontrola zawsze obejmuje całą treść oraz HTML, źródła, FAQ, linki, media, PDF, dane strukturalne, listingi, sitemap i `_site`; nie tylko zmieniony fragment.
- JSON od Claude lub innego modelu jest zawsze draftem, nie źródłem prawdy.
- Korekta JSON-u i publikacja to rozdzielone etapy: `DRAFT` → `CONTENT_READY` → `TECHNICAL_PASS`/`VISUAL_REVIEW_PENDING` → `VISUAL_REVIEW_VERIFIED` → `PREVIEW_READY` → `COMMITTED`; błąd daje `BLOCKED`.
- Plik z `Downloads` pozostaje bez zmian. Pipeline pracuje na kontrolowanej kopii i nie archiwizuje zużytego JSON-u w repo.
- Publikacja rozróżnia `CREATE` i `UPDATE`; istniejący slug wymaga jawnego `--force true`.
- Pipeline działa fail-fast. Po pierwszym błędzie nie uruchamia etapów zależnych ani mutujących.
- Wewnętrzny importer może zapisywać wyłącznie w aktywnym stagingu z krótkotrwałą capability wystawioną przez kontroler. Podrobienie flagi środowiskowej ani bezpośrednie wywołanie skryptu nie upoważnia do zapisu.
- Nie wolno publikować bez przejścia logiki, dowodów, FAQ, intencji, linków, mediów, stagingu HTML, PDF i końcowych walidatorów.
- Finalne źródło prawdy to HTML, media, PDF, listingi, sitemap, indeksy, manifest publikacji i ich odpowiedniki w `_site`.

### Obowiązkowa naprawa podwójna

Każdy nowy problem ujawniony podczas `dodaj artykuł`, `Obal mit`, aktualizacji albo walidacji wymaga dwóch poziomów naprawy:

1. napraw bieżący artykuł i wszystkie jego artefakty,
2. znajdź przyczynę w importerze, walidatorze, szablonie, generatorze PDF, mediach albo dokumentacji i usuń ją dla przyszłych publikacji.

Jeżeli problem da się wykrywać automatycznie, dodaj test regresji lub celowo błędny fixture potwierdzający, że pipeline odtąd go blokuje albo poprawnie obsługuje. Nie wolno kończyć zadania na ręcznej korekcie jednego HTML-a, osłabiać istniejącej bramki ani ukrywać błędu warningiem. Jeśli przypadek jest wyłącznie jednostkowy i nie da się bezpiecznie uogólnić, zapisz konkretną regułę kontroli w `ARTICLE_STANDARD.md` zamiast tworzyć ryzykowny automat.

Po naprawie uruchom właściwe testy, pełny Quality Gate i dopisz wyłącznie nową, aktywną zasadę do pamięci — bez tworzenia kolejnej historycznej kopii tego samego workflow.

Szczegółowy kontrakt znajduje się w `ARTICLE_STANDARD.md`.

## 6. Logika, źródła i FAQ

- Każdy akapit musi mieć jasne odniesienia. Zwroty typu „ta obietnica”, „ten wniosek” lub „haczyk” muszą w tym samym fragmencie nazwać konkretną rzecz.
- Każda metafora musi zostać domknięta rzeczywistym mechanizmem.
- Każdy wniosek wynika z wcześniejszego wyjaśnienia, źródła, liczby albo warunku.
- Liczby, progi, ceny, ryzyko, mechanizmy i twierdzenia medyczne wymagają przypisania do konkretnych `evidence_claims[]`.
- Starszy draft Claude może zostać przełożony na aktualny kontrakt tylko z jawnych danych: typ źródła → `evidence_level`, ID źródła → istniejący URL, opisowa lokalizacja → rzeczywista ścieżka JSON. `evidence_source_ids` pozwala domknąć mapowanie akapitów i podpisów bez wymyślania publikacji ani relacji dowodowej.
- Minimum to 4 realne i wykorzystane źródła. Nie wolno dodawać dekoracyjnych URL-i dla licznika.
- W tematach medycznych co najmniej dwa źródła i minimum 67% źródeł muszą mieć odpowiednią siłę naukową lub instytucjonalną.
- Źródła rozróżniają: `broken` dla 404/410, `blocked_by_publisher` dla 401/403/405, `temporarily_unavailable` dla 429 i 5xx oraz `verification_failed` dla DNS, timeoutu, TLS i błędu połączenia. Po ponownej próbie GET odpowiedź 403/405 jest ostrzeżeniem, jeśli źródło ma DOI/PMID albo domenę urzędową lub naukową; tylko takie źródło liczy się wtedy do minimum czterech. 404/410 blokuje jako martwy adres, a błąd środowiska kończy kodem 30 bez zapisu JSON-u. Sam HTTP 200 nie potwierdza tezy.
- FAQ nowego artykułu powstaje wyłącznie z realnego GSC, PAA albo autocomplete. Jego liczba wynika z researchu i może wynosić zero; pipeline ponownie je weryfikuje i nigdy nie wymyśla brakujących pytań. `manual_research` jest zabronione w nowych i zmienianych materiałach; sześć opublikowanych centrów pozostaje wyłącznie nieedytowanym wyjątkiem baseline.
- `quick_answer` ma 1–3 pełne, konkretne zdania, najwyżej 70 słów i nie może być generycznym wstępem.

## 7. Intencja, linkowanie i centra

- Przed publikacją określ `search_intent`, jedną `primary_keyword` i 3–8 `supporting_keywords`.
- Linkowanie wewnętrzne powstaje lokalnie na podstawie istniejących stron. Claude nie zna repozytorium i nie podaje slugów.
- Paczka nowego artykułu trafia do jednego katalogu `~/Downloads/<slug>/`: JSON Pisarza oraz dokładne warianty JPG, WebP i AVIF od Ilustratora. Pierwszy etap `article:add` zbiorczo rozdziela błędy na odpowiedzialność Pisarza i Ilustratora; lokalne linkowanie nie jest wymagane od żadnego z nich.
- Importowy skill Pisarza dla nowych draftów znajduje się w `docs/skills/fitpo50-article-draft/`, a gotowy ZIP obok tego katalogu. Pisarz rozwija temat wybrany przez Agenta SEO i zaakceptowany przez Grzegorza, po czym kończy wyłącznie na `DRAFT`; `DRAFT_VALID` nie oznacza `CONTENT_READY`. Wszystkie uwagi przekazuje w `editorial_notes`, bez osobnej notatki i bez zgadywania linków lub centrum. Liczba FAQ wynika wyłącznie z researchu i może wynosić zero; jeśli FAQ istnieje, `answer_blocks` i `faq_research` odpowiadają sobie 1:1, a każde pytanie ma rzeczywisty, zapisany sygnał z GSC/PAA/autocomplete. Przy każdym `dodaj artykuł` lokalny agent bez ponownego pytania użytkownika weryfikuje FAQ, przygotowuje linkowanie wewnętrzne i uruchamia jedną komendę `article:add`; samo `article:prepare-json` stosuje tylko na jawne żądanie korekty bez publikacji.
- Liczba naturalnych linków kontekstowych wynika z planu; mniej niż dwa daje ostrzeżenie, nie blokadę.
- Aktualizowany URL nie może być uznany za kanibalizację samego siebie.
- Dla każdej intencji wybieramy jeden główny URL; pozostałe strony go wspierają i nie konkurują równolegle tym samym title/H1.
- Centrum tematyczne jest tylko propozycją `AWAITING_USER_APPROVAL`. Bez jawnej akceptacji nie zmieniamy centrum i nie wymuszamy hub-linku.

## 8. Obrazy, HTML i PDF

- Każdy pakiet artykułu ma jeden katalog wejściowy, dokładne nazwy, osobny hero i obrazy sekcji oraz lokalny manifest.
- Każdy publikowany obraz musi zostać rzeczywiście obejrzany. Mylące liczby, niepowiązany tekst, nieprawdziwa anatomia lub sprzęt, błędne kadry i ukryte fallbacki są zabronione; sam watermark nie jest przeszkodą. Kanoniczny raport preview `version=3` klasyfikuje tekst jako brak, sam watermark albo treść i wiąże review z hashem pliku, placementem, H2, altem, podpisem oraz kontekstem. Liczby i twierdzenia wymagają transkrypcji i URL-i dowodów. Raporty preview v1/v2 pozostają zamrożonym legacy i nie uzyskują po cichu znaczenia v3.
- Artykuł ma hero i co najmniej jeden odrębny obraz dla każdej głównej sekcji merytorycznej. Dodatkowe wykresy, infografiki lub sceny są dozwolone jako `sekcja-N-obraz-M`, jeśli wnoszą nową informację. Nie obowiązuje sztywna liczba sekcji ani obrazów: zakres wynika z tematu, a sekcje użytkowe nie są liczone.
- Po jednoznacznym rozpoznaniu pliku źródłowego pipeline utrwala dokładne `source_file`; wygenerowany wariant JPG nie może później tworzyć fałszywej niejednoznaczności z oryginalnym JPEG.
- Po zatwierdzonej publikacji brak uprawnień do posprzątania roboczej kopii poza zarządzanym workspace jest ostrzeżeniem, nie fałszywą porażką transakcji. Weryfikacja produkcji czeka na propagację HTML przez CDN i używa release-bound warm-up, ale potwierdza dopiero zwykły publiczny URL.
- Wymagane warianty AVIF, WebP i JPG są dostarczane razem z JSON-em; pipeline sprawdza ich kompletność i zgodność, ale nie generuje brakujących formatów. Każdy wariant ma prawdziwe wymiary, konkretny `alt` i podpis. Gdy zmienia się zawartość obrazu, nadaj wszystkim wariantom nową, wersjonowaną nazwę i zaktualizuj źródło, metadane, manifest oraz `_site`; roczny cache `immutable` wyklucza bezpieczne nadpisanie istniejącego URL-u.
- Kanoniczny PDF używa wersjonowanych bibliotek z `requirements-pdf.txt`, hash-zweryfikowanych fontów z repo i stabilnych metadanych. Nie ładuje bibliotek z `/tmp` ani fontów zależnych od systemu.
- Obecny layout artykułu obsługuje krajobraz: hero ma bezpieczny zakres od 1024×560 i zalecenie 1080×600, sekcja ma bezpieczny zakres od 800×450 i zalecenie 900×500, a proporcja pozostaje 1.2–2.1. Drobne odchylenie od zalecenia jest ostrzeżeniem, nie samodzielnym blokerem. Naturalne napisy uliczne, szyldy i oznaczenia wnętrz są dozwolone jako `INCIDENTAL_ENVIRONMENT`, jeśli nie reklamują marki i nie przekazują mylącego twierdzenia medycznego. Portret i kwadrat wymagają osobnego, jawnie wspieranego wariantu layoutu.
- Reguły wymiarów, napisów środowiskowych i zakresu `listing_title` stosuj forward-only do nowych oraz właśnie edytowanych artykułów. Nie poprawiaj masowo starszych publikacji ani ich obrazów tylko dlatego, że powstał nowszy kontrakt.
- Tabele są semantycznym HTML: `caption`, `thead`, `tbody`, `th` i odpowiednie `scope`. Grafika tabeli nie zastępuje tabeli.
- Importer automatycznie dodaje tabelom klasę, mobilny kontener przewijania oraz brakujące `scope`; finalna bramka tabel działa dopiero na zbudowanym HTML.
- `.sources-list` jest klasą listy `<ol>`, nigdy jej wrappera. Długie URL-e źródeł muszą zawijać się na mobile. Walidatory rozpoznają poprawne znaczniki niezależnie od kolejności atrybutów.
- Importer nie może upraszczać pierwszego akapitu pod H2 do czystego tekstu: zachowuje istniejące linki, `<strong>`, `<em>` i pozostałe poprawne znaczniki inline. Pierwszy akapit ma działać answer-first: odpowiada bezpośrednio i konkretnie na H2. Zakres 30–70 słów jest zaleceniem, nie samodzielnym blokerem; blokują brak odpowiedzi, generyk, powtórzony lead, niedomknięta myśl i twierdzenie bez dowodu.
- Limit `<title>` 65 znaków obejmuje także stały dopisek ` | FitPo50`; dlatego `seo_title` bez marki ma maksymalnie 55 znaków. H1 pozostaje niezależnym tytułem artykułu.
- HTML najpierw powstaje w izolowanym stagingu. Render desktop 1440 px i mobile 390 px musi przejść kontrolę overflow, fontów, proporcji i obrazów.
- Generator renderów zapisuje tylko `TECHNICAL_PASS` i `VISUAL_REVIEW_PENDING`; nie może sam nadać `reviewed_by`, `reviewed_at` ani `VISUAL_REVIEW_VERIFIED`. `PREVIEW_READY` wymaga rzeczywistego review desktopu, mobile, każdego elementu kanonicznego DOM inventory i każdej strony PDF. Dowody renderów pozostają w zarządzanym stagingu do wznowienia tej samej transakcji, lecz nie trafiają do Git ani publicznego `_site`.
- PDF powstaje ze stagingowego HTML. Każdą stronę trzeba wyrenderować do obrazu i obejrzeć; sama zgodność tekstowa nie wykrywa osieroconych wierszy ani źle podzielonych źródeł.
- Kontrola PDF wykonuje się do końca także wtedy, gdy w tym samym przebiegu wykryto osobny błąd HTML lub mobile; raport ma zawierać komplet niezależnych blokerów.
- Blok źródeł i disclaimer w PDF nie mogą rozpadać się przypadkowo między stronami.
- HTML i PDF w źródle oraz `_site` muszą być identyczne 1:1.

## 9. Publikacja, rollback i pomiar

- Publikacja jest atomowa: artykuł, media, PDF, listingi, sitemap, `llms.txt`, indeks wyszukiwarki, raporty i `_site` wchodzą razem.
- Backup i dziennik transakcji pozostają do końca walidacji. Błąd cofa cały zestaw; półgotowa publikacja jest niedopuszczalna.
- Po realnej publikacji system zapisuje manifest, historię URL-a, baseline GSC, checkpointy 7/14/28 oraz kolejkę „GSC po zmianach”.
- Brak wiersza strony w GSC to `NO_GSC_ROW_AT_PUBLICATION`, a brak danych to `GSC_INPUT_UNAVAILABLE`; nie wolno udawać zera.
- Kolejka GSC obejmuje target, sitemapę i tylko strony źródłowe, które faktycznie linkują do targetu.
- Metryki 28-dniowe pokazują kierunek po zmianie, lecz nie dowodzą samodzielnie jej przyczynowości.

## 10. `GSC` i `popraw-seo`

- `GSC` jest trybem analitycznym. Uruchamia `npm run gsc:auto`, synchronizuje dane w `~/Downloads/gsc-auto-input`, sprawdza ich kontrakt i dopiero potem przygotowuje raport; nie edytuje HTML.
- Wymagane są prawidłowe `queries.csv`, `pages.csv`, `query-pages.csv` oraz ich manifest. Brak, podmiana typu pliku, niespójny hash, stary zakres albo pomieszany cohort oznacza `INSUFFICIENT_DATA`.
- Warstwa property/stron jest nadrzędna. Query są niepełne z powodu anonimizacji i służą do rozpoznawania ujawnionych intencji.
- W `popraw-seo` zapytania z operatorami wyszukiwania (`site:`, `-site:` itd.) pozostają w danych surowych, lecz nie mogą tworzyć priorytetów redakcyjnych. Sygnał niskiego CTR wymaga co najmniej 30 wyświetleń w analizowanym oknie. Tytuł strony użyty awaryjnie oznaczamy jako temat, nie jako ujawnione query GSC. Automatyczne propozycje linków wymagają ręcznej kontroli kontekstu akapitu i nie trafiają do kolejki GSC bez rzeczywistej zmiany.
- Opcjonalny raport generatywnej AI z GSC jest dodatkową warstwą `GSC`/`popraw-seo`: zachowuje URL, kraj, urządzenie, feature i trend dzienny. Gdy raport nie jest jeszcze dostępny w rollout albo nie ma poprawnego eksportu, status musi wynosić `GSC_INPUT_UNAVAILABLE`, a metryki pozostają `null` — nigdy zero.
- Dane obejmują okna 7/28/90 dni i dostępne typy wyszukiwania. Stary, niepełny lub pomieszany cohort jest błędem blokującym.
- `popraw-seo` diagnozuje wszystkie indeksowalne `BlogPosting`: `article_inventory = diagnosed_articles = actions_assigned`, `omitted_articles = 0`.
- Każda strona otrzymuje koszyk i konkretne działanie: `BOOST`, `ROKUJE`, `NAPRAWA` albo `MONITORING`. Cooldown nie usuwa URL-a z raportu.
- `ROKUJE` ma stałą kolejność wykonania: najpierw 4 najwyżej sklasyfikowane strony jako pilotaż. Po ich `LIVE_DEPLOYED_AND_VALIDATED` raport jest liczony ponownie, a następna fala obejmuje 20 najwyżej sklasyfikowanych pozostałych stron `ROKUJE`. Każda fala nadal wymaga zatwierdzenia jej konkretnych ID.
- Brak danych GSC nie usuwa strony. Taki URL otrzymuje diagnostykę indeksacji i plan odkrywania.
- Raport rozdziela indeksację od widoczności oraz identyfikuje m.in. `INDEXED_ZERO_VISIBILITY`, `CRAWLED_NOT_INDEXED`, `DISCOVERED_NOT_INDEXED`, `UNKNOWN_TO_GOOGLE` i problemy canonical/robots.
- Raport zawiera mapę kanibalizacji, właściciela intencji, historię zmian, baseline i checkpointy 7/14/28.
- Każde uruchomienie kończy się szerokimi wnioskami dla całej witryny: widoczność artykułów, indeksacja, CTR, pozycje, koncentracja kliknięć, klastry, trend i potencjał obrazów.
- Raport kończy się `AWAITING_USER_APPROVAL`. Edycje wykonujemy dopiero po zatwierdzeniu konkretnych ID.
- Interfejs `popraw-seo` prowadzi od raportu przez zatwierdzenie ID do manifestu konkretnych patchy, dry-run, atomowego apply, HTML/PDF/_site/sitemap i walidacji. Po raporcie z tych etapów agent czeka na osobne „tak” użytkownika w czacie przed commitem, pushem, deployem lub IndexNow; akceptacja ID ani raportu nie są zgodą na którykolwiek z tych kroków.
- `seo:aio:wave:proposal` jest jedynym publicznym generatorem propozycji fali i zawsze kończy się `AWAITING_USER_APPROVAL`, z pustą `gsc_submit_queue`. Stara nazwa `seo:aio:apply-wave` oraz każdy argument `--apply` są twardo zablokowane. Lokalne wdrożenie wykonuje wyłącznie `popraw-seo:apply`, które przyjmuje `replace_exact` powiązane z hashem pliku i konkretną podstawą GSC/źródło/fakt/bezpieczeństwo/mapa linków.
- Lokalny komplet ma status `VALIDATED_LOCALLY_AWAITING_USER_RELEASE_APPROVAL`, nie `DEPLOYED`. Końcowa lista GSC pozostaje pusta do kontroli publicznego HTTP 200, canonical, `dateModified`, zatwierdzonej treści, sitemap i PDF oraz statusu `LIVE_DEPLOYED_AND_VALIDATED`.
- Jeśli którykolwiek etap po akceptacji ID nie przejdzie, agent zgłasza dokładny bloker. Nie wolno pomijać PDF, mirroru, sitemap, kontroli live ani listy GSC; commit, push, deploy i IndexNow nadal wymagają osobnego „tak” użytkownika po raporcie.
- Każdy artykuł zmieniany przez `popraw-seo` musi przejść pełną walidację jak nowy artykuł i spełnić wszystkie aktualne wymagania `ARTICLE_STANDARD.md`. Kontrola obejmuje całą stronę i wszystkie artefakty, również niezmienione sekcje; łączy walidatory z rzeczywistym przeglądem redakcyjnym i wizualnym. Sam PASS HTML nie wystarcza, a brak starego JSON-u nie pozwala pominąć bramek treści, dowodów lub architektury. Pełny kontrakt i sposób dokumentowania wyników określa sekcja „Pełna walidacja po `popraw-seo`” w `ARTICLE_STANDARD.md`.

### `popraw-ai`

- `popraw-ai` oznacza monitoring widoczności marki FitPo50 w odpowiedziach AI, a nie automatyczną edycję artykułów.
- Dla każdego testu zapisuj silnik, prompt, obecność nazwy FitPo50, obecność linku, cytowane źródła konkurencyjne, poprawność odpowiedzi i właściwy URL FitPo50.
- Nie mieszaj wyników ChatGPT, Gemini, Claude i Perplexity. Brak odpowiedzi lub danych oznacza `INSUFFICIENT_DATA`.
- `popraw-ai + popraw` pozwala wdrożyć wyłącznie konkretne zmiany wynikające z udokumentowanych odpowiedzi, po czym obowiązuje pełny Quality Gate i kolejka GSC.

## 11. Naprawy bez GSC

- `napraw paczkę N` korzysta ze stałego rejestru `data/reports/article-repair-batches.json` i nie uruchamia `popraw-seo`.
- Skład i numeracja paczek pozostają stałe; po pracy zmienia się status, nie lista URL-i.
- Każdy artykuł przechodzi pełną naprawę merytoryczną, techniczną, wizualną i PDF zgodnie z `ARTICLE_STANDARD.md`.
- Flaga audytu jest wskazaniem do sprawdzenia w kontekście, nie automatycznym poleceniem hurtowej zamiany.

## 12. Git, sprzątanie i deploy

- Nie wykonujemy `git commit` ani `git push` bez jawnego polecenia użytkownika.
- `git push` oznacza pełny pipeline: doctor, eksport, mirror, predeploy, kontrola diffu, commit i push.
- Status RED zatrzymuje push. YELLOW wymaga przeczytania ostrzeżeń; świadomie zatwierdzony duży zakres może użyć jednorazowego `FITPO50_BYPASS_DIFF_GUARD=1`, ale pozostałe testy nadal obowiązują.
- Nie używamy `git clean -fd`, `git reset --hard` ani ślepego usuwania untracked.
- Sprzątanie dotyczy wyłącznie jawnie sprawdzonej listy plików tymczasowych lub wyraźnie zatwierdzonego zakresu.
- Hostinger automatycznie wdraża `main`. Po zatwierdzonym pushu zmian utwórz i wypchnij marker w osobnym commicie, a następnie uruchom `npm run deployment:finalize`: kontrolę live i kontrolę ekspozycji. IndexNow wymaga kolejnego, osobnego „tak” użytkownika po obu pozytywnych statusach.
- `PUSHED` nie oznacza produkcji. `DEPLOYED` oznacza wykrycie markera z niepełną walidacją. Produkcję potwierdza wyłącznie `LIVE_DEPLOYED_AND_VALIDATED`.
- `npm run hostinger:clean-repo` jest wycofane. Awaryjne `npm run hostinger:recovery` domyślnie wykonuje tylko dry-run, nie usuwa nieznanych plików i blokuje się na brudnym lub rozbieżnym repo.
- Nawet bezpieczny `tmp:cleanup` wymaga osobnego „tak” użytkownika; domyślny dry-run nie zastępuje tej zgody.
- Katalogi robocze publikacji, eksportu, workbencha, GSC i PDF mają manifest właściciela oraz lock. Cleanup domyślnie jest dry-run i usuwa wyłącznie zarządzany katalog starszy niż 12 godzin, należący do bieżącego projektu, bez żywego PID-u.
- Katalog bez manifestu, katalog innego projektu, świeży workspace, aktywny PID lub błędny lock zawsze są pomijane.
- Chromium uruchamiaj wyłącznie przez `withChromium`, a zadania zapisujące w prepush wykonuj sekwencyjnie.

## 13. Pamięć modułowa

- Artykuły i Porady: dodatkowo `MEMORY_PORADY.md` oraz `ARTICLE_STANDARD.md`.
- NEWS: dodatkowo `MEMORY_NEWSY.md`.
- Moje Sukcesy: dodatkowo `MEMORY_MOJE_SUKCESY.md`.
- Monitoring publikacji: `docs/post-publication-monitoring.md`.
- Lista aktywnych komend: `docs/command-registry.md`.

## 14. Ostatni zweryfikowany test systemu

Publikacja `szczepionki-mrna-covid-a-rak.html` z 2026-08-26 potwierdziła obsługę starszego formatu draftu Claude, 18 zweryfikowanych źródeł, 22 mieszanych proporcjami obrazów, 8 semantycznych tabel, 7 bloków prostego wyjaśnienia oraz 22-stronicowego PDF. Utrwaliła kolejność: bramki treści → media → domknięcie dowodów dla podpisów → kompletny JSON → staging HTML/PDF → atom publikacyjny. Test ujawnił też dwie regresje naprawione u źródła: rezerwowanie miejsca na dopisek marki w `<title>` oraz zakaz usuwania linków i formatowania z pierwszego akapitu pod H2.

Publikacja `czy-jajka-podnosza-cholesterol.html` z 2026-08-25 potwierdziła działanie pełnego pipeline’u i utrwaliła następujące zabezpieczenia:

- fail-fast etapów JSON,
- rozdzielenie błędu transportu od uszkodzonego URL-a,
- minimum 4 użyte źródła zamiast 6 dekoracyjnych,
- brak opakowania tabel i innych bloków w `<p>`,
- poprawną normalizację polskiego `ł` w anchorach,
- brak samokanibalizacji przy `UPDATE`,
- quick answer 1–3 zdania z poprawną obsługą liczb dziesiętnych,
- jednoznaczne rozpoznanie kategorii po usunięciu draftu,
- odrzucanie mylących obrazów,
- obowiązkowy render i kontrolę wszystkich stron PDF,
- niedzielenie bloku źródeł i disclaimera w PDF.

Stan centrum tematycznego dla tego artykułu pozostaje `AWAITING_USER_APPROVAL`; bez akceptacji nie wolno dopisywać go do centrum „Cholesterol i badania”.
