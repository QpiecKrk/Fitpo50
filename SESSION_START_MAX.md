# SESSION START MAX — FitPo50

Najpierw przeczytaj sekcję „TWARDE ZASADY (czytaj na starcie każdej sesji, wygrywają przy sprzeczności)” na początku `PROJECT_MEMORY.md`. Jest nadrzędna wobec pozostałych instrukcji repozytorium.

Ten plik jest krótkim kontraktem rozpoczęcia nowej sesji. Szczegóły znajdują się w `PROJECT_MEMORY.md`, `ARTICLE_STANDARD.md` i `docs/command-registry.md`.

## Instrukcja dla agenta

Pracujemy domyślnie po polsku. Zakładaj, że użytkownik nie zna technicznych szczegółów: podawaj wynik prostym językiem, a przy ręcznych działaniach gotowe komendy.

### 1. Start odczytowy — zawsze jako pierwszy krok nowej sesji

```bash
cd /Users/grzegorzkupiec/Projects/FitPo50-local
git status --short
git branch --show-current
git rev-parse --short=8 main
git rev-parse --short=8 origin/main
```

- Przeczytaj twarde zasady, pokaż stan repozytorium i porównanie `main` z `origin/main`, a następnie czekaj na zadanie.
- Start jest wyłącznie odczytowy: bez `pull`, `restore`, eksportu, synchronizacji, walidacji, sprzątania i innych zapisów.

### 2. Obowiązkowa lektura po otrzymaniu zadania

Zawsze przeczytaj w całości:

- `PROJECT_MEMORY.md`,
- `.cursor/active-context.md`.

Dodatkowo według zadania:

- artykuły/Porady: `ARTICLE_STANDARD.md` i `MEMORY_PORADY.md`,
- NEWS: `MEMORY_NEWSY.md`,
- Moje Sukcesy: `MEMORY_MOJE_SUKCESY.md`,
- komendy i pipeline: `docs/command-registry.md`,
- monitoring publikacji: `docs/post-publication-monitoring.md`.

### 3. Zasady bezwzględne

- Zero generycznych tekstów, placeholderów i zgadywania.
- Nowy artykuł, import, każda aktualizacja, `popraw-seo` i `napraw paczkę N` przechodzą ten sam pełny Quality Gate z `ARTICLE_STANDARD.md`, obejmujący całą stronę i wszystkie artefakty.
- Liczba sekcji i obrazów wynika z realnego zakresu tematu. Nie wydłużaj tekstu dla minimum; wymagaj hero i odrębnego obrazu dla każdej głównej sekcji merytorycznej.
- JSON z zewnątrz jest draftem. Sprawdź logikę akapit po akapicie, dowody, FAQ, intencję, linki i prawdziwe obrazy.
- Każda liczba, próg, cena, ryzyko, mechanizm lub teza medyczna wymaga konkretnego źródła i mapowania claimu.
- FAQ pochodzi wyłącznie z GSC/PAA/autocomplete; `manual_research` jest zabronione dla nowych pytań i niczego nie wolno automatycznie wymyślać.
- Minimum 4 źródła oznacza 4 realne i wykorzystane źródła, nie dekoracyjną bibliografię.
- Tabele są semantycznym HTML, nigdy obrazem ani tekstem rozdzielonym kreskami.
- Każdy obraz obejrzyj i sprawdź w kontekście sekcji. Watermark sam nie blokuje, lecz mylący tekst, liczby, anatomia, sprzęt lub kadr blokują publikację.
- Nie publikuj bez PDF, kontroli desktop/mobile, obejrzenia wszystkich stron PDF oraz zgodności source/`_site`.
- Korzystaj tylko z wejść `PUBLIC` w `docs/command-registry.md`. Komendy `INTERNAL` wywołuje kontroler, `RECOVERY` służą wyłącznie awarii, a `RETIRED` są zabronione.
- Nie uruchamiaj importera ani prywatnego stagingu przez ręczne ustawienie zmiennych środowiskowych; zapis wymaga capability wystawionej przez kontroler aktywnego stagingu.
- `assets:mirror:sync` nie synchronizuje HTML. Pełny eksport tworzy `export_site.sh`, a `prepush:local` musi potwierdzić deterministyczną zgodność świeżego eksportu z `_site`.
- Nie commituj roboczego JSON-u po zakończonej publikacji.
- Nie wykonuj commit/push, usuwania lub wdrożenia bez odpowiedniego polecenia użytkownika.

