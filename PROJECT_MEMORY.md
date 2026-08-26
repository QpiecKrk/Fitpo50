# FitPo50 — aktywna pamięć projektu

Ten plik zawiera wyłącznie aktualne decyzje. Nie jest kroniką zmian. Szczegółowe kontrakty artykułów są w `ARTICLE_STANDARD.md`, komendy w `docs/command-registry.md`, a monitoring publikacji w `docs/post-publication-monitoring.md`.

## 1. Cel projektu

- FitPo50 ma być widoczne w Google i zdobywać kliknięcia dzięki wiarygodnym, użytecznym treściom dla osób 50+.
- SEO, AEO, GEO i AIO są środkami do wzrostu widoczności i kliknięć, nie celem samym w sobie.
- Jakość merytoryczna, bezpieczeństwo medyczne i czytelność mają pierwszeństwo przed szybkością publikacji.
- Zakazane są generyczne dopiski. Każda zmiana treści musi wynikać z artykułu, danych GSC/PAA/autocomplete, realnego źródła, konkretnej liczby/progu albo jasnego warunku bezpieczeństwa.

## 2. Hierarchia dokumentów

W razie rozbieżności obowiązuje kolejność:

1. bieżące polecenie użytkownika,
2. `AGENTS.md`,
3. `PROJECT_MEMORY.md`,
4. `ARTICLE_STANDARD.md`,
5. pamięć modułowa: `MEMORY_PORADY.md`, `MEMORY_NEWSY.md`, `MEMORY_MOJE_SUKCESY.md`,
6. `docs/command-registry.md` i dokumentacja konkretnego mechanizmu,
7. historyczne raporty — wyłącznie jako dane, nigdy jako aktywne instrukcje.

`SESSION_START_MAX.md` jest skrótem operacyjnym rozpoczynającym sesję i ma być zgodny z powyższymi plikami.

## 3. Architektura serwisu

- Kategorie artykułów: `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`, `mity.html`.
- `mity.html` jest osobną kategorią, nie częścią `ciekawe.html`.
- `porady.html` jest zbiorczą stroną artykułów.
- `_site/` jest publicznym eksportem i musi być zgodny ze źródłem.
- `Moje Sukcesy`, `Porady` i `NEWS` są oddzielnymi modułami. Nie wolno mieszać ich danych ani logiki.
- Nie zmieniamy publicznych URL-i ani design systemu bez wyraźnej potrzeby i planu migracji.
- Pliki prywatne, szczególnie `admin/config.php`, `.env*`, klucze i dane użytkowników, nigdy nie trafiają do Git ani `_site`.

## 4. Start pracy

Na początku nowej sesji:

1. `git pull --ff-only origin main`,
2. przywrócenie wyłącznie technicznych katalogów agentów zgodnie z `SESSION_START_MAX.md`,
3. odczyt `PROJECT_MEMORY.md`, `.cursor/active-context.md` i dokumentów właściwych dla zadania,
4. `npm run assets:mirror:sync`,
5. `npm run predeploy:check`.

Jeżeli którykolwiek krok poza dozwolonym, nieblokującym restore zwróci błąd lub wynik niejednoznaczny, przerwij i pokaż konkretny problem.

## 5. Publikacja artykułu z JSON-u

- JSON od Claude lub innego modelu jest zawsze draftem, nie źródłem prawdy.
- Korekta JSON-u i publikacja to dwa odrębne etapy: `DRAFT` → `CONTENT_READY` → `PREVIEW_READY` → `COMMITTED`; błąd daje `BLOCKED`.
- Plik z `Downloads` pozostaje bez zmian. Pipeline pracuje na kontrolowanej kopii i nie archiwizuje zużytego JSON-u w repo.
- Publikacja rozróżnia `CREATE` i `UPDATE`; istniejący slug wymaga jawnego `--force true`.
- Pipeline działa fail-fast. Po pierwszym błędzie nie uruchamia etapów zależnych ani mutujących.
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
- Błąd transportu źródła ma status `verification_failed`; rzeczywiste HTTP 4xx/5xx jest klasyfikowane osobno. Oba stany blokują publikację do wyjaśnienia.
- FAQ powstaje wyłącznie z realnego GSC, PAA, autocomplete lub udokumentowanego researchu. Pipeline nigdy nie wymyśla brakujących pytań.
- `quick_answer` ma 1–3 pełne, konkretne zdania i nie może być generycznym wstępem.

## 7. Intencja, linkowanie i centra

- Przed publikacją określ `search_intent`, jedną `primary_keyword` i 3–8 `supporting_keywords`.
- Linkowanie wewnętrzne powstaje lokalnie na podstawie istniejących stron. Claude nie zna repozytorium i nie podaje slugów.
- Importowy skill Claude dla nowych draftów znajduje się w `docs/skills/fitpo50-article-draft/`, a gotowy ZIP obok tego katalogu. Claude kończy wyłącznie na `DRAFT`; `DRAFT_VALID` nie oznacza `CONTENT_READY`. Wszystkie uwagi przekazuje w `editorial_notes`, bez osobnej notatki i bez zgadywania linków, centrum lub GSC. Przy poleceniu `dodaj artykuł` lokalny agent uruchamia jedną komendę `article:add`; samo `article:prepare-json` stosuje tylko na jawne żądanie korekty bez publikacji.
- Artykuł ma minimum 4 naturalne linki kontekstowe do istniejących URL-i, ze ścieżkami względnymi.
- Aktualizowany URL nie może być uznany za kanibalizację samego siebie.
- Dla każdej intencji wybieramy jeden główny URL; pozostałe strony go wspierają i nie konkurują równolegle tym samym title/H1.
- Centrum tematyczne jest tylko propozycją `AWAITING_USER_APPROVAL`. Bez jawnej akceptacji nie zmieniamy centrum i nie wymuszamy hub-linku.

