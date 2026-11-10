# FitPo50 — aktywna pamięć projektu

## TWARDE ZASADY (czytaj na starcie każdej sesji, wygrywają przy sprzeczności)

- Bez osobnego „tak” użytkownika w czacie: zero commitów na `main`, pushy, deployów, merge'ów, IndexNow, ręcznego `tmp:cleanup` ani usuwania danych użytkownika, plików repozytorium lub gałęzi. Automatyczne sprzątanie własnego stagingu, locków i workspace bieżącej operacji jest dozwolone. Akceptacja ID lub raportu nie jest zgodą.
- Każda sesja zaczyna się tylko od odczytu: przeczytaj te zasady, pokaż `git status` oraz porównanie `main` z `origin/main`, a potem czekaj na zadanie.
- Pracuj wyłącznie w zakresie polecenia. Problem poza zakresem zgłoś, ale niczego w nim nie zmieniaj.
- Publikacja bieżącego zadania: wymagane kontrole lokalne → `_site` bez plików technicznych → marker przed commitem → dokładne `git add` → jeden commit → zwykły push z hookiem → kontrola efektu właściwa dla zmian. Bez dodatkowego `prepush:local`, ponownego importu gotowego artykułu i powtórnej finalizacji. Produkcja wymaga `LIVE_DEPLOYED_AND_VALIDATED` i `SECURITY_EXPOSURE_PASS`; dla dokumentacji bez wpływu publicznego wystarcza potwierdzenie pusha.
- Hostinger usuwa z serwera pliki skasowane z Gita (potwierdziła to próba B, commit `63065e09`). Do czasu Paczki 3, czyli przeniesienia danych panelu poza katalog deployu, nie wolno wyjmować z indeksu Git plików panelu: `data/news-live.json`, `data/news-backups/*`, `assets/news/*` ani ich mirrorów w `_site`.
- Nigdy nie commituj haseł ani `admin/config.php`; sprawdź, że `config.php` jest w `.gitignore`.
- Z `_site` wykluczaj: `HANDOFF.md`, `requirements*.txt`, fonty PDF, `.venv`, `__pycache__`, pliki `.py`/`.pyc` oraz `admin/*.md`.
- Pisarz odpowiada za treść, minimum 4 realne źródła z mapowaniem twierdzenie → źródło oraz FAQ z `gsc`/`paa`/`autocomplete`; `manual_research` jest zabronione przy ich tworzeniu. Grzegorz zatwierdza obrazy i wygląd. `article:add` sprawdza gotową paczkę wyłącznie technicznie, bez ponownego badania treści, dowodów, źródeł, FAQ, intencji SEO ani znaczenia zdjęć. Baseline ma dokładnie 32 artykuły legacy i 6 centrów.
- Linkowanie wewnętrzne tworzy lokalny pipeline, opakowując istniejące frazy linkami do istniejących stron bez dopisywania treści. Publikacja obejmuje kafel strony głównej, `porady.html`, właściwy dział, sitemapę, `llms.txt` i `llms-full.txt`.
- FitPo50 jest jednoosobowe. Zakres kontroli wynika z rzeczywistych zmian i ich wpływu, przez istniejący `scripts/lib/change-scope.js`. Zakres artykułu i powiązanego kodu łączy się; NEWS sprawdzaj tylko przy zmianach NEWS lub rzeczywistym wpływie wspólnej infrastruktury. Nie obejmuj innych lokalnych zmian ani całego portalu bez potrzeby. Aktualny wynik kontroli wykorzystuj ponownie przy zgodnych parametrach oraz hashach danych, kodu i konfiguracji, od których zależał.
- `popraw-seo`: fala obejmuje 3 pozycje według zysku i 2 rotacyjne spoza top 20; dane pochodzą z `data/reports/local/gsc-current`, a stan rotacji z `data/reports/local/seo-state/priority-rotation.json` i jest zużywany wyłącznie przez `--approve-round`.
- Bramka patchy wymaga podstawy `SOURCE` z URL-em, linków z lokalnej mapy, zakazuje podmiany całego dokumentu i sprawdza właściciela celu.
- `article:add --force` jest blokowane dla stron z wdrożonymi poprawkami SEO; wyjątek wymaga jawnej flagi `--allow-overwrite-seo-patches`.
- Tag `p:domain_verify` w `index.html` zostaje na stałe.
- Git sync panelu pozostaje wyłączony. `.htaccess` blokuje dotfiles poza `/.well-known/`, pliki `*.md`, szablon Bento i `admin/init-*.php`.
- Kody wyjścia: `0` = `READY`, `10` = `AWAITING_REVIEW` w zadaniu wymagającym decyzji, `20` = błąd paczki lub treści zależnie od zakresu, `30` = błąd środowiska. Techniczny PASS nie oznacza merytorycznego zweryfikowania materiału.
- Raportuj krótko, prosto i bez żargonu; zawsze podaj ryzyko oraz informację, czy zmianę można cofnąć.
- Nowe artykuły i ich pliki wejściowe używają wyłącznie miar europejskich: `kg`, `g`, `ml`, `cm` i `°C`.
- Po publikacji pliki robocze wolno skasować dopiero po sygnale Programisty, że artykuł jest live i sprawdzony.

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
- Pełny eksport HTML tworzy wyłącznie `export_site.sh`; `assets:mirror:sync` obsługuje PDF/NEWS i jawne mirrory assetów, nie naprawia HTML. Lokalne dodanie korzysta z istniejącego stagingu importera. `check:build-export` porównuje świeży eksport z `_site` plik po pliku; w publikacji pełny eksport i parity uruchamiaj tylko, gdy wynika to z wpływu zmian. Sonda porównuje wynik ze stanem sprzed operacji.
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

