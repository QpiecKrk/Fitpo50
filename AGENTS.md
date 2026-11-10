# AGENTS.md — FitPo50

Najpierw przeczytaj sekcję „TWARDE ZASADY (czytaj na starcie każdej sesji, wygrywają przy sprzeczności)” na początku `PROJECT_MEMORY.md`. Jest nadrzędna wobec pozostałych instrukcji repozytorium.

To jest wejściowy kontrakt dla agentów pracujących w repozytorium. Nie zapisuj tu automatycznych obserwacji, przykładów commitów ani historii zmian.

## Kolejność instrukcji projektu

1. Przeczytaj sekcję „TWARDE ZASADY” w `PROJECT_MEMORY.md`, pokaż stan repozytorium i czekaj na zadanie.
2. Po otrzymaniu zadania przeczytaj `.cursor/active-context.md` oraz pozostałe właściwe sekcje `PROJECT_MEMORY.md`.
3. Dla artykułów przeczytaj `ARTICLE_STANDARD.md` i `MEMORY_PORADY.md`.
4. Dla NEWS przeczytaj `MEMORY_NEWSY.md`.
5. Dla Moich Sukcesów przeczytaj `MEMORY_MOJE_SUKCESY.md`.
6. Aktualne komendy sprawdzaj w `docs/command-registry.md`.

## Granice architektury

- Stosuj istniejący styl projektu; nie wprowadzaj drugiego frameworka lub odmiennego systemu modułów.
- Nie mieszaj CommonJS i ESM w tym samym obszarze projektu.
- W TypeScript nie używaj `any`; stosuj jawne typy i interfejsy.
- Obsługuj odrzucenia Promise przez `try/catch` albo `.catch()`.
- Używaj ścisłych porównań `===` i `!==`.
- `Porady`, `NEWS` i `Moje Sukcesy` są odrębnymi modułami.
- `_site` jest publicznym eksportem i musi być zgodny ze źródłem.
- Nie publikuj prywatnych konfiguracji, sekretów ani danych użytkowników.

## Bezpieczeństwo Git i plików

- Nigdy nie uruchamiaj `git clean -fd` ani `git reset --hard`.
- Nie usuwaj untracked ani produkcyjnych assetów bez sprawdzonej listy i zgody użytkownika.
- Nie cofaj zmian użytkownika, jeśli nie należą do bieżącego zadania.
- Nie wykonuj commit/push bez jawnego polecenia.
- Zakres kontroli wyznacza istniejący `scripts/lib/change-scope.js` z rzeczywistego wpływu zmian. Artykuł, powiązany kod i testy mogą należeć do jednego zadania; ich zakresy się łączą. NEWS sprawdzaj wyłącznie przy zmianach NEWS lub rzeczywistym wpływie wspólnej infrastruktury. Nie twórz drugiego klasyfikatora ani pełnego audytu z powodu samej nazwy katalogu.
- Standardem jest automatyczny deploy Hostinger z `main`: lokalny wynik wymaganych kontroli → marker przed commitem → dokładne dodanie plików zadania → jeden commit → zwykły push z hookiem → kontrola zmienionych stron i artefaktów live. Jedna lista plików zadania służy przygotowaniu markera i commita, a hook potwierdza zakres rzeczywiście wysyłanych commitów. Inne lokalne zmiany pozostają poza wydaniem. Produkcję uznaj dopiero przy `LIVE_DEPLOYED_AND_VALIDATED` i `SECURITY_EXPOSURE_PASS`; dokumentacja bez wpływu publicznego wymaga tylko potwierdzenia pusha. GSC i IndexNow nigdy nie są zgłaszane automatycznie.
- `npm run publikuj` jest wejściem dla bieżącego zadania. Agent ustala powiązane pliki bez wybierania ich przez Grzegorza. Po jednym pytaniu `Publikujemy? tak/nie` przygotowuje marker, wykonuje dokładne `git add`, jeden commit i zwykły push z hookiem oraz kontrolę efektu właściwą dla zmian. Nie używa `git add -A` ani `git add .`, nie importuje ponownie gotowego artykułu, nie uruchamia dodatkowego `prepush:local` ani osobnej, powtórnej finalizacji. Dla artykułu obejmuje kontrolą HTML i wymagane artefakty, w tym hero AVIF/WebP/JPG; dla dokumentacji nie czeka na CDN.
- Wynik kontroli wykorzystuj ponownie tylko przy zgodnych parametrach i hashach jej danych, właściwego kodu oraz konfiguracji. Zmiana unieważnia etap i zależne od niego wyniki; sam marker lub wcześniejszy PASS nie wystarcza. Pełny eksport i szersze kontrole wynikają z wpływu zmian, nie z samego polecenia `git push`.
- Hostinger usuwa z serwera pliki skasowane z Gita (próba B, commit `63065e09`). Dopóki Paczka 3 nie przeniesie danych panelu poza katalog deployu, nie wyjmuj z indeksu Git `data/news-live.json`, `data/news-backups/*`, `assets/news/*` ani ich mirrorów w `_site`.
- `npm run hostinger:clean-repo` jest wycofane. Awaryjne `hostinger:recovery` zaczyna się od dry-run i nie może usuwać nieznanych plików.
- Ręczny `tmp:cleanup` i każdy tryb apply wymagają osobnego „tak” użytkownika. Wbudowany `tmp:cleanup --dry-run` w `prepush:local` oraz automatyczne sprzątanie własnego stagingu, locków i workspace bieżącej operacji są dozwolone. Po zgodzie katalogi tymczasowe usuwaj wyłącznie tym mechanizmem: minimum 12 godzin, prawidłowy manifest właściciela, martwy PID i brak aktywnego locka.
- Każdy nowy staging lub workspace `/tmp` musi używać `scripts/lib/temp-workspace.js`; każdy nowy skrypt Playwright musi używać `withChromium`.
- W `prepush-parallel-checks` zadania muszą deklarować `access: read|write`; zadania zapisujące wykonuj sekwencyjnie albo w odrębnych workspace.
- Status każdej komendy z `package.json` musi być zapisany w `docs/command-registry.md` jako `PUBLIC`, `INTERNAL`, `RECOVERY` albo `RETIRED`; zgodność egzekwuje `command:contract:check`.
- Wewnętrzny zapis importera i prywatny staging wymagają capability wystawionej przez kontroler dla aktywnego workspace; sama zmienna środowiskowa nie jest autoryzacją.
- `export_site.sh` odpowiada za pełny eksport HTML, `sync-site-assets-mirror.js` wyłącznie za jawne mirrory PDF/NEWS/assetów, a świeży eksport musi przejść deterministyczne parity z `_site`.

