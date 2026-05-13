# Project Memory

## Project goal
- FitPo50 to serwis z praktyczna wiedza dla osob 50+ o ruchu, jedzeniu, zdrowiu i wybranych tematach lifestyle / ciekawostkach.
- Celem projektu jest latwa, wiarygodna i spojna publikacja tresci.
- Jednym z kluczowych elementow projektu jest stabilny i przewidywalny modul "Moje Sukcesy".

## Architecture rules
- 4 filary tresci: `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`.
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
- Standard językowy: nagłówki techniczne są po angielsku, treść dokumentacji po polsku, a taski, review i rozmowy z agentami prowadzimy po polsku. Nazwy plików, ścieżek, komend, kluczy konfiguracyjnych i elementów technicznych zostają w oryginalnym brzmieniu.

## Critical files / areas
- `_site/` - publiczny output do deployu
- `porady.html` - zbiorcza strona artykulow
- `rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html` - 4 filary tresci
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

- **Bezpieczenstwo i znane ograniczenie:**
  - Do czasu naprawy helpera PHP, uruchamiaj import z:
    - `--run-internal-links auto`
  - Zasada: gdy JSON nie zawiera linkow kontekstowych, importer uruchamia auto-linking po imporcie i przed walidacja.

- **Komenda publikacyjna (zalecana):**
  - `node scripts/import-article.js --file "<sciezka/do/pliku.fitpo50.json>" --publish true --run-internal-links auto --validate true`

## Ustalenia operacyjne (2026-05-01) - szybki pipeline + twarda kontrola FAQ (SEO/AEO/GEO/AIO)

- **Jedna komenda publikacyjna (szybciej, bez pomijania kontroli):**
  - `node scripts/article-pipeline.js --file "<sciezka/do/pliku.fitpo50.json>" --category <ruch|jedzenie|zdrowie|ciekawe> --force <true|false>`
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
- Dodatkowy sync mirror:
  - `assets/pdf/*` -> `_site/assets/pdf/*`,
  - opublikowane miniatury NEWS z `assets/news/*` -> `_site/assets/news/*`,
  - `data/news-live.json` <-> `_site/data/news-live.json`,
  - `assets/data/news-fallback.json` <-> `_site/assets/data/news-fallback.json`.
- `prepush:local` najpierw wykonuje `assets:mirror:check`, dopiero potem wszystkie gate/checki.
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
    - najpierw `npm run predeploy:check`,
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
  - strony kategorii (`rusz-sie.html`, `jedzenie.html`, `zdrowie.html`, `ciekawe.html`) maja byc wizualnie i funkcjonalnie zgodne z wzorcem z `porady.html`,
  - ten sam standard meta czasu czytania, CTA i paginacji `WRÓĆ/DALEJ`,
  - po zmianach w CSS/HTML pilnujemy wersjonowania assetow (`?v=`), zeby cache nie maskowal efektu.
  - na stronie glownej (`index.html`) 4 kafelki wejscia do kategorii (Ruch/Jedzenie/Zdrowie/Ciekawe) maja stale, recznie przypisane zdjecia ilustrujace kategorie; te obrazy nie sa rotowane ani podmieniane automatycznie przez zadne skrypty (news/faq/czytelnia).
  - tryb nocny tla na mobile (telefon): utrzymujemy spojnie na `index.html`, `o-mnie.html` i wszystkich przyszlych stronach przebudowywanych na nowym wzorcu Bento; na desktopie domyslnie zostaje jasne tlo (chyba ze zapadnie osobna decyzja).
- **Spojnosc kolorow etykiet kategorii:**
  - mapowanie kolorow etykiet jest stale na wszystkich listach/kafelkach,
  - nie dodajemy inline kolorow sprzecznych z mapowaniem kategorii.
  - standard mapowania (obowiazkowy we wszystkich sekcjach "Czytelnia", karuzelach i listach):
    - `Ruch` -> `#2f6f99` (niebieski), tekst `#ffffff`,
    - `Jedzenie` -> `rgba(201, 109, 49, 0.94)`, tekst `#ffffff`,
    - `Zdrowie` -> `rgba(228, 188, 74, 0.96)`, tekst `#4e3a04`,
    - `Ciekawe` -> `rgba(67, 149, 84, 0.94)`, tekst `#ffffff`.
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
- Tabele robimy standardowym `table` wewnatrz `.article-content`
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
- Dodany został regression check artykułu:
  - `scripts/article-contract-check.js` (kontrakt jakościowy),
  - `scripts/run-article-contract-diff.js` (uruchamiany tylko dla zmienionych `.html`),
  - `prepush:parallel:checks` obejmuje teraz `article:contract:diff`.
- Dodana telemetria czasu wykonania automatyzacji:
  - raport: `data/reports/pipeline-timings.json`,
  - źródła wpisów: `scripts/run-all-prepush.js` i `scripts/article-pipeline.js`,
  - cel: monitorowanie czasu kroków i dalsze skracanie cyklu publikacji.
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
  - `node scripts/article-pipeline.js --file "<plik.fitpo50.json>" --category <ruch|jedzenie|zdrowie|ciekawe> --assets-dir "<folder-z-grafikami>" --force true`

- Uwaga operacyjna:
  - `article-pipeline.js` uruchamia już automatycznie `json-autofix-strict` na kopii roboczej przed `json:gate`.
  - Słownik mapowania linków utrzymujemy w `data/internal-link-map.json` i rozszerzamy, gdy pojawiają się nowe nieistniejące slugi z draftów.

- Komendy walidacji po publikacji:
  - `node scripts/article-contract-check.js <slug>.html _site/<slug>.html`
  - `npm run predeploy:check`

- Komendy repo (przed push):
  - `npm run prepush:local`
  - dopiero potem `git push`.

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
