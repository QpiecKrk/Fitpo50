# SESSION START MAX — FitPo50

Ten plik jest krótkim kontraktem rozpoczęcia nowej sesji. Szczegóły znajdują się w `PROJECT_MEMORY.md`, `ARTICLE_STANDARD.md` i `docs/command-registry.md`.

## Instrukcja dla agenta

Pracujemy domyślnie po polsku. Zakładaj, że użytkownik nie zna technicznych szczegółów: podawaj wynik prostym językiem, a przy ręcznych działaniach gotowe komendy.

### 1. Start techniczny — zawsze jako pierwszy krok nowej sesji

```bash
cd /Users/grzegorzkupiec/Projects/FitPo50-local
git pull --ff-only origin main
git restore .agent .agents .brainsync .cursor .windsurfrules 2>/dev/null || true
git status --short
npm run assets:mirror:sync
npm run predeploy:check
```

- Najpierw pokaż wynik startu, potem przejdź do pracy.
- Nie generuj raportu startowego i nie kopiuj nic do `~/Downloads`.
- Jeżeli krok inny niż dopuszczony restore zwróci błąd lub niejednoznaczny wynik, zatrzymaj się i pokaż komunikat.
- Konflikt `untracked files would be overwritten` rozwiązuj przez bezpieczny backup wyłącznie wskazanych plików do katalogu utworzonego przez `mktemp -d`; nigdy nie używaj `git clean`.

### 2. Obowiązkowa lektura

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
- JSON z zewnątrz jest draftem. Sprawdź logikę akapit po akapicie, dowody, FAQ, intencję, linki i prawdziwe obrazy.
- Każda liczba, próg, cena, ryzyko, mechanizm lub teza medyczna wymaga konkretnego źródła i mapowania claimu.
- FAQ pochodzi wyłącznie z GSC/PAA/autocomplete/udokumentowanego researchu; nigdy nie jest automatycznie wymyślane.
- Minimum 4 źródła oznacza 4 realne i wykorzystane źródła, nie dekoracyjną bibliografię.
- Tabele są semantycznym HTML, nigdy obrazem ani tekstem rozdzielonym kreskami.
- Nie publikuj bez PDF, kontroli desktop/mobile, obejrzenia wszystkich stron PDF oraz zgodności source/`_site`.
- Nie commituj roboczego JSON-u po zakończonej publikacji.
- Nie wykonuj commit/push, usuwania lub wdrożenia bez odpowiedniego polecenia użytkownika.

### 4. Znaczenie głównych poleceń

#### `dodaj artykuł`

To jedno polecenie użytkownika uruchamia kanoniczne `article:add`. Użytkownik przekazuje JSON i obrazy; nie musi pamiętać komend pośrednich. Wewnątrz pozostają dwie bezpiecznie rozdzielone fazy:

1. Szybkie `popraw-json`: `DRAFT` → `CONTENT_READY`, bez tworzenia HTML. Najpierw logika, źródła, intencja i preflight samej treści; potem kontrola podpisów/obrazów i brakujące warianty mediów; na końcu ponowne domknięcie dowodów dla podpisów oraz bramka kompletnego JSON-u.
   Draft dla Claude można tworzyć skillem `docs/skills/fitpo50-article-draft/`; jego walidacja potwierdza tylko strukturę `DRAFT`. FAQ bez rzeczywistego sygnału pozostaje luką do udokumentowanego researchu lokalnego, nigdy automatycznym dopiskiem.
2. Lokalna intencja, kanibalizacja, minimum 4 prawdziwe linki i propozycja centrum.
3. Rzeczywista kontrola obrazów oraz manifest AVIF/WebP/JPG.
4. Transakcyjny staging HTML i PDF.
5. Render desktop/mobile oraz wszystkich stron PDF.
6. Atomowa publikacja `CREATE` lub jawne `UPDATE --force true`.
7. Listingi, sitemap, indeksy, `llms.txt`, `_site`, historia i kolejka GSC.
8. Wszystkie walidatory z `ARTICLE_STANDARD.md`.