## 8. Obrazy, HTML i PDF

- Każdy pakiet artykułu ma jeden katalog wejściowy, dokładne nazwy, osobny hero i obrazy sekcji oraz lokalny manifest.
- Każdy publikowany obraz musi zostać rzeczywiście obejrzany. Mylące liczby, niepowiązany tekst, błędne kadry i ukryte fallbacki są zabronione.
- Wymagane warianty: AVIF, WebP i JPG z prawdziwymi wymiarami, konkretnym `alt` i podpisem.
- Po zatwierdzonej kontroli wizualnej rzeczywiste proporcje pliku zastępują planowaną proporcję z promptu. Layout obsługuje panoramy, krajobraz, kwadrat i pionowe plansze bez wymuszania przycięcia; pionowe i kwadratowe obrazy dostają własny wariant układu.
- Tabele są semantycznym HTML: `caption`, `thead`, `tbody`, `th` i odpowiednie `scope`. Grafika tabeli nie zastępuje tabeli.
- Importer automatycznie dodaje tabelom klasę, mobilny kontener przewijania oraz brakujące `scope`; finalna bramka tabel działa dopiero na zbudowanym HTML.
- Importer nie może upraszczać pierwszego akapitu pod H2 do czystego tekstu: zachowuje istniejące linki, `<strong>`, `<em>` i pozostałe poprawne znaczniki inline. Akapit poza limitem 30–70 słów ma zostać zablokowany przez walidator, a nie po cichu przycięty. Licznik słów liczy widoczny tekst po usunięciu znaczników, nigdy nazwy atrybutów ani slug z `href`.
- Limit `<title>` 65 znaków obejmuje także stały dopisek ` | FitPo50`; dlatego `seo_title` bez marki ma maksymalnie 55 znaków. H1 pozostaje niezależnym tytułem artykułu.
- HTML najpierw powstaje w izolowanym stagingu. Render desktop 1440 px i mobile 390 px musi przejść kontrolę overflow, fontów, proporcji i obrazów.
- PDF powstaje ze stagingowego HTML. Każdą stronę trzeba wyrenderować do obrazu i obejrzeć; sama zgodność tekstowa nie wykrywa osieroconych wierszy ani źle podzielonych źródeł.
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
- Dane obejmują okna 7/28/90 dni i dostępne typy wyszukiwania. Stary, niepełny lub pomieszany cohort jest błędem blokującym.
- `popraw-seo` diagnozuje wszystkie indeksowalne `BlogPosting`: `article_inventory = diagnosed_articles = actions_assigned`, `omitted_articles = 0`.
- Każda strona otrzymuje koszyk i konkretne działanie: `BOOST`, `ROKUJE`, `NAPRAWA` albo `MONITORING`. Cooldown nie usuwa URL-a z raportu.
- Brak danych GSC nie usuwa strony. Taki URL otrzymuje diagnostykę indeksacji i plan odkrywania.
- Raport rozdziela indeksację od widoczności oraz identyfikuje m.in. `INDEXED_ZERO_VISIBILITY`, `CRAWLED_NOT_INDEXED`, `DISCOVERED_NOT_INDEXED`, `UNKNOWN_TO_GOOGLE` i problemy canonical/robots.
- Raport zawiera mapę kanibalizacji, właściciela intencji, historię zmian, baseline i checkpointy 7/14/28.
- Każde uruchomienie kończy się szerokimi wnioskami dla całej witryny: widoczność artykułów, indeksacja, CTR, pozycje, koncentracja kliknięć, klastry, trend i potencjał obrazów.
- Raport kończy się `AWAITING_USER_APPROVAL`. Edycje wykonujemy dopiero po zatwierdzeniu konkretnych ID.
- Interfejs `popraw-seo` jest jednoprzyciskowy poza obowiązkową akceptacją jakości: użytkownik uruchamia raport i zatwierdza ID. Dalej agent sam przygotowuje niezmienny manifest konkretnych patchy, wykonuje dry-run, atomowy apply, HTML/PDF/_site/sitemap, walidację, commit/push, monitoring produkcji i listę GSC. Nie wolno wymagać od użytkownika pamiętania komend pośrednich.
- Stary `seo:aio:apply-wave --mode safe-links` jest wycofany, bo dopisywał generyczny akapit. `popraw-seo:apply` przyjmuje wyłącznie `replace_exact` powiązane z hashem pliku i konkretną podstawą GSC/źródło/fakt/bezpieczeństwo/mapa linków.
- Lokalny komplet ma status `COMMITTED_LOCALLY_AWAITING_LIVE_DEPLOYMENT`, nie `DEPLOYED`. Końcowa lista GSC pozostaje pusta do kontroli publicznego HTTP 200, canonical, `dateModified`, zatwierdzonej treści, sitemap i PDF oraz statusu `LIVE_DEPLOYED_AND_VALIDATED`.
- Jeśli którykolwiek etap po akceptacji nie przejdzie, agent zgłasza dokładny bloker. Nie wolno pomijać PDF, mirroru, sitemap, pushu, kontroli live ani listy GSC dlatego, że użytkownik nie podał osobnej komendy.
- Zatwierdzona naprawa URL-a oznacza pełny Quality Gate strony, a nie wyłącznie title/meta lub jeden dopisek.

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
- Po pushu na Hostingerze: `npm run hostinger:clean-repo`, następnie standardowy deployment.

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