### 4. Znaczenie głównych poleceń

#### `dodaj artykuł`

To jedno polecenie użytkownika uruchamia kanoniczne `article:add`. Użytkownik przekazuje JSON i obrazy; nie musi pamiętać komend pośrednich. Wewnątrz pozostają dwie bezpiecznie rozdzielone fazy:

1. Szybkie `popraw-json`: `DRAFT` → `CONTENT_READY`, bez tworzenia HTML. Najpierw logika, źródła, intencja i preflight samej treści; potem kontrola podpisów/obrazów i brakujące warianty mediów; na końcu ponowne domknięcie dowodów dla podpisów oraz bramka kompletnego JSON-u.
   Draft dla Claude można tworzyć skillem `docs/skills/fitpo50-article-draft/`; jego walidacja potwierdza tylko strukturę `DRAFT`. Claude może dostarczyć FAQ tylko z rzeczywistym sygnałem zapisanym 1:1 w `faq_research`; lokalny pipeline zawsze ponownie sprawdza ten sygnał. Brak FAQ pozostaje prawidłowy, jeśli research nie znalazł rzeczywistych pytań.
2. Lokalna intencja, kanibalizacja, plan linkowania z lokalnego pipeline'u i propozycja centrum.
3. Rzeczywista kontrola obrazów oraz manifest AVIF/WebP/JPG.
4. Transakcyjny staging HTML i PDF.
5. Render desktop/mobile oraz wszystkich stron PDF daje wyłącznie `TECHNICAL_PASS` i zatrzymuje staging na `VISUAL_REVIEW_PENDING`.
6. Po rzeczywistym obejrzeniu obu widoków, każdego obrazu i każdej strony PDF powstaje `VISUAL_REVIEW_VERIFIED`; dopiero wtedy raport `version=3` otrzymuje `PREVIEW_READY` i ta sama transakcja może zostać wznowiona.
7. Atomowa publikacja `CREATE` lub jawne `UPDATE --force true`.
8. Listingi, sitemap, indeksy, `llms.txt`, `_site`, historia i kolejka GSC.
9. Wszystkie walidatory z `ARTICLE_STANDARD.md`.

Techniczna komenda kanoniczna: `npm run article:add -- --file "<draft.fitpo50.json>"`. Kontroler zapisuje stan i przy kolejnym wywołaniu rozpoznaje ten sam staging. Po obejrzeniu artefaktów agent przekazuje w tej samej komendzie `--review-file <review.json>`; `--status true` pokazuje stan. Jeśli w czasie oczekiwania zmienił się JSON, stary staging pozostaje nienaruszony i dopiero jawne `--restart true` rozpoczyna nową transakcję. `article:prepare-json` służy tylko wtedy, gdy użytkownik jawnie chce dostać poprawiony JSON bez publikacji. `article:publish` pozostaje wewnętrznym silnikiem kontrolera i nie jest osobnym workflow użytkownika.

Pipeline działa fail-fast. Po błędzie nie uruchamia zależnych etapów ani nie zostawia półgotowej publikacji. Poprawne sprawdzenia URL-i są pamiętane lokalnie przez 7 dni, warianty niezmienionych obrazów są ponownie używane, a kolejne podejście zapisuje ten sam roboczy pakiet zamiast tworzyć serie `-r2`, `-r3`. Jeśli atom zawiedzie, identyczny hashami pakiet `CONTENT_READY` jest przy kolejnej próbie używany bez ponownego przygotowania. Zmiana JSON-u albo obrazu unieważnia pamięć pakietu; tanie bramki treści zawsze wykonują się podczas nowego przygotowania.

Starszy JSON Claude jest migrowany wyłącznie z jawnych danych źródłowych i `evidence_source_ids`; pipeline nie wymyśla dowodów. Obecny układ artykułu przyjmuje obrazy krajobrazowe: hero co najmniej 1080×600, sekcja co najmniej 900×500 i proporcję 1.2–2.1. Portret lub kwadrat wymaga w przyszłości osobnego, jawnie opisanego typu layoutu; nie rozszerzamy tolerancji całego systemu. Importer domyka semantykę i mobilny kontener tabel przed podglądem 390 px.