## 4A. Sposób współpracy z Grzegorzem

- Grzegorz prowadzi portal sam i nie ma śledzić plików, Git-a ani kolejności technicznej. Codex ustala bezpieczny zakres bieżącego zadania, prowadzi kontrole oraz zatrzymuje publikację przy realnym problemie.
- Pracuj konsekwentnie według `/Users/grzegorzkupiec/Downloads/plan-uproszczenia-dodawania-i-publikacji-fitpo50.md`. Po każdej części podaj `gotowe` i `następne`; nie proś o ponowne potwierdzanie rutynowych kroków w udzielonym zakresie. Sprawdzian odbędzie się na innym artykule. Błonnik jest zamknięty i nie jest materiałem do ponownego importu, walidacji ani próbnej publikacji.
- W każdej nietrywialnej odpowiedzi roboczej Codex podaje krótko: `teraz`, `gotowe`, `następny krok` oraz — tylko gdy jest potrzebna decyzja — jedno proste polecenie dla Grzegorza. Nie zasypuje go listami plików, chyba że poprosi o nie albo lista jest przyczyną blokady.
- Nie oznaczaj zadania jako zakończonego po samym commitcie lub pushu. Przy publikacji rozróżniaj: przygotowane lokalnie, wysłane na `main`, oczekiwanie na CDN i potwierdzone live.
- Aktualne wejście dla publikacji to `npm run publikuj -- [katalog-artykulu]`. Komenda potrafi wznowić artykuł, który jest już lokalnie gotowy, bez ponownego `article:add`, a bez katalogu obsługuje jednoznaczny bieżący zakres zmian kodu, testów lub dokumentacji.
- `publikuj` korzysta z manifestu artykułu i konkretnie powiązanych zmian kodu, testów lub dokumentacji ustalonych przez agenta. Sama ścieżka `scripts/`, `tests/` lub `docs/` nie dowodzi związku. Jedna lista służy markerowi i commitowi; hook potwierdza pliki rzeczywiście wysyłanych commitów i dostarcza ten zakres walidatorom. Po jednym pytaniu `Publikujemy? tak/nie` następują marker, dokładne `git add`, jeden commit, zwykły push i kontrola zmienionych stron oraz wymaganych artefaktów. Dla dokumentacji bez wpływu publicznego wystarcza push, bez CDN/NEWS. Bez `git add -A`, `git add .`, reimportu, dodatkowego `prepush:local` i powtórnej finalizacji.
- Części 1–4 planu są zaimplementowane lokalnie: zasady, profil `technical` istniejącego audytu i przekazanie go przez `article:add`, dry-run, przygotowanie, preflight, importer, HTML i staging. Usunięto `earlyEvidenceAudit` z kontrolera. Jawny profil redakcyjny pozostaje dostępny; pominiętych kontroli nie zapisuj jako PASS. Hooki walidacji HTML i kontraktu rozpoznają profil techniczny tylko dla HTML zgodnego z hashem w manifeście publikacji; funkcje używane przez `popraw-seo` domyślnie zachowują profil redakcyjny. Lokalne dodanie nowego artykułu i wznowienie po ograniczeniu środowiska sprawdzono w części 9 na `bezdech-senny-po-50-objawy`; pełna wysyłka i produkcja pozostają do odbioru w części 10.
- Część 5 jest zaimplementowana lokalnie w istniejącym `change-scope.js`: jawna mapa znanych modułów i ich testów, łączenie zakresów artykuł/mechanizm, osobna dokumentacja, raporty artykułu bez pełnego audytu oraz szersza kontrola artykułów po zmianie szablonu/CSS bez NEWS. Klasyfikacja podaje powód dla każdego pliku; nieznany wpływ zatrzymuje runner i przygotowanie markera przed kosztownymi kontrolami. Sonda eksportu pozostaje, a prywatne raporty nie stają się celami live.
- Kompletność mapy części 5 sprawdzają regresje pełnego `promotionCandidates` dla wszystkich kategorii oraz list plików wydań `de47230c` i `fb938609` zapisanych w fixture. Crosslink-suggestions wraz z mirrorem należą do artykułu; prywatny rejestr popraw-seo również, ale nie jest celem live. Reguły artykułów, baseline i JSON gate mają jawnie przypisane testy. Nie zastępuj tego dopuszczeniem całych katalogów `scripts/`, `tests/` lub `data/`.
- Część 6 jest zaimplementowana lokalnie: agent przekazuje dokładny zakres przez wewnętrzne `publikuj --task-files-json`, łączony z istniejącym manifestem artykułu. Grzegorz nadal wydaje polecenie „publikuj”. Marker otrzymuje tę samą listę przez `--files-json` i zapisuje `release_files` oraz hashe zawartości; dokładny git add obejmuje tę listę i oba markery. Hook commita porównuje staged z zakresem i sprawdzaną kopią; różnica zawartości zatrzymuje commit. Hook pusha ustala pełną listę z faktycznych remote/local SHA przekazanych przez Git, weryfikuje marker i hashe oraz przekazuje listę walidatorom. Niezwiązane zmiany robocze nie są dołączane. Walidatory nie wyliczają ponownie diffu, gdy otrzymały listę. Dotychczasowe niezwiązane staged pozostają nietknięte i blokują automatyczny commit.
- Część 7 jest zaimplementowana i sprawdzona lokalnie. NEWS/FTPS przy przygotowaniu i pushu oraz kontrola NEWS po pushu wynikają z tego samego klasyfikatora: NEWS albo wspólna infrastruktura. Inne wydania zachowują istniejący snapshot NEWS bez porównywania niezwiązanych lokalnych danych; brak snapshotu zatrzymuje przygotowanie z nazwanym błędem, bez ukrytego FTPS. Techniczny audyt i przygotowanie JSON-u wykorzystują zgodne hashe danych, kodu, konfiguracji i parametrów. Manifest artykułu zapisuje wynik stagingu powiązany z tymi zależnościami; precommit i trzy kontrole HTML/schema przed pushem mogą go użyć ponownie po kontroli zgodności plików. Zmiana wcześniejszego etapu unieważnia wynik zależny. Prywatne wyniki wybranych kontroli są w `data/reports/local/validation-results/`; runner rozróżnia EXECUTED i REUSED. Bez pełnej deklaracji zależności kontrola jest wykonywana normalnie. Wyniki błędów i przerwań nie są PASS. Kontrole sieci i stanu Git nie otrzymały uniwersalnego cache. Raport: `data/reports/local/validation-reuse-phase7.md`. Następna po wznowieniu wydania jest część 9 — wąskie testy i sprawdzian na nowym artykule. Nowy artykuł o bezdechu został dodany lokalnie; nie wykonano jeszcze rzeczywistego commita/pusha ani publikacji na serwerze.


