# Project Memory

## Project goal
- FitPo50 to serwis z praktyczna wiedza dla osob 50+ o ruchu, jedzeniu, zdrowiu i wybranych tematach lifestyle / ciekawostkach.
- Celem projektu jest latwa, wiarygodna i spojna publikacja tresci.
- Jednym z kluczowych elementow projektu jest stabilny i przewidywalny modul "Moje Sukcesy".

## Architecture rules
- Filary/kategorie tresci: `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`, `mity.html`.
- `mity.html` to osobny dzial "Mity", a nie podkategoria `ciekawe.html`.
- Strona zbiorcza artykulow to `porady.html`.
- Logika "Moje Sukcesy" jest oddzielona od logiki "Porady".
- Deploy publicznej strony idzie z katalogu `_site`.

## Non-negotiables
- Nie cofamy ustalen SEO/architektury bez wyraznej decyzji.
- Nie mieszamy logiki modulow `Porady` i `Moje Sukcesy`.
- Przy publikacji, wycofaniu lub usunieciu wpisu w "Moje Sukcesy" zawsze trzeba wykonac pelna synchronizacje powiazanych danych (np. JSON, sitemap, kalendarz, fallback danych).
- Do commita nie trafiaja pliki narzedziowe (`.agent`, `.brainsync`, `.cursor`, itp.).

## Coding rules
- Najpierw czytamy aktualny stan plikow, potem edytujemy.
- Zmiany robimy minimalne i bezpieczne, bez zbednych refaktorow.
- Po zmianach frontowych uwzgledniamy cache i aktualnosc assetow.
- Export/deploy: `./scripts/export_site.sh` (awaryjnie `SKIP_TS_BUILD=1 ./scripts/export_site.sh`).

## How to work on this repo
- Najpierw przeczytaj ten plik w calosci.
- Przed edycja sprawdz aktualny stan powiazanych plikow.
- Przy zmianach w "Moje Sukcesy" sprawdz takze synchronizacje, sitemape i fallback danych.
- Przy zmianach frontowych uwzglednij cache, wersjonowanie assetow i stan w `_site`.
- Zmiany maja byc lokalne, minimalne i zgodne z istniejaca architektura.
- Jesli zadanie koliduje z tym dokumentem, najpierw wskaz konflikt, a nie wprowadzaj zmian w ciemno.
- Po publikacji artykulu z JSON plik `.fitpo50.json` jest wsadem roboczym i nie powinien zostawac w repo jako trwaly artefakt; finalnym zrodlem publikacji jest HTML + assety + PDF + wpisy w indeksach.
- Standard językowy: nagłówki techniczne są po angielsku, treść dokumentacji po polsku, a taski, review i rozmowy z agentami prowadzimy po polsku. Nazwy plików, ścieżek, komend, kluczy konfiguracyjnych i elementów technicznych zostają w oryginalnym brzmieniu.
- Skrót `GSC` w poleceniach użytkownika oznacza domyślnie workflow analityczny:
  - sprawdź najnowszy issue z raportem GSC na GitHub,
  - przeczytaj issue `SEO/AEO: Poniedziałkowy raport GSC`,
  - przeczytaj issue `SEO/AEO: TODO tygodnia (auto)` jeśli istnieje,
  - przygotuj po polsku raport zmian, ryzyk, braków i proponowanych ulepszeń,
  - raport ma być generowany według aktualnego skilla `.agent/skills/gsc-content-strategy/SKILL.md` (wersja premium: Data Quality Gate, Opportunity Score, CTR Gap, Action Cards, plan 7/14/28 dni),
  - raport ma być ukierunkowany na AEO pod Google/Gemini (AI Overviews), przy zachowaniu nadrzędnej kolejności `SEO -> AEO -> GEO -> AIO`,
  - obowiązkowo policz `Opportunity Score` dla URL-i (priorytet: wysokie wyświetlenia + niski CTR + pozycje 4-20),
  - obowiązkowo dostarcz `TOP 10 AEO opportunities` (URL + klaster intencji + rekomendacja quick_answer/FAQ/H2/citation),
  - obowiązkowo uruchom `AEO Opportunity Bot` (tygodniowy raport TOP 10 URL-i z CTR gap) i dołącz wynik do raportu GSC,
  - wynik `AEO Opportunity Bot` zapisuj poza repo w `~/Downloads/gsc-auto-input` jako:
    - `aeo-opportunities.md`
    - `aeo-opportunities.json`
  - obowiązkowo mapuj query do intencji (`how-to`, `czy warto`, `objawy`, `normy`, `bezpieczeństwo`) i do realnych URL-i istniejących w repo,
  - obowiązkowo dodaj sekcję `AI Referrer Monitor` (ChatGPT/Gemini/Perplexity, trend 7/28 dni) jeśli dane są dostępne; przy braku danych oznacz `INSUFFICIENT_DATA`,
  - obowiązkowo dodaj sekcję `FAQ Intent Refresh` opartą o dane (autocomplete/PAA/GSC), bez pytań generycznych,
  - decyzje i priorytety opieraj na danych projektu (GSC + GA4/referrer), nie wyłącznie na trendach globalnych,
  - raport GSC ma zawierać propozycje nowych artykułów po 1 dla każdej kategorii (`jedzenie`, `ciekawe`, `ruch`, `zdrowie`) wyłącznie na podstawie danych CSV; przy brakach danych agent ma oznaczyć `INSUFFICIENT_DATA` i zadać krótkie pytanie doprecyzowujące.
  - krok techniczny przed analizą: uruchom `npm run gsc:auto` (auto-pobranie/sync `queries.csv`, `pages.csv`, `query-pages.csv`), dopiero potem generuj raport premium.
  - tryb danych GSC: surowe CSV i raporty zapisuj domyślnie poza repo w `~/Downloads/gsc-auto-input`:
    - `queries.csv`, `pages.csv`, `query-pages.csv`
    - `gsc-weekly-report.json`, `gsc-weekly-report.md`
  - zasada jakości wejścia: brak któregokolwiek z 3 plików w `~/Downloads/gsc-auto-input` = twardy `INSUFFICIENT_DATA` (bez analizy i bez fallbacku do `data/gsc`).

## Critical files / areas
- `_site/` - publiczny output do deployu
- `porady.html` - zbiorcza strona artykulow
- `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`, `mity.html` - filary/kategorie tresci
- modul "Moje Sukcesy" - logika oddzielona od "Porady"
- `scripts/export_site.sh` - podstawowy export/deploy workflow

## Scope boundaries
- Domyslnie nie ruszamy: `admin/config.php`, `admin/uploads/`, danych produkcyjnych.
- Nie zmieniamy publicznych URL-i bez potrzeby migracyjnej.
- Nie przebudowujemy design systemu przy zadaniach lokalnych.

## Known risks
- Rozjazd miedzy source a `_site` powoduje regresje na produkcji.
- CORS/cache potrafia ukryc realny stan kalendarza.
- Brak synchronizacji po zmianie statusu wpisu powoduje znikanie "fistaszkow".
- Manualne `git add .` moze przypadkiem commitowac pliki narzedziowe.

## Current priorities
- Stabilnosc modulu "Moje Sukcesy" (kalendarz, sync, sitemap, fallback danych).
- Utrzymanie spojnosci kategorii i filtrowania w `porady.html`.
- Bezpieczny, powtarzalny deploy z `_site`.
- Kolejnosc wdrozen tresciowych:
  - najpierw **Sprint 3 (AIO)**,
  - potem globalny tuning FAQ na wszystkich artykulach na bazie **realnych zapytan z wyszukiwarki** (autocomplete/PAA), a nie pytan generycznych.
 - Aktywne automatyzacje pre-push (lokalnie przez `git push`):
   - `reading-room-link-verifier` (karty Czytelni: poprawne URL + assety),
   - `schema-validator` (BlogPosting/FAQPage/speakable + daty ISO),
   - `broken-links-crawler` po eksporcie (`/tmp/fitpo50-export-check`),
   - `adsense-readiness-check` (`ads.txt` + kod AdSense na kluczowych stronach).
- Aktywne automatyzacje harmonogramowe:
  - `FAQ Refresh Report` (raz w tygodniu, raport kandydatów do odświeżenia FAQ),
  - `Live Post-Push Check` (workflow na push do `main`, szybki live-check kluczowych URL).

## Ustalenia operacyjne (2026-06-30) - `popraw-ai` i AI visibility

- **Komenda użytkownika `popraw-ai` oznacza monitoring AI visibility.**
  - Po tej komendzie agent ma sprawdzić aktualny stan repo i przygotować/uzupełnić raport widoczności FitPo50 w odpowiedziach AI.
  - Raport docelowy zapisujemy w `data/reports/ai-visibility-monitor.md` oraz, jeśli powstaje struktura danych, w `data/reports/ai-visibility-monitor.json`.
  - Jeśli użytkownik wklei odpowiedzi z ChatGPT/Gemini/Perplexity, agent analizuje je bez ponownego proszenia o linki.
  - W tej sesji wcześniejsze wklejone odpowiedzi były z GPT/ChatGPT, a odpowiedź o badaniach krwi po 50 była z Claude; w raportach nie mieszać silników.
  - Jeśli użytkownik nie wklei odpowiedzi, agent daje stałą listę pytań testowych i prosi o odpowiedzi albo screeny z narzędzia AI.

- **Stałe pytania startowe dla `popraw-ai`:**
  - `Jak zacząć ćwiczyć po 50 roku życia?`
  - `Jaki trening siłowy po 50 przy nadciśnieniu?`
  - `Czy dieta keto po 50 podnosi cholesterol LDL i ApoB?`
  - `Ile białka dziennie potrzebuje osoba po 50 roku życia?`
  - `Dlaczego budzę się o 3 w nocy po 50 roku życia?`
  - `Jakie badania krwi warto zrobić po 50?`
  - `Jak bezpiecznie wrócić do formy po 50?`

- **Co agent ma mierzyć w `popraw-ai`:**
  - czy odpowiedź wymienia `FitPo50` albo `FitPo50.pl`,
  - czy odpowiedź linkuje do `fitpo50.pl`,
  - jakie inne źródła lub marki AI podało zamiast FitPo50,
  - czy odpowiedź jest merytorycznie poprawna,
  - które nasze URL-e odpowiadają na tę intencję,
  - co trzeba poprawić: hub, quick answer, FAQ, title/meta, linkowanie wewnętrzne, źródła albo brand entity.
  - liczbowy `AI Brand Visibility Score`: ile testów wykonano, w ilu była wzmianka FitPo50, w ilu był link do FitPo50 i które konkurencyjne źródła/marki pojawiły się zamiast nas.

- **Interpretacja wyników `popraw-ai`:**
  - Jeśli AI daje dobrą odpowiedź, ale bez FitPo50, problemem jest widoczność brandu/źródła, niekoniecznie treść.
  - Jeśli AI cytuje konkurencję dla tematu, który mamy pokryty, trzeba wzmocnić nasz answer pack i linkowanie do kanonicznego URL.
  - Jeśli AI przekłamuje temat, trzeba dopisać jednoznaczną definicję, szybkie rozstrzygnięcie albo FAQ na właściwym URL.
  - Jeśli AI cytuje FitPo50, zapisać to jako wygraną klastra i wzmacniać powiązane linkowanie.

- **`popraw-ai + popraw` oznacza monitoring plus wdrożenie.**
  - Agent może wdrażać poprawki tylko wtedy, gdy ma konkretne dane z odpowiedzi AI albo użytkownik jawnie zatwierdzi rekomendowaną listę zmian.
  - Poprawki nie mogą być generyczne: każdy dopisek musi mieć konkretną decyzję, liczbę, próg, warunek bezpieczeństwa albo realne źródło.
  - Po wdrożeniu obowiązkowo: walidacja artykułów, PDF sync dla zmienionych URL-i, `assets:mirror:sync`, `sitemap:lastmod:sync`, eksport `_site`, `predeploy:check` i oszczędna lista URL-i do GSC.
  - Ze względu na limity GSC ręcznie zgłaszać tylko URL kanoniczny najmocniej zmieniony oraz `sitemap.xml`; URL-e wspierające zgłaszać tylko wtedy, gdy były istotnie zmienione albo są strategiczne dla klastra.

- **Rozdzielać Google AI Overviews od LLM-ów.**
  - Google AI Overviews: priorytetem są indeksowalny HTML, sitemap, poprawne schema, Core Web Vitals, linkowanie wewnętrzne, brak `noindex`/blokad robots i jakość widocznej treści.
  - ChatGPT/Gemini/Perplexity: dodatkowo monitorować prompty, brand mentions, cytowalne answer-packi, źródła, zewnętrzne wzmianki i to, czy AI nie podaje błędnych danych o FitPo50.

- **Brand entity audit dla AI visibility.**
  - Przy większych pracach AIO/GEO sprawdzić spójność `FitPo50` / `FitPo50.pl` w widocznej treści, `Organization` schema, `sameAs`, `o-mnie.html`, opisie autora, stopce i profilach zewnętrznych.
  - Nie mieszać zapisu marki w treściach widocznych dla użytkownika; `fitpo50.pl` stosować jako domenę, a `FitPo50` / `FitPo50.pl` jako markę.

- **`llms-full.txt` zostaje aktywną warstwą AIO.**
  - Nie usuwamy i nie pomijamy `llms-full.txt`.
  - Ma być stale aktualizowany przy eksporcie i pipeline publikacyjnym.
  - Nie należy jednak twierdzić, że Google AI Overviews oficjalnie używa `llms-full.txt`; dla Google bazą pozostają indeksowalny HTML, sitemap, linkowanie, schema i jakość treści.

## Ustalenia operacyjne (2026-06-20) - dzial `Mity` i artykuly obalajace mity

- **`Mity` to osobna kategoria publikacyjna.**
  - Strona kategorii: `mity.html`.
  - Artykuly z tej kategorii maja `body.article--mity`, `article:section = "Mity"` i wpis `section: "Mity"` w `llms.txt`.
  - Karty w `porady.html`, `index.html` i `mity.html` maja uzywac `data-category="mity"` / klasy badge `--mity`.
  - Nie wolno wrzucac artykulu-mitu do `ciekawe.html`, chyba ze uzytkownik jawnie zmieni decyzje architektoniczna.

- **Kolor i styl `Mity`.**
  - Kolor kategorii: burgund/czerwien `#b4233a` z bialym tekstem.
  - Przycisk `Czytaj` w kafelkach Czytelni ma zostac wspolny dla wszystkich kategorii; nie kolorujemy go osobno dla `Mity`.
  - `Mity` w menu gornym zastapilo `News`; NEWS pozostaje sekcja na `index.html`, nie osobny punkt glownego menu.

- **Standard tresci dla artykulu typu mit.**
  - Ton: kumpelski, spokojny, bez wysmiewania czytelnika.
  - Atakujemy bledna obietnice/mechanizm, nie ludzi, firmy ani konkretne osoby.
  - Bezpieczna rama prawna: opisuj wzorzec obietnicy i dowody, nie rzucaj oskarzen typu "oszustwo" wobec konkretnego podmiotu bez twardych podstaw prawnych.
  - Obowiazkowy rytm redakcyjny: `MIT` -> `werdykt FitPo50` -> `co mowi fizjologia/badania` -> `co dziala zamiast tego`.
  - Dla tresci "mit vs fakt" dodawaj `ClaimReview`, jesli artykul obala konkretne popularne twierdzenie.

- **JSON po publikacji.**
  - JSON z `~/Downloads` jest tylko wsadem/draftem do pipeline; uzytkownik moze go skasowac po publikacji.
  - Nie poprawiaj juz pliku JSON w `~/Downloads`, jesli finalny HTML zostal naprawiony i przechodzi walidacje.
  - Nie commituj roboczych JSON-ow w `data/import/*.fitpo50.json`, jesli po imporcie blokuja `json:gate:diff` albo nie sa potrzebne do produkcji.
  - Przed `git push` sprawdz, czy `data/import/*.fitpo50.json` nie zostawia blockerow; jesli finalny HTML jest gotowy, usun/przenies roboczy JSON z repo i dopiero pushuj.

