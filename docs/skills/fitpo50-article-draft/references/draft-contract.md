# Kontrakt draftu FitPo50

Wczytaj ten plik przed tworzeniem `.fitpo50.json`. To kontrakt draftu dla lokalnego pipeline; nie jest kontraktem finalnego HTML.

## Odpowiedzialność

Claude tworzy treść, research, mapę dowodów, FAQ i plan ilustracji. Lokalny pipeline FitPo50 dodaje lub sprawdza: linki wewnętrzne, kanibalizację, centrum tematyczne, rzeczywiste pliki obrazów, `media_manifest`, daty publikacji, HTML, PDF i publikację.

Nie dodawaj pól `internal_link_plan`, `incoming_link_suggestions`, `intent_audit`, `topic_center_assessment`, `topic_center_approval` ani `media_manifest`. Nie umieszczaj w treści linków do plików `*.html`.

## Minimalna struktura JSON

```json
{
  "status": "DRAFT",
  "title": "",
  "seo_title": "",
  "og_title": "",
  "twitter_title": "",
  "slug": "",
  "category": "zdrowie|jedzenie|ruch|ciekawe|mity",
  "meta_description": "",
  "og_description": "",
  "twitter_description": "",
  "schema_blogposting_description": "",
  "listing_title": "",
  "listing_desc": "",
  "lead": "",
  "quick_answer": "",
  "reading_time": "X min czytania",
  "hero_motto_html": "<em>...</em>",
  "search_intent": "",
  "primary_keyword": "",
  "supporting_keywords": [],
  "myth_claim": "",
  "key_takeaways": [],
  "sections": [],
  "answer_blocks": [],
  "faq_research": [],
  "sources": [],
  "evidence_claims": [],
  "logic_links": [],
  "image_prompts_v4": [],
  "editorial_notes": {
    "uncertain_claims": [],
    "missing_evidence": [],
    "faq_gaps": [],
    "medical_risks": [],
    "assumptions": [],
    "local_pipeline_tasks": []
  }
}
```

`myth_claim` jest wymagane tylko dla kategorii `mity`; w pozostałych kategoriach pomiń je.

## Pola redakcyjne

- `title` i `seo_title`: 55–65 znaków, konkretna intencja, bez „kompletnego przewodnika” i podobnych klisz. `og_title` i `twitter_title` są identyczne z `seo_title`.
- Cztery pola opisu są identyczne 1:1, mają 145–160 znaków, intencję w pierwszych 120 znakach i pełny znak końca zdania.
- `lead`: mocne otwarcie, które nazywa problem. Nie powtarza quick answer.
- `quick_answer`: 45–70 słów, 1–3 pełne zdania, bez wstępu typu „warto pamiętać”. Odpowiada od razu i podaje najważniejszy warunek lub wyjątek.
- `key_takeaways`: 3–5 konkretnych wniosków, bez claimów szerszych niż dowody.
- `sections`: zwykle 6–10 logicznych sekcji. Krótszego tematu nie rozciągaj; przy mniej niż 6 sekcjach zapisz powód w `editorial_notes.local_pipeline_tasks`.
- Pytające H2 kończą się `?`. Pierwszy `paragraphs_html` pod H2 ma 30–70 słów.
- Dozwolone bloki treści to semantyczny HTML bez stylów inline. Tabela wymaga wrappera `.article-table-wrap`, `table.article-table`, `caption`, `thead`, `tbody`, `th scope="col"` i — gdy jest nagłówkiem wiersza — `th scope="row"`.
- Każda sekcja może zawierać `title`, `paragraphs_html`, `list_items` oraz opcjonalny `info_box`. Nie dodawaj `image`; obrazy opisuje `image_prompts_v4`.

## Źródła i dowody

Użyj 5–8 źródeł, o ile każde faktycznie wspiera treść. Preferuj aktualne wytyczne, przeglądy systematyczne i metaanalizy; pojedyncze badania służą do uzupełniania. Starsze fundamentalne źródło zestaw z nowszym stanem wiedzy i wyjaśnij, co pozostało aktualne.

```json
{
  "label": "Pełna nazwa instytucji/publikacji i rodzaj materiału",
  "url": "https://...",
  "evidence_level": "guideline|systematic_review|meta_analysis|randomized_trial|cohort|official_guidance|expert_consensus|official_statistics|technical_documentation",
  "publication_year": 2026,
  "doi_or_pmid": "DOI albo PMID — dla publikacji naukowej, jeśli istnieje",
  "checked_at": "YYYY-MM-DD",
  "url_status": "reachable|requires_local_verification",
  "http_status": 200
}
```

Ustaw `reachable` i kod HTTP tylko po rzeczywistym otwarciu adresu. W innym przypadku użyj `requires_local_verification` i pomiń `http_status`. Lokalny pipeline zweryfikuje każdy URL ponownie.

Każda liczba, próg, ryzyko, mechanizm, rekomendacja medyczna lub kategoryczna teza wymaga wpisu:

```json
{
  "claim": "Dokładny fragment twierdzenia występujący w treści",
  "location": "sections[2].paragraphs_html[0]",
  "claim_type": "medical|safety|mechanism|price|statistic|general",
  "source_urls": ["https://..."]
}
```