- Część 8 korzysta z istniejącego `publikuj` i transakcji artykułu. Prywatny `data/reports/local/publikuj-state.json` zapisuje dokładny zakres, zgodę z hashami, marker, commit i wynik pusha. Gotowe artefakty oraz tożsamość paczki z manifestu (dla starszych transakcji z powiązanego raportu przygotowania) pozwalają pominąć import. Udany commit jest rozpoznawany także po przerwaniu przed zapisaniem statusu; nie tworzymy drugiego. Zmiana zakresu lub zawartości przed commitem unieważnia zgodę. Inny HEAD albo nowy katalog przy niedokończonym wydaniu zatrzymuje wznowienie zamiast mieszania zadań.
- Zwykły push z hookiem jest wykonywany przez proces `publikuj`, który może dokończyć pracę po zamknięciu kontrolera. Zapisuje PID, pełne wyjście w `data/reports/local/publikuj-push.log` i kod zakończenia w stanie wydania. Aktywny kontroler nie uruchamia drugiego przebiegu; wznowienie odbiera działający push. Stan zdalnego `main` potwierdza `git ls-remote`; jeśli commit już dotarł, ponowny push jest pomijany. Niepotwierdzony start bez PID zatrzymuje się jawnie, zamiast ryzykować drugi push. Błąd hooka nie jest automatycznie naprawiany ani omijany.
- Po pushu istniejący weryfikator kontroluje cele bieżącego markera i komplet hero AVIF/WebP/JPG. Zakresowy fingerprint odpowiada przygotowanemu wydaniu. Dokumentacja lub kod bez publicznego efektu kończą się `PUSHED_NO_PUBLIC_CHANGES`. Dla publicznego wydania oczekiwanie na CDN wznawia wyłącznie kontrolę live, bez importu, markera, commita ani pusha. Stary raport PASS nie zastępuje nieudanej nowej kontroli. Dopiero `LIVE_DEPLOYED_AND_VALIDATED` oraz bieżący `SECURITY_EXPOSURE_PASS` udostępniają listę zmienionych URL-i do ręcznego GSC i przypomnienie; przedtem lista nie jest gotowa. Bez automatycznego GSC/IndexNow. Rzeczywisty sprawdzian na nowym artykule oraz wysyłka pozostają do osobnego odbioru w częściach 9–10.


