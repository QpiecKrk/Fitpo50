# SESSION START MAX (FitPo50)

Wklej ponizszy blok jako pierwsza wiadomosc w nowej sesji.

```txt
Pracujemy domyslnie po polsku.
Wszystkie podsumowania, plany, review, komentarze i rekomendacje zapisuj po polsku, chyba ze wyraznie poprosze inaczej.
Nazwy plikow, komend, sciezek i elementow technicznych zostawiaj w oryginalnym brzmieniu.
NADRZEDNIE: Zakladaj, ze nie znam sie technicznie. Tlumacz wszystko prostym jezykiem, krok po kroku, jedna czynnosc na raz.
Przy instrukcjach terminalowych podawaj gotowe komendy i wyjasniaj, co zobacze po ich uruchomieniu.

START TECHNICZNY (zawsze na poczatku sesji):
1) Od razu zsynchronizuj lokalne repo z GitHub (zanim zaczniesz analize):
   cd /Users/grzegorzkupiec/Projects/FitPo50-local
   git pull --ff-only origin main
   git restore .agent .agents .brainsync .cursor .windsurfrules 2>/dev/null || true
   git status --short
2) Jesli `git pull` zatrzyma sie przez konflikt "untracked files would be overwritten" (zwykle `assets/news/news_20*`):
   BACKUP_TMP="/tmp/fitpo50-news-backup-$(date +%Y%m%d-%H%M%S)"
   mkdir -p "$BACKUP_TMP"
   git ls-files --others --exclude-standard -- assets/news/news_20* > /tmp/fitpo50-untracked-news.txt
   while IFS= read -r f; do [ -n "$f" ] || continue; mkdir -p "$BACKUP_TMP/$(dirname "$f")"; mv "$f" "$BACKUP_TMP/$f"; done < /tmp/fitpo50-untracked-news.txt
   git pull --ff-only origin main
   git status --short
3) Pokaz mi wynik i dopiero potem przejdz do pracy.
4) Po starcie technicznym uruchom szybka kontrole mirroru NEWS (zanim uznasz zadanie za "gotowe"):
   npm run assets:mirror:sync
   npm run predeploy:check
   Zasada: jesli gate pokazuje warning o brakujacych miniaturach NEWS w `_site/assets/news/`, najpierw wykonaj mirror i ponow gate.
5) Po starcie technicznym nie generuj raportu startowego i nie kopiuj nic do `~/Downloads`.
   Jesli dowolny krok startu technicznego zwroci blad albo wynik niejednoznaczny, przerwij start, pokaz mi konkretny komunikat i czekaj na decyzje.
   Wyjatek: `git restore .agent .agents .brainsync .cursor .windsurfrules 2>/dev/null || true` jest nieblokujacy zgodnie z komenda.

Przed rozpoczeciem pracy zawsze najpierw przeczytaj `PROJECT_MEMORY.md`.
Nastepnie:
- jesli zadanie dotyczy Porady, przeczytaj `MEMORY_PORADY.md`,
- jesli zadanie dotyczy Moje Sukcesy, przeczytaj `MEMORY_MOJE_SUKCESY.md`,
- jesli zadanie dotyczy NEWS, przeczytaj `MEMORY_NEWSY.md`.
- jesli zadanie dotyczy artykulow, przeczytaj tez `ARTICLE_STANDARD.md`.

Zasady:
- ZERO GENERYCZNYCH TEKSTOW: kazda zmiana w tresci artykulu, FAQ, quick answer, H2, title/meta, linkowaniu, Evidence Box, tabeli, opisie obrazka, poprawce SEO/AEO/GEO/AIO albo "technicznej" edycji tekstu musi byc konkretna, logiczna i oparta o tresc artykulu, dane GSC/PAA/autocomplete, sprawdzone zrodlo, konkretna liczbe/prog albo jasny warunek bezpieczenstwa. Nie wolno dodawac zapychaczy typu "warto pamietac", "kluczowe jest", "w dzisiejszych czasach", "to zalezy" bez konkretu. Jesli brakuje danych lub zrodel, zatrzymaj sie i oznacz `INSUFFICIENT_DATA` zamiast dopisywac ogolnik.
- nie zgaduj,
- nie pomijaj konfliktow z dokumentem,
- nie rozszerzaj zakresu bez potrzeby,
- trzymaj zmiany minimalne i zgodne z projektem,
- sygnalizuj ryzyka, zalozenia i wplyw zmian na reszte systemu,
- nie wykonuj `git commit` ani `git push` bez mojej wyraznej komendy,
- nie uzywaj polecen destrukcyjnych bez mojej wyraznej zgody.
- porzadki w repo rob tylko wg whitelisty plikow tymczasowych (np. `tmp/`, `.tmp/`, cache raportow, artefakty jednorazowe),
- nie usuwaj automatycznie plikow zrodlowych artykulow, assetow produkcyjnych, danych ani konfiguracji,
- przed kazdym usuwaniem pokaz liste plikow do usuniecia i czekaj na moja jednoznaczna zgode.
- Gdy wydaje komenda `git push`, traktuj to jako komendę złożoną i uruchamiasz pełny pipeline push:
  - `npm run fitpo50:doctor` (jesli status RED, zatrzymaj push i pokaz blokery),
  - `./scripts/export_site.sh`
  - `npm run assets:mirror:sync`
  - `npm run predeploy:check`
  - raport wynikow (PASS/FAIL + kluczowe bledy),
  - jesli PASS: wykonaj `git add -A` -> `git commit` (automatyczny komunikat) -> `git push`,
  - po udanym push ZAWSZE podaj krok serwerowy (Hostinger), aby uniknac "dirty repo":
    - `cd <repo-na-serwerze>`
    - `npm run hostinger:clean-repo`
    - dopiero potem uruchom deployment,
  - jesli FAIL: STOP, raport bledow i brak push.
  - bezpiecznik: jesli commit obejmuje nienaturalnie duzy zakres (duzo plikow niezwiazanych z biezacym taskiem), STOP i krotkie pytanie o zgode.

Publikacja artykulow:
- `dodaj artykul`, `dodaj artykuł`, `opublikuj artykul` oznacza workflow JSON-first:
  1) najpierw uzyj skilla `popraw-json`,
  2) doprowadz JSON do statusu `content-ready`,
  3) dopiero potem przygotuj/przerob assety PNG -> AVIF/WebP/JPG i uruchom import HTML,
  4) przed generowaniem HTML porownaj zalaczone obrazy z opisami/polami obrazow w JSON,
  5) jesli obraz nie pasuje do opisu z JSON albo brakuje wymaganego ujecia, STOP: powiedz, ktorego obrazu brakuje, wyciagnij prompt/opis z JSON i popros uzytkownika o wygenerowanie oraz zalaczenie nowego pliku,
  6) po dolaczeniu brakujacego obrazu kontynuuj pipeline od miejsca zatrzymania,
  7) jesli blad wyjdzie dopiero po wygenerowaniu HTML, popraw generator/template/HTML albo dane w kopii roboczej pipeline; nie wracaj do edycji pliku JSON z Downloads, chyba ze uzytkownik wyraznie poprosi.
- JSON-y dostarczane w `~/Downloads` sa traktowane jako wsad/draft; po publikacji uzytkownik moze je kasowac, wiec nie opieraj dalszych poprawek na trwalosci tych plikow i nie sprzataj ich automatycznie.
- Po udanej publikacji finalnym artefaktem jest HTML + assety + PDF + wpisy w indeksach; roboczy JSON nie jest trwalym zrodlem prawdy.
- Nie commituj roboczych JSON-ow z `data/import/*.fitpo50.json`, jesli po imporcie blokuja `json:gate:diff` albo nie sa potrzebne do produkcji; przed `git push` usun/przenies taki JSON z repo, jesli finalny HTML jest gotowy.
- Najlepszy import to taki, w ktorym HTML przechodzi walidacje od razu, bo jakosc zostala naprawiona w JSON przed importem.
- kanoniczny flow publikacji artykulow: `scripts/import-article.js` (`.fitpo50.json` + precheck); `article-template-bento.html` / `create-article-from-template.js` tylko do recznych szkicow,
- preferuj szybki pipeline jednej komendy: `node scripts/article-pipeline.js --file "<sciezka/do/pliku.fitpo50.json>" --category <ruch|jedzenie|zdrowie|ciekawe|mity> --force <true|false>`,
- pipeline publikacyjny musi wykonywac kolejnosc: `fix-fitpo50-json` -> `json-fitpo50-gate --file` -> `import-article --precheck` -> `import-article --publish` -> `sync-article-title-breadcrumb` (spojnosc `<title>`/`og:title`/`twitter:title` + `BreadcrumbList`) -> `sync-site-assets-mirror` -> `news-integrity` -> `predeploy-gate --slug`,
- po imporcie artykulu pipeline ma obowiazkowo zregenerowac `llms-full.txt` automatycznie (`scripts/generate-llms-full.js`) i nie czekamy na reczne uzupelnianie JSON/Claude,
- na etapie `json-fitpo50-gate --file` traktuj `meta_description` poza limitem (145-160 znakow) jako twardy blokujacy FAIL i nie przechodz dalej do importu/publikacji,
- `fix-fitpo50-json` dziala w trybie bezpiecznym:
  - domyslnie `--write false` (tylko check/stdout),
  - zapis tylko przy `--write true`,
  - przed zapisem tworzony jest backup `*.bak`,
- pliki JSON spoza repo (np. `~/Downloads`) sa blokowane przez fixer, ale `article-pipeline` obsluguje to przez bezpieczna kopie robocza,
- `article-pipeline` automatycznie tworzy kopie robocza w `/tmp/fitpo50-import-*/<slug>.fitpo50.json`, pracuje tylko na niej i usuwa ja po zakonczeniu (takze po bledzie),
- brak tolerancji na bledy: jesli ktorykolwiek krok gate/validator zwroci FAIL, publikacja i push sa zatrzymane,
- przed ogloszeniem statusu "gotowe" obowiazkowo uruchom `npm run json:gate:diff`; ma byc PASS (brak blokujacych bledow w `.fitpo50.json`),
- przed ogloszeniem statusu "gotowe" obowiazkowo uruchom `npm run assets:mirror:sync`, a nastepnie `npm run predeploy:check`; oba kroki maja byc PASS,
- przed ogloszeniem statusu "gotowe" obowiazkowo sprawdz, czy `data/import/*.fitpo50.json` nie zostawia blockerow push; jesli zostawia, popraw albo usun/przenies plik roboczy z repo i ponow gate, dopiero potem wolno oglosic "gotowe",
- przed `prepush` zawsze uruchamiaj mirror zasobow: `npm run assets:mirror:sync` (PDF + miniatury NEWS + JSON mirror do `_site`),
- obowiazkowo uruchom walidator standardu: `node scripts/validate-article-standard.js <plik.html>`,
- obowiazkowo generuj PDF artykulu i podpinaj duzy przycisk w hero: `npm run article:pdf:builder -- --slug <slug>` (albo hurtowo: `npm run article:pdf:sync`),
- dla nowych artykulow obowiazuje kontrakt HERO+SHARE:
  - motto pod hero (`.hero-motto`) ma byc czytelne, eleganckie, bez fontu odrecznego,
  - pod hero musza byc dwa kafle akcji: `Pobierz PDF` + `Udostepnij` (`#share-article-top`) we wrapperze `.article-primary-actions`,
  - sekcja `Udostepnij artykul` (`.share-article-section`) ma byc przed `Źródła` i miec: Facebook, LinkedIn, WhatsApp, mail, kopiowanie linku,
  - badge `Udostepnij` ma miec styl jak badge `PDF`, ale z etykieta `SHARE`,
- BEZWZGLEDNIE: zanim napiszesz, ze zadanie/artykul jest "gotowe", najpierw wykonaj generowanie PDF (`npm run article:pdf:builder -- --slug <slug>` lub `npm run article:pdf:sync`) i potwierdz obecność pliku PDF w obu lokalizacjach: `assets/pdf/` oraz `_site/assets/pdf/`; bez tego nie wolno oglaszac statusu "gotowe",
- FAQ ma byc oparte o realne pytania z sieci (autocomplete/PAA), nie wymyslane; wymagane `faq_research[]` (min. 4 wpisy: `question`, `source_label`, `source_url`),
- w imporcie trzymaj `--faq-strict true` (domyslnie), czyli brak `faq_research[]` lub placeholdery FAQ = twardy FAIL,
- placeholdery redakcyjne (np. "Do uzupełnienia redakcyjnego", "Pytanie do doprecyzowania", "Odpowiedź do uzupełnienia", `{{...}}`) sa twardym FAIL importu w całym artykule (nie tylko FAQ),
- BEZWZGLEDNIE BLOKUJ: placeholder "Wniosek praktyczny do doprecyzowania na etapie redakcji." (lub podobne) w sekcji `.key-takeaways` i w JSON-LD `about[]`; taki wpis to twardy FAIL i wymaga podmiany na finalne tresci przed publikacja/PDF,
- przed wygenerowaniem PDF i przed statusem "gotowe" uruchom kontrolę placeholderów w finalnym HTML: brak fraz typu "do doprecyzowania", "do uzupelnienia", "placeholder" w tresci, key-takeaways i schema,
- tytul urwany (np. konczacy sie na "i cofnąć") jest traktowany jako blad blokujacy,
- artykul nie przechodzi, jesli ma inline CSS lub lokalny `<style>`,
- naglowek "Czytelnia" ma byc index-style (`reading-room__head` z ikona),
- footer `site-footer-bento` musi byc wewnatrz `<body>`,
- dla nowego artykulu `datePublished` i `article:published_time` ustawiaj na faktyczna date publikacji,
- `dateModified` i `article:modified_time` aktualizuj przy kazdej istotnej zmianie merytorycznej,
- po kazdej zmianie `dateModified` sitemap ma byc aktualizowana automatycznie: uruchom `npm run sitemap:lastmod:sync` albo `./scripts/export_site.sh`; `predeploy:check` ma blokowac nieaktualne `lastmod` w `sitemap.xml` i `_site/sitemap.xml`,
- wszystkie 4 pola daty zapisuj jako pelny ISO 8601 z godzina i strefa (np. `2026-04-24T08:00:00+02:00`),
- kazdy claim liczbowy (%, dni, ryzyko, wzrost/spadek) musi miec zrodlo z URL; bez zrodla nie podawaj liczby,
- nowy artykul = obowiazkowa synchronizacja: strona kategorii + `porady.html` + `index.html` (`featured-article` i 3 kafelki) + `sitemap.xml` + eksport do `_site`,
- w `porady.html` pilnuj spojnosci: `numberOfItems` = liczba kart `data-article-item` = `data-article-count`; `data-order` ma byc unikalne,
- nowy wpis dostaje `data-order = max + 1` (bez duplikatow) na `porady.html` i stronie kategorii,
- "Nowy artykul" na `index.html` bierze kolejnosc z `sitemap.xml` + `article:published_time`/`datePublished` (nie z `data-order`),
- dlatego przy publikacji ustawiaj faktyczne daty publikacji (`article:published_time`, `datePublished`) oraz aktualizuj `dateModified`/`article:modified_time`,
- SEO guardrails: `<title>` max 65 znakow, `meta description` max 160 znakow,
- AEO guardrails: w `BlogPosting` dodawaj `speakable`, a sekcje `.key-takeaways` umieszczaj po wstepie (nie na samym dole),
- interlinking w tresci: minimum 4 linki kontekstowe w akapitach (nie tylko sekcja Czytelnia).
- jesli JSON wejsciowy nie ma linkow kontekstowych, uruchamiaj import z `--run-internal-links auto` (auto-linking przed walidacja), aby domknac wymaganie minimum 4 linkow.

Dzial `Mity`:
- `Mity` to osobna kategoria: `mity.html`, `article--mity`, `data-category="mity"`, `section: "Mity"` w `llms.txt`.
- Artykulu-mitu nie wrzucaj do `ciekawe.html`, chyba ze uzytkownik jawnie zmieni decyzje.
- Kolor kategorii `Mity`: `#b4233a` + bialy tekst; przycisk `Czytaj` w kafelkach Czytelni zostaje wspolny jak w innych kategoriach.
- Artykul typu mit ma rytm: `MIT` -> `werdykt FitPo50` -> `dowody/fizjologia` -> `co dziala zamiast tego`.
- Ton: kumpelski i spokojny; obalamy bledna obietnice/mechanizm, nie ludzi.
- `ClaimReview` dodawaj tylko wtedy, gdy artykul obala jedno precyzyjne twierdzenie i ma jasny werdykt oraz zrodla; nie dodawaj jednego sztucznego `ClaimReview` do tekstow zbiorczych.

Modul NEWS:
- traktuj `MEMORY_NEWSY.md` jako zrodlo zasad,
- utrzymuj synchronizacje: `data/news-live.json` + `assets/data/news-fallback.json` oraz odpowiedniki w `_site`,
- nie mieszaj logiki NEWS z Porady ani Moje Sukcesy,
- claimy liczbowe w newsach tylko ze zrodlem URL,
- miniatury newsow obrabiaj zgodnie z zasadami projektu (lekkie formaty, bez ciezkich oryginalow),
- po zmianach front/admin dopilnuj wersjonowania assetow (`?v=`) i spojnosci `_site`.

Tryb pracy:
- Twoja rola: reviewer i krytyk,
- masz szukac bledow, konfliktow i brakow,
- gdy wykryjesz konflikt z dokumentem albo ryzyko utraty danych: zatrzymaj sie, zadaj jedno krotkie pytanie i czekaj na decyzje.
- `TRYB NADZORU` oznacza sesje tylko do analizy, review, planowania i wskazywania ryzyk:
  - nie wykonuj edycji plikow ani `apply_patch`,
  - nie wykonuj `git add`, `git commit`, `git push`, `git pull`, `git merge`, przelaczania branchy ani deployu,
  - nie czysc plikow, backupow, konfiguracji globalnych ani danych,
  - mozesz czytac wskazane pliki i uruchamiac lokalne komendy tylko-analityczne, jesli nie zmieniaja srodowiska,
  - przed kazda komenda potencjalnie globalna lub zapisujaca: STOP i pytanie o zgode,
  - jesli uzytkownik chce wdrozenia w tym trybie, musi napisac jawnie `edytuj`.
- skroty operacyjne uzytkownika:
  - `start`, `zacznij`, `start techniczny`, `nowa sesja` oznacza: uruchom `npm run session:start`, przeczytaj `data/reports/agent-context.md` i `data/reports/fitpo50-doctor.md`, a potem podsumuj status.
  - `sprawdz system`, `zobacz czy porzadek`, `czy jest dobrze`, `porzadek` oznacza: uruchom `npm run fitpo50:doctor`; jesli trzeba, uzupelnij `npm run agent:context`.
  - `git push` oznacza: najpierw sprawdz `npm run fitpo50:doctor`; jesli status nie jest czerwony, wykonaj standardowy commit/push workflow; jesli status jest czerwony, zatrzymaj push i pokaz blokery.
  - `sprzatnij raporty`, `raporty porzadek` oznacza: najpierw `npm run reports:prune:dry`; dopiero po jawnej zgodzie uzytkownika uruchom `npm run reports:prune`.
  - `admin` oznacza: tryb pracy nad panelem administracyjnym; zawsze pilnuj `admin/config.php` jako pliku prywatnego, nie przywracaj go do Git, nie publikuj `config*.php` ani `init-*.php` do `_site/admin`, sprawdzaj CSP/logowanie/rate limiting i po zmianach PHP uruchamiaj `php -l` dla zmienionych plikow.
  - po kazdej wiekszej zmianie systemowej odswiez kontekst przez `npm run agent:context`, zeby kolejne sesje zaczynaly od aktualnej mapy projektu.
- centra sterowania automatyzacja:
  - artykuly/import: `npm run article:manager -- import --file "<plik.fitpo50.json>" --category <kategoria>`,
  - walidacja artykulu: `npm run article:validate:center -- <tryb> ...`,
  - metadata artykulu: `npm run article:meta:sync -- full --slug <slug>`,
  - PDF artykulu: `npm run article:pdf:builder -- --slug <slug>`,
  - prepush/predeploy: `npm run prepush:checks -- <local|parallel|diff|deploy|strict>`,
  - GSC/SEO: `npm run gsc:tool -- <auto|api|csv|priority-map|watchdog|command-center|apply-wave>`,
  - Growth SEO/AEO/GEO/AIO: `npm run growth:<report|audit-ai|gsc-refresh|evidence-plan|hubs|link-assets|autopilot|verify>`,
  - `growth` jest osobnym centrum wzrostu widocznosci: raportuje priorytety, planuje huby, Evidence Boxy, assety do link earningu i refresh artykulow z GSC,
  - raporty `growth` sa robocze i domyslnie ida poza repo do `~/Downloads/fitpo50-growth-reports`; jesli trzeba wymusic inne miejsce, uzyj `FITPO50_GROWTH_REPORT_DIR`,
  - edytor growth domyslnie dziala jako dry-run: `npm run growth:apply:dry -- --file <plik.html> --evidence-box --doctor-box`; zapis wymaga jawnego `npm run growth:apply -- --file <plik.html> ...`,
  - `growth:apply` moze dodawac tylko bezpieczne bloki zarzadzane (Evidence Box, Kiedy do lekarza, tabela cytowalna) i aktualizowac `dateModified`; nie wolno mu przepisywac calego artykulu ani usuwac sekcji,
  - `popraw-seo` oznacza: uruchom `npm run popraw-seo`, wygeneruj wszystkie raporty growth i zatrzymaj sie na statusie `AWAITING_USER_APPROVAL`; nie edytuj artykulow bez zatwierdzenia konkretnych pozycji,
  - `popraw-seo` ma laczyc w jednej paczce `BOOST` (URL-e blisko wzrostu w GSC: CTR/title/meta/lead/linkowanie) oraz `NAPRAWA` (slabe albo niewidoczne strony: quick answer/FAQ/zrodla/linkowanie),
  - uzytkownik zatwierdza konkretne ID, np. `popraw BOOST 1` albo `popraw BOOST 1 NAPRAWA 2`; jesli poda tylko numery i istnieje ryzyko pomylenia koszykow, agent musi doprecyzowac przed edycja,
  - `popraw-seo` obejmuje tez moduly AIO/GEO: `ai-visibility-test`, `entities`, `structured-score`, `quick-answer-score`, `topical-map`, `llms-check` i `perplexity-monitor`,
  - `popraw-seo` NIE moze samodzielnie wklejac generycznych blokow do artykulow: najpierw przygotuj w rozmowie gotowe teksty (Evidence Box, linki, ewentualna tabela/checklista, hub-link), poczekaj na akceptacje uzytkownika i dopiero wtedy edytuj HTML,
  - tabele dodawaj tylko wtedy, gdy maja realny sens dla intencji artykulu; przyklad: `wino-i-miesnie-po-50.html` nie powinien dostawac tabeli tylko dlatego, ze raport sugeruje "shareable table",
  - huby/centra tematyczne wdrazaj najpierw testowo na `index1.html` z `noindex,nofollow`; dopiero po zatwierdzeniu przenies blok na `index.html`, a `index1.html` trwale usun z repo,
  - robocze huby regeneruj komenda `npm run preview:hubs`; generator to `scripts/build-preview-hubs.js`, a wspolny styl to `assets/topic-hub.css`,
  - stare skrypty zostawiaj jako aliasy kompatybilnosci do czasu kilku poprawnych publikacji i pushy; migracja jest dwuetapowa: najpierw aliasy do nowych centrow, dopiero po stabilizacji usuwanie aliasow,
  - aliasow nie wolno usuwac, jesli odwoluje sie do nich `package.json`, hook, pipeline, dokumentacja, Hostinger albo instrukcje agentow; `doctor` ma pilnowac dat i licznikow migracji.
- skrot `GSC` w rozmowie oznacza domyslnie:
  - sprawdz ostatni issue z raportem GSC na GitHub,
  - przeczytaj issue `SEO/AEO: Poniedziałkowy raport GSC`,
  - przeczytaj issue `SEO/AEO: TODO tygodnia (auto)` jesli istnieje,
  - uruchom technicznie `npm run gsc:auto` (najpierw pozyskaj/synchronizuj `queries`, `pages`, `query-pages`),
  - pracuj na danych poza repo: domyslny katalog roboczy `~/Downloads/gsc-auto-input` (CSV + raporty GSC),
  - brak `queries.csv` lub `pages.csv` lub `query-pages.csv` w `~/Downloads/gsc-auto-input` oznacza twardy `INSUFFICIENT_DATA` (bez fallbacku do `data/gsc`),
  - raport ma byc ukierunkowany na AEO pod Google/Gemini (AI Overviews) z zachowaniem priorytetu `SEO -> AEO -> GEO -> AIO`,
  - obowiazkowo policz i pokaz `Opportunity Score` dla URL-i (priorytet: wysokie wyswietlenia + niski CTR + pozycje 4-20),
  - obowiazkowo wylistuj `TOP 10 AEO opportunities` (URL + query cluster + szybka rekomendacja: quick_answer/FAQ/H2/citation),
  - obowiazkowo uruchom `AEO Opportunity Bot` (tygodniowy raport TOP 10 URL-i z CTR gap) i dolacz wynik do raportu GSC,
  - wynik `AEO Opportunity Bot` zapisz poza repo w `~/Downloads/gsc-auto-input` jako:
    - `aeo-opportunities.md`
    - `aeo-opportunities.json`
  - obowiazkowo mapuj query do intencji (`how-to`, `czy warto`, `objawy`, `normy`, `bezpieczenstwo`) i do realnych URL-i w repo,
  - obowiazkowo dodaj sekcje `AI Referrer Monitor`: ChatGPT vs Gemini vs Perplexity (trend 7/28 dni) jesli dane sa dostepne; gdy brak danych, oznacz `INSUFFICIENT_DATA`,
  - obowiazkowo dodaj sekcje `FAQ Intent Refresh`: propozycje pytan FAQ z danych (autocomplete/PAA/GSC), bez pytan generycznych,
  - decyzje i priorytety opieraj na danych projektu (GA4/referrer/GSC), nie na trendach globalnych,
  - podaj po polsku raport premium wg `.agent/skills/gsc-content-strategy/SKILL.md`: Data Quality Gate, Top Queries/Pages, Opportunity Score, CTR Gap, Quick Wins, Content Gaps, Action Cards oraz plan 7/14/28 dni.

Raport koncowy po zadaniu:
1. co zmieniono,
2. jakie pliki,
3. jak szybko sprawdzic wynik,
4. status `git status --short` (w tym untracked i nowe assety).
```

## Szybkie uzycie

W nowej sesji mozesz napisac:

- "Stosuj instrukcje z `SESSION_START_MAX.md` i zacznij od startu technicznego."

## DOPRECYZOWANIE: GSC + NOWE ARTYKULY (2026-05-31)

- Komenda `GSC` ma uruchamiac pelny workflow raportowy (techniczny start + pozyskanie danych + raport), a nie tylko pojedynczy krok.
- Gdy auto-pobranie CSV nie zadziala, agent ma od razu poprosic o reczne zapisanie plikow do katalogu roboczego i po dostarczeniu kontynuowac bez zgadywania.
- Raport GSC ma zawsze miec 2 wyraznie oddzielone czesci:
  - `Optymalizacja istniejacych URL-i` (na danych projektu),
  - `Nowe artykuly - globalnie` (na realnych trendach/intencjach globalnych, tematycznie do kategorii).
- Dla nowych artykulow nie opieraj propozycji tylko na lokalnym CSV; domyslnie stosuj tryb globalny i tematyczny.
- FAQ dla nowych artykulow ma byc oparte o realne pytania (autocomplete/PAA; ewentualnie hybryda z GSC), bez pytan generycznych.
- W poprawie JSON traktuj jako blokery:
  - generyczny `quick_answer`,
  - duplikaty/generyczne pytania FAQ,
  - niejakosciowe `faq_research`,
  - brak wymaganych linkow kontekstowych,
  - odpowiedzi FAQ poza zakresem polityki.
- Nie gromadz plikow jednorazowych: tymczasowe artefakty po zadaniu usuwaj, zostawiaj tylko finalne wyniki.
