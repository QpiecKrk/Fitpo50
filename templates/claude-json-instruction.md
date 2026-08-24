# FitPo50 JSON Instruction (Claude)

Wygeneruj WYŁĄCZNIE poprawny JSON zgodny ze schematem FitPo50 (bez markdown, bez komentarzy).

## Twarde wymagania
- `title` 45-65 znaków.
- `description` 145-160 znaków.
- `quick_answer` 40-60 słów, konkretnie odpowiada na pytanie artykułu.
- Podaj `search_intent`: `how-to`, `czy-warto`, `objawy`, `normy`, `bezpieczenstwo`, `definicja`, `porownanie`, `informacyjna`, `plan`, `koszt` albo `dawkowanie`.
- Podaj `primary_keyword` jako jedną konkretną frazę główną długości 2-8 słów oraz `supporting_keywords` jako 3-8 odrębnych fraz wspierających.
- Każdy nagłówek sekcji (`sections[].title`) musi być pytaniem i kończyć się `?`.
- Pierwszy akapit każdej sekcji ma 35-80 słów.
- Nie dodawaj żadnych linków wewnętrznych FitPo50 i nie wymyślaj slugów. Claude nie zna aktualnego repozytorium. Lokalny pipeline po przyjęciu draftu dobierze minimum 4 istniejące artykuły i osadzi link wyłącznie na naturalnej frazie już obecnej w akapicie.
- Nie dodawaj linków do centrów tematycznych. Lokalny pipeline tylko oceni dopasowanie i przedstawi mocną propozycję do akceptacji użytkownika.
- `answer_blocks` minimum 4.
- `sources` minimum 6 pozycji. Każda wymaga: `label`, `url` https oraz prawdziwy `evidence_level`; nie dodawaj źródła, którego nie używa konkretne twierdzenie.
- Dodaj `evidence_claims`: `claim`, dokładne `location` w JSON, `claim_type` i `source_urls`. Każda liczba, próg, cena, ryzyko, mechanizm oraz twierdzenie medyczne musi mieć takie mapowanie.
- Gdy wniosek opiera się na wcześniejszych akapitach, dodaj `logic_links`: `conclusion_location`, `premise_locations` i konkretne `reasoning`.
- `faq_research` minimum 4 wpisy. Każdy wymaga: `question`, `source_label`, `source_url`, `source_type` (`autocomplete`, `paa`, `gsc`, `manual_research`) oraz dokumentację pochodzenia (`query`, `impressions` lub `research_note`).
- Nie wpisuj samodzielnie `checked_at`, `url_status` ani `http_status`; lokalny pipeline uzupełnia je dopiero po realnym sprawdzeniu URL-u.
- Nie wymyślaj FAQ, nie przerabiaj duplikatu na „wariant 2” i nie przypinaj pytania do przypadkowego źródła naukowego.
- Zero placeholderów i zero metatekstu typu: "w tym artykule omówimy".
- Nie powtarzaj tych samych zdań.
- Dodaj dokładnie jeden wpis `image_prompts` dla `hero` i po jednym dla każdej sekcji (`sekcja-1`, `sekcja-2` itd.). Każdy wpis wymaga: `section_ref`, `filename_base` w kebab-case, `topic`, `technique`, `composition`, `purpose`, `aspect_ratio`, `alt_pl`, `caption_pl`, `nano_banana_prompt` i `negative_prompt`.
- Hero i każda sekcja muszą przedstawiać inne ujęcie. Dla pakietu co najmniej 3 obrazów użyj minimum 3 rzeczywiście różnych technik i 3 różnych kompozycji; żadna technika ani kompozycja nie może dominować w więcej niż połowie pakietu.
- Obrazy mają być współczesne, jasne i estetyczne, pokazywać osoby 50+ w wiarygodnym otoczeniu oraz różnicować fotografię, ilustrację redakcyjną, infografikę lub inną technikę adekwatną do treści. Nie powtarzaj jednego kadru z kosmetycznie zmienionym tłem.
- Nie wpisuj `visual_review`, wymiarów, hashy ani `media_manifest`. Te pola powstają lokalnie dopiero po obejrzeniu rzeczywistych plików. Jeśli znasz dokładną nazwę dostarczonego pliku źródłowego, wpisz ją jako `source_file`; inaczej pozostaw to pole puste.

## Styl i format
- Język polski, konkretny, praktyczny, bez lania wody.
- Akapity krótkie i czytelne.
- Jeśli używasz liczb, podawaj kontekst (dla kogo, w jakich warunkach).

## Ważne
To jest DRAFT. Po wygenerowaniu uruchamiamy kanonicznie:
1. `npm run article:prepare-json --file=<plik.fitpo50.json> --assets-dir=<jeden_folder_json_i_obrazow>`
2. dopiero dla otrzymanego `CONTENT_READY`: `npm run article:ready-check -- --file <gotowy.fitpo50.json> --assets-dir <folder_z_grafikami>`

Podczas kroku 1 lokalny pipeline, korzystając z aktualnych HTML-i w repozytorium:
- sprawdza, czy inny URL nie obsługuje już tej samej intencji,
- dobiera i weryfikuje linki wychodzące,
- wskazuje istniejące strony, które powinny później linkować do nowego artykułu,
- ocenia centrum tematyczne, ale niczego nie dopisuje do huba bez akceptacji.
- sprawdza dokładne nazwy obrazów, ich temat, wymiary, proporcje, duplikaty, różnorodność i trzy warianty AVIF/WebP/JPG; bez lokalnego `visual_review: VERIFIED` materiał pozostaje `BLOCKED`.