- Część 9: lokalny sprawdzian `bezdech-senny-po-50-objawy` zakończył się `PREVIEW_READY / TECHNICAL_PASS` i `SUCCESS`, exit 0. Pierwszą próbę zatrzymała wyłącznie piaskownica przy starcie Chromium (exit 30); wznowienie poza nią wykorzystało audyt i przygotowanie przez REUSED. Manifest CREATE obejmuje 61 artefaktów, 62 pliki z samym manifestem. Oryginalne 19 plików paczki pozostało bez zmian. Raport: `data/reports/local/phase9-bezdech-article-report.md`. Nie powtarzaj importu ani aktualnych kontroli tego artykułu. Kolejny krok to odbiór i osobno zatwierdzona wysyłka z części 10; produkcja nie jest jeszcze potwierdzona. Grzegorz zaakceptował dodanie do centrum „Sen po 50”; centrum i PDF zmieniono lokalnie, przegląd wizualny oczekuje na jego potwierdzenie.

## 5. Publikacja artykułu z JSON-u

- Przygotowanie i jawna redakcja materiału spełniają standard treści z `ARTICLE_STANDARD.md`; odpowiada za nie Pisarz. Zwykłe `article:add` odbiera paczkę technicznie. `popraw-seo` i `napraw paczkę N` zachowują własny, jawnie zlecony pełny zakres redakcyjny.
- JSON od autora nie jest dowodem prawdziwości twierdzeń. Techniczny import nie wydaje certyfikatu merytorycznego, nie pobiera źródeł ani nie ocenia ponownie FAQ, dowodów, SEO i znaczenia obrazów.
- Zbiorczy audyt techniczny → gotowy pakiet roboczy → jeden staging HTML/PDF i `TECHNICAL_PASS` → atomowe dodanie lokalne. Commit i wysyłka są osobnym etapem po zgodzie. Dotychczasowe nazwy `DRAFT`/`CONTENT_READY` pozostają nazwami istniejącego mechanizmu, nie dowodem wykonania kontroli redakcyjnej.
- Plik z `Downloads` pozostaje bez zmian. Pipeline pracuje na kontrolowanej kopii i nie archiwizuje zużytego JSON-u w repo.
- Publikacja rozróżnia `CREATE` i `UPDATE`; istniejący slug wymaga jawnego `--force true`.
- Pipeline działa fail-fast. Po pierwszym błędzie nie uruchamia etapów zależnych ani mutujących.
- Audyt wejściowy zbiera wszystkie możliwe do wykrycia błędy, a etap zapisujący działa fail-fast.
- Raport zbiera wszystkie niezależnie wykrywalne błędy techniczne paczki naraz, ze wskazaniem pola/pliku i poprawki. Niesprawdzone zależności są jawne. Błędy danych wracają do odpowiedzialnego autora paczki; błędy mechanizmu naprawia Codex. Nie dopisuje ani nie zmienia treści zdrowotnych, źródeł, dowodów lub podpisów.
- Wewnętrzny importer może zapisywać wyłącznie w aktywnym stagingu z krótkotrwałą capability wystawioną przez kontroler. Podrobienie flagi środowiskowej ani bezpośrednie wywołanie skryptu nie upoważnia do zapisu.
- Techniczne kontrole wejścia, importera i końcowych artefaktów mają spójny zakres: struktura JSON, wymagane pola, pliki, HTML/PDF i mirrory. Reguły redakcyjne nie wracają jako ukryta bramka importera lub hooka. Kontrolę błędów ujawniających się dopiero przy renderowaniu wykonuje staging.
- Finalne źródło prawdy to HTML, media, PDF, listingi, sitemap, indeksy, manifest publikacji i ich odpowiedniki w `_site`.