## Treść FitPo50

- Zero generycznych tekstów i placeholderów.
- Artykuł ma wyczerpać realną intencję czytelnika, ale liczba i długość sekcji wynikają z tematu. Nie dopisuj sekcji, zdań ani obrazów dla sztucznego minimum.
- Pisarz odpowiada za logikę treści, dowody, źródła, FAQ i merytoryczne opisy ilustracji, Ilustrator za obrazy, a Grzegorz za ich akceptację oraz ostateczny wygląd. Zwykłe `article:add` odbiera gotową paczkę i sprawdza ją technicznie; nie powtarza kontroli redakcyjnej ani oglądania zdjęć. Wymagania treści poniżej dotyczą przygotowania materiału i jawnie zleconej redakcji.
- Niejasne odniesienia, niedomknięte metafory i wnioski bez przesłanek blokują publikację.
- FAQ pochodzi wyłącznie z realnego GSC/PAA/autocomplete; `manual_research` jest zabronione dla nowych pytań.
- Minimum 4 źródła oznacza źródła rzeczywiste, zweryfikowane i użyte w claimach.
- Każda liczba, próg, ryzyko, cena, mechanizm i teza medyczna wymaga konkretnego dowodu.

## Standard artykułu i zakres kontroli

- Zwykłe `article:add` wykonuje zbiorczy audyt techniczny JSON-u i plików oraz kontrolę wynikowego HTML/PDF i `_site` dla dodawanego artykułu. Nie ocenia claimów, źródeł, FAQ, intencji SEO, kanibalizacji ani znaczenia obrazów i nie pobiera ich źródeł z internetu. Pełna kontrola redakcyjna jest osobnym zadaniem; `popraw-seo` i `napraw paczkę N` zachowują swój jawnie zlecony zakres redakcyjny. Szczegółowy podział określa początek `ARTICLE_STANDARD.md`.
- Opis SEO ma 145–160 znaków, kończy się pełnym zdaniem i jest identyczny w meta, Open Graph, Twitter i `BlogPosting.description`.
- Pytające H2 kończą się `?`; pierwszy akapit pod H2 ma odpowiadać bezpośrednio i konkretnie na pytanie. Zakres 30–70 słów jest zaleceniem, nie samodzielnym blokerem.
- Liczba linków wewnętrznych wynika z naturalnego planu; mniej niż 2 daje ostrzeżenie, nie blokadę. Linki prowadzą do istniejących stron i używają ścieżek względnych.
- Obrazy korzystają z `<picture>` z AVIF/WebP/JPG, konkretnym `alt` i wymiarami. Grzegorz zatwierdza obrazy przed przekazaniem paczki; Codex nie powtarza ich ręcznego przeglądu, a pipeline sprawdza kompletność i zgodność techniczną wariantów. Wymagany jest hero oraz odrębny obraz dla każdej głównej sekcji treści. Zmieniony obraz zawsze otrzymuje nową, wersjonowaną nazwę, ponieważ publiczne assety mają cache `immutable`.
- Tabele są semantycznym HTML z `caption`, `thead`, `tbody` i `scope`.
- `BlogPosting.citation` jest zgodne 1:1 z wykorzystaną listą źródeł.
- Lokalne dodanie obejmuje jeden staging desktop/mobile, techniczną kontrolę PDF i synchronizację `_site` dla artykułu. Commit i push wykorzystują nadal aktualne wyniki zamiast ponawiać budowę. Szersza kontrola zależy od zmiany szablonu, CSS lub wspólnego generatora; ostateczny wygląd i obrazy ocenia Grzegorz.

