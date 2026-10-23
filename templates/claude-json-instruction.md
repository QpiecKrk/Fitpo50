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
- Nie dodawaj żadnych linków wewnętrznych FitPo50 i nie wymyślaj slugów. Claude nie zna aktualnego repozytorium. Lokalny pipeline dobiera linki wynikające z planu i osadza je wyłącznie na naturalnych frazach już obecnych w akapitach.
- Nie dodawaj linków do centrów tematycznych. Lokalny pipeline tylko oceni dopasowanie i przedstawi mocną propozycję do akceptacji użytkownika.
- Liczba `answer_blocks` wynika z rzeczywistego researchu i może wynosić zero.
- `sources` zawiera minimum 4 realne i wykorzystane pozycje. Każda wymaga: `label`, `url` https oraz prawdziwy `evidence_level`; nie dodawaj źródła, którego nie używa konkretne twierdzenie.
- Dodaj `evidence_claims`: `claim`, dokładne `location` w JSON, `claim_type` i `source_urls`. Każda liczba, próg, cena, ryzyko, mechanizm oraz twierdzenie medyczne musi mieć takie mapowanie.
- Gdy wniosek opiera się na wcześniejszych akapitach, dodaj `logic_links`: `conclusion_location`, `premise_locations` i konkretne `reasoning`.
- `faq_research` odpowiada `answer_blocks` 1:1 i ma tyle wpisów, ile istnieje realnych pytań. Każdy wymaga: `question`, `source_label`, `source_url`, `source_type` (`autocomplete`, `paa` albo `gsc`) oraz dokumentację pochodzenia. GSC wymaga `query` i `impressions >= 1`; PAA wymaga `query` i `research_note` długości co najmniej 20 znaków.
- Wpisz `checked_at`, `url_status` i `http_status` wynikające z rzeczywistego sprawdzenia; lokalny pipeline zweryfikuje je ponownie.
- Nie wymyślaj FAQ, nie przerabiaj duplikatu na „wariant 2” i nie przypinaj pytania do przypadkowego źródła naukowego.
- Zero placeholderów i zero metatekstu typu: "w tym artykule omówimy".
- Nie powtarzaj tych samych zdań.
- Dodaj dokładnie jeden wpis `image_prompts` dla `hero` i po jednym dla każdej sekcji (`sekcja-1`, `sekcja-2` itd.). Każdy wpis wymaga: `section_ref`, `filename_base` w kebab-case, `topic`, `technique`, `composition`, `purpose`, `aspect_ratio`, `alt_pl`, `caption_pl`, `nano_banana_prompt` i `negative_prompt`.
- Hero i każda sekcja muszą przedstawiać inne ujęcie. Dla pakietu co najmniej 3 obrazów użyj minimum 3 rzeczywiście różnych technik i 3 różnych kompozycji; żadna technika ani kompozycja nie może dominować w więcej niż połowie pakietu.
- Obrazy mają być współczesne, jasne i estetyczne, pokazywać osoby 50+ w wiarygodnym otoczeniu oraz różnicować fotografię, ilustrację redakcyjną, infografikę lub inną technikę adekwatną do treści. Nie powtarzaj jednego kadru z kosmetycznie zmienionym tłem.
- Nie wpisuj `visual_review`, wymiarów, hashy ani `media_manifest`. Te pola powstają lokalnie dopiero po obejrzeniu rzeczywistych plików. Jeśli znasz dokładną nazwę dostarczonego pliku źródłowego, wpisz ją jako `source_file`; inaczej pozostaw to pole puste.
- Dane porównawcze zapisuj wyłącznie jako semantyczny HTML, nigdy jako obraz tabeli ani tekst z kolumnami rysowanymi kreskami. Każda tabela wymaga wrappera `<div class="article-table-wrap">`, klasy `article-table`, konkretnego `<caption>`, osobnych `<thead>` i `<tbody>`, `th scope="col"` w nagłówku oraz `th scope="row"` dla nagłówka wiersza.

## Styl i format
- Język polski, konkretny, praktyczny, bez lania wody.
- Akapity krótkie i czytelne.
- Jeśli używasz liczb, podawaj kontekst (dla kogo, w jakich warunkach).

## Ważne
To jest DRAFT. Po wygenerowaniu uruchamiamy kanonicznie:
1. `npm run article:add -- --file <plik.fitpo50.json>` — JSON i obrazy umieszczamy w jednym katalogu.
2. Pipeline sam kończy przygotowanie `CONTENT_READY` i dopiero wtedy uruchamia jeden atom publikacyjny. Człowiek nie wydaje osobnej komendy `ready-check` ani `publish`.

Podczas fazy przygotowania lokalny pipeline, korzystając z aktualnych HTML-i w repozytorium:
- sprawdza, czy inny URL nie obsługuje już tej samej intencji,
- dobiera i weryfikuje linki wychodzące,
- wskazuje istniejące strony, które powinny później linkować do nowego artykułu,
- ocenia centrum tematyczne, ale niczego nie dopisuje do huba bez akceptacji.
- sprawdza dokładne nazwy obrazów, ich temat, wymiary, proporcje, duplikaty, różnorodność i trzy warianty AVIF/WebP/JPG; bez lokalnego `visual_review: VERIFIED` materiał pozostaje `BLOCKED`.