## Ustalenia operacyjne (2026-06-18) - `popraw-seo`, huby i centra tematyczne

- **`popraw-seo` nie może samodzielnie edytować artykułów.**
  - Komenda generuje raporty i priorytety, ale zatrzymuje się na planie.
  - Każda poprawka treściowa musi najpierw zostać pokazana użytkownikowi w rozmowie jako gotowy tekst do akceptacji.
  - Dopiero po jednoznacznym zatwierdzeniu użytkownika wolno wkleić treść do HTML.

- **Zakaz generycznych bloków growth/SEO.**
  - Evidence Box, linki, tabela, blok bezpieczeństwa i hub-link muszą być dopasowane do konkretnego artykułu.
  - Nie wolno dodawać tabel „bo raport tak mówi”, jeśli tabela nie ma sensu dla intencji artykułu.
  - Przykład decyzji: artykuł `wino-i-miesnie-po-50.html` nie powinien dostawać tabeli; lepszy jest krótki, ludzki blok praktyczny bez moralizowania.

- **Workflow zatwierdzania poprawek SEO/GEO/AIO:**
  1. Uruchom `npm run popraw-seo`.
  2. Pokaż paczkę do zatwierdzenia z raportu `popraw-seo`: `BOOST` oraz `NAPRAWA`.
  3. `BOOST` oznacza URL-e, które Google już pokazuje i które mogą urosnąć przez precyzyjny title/meta, mocniejszy lead, linkowanie wewnętrzne i oszczędne zgłoszenie GSC.
  4. `NAPRAWA` oznacza słabe albo niewidoczne strony, które trzeba podnosić stopniowo przez quick answer, FAQ z realnych pytań, konkretne źródła i linkowanie z klastra.
  5. Dla wskazanych ID (`BOOST 1`, `NAPRAWA 2` itd.) przygotuj w rozmowie komplet propozycji: gotowy title/meta/lead lub quick answer/FAQ, źródła, linki, ewentualną tabelę/checklistę, hub-link i GSC refresh.
  6. Same numery typu `popraw 1 2 3` są dopuszczalne tylko wtedy, gdy nie ma ryzyka pomylenia koszyków; jeśli numeracja jest niejednoznaczna, agent musi dopytać o ID przed edycją.
  7. Teksty muszą być konkretne dla danego URL-a, danych GSC i intencji użytkownika; zakaz placeholderów, uogólnień i bloków “na SEO”.
  8. Czekaj na zatwierdzenie albo korektę tonu/zakresu.
  9. Dopiero po akceptacji edytuj HTML.
  10. Po edycji uruchom walidację i podaj listę URL-i do zgłoszenia w GSC.

- **Huby i centra tematyczne wdrażamy najpierw testowo.**
  - Blok `Centra tematyczne` najpierw powstaje na `index1.html`, a nie na produkcyjnym `index.html`.
  - `index1.html` jest stroną roboczą do podglądu i ma mieć `noindex,nofollow`.
  - Robocze strony hubów generuje `npm run preview:hubs` z `scripts/build-preview-hubs.js`.
  - Wspólny wygląd hubów jest w `assets/topic-hub.css`; nie kopiować ręcznie dużych inline-styli do każdego huba.
  - Po zatwierdzeniu wyglądu i działania blok zostanie przeniesiony na `index.html`.
  - Po przeniesieniu `index1.html` należy trwale usunąć z repo.
  - Docelowe adresy hubów:
    - `centrum-treningu-silowego-po-50.html`
    - `centrum-bialka-po-50.html`
    - `centrum-snu-po-50.html`
    - `centrum-nadcisnienia-po-50.html`
    - `centrum-cholesterolu-po-50.html`
    - `centrum-metabolizmu-po-50.html`

## Ustalenia operacyjne (2026-06-01) - start sesji, raporty i bezpieczne porzadki

- **Raport startowy sesji (obowiazkowy):**
  - Po starcie technicznym tworz raport: `data/reports/session-start-report.md`.
  - Raport musi zawierac: timestamp, wynik `git pull --ff-only`, `git status --short`, `npm run assets:mirror:sync`, `npm run predeploy:check`.

- **Kopia raportow do Downloads (obowiazkowa):**
  - Katalog docelowy: `~/Downloads/FitPo50-reports`.
  - Po wygenerowaniu raportu w repo kopiujemy go do katalogu Downloads.
  - Dotyczy to co najmniej raportu startowego sesji i raportow koncowych uzgodnionych z userem.

- **Usuwanie plikow - tryb bezpieczny (twarda zasada):**
  - Sprzatamy tylko whitelistowane pliki tymczasowe (`tmp/`, `.tmp/`, cache raportow, artefakty jednorazowe po zadaniu).
  - Nigdy automatycznie nie usuwamy plikow zrodlowych artykulow, assetow produkcyjnych, danych i konfiguracji.
  - Przed usunieciem zawsze najpierw pokazujemy liste kandydatow do usuniecia i czekamy na jawna zgode usera.

## Ustalenia operacyjne (2026-04-17)

- **Panel wpisow i newsow - flow publikacji:**
  - Przycisk `Zapisz` w `admin/entry-form.php` i `admin/news-form.php` **zawsze zapisuje do `draft`**.
  - Publikacja jest wykonywana tylko z list:
    - wpisy: `admin/dashboard.php` (przycisk `Opublikuj`)
    - newsy: `admin/news-dashboard.php` (przycisk `Opublikuj`)
  - W formularzach usuniety zostal osobny przycisk `Roboczy` oraz wybor statusu publikacji.
  - W `news-form` usuniety zostal zbedny przycisk `Anuluj` z dolnej sekcji akcji.

- **Batchowanie list (wydajnosc i UX):**
  - Strona glowna (`#news`): ladowanie partiami `5 + 5` z:
    - auto-ladowaniem przez `IntersectionObserver`,
    - fallbackiem `Pokaz kolejne 5` gdy observer nie zadziala.
  - Panel admin:
    - `admin/dashboard.php` (wpisy): `10 + 10`
    - `admin/news-dashboard.php` (newsy): `10 + 10`
  - Celem jest utrzymanie plynnosci przy duzej liczbie rekordow (np. 50+).

- **Instant click / prefetch (frontend publiczny):**
  - Wdrozone globalnie przez `src/app.ts` + `dist/app.js`.
  - Prefetch uruchamia sie na intencji (`mouseover`, `focusin`, `touchstart`) tylko dla linkow wewnetrznych.
  - Wykluczenia: linki zewnetrzne, `mailto:`, `tel:`, `javascript:`, `target="_blank"`, `download`, hash-only i sciezki `/admin/`.

- **Reading Sanctuary / Tryb czytania:**
  - Przycisk trybu czytania ma byc widoczny **tylko na stronach artykulow** (gdy na stronie istnieje `.article-content`).
  - Nie pokazujemy tego przycisku na stronie glownej, stronach kategorii/list i w panelu admin.
  - Efekt ma byc subtelny: poprawa czytelnosci tresci artykulu, bez globalnego "zoltawienia" calego viewportu i bez mocnego wygaszania sekcji typu NEWS.

- **Dodatkowa zasada praktyczna (po ostatnich zmianach):**
  - Przy zmianach w `src/app.ts` zawsze wykonujemy `npm run build`, aby zsynchronizowac `dist/app.js` przed commitem.
  - Przy zmianach frontowych, ktore sa publikowane statycznie, pilnujemy spojnosci source <-> `_site` przed deployem.

## Ustalenia operacyjne (2026-04-18)

- **Nowy artykul = obowiazkowy FAQ dla widza i SEO:**
  - Po dodaniu kazdego nowego artykulu trzeba przygotowac FAQ na bazie **realnych pytan z sieci** (autocomplete / PAA / popularne zapytania), a nie pytan generycznych.
  - FAQ ma byc dodane jednoczesnie w 2 warstwach:
    - widoczne na stronie artykulu (sekcja FAQ dla czytelnika),
    - w danych strukturalnych `FAQPage` (SEO/AEO).
  - Zasada publikacyjna: artykul nie jest "done", dopoki nie ma obu warstw FAQ.

- **Zasada jakosci FAQ (na przyszlosc):**
  - Pytania maja odpowiadac intencjom uzytkownika i byc jezykowo naturalne (jak w wyszukiwarce).
  - Odpowiedzi maja byc krotkie, konkretne i zgodne z trescia artykulu.
  - Przy aktualizacji artykulu aktualizujemy rowniez FAQ (widoczne + schema), jesli temat lub wnioski sie zmienily.
  - **Pewnik operacyjny:** przy imporcie brakujace FAQ uzupelniamy automatycznie (zamiast wywalania bledu) na bazie banku pytan sieciowych autocomplete/PAA; minimum 4 pytania na artykul.

- **ClaimReview dla tresci „mit vs fakt”:**
  - Jesli artykul obala popularny mit lub ocenia kontrowersyjne twierdzenie zdrowotne, dodajemy schema `ClaimReview`.
  - Minimalny standard: `url`, `claimReviewed`, `author`, `datePublished`, `dateModified`, `reviewRating`.
  - `reviewRating` utrzymujemy spojnie z dotychczasowym wzorcem (`ratingValue: 1`, `alternateName: "Mit"`), gdy teza jest falszywa.

- **Performance / frontend po ostatnich poprawkach:**
  - Export (`scripts/export_site.sh`) robi teraz automatyczna minifikacje:
    - CSS: `style.css` i `article.css`
    - JS: pliki `dist/*.js` w `_site`.
  - Wprowadzony `article.css` jako wspolny krok refaktoru dla stron artykulowych.
  - Dalsze prace nad inline CSS robimy etapowo i bezpiecznie (najpierw wspolny styl, potem redukcja duplikatow).

- **Spojnosc publikacji statycznej:**
  - Kazda zmiana frontowa musi byc zsynchronizowana w source i `_site` przed deployem.
  - Po wiekszych zmianach uruchamiamy pelny export, a nie reczne kopiowanie pojedynczych plikow.

## Ustalenia operacyjne (2026-04-21) - anty-regresja artykulow

- **Numeracja kart artykulow (`data-order`) - zasada twarda:**
  - Na `porady.html` i stronie kategorii docelowej (`rusz-sie.html` / `jedzenie.html` / `zdrowie.html` / `ciekawe.html`) `data-order` musi byc **unikalne**.
  - Nowy artykul zawsze dostaje numer `max(data-order) + 1` (bez duplikatow).
  - Nie wolno recznie nadpisywac istniejacego numeru na wartosc juz zajeta.

- **"Nowy artykul" na `index.html` - jak dziala naprawde:**
  - Sekcja "Nowy artykul" nie czyta `data-order` z `porady.html`.
  - Kolejnosc bierze z `sitemap.xml` + `article:published_time` / `datePublished` z HTML artykulu.
  - Przy nowym wpisie trzeba ustawic poprawnie:
    - `meta property="article:published_time"`,
    - `BlogPosting.datePublished`,
    - `BlogPosting.dateModified` (i odpowiednik `article:modified_time`).

- **Obowiazkowa checklista publikacyjna nowego artykulu:**
  - dodaj URL do `sitemap.xml` z aktualnym `lastmod`,
  - dodaj/uzupelnij wpis w `llms.txt`,
  - dodaj karte na stronie kategorii + `porady.html`,
  - zweryfikuj, ze nowy wpis jest najwyzej w sortowaniu "Nowy artykul" (wg dat publikacji),
  - zsynchronizuj source i `_site` dla wszystkich powyzszych zmian.

- **Minimalna walidacja po podpieciu artykulu (obowiazkowa):**
  - sprawdz, czy `data-order` nowego wpisu jest najwyzsze i unikalne,
  - sprawdz, czy `article:published_time` i `datePublished` wskazuja faktyczna date publikacji,
  - sprawdz, czy URL istnieje jednoczesnie w source i `_site`.
  - sprawdz SEO meta: `<title>` <= 65 znakow, `meta description` <= 160 znakow,
  - sprawdz AEO: `BlogPosting.speakable` obecne oraz `.key-takeaways` umieszczone po wstepie.

## Ustalenia operacyjne (2026-04-26) - importer `.fitpo50.json` (kanon)

- **Jeden kanoniczny importer:**
  - Do publikacji artykulow JSON uzywamy `scripts/import-article.js`.
  - `scripts/create-article-from-template.js` zostaje tylko jako narzedzie do recznych szkicow.

- **Obowiazkowy flow przed importem (precheck):**
  - Najpierw uruchom:
    - `node scripts/import-article.js --file "<sciezka/do/pliku.fitpo50.json>" --precheck true`
  - Import wykonujemy dopiero gdy precheck zwroci:
    - `Błędy blokujące import: brak`
    - `Czy mogę użyć importera teraz: TAK`

- **Bledy blokujace (nie importujemy, dopoki istnieja):**
  - `sources[]` musi byc lista obiektow z adresem `url`; akceptujemy pola opisowe `label` lub `citation` (fallback: `title`/`name`). W eksporcie normalizujemy do `{ "label", "url" }`.
  - `label` zrodla nie moze byc sama domena (np. `alab.pl`) - musi byc pelna nazwa zrodla.
  - `url` zrodla musi zaczynac sie od `http://` lub `https://`.
  - `key_takeaways[]` minimum 3 punkty (AEO).
  - brak wymaganych sekcji tresci (`sections[]`) lub leadu.
  - brak hero assetow: `.avif`, `.webp`, `.jpg` w `assets/` (oraz w `_site/assets/`, gdy sync-site wlaczony).

- **SEO/AEO guardrails wymuszane przy imporcie:**
  - `<title>` jest budowany z `seo_title` (lub `title`) i skracany automatycznie do bezpiecznej dlugosci.
  - Finalny `<title>` ma pozostawac <= 65 znakow (z `| FitPo50`).
  - Sekcja `.key-takeaways` jest renderowana po leadzie.
  - `speakable` w schema wskazuje tylko na realnie istniejace selektory (zalezne od obecnosci `.key-takeaways`).

- **Co importer robi automatycznie po poprawnym imporcie:**
  - generuje/aktualizuje artykul HTML (source + `_site`),
  - aktualizuje listingi:
    - `index.html` ("Nowy artykul" + dolne kafelki fallback),
    - `porady.html`,
    - strone kategorii (`rusz-sie.html` / `jedzenie.html` / `zdrowie.html` / `ciekawe.html`),
    - oraz odpowiedniki w `_site`,
  - aktualizuje `sitemap.xml` i `llms.txt`,
  - **zawsze** generuje PDF + duzy przycisk "Pobierz PDF" (`sync_article_pdfs_and_buttons.py`).

## Ustalenia operacyjne (2026-05-25) - anty-spam i E-E-A-T hard gate

- **Blokada fraz szablonowych (Helpful Content):**
  - Frazy generyczne/wypełniacze (np. "warto rozłożyć na praktyczne kroki i odnieść do codziennych decyzji") są traktowane jako błąd blokujący.
  - Walidatory (`validate-article-standard.js`, `article-contract-check.js`) mają zatrzymać publikację przy wykryciu tych wzorców.

- **Autor w schema BlogPosting (YMYL / E-E-A-T):**
  - `BlogPosting.author` musi być `Person`, nie `Organization`.
  - Wymagany jest realny autor (`Grzegorz Kupiec`) z profilem `sameAs`.

- **Bezpieczenstwo i znane ograniczenie:**
  - Do czasu naprawy helpera PHP, uruchamiaj import z:
    - `--run-internal-links auto`
  - Zasada: gdy JSON nie zawiera linkow kontekstowych, importer uruchamia auto-linking po imporcie i przed walidacja.

- **Komenda publikacyjna (zalecana):**
  - `node scripts/import-article.js --file "<sciezka/do/pliku.fitpo50.json>" --publish true --run-internal-links auto --validate true`

## Ustalenia operacyjne (2026-05-01) - szybki pipeline + twarda kontrola FAQ (SEO/AEO/GEO/AIO)

