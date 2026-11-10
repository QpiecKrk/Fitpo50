# FitPo50 Memory - PORADY

Ten plik dotyczy tylko modulu "Porady" i klasycznych artykulow publikowanych jako pojedyncze strony.

## Zakres

- Dotyczy: `porady.html`, artykuly w root (np. `*.html` poza `sukcesy/`), sekcje promocyjne i nawigacja do porad.
- Nie dotyczy: kalendarza i stron dnia w `Moje Sukcesy`.

## Zasady tresci i layoutu

- Artykul to pojedyncza strona docelowa.
- Obowiazuje kanoniczny standard z `ARTICLE_STANDARD.md` (bez recznych wariantow layoutu).
- Rozdzielamy przygotowanie redakcyjne i techniczne dodanie zgodnie z początkiem `ARTICLE_STANDARD.md`. Pisarz odpowiada za treść, źródła i FAQ, Ilustrator za ilustracje, Grzegorz za akceptację obrazów i wyglądu. Zwykłe `article:add` sprawdza paczkę technicznie bez ponownego badania tych treści; `popraw-seo` i `napraw paczkę N` zachowują własny, jawnie zlecony zakres redakcyjny.
- Liczba sekcji wynika z tematu i intencji. Artykul ma byc wyczerpujacy i interesujacy, bez generycznych dopiskow ani sztucznego wydluzania.
- Kanoniczne wejście lokalne to `article:add` z paczką `.fitpo50.json` i obrazami. Istniejący importer z technicznym precheck jest wewnętrznym etapem kontrolera, nie osobną ręczną ścieżką.
- Plik `.fitpo50.json` jest wsadem roboczym do importu; po udanej publikacji finalnym zrodlem jest HTML + assety + PDF + indeksy, a JSON nie musi zostawac w repo.
- Roboczych JSON-ow w `data/import/*.fitpo50.json` nie commitujemy, jesli finalny HTML jest gotowy i JSON blokuje `json:gate:diff`.
- Regula importera dla "Czytelni": linki z JSON (`related_articles` / `related`) sa ignorowane; importer dobiera 3 karty tylko z lokalnie istniejacych artykulow.
- `article-template-bento.html` jest wewnętrznym szablonem importera. Nie tworzymy ręcznych artykułów HTML ani alternatywnych szkiców poza workflow JSON-first.
- Audyt wejściowy zbiera wszystkie niezależnie wykrywalne błędy techniczne JSON-u i plików naraz; niesprawdzone zależności są jawne. Jeden staging buduje HTML/PDF, podpina PDF w hero i sprawdza artefakty. Nie dodawaj osobnych ręcznych generacji ani kolejnych bramek redakcyjnych po audycie.
- Wyniki wykorzystuj ponownie tylko przy zgodnych parametrach i hashach danych, właściwego kodu oraz konfiguracji. Commit i push obejmują pliki zadania, w tym powiązany kod/testy; nie uruchamiają niezwiązanych NEWS ani kontroli całego portalu. Szerszy wpływ szablonu lub eksportu wymaga właściwych dodatkowych kontroli.
- Powyższy podział jest zatwierdzonym kontraktem; kod i testy wdrażamy w częściach 3–9 planu w Downloads. Test całości wykonamy na innym artykule. Błonnik pozostaje zamknięty.
- W headerze artykulu pokazujemy tylko:
  - dzial
  - czas czytania
- Nie pokazujemy widocznej daty publikacji/aktualizacji na gorze artykulu.
- Na dole artykulu (nad footerem) zawsze sekcja "Czytelnia" (`.porady-preview.section-padding`) z 3 kafelkami.
- Naglowek sekcji "Czytelnia" ma byc index-style (`.reading-room__head` + ikona), nie wariant alternatywny.
- Interlinking w tresci: liczba linkow wewnetrznych wynika z naturalnego planu; mniej niz 2 daje ostrzezenie, nie blokade. Linki osadzamy w akapitach na naturalnych slowach kluczowych; same linki z bloku "Czytaj tez"/"Czytelnia" nie wystarczaja.
- Linkowanie wewnętrzne przygotowuje lokalny mechanizm z istniejących fraz i rzeczywistych stron. Nie dopisuje treści dla licznika ani nie wprowadza zgadywanych adresów z promptu/modelu. Zmiana innego artykułu wymaga włączenia go do zakresu zadania.
- FAQ: importer nigdy nie generuje pytań. Za udokumentowane pochodzenie z GSC/PAA/autocomplete odpowiada Pisarz; import nie bada go ponownie. Nie ma sztucznego minimum; bez FAQ nie tworzymy sekcji ani schema `FAQPage`.
- Dopuszczamy bardziej wyrazisty styl artykulu (kolory, callouty, typografia, tabele), ale:
  - zachowujemy spojnosc z designem serwisu,
  - trzymamy max 2-3 rodziny fontow na artykul,
  - nie rozwalamy layoutu stylami inline (zakaz `style=\"...\"`, szczegolnie w sekcji "Czytelnia"),
  - tabelki musza byc responsywne i czytelne na mobile.
  - `.sources-list` stosujemy tylko na `<ol>`, a dlugie adresy zrodel musza zawijac sie bez poszerzania strony na mobile.