Importer zachowuje linki i semantyczne formatowanie inline w pierwszym akapicie pod każdym H2. Nie wolno po cichu zamieniać go na czysty tekst ani przycinać. Pierwszy akapit działa answer-first: odpowiada bezpośrednio i konkretnie na H2; 30–70 słów jest zaleceniem, a nie samodzielnym blokerem. `seo_title` ma maksymalnie 55 znaków, ponieważ finalny limit 65 obejmuje także stały dopisek ` | FitPo50`.

Każdy nowy błąd wykryty podczas `dodaj artykuł` albo `Obal mit` napraw dwupoziomowo: najpierw w bieżącym artykule, następnie u źródła w pipeline. Gdy błąd można wykryć automatycznie, dodaj test regresji lub błędny fixture. Nie kończ na ręcznej korekcie jednego pliku i nie osłabiaj bramki, aby przepuścić artykuł.

#### `GSC`

- Tryb wyłącznie analityczny.
- Uruchom `npm run gsc:auto`; domyślne dane robocze to ignorowane `data/reports/local/gsc-current`. Katalog w `~/Downloads` używaj wyłącznie przez jawny parametr.
- Zweryfikuj `queries.csv`, `pages.csv`, `query-pages.csv`, manifest oraz kompletny cohort 7/28/90 dni.
- Warstwa stron/property pokazuje rzeczywisty agregat; query są niepełne z powodu anonimizacji.
- Brak wymaganych danych oznacza `INSUFFICIENT_DATA`, nie zgadywanie.
- Nie edytuj HTML.

#### `popraw-seo`

- Uruchom pełny raport GSC/SEO/AEO/GEO/AIO dla wszystkich indeksowalnych `BlogPosting`.
- Bramka: `article_inventory = diagnosed_articles = actions_assigned`, `omitted_articles = 0`.
- Każdy URL trafia do `BOOST`, `ROKUJE`, `NAPRAWA` albo `MONITORING` i dostaje konkretne działanie.
- Cooldown i brak ujawnionych query nie usuwają URL-a.
- Dla stron bez widoczności sprawdź stan indeksacji, canonical, robots i plan odkrywania.
- Raport zawiera mapę kanibalizacji, historię, baseline, checkpointy 7/14/28 oraz szerokie wnioski całej witryny.
- Dla `ROKUJE` obowiązuje fala 3 pozycji według zysku i 2 rotacyjne spoza top 20. Pilotaż 4 / 20 jest modelem historycznym.
- Zakończ na `AWAITING_USER_APPROVAL`; nie edytuj bez zatwierdzenia konkretnych ID.
- Po zatwierdzeniu ID agent tworzy konkretny manifest `replace_exact`, uruchamia atomowy `popraw-seo:apply` i sprawdza HTML/PDF/mobile/desktop/_site/sitemap, a następnie raportuje wynik. Commit, push, deploy i IndexNow wykonuje wyłącznie po osobnym „tak” użytkownika w czacie po raporcie; akceptacja ID ani raportu nie są taką zgodą. Każdy brak lub błąd zgłasza jawnie jako bloker.
- Lista GSC powstaje wyłącznie po `LIVE_DEPLOYED_AND_VALIDATED`; lokalny komplet ani sam `git push` nie są dowodem wdrożenia produkcyjnego.
- Po zatwierdzeniu każdy zmieniany artykuł musi przejść pełną walidację jak nowy artykuł: wszystkie aktualne wymagania `ARTICLE_STANDARD.md`, cała treść i wszystkie artefakty, kontrole automatyczne oraz rzeczywisty przegląd redakcyjny i wizualny. Sam PASS HTML nie wystarcza. Brak lub błąd wymaganej kontroli blokuje publikację.

#### `popraw-ai`

- Monitoruj osobno ChatGPT, Gemini, Claude i Perplexity: wzmiankę FitPo50, link, konkurencyjne źródła, poprawność odpowiedzi i właściwy URL FitPo50.
- Bez dostarczonych odpowiedzi lub danych zwróć `INSUFFICIENT_DATA` i listę testów do wykonania.
- Nie edytuj stron, chyba że użytkownik napisze `popraw-ai + popraw` i istnieją konkretne dowody uzasadniające zmianę.