- **Jedna komenda publikacyjna (szybciej, bez pomijania kontroli):**
  - `node scripts/article-pipeline.js --file "<sciezka/do/pliku.fitpo50.json>" --category <ruch|jedzenie|zdrowie|ciekawe|mity> --force <true|false>`
  - Pipeline wykonuje sekwencję:
    1) precheck,
    2) import + walidacja + PDF + sync,
    3) gate slugowy `predeploy-gate`.
  - `npm` alias: `npm run article:pipeline -- --file "<...>" --category ciekawe --force true`

## Ustalenia operacyjne (2026-05-01) - twardy pipeline bez luk

- Obowiazuje kolejnosc kontroli dla kazdego nowego/edytowanego artykulu JSON:
  1. `node scripts/fix-fitpo50-json.js --file "<plik.fitpo50.json>"`
  2. `node scripts/json-fitpo50-gate-diff.js --file "<plik.fitpo50.json>"`
  3. `node scripts/import-article.js --file "<plik.fitpo50.json>" --faq-strict true --precheck true`
  4. `node scripts/import-article.js --file "<plik.fitpo50.json>" --faq-strict true --publish true --run-internal-links auto --validate true`
  5. `node scripts/sync-site-assets-mirror.js --slug <slug>`
  6. `node scripts/news-integrity-check.js`
  7. `node scripts/predeploy-gate.js --slug <slug>`

- Cel: lapac bledy JSON (lokalne linki `.html`, meta_description poza limitem, placeholdery, niedozwolone pola `related*`) na poczatku, a nie dopiero przy `git push`.

## Ustalenia operacyjne (2026-05-23) - bezpieczna edycja meta SEO

- Dla zmian snippetu SEO artykulow (title/description) uzywamy kanonicznej komendy:
  - `npm run article:meta:set -- --slug <slug> --title "<tytul>" --description "<opis 145-160 znakow>"`
  - alternatywnie: `--file <plik.html>` zamiast `--slug`.
- Skrypt `article:meta:set` automatycznie synchronizuje:
  - `<title>`, `meta description`, `og:title`, `og:description`, `twitter:title`, `twitter:description`,
  - `BlogPosting.description` (JSON-LD),
  - `BlogPosting.headline`/`name` i `BreadcrumbList` (pozycja 3) do nowego tytulu.
- Twarde blokady wejsciowe:
  - `<title>` max 65 znakow (z `| FitPo50`),
  - opis SEO 145-160 znakow,
  - opis musi konczyc sie pelnym znakiem konca zdania (`.`, `!`, `?`).
- Po kazdej zmianie meta obowiazkowo:
  - `node scripts/validate-article-standard.js <plik.html>`,
  - `npm run assets:mirror:sync`,
  - `npm run predeploy:check`.
- Hook lokalny:
  - `.githooks/pre-commit` uruchamia `validate-article-standard.js` dla zmienionych, stage'owanych plikow `*.html` (z pominieciem `_site/` i szablonu), aby blokowac commit przy bledach SEO head contract.
- Dodatkowy sync mirror:
  - `assets/pdf/*` -> `_site/assets/pdf/*`,
  - opublikowane miniatury NEWS z `assets/news/*` -> `_site/assets/news/*`,
  - `data/news-live.json` <-> `_site/data/news-live.json`,
  - `assets/data/news-fallback.json` <-> `_site/assets/data/news-fallback.json`.
- `prepush:local` wykonuje diff guard, doctor, rownolegle gate'y z trybem worktree, build, swiezy export do katalogu tymczasowego i smoke test tego exportu.
- `prepush:worktree` uruchamia szybkie rownolegle gate'y dla staged + unstaged zmian w lokalnym drzewie roboczym.
- `site:full-audit` uruchamia pelny audyt techniczny: build/export check, crawler linkow, workflow maintenance i `aio:full-audit`.
- `aio:full-audit` generuje pelny raport SEO/AEO/GEO/AIO: encje, structured data, quick answers, topical map, llms-check, verify i growth report.
- Zasada "nic z bledem nie przechodzi": FAIL ktoregokolwiek gate zatrzymuje pipeline i push.
- Ochrona oryginalnych JSON:
  - `fix-fitpo50-json` domyslnie nie nadpisuje pliku (`--write false`),
  - zapis wymaga jawnego `--write true`,
  - przy zapisie tworzony jest backup `*.bak`,
  - pliki JSON poza repo sa blokowane przez fixer,
  - `article-pipeline` zawsze tworzy i uzywa kopii roboczej w `/tmp/fitpo50-import-*/<slug>.fitpo50.json` i usuwa ja po zakonczeniu (rowniez po FAIL).

- **FAQ z sieci (bez pytań „z głowy”) - zasada twarda:**
  - Importer działa domyślnie w trybie `--faq-strict true`.
  - Artykuł nie przechodzi, jeśli:
    - FAQ ma mniej niż 4 pytania,
    - FAQ zawiera placeholdery,
    - brak `faq_research[]` z minimum 4 wpisami.
  - Wymagany format `faq_research[]`:
    - `question`
    - `source_label`
    - `source_url` (`https://...`)
  - Każde pytanie FAQ musi mieć odpowiednik w `faq_research[]`.

- **Anty-placeholder (twardy FAIL):**
  - Artykuł nie przechodzi importu, jeśli zawiera jakiekolwiek placeholdery redakcyjne w tytule, leadzie, sekcjach, boxach lub FAQ.
  - Blokowane frazy obejmują m.in.:
    - `Do uzupełnienia redakcyjnego`
    - `Pytanie do doprecyzowania`
    - `Odpowiedź do uzupełnienia`

## Ustalenia operacyjne (2026-05-10) - semantic internal linker + szybkosc

- **Auto-linking semantyczny w imporcie artykulu:**
  - `scripts/article-pipeline.js` uruchamia import z `--run-internal-links auto` (nie `false`).
  - Celem jest automatyczne osadzanie linkow wewnetrznych podczas publikacji, bez recznego dosztukowywania.

- **Nowa warstwa semantyczna w `admin/helpers/internal-links.php`:**
  - Dobor kandydatow do linkow bierze pod uwage nie tylko slug/tytul, ale tez:
    - `meta description`,
    - naglowki `h1/h2/h3`,
    - fragment tresci artykulu.
  - Wprowadzony scoring semantyczny (dopasowanie tokenow + frazy wielowyrazowe + kara za tokeny zbyt czeste).

- **Filtr jakosci anchorow (anty-generyczne linkowanie):**
  - Odrzucane sa slabe/generyczne anchory (np. bardzo ogolne slowa i ich odmiany).
  - Priorytet maja anchory frazowe i bardziej specyficzne tematycznie.

- **Cache korpusu dla szybkosci:**
  - Wprowadzony cache: `data/cache/internal-link-corpus.json`.
  - Cache odswieza sie automatycznie, gdy zmieniaja sie artykuly (fingerprint po `filemtime`).
  - Efekt: szybsze kolejne importy (brak pelnego skanowania semantyki przy kazdym uruchomieniu).
  - Plik cache jest lokalny i ignorowany przez Git (`.gitignore`).
    - nierozwiązane znaczniki `{{...}}`
  - Dodatkowy bezpiecznik SEO: tytuły urwane (np. kończące się na `i cofnąć`) są traktowane jako błąd blokujący.

- **Schema obowiązkowe dla każdego artykułu:**
  - `BlogPosting` (z datami ISO, `speakable`, zgodnością z metadanymi strony),
  - `FAQPage` (zgodny 1:1 z widoczną sekcją FAQ).

- **Kontrola po imporcie (obowiazkowa):**
  - uruchom gate przed deployem: `npm run predeploy:check` (oraz wariant ze slugiem: `node scripts/predeploy-gate.js --slug <slug>`),
  - sprawdz obecność artykulu w `index.html`, `porady.html` i stronie kategorii,
  - sprawdz `<title>` <= 65 znakow,
  - sprawdz, ze istnieja:
    - sekcja `.key-takeaways`,
    - przycisk `.pdf-hero-download`,
    - poprawna lista `sources-list` (pelne nazwy + linki),
  - sprawdz synchronizacje source <-> `_site`.

- **Granica modulow (anty-regresja):**
  - Importer artykulow nie moze modyfikowac danych NEWS ani miniatur Bento News.

## Ustalenia operacyjne (2026-04-26) - obrazy w tresci i PDF

- **Mapowanie obrazow sekcyjnych (wymagane przez importer):**
  - `image_prompts[]` sluzy jako brief do generacji grafik i mapowania `section_ref`,
  - samo `image_prompts[]` **nie osadza** obrazow w tresci artykulu,
  - aby obraz pojawil sie w HTML artykulu, trzeba ustawic `sections[].image`:
    - `src` (np. `./assets/nazwa.webp`),
    - `alt`,
    - opcjonalnie `caption`.

- **Zasada spojnosc danych obrazow:**
  - `hero_image` musi odpowiadac wpisowi `image_prompts` z `section_ref: "hero"`,
  - dla sekcji utrzymujemy zgodnosc:
    - `image_prompts.section_ref == "sekcja-N"` <-> `sections[N-1].image.src`.

- **PDF po zmianach w tresci artykulu:**
  - po recznej edycji tresci/obrazow artykulu zawsze uruchamiamy:
    - `python3 scripts/sync_article_pdfs_and_buttons.py --slug <slug>`
  - po generacji potwierdzamy, ze PDF istnieje w `assets/pdf/` i `_site/assets/pdf/`.

- **Incydent anty-regresyjny (listingi + kafelki Czytelni):**
  - sam commit z plikiem artykulu nie wystarcza; publikacja jest "done" dopiero, gdy na produkcji sa tez:
    - listingi (`index.html`, `porady.html`, strona kategorii),
    - metadane publikacyjne (`sitemap.xml`, `llms.txt`),
    - wszystkie assety kart "Czytelnia" (miniatury related, bez 404).
  - po pushu obowiazkowo robimy live-check:
    - `curl -sL https://fitpo50.pl/index.html | rg "<slug>"`
    - `curl -sL https://fitpo50.pl/porady.html | rg "<slug>"`
    - `curl -I https://fitpo50.pl/assets/<related-image>.jpg` (oczekiwane `200`).
  - `git push` nie oznacza automatycznego wdrozenia na Hostinger; po pushu trzeba potwierdzic stan live na `https://fitpo50.pl`.
  - fallback 3 kafelkow na `index.html` (`renderReadingFallback`) nie moze miec na stale zaszytych "historycznych" wpisow; po imporcie ma odzwierciedlac 3 najnowsze artykuly (nowy + poprzedni latest + kolejny aktualny).
  - Automatyczny workflow przy komendzie usera `git push`:
    - traktuj `git push` jako skrot do pelnego pipeline push,
    - najpierw `./scripts/export_site.sh`,
    - potem `npm run assets:mirror:sync`,
    - potem `npm run predeploy:check`,
    - raport wynikow (PASS/FAIL + kluczowe bledy),
    - przy PASS: `git add -A` -> `git commit` (automatyczny komunikat) -> `git push`,
    - przy FAIL (hook/gate): STOP tylko na czas naprawy; naprawic wszystkie blokery push, ponowic gate i dopiero po PASS wykonac push zgodnie z komenda usera,
    - bezpiecznik: przy nienaturalnie duzym, mieszanym zakresie zmian STOP i krotkie pytanie o zgode.

## Open questions
- Czy utrzymujemy dodatkowe domeny/staging w CORS dla API kalendarza?

## Definition of done
Zmiana jest gotowa dopiero, gdy:
- jest zgodna z architektura i zasadami z tego pliku,
- nie miesza logiki `Porady` i `Moje Sukcesy`,
- zostala sprawdzona pod katem synchronizacji, jesli dotyczy statusu wpisow,
- output publiczny w `_site` jest aktualny,
- nie dodano do commita plikow narzedziowych,
- ryzyka cache/CORS zostaly uwzglednione, jesli zmiana dotyczy frontu lub API.

## Review checklist
Przy review sprawdzaj w pierwszej kolejnosci:
- zgodnosc z architektura projektu,
- czy nie mieszamy logiki `Porady` i `Moje Sukcesy`,
- czy synchronizacja po zmianach statusu wpisu nadal dziala,
- czy deploy/public output w `_site` jest spojny,
- czy zmiana nie psuje SEO, sitemapy lub publicznych URL-i,
- czy nie dodano do commita plikow narzedziowych,
- czy zmiana nie jest wieksza niz wymaga task.

## Ustalenia z dnia 2026-04-09

- **Format dostarczania artykulow:**
  - preferowany format wsadowy to `JSON` (najmniej bledow i najlepsza automatyzacja SEO/schema),
  - fallback: czysty tekst/Markdown z DOCX,
  - zrzuty ekranu traktujemy jako ostatecznosc (duzo wiecej pracy recznej i ryzyko bledow).
- **Wizual artykulow (wszystkie kategorie):**
  - utrzymujemy merytoryczna tresc 1:1, ale dopuszczamy umiarkowane wyroznienia wizualne:
    - pogrubienia (`<strong>`) w kluczowych zdaniach,
    - akcenty kolorystyczne i callouty tam, gdzie wzmacnia to przekaz,
    - bez przesady i bez "przekolorowania" calego artykulu.
  - wyroznienia maja byc spojne z obecnym stylem serwisu (nie zmieniamy design systemu lokalnym taskiem).
  - dla nowych artykulow mozemy stosowac bardziej wyraziste formatowanie (kolory, typografia, sekcje wyroznione), ale:
    - opieramy sie na istniejacych tokenach/zmiennych (`var(--color-*)`, istniejące klasy i skale),
    - nie mieszamy wielu przypadkowych krojow (docelowo max 2-3 rodziny fontow),
    - nie dodajemy nadmiarowych stylow inline dla layoutu i kart "Czytelnia",
    - tabelki sa dopuszczone, ale musza byc czytelne mobilnie (responsywne) i miec lekkie, spojne tlo.
- **Kafelki kategorii i karuzele:**
  - strony kategorii (`rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`, `mity.html`) maja byc wizualnie i funkcjonalnie zgodne z wzorcem z `porady.html`,
  - ten sam standard meta czasu czytania, CTA i paginacji `WRÓĆ/DALEJ`,
  - po zmianach w CSS/HTML pilnujemy wersjonowania assetow (`?v=`), zeby cache nie maskowal efektu.
  - na stronie glownej (`index.html`) kafelki wejscia do kategorii maja stale, recznie przypisane zdjecia ilustrujace kategorie; te obrazy nie sa rotowane ani podmieniane automatycznie przez zadne skrypty (news/faq/czytelnia).
  - tryb nocny tla na mobile (telefon): utrzymujemy spojnie na `index.html`, `o-mnie.html` i wszystkich przyszlych stronach przebudowywanych na nowym wzorcu Bento; na desktopie domyslnie zostaje jasne tlo (chyba ze zapadnie osobna decyzja).
- **Spojnosc kolorow etykiet kategorii:**
  - mapowanie kolorow etykiet jest stale na wszystkich listach/kafelkach,
  - nie dodajemy inline kolorow sprzecznych z mapowaniem kategorii.
  - standard mapowania (obowiazkowy we wszystkich sekcjach "Czytelnia", karuzelach i listach):
    - `Ruch` -> `#2f6f99` (niebieski), tekst `#ffffff`,
    - `Jedzenie` -> `rgba(201, 109, 49, 0.94)`, tekst `#ffffff`,
    - `Zdrowie` -> `rgba(228, 188, 74, 0.96)`, tekst `#4e3a04`,
    - `Ciekawe` -> `rgba(67, 149, 84, 0.94)`, tekst `#ffffff`,
    - `Mity` -> `#b4233a`, tekst `#ffffff`.
  - etykieta `Ruch` ma byc zawsze niebieska; nie stosujemy alternatywnych odcieni dla tej kategorii.