## Standard wizualny artykulu (obowiazuje od 2026-04-17)

Wzorcem referencyjnym dla stylu premium jest:
- `powrot-do-formy-po-50-kompletny-przewodnik.html` (ogolny klimat i rytm),
- `trening-3x30-dla-50-plus.html` (konkretne klasy dla wyroznien i sekcji treningowych).

Elementy obowiazkowe (minimum):
- Hero z haslem (`.hero-motto`) i wyraznym kontrastem.
- Pierwszy akapit z `drop-cap`.
- Co najmniej 2 callouty (`.highlight-box` / modyfikatory) w kluczowych miejscach tekstu.
- Mocny cytat koncowy (`.article-quote`).
- Liczba kontekstowych linkow wewnetrznych wynika z naturalnego planu; mniej niz 2 daje ostrzezenie, nie blokade.
- Sekcja `Zrodla` + `medical-disclaimer` + `Czytelnia` (3 karty).

Typografia:
- Bazowo:
  - display: `var(--font-display)` / Zodiak,
  - body: `Work Sans`,
  - akcent cytatowy/odreczny: `Caveat`.
- Nie przekraczamy 3 rodzin fontow w jednym artykule.
- Hierarchia ma byc czytelna: mocny H1/H2, spokojny body, wyrazne akcenty.

System wyroznien tekstu:
- Stosujemy klasy tonalne zamiast przypadkowych inline:
  - `.tone-strong`
  - `.tone-primary`
  - `.tone-accent`
  - `.tone-success`
- Dla list zasad typu "Po pierwsze..." stosujemy etykiety `pill`:
  - `.rule-tag`
- Dla fragmentow treningowych typu "Cwiczenie 1..." stosujemy:
  - `.exercise-tag`
- Zasada czytelnosci:
  - max 1 mocny akcent tonalny na akapit (poza linkami),
  - nie malujemy calego akapitu, tylko frazy nozne.

Callouty i bloki pomocnicze:
- Standard:
  - `.highlight-box`
- Warianty:
  - `.highlight-box--primary`
  - `.highlight-box--success`
- Uzywamy ich do:
  - podsumowania sekcji,
  - sygnalu "co najwazniejsze",
  - praktycznej wskazowki do wdrozenia.

Obrazy i separatory:
- Wymagany jest osobny hero i odrębny obraz dla każdej głównej sekcji merytorycznej; sekcje użytkowe nie są liczone. Obrazy zatwierdza Grzegorz. Codex kontroluje pliki wyłącznie technicznie i nie wykonuje osobnego review obrazów ani końcowego wyglądu. Kryteria merytoryczne ilustracji z `ARTICLE_STANDARD.md` są odpowiedzialnością Ilustratora i Grzegorza; wcześniejszych raportów nie odtwarzamy jako pozornego nowego review.
- Gdy w sekcji wystepuja 2+ obrazki pod rzad, grupujemy je:
  - wrapper `.figure-stack`,
  - podpis grupy `.figure-stack__label`,
  - obrazki jako `.inline-figure`.
- `inline-figure` ma miec subtelna ramke/cien; bez "golego" obrazka.
- Obowiazkowo `picture` (`avif -> webp -> fallback`) oraz sensowne `alt`.

Responsywnosc:
- Kazdy artykul musi byc czytelny mobile-first:
  - brak poziomego scrolla przez ozdobniki,
  - boxy i tagi nie moga "pekac" layoutu,
  - obrazki i tabele skaluja sie poprawnie.

Czego nie robimy:
- Brak losowych kolorow i stylu "kazdy blok inny".
- Brak nadmiaru inline CSS, jesli da sie uzyc klas.
- Brak upychania 4-5 linkow wewnetrznych w jednym akapicie.
- Brak "sciany obrazkow" bez odstepu i separatora.

Kryteria wyglądu dla autora i Grzegorza (nie dodatkowy ręczny etap Codexa):
1. Czy jest hero, drop-cap, co najmniej 2 callouty i mocny cytat?
2. Czy "Po pierwsze..." / "Cwiczenie 1..." sa wizualnie oznaczone?
3. Czy linki wewnetrzne sa rozlozone naturalnie po tekscie?
4. Czy bloki obrazow pod rzad maja `.figure-stack`?
5. Czy finalny wyglad jest spojny z referencja i nie psuje mobile?

## SEO i schema