#### `napraw paczkę N`

- Użyj stałego składu z `data/reports/article-repair-batches.json`.
- Nie uruchamiaj GSC i nie przeliczaj numeracji.
- Napraw każdy wskazany artykuł merytorycznie, technicznie, wizualnie i w PDF zgodnie z pełnym Quality Gate.

#### `git push` / `git push wszystko`

Wykonaj kolejno:

```bash
npm run prepush:local
# sprawdź, że _site nie zawiera plików technicznych
npm run deployment:prepare
git add -A
git commit -m "<konkretny opis treści i markera>"
git push origin main
npm run deployment:finalize
```

- Cały ten workflow wymaga wcześniejszego, osobnego „tak” użytkownika w czacie; akceptacja ID lub raportu nie wystarcza.
- Status RED zatrzymuje push. Przy YELLOW przeczytaj i oceń ostrzeżenia.
- Nienaturalnie duży, niezatwierdzony zakres wymaga potwierdzenia. `git push wszystko` zatwierdza cały wcześniej omówiony zakres.
- Jeśli świadomie zatwierdzony zakres przekracza diff guard, wolno jednorazowo użyć `FITPO50_BYPASS_DIFF_GUARD=1`; pozostałe testy nadal muszą przejść.
- Hostinger automatycznie wdraża `main`. Marker przygotuj przed commitem; treść i marker trafiają do jednego commita i jednego pusha. Potem uruchom `npm run deployment:finalize`; czekaj na `LIVE_DEPLOYED_AND_VALIDATED` i `SECURITY_EXPOSURE_PASS`. IndexNow nie jest częścią pusha i wymaga kolejnego, osobnego „tak” użytkownika.
- `PUSHED` oznacza wyłącznie obecność commita na GitHubie. `DEPLOYED` oznacza wykrycie markera na serwerze z niepełną walidacją. Dopiero `LIVE_DEPLOYED_AND_VALIDATED` potwierdza produkcję i pozwala utworzyć listę GSC.
- `npm run hostinger:clean-repo` jest wycofane. Przy rzeczywistym błędzie integracji zacznij od `npm run hostinger:recovery` w trybie dry-run i stosuj kontrakt z `docs/deployment-status-contract.md`.
- Ręczny `npm run tmp:cleanup` i każdy tryb apply wymagają osobnego „tak” użytkownika. Wbudowany dry-run w `prepush:local` oraz automatyczne sprzątanie własnego stagingu, locków i workspace bieżącej operacji są dozwolone. `tmp:cleanup:apply` używaj dopiero po przeglądzie listy i odrębnej zgodzie.

### 5. Najważniejsze regresje, których nie wolno przywrócić

- Nie uruchamiaj dalszych etapów po pierwszym `FAIL`.
- `verification_failed` nie jest tym samym co uszkodzony URL.
- Nie wymagaj 6 źródeł; wymagaj minimum 4 wykorzystanych.
- Nie owijaj `table`, `div`, `figure`, list ani `aside` w `<p>`.
- Normalizacja anchorów musi obsługiwać polskie `ł`.
- Przy `UPDATE` pomijaj własny slug w analizie kanibalizacji.
- `quick_answer` akceptuje 1–3 konkretne zdania oraz liczby dziesiętne.
- Nie zgaduj kategorii po usunięciu JSON-u; ustal ją jednoznacznie z prawdziwego listingu.
- Odrzucaj obrazy z mylącymi liczbami lub niepowiązanym tekstem.
- Nie dziel przypadkowo listy źródeł i disclaimera w PDF; obejrzyj każdą stronę po zmianie.
- Nie usuwaj linków ani `<strong>/<em>` z pierwszego akapitu pod H2 podczas normalizacji.
- Nie licz limitu `seo_title` bez dopisku marki: baza ma maksymalnie 55 znaków, finalny `<title>` maksymalnie 65.

## Szybkie rozpoczęcie nowej sesji

Napisz:

> Stosuj instrukcje z `SESSION_START_MAX.md` i zacznij od startu technicznego.