### Obowiązkowa naprawa podwójna

Każdy nowy problem ujawniony podczas `dodaj artykuł`, `Obal mit`, aktualizacji albo walidacji wymaga dwóch poziomów naprawy:

1. napraw bieżący artykuł i wszystkie jego artefakty,
2. znajdź przyczynę w importerze, walidatorze, szablonie, generatorze PDF, mediach albo dokumentacji i usuń ją dla przyszłych publikacji.

Jeżeli problem da się wykrywać automatycznie, dodaj test regresji lub celowo błędny fixture potwierdzający, że pipeline odtąd go blokuje albo poprawnie obsługuje. Nie wolno kończyć zadania na ręcznej korekcie jednego HTML-a, osłabiać istniejącej bramki ani ukrywać błędu warningiem. Jeśli przypadek jest wyłącznie jednostkowy i nie da się bezpiecznie uogólnić, zapisz konkretną regułę kontroli w `ARTICLE_STANDARD.md` zamiast tworzyć ryzykowny automat.

Po naprawie uruchom właściwe testy zmienionego mechanizmu i kontrole zależne od jego wpływu. Wykorzystuj aktualne wyniki dla identycznych danych, właściwego kodu, konfiguracji i parametrów; zmiana unieważnia etap i etapy od niego zależne. Dopisuj wyłącznie nowe, aktywne zasady, bez kolejnej historycznej kopii workflow.

Szczegółowy kontrakt znajduje się w `ARTICLE_STANDARD.md`.

## 6. Logika, źródła i FAQ

Poniższe wymagania są kontraktem Pisarza i jawnie zleconej redakcji. Techniczne `article:add` nie powtarza oceny treści, dowodów, źródeł ani researchu FAQ i nie sprawdza ich w sieci.

- Każdy akapit musi mieć jasne odniesienia. Zwroty typu „ta obietnica”, „ten wniosek” lub „haczyk” muszą w tym samym fragmencie nazwać konkretną rzecz.
- Każda metafora musi zostać domknięta rzeczywistym mechanizmem.
- Każdy wniosek wynika z wcześniejszego wyjaśnienia, źródła, liczby albo warunku.
- Liczby, progi, ceny, ryzyko, mechanizmy i twierdzenia medyczne wymagają przypisania do konkretnych `evidence_claims[]`.
- Starszy draft Claude może zostać przełożony na aktualny kontrakt tylko z jawnych danych: typ źródła → `evidence_level`, ID źródła → istniejący URL, opisowa lokalizacja → rzeczywista ścieżka JSON. `evidence_source_ids` pozwala domknąć mapowanie akapitów i podpisów bez wymyślania publikacji ani relacji dowodowej.
- Minimum to 4 realne i wykorzystane źródła. Nie wolno dodawać dekoracyjnych URL-i dla licznika.
- W tematach medycznych co najmniej dwa źródła i minimum 67% źródeł muszą mieć odpowiednią siłę naukową lub instytucjonalną.
- Źródła rozróżniają: `broken` dla 404/410, `blocked_by_publisher` dla 401/403/405, `temporarily_unavailable` dla 429 i 5xx oraz `verification_failed` dla DNS, timeoutu, TLS i błędu połączenia. Po ponownej próbie GET odpowiedź 403/405 jest ostrzeżeniem, jeśli źródło ma DOI/PMID albo domenę urzędową lub naukową; tylko takie źródło liczy się wtedy do minimum czterech. 404/410 blokuje jako martwy adres, a błąd środowiska kończy kodem 30 bez zapisu JSON-u. Sam HTTP 200 nie potwierdza tezy.
- FAQ nowego artykułu Pisarz przygotowuje wyłącznie z realnego GSC, PAA albo autocomplete; liczba może wynosić zero. Lokalny import nie bada ponownie pochodzenia pytań i nigdy ich nie wymyśla. `manual_research` jest zabronione przy tworzeniu i redakcji; w sześciu opublikowanych centrach zmiany linków i list artykułów zachowują wyjątek baseline tylko wtedy, gdy FAQ, jego JSON-LD i research są identyczne z HEAD.
- `quick_answer` ma 1–5 pełnych, konkretnych zdań, najwyżej 70 słów i nie może być generycznym wstępem.

## 7. Intencja, linkowanie i centra