Techniczna komenda kanoniczna: `npm run article:add -- --file "<draft.fitpo50.json>"`. `article:prepare-json` służy tylko wtedy, gdy użytkownik jawnie chce dostać poprawiony JSON bez publikacji; `article:publish` jest komendą wznowienia dla istniejącego `CONTENT_READY`, nie dodatkowym krokiem do zapamiętania.

Pipeline działa fail-fast. Po błędzie nie uruchamia zależnych etapów ani nie zostawia półgotowej publikacji. Poprawne sprawdzenia URL-i są pamiętane lokalnie przez 7 dni, warianty niezmienionych obrazów są ponownie używane, a kolejne podejście zapisuje ten sam roboczy pakiet zamiast tworzyć serie `-r2`, `-r3`. Jeśli atom zawiedzie, identyczny hashami pakiet `CONTENT_READY` jest przy kolejnej próbie używany bez ponownego przygotowania. Zmiana JSON-u albo obrazu unieważnia pamięć pakietu; tanie bramki treści zawsze wykonują się podczas nowego przygotowania.

Starszy JSON Claude jest migrowany wyłącznie z jawnych danych źródłowych i `evidence_source_ids`; pipeline nie wymyśla dowodów. Po rzeczywistym obejrzeniu zatwierdzonych obrazów ich wymiary są źródłem prawdy: panoramy, kwadraty i pionowe plansze zachowujemy bez sztucznego kadrowania. Importer domyka semantykę i mobilny kontener tabel przed podglądem 390 px.

Importer zachowuje linki i semantyczne formatowanie inline w pierwszym akapicie pod każdym H2. Nie wolno po cichu zamieniać go na czysty tekst ani przycinać; limit 30–70 słów egzekwuje bramka, licząc wyłącznie widoczny tekst bez tagów i atrybutów. `seo_title` ma maksymalnie 55 znaków, ponieważ finalny limit 65 obejmuje także stały dopisek ` | FitPo50`.

Każdy nowy błąd wykryty podczas `dodaj artykuł` albo `Obal mit` napraw dwupoziomowo: najpierw w bieżącym artykule, następnie u źródła w pipeline. Gdy błąd można wykryć automatycznie, dodaj test regresji lub błędny fixture. Nie kończ na ręcznej korekcie jednego pliku i nie osłabiaj bramki, aby przepuścić artykuł.

#### `GSC`

- Tryb wyłącznie analityczny.
- Uruchom `npm run gsc:auto`; dane robocze mają pozostać poza repo w `~/Downloads/gsc-auto-input`.
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
- Zakończ na `AWAITING_USER_APPROVAL`; nie edytuj bez zatwierdzenia konkretnych ID.
- Po zatwierdzeniu ID użytkownik nie podaje kolejnych komend technicznych. Agent tworzy konkretny manifest `replace_exact`, uruchamia atomowy `popraw-seo:apply`, sprawdza HTML/PDF/mobile/desktop/_site/sitemap, wykonuje commit/push, monitoruje workflow live i podaje listę GSC. Każdy brak lub błąd zgłasza jawnie jako bloker.
- Lista GSC powstaje wyłącznie po `LIVE_DEPLOYED_AND_VALIDATED`; lokalny komplet ani sam `git push` nie są dowodem wdrożenia produkcyjnego.
- Po zatwierdzeniu wykonaj pełną naprawę strony, nie tylko jedną zmianę SEO.

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
npm run fitpo50:doctor
./scripts/export_site.sh
npm run assets:mirror:sync
npm run predeploy:check
git diff --check
git add -A
git commit -m "<konkretny opis>"
git push origin main
```

- Status RED zatrzymuje push. Przy YELLOW przeczytaj i oceń ostrzeżenia.
- Nienaturalnie duży, niezatwierdzony zakres wymaga potwierdzenia. `git push wszystko` zatwierdza cały wcześniej omówiony zakres.
- Jeśli świadomie zatwierdzony zakres przekracza diff guard, wolno jednorazowo użyć `FITPO50_BYPASS_DIFF_GUARD=1`; pozostałe testy nadal muszą przejść.
- Po pushu zawsze podaj krok serwerowy:

```bash
cd <repo-na-serwerze>
npm run hostinger:clean-repo
```

Następnie użytkownik może uruchomić standardowy deployment.

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