- **Tryb nocny tła (kluczowa zasada UI):**
  - Ciemne oba tła (`body` + `shell`) uruchamiamy **wylacznie na telefonach komorkowych**.
  - Na desktopie i tabletach pozostaje jasne tlo, niezaleznie od pory dnia i `prefers-color-scheme`.
  - Menu/topbar nie zmienia mechaniki ani ukladu z powodu tej reguly.
  - Regula obowiazuje na wszystkich stronach w nowym ukladzie (`index`, `o-mnie`, `porady`, `rusz-sie`, `jedzenie`, `zdrowie`, `ciekawe`, `dziennik`) oraz przy kazdej nowej podstronie.
- **Admin i media (Moje Sukcesy):**
  - panel obsluguje video z YouTube oraz upload video,
  - trzeba respektowac orientacje pion/poziom (bez obcinania kadrów),
  - dla YouTube wystarcza link; plik video nie jest kopiowany na nasz serwer.
- **SEO i technikalia video:**
  - dla wpisow video utrzymujemy poprawne meta i dane strukturalne (`VideoObject`, `og:video*`),
  - po zmianach sprawdzamy render i walidacje (struktura + podglad social).

## Detailed reference

## Podzial pamieci modulowej

- Glowny plik (`PROJECT_MEMORY.md`) zawiera zasady przekrojowe i wspolne.
- Szczegoly dla modulow trzymamy osobno:
  - `MEMORY_PORADY.md` - klasyczne artykuly i czytelnia `porady.html`.
  - `MEMORY_MOJE_SUKCESY.md` - kalendarz oraz strony dnia `sukcesy/YYYY-MM-DD.html`.
  - `MEMORY_NEWSY.md` - sekcja `NEWS` na `index.html` oraz panel admin do szybkich newsow.
- Zasada pracy:
  - gdy zadanie dotyczy `Porady`, czytamy i stosujemy `MEMORY_PORADY.md`,
  - gdy zadanie dotyczy `Moje Sukcesy`, czytamy i stosujemy `MEMORY_MOJE_SUKCESY.md`,
  - gdy zadanie dotyczy sekcji `NEWS`, czytamy i stosujemy `MEMORY_NEWSY.md`,
  - nie mieszamy logiki miedzy modulami.

## Zasady ogolne

- Zachowujemy obecny kierunek serwisu: praktyczny, czytelny, bez nadmiaru ozdobnikow.
- Nadrzedna kolejnosc priorytetow dla tresci, publikacji i automatyzacji: **SEO -> AEO -> GEO -> AIO**.
- Przy konflikcie decyzji najpierw zabezpieczamy SEO, potem AEO, potem GEO, a na koncu AIO.
- Nie cofamy ustalen projektowych i SEO bez wyraznej prosby.
- Przy kazdej zmianie najpierw sprawdzamy stan pliku, potem edytujemy.
- Po zmianach frontowych (CSS/JS/template) pamietamy o cache:
  - podbijamy wersje assetow (`?v=`), jesli to potrzebne,
  - przy diagnozie "nie dziala" najpierw sprawdzamy wersje bez cache.
- Deploy statyczny robimy przez `./scripts/export_site.sh` (automatyzuje build TS i eksport do `_site/`).
- Awaryjnie, gdy lokalnie brak toolchainu TS, mozna uzyc `SKIP_TS_BUILD=1 ./scripts/export_site.sh`.
- Na serwer wysylamy zawartosc `_site/`, nie katalog glowny repo.

## Architektura serwisu

- Serwis opiera sie na czterech glownych filarach:
  - `rusz-sie.html` (Ruch)
  - `jedzenie.html` (Jedzenie)
  - `zdrowie.html` (Zdrowie)
  - `ciekawe.html` (Ciekawe)
- Strona zbiorcza artykulow to `porady.html`.
- Kategoria `Wiedza` zostala usunieta. Powiazane tresci wpadaja do jednego z czterech filarow (najczesciej do `Zdrowie` lub `Ciekawe`).
- Na stronie glownej sekcja "Najnowsze Porady i Artykuly" ma zawierac tylko 3 najnowsze kafelki.

## Artykuly

- Kanoniczny standard artykułów jest opisany w `ARTICLE_STANDARD.md` i jest **obowiązkowy**.
- Golden template (wzorzec referencyjny): `wydolnosc-vo2max-starzenie-po-50.html`.
- Szablon do tworzenia nowych wpisów: `article-template-bento.html`.
- Każdy nowy artykuł ma być tworzony wyłącznie z szablonu; nie robimy ręcznych wariantów layoutu.
- W headerze artykulu pokazujemy tylko:
  - dzial
  - czas czytania
- Nie pokazujemy widocznej daty publikacji lub aktualizacji na gorze artykulu.
- Daty moga byc obecne tylko w SEO i schema.
- Uklad artykulu ma byc spojny z istniejacym standardem wizualnym.
- **Sekcja „Czytelnia” (obowiązkowa):** Na dole każdego artykułu (nad footerem) zawsze dodajemy sekcję o klasach `reading-room porady-preview section-padding` z `id="porady-preview"`.
  - Nagłówek ma być identyczny jak na `index.html` (układ `reading-room__head` + `title-with-icon` + `title-icon`).
  - Poniżej mają być dokładnie 3 kafelki w układzie `articles-grid-preview`.
  - Każdy kafelek zawiera: `picture`, kategorię, czas czytania, tytuł (`h4`), krótki opis i CTA „Czytaj artykuł ->”.
- Zakazane w artykułach:
  - inline CSS (`style="..."`),
  - lokalne bloki `<style>` (docelowy standard),
  - footer poza `<body>`.
- Wymagane klasy na `body` artykułu:
  - `article-template`,
  - `article--ruch` lub `article--jedzenie` lub `article--zdrowie` lub `article--ciekawe`.
- System kolorów kategorii (stały):
  - `Ruch`: `#2f6f99` / `#ffffff`,
  - `Jedzenie`: `rgba(201, 109, 49, 0.94)` / `#ffffff`,
  - `Zdrowie`: `rgba(228, 188, 74, 0.96)` / `#4e3a04`,
  - `Ciekawe`: `rgba(67, 149, 84, 0.94)` / `#ffffff`.
- Zmiany globalne designu robimy przez tokeny CSS (jedna edycja = wszystkie artykuły):
  - fonty: `--font-display`, `--font-body`, `--font-ui`,
  - spacing/radius/type scale: `--space-*`, `--radius-*`, `--text-*`,
  - breakpointy: `--bp-mobile`, `--bp-phone-dark`, `--bp-topbar-collapse`.
- Narzędzia standardu:
  - kanoniczny importer publikacyjny: `node scripts/import-article.js --file "<plik.fitpo50.json>" --precheck true`,
  - generator szkicu (opcjonalnie): `node scripts/create-article-from-template.js ...`,
  - walidator: `node scripts/validate-article-standard.js <plik.html>`.

## SEO artykulow

- Kazdy artykul powinien miec:
  - `title`
  - `meta name="description"`
  - `meta name="robots" content="index,follow"`
  - `link rel="canonical"`
  - `og:title`
  - `og:description`
  - `og:type`
  - `og:url`
  - `og:image`
  - `og:locale`
  - `twitter:card`
  - `twitter:title`
  - `twitter:description`
  - `twitter:image`
  - `article:published_time`
  - `article:modified_time`
- `title` ma byc krotki, wyszukiwalny i semantycznie spojny z `h1` (bez sztucznego "upychania" fraz).
- Lead artykulu powinien zawierac minimum jedno naturalne zdanie z frazami intencyjnymi (np. "trening po 50", "silownia po 50 roku zycia"), bez keyword stuffing.
- Jesli w innych artykulach jest stosowane `article:author`, utrzymujemy ten sam wzorzec.
- Zasada dat:
  - `datePublished`/`article:published_time` = faktyczna data publikacji na stronie (nie data napisania draftu).
  - `dateModified`/`article:modified_time` = data ostatniej istotnej aktualizacji merytorycznej.
  - Przy pierwszej publikacji oba pola moga byc takie same.
  - Przy publikacji nowego artykulu ustawiamy aktualna date dnia publikacji (`datePublished` i `article:published_time`), a wpis jest traktowany jako najnowszy.

## SEO strony glownej i stron zbiorczych

- Strona glowna powinna miec:
  - `title`
  - `meta name="description"`
  - `meta name="robots" content="index,follow"`
  - `link rel="canonical"`
  - komplet `og:*`
  - komplet `twitter:*`
- Strony zbiorcze (`porady.html`, `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`) powinny miec:
  - `title`
  - `meta name="description"`
  - `meta name="robots" content="index,follow"`
  - `link rel="canonical"`
  - komplet `og:*`
  - komplet `twitter:*`
  - schema `CollectionPage`

## Schema

- Dla artykulow stosujemy `BlogPosting`.
- W `BlogPosting` powinny byc:
  - `headline`
  - `description`
  - `inLanguage`
  - `mainEntityOfPage`
  - `url`
  - `image`
  - `datePublished`
  - `dateModified`
  - `keywords`
  - `author`
  - `publisher`
- Dla strony glownej utrzymujemy:
  - `WebSite`
  - `Organization`
- Dla stron zbiorczych utrzymujemy `CollectionPage`.
- `porady.html` powinno uzywac `CollectionPage` z `mainEntity` typu `ItemList`.
- Dane w schema musza zgadzac sie z realna zawartoscia strony:
  - Liczba artykulow: dynamiczna (zgodna 1:1 z aktualna liczba kart w `porady.html`; nie trzymamy stalej wartosci typu 17)
  - lista artykulow
  - kolejnosc

## Standardy obrazow i mediow

- **Logo (`logo.jpg`):**
  - Oryginalne wymiary: 693x693px (kwadrat).
  - W nagłówku (`.logo__img`): zawsze `width="48" height="48"`.
  - W stopce (`.logo__img--footer`): zawsze `width="72" height="72"`.
- **Zdjecia w artykulach:**
  - Domyslnie stosujemy `loading="lazy"`.
  - Dla hero stosujemy `loading="eager"`.
  - Zawsze podajemy `width` i `height` odpowiadajace proporcjom obrazu.
  - Rekomendowany format: `picture` z AVIF/WebP jako sourcami i fallbackiem <img>.

## Zrodla

- Sekcja `Zrodla` powinna byc obecna tam, gdzie to zasadne.
- Jesli da sie pewnie wskazac konkretne zrodlo, link powinien byc klikalny.
- Dla linkow otwieranych w nowej karcie zawsze stosujemy:
  - `target="_blank"`
  - `rel="noopener noreferrer"`
- Nie zgadujemy publikacji, jesli nie da sie ich uczciwie ustalic.
- Gdy nie da sie podac konkretnego artykulu, mozna linkowac DOI, PubMed, PMC, strone instytucji albo strone czasopisma.
- W tematach zdrowotnych i suplementacyjnych preferujemy:
  - PubMed
  - PMC
  - DOI
  - instytucje
  - przeglady systematyczne
  - dobre czasopisma naukowe

## Obrazy

- Hero, featured i wazne obrazy w tresci powinny uzywac:
  - `picture`
  - `AVIF`
  - `WebP`
  - oryginalnego fallbacku (`png` albo `jpg`)
- Standard:

```html
<picture>
  <source srcset="./assets/NAZWA.avif" type="image/avif">
  <source srcset="./assets/NAZWA.webp" type="image/webp">
  <img src="./assets/NAZWA.png" alt="..." loading="eager" width="W" height="H">
</picture>
```

- `loading="eager"` stosujemy dla hero.
- `loading="lazy"` stosujemy dla obrazow nizej w tresci, kart i ilustracji, jesli ma to sens.
- `width` i `height` podajemy zawsze tam, gdzie to mozliwe, aby ograniczac CLS.
- Po podmianie obrazu na `picture` trzeba sprawdzic, czy wrapper nadal poprawnie wypelnia ramke, szczegolnie w Safari.
- Dla logo tez warto podawac wymiary, jesli nie rozwala to layoutu.

## Konwersja obrazow

- Przy optymalizacji obrazow generujemy:
  - `AVIF` jako format priorytetowy
  - `WebP` jako fallback
- Do konwersji uzywamy:
  - `avifenc` dla AVIF
  - `cwebp` dla WebP
- Nie uzywamy `ffmpeg` do WebP w tym projekcie.
- Po wygenerowaniu nowych plikow trzeba podpiac je do HTML przez `picture`, a nie tylko zostawic w katalogu `assets`.

## Standard artykulu

- Wrapper strony artykulu: `.article-page`
- Meta header: `.article-header__meta`
- Tytul: `.article-header__title`
- Pierwszy akapit moze uzywac `.drop-cap`
- Wazne callouty i mocne cytaty: `.article-quote`
- Motto na hero artykulu: `.hero-motto`
- H2 to glowne sekcje
- H3 to podsekcje
- Tabele w artykulach musza byc ladnie zaprojektowane, nie jako surowy HTML: uzywaj wrappera `.article-table-wrap`, klasy `.article-table` oraz w razie potrzeby modifiera `.article-table--compact`; kazda tabela ma miec sensowny `<caption>`, czytelne naglowki, krotkie komorki i nie moze byc zawinieta w `<p><table>`.
- Na dole artykulu:
  - sekcja `Zrodla`
  - `.medical-disclaimer`
  - sekcja `.porady-preview` z 3 adekwatnymi kafelkami
  - **Linkowanie wewnętrzne (Interlinking)**: Dajemy minimum 4 linki wewnętrzne osadzone bezpośrednio w akapitach artykułu (naturalne anchory wynikające z treści, bez zmiany brzmienia zdań). Sama lista typu "Czytaj też" lub same kafelki "Czytelnia" nie zastępują tych linków kontekstowych.
  - **Regula importera (Czytelnia)**: przy imporcie z JSON ignorujemy `related_articles`/`related` z pliku wejściowego. Karty Czytelni dobieramy wyłącznie z lokalnie istniejących artykułów, żeby nie powstawały martwe linki.
  - **Regula redakcyjna (crosslinki)**: crosslinki w treści artykułu dopinamy ręcznie po imporcie (kontrola redakcyjna), nie ufamy automatycznym linkom z modelu.

## Kafelki i linkowanie artykulow

- Na stronie glownej uzywamy pelnych kart promocyjnych.
- Na stronach kategorii uzywamy kompaktowych kafelkow bez zdjec.
- Kafelki na jednej stronie kategorii musza byc graficznie spojne.
- Strony kategorii (`rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`) maja uzywac tego samego wzorca kart i tej samej logiki karuzeli/paginacji co `porady.html` (ten sam layout kart, meta czasu, CTA, grupowanie po 8, `WRÓĆ/DALEJ`, bez `scrollIntoView()` pod nawigacja karuzeli).
- Kolory etykiet kategorii musza byc stale i spójne na wszystkich stronach:
  - `Ruch` -> niebieski (`var(--color-primary)`),
  - `Jedzenie` -> pomaranczowy (`var(--color-accent)`),
  - `Zdrowie` i `Ciekawe` zgodnie z aktualnym wzorcem CSS projektu.
- Przy recznym dopinaniu nowych kafelkow nie nadpisujemy kolorow kategorii inline w sposob sprzeczny z tym mapowaniem.
- CTA w kompaktowych kafelkach: `Czytaj artykul ->`
- Przy dodaniu nowego artykulu aktualizujemy:
  - odpowiednia strone kategorii
  - `porady.html`
  - `sitemap.xml`
- `porady.html` musi byc zgodne we wszystkich warstwach:
  - liczba kart w HTML
  - licznik na stronie
  - schema `ItemList`
  - linki do realnie istniejacych plikow

## Featured na stronie glownej

- Sekcja "Najnowszy Artykul" pod BIO zawsze promuje najnowszy artykul wg daty publikacji.
- Na `index.html` w sekcji `articles-grid-preview` zawsze pokazujemy 3 najnowsze kafelki.
- Pierwszy kafelek w tej sekcji musi byc tym samym wpisem co `featured-article`.

## Mobile i Safari

- Dla krytycznych sekcji pilnujemy poprawnego zachowania na mobile i w Safari.
- W sekcjach gridowych z tekstem stosujemy `min-width: 0`, zeby unikac rozpychania layoutu.
- Przy bardzo malych ekranach:
  - footer ma przechodzic do jednej kolumny
  - siatki kart maja schodzic do jednej kolumny, jesli dwie robia sie zbyt ciasne
  - featured i podobne sekcje maja przechodzic do jednego slupka