- Przed publikacją określ `search_intent`, jedną `primary_keyword` i 3–8 `supporting_keywords`.
- Linkowanie wewnętrzne powstaje lokalnie na podstawie istniejących stron. Claude nie zna repozytorium i nie podaje slugów.
- Paczka nowego artykułu trafia do jednego katalogu `~/Downloads/<slug>/`: JSON Pisarza oraz dokładne warianty JPG, WebP i AVIF od Ilustratora. Pierwszy etap `article:add` zbiorczo rozdziela błędy na odpowiedzialność Pisarza i Ilustratora; lokalne linkowanie nie jest wymagane od żadnego z nich.
- Importowy skill Pisarza jest w `docs/skills/fitpo50-article-draft/`, a ZIP obok katalogu. Pisarz odpowiada za temat, treść, źródła i FAQ oraz przekazuje uwagi w `editorial_notes`; nie zgaduje lokalnych linków i centrów. Jego `DRAFT_VALID` nie jest wynikiem technicznego dodania. Na `dodaj artykuł` agent uruchamia istniejące `article:add` dla katalogu paczki, z lokalnym linkowaniem bez dopisywania treści i bez ponownej kontroli źródeł oraz pochodzenia FAQ. `article:prepare-json` pozostaje odrębnym, świadomie zleconym przygotowaniem.
- Liczba naturalnych linków kontekstowych wynika z planu; mniej niż dwa daje ostrzeżenie, nie blokadę.
- Aktualizowany URL nie może być uznany za kanibalizację samego siebie.
- Dla każdej intencji wybieramy jeden główny URL; pozostałe strony go wspierają i nie konkurują równolegle tym samym title/H1.
- Centrum tematyczne jest tylko propozycją `AWAITING_USER_APPROVAL`. Bez jawnej akceptacji nie zmieniamy centrum i nie wymuszamy hub-linku.

## 8. Obrazy, HTML i PDF

- Każdy pakiet artykułu ma jeden katalog wejściowy, dokładne nazwy, osobny hero i obrazy sekcji oraz lokalny manifest.
- Grzegorz ogląda i zatwierdza obrazy oraz wygląd. Codex sprawdza tylko nazwy, hashe, komplet AVIF/WebP/JPG, techniczną czytelność, wymiary i obecność wymaganych pól alt/podpis. Nie ocenia merytoryki, podobieństwa kadrów ani napisów i nie żąda osobnego wpisu review. Za zgodność ilustracji z materiałem odpowiada Ilustrator; ukryte fallbacki są zabronione.
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
- HTML najpierw powstaje w izolowanym stagingu. Automatyczny render desktop 1440 px i mobile 390 px sprawdza overflow, fonty, proporcje i ładowanie obrazów.
- Standardowy artykuł kończy się po automatycznym `TECHNICAL_PASS` właściwych artefaktów; Codex nie ogląda ręcznie desktop/mobile/PDF. Zmiana szablonu, CSS lub generatora rozszerza adekwatne kontrole techniczne. Ostateczny wygląd ocenia Grzegorz.
- PDF powstaje ze stagingowego HTML i przechodzi automatyczną kontrolę stron, tekstu, fontów, marginesów oraz ilustracji.
- Blok źródeł i disclaimer w PDF nie mogą rozpadać się przypadkowo między stronami.
- HTML i PDF w źródle oraz `_site` muszą być identyczne 1:1.

## 9. Publikacja, rollback i pomiar

- Publikacja jest atomowa: artykuł, media, PDF, listingi, sitemap, `llms.txt`, indeks wyszukiwarki, raporty i `_site` wchodzą razem.
- Backup i dziennik transakcji pozostają do końca walidacji. Błąd cofa cały zestaw; półgotowa publikacja jest niedopuszczalna.
- Po realnej publikacji system zapisuje manifest, historię URL-a, baseline GSC, checkpointy 7/14/28 oraz kolejkę „GSC po zmianach”.
- Brak wiersza strony w GSC to `NO_GSC_ROW_AT_PUBLICATION`, a brak danych to `GSC_INPUT_UNAVAILABLE`; nie wolno udawać zera.
- Kolejka GSC obejmuje target, sitemapę i tylko strony źródłowe, które faktycznie linkują do targetu.
- Metryki 28-dniowe pokazują kierunek po zmianie, lecz nie dowodzą samodzielnie jej przyczynowości.
- Po nowym wydaniu CDN może przez krótki czas nie podawać wersjonowanych obrazów lub PDF-u mimo aktualnego markera. `LIVE_DEPLOYED_AND_VALIDATED` wolno raportować dopiero po sprawdzeniu zwykłego URL-a artykułu oraz wszystkich nowych wariantów hero (AVIF/WebP/JPG); status CDN pending nie jest sukcesem.

