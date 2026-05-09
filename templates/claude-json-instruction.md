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
- `sources` minimum 6 pozycji (`label` + `url` https).
- `faq_research` minimum 4 wpisy (`question`, `source_label`, `source_url`).
- Zero placeholderów i zero metatekstu typu: "w tym artykule omówimy".
- Nie powtarzaj tych samych zdań.

## Styl i format
- Język polski, konkretny, praktyczny, bez lania wody.
- Akapity krótkie i czytelne.
- Jeśli używasz liczb, podawaj kontekst (dla kogo, w jakich warunkach).

## Ważne
To jest DRAFT. Po wygenerowaniu i tak uruchamiamy:
1. `npm run json:fix --file=<plik.fitpo50.json>`
2. `npm run article:preflight --file=<plik.fitpo50.json> --assets-dir=<folder_z_grafikami>`