Każde źródło musi zostać użyte w co najmniej jednym `evidence_claims`. Gdy wniosek wynika z wcześniejszych przesłanek, dodaj `logic_links` z `conclusion_location`, wcześniejszymi `premise_locations` i krótkim `reasoning`.

## FAQ

Liczba pytań zależy od prawdziwych sygnałów. Celuj w 4–6, ale nigdy nie wymyślaj pytania dla licznika. Jeśli znajdziesz mniej, pozostaw realne pytania i zapisz brak w `editorial_notes.faq_gaps`; lokalny zespół uzupełni research.

Każdy wpis `answer_blocks` ma `question` i `answer_html`. Każde pytanie musi mieć odpowiednik 1:1 w `faq_research`:

```json
{
  "question": "Dokładnie to samo pytanie",
  "source_type": "autocomplete|paa|manual_research",
  "source_label": "Konkretne pochodzenie pytania",
  "source_url": "https://...",
  "query": "Sprawdzone zapytanie",
  "research_note": "Co i gdzie rzeczywiście sprawdzono",
  "checked_at": "YYYY-MM-DD",
  "url_status": "reachable|requires_local_verification",
  "http_status": 200
}
```

Preferuj prawdziwe autocomplete z zapisanym dokładnym zapytaniem i adresem endpointu. PAA wymaga zapisu zapytania, zaobserwowanego pytania i strony wyników; `manual_research` jest dozwolone tylko dla sprawdzalnego publicznego sygnału opisanego w notatce. Nie używaj GSC, ponieważ Claude nie ma danych FitPo50. Brak sygnału zapisuj jako lukę — nie pytanie. Nie twórz wariantów tego samego pytania. Odpowiedź FAQ także podlega mapowaniu dowodów.

## Plan obrazów

`image_prompts_v4` zawiera dokładnie jeden wpis `hero` i dokładnie jeden wpis dla każdej sekcji (`sekcja-1`, `sekcja-2` itd.). Liczby obrazów nie ograniczaj sztucznie: jeśli temat wymaga 15 znaczących sekcji, przygotuj hero i 15 różnych obrazów; nie dziel jednak treści na sekcje tylko dla zwiększenia liczby ilustracji.

```json
{
  "section_ref": "hero|sekcja-1",
  "filename_base": "slug-krotki-temat",
  "topic": "Konkretny temat i scena",
  "technique": "editorial photography|scientific 3D|paper collage|data visualization|macro photography|architectural lifestyle",
  "composition": "Konkretny kadr, perspektywa i układ",
  "purpose": "Co czytelnik ma zrozumieć i gdzie obraz trafia",
  "aspect_ratio": "16:9",
  "prompt_en": "Pełny prompt po angielsku",
  "negative_prompt": "No text, no lettering, no numbers, no logo, no watermark, no UI",
  "alt_pl": "Konkretny opis obrazu po polsku",
  "caption_pl": "Podpis wyjaśniający związek obrazu z sekcją",
  "visual_review": {
    "status": "PENDING_LOCAL_REVIEW"
  }
}
```

Hero nie zawiera napisów, liter, liczb, logo, znaków wodnych ani interfejsu. Dla całego pakietu użyj minimum 3 technik i 3 kompozycji; żadna nie dominuje w więcej niż połowie obrazów.

Ludzie: głównie 50–65 lat, naturalne rysy, zmarszczki i sylwetki; zadbani, aktywni, dobrze sytuowani, ale bez ostentacyjnego luksusu. Zachowuj równowagę kobiet i mężczyzn w serii. Pory roku — również zima — wnętrza, miasta, natura, praca, podróż i nieoczywiste miejsca tworzą pulę możliwości, nie listę obowiązkową. Każdy kadr musi służyć konkretnej sekcji. Obrazy mają być jasne, optymistyczne i współczesne.

Dopuszczalne są fotografie, makro, kolaż redakcyjny, ilustracja naukowa, anatomiczne 3D, atrakcyjna infografika, wykres, plansza i analogia wizualna. Prowokacja ma wynikać z inteligentnego zestawienia lub napięcia, nigdy ze straszenia, upokarzania ani epatowania chorobą.

Zakazane: hero z tekstem; sztuczne „przed i po”; krew i drastyczne zabiegi; logotypy; stockowe uściski lekarza; przesadnie umięśnione ciała; stereotyp bezradnego seniora; powtarzanie jednego kadru; obraz zawierający nieudowodnioną liczbę. Tabele i kompletne dane pozostają HTML-em, nie grafiką.

## Artykuły `mity`

Zachowaj rytm: nazwij MIT → podaj werdykt FitPo50 → wyjaśnij dowody i mechanizm → pokaż, co działa zamiast. Atakuj twierdzenie, nie ludzi ani firmy. Dodaj semantyczną tabelę `MIT`–`FAKT/DOWODY`. `ClaimReview` proponuj tylko dla jednego precyzyjnego twierdzenia; lokalny pipeline zdecyduje o jego publikacji.