## 10. `GSC` i `popraw-seo`

- `GSC` jest trybem analitycznym. Domyślne dane są w `data/reports/local/gsc-current`; `~/Downloads/...` wolno wskazać wyłącznie jawnym parametrem. `npm run gsc:auto` sprawdza kontrakt danych i dopiero potem przygotowuje raport; nie edytuje HTML.
- Wymagane są prawidłowe `queries.csv`, `pages.csv`, `query-pages.csv` oraz ich manifest. Brak, podmiana typu pliku, niespójny hash, stary zakres albo pomieszany cohort oznacza `INSUFFICIENT_DATA`.
- Warstwa property/stron jest nadrzędna. Query są niepełne z powodu anonimizacji i służą do rozpoznawania ujawnionych intencji.
- W `popraw-seo` zapytania z operatorami wyszukiwania (`site:`, `-site:` itd.) pozostają w danych surowych, lecz nie mogą tworzyć priorytetów redakcyjnych. Sygnał niskiego CTR wymaga co najmniej 30 wyświetleń w analizowanym oknie. Tytuł strony użyty awaryjnie oznaczamy jako temat, nie jako ujawnione query GSC. Automatyczne propozycje linków wymagają ręcznej kontroli kontekstu akapitu i nie trafiają do kolejki GSC bez rzeczywistej zmiany.
- Opcjonalny raport generatywnej AI z GSC jest dodatkową warstwą `GSC`/`popraw-seo`: zachowuje URL, kraj, urządzenie, feature i trend dzienny. Gdy raport nie jest jeszcze dostępny w rollout albo nie ma poprawnego eksportu, status musi wynosić `GSC_INPUT_UNAVAILABLE`, a metryki pozostają `null` — nigdy zero.
- Dane obejmują okna 7/28/90 dni i dostępne typy wyszukiwania. Stary, niepełny lub pomieszany cohort jest błędem blokującym.
- `popraw-seo` diagnozuje wszystkie indeksowalne `BlogPosting`: `article_inventory = diagnosed_articles = actions_assigned`, `omitted_articles = 0`.
- Każda strona otrzymuje koszyk i konkretne działanie: `BOOST`, `ROKUJE`, `NAPRAWA` albo `MONITORING`. Cooldown nie usuwa URL-a z raportu.
- `ROKUJE` ma stałą falę 3 pozycji według zysku i 2 rotacyjnych spoza top 20. Każda fala nadal wymaga zatwierdzenia jej konkretnych ID; model pilotażu 4 / 20 jest historyczny.
- Brak danych GSC nie usuwa strony. Taki URL otrzymuje diagnostykę indeksacji i plan odkrywania.
- Raport rozdziela indeksację od widoczności oraz identyfikuje m.in. `INDEXED_ZERO_VISIBILITY`, `CRAWLED_NOT_INDEXED`, `DISCOVERED_NOT_INDEXED`, `UNKNOWN_TO_GOOGLE` i problemy canonical/robots.
- Raport zawiera mapę kanibalizacji, właściciela intencji, historię zmian, baseline i checkpointy 7/14/28.
- Każde uruchomienie kończy się szerokimi wnioskami dla całej witryny: widoczność artykułów, indeksacja, CTR, pozycje, koncentracja kliknięć, klastry, trend i potencjał obrazów.
- Raport kończy się `AWAITING_USER_APPROVAL`. Edycje wykonujemy dopiero po zatwierdzeniu konkretnych ID.
- Interfejs `popraw-seo` prowadzi od raportu przez zatwierdzenie ID do manifestu konkretnych patchy, dry-run, atomowego apply, HTML/PDF/_site/sitemap i walidacji. Po raporcie z tych etapów agent czeka na osobne „tak” użytkownika w czacie przed commitem, pushem, deployem lub IndexNow; akceptacja ID ani raportu nie są zgodą na którykolwiek z tych kroków.
- `seo:aio:wave:proposal` jest jedynym publicznym generatorem propozycji fali i zawsze kończy się `AWAITING_USER_APPROVAL`, z pustą `gsc_submit_queue`. Stara nazwa `seo:aio:apply-wave` oraz każdy argument `--apply` są twardo zablokowane. Lokalne wdrożenie wykonuje wyłącznie `popraw-seo:apply`, które przyjmuje `replace_exact` powiązane z hashem pliku i konkretną podstawą GSC/źródło/fakt/bezpieczeństwo/mapa linków.
- Lokalny komplet ma status `VALIDATED_LOCALLY_AWAITING_USER_RELEASE_APPROVAL`, nie `DEPLOYED`. Końcowa lista GSC pozostaje pusta do kontroli publicznego HTTP 200, canonical, `dateModified`, zatwierdzonej treści, sitemap i PDF oraz statusu `LIVE_DEPLOYED_AND_VALIDATED`.
- Po każdym wdrożeniu obejmującym zmianę artykułu agent przypomina Grzegorzowi o ręcznym zgłoszeniu objętych URL-i w GSC. Nie zgłasza ich automatycznie i nie przypomina o tym przy zmianach wyłącznie kodu lub dokumentacji.
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
- `git push` wysyła istniejące commity i uruchamia normalny hook. Hook stosuje zakres rzeczywiście wysyłanych zmian i ich wpływu z `change-scope.js`; nie dołącza innych zmian lokalnych, nie tworzy commita i nie uruchamia pełnego audytu bez potrzeby.
- Status RED zatrzymuje push. YELLOW wymaga przeczytania ostrzeżeń; świadomie zatwierdzony duży zakres może użyć jednorazowego `FITPO50_BYPASS_DIFF_GUARD=1`, ale pozostałe testy nadal obowiązują.
- Nie używamy `git clean -fd`, `git reset --hard` ani ślepego usuwania untracked.
- Sprzątanie dotyczy wyłącznie jawnie sprawdzonej listy plików tymczasowych lub wyraźnie zatwierdzonego zakresu.
- Hostinger automatycznie wdraża `main`. Kontroler `publikuj` prowadzi od zatwierdzonego zakresu przez marker, jeden commit i normalny push do kontroli właściwego efektu. Nie dokładaj przed hookiem `prepush:local` ani po kontroli live drugiej finalizacji. NEWS/FTPS wyłącznie przy wpływie na NEWS; sama dokumentacja kończy się potwierdzeniem pusha. IndexNow wymaga osobnego „tak” po potwierdzonym live i bezpieczeństwie.
- `PUSHED` nie oznacza produkcji. `DEPLOYED` oznacza wykrycie markera z niepełną walidacją. Produkcję potwierdza wyłącznie `LIVE_DEPLOYED_AND_VALIDATED`.
- `npm run hostinger:clean-repo` jest wycofane. Awaryjne `npm run hostinger:recovery` domyślnie wykonuje tylko dry-run, nie usuwa nieznanych plików i blokuje się na brudnym lub rozbieżnym repo.
- Ręczny `tmp:cleanup` i każdy tryb apply wymagają osobnego „tak” użytkownika. Wbudowany `tmp:cleanup --dry-run` w `prepush:local` jest dozwolony.
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