- Przy `picture` i wrapperach obrazow sprawdzamy:
  - `display: block`
  - `width: 100%`
  - `height: 100%`
  - `object-fit: cover`
- Dla starszego Safari trzeba uwazac na:
  - `aspect-ratio`
  - `gap` w flexie
  - elementy grid/flex bez `min-width: 0`

## Porady.html (Karuzela i Paginacja)

- `porady.html` to czytelnia i glowny katalog wszystkich artykulow. Zlote zasady:
  1. **Zgodność liczników i warstwy SEO**: Licznik w HTML (np. `data-article-count`), rzeczywista liczba kafli na stronie oraz deklaracja wpisów w sekcji `<script type="application/ld+json">` (elementy `"numberOfItems"` oraz ich `"position"`) MUSZĄ się zawsze zgadzać co do sztuki. Kolejnosc pozycji w JSON-LD ma byc spójna z przyjeta kolejnoscia katalogu (nie wpisujemy numerow recznie na stale).
  2. **Struktura kart HTML**: Używamy pełnej zwięzłej struktury dla kafelków (`.article-index-card`): pomarańczowa odznaka `.article-index-card__label`, czysty tekst czasu `.article-index-card__meta` (bez ikon SVG), a CTA dolne to tekst "Otwórz ->". 
  3. **Wymogi ułożenia CSS Grid**: Karty KATEGORYCZNIE układają się w sztywnym podziale. Żeby pojedyncze artykuły na końcu karuzeli się nie rozciągały, definiujemy twardą siatkę: `grid-template-columns: repeat(4, 1fr)` (desktop), `repeat(2, 1fr)` (tablet), oraz `1fr` dla mobile. **Zakaz korzystania z `auto-fit`** w klasie `.carousel-page`.
  4. **Zapobieganie awariom Grid w Safari**: Z powodu znanego wycieku szerokości WebKit/Safari, klasa kontenerowa `.carousel-page` (bedąca elementem list flex) MUSI posiadać atrybuty `min-width: 0;` oraz `max-width: 100%;`. Dodatkowo same obiekty `.article-index-card` też używają `min-width: 0;`. Skutecznie blokuje to przedziury (blowouty) karuzeli w 1 wielki, rozciągnięty ciąg na urządzeniach Apple.
  5. **Nawigacja JS**: Stronicowanie (zmiana translateZ) obsługiwane jest gładkim przesuwaniem, logiki skryptu grupującej po max 8 elementów na okienko. **Surowy zakaz** używania polecenia `.scrollIntoView()` pod guzikami "Dalej" i "Wróć", ponieważ powoduje to szkodliwe "skoki" ekranu użytkownika w pionie.

## Tryb operacyjny agenta (doprecyzowanie)

- Po zmianach **nie wykonuj `git commit` ani `git push` bez mojej wyraznej komendy**.
- Przy dodaniu nowego artykulu **zawsze** zaktualizuj:
  - strone kategorii,
  - `porady.html`,
  - `sitemap.xml`,
  - `index.html`:
    - sekcje `featured-article`,
    - pierwszy kafelek w `articles-grid-preview`,
    - oraz caly zestaw 3 kafelkow jako 3 najnowsze wpisy.
- Dla nowych obrazow:
  - generuj `webp` (i `avif`, jesli ma sens),
  - zostaw fallback `jpg/jpeg` (PNG tylko dla logo i ikon technicznych),
  - podawaj `width` i `height`,
  - hero: `loading="eager"`, pozostale: `loading="lazy"`.
- Przy poprawkach mobile/Safari:
  - najpierw lokalna poprawka sekcji,
  - nie ruszaj globalnego CSS, jesli nie jest to konieczne.
- Jesli mozna zachowac istniejacy wzorzec projektu, **nie pytaj o warianty stylistyczne**, tylko wdrazaj.
- Po zakonczeniu podaj krotki raport:
  1. co zmienione,
  2. jakie pliki,
  3. jak szybko sprawdzic wynik,
  4. status `git` (`git status --short`, w tym pliki untracked i nowe assety).
- Jesli pojawi sie blocker lub ryzyko utraty danych:
  - zadaj jedno krotkie pytanie i czekaj na decyzje.

## Konwersja obrazow i komendy shell (stabilnosc)

- Dla WebP uzywaj `cwebp`, nie `ffmpeg`:
  - `ffmpeg` w tym srodowisku moze nie miec encodera WebP.
- Dla AVIF uzywaj `avifenc`.
- Nie tworz dlugich lancuchow komend typu `cmd1 && cmd2 && cmd3 ...` dla wielu plikow.
- Przy kopiowaniu/przenoszeniu wielu obrazow wykonuj operacje pojedynczo lub petla po jednym pliku.
- Przy pracy na sciezkach z iCloud, spacjami i znakami specjalnymi:
  - zawsze uzywaj pelnego quotingu (`"..."`) dla sciezek,
  - unikaj recznego skladania bardzo dlugich polecen.
- Gdy konwersja obrazow sie zawiesza:
  - przerwij krok,
  - wykonaj konwersje lokalnie stabilnym zestawem (`cwebp`/`avifenc`),
  - potem edytuj tylko HTML (bez dodatkowych testow i bez nowych komend shell).
- W zadaniach "podlacz obrazki" domyslnie:
  - nie otwieraj Preview/Visual Verification,
  - nie uruchamiaj audytu calego repo,
  - edytuj tylko wskazany plik HTML + odpowiadajace mu pliki w `assets`.
- Gdy pojedyncza komenda shell nie pokazuje postepu przez >90 sekund:
  - przerwij krok,
  - zmien strategie na krotsze komendy per plik.
- Nie tworz tymczasowych skryptow typu `_convert_images.sh`, jesli nie zostalo to wyraznie zlecone.

## Globalna stabilnosc wykonania (dla wszystkich zadan)

- Stosuj zasade `fail fast`:
  - jesli krok nie ma postepu >90 sekund, przerwij i zmien strategie.
- Nie ponawiaj tej samej blednej komendy wiecej niz 2 razy.
- Po bledach typu `No such file`, `operation not permitted`, `encoder not found`:
  - zatrzymaj petle retry,
  - zastosuj plan B (krotsze komendy, inny tool, etapowanie pracy).
- Unikaj bardzo dlugich komend i lancuchow `&&`; preferuj kroki atomowe.
- W jednym zadaniu nie mieszaj wielu faz naraz:
  - najpierw zmiana kodu/HTML,
  - potem assety/konwersje,
  - na koncu szybka weryfikacja.
- Trzymaj scisly zakres zmian:
  - nie edytuj plikow poza zakresem zlecenia bez wyraznej prosby.
- Preview/Visual Verification uruchamiaj tylko na wyrazna prosbe uzytkownika.
- Po 2 nieudanych probach wykonania kroku:
  - zakoncz krotkim raportem blokera i zaproponuj jedna bezpieczna alternatywe.

Nie zostawiamy starych, duplikujących się bloków zaplecza, ani martwych linków do archiwalnego HTML, którego w bazie nie ma!

## Sitemap

- `sitemap.xml` musi zawierac wszystkie publiczne strony.
- Kazdy wpis ma miec:
  - `<loc>`
  - `<lastmod>YYYY-MM-DD</lastmod>`
- `lastmod` aktualizujemy przy zmianie danej strony.

## Workflow nowego artykulu

Przy dodawaniu nowego artykulu aktualizujemy:

1. nowy plik HTML artykulu
2. odpowiednia strone kategorii
3. `porady.html`
4. `sitemap.xml`
5. PDF artykulu + duzy przycisk pobierania w hero (z rozmiarem KB)

PDF workflow (obowiazkowy):

1. wygeneruj PDF i zaktualizuj przycisk:
   - `python3 scripts/sync_article_pdfs_and_buttons.py --slug <slug>`
2. hurtowo dla wszystkich artykulow:
   - `npm run article:pdf:sync`
3. mapowanie ma byc 1:1: `slug.html` -> `assets/pdf/slug.pdf` (bez pomylek)
4. przycisk PDF na hero ma byc linkiem `<a ... download>` (bez wymuszania `role="button"`)
5. metadane PDF sa obowiazkowe i musza byc poprawne:
   - `/Title` = pelny tytul artykulu (`h1.article-header__title`) - nie generyczne "Kluczowe wnioski",
   - `/Author` = `FitPo50`,
   - `/Creator` = `FitPo50 PDF Generator`,
   - `/Subject` ma zawierac kontekst artykulu.
6. schema `BlogPosting` musi zawierac link do wersji PDF przez `encoding` (`MediaObject`):
   - `contentUrl` = `https://fitpo50.pl/assets/pdf/<slug>.pdf`,
   - `encodingFormat` = `application/pdf`,
   - `inLanguage` = `pl-PL`,
   - `name` = `<headline> (PDF)`.
7. przy kazdej publikacji/aktualizacji artykulu uruchomienie `article:pdf:sync` jest elementem Definition of Done.
8. strategia indeksacji PDF (kanonical HTTP header vs `X-Robots-Tag: noindex`) to decyzja serwerowa i nie moze byc pomijana przy wdrozeniu produkcyjnym.

Jesli artykul ma obrazy:

1. generujemy lub przygotowujemy plik zrodlowy
2. robimy `AVIF` i `WebP`
3. podpinamy przez `picture`
4. dodajemy poprawne `width`, `height` i `loading`

## Zasada koncowa

- Tresci artykulow pozostaja merytorycznie nietkniete, jesli uzytkownik nie prosi o redakcje.
- **KRYTYCZNE**: Umieszczenie/publikacja artykulu odbywa sie bez zmiany jego tresci merytorycznej (1:1), a optymalizacje wykonujemy w kolejnosci: `SEO -> AEO -> GEO -> AIO`.
- **KRYTYCZNE**: Nigdy nie pomijamy `article:modified_time` oraz `dateModified` w schema.
- **KRYTYCZNE**: W kazdym artykule schema `SpeakableSpecification` musi obejmowac nie tylko tytul i lead, ale tez sekcje Key Takeaways:
  - `.article-header__title`
  - `.article-content > p:first-of-type`
  - `.key-takeaways h2`
  - `.key-takeaways li`
  Przy dodawaniu nowego artykulu lub zmianach w template zawsze sprawdzamy ten zestaw selektorow.
- **KRYTYCZNE**: Obrazy hero/featured/inline w artykulach MUSZA isc przez tag `<picture>` z AVIF i WebP (fallback `jpg/jpeg`, bez `png` jako formatu docelowego). Wyjatek: logo i male ikony techniczne.
- **KRYTYCZNE**: Jesli material zrodlowy przychodzi jako `PNG`, workflow jest staly:
  - generujemy `AVIF` + `WebP` (oraz `JPG/JPEG`, gdy potrzebny fallback),
  - przepinamy wszystkie referencje w HTML/JSON-LD/OG/Twitter/preload na nowe rozszerzenia,
  - dopiero po weryfikacji `rg '\\.png'` usuwamy pliki `PNG` z `assets` i `_site/assets`.
- **KRYTYCZNE**: W sekcjach "Więcej Porad" (stopka artykułu) używamy klasy `.articles-grid-preview`. NIGDY nie dodajemy tam stylów inline typu `grid-template-columns`. Układem zarządza centralnie `style.css` (1 kolumna na telefonie, 2 na tablecie, 3 na desktopie). CTA kart promocyjnych to zawsze tekstowe "Czytaj artykuł ->", a nazwa sekcji nie może zawierać słowa "Wiedza".
- **KRYTYCZNE**: Sekcja Hero na `index.html` korzysta z animacji wejściowych (klasa `.hero__eyebrow`, `.hero__title` itd.) oraz efektu paralaksy (skrypt na dole strony). Przy edycji nagłówka należy zachować klasę `.floating` dla badge'a oraz dbać o to, by obraz tła miał `will-change: transform`.
- **KRYTYCZNE**: Sekcja `featured-article` (pod biogramem na `index.html`) oraz pierwszy kafelek w `articles-grid-preview` musza byc ze soba spójne i zawsze wskazywac najnowszy artykul.
- **KRYTYCZNE**: Wszystkie nagłówki sekcji (`section-header`) muszą posiadać element `<div class="section-header__line"></div>` oraz sub-klasy animacyjne. Standard to: etykieta (slide), tytuł (fade-up), linia (scale-out) i opis (fade-in), wyzwalane przez klasę `.reveal`.
- **KRYTYCZNE**: Artykuł „Siła chwytu” (12. w kolejności) wprowadził wzorzec długiego, angażującego tytułu na kafelkach: „Zaciśnij dłoń. Właśnie zrobiłeś ważniejszy test zdrowotny niż pomiar ciśnienia.”. Należy utrzymać ten standard dla tego wpisu we wszystkich sekcjach (Home, Porady, Zdrowie).
- Zmiany techniczne, SEO i wizualne nie powinny przypadkiem zmieniac sensu tresci.

## Ustalenia krytyczne 2026-03 (Moje Sukcesy)

- Znikanie "fistaszkow" traktujemy jako blad krytyczny i zabezpieczamy warstwowo:
  - backend: atomowy zapis kalendarza (`.tmp` + `rename`) i walidacja po zapisie,
  - admin: twarda diagnostyka niespojnosci w `admin/sync-manual.php`,
  - frontend: fallback self-heal (API) tylko gdy `userEntries.length === 0`.
- `admin/sync-manual.php` dziala w trybie `POST + CSRF` i ma synchronizowac:
  - kalendarz (`calendarRebuild`),
  - sitemap (`sitemapRebuild`),
  - oraz raportowac liczby po zapisie.
- `sitemapRebuild()` ma zwracac liczbe wpisow `/sukcesy/` i rzucac wyjatek przy bledzie zapisu.
- Media dla stron "Moje Sukcesy" i stron dnia:
  - primary URL: `https://fitpo50.pl/admin/uploads/...`,
  - fallback `onerror`: `https://admin.fitpo50.pl/uploads/...`,
  - dotyczy tez `og:image` (preferujemy domene glowna).
- W mobile landscape karuzela ma miec odchudzony profil:
  - `@media (max-width: 900px) and (orientation: landscape)`,
  - bardziej plaski ratio (`21/9`) i limit wysokosci (`max-height: 65vh`),
  - mniejsze kontrolki (strzalki/kropki), bez zmian JS.
- Admin login/header/form ma miec widoczne logo z fallbackiem do domeny glownej:
  - jesli lokalny asset nie wejdzie, podmieniamy `src` na `https://fitpo50.pl/assets/logo.jpg`.
- Skrypty instalacyjne (`init-db.php`, `init-hash.php`) sa domyslnie zablokowane na produkcji:
  - uruchamianie tylko przy `APP_ENV === 'dev'`,
  - token `CHANGE_ME` nigdy nie moze przejsc jako poprawny.
- Przy commitach produkcyjnych nie mieszamy plikow agenta i pamieci narzedzi:
  - pomijamy `.agent/*`, `.brainsync/*`, `.cursor/*`, `.windsurfrules`,
  - commitujemy tylko pliki z realna logika/aplikacja.

## Ustalenia krytyczne 2026-04-12 (Publikacja artykulow)

- **BEZWZGLEDNIE (GLOBALNIE)**: caly serwis (strona glowna, strony kategorii, strony zbiorcze i artykuly) utrzymujemy w standardzie:
  - `SEO -> AEO -> GEO -> AIO`.
- **BEZWZGLEDNIE**: kazdy nowy artykul i aktualizacja artykulu musi byc wykonana z zachowaniem kolejnosci i standardu:
  - `SEO -> AEO -> GEO -> AIO`.
- **BEZWZGLEDNIE**: w kazdym artykule musza byc zastosowane wyroznienia wizualne:
  - pogrubienia (`<strong>`),
  - italiki (`<em>`),
  - kolorowe akcenty tekstowe (np. klasy tonalne/callouty).