## Zasada naprawy podwójnej

- Problem wykryty przy `dodaj artykuł`, `Obal mit`, aktualizacji lub walidacji napraw najpierw w bieżącym artykule i jego wszystkich artefaktach.
- Następnie usuń przyczynę w odpowiednim elemencie systemu: importerze, fixerze, walidatorze, szablonie, mediach, PDF lub dokumentacji.
- Jeśli problem można wykryć maszynowo, dodaj test regresji albo celowo błędny fixture. Test ma najpierw odtwarzać błąd, a po naprawie potwierdzać jego blokadę lub prawidłową obsługę.
- Nie rozwiązuj problemu przez osłabienie bramki, zmianę błędu na warning ani wyjątek ograniczony do jednego slugu.
- Jednostkowego przypadku, którego nie można bezpiecznie automatyzować, nie uogólniaj na ślepo; dodaj konkretną kontrolę do `ARTICLE_STANDARD.md`.

## Odpowiedzialność przy `article:add`

- Agent może poprawiać wyłącznie deterministyczną mechanikę bez zmiany znaczenia, na kontrolowanej kopii: pola techniczne, nazwy, manifesty, raporty oraz opakowanie istniejącej frazy linkiem zgodnym z planem. Oryginalny JSON i dostarczone obrazy pozostają bez zmian; brakujące warianty wracają do Ilustratora.
- Do Pisarza wracają zmiany treści, źródeł, `evidence_claims`, FAQ, `faq_research`, roli niejednoznacznej sekcji oraz merytorycznych opisów ilustracji. Agent nie dodaje ani nie podmienia tych danych.
- Do Ilustratora wracają brakujące, błędne albo merytorycznie niezgodne obrazy.
- Do użytkownika wracają świadome wyjątki od standardu, akceptacja obrazów, centra tematyczne oraz decyzje publikacyjne.
- `article:add --dry-run` nie zużywa próby naprawy i nie zapisuje wejściowego JSON-u ani repozytorium. Maksymalnie dwie próby automatycznej naprawy dotyczą jednego hasha draftu; kod 30 nie zwiększa licznika.
- Audyt zbiera wszystkie niezależnie wykrywalne błędy techniczne przed zapisem; zależności, których nie można sprawdzić, wymienia jako niesprawdzone. Błędy wynikowe HTML/PDF zbiera w stagingu. Nie wpisuj PASS dla kontroli niewykonanej lub nieobjętej zakresem.
- FitPo50 prowadzi jedna osoba: korzystaj z istniejących mechanizmów, minimalnych kontroli właściwych dla zmian i planu w Downloads. Po każdej części podaj krótko `gotowe` i `następne`. Sprawdzian uproszczenia wykonamy na innym artykule; zamkniętego błonnika nie importuj ani nie sprawdzaj ponownie w tym zadaniu.

## `popraw-seo`

- Nadrzędny cel: więcej widocznych artykułów i kliknięć.
- Raport obejmuje wszystkie indeksowalne `BlogPosting`; żaden URL nie może zostać pominięty.
- Każdy URL otrzymuje `BOOST`, `ROKUJE`, `NAPRAWA` albo `MONITORING` i konkretne działanie.
- Warstwa stron/property GSC jest nadrzędna wobec anonimizowanych query.
- `ROKUJE` wykonuj falami 3 pozycji według zysku i 2 rotacyjnych spoza top 20. Model pilotażu 4 / 20 jest historyczny.
- Raport kończy się `AWAITING_USER_APPROVAL`. Bez akceptacji konkretnych ID nie edytuj HTML.
- Po zatwierdzeniu ID agent przygotowuje konkretny manifest patchy, dry-run, atomowy apply i rollback, PDF/_site/sitemap oraz walidację, po czym raportuje wynik. Commit, push, deploy i IndexNow wymagają osobnego „tak” użytkownika w czacie po tym raporcie; akceptacja ID ani raportu nie są taką zgodą. Jeżeli etap nie przejdzie, zgłasza bloker zamiast go pomijać.
- Sam `git push` nie potwierdza produkcji. URL-e do GSC wolno podać dopiero po `LIVE_DEPLOYED_AND_VALIDATED`.
- Każdy artykuł zmieniany przez `popraw-seo` przechodzi pełną walidację jak nowy artykuł i musi spełnić wszystkie aktualne wymagania `ARTICLE_STANDARD.md`, także w niezmienionych sekcjach. Obowiązują łącznie bramki automatyczne, przegląd redakcyjny i kontrola wizualna wszystkich artefaktów; sam PASS HTML nie wystarcza. Brak lub błąd dowolnej wymaganej kontroli blokuje publikację.

## `napraw paczkę N`

- Użyj stałego rejestru `data/reports/article-repair-batches.json`.
- Nie przeliczaj składu paczek.
- Wykonaj pełną naprawę treści, linków, wyglądu, mediów, PDF, dat, sitemap i `_site`.