Poniższe wyniki są historycznymi dowodami poprzedniego przebiegu, nie instrukcją ponownego uruchamiania jego bramek. Aktualny podział odpowiedzialności określają sekcje 4A–8.

Publikacja `szczepionki-mrna-covid-a-rak.html` z 2026-08-26 potwierdziła obsługę starszego formatu draftu Claude, 18 zweryfikowanych źródeł, 22 mieszanych proporcjami obrazów, 8 semantycznych tabel, 7 bloków prostego wyjaśnienia oraz 22-stronicowego PDF. Utrwaliła kolejność: bramki treści → media → domknięcie dowodów dla podpisów → kompletny JSON → staging HTML/PDF → atom publikacyjny. Test ujawnił też dwie regresje naprawione u źródła: rezerwowanie miejsca na dopisek marki w `<title>` oraz zakaz usuwania linków i formatowania z pierwszego akapitu pod H2.

Publikacja `czy-jajka-podnosza-cholesterol.html` z 2026-08-25 potwierdziła działanie pełnego pipeline’u i utrwaliła następujące zabezpieczenia:

- fail-fast etapów JSON,
- rozdzielenie błędu transportu od uszkodzonego URL-a,
- minimum 4 użyte źródła zamiast 6 dekoracyjnych,
- brak opakowania tabel i innych bloków w `<p>`,
- poprawną normalizację polskiego `ł` w anchorach,
- brak samokanibalizacji przy `UPDATE`,
- quick answer 1–5 zdań z poprawną obsługą liczb dziesiętnych,
- jednoznaczne rozpoznanie kategorii po usunięciu draftu,
- odrzucanie mylących obrazów,
- obowiązkowy render i kontrolę wszystkich stron PDF,
- niedzielenie bloku źródeł i disclaimera w PDF.

Stan centrum tematycznego dla tego artykułu pozostaje `AWAITING_USER_APPROVAL`; bez akceptacji nie wolno dopisywać go do centrum „Cholesterol i badania”.