- **BEZWZGLEDNIE**: artykuly maja wygladac atrakcyjnie wizualnie, z celowym roznicowaniem typografii:
  - rozne wielkosci czcionek (naglowki, akcenty, leady, callouty),
  - rozne rodzaje czcionek (co najmniej font display + font body) w ramach wzorca projektu.
- Powyzsze zasady sa nadrzedne wobec starszego zapisu o "umiarkowanych wyroznieniach" i stosujemy je globalnie dla wszystkich artykulow.

## Ustalenia krytyczne 2026-04-14 (Doprecyzowanie publikacji)

- Dla NOWEGO artykulu:
  - `datePublished` i `article:published_time` ustawiamy na faktyczna date publikacji (dzien wdrozenia),
  - nie uzywamy daty draftu ani daty przygotowania materialu.
- `dateModified` i `article:modified_time` aktualizujemy przy kazdej istotnej zmianie merytorycznej.
- Kazdy claim liczbowy (np. `%`, liczba dni, ryzyko, wzrost/spadek) musi miec odpowiadajace zrodlo z URL w sekcji `Zrodla`.
  - Jesli brak pewnego zrodla, usuwamy liczbe albo opisujemy mechanizm bez twardej wartosci liczbowej.
- Publikacja artykulu jest zakonczona dopiero po pelnej synchronizacji:
  - plik artykulu,
  - odpowiednia strona kategorii,
  - `porady.html`,
  - `index.html` (`featured-article` + 3 kafelki `articles-grid-preview`),
  - `sitemap.xml`,
  - eksport do `_site`.
- W `porady.html` zawsze utrzymujemy spojność:
  - `numberOfItems` == liczba kart `data-article-item` == licznik `data-article-count`,
  - `data-order` pozostaje unikalne.
- Interlinking w tresci artykulu:
  - minimum 4 linki wewnetrzne osadzone kontekstowo w akapitach (nie tylko sekcja `Czytelnia`).

## Ustalenia krytyczne 2026-04-17 (Wizual premium artykulow)

- Standard wizualny artykulow jest trwale opisany w `MEMORY_PORADY.md` (sekcja: "Standard wizualny artykulu (obowiazuje od 2026-04-17)") i jest obowiazkowy przy nowych publikacjach oraz istotnych aktualizacjach.
- Wzorce referencyjne:
  - `powrot-do-formy-po-50-kompletny-przewodnik.html` (styl premium),
  - `trening-3x30-dla-50-plus.html` (tagi zasad/cwiczen, callouty, stack obrazow).
- W kazdym artykule wymagamy:
  - wyraznej hierarchii typografii (display + body + akcent),
  - kolorystycznych wyroznien fraz (klasy tonalne),
  - oznaczania sekwencji "Po pierwsze..." i "Cwiczenie X..." klasami wizualnymi,
  - separatorow i grupowania 2+ obrazow pod rzad (`.figure-stack`),
  - co najmniej 2 calloutow + mocnego cytatu koncowego.
- Zakaz "minimalnej surowej sciany tekstu" przy publikacjach poradnikowych: artykul ma byc merytoryczny i jednoczesnie wizualnie prowadzic czytelnika.

## Ustalenia operacyjne 2026-05-10 (Spójność head + niezawodność pipeline)

- Wprowadzony został centralny kontrakt `head` dla artykułów: `scripts/lib/article-head-contract.js`.
  - Reguły twarde:
    - `<title>` max 65 znaków,
    - blokada wzorca podwójnego separatora typu `– | FitPo50`,
    - `meta description` w zakresie 145-160 znaków,
    - `meta description` musi kończyć się pełnym znakiem końca zdania (`.`, `!`, `?`),
    - pełna spójność opisu: `meta description` == `og:description` == `twitter:description` == `BlogPosting.description`.
- Kontrakt `head` jest egzekwowany w:
  - `scripts/validate-article-standard.js`,
  - `scripts/predeploy-gate.js` (dla publikowanego `--slug`).
- Pipeline publikacji artykułu po imporcie uruchamia automatyczny sync opisów:
  - `scripts/sync-article-head-descriptions.js --slug <slug>`
  - cel: domknięcie spójności `meta/og/twitter/schema` bez ręcznych poprawek.
- Pipeline publikacji artykułu po imporcie uruchamia automatyczną regenerację:
  - `scripts/generate-llms-full.js`
  - cel: `llms-full.txt` jest zawsze aktualny po każdym nowym artykule z JSON, bez ręcznej kontroli.
- Dodany został regression check artykułu:
  - `scripts/article-contract-check.js` (kontrakt jakościowy),
  - `scripts/run-article-contract-diff.js` (uruchamiany tylko dla zmienionych `.html`),
  - `prepush:parallel:checks` obejmuje teraz `article:contract:diff`.
- Dodana telemetria czasu wykonania automatyzacji:
  - raport lokalny: `data/reports/local/pipeline-timings.json` albo sciezka z `FITPO50_PIPELINE_TIMINGS_PATH`,
  - źródła wpisów: `scripts/run-all-prepush.js` i `scripts/article-pipeline.js`,
  - cel: monitorowanie czasu kroków i dalsze skracanie cyklu publikacji.
  - raport timingow nie jest zrodlem prawdy dla SEO ani deployu i nie powinien brudzic statusu Git po poprawnym pushu.
- Utrzymujemy kierunek upraszczania operacyjnego:
  - usunięte aliasy `legacy:*` z `package.json`,
  - preferowane komendy bieżące: `article:pipeline`, `article:contract:diff`, `prepush:local`.

## Ustalenia operacyjne 2026-05-10 (Komendy szybkie do publikacji artykułu)

- Wprowadzony krok przyspieszający naprawę wejściowego JSON:
  - `node scripts/json-autofix-strict.js --file "<plik.fitpo50.json>" --map data/internal-link-map.json`
  - Cel: jednorazowo naprawić typowe blokery (martwe linki wewnętrzne, sync `faq_research`, `quick_answer` 40-60 słów, porządek `seo_title`, limit `key_takeaways`).

- Zalecana sekwencja „FAST PRECHECK” (przed pełnym pipeline):
  1. `node scripts/fix-fitpo50-json.js --file "<plik.fitpo50.json>" --write false --check true --allow-outside-repo true`
  2. `node scripts/json-autofix-strict.js --file "<plik.fitpo50.json>" --map data/internal-link-map.json`
  3. `node scripts/json-fitpo50-gate-diff.js --file "<plik.fitpo50.json>"`
  4. `node scripts/article-preflight.js --file "<plik.fitpo50.json>" --assets-dir "<folder-z-grafikami>"`

- Zalecana komenda publikacyjna (jedna komenda):
  - `node scripts/article-pipeline.js --file "<plik.fitpo50.json>" --category <ruch|jedzenie|zdrowie|ciekawe|mity> --assets-dir "<folder-z-grafikami>" --force true`

- Uwaga operacyjna:
  - `article-pipeline.js` uruchamia już automatycznie `json-autofix-strict` na kopii roboczej przed `json:gate`.
  - Słownik mapowania linków utrzymujemy w `data/internal-link-map.json` i rozszerzamy, gdy pojawiają się nowe nieistniejące slugi z draftów.

- Komendy walidacji po publikacji:
  - `node scripts/article-contract-check.js <slug>.html _site/<slug>.html`
  - `npm run predeploy:check`

- Komendy repo (przed push):
  - `./scripts/export_site.sh`
  - `npm run assets:mirror:sync`
  - `npm run predeploy:check`
  - alternatywnie: `npm run prepush:local`, jesli obejmuje ten sam zakres walidacji
  - dopiero potem `git push`.

## Ustalenia operacyjne 2026-05-30 (AIO / llms-full hard rule)

- `llms-full.txt` jest plikiem obowiązkowym i utrzymywanym automatycznie przez pipeline.
- Nie czekamy na ręczne dopisywanie treści przez redakcję ani Claude.
- Każdy nowy artykuł dodany przez JSON ma być automatycznie uwzględniony w `llms-full.txt`:
  - krok w `scripts/article-pipeline.js`: `Generate llms-full (auto-refresh)`,
  - krok w `scripts/export_site.sh`: `generate-llms-full.js --output _site/llms-full.txt`.
- Źródłem listy URL-i dla `llms-full.txt` jest `llms.txt` (sekcja `articles`), a treść jest pobierana z lokalnych plików `.html`.
- Standard operacyjny:
  - po imporcie artykułu nie robimy ręcznego sprawdzania JSON pod kątem `llms-full`,
  - pipeline ma wygenerować plik sam i nadpisać go deterministycznie.

## Ustalenia operacyjne 2026-05-17 (SEO sync + workflow hygiene)

- Tytuly w head i social maja byc spojne po imporcie:
  - `og:title` i `twitter:title` synchronizujemy do bazowego tytulu z `<title>` (bez suffixu `| FitPo50`),
  - warning gate o roznicy miedzy `<title>` a `og:title` / `twitter:title` traktujemy jako blad do natychmiastowej naprawy.

- `scripts/article-sync-pro.js` jest nowym narzędziem kanonicznym do synchronizacji SEO i listingów:
  - na etapie importu/synchronizacji źródłem prawdy są pola w roboczym `data/import/*.json`,
  - po udanej publikacji źródłem prawdy jest finalny HTML + assety + PDF + indeksy; roboczy JSON można usunąć z repo, szczególnie jeśli blokuje gate/push,
  - zalecany workflow: najpierw `--dry-run`, potem właściwy zapis,
  - unikamy ręcznej edycji tytułów, meta description, JSON-LD headline/description i tekstów kart listingowych bezpośrednio w HTML, jeśli zmiana może zostać wykonana przez ten skrypt.

  - Higiena workflow i eksportu:
  - eksport statyczny nie może kopiować `node_modules/` do katalogu wynikowego,
  - techniczne commity `[auto-sync] news status ...` z panelu NEWS nie powinny uruchamiać pełnych gate'ów publikacyjnych, bo są stanem pomocniczym procesu redakcyjnego, a nie docelowym publishem treści.

## Ustalenia operacyjne 2026-05-22 (auto-fix social title + BreadcrumbList)

- W `scripts/article-pipeline.js` po kroku importu uruchamiamy automatyczny krok:
  - `node scripts/sync-article-title-breadcrumb.js --slug <slug>`
- Krok jest obowiazkowy przed `article-contract-check` i ma zapewnic:
  - spojnosc `og:title` i `twitter:title` z `<title>` (porownanie do wersji bez `| FitPo50`),
  - obecne schema `BreadcrumbList` w source i `_site`.
- `BreadcrumbList` traktujemy jako element wymagany kontraktu artykulu:
  - brak = warning kontraktu, do poprawy przed statusem "gotowe".

## Ustalenia operacyjne 2026-05-18 (Publishing Policy Engine - domknięcie refaktoru)

- Centralny silnik publikacji jest już spięty wokół `scripts/lib/article-policy.js` jako Single Source of Truth:
  - `scripts/article-preflight.js`,
  - `scripts/import-article.js`,
  - `scripts/validate-article-standard.js`,
  - `scripts/predeploy-gate.js`,
  - `scripts/article-sync-pro.js`
  mają korzystać z reguł, parserów i walidatorów z `article-policy.js`, a nie z lokalnych hardkodów.

- `scripts/article-sync-pro.js` działa w trybie `fail-fast`:
  - import `./lib/article-policy` jest wymagany twardo,
  - brak polityki lub błąd jej ładowania ma zatrzymywać skrypt,
  - nie utrzymujemy już miękkich fallbacków typu własne limity `145-160` dla meta description poza `article-policy.js`.

- Reguły parserów i liczników pomocniczych też są scentralizowane:
  - `utils.normalizeInternalHtmlHref(...)`,
  - `utils.countInternalHtmlLinks(...)`,
  - `utils.collectRepeatedLongSentences(...)`
  są kanoniczne i mają być współdzielone przez preflight, importer i validator.

- Normalizacja linków wewnętrznych:
  - linki z `#hash` lub `?query` nie mogą być liczone jako osobne unikalne linki,
  - `porady.html` nadal jest pomijane w liczniku linków kontekstowych tam, gdzie logika SEO tego wymaga.

- `scripts/validate-article-standard.js` nie powinien trzymać własnych regexów dla dat ISO:
  - źródło prawdy to `POLICY.PATTERNS.ISO_DATE_TZ`.

- Minimalne testy regresyjne dla silnika publikacji są obowiązkowym szybkim checkiem po zmianach architektonicznych:
  - komenda: `npm run test:publishing-engine`
  - obecny pakiet testuje:
    - `validators.validateSeoDescriptionLength(...)`,
    - `utils.countInternalHtmlLinks(...)`,
    - `utils.collectRepeatedLongSentences(...)`,
    - dry-run `scripts/article-sync-pro.js`.

- Dokumentacja operacyjna:
  - `README.md` zawiera sekcję `Publishing Policy Engine` i opis przepływu:
    - `data/import/*.json -> article-preflight -> import-article -> validate-article-standard -> predeploy-gate -> publish`
  - jeśli zmieniamy architekturę tego łańcucha, aktualizujemy równolegle kod i README.

- Cleanup legacy:
  - usunięte martwe helpery w `scripts/validate-article-standard.js`:
    - `validateAsidePracticalValue()`
    - `validateBreadcrumbList()`
  - nie przywracamy ich bez realnego podpięcia do aktywnej ścieżki walidacyjnej.

- Domyślna kolejność pracy przy nowych artykułach i dużych poprawkach:
  - najpierw poprawiamy `data/import/*.json`,
  - potem uruchamiamy `article-preflight`,
  - dopiero później `import-article` / `article-pipeline`,
  - HTML, PDF, schema, listingi i `_site` traktujemy jako wynik,
  - ręczne poprawki HTML robimy dopiero na końcu i tylko wtedy, gdy problem dotyczy layoutu, osadzenia mediów albo finalnego szlifu redakcyjnego.

- JSON od modeli zewnętrznych (np. Claude) traktujemy jako draft wymagający normalizacji:
  - poprawki jakościowe, SEO, linkowanie, FAQ, Quick Answer, H2, źródła i copy wykonujemy najpierw w JSON,
  - celem jest, żeby większość pracy redakcyjnej była wykonana przed generowaniem HTML.
  - `article-preflight.js` ma jak najwcześniej łapać typowe pułapki z case`ów` wdrożeniowych:
    - brak / zła `category`,
    - `hero_image` podane z rozszerzeniem zamiast jako baza nazwy,
    - `seo_title` już zawierające `| FitPo50`,
    - brak jawnych pól `listing_title` / `listing_desc` (co najmniej jako warning operacyjny).
    - jeśli `--assets-dir` wskazuje zbyt szeroki katalog (np. całe `Downloads`), preflight ma podpowiadać właściwy podfolder z grafikami, jeśli znajdzie pliki poziom niżej.

- Ostatni refaktor silnika publikacji został zrobiony właśnie pod tę kolejność:
  - `article-preflight.js` sprawdza JSON i assety wejściowe,
  - `import-article.js` generuje HTML/PDF/schema według tej samej polityki,
  - `validate-article-standard.js` i `predeploy-gate.js` weryfikują finalny output,
  - `article-sync-pro.js` służy do późniejszych, kontrolowanych synców SEO/listingów bez ręcznego przeklejania zmian po HTML-ach.
  - dla nowych artykułów przed `git push` uruchamiamy pełny lokalny check:
    - `npm run article:final-check -- --file data/import/<slug>.fitpo50.json --assets-dir <folder-z-grafikami>`
    - ten skrypt ma wykrywać problemy wcześniej niż hook `pre-push`, bo odpala kolejno:
      - parse/fix JSON,
      - `json-autofix-strict`,
      - `json-fitpo50-gate-diff`,
      - `article-preflight`,
      - `prepare-article-assets`,
      - lokalny import z aktualizacją listingów,
      - `article-contract-check`,
      - `sync-site-assets-mirror`,
      - `predeploy-gate --slug`.