- Artykuly: `BlogPosting` + komplet meta (`title`, `description`, canonical, og, twitter, article times).
- `porady.html`: `CollectionPage` + `ItemList`.
- Liczniki i schema musza byc zgodne z realna liczba kart.
- Anty-regresja SEO:
  - `<title>` artykulu: docelowo 55-65 znakow (nie przekraczaj 65).
  - `meta description`: docelowo 140-160 znakow (nie przekraczaj 160).
- Anty-regresja AEO:
  - `BlogPosting` ma zawierac `speakable` (`SpeakableSpecification`).
  - Sekcja `key-takeaways` ma byc wysoko w tresci (po wstepie), nie dopiero pod koniec artykulu.

## Kafelki i indeks porad

- Na `porady.html` utrzymujemy stabilny uklad karuzeli/paginacji.
- Karty kategorii musza byc spojne wizualnie.
- Kategorie artykulow na `porady.html`: `ruch`, `jedzenie`, `zdrowie`, `ciekawe`, `mity`.
- `Mity` to osobna kategoria i osobna strona `mity.html`; nie publikujemy artykulow-mitow jako `ciekawe`, jesli intencja jest obalenie konkretnego twierdzenia.
- Badge/kategoria `Mity` uzywa burgundu `#b4233a` z bialym tekstem; przycisk `Czytaj` zostaje wspolny wizualnie z innymi kategoriami.
- Nie uzywamy `scrollIntoView()` pod nawigacja karuzeli.
- Dla Safari pilnujemy `min-width: 0` na kluczowych kontenerach/gridach.
- Przy przebudowie kolejnych stron kategorii na wzorzec nowego `index.html` utrzymujemy ta sama zasade nocnego tla:
  - na telefonach dopuszczamy ciemne tlo (warstwa strony + warstwa kontenera),
  - na desktopie domyslnie zostaje jasny wariant.

## Obrazy

- Preferowany `picture`: `avif` -> `webp` -> fallback `jpg/jpeg` (PNG tylko dla logo/ikon technicznych).
- Hero: `loading="eager"`.
- Pozostale: `loading="lazy"`.
- Gdzie mozliwe podajemy `width` i `height`.

## Aktualizacja przy nowym artykule

- Aktualizacja przy nowym artykule:
  - odpowiednia strona kategorii (Ruch/Jedzenie/Zdrowie/Ciekawe/Mity),
  - `porady.html`,
  - PDF artykulu (`assets/pdf/<slug>.pdf`) + przycisk pobierania na hero z aktualnym rozmiarem pliku w KB,
  - `sitemap.xml`,
  - `index.html`:
    - sekcja `featured-article`,
    - pierwszy kafelek w dolnej sekcji 3 kart (`articles-grid-preview`),
    - cala sekcja ma zawsze pokazywac 3 najnowsze wpisy wg daty publikacji.

## Anty-regresja (obowiazkowe przy kazdym nowym wpisie)

- `data-order`:
  - na `porady.html` i stronie kategorii `data-order` musi byc unikalne,
  - nowy wpis dostaje `max + 1`,
  - nie zostawiamy duplikatow (np. dwa wpisy z tym samym numerem).

- Daty publikacji (krytyczne dla "Nowy artykul" na `index.html`):
  - ustawiaj:
    - `meta property="article:published_time"` = faktyczna data publikacji,
    - `BlogPosting.datePublished` = ta sama data,
    - `article:modified_time` i `BlogPosting.dateModified` = data aktualizacji.
    - wszystkie pola daty zapisujemy jako pełny ISO 8601 z godziną i strefą (np. `2026-04-24T08:00:00+02:00`).
  - Bez poprawnych dat nowy wpis nie pojawi sie jako najnowszy na `index.html`.

- `index.html` - zasada dzialania:
  - "Nowy artykul" sortuje po `sitemap.xml` + `published_time/datePublished`,
  - nie po kolejnosci kart na `porady.html`.

- Koncowa kontrola przed oddaniem:
  - nowy wpis widoczny na stronie kategorii,
  - nowy wpis widoczny na `porady.html` z najwyzszym `data-order`,
  - URL obecny w `sitemap.xml`,
  - nowy wpis wskakuje do sekcji "Nowy artykul" na `index.html`,
  - source i `_site` sa zsynchronizowane 1:1.

## Artykuly z kategorii `Mity`

- Artykul typu mit ma obalac konkretne twierdzenie lub mechanizm, nie osobe, firme ani czytelnika.
- Obowiazkowy rytm: `MIT` -> krotki `werdykt FitPo50` -> dowody/fizjologia -> praktyczne `co dziala zamiast tego`.
- Ton ma byc kumpelski: "sprawdzamy to spokojnie", bez zawstydzania i bez tabloidu.
- Jesli tekst obala popularne twierdzenie, dodaj `ClaimReview` i trzymaj `reviewRating` spojnie z wzorcem mitu falszywego.
- W `llms.txt` i schema artykul ma miec sekcje `Mity`, nie `Ciekawe`.
