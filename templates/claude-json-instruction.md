# FitPo50 JSON Instruction (Claude)

Wygeneruj WYŁĄCZNIE poprawny JSON zgodny ze schematem FitPo50 (bez markdown, bez komentarzy).

## Twarde wymagania
- `title` 45-65 znaków.
- `description` 145-160 znaków.
- `quick_answer` 40-60 słów, konkretnie odpowiada na pytanie artykułu.
- Każdy nagłówek sekcji (`sections[].title`) musi być pytaniem i kończyć się `?`.
- Pierwszy akapit każdej sekcji ma 35-80 słów.
- Minimum 4 linki wewnętrzne kontekstowe w `sections[].paragraphs_html` (linki do innych stron `.html` fitpo50).
- `answer_blocks` minimum 4.
- `sources` minimum 6 pozycji. Każda wymaga: `label`, `url` https oraz prawdziwy `evidence_level`; nie dodawaj źródła, którego nie używa konkretne twierdzenie.
- Dodaj `evidence_claims`: `claim`, dokładne `location` w JSON, `claim_type` i `source_urls`. Każda liczba, próg, cena, ryzyko, mechanizm oraz twierdzenie medyczne musi mieć takie mapowanie.
- Gdy wniosek opiera się na wcześniejszych akapitach, dodaj `logic_links`: `conclusion_location`, `premise_locations` i konkretne `reasoning`.
- `faq_research` minimum 4 wpisy. Każdy wymaga: `question`, `source_label`, `source_url`, `source_type` (`autocomplete`, `paa`, `gsc`, `manual_research`) oraz dokumentację pochodzenia (`query`, `impressions` lub `research_note`).
- Nie wpisuj samodzielnie `checked_at`, `url_status` ani `http_status`; lokalny pipeline uzupełnia je dopiero po realnym sprawdzeniu URL-u.
- Nie wymyślaj FAQ, nie przerabiaj duplikatu na „wariant 2” i nie przypinaj pytania do przypadkowego źródła naukowego.
- Zero placeholderów i zero metatekstu typu: "w tym artykule omówimy".
- Nie powtarzaj tych samych zdań.

## Styl i format
- Język polski, konkretny, praktyczny, bez lania wody.
- Akapity krótkie i czytelne.
- Jeśli używasz liczb, podawaj kontekst (dla kogo, w jakich warunkach).

## Ważne
To jest DRAFT. Po wygenerowaniu uruchamiamy kanonicznie:
1. `npm run article:prepare-json --file=<plik.fitpo50.json>`
2. dopiero dla otrzymanego `CONTENT_READY`: `npm run article:ready-check -- --file <gotowy.fitpo50.json> --assets-dir <folder_z_grafikami>`