- Kontrakty anty-regresyjne po case `apob-norma-cena-jak-czytac-wynik`:
  - Hero consistency contract:
    - dla artykułu ten sam `hero_image` musi być użyty spójnie w:
      - preload hero,
      - `<picture><source ... .avif>`,
      - `<picture><source ... .webp>`,
      - fallback `<img ... .jpg>`,
      - `og:image`,
      - `twitter:image`,
      - `BlogPosting.image`.
    - `article-template-bento.html` NIE może mieć hardkodowanych `source srcset` typu `Hero_Porady1.*`; zawsze używa `{{HERO_IMAGE}}.*`.
    - `predeploy-gate.js` ma to sprawdzać dla artykułu po `--slug`.
  - Homepage Reading Room contract:
    - badge kategorii w `index.html -> renderReadingFallback()` musi zgadzać się z realną kategorią artykułu wynikającą z listingów kategorii / JSON-a źródłowego.
    - importer NIE może zgadywać `Ciekawe` dla „przesuwanego” kafelka; kategorię trzeba wyliczać po URL-u artykułu.
  - Listing read-time contract:
    - wszędzie w listingach i atrybutach pomocniczych używamy pełnego formatu `X min czytania`,
    - skrót `X min` jest błędem generatora i ma być łapany przez gate.

## Ustalenia operacyjne 2026-05-10 (AEO/GEO/E-E-A-T + IndexNow)

- `speakable` w artykulach i generatorze musi byc zawężony (bez szerokiego `.article-content p`):
  - dozwolony zestaw bazowy:
    - `.article-header__title`
    - `#quick-answer`
    - `#quick-answer p`
    - `.drop-cap`
    - opcjonalnie przy obecnym bloku: `.key-takeaways h2`, `.key-takeaways li`
  - źródło prawdy: `buildSpeakableSelectors()` w `scripts/import-article.js`.

- Quick Answer (standard wizualny, takze dla starych artykulow):
  - sekcja `#quick-answer` jest obowiazkowa i ma byc wyraznie wyrozniona (nie zwykly paragraf),
  - naglowek `Szybka odpowiedz` musi miec dolny akcent (krotka linia),
  - akapit podsumowania ma byc renderowany jako box (jasne tlo + obramowanie + lewy akcent + zaokraglenie),
  - przy retrofittingu starszych artykulow (gdy `quick-answer` jest poza `.article-content`) styl ma pozostac identyczny jak w nowych artykulach; źródło prawdy: `article.css` + `ARTICLE_STANDARD.md`.

- Hero + Share (standard wizualny, obowiazkowy dla nowych artykulow):
  - motto pod hero (`.hero-motto`) ma byc czytelne i eleganckie; bez fontu odrecznego,
  - pod hero obowiazkowy wrapper `.article-primary-actions` z 2 kaflami:
    - `Pobierz PDF` (`.pdf-hero-download`),
    - `Udostepnij` (`button#share-article-top.pdf-hero-download.pdf-hero-download--share`),
  - badge przy `Udostepnij` ma miec wyglad jak badge `PDF`, ale etykiete `SHARE`,
  - przed zrodlami obowiazkowa sekcja `section.share-article-section` z naglowkiem `Udostepnij artykul`,
  - sekcja share musi zawierac: Facebook, LinkedIn, WhatsApp, mail, kopiowanie linku.

- GEO: odchodzimy od niestandardowego `faq_research` w `BlogPosting` JSON-LD.
  - `faq_research` NIE jest publikowane do schema `BlogPosting`.
  - dowody naukowe publikujemy przez standardowe `citation` (lista URL) + `mentions`.
  - walidator `scripts/validate-article-standard.js` sprawdza teraz:
    - `BlogPosting.citation` min. 4 poprawne URL-e.

- GEO: `mentions` dla źródeł naukowych mają typ:
  - `@type: "ScholarlyArticle"` (zamiast `Thing`),
  - pola: `name`, `url`, opcjonalnie `datePublished` (pelny ISO), `author`.

- E-E-A-T: autor artykułu w `BlogPosting` jest osobą:
  - `author` = `Person` (`Grzegorz Kupiec`, `https://fitpo50.pl/o-mnie.html`, `sameAs`),
  - `publisher` pozostaje `Organization` (`FitPo50`).
  - w `head` utrzymujemy spójność:
    - `<meta name="author" content="Grzegorz Kupiec">`
    - `<meta property="article:author" content="Grzegorz Kupiec">`
  - szablon zaktualizowany: `article-template-bento.html`.

- Semantyka i jakość treści artykułu:
  - alt-y obrazów inline opisują scenę/grafikę (nie są kopią H2),
  - `aside.highlight-box` nie powtarza 1:1 zdań z akapitów; ma wnosić nową wartość praktyczną,
  - dodajemy `BreadcrumbList` JSON-LD dla artykułów działowych.

- FAQ edge-case:
  - kontrakt FAQ obsługuje zarówno `<details class="faq-item">`, jak i `<article class="faq-item">`
    (naprawiony przypadek regresji dla artykulow z FAQ jako `article`).

- IndexNow:
  - `scripts/import-article.js` wysyla ping po publikacji (`--publish true`) domyslnie z `--indexnow true`.
  - konfiguracja:
    - `INDEXNOW_KEY` (wymagane),
    - `INDEXNOW_KEY_LOCATION` (opcjonalne).
  - wymaganie produkcyjne: plik klucza musi byc publicznie dostępny pod:
    - `https://fitpo50.pl/<INDEXNOW_KEY>.txt`
  - bez `INDEXNOW_KEY` importer nie blokuje publikacji (status: pominieto).

- Komendy operacyjne (publikacja + IndexNow):
  1. `node scripts/import-article.js --file "<plik.fitpo50.json>" --publish true --run-internal-links auto --validate true`
  2. (opcjonalnie) wylaczenie pingu:
     - `node scripts/import-article.js --file "<plik.fitpo50.json>" --publish true --indexnow false`
  3. test lokalny z ENV:
     - `INDEXNOW_KEY="<key>" INDEXNOW_KEY_LOCATION="https://fitpo50.pl/<key>.txt" node scripts/import-article.js --file "<plik.fitpo50.json>" --publish true`

## Ustalenia operacyjne 2026-05-23 (GSC OAuth produkcyjne + workflow Downloads)

- Domyslna sciezka `GSC` zostaje utrzymana poza repo:
  - dane wejsciowe i raporty zapisywane do `~/Downloads/gsc-auto-input`,
  - bez fallbacku do `data/gsc` jako zrodla analizy.
- `scripts/gsc-auto-report.js` wykonuje teraz kolejnosc:
  1. probuje pobrac dane bezposrednio z GSC API,
  2. zapisuje CSV do `~/Downloads/gsc-auto-input`,
  3. uruchamia raport CSV,
  4. dopiero potem (awaryjnie) probuje artifact/ZIP.
- Walidacja CSV zostala uszczelniona:
  - wymagane sa 3 niepuste pliki (`queries.csv`, `pages.csv`, `query-pages.csv|query_pages.csv`),
  - same naglowki bez danych nie przechodza gate.
- `scripts/gsc-weekly-api-report.js` nie tworzy juz pustych CSV przy `missing_api_config`/`auth_failed`.
- OAuth app dla GSC jest ustawiona na `W wersji produkcyjnej` (typ uzytkownikow: `Z zewnatrz`),
  co eliminuje 7-dniowe zachowanie testowe dla nowych tokenow odswiezania.
- Operacyjnie: po wygasnieciu lub cofnieciu tokenu odswiezania odnawiamy tylko `GSC_OAUTH_REFRESH_TOKEN`
  (Client ID/Client Secret pozostaja stale, chyba ze wykonano ich rotacje).
- Test referencyjny po konfiguracji: `npm run gsc:auto` => PASS, zrodlo `GSC API`, output w `~/Downloads/gsc-auto-input`.
- `gsc:auto` automatycznie probuje wczytac lokalny plik `~/.fitpo50-gsc.env` (format `export KEY='value'`),
  dzieki czemu agent moze uruchamiac workflow `GSC` bez recznego `source` i bez przekazywania sekretow w rozmowie.
- `gsc:auto` po kazdym uruchomieniu wykonuje cleanup artefaktow roboczych w repo (`.tmp-gsc-auto-input`, `_site/.tmp-gsc-auto-input`, `data/gsc/pages.csv`, `data/gsc/queries.csv`, `data/gsc/query-pages.csv`, `data/gsc/query_pages.csv`), aby nie brudzic statusu Git.
- Przy niewaznym/wygaslym tokenie OAuth `gsc:auto` zwraca jasny komunikat `TOKEN_EXPIRED` z instrukcja odswiezenia `GSC_OAUTH_REFRESH_TOKEN`.

## Ustalenia operacyjne 2026-05-23 (GSC tylko raport, bez napraw)

- Komenda `GSC` działa w trybie twardym `READ-ONLY REPORT MODE`.
- Cel `GSC`: wyłącznie raport i plan działań w `~/Downloads`, bez zmian w repo.
- Dla `GSC` agent ma zakaz:
  - edycji plików projektu,
  - uruchamiania importerów/pipeline publikacyjnych,
  - commit/push.
- Obowiązkowa kolejność analizy:
  1. globalna Skuteczność (kliknięcia/wyświetlenia/CTR/pozycja + porównania okresów),
  2. zapytania,
  3. strony,
  4. indexacja,
  5. experience (CWV/mobile/HTTPS),
  6. linki,
  7. lista TO DO z priorytetami.
- Przed rekomendacjami agent musi przeczytać aktualny stan treści w repo (`*.html`, `porady.html`, kategorie, `sitemap.xml`) i mapować query do realnych URL-i.
- `scripts/gsc-auto-report.js` domyślnie nie wykonuje cleanupu repo (brak modyfikacji repo w trybie raportowym).
  Cleanup artefaktów repo jest tylko opcjonalny przez `--cleanup-repo-artifacts` lub `GSC_CLEAN_REPO_ARTIFACTS=true`.

## Ustalenia operacyjne 2026-05-25 (AEO pod Google/Gemini)

- Priorytet AEO dla nowych artykułów: optymalizujemy głównie pod ekosystem Google (`Gemini` + `AI Overviews`), bez rezygnacji z jakości pod inne źródła AI.
- Na poziomie JSON (`.fitpo50.json`) obowiązkowo:
  - `quick_answer` jako jasna, konkretna odpowiedź na początku (2-4 zdania, z zachowaniem limitów z `article-policy.js`),
  - krótkie i konkretne pierwsze akapity pod H2 (bez „lania wody”),
  - FAQ oparte o realne intencje użytkowników (autocomplete/PAA/GSC), nie generyczne pytania.
- Dane strukturalne utrzymujemy bez wyjątków:
  - `BlogPosting`, `FAQPage`, `BreadcrumbList`, `speakable`,
  - pełne daty ISO 8601 (`datePublished`, `dateModified`, `article:published_time`, `article:modified_time`),
  - kontrakt spójności opisu SEO 1:1.
- E-E-A-T:
  - minimum 4 realne URL-e źródeł medycznych/naukowych w `citation`,
  - czytelny autor (`Person`) i aktualizacja `dateModified` przy każdej istotnej zmianie merytorycznej.
- Monitoring wejść AI:
  - decyzje contentowe opieramy na realnym trendzie ruchu źródeł (ChatGPT/Gemini/Perplexity) w GA4/referrer, a nie wyłącznie na trendach globalnych.

## Ustalenia operacyjne (2026-05-31) - GSC, klikalnosc i popraw-json

- **`dodaj artykul` = workflow JSON-first (doprecyzowanie 2026-06-15):**
  - Polecenia `dodaj artykul`, `dodaj artykuł` i `opublikuj artykul` oznaczaja najpierw prace skillem `popraw-json`.
  - JSON z `~/Downloads` traktuj jako wsad/draft, a nie trwale zrodlo po publikacji.
  - Najpierw doprowadz JSON do statusu `content-ready`: SEO, quick answer, FAQ/`faq_research` 1:1, linki, zrodla, sekcje i pola obrazow.
  - Dopiero potem przygotuj/przerob assety PNG -> AVIF/WebP/JPG i generuj HTML.
  - Przed generowaniem HTML porownaj zalaczone obrazy z opisami/polami obrazow w JSON; jesli obraz nie pasuje albo brakuje wymaganego ujecia, STOP.
  - Przy STOP obrazowym powiedz, ktorego obrazu brakuje, wyciagnij prompt/opis z JSON i popros usera o wygenerowanie oraz zalaczenie nowego pliku; po dolaczeniu kontynuuj pipeline od miejsca zatrzymania.
  - Jesli blad zostanie wykryty dopiero na etapie HTML, nie cofaj sie do edycji pliku JSON z Downloads, chyba ze user wyraznie poprosi; napraw generator/template/HTML albo kopie robocza pipeline.
  - Celem jest brak bledow HTML dzieki dobremu JSON przed importem.
  - Nie sprzataj automatycznie prywatnych JSON-ow usera z `~/Downloads`; user sam je usuwa po publikacji.

- **Komenda `GSC` (domyslny workflow):**
  - Traktuj polecenie `GSC` jako uruchomienie pelnego workflow raportowego, nie tylko pojedynczy skrypt pomocniczy.
  - Start od kroku technicznego i aktualizacji danych.
  - Preferuj auto-pobranie danych; gdy auto-pobranie sie nie uda, popros uzytkownika o reczne zapisanie CSV do katalogu roboczego i kontynuuj po dostarczeniu plikow.

- **Dane do raportu GSC - rozdzielenie celu:**
  - Optymalizacja istniejacych artykulow: opieraj decyzje o priorytetach glownie na danych projektowych (GSC/GA4/referrer).
  - Propozycje nowych artykulow: nie ograniczaj sie do lokalnych CSV; stosuj tryb globalny i tematyczny (intencje realnych zapytan z sieci).
  - Dla nowych artykulow lokalne CSV nie sa jedynym ani nadrzednym zrodlem idei.

- **Nowy standard propozycji tresci (dual mode):**
  - W raporcie podawaj dwa strumienie rekomendacji:
    - `Na bazie danych projektu` (istniejace URL-e, CTR gap, pozycje 4-20),
    - `Na bazie sygnalow globalnych` (tematyczne intencje: jedzenie/ruch/zdrowie/ciekawe).
  - Rozdzielaj wyraznie oba strumienie, zeby nie mieszac priorytetow.

- **Anty-regresja klikalnosci (globalne reguly redakcyjne):**
  - Zakazane generyczne leady typu „Szybka odpowiedz” bez konkretu.
  - Zakazane powtarzalne, puste FAQ i duplikaty pytan.
  - Tytuly i opisy maja byc konkretne, intencyjne i niegeneryczne.
  - FAQ ma byc budowane z realnych zapytan i intencji, nie z placeholderow.

- **FAQ oparty o realne dane - zasada twarda:**
  - FAQ ma odzwierciedlac pytania, ktore ludzie faktycznie wpisuja (autocomplete/PAA/GSC w trybie hybrydowym).
  - Dla nowych artykulow domyslnie stosuj tryb globalny (`global_only`) z opcja `hybrid`.

- **`popraw-json` - zakres obowiazkowy przy nowym JSON:**
  - Uruchamiaj autofix + gate przed uznaniem pliku za gotowy.
  - Pilnuj: `quick_answer` (jakosc i limit), FAQ 1:1 z `faq_research`, odpowiedzi FAQ w zakresie polityki, linkowanie kontekstowe, jakosc zrodel.
  - Dla `faq_research` odrzucaj zrodla generyczne i nietematyczne.

- **Porzadek artefaktow tymczasowych:**
  - Pliki tymczasowe i jednorazowe wyniki nie powinny byc stale gromadzone.
  - Zachowuj tylko finalne artefakty wymagane biznesowo; reszte usuwaj po zakonczeniu zadania.

- **Status wdrozenia (zrobione):**
  - Zaostrzone walidacje i autofix JSON pod AEO/CTR.
  - Wzmocniony skill `popraw-json` o global-first FAQ i zasady quality gate.
  - Dodane reguly anty-generyczne dla quick answer / FAQ / tytulow.

