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

## Open questions
- Czy utrzymujemy dodatkowe domeny/staging w CORS dla API kalendarza?
- Czy rozszerzamy automatyczne testy synchronizacji (rollback + spojnosc JSON/sitemap)?

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

## Detailed reference

## Podzial pamieci modulowej

- Glowny plik (`PROJECT_MEMORY.md`) zawiera zasady przekrojowe i wspolne.
- Szczegoly dla modulow trzymamy osobno:
  - `MEMORY_PORADY.md` - klasyczne artykuly i czytelnia `porady.html`.
  - `MEMORY_MOJE_SUKCESY.md` - kalendarz oraz strony dnia `sukcesy/YYYY-MM-DD.html`.
- Zasada pracy:
  - gdy zadanie dotyczy `Porady`, czytamy i stosujemy `MEMORY_PORADY.md`,
  - gdy zadanie dotyczy `Moje Sukcesy`, czytamy i stosujemy `MEMORY_MOJE_SUKCESY.md`,
  - nie mieszamy logiki miedzy modulami.

## Zasady ogolne

- Zachowujemy obecny kierunek serwisu: praktyczny, czytelny, bez nadmiaru ozdobnikow.
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

- W headerze artykulu pokazujemy tylko:
  - dzial
  - czas czytania
- Nie pokazujemy widocznej daty publikacji lub aktualizacji na gorze artykulu.
- Daty moga byc obecne tylko w SEO i schema.
- Uklad artykulu ma byc spojny z istniejacym standardem wizualnym.
- **Sekcja „Czytaj również”:** Na dole każdego artykułu (nad footerem) zawsze dodajemy sekcję o klasie `porady-preview section-padding`. 
  - Musi ona zawierać nagłówek ze snem `section-header__label` o treści „Czytelnia” oraz tytuł `section-header__title` o treści „Najnowsze Porady i Artykuły”.
  - Poniżej znajdują się dokładnie 3 kafelki w jednym rzędzie (grid 3-kolumnowy).
  - Każdy kafelek musi zawierać: zdjęcie (picture), kategorię, czas czytania, tytuł (h4), krótki opis oraz przycisk „Czytaj artykuł ->”.

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
- Jesli w innych artykulach jest stosowane `article:author`, utrzymujemy ten sam wzorzec.

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
  - Liczba artykułów: 17 (uklad: Ruch, Jedzenie, Zdrowie, Ciekawe)
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
  - **Linkowanie wewnętrzne (Interlinking)**: W treści artykułu stosujemy maksymalnie 4 linki do innych artykułów wewnątrz serwisu. Linkujemy słowa kluczowe naturalnie występujące w tekście, nie zmieniając jego brzmienia (np. słowo „siłownia” staje się linkiem do artykułu o tym, jak zacząć).

## Kafelki i linkowanie artykulow

- Na stronie glownej uzywamy pelnych kart promocyjnych.
- Na stronach kategorii uzywamy kompaktowych kafelkow bez zdjec.
- Kafelki na jednej stronie kategorii musza byc graficznie spojne.
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

- Sekcja "Najnowszy Artykul" pod BIO promuje najnowszy wpis.
- Przy nowym artykule trzeba rozwazyc podmiane tej sekcji na swiezsza tresc.

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

- `porady.html` to czytelnia i glowny katalog wszystkich artykulow (obecnie równo 17 artykulow). Zlote zasady:
  1. **Zgodność liczników i warstwy SEO**: Licznik w HTML (np. `data-article-count`), rzeczywista liczba kafli na stronie oraz deklaracja wpisów w sekcji `<script type="application/ld+json">` (elementy `"numberOfItems"` oraz ich `"position"`) MUSZĄ się zawsze zgadzać co do sztuki. Jeśli oddajesz nowy artykuł, dopisz go na pozycję nr 1 w schemacie JSON-LD i wymuś przesunięcie pozostałych układów.
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
  - sekcje featured na `index.html` (jesli nowy wpis jest najnowszy).
- Dla nowych obrazow:
  - generuj `webp` (i `avif`, jesli ma sens),
  - zostaw fallback `png/jpg`,
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

Jesli artykul ma obrazy:

1. generujemy lub przygotowujemy plik zrodlowy
2. robimy `AVIF` i `WebP`
3. podpinamy przez `picture`
4. dodajemy poprawne `width`, `height` i `loading`

## Zasada koncowa

- Tresci artykulow pozostaja merytorycznie nietkniete, jesli uzytkownik nie prosi o redakcje.
- **KRYTYCZNE**: Nigdy nie pomijamy `article:modified_time` oraz `dateModified` w schema.
- **KRYTYCZNE**: Obrazy hero/featured/inline w artykulach MUSZA isc przez tag `<picture>` z AVIF i WebP (fallback png/jpg). Wyjatek: logo i male ikony techniczne.
- **KRYTYCZNE**: W sekcjach "Więcej Porad" (stopka artykułu) używamy klasy `.articles-grid-preview`. NIGDY nie dodajemy tam stylów inline typu `grid-template-columns`. Układem zarządza centralnie `style.css` (1 kolumna na telefonie, 2 na tablecie, 3 na desktopie). CTA kart promocyjnych to zawsze tekstowe "Czytaj artykuł ->", a nazwa sekcji nie może zawierać słowa "Wiedza".
- **KRYTYCZNE**: Sekcja Hero na `index.html` korzysta z animacji wejściowych (klasa `.hero__eyebrow`, `.hero__title` itd.) oraz efektu paralaksy (skrypt na dole strony). Przy edycji nagłówka należy zachować klasę `.floating` dla badge'a oraz dbać o to, by obraz tła miał `will-change: transform`.
- **KRYTYCZNE**: Sekcja `featured-article` (pod biogramem na `index.html`) musi zawsze zawierać absolutnie najnowszy artykuł. Ponadto pierwsza karta w sekcji `articles-grid-preview` (Czytelnia) powinna być tym samym lub drugim w kolejności najnowszym wpisem.
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