## Ustalenia operacyjne (2026-06-15) - centra sterowania automatyzacja

- **Nowe centra sterowania sa preferowanymi entrypointami:**
  - Artykuly/import: `npm run article:manager -- import --file "<plik.fitpo50.json>" --category <kategoria>`.
  - Walidacja: `npm run article:validate:center -- <standard|contract|schema|reading-room|fast|final|publish-guard> ...`.
  - Metadata: `npm run article:meta:sync -- full --slug <slug>`.
  - PDF: `npm run article:pdf:builder -- --slug <slug>`.
  - Prepush/predeploy: `npm run prepush:checks -- <local|parallel|diff|deploy|strict>`.
  - GSC/SEO: `npm run gsc:tool -- <auto|api|csv|priority-map|watchdog|command-center|apply-wave>`.
- **Zasada migracji:** stare skrypty zostaja tymczasowo jako aliasy kompatybilnosci. Po kilku poprawnych publikacjach/pushach przygotuj ich usuniecie albo zamiane na cienkie aliasy, zeby automatyzacja nie rozrosla sie w balagan.

## Ustalenia operacyjne (2026-06-01) - Quick Answer v2 + backlog legacy

- **Quick Answer v2 (standard twardy dla nowych artykulow):**
  - Obowiazuje zakres `45-70` slow.
  - Quick Answer musi zawierac liczbe albo warunek (`jesli`, `gdy`, `kiedy`, `u osob po 50`, `przy wyniku`).
  - Zakazane sa generyczne frazy (lista w `scripts/lib/article-policy.js`).
  - Dla nowych publikacji naruszenie reguly Quick Answer = `FAIL` (blokada publikacji).

- **Legacy backlog (stare artykuly):**
  - Stare artykuly z niezgodna Quick Answer trafiaja do backlogu naprawczego, a nie do globalnej blokady deployu.
  - Raport backlogu uruchamiaj przez: `npm run quick-answer:backlog`.
  - Fale naprawcze utrzymujemy w modelu: `1/2/3` (priorytetyzacja URL-i).

- **Kanoniczne punkty walidacji Quick Answer:**
  - `scripts/article-preflight.js` (check na etapie JSON, przed importem HTML),
  - `scripts/validate-article-standard.js` (check po stronie finalnego HTML, z trybem legacy backlog),
  - `scripts/predeploy-gate.js` (ostatni gate przed publikacja).

- **Status wdrozenia 2026-06-01:**
  - Backlog Quick Answer wyczyszczony do `fail=0` (`fixed=74`) wedlug raportu `data/reports/quick-answer-backlog.json`.

## Ustalenia operacyjne (2026-06-04) - GSC Priority Map + AI Visibility

- Workflow `GSC` ma za kazdym razem generowac mape priorytetow dla wszystkich publicznych stron, nie tylko dla TOP kilku artykulow z raportu:
  - komenda: `npm run gsc:priority-map`,
  - raporty: `gsc-priority-map.md` i `gsc-priority-map.json`,
  - domyslny katalog: `~/Downloads/gsc-auto-input`,
  - zrodla danych: `sitemap.xml` + root HTML + `queries.csv` + `pages.csv` + `query-pages.csv`.
- `gsc:auto` po tygodniowym raporcie CSV uruchamia tez `gsc-priority-map`, aby nowe artykuly bez danych GSC trafialy do kolejki `P1_NO_GSC_DATA_BUILD_DISCOVERY`.
- Priorytetyzacja ma obejmowac:
  - `P0_NEAR_PAGE_ONE` - URL-e z pozycja 4-20 i wyswietleniami; wzmacniamy linkami, snippetem, FAQ/AEO,
  - `P1_GROWTH` - URL-e z pozycja 20-50; rozbudowa intencji i klastra linkow,
  - `P1_NO_GSC_DATA_BUILD_DISCOVERY` - nowe/brak danych; linkowanie z klastrow i zgloszenie targetu + zrodel w GSC,
  - `P2/P3` - utrzymanie i monitoring.
- Raport musi wskazywac dla kazdego URL-a: fraze glowna, frazy wspierajace, intencje, sugerowane miejsca linkow, anchor i liste URL-i do zgloszenia w GSC po zmianie.
- Raport `gsc-priority-map` ma zawierac pelne portfolio, a nie tylko TOP 20:
  - `Full Coverage Table` - wszystkie publiczne URL-e z sitemap/root HTML,
  - `All-Keyword Registry` - pelna lista query z GSC dla kazdego URL-a,
  - `Dormant Articles` - URL-e bez danych GSC,
  - `Low Visibility Articles` - URL-e z pozycjami long-tail/slaba widocznoscia,
  - `Leaders / Winners` - URL-e z kliknieciami lub bardzo dobra pozycja,
  - `Refresh Impact` - `dateModified`, baseline GSC i plan kontroli 7/14/28 dni,
  - `Editorial Decision` - decyzja dla kazdego URL-a: promowac, odswiezyc i linkowac, zbudowac widocznosc, linkowac, monitorowac albo support.
- Raport musi wyciagac wnioski z obecnego i poprzedniego okresu GSC:
  - `gsc:auto` zapisuje obecne i poprzednie dane dla `queries`, `pages` oraz `query-pages` jako CSV w `~/Downloads/gsc-auto-input`,
  - `Performance Delta 90d vs Previous 90d` porownuje obecne 90 dni z poprzednimi 90 dniami,
  - wnioski operacyjne: `WINNER_SCALE`, `DECLINING_REFRESH`, `CTR_DROP`, `POSITION_GAIN_NO_CLICKS`, `NEW_VISIBILITY`, `DORMANT`, `STABLE_MONITOR`, `NO_PREVIOUS_URL_DATA`,
  - dla kazdego URL-a raport pokazuje zmiany klikniec, wyswietlen, CTR, pozycji oraz najmocniejsze zmiany query.
- Raport musi wskazywac miejsca promocji adresow po zmianach:
  - `Google Search Console` - URL Inspection dla targetu i stron zrodlowych, z ktorych dodano linki,
  - `Internal links` - kontekstowe linki z artykulow-klastrow, bez spamowania listingow,
  - `Sitemap / deploy` - URL w sitemap.xml oraz aktualne `dateModified` po wdrozeniu,
  - `llms.txt / llms-full.txt` - obecnosc tresci dla crawlerow AI i systemow AIO,
  - `IndexNow / Bing` - dla nowych, dormant lub no-data URL-i, jesli konfiguracja jest aktywna.
- Nad mapa priorytetow dziala `SEO -> AEO -> GEO -> AIO Command Center`:
  - komenda: `npm run seo:aio:machine`,
  - `gsc:auto` uruchamia ja automatycznie po `gsc-priority-map`,
  - raporty: `seo-aio-command-center.md/json`, `gsc-change-queue.json`, `gsc-submit-queue.txt`,
  - raport ma tworzyc rozlaczne fale pracy: szybkie wejscie na pierwsza strone, discovery dla nowych/usypionych URL-i, refresh GEO/AIO, skalowanie liderow i strony wspierajace,
  - dla kazdej karty ma byc: score SEO/AEO/GEO/AIO, lista zadan redakcyjnych, sugerowane linki zrodlowe, kolejka GSC, komendy walidacji i plan pomiaru 7/14/28 dni,
  - strony wspierajace (`index`, kategorie, `porady`, `polityka-prywatnosci`, `o-mnie`, `dziennik`, `search`) nie moga dostawac sztucznych zadan FAQ/GEO jak artykuly; ich rola to linkowanie, CTR i dystrybucja mocy do artykulow.
- Nad `GSC/SEO Command Center` dziala osobne centrum wzrostu `fitpo50-growth`:
  - komenda glowna: `npm run growth -- <komenda>`,
  - raport glowny: `npm run growth:report`,
  - widocznosc AI: `npm run growth:audit-ai`,
  - test widocznosci AI: `npm run growth:ai-visibility-test`,
  - entity graph GEO/AIO: `npm run growth:entities` zapisuje tez `data/entities.json`,
  - structured data score: `npm run growth:structured-score`,
  - quick answer quality score: `npm run growth:quick-answer-score`,
  - topical authority map: `npm run growth:topical-map`,
  - llms check: `npm run growth:llms-check`,
  - Perplexity monitor: `npm run growth:perplexity-monitor`; bez `PERPLEXITY_API_KEY` generuje kolejke i status `INSUFFICIENT_API_KEY`, bez zgadywania wynikow,
  - sprint odswiezania z GSC: `npm run growth:gsc-refresh`,
  - Evidence Box / medyczne boxy bezpieczenstwa: `npm run growth:evidence-plan`,
  - huby tematyczne: `npm run growth:hubs`,
  - assety do link earningu: `npm run growth:link-assets`,
  - autopilot planu bez zapisu: `npm run growth:autopilot`,
  - skrot uzytkownika do calej maszyny: `npm run popraw-seo`,
  - `popraw-seo` uruchamia komplet raportow growth i konczy statusem `AWAITING_USER_APPROVAL`; raport ma zawierac paczke `BOOST` (strony blisko wzrostu) i `NAPRAWA` (strony slabe/brak widocznosci),
  - agent ma czekac na decyzje typu `popraw BOOST 1` albo `popraw BOOST 1 NAPRAWA 2`; przy samych numerach musi doprecyzowac ID, jesli istnieje ryzyko pomylenia koszykow,
  - walidacja wzrostowa: `npm run growth:verify`,
  - bezpieczny edytor domyslnie dry-run: `npm run growth:apply:dry -- --file <plik.html> --evidence-box --doctor-box`,
  - zapis wymaga jawnej komendy `npm run growth:apply -- --file <plik.html> ...`,
  - `growth:apply` nie moze przepisywac calych artykulow, usuwac sekcji ani zmieniac sensu; wolno mu dodawac tylko zarzadzane bloki i aktualizowac `dateModified`,
  - raporty `growth` sa robocze i domyslnie zapisywane poza repo w `~/Downloads/fitpo50-growth-reports`; alternatywnie mozna ustawic `FITPO50_GROWTH_REPORT_DIR`,
  - w repo nie trzymaj jednorazowych raportow `growth`; wyjatkiem moze byc trwaly artefakt semantyczny `data/entities.json`, jesli ma sluzyc kolejnym narzedziom.
- Po `GSC` dziala tez autopilot wdrozeniowy fal:
  - komenda propozycji: `npm run seo:aio:apply-wave -- --wave 1 --limit 5`,
  - `gsc:auto` uruchamia propozycje fali 1 automatycznie po Command Center,
  - raporty: `seo-aio-wave-proposal.md/json` i `seo-aio-wave-gsc-submit.txt`,
  - domyslnie autopilot nie edytuje artykulow; status ma byc `AWAITING_USER_APPROVAL`,
  - wdrozenie wymaga osobnej, jawnej zgody i komendy z potwierdzeniem: `--apply true --mode safe-links --confirm APPLY_WAVE`,
  - tryb `safe-links` moze dodawac tylko linki kontekstowe z raportu oraz aktualizowac `dateModified`; wieksze zmiany tresci, zrodel, FAQ i claimow medycznych wymagaja osobnej decyzji redakcyjnej.
- Badanie widocznosci AI jest czescia raportu:
  - jesli istnieje `referrers.csv`, monitoruj wejscia z `chatgpt.com`, `gemini.google.com`, `perplexity.ai`, `claude.ai`, `copilot.microsoft.com`, `bing.com`,
  - jesli istnieje `ai-visibility-checks.csv`, monitoruj reczne testy promptow: model, prompt, cytowany URL, wynik,
  - przy braku danych oznacz `INSUFFICIENT_DATA`, bez zgadywania.
- Jesli `GSC` lub `gsc:auto` zwroci `TOKEN_EXPIRED`, agent musi podac prosta instrukcje odswiezenia tokenu:
  - otworz `https://developers.google.com/oauthplayground`,
  - wlacz `Use your own OAuth credentials`,
  - uzyj lokalnych `GSC_OAUTH_CLIENT_ID` i `GSC_OAUTH_CLIENT_SECRET` z `~/.fitpo50-gsc.env`,
  - zakres: `https://www.googleapis.com/auth/webmasters.readonly`,
  - wykonaj `Authorize APIs` i `Exchange authorization code for tokens`,
  - podmien tylko `GSC_OAUTH_REFRESH_TOKEN` w `~/.fitpo50-gsc.env`,
  - uruchom ponownie `npm run gsc:auto`,
  - nie pros uzytkownika o wklejanie sekretow ani tokenow w rozmowie.

## Ustalenia operacyjne (2026-06-04) - Quality Gates SEO -> AEO -> GEO -> AIO

- **Cel bramek:** nowe artykuly i duze fale zmian maja wzmacniac kolejnosc `SEO -> AEO -> GEO -> AIO`, bez obnizania standardu redakcyjnego FitPo50.
- **Nowe artykuly - twarde wymagania (`FAIL` przy naruszeniu):**
  - `Keyword Mapping Gate`: kazdy nowy artykul musi miec zdefiniowana fraze glowna, 3-8 fraz wspierajacych oraz intencje (`how-to`, `normy`, `bezpieczenstwo`, `objawy`, `definicja`, `porownanie` albo `informacyjna`).
  - `AEO Answer Gate`: `quick_answer` musi odpowiadac na realna intencje uzytkownika, zawierac konkret/warunek/liczbe zgodnie z Quick Answer v2 i nie moze byc generyczna.
  - `FAQ Data Gate`: FAQ musi wynikac z realnych pytan (`faq_research`, GSC, PAA/autocomplete albo udokumentowane manual research); pytania generyczne lub duplikaty blokuja publikacje.
  - `Internal Link Intent Gate`: linki kontekstowe musza byc semantycznie zgodne z tematem artykulu i anchor ma opisywac intencje, nie tylko zawierac slowo kluczowe.
  - `GEO Citation Gate`: zrodla/citation musza wspierac konkretne claimy, szczegolnie medyczne/liczbowe; lista zrodel nie moze byc dekoracyjna.
  - `AIO Readiness Gate`: artykul musi miec komplet pod AI extraction: `BlogPosting`, `FAQPage` (jesli FAQ istnieje), `BreadcrumbList`, `speakable`, aktualne `llms-full.txt`, czytelny `quick_answer` i E-E-A-T autora.
  - `Refresh Metadata Gate`: kazda istotna zmiana tresci wymaga aktualizacji `article:modified_time` i `BlogPosting.dateModified` w source oraz `_site`.
- **Duze fale GSC - wymagania operacyjne:**
  - Fala moze obejmowac wiele stron naraz, ale musi byc klastrowa: wspolny temat, wspolna intencja albo wspolny problem z GSC.
  - Przed wdrozeniem fali agent ma przeczytac `gsc-priority-map.md/json` i wybrac targety + zrodla linkow z danych, nie z intuicji.
  - Po wdrozeniu fali obowiazkowe sa: walidatory zmienionych artykulow, `npm run seo:crawl`, `npm run assets:mirror:sync`, `npm run predeploy:check`, aktualizacja `dateModified` i lista URL-i do GSC.
  - Po kazdej fali agent ma zapisac/odswiezyc `gsc-priority-map` i wskazac plan kontroli efektow po 7/14/28 dniach.
- **Stare artykuly / legacy - nie blokujemy calego deployu:**
  - Braki w starych artykulach (np. brak pelnych danych GSC, slabsze FAQ, historyczne warningi social image/title) traktuj jako `WARN/ACTION`, chyba ze naruszaja twarde gate techniczne, medyczne lub kontrakt publikacyjny.
  - Artykuly bez danych GSC nie sa pomijane: trafiaja do `P1_NO_GSC_DATA_BUILD_DISCOVERY` i dostaja propozycje slow kluczowych, linkowania oraz decyzje redakcyjna.
- **Zasada decyzyjna dla agentow:** raport nie jest artefaktem koncowym. Po `GSC` agent ma przejsc od raportu do priorytetow, planu fali, wdrozenia, walidacji, listy URL-i do GSC i planu pomiaru efektow.
