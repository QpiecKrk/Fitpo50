# Kontrakt draftu FitPo50

Wczytaj ten plik przed tworzeniem `.fitpo50.json`. To kontrakt draftu Claude dla lokalnego pipeline, nie kontrakt finalnego HTML.

## Podział odpowiedzialności

Claude tworzy treść, research, mapę dowodów i plan ilustracji. Lokalny agent zawsze wykonuje później:

- research finalnego FAQ na podstawie aktualnego GSC, PAA, autocomplete lub udokumentowanego researchu ręcznego,
- linkowanie wewnętrzne na podstawie aktualnego repozytorium,
- analizę kanibalizacji i centrum tematycznego,
- kontrolę rzeczywistych obrazów, HTML, PDF i publikację.

Claude nie zna aktualnego serwisu ani danych GSC. Dlatego:

- `answer_blocks` i `faq_research` pozostają pustymi listami,
- `editorial_notes.faq_gaps` pozostaje pustą listą; Claude nie szuka ani nie proponuje pytań FAQ,
- nie powstają linki do `*.html`, slugi innych artykułów ani propozycje centrum,
- `editorial_notes.local_pipeline_tasks` zawiera osobno zadanie FAQ i zadanie linkowania.

Nie dodawaj pól `internal_link_plan`, `incoming_link_suggestions`, `intent_audit`, `topic_center_assessment`, `topic_center_approval` ani `media_manifest`.

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
  "search_intent": "informacyjna",
  "primary_keyword": "",
  "supporting_keywords": [],
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
    "local_pipeline_tasks": [
      "LOCAL_AGENT_REQUIRED: przygotuj prawdziwe finalne FAQ z aktualnego GSC/PAA/autocomplete lub udokumentowanego researchu ręcznego.",
      "LOCAL_AGENT_REQUIRED: dodaj naturalne linkowanie wewnętrzne po analizie aktualnego repozytorium."
    ]
  }
}
```

`myth_claim` dodaj wyłącznie dla kategorii `mity`.

## Zakres i konstrukcja artykułu

- Artykuł ma wyczerpać realną intencję czytelnika. Nie obowiązuje docelowa liczba słów ani sekcji.
- Złożony temat może i powinien być dłuższy, jeśli kolejne części wnoszą dowody, mechanizm, praktyczne znaczenie albo bezpieczeństwo.
- Nie skracaj kosztem brakującego wyjaśnienia. Nie wydłużaj powtórzeniami, listami dla licznika ani sekcjami bez osobnej funkcji.
- `title` jest naturalnym, kompletnym gramatycznie H1 długości 55–65 znaków. Nie wolno go mechanicznie ucinać; zbyt długi tytuł trzeba świadomie przepisać bez utraty sensu.
- `seo_title` bez dopisku marki ma 35–55 znaków, jest pełną frazą i nie kończy się urwanym przyimkiem, spójnikiem, dwukropkiem ani myślnikiem. `og_title` i `twitter_title` są identyczne z `seo_title`.
- `listing_title` ma bezpieczny zakres 45–80 znaków; 55–70 jest celem, nie sztywnym wymogiem.
- Cztery opisy SEO są identyczne 1:1, mają 145–160 znaków i kończą się pełnym zdaniem.
- `lead` nazywa problem i nie powtarza quick answer.
- `search_intent` ma dokładnie jedną wartość: `how-to`, `czy-warto`, `objawy`, `normy`, `bezpieczenstwo`, `definicja`, `porownanie`, `informacyjna`, `plan`, `koszt` albo `dawkowanie`.
- `primary_keyword` ma 2–8 słów i występuje naturalnie w `title`, `seo_title`, `lead` albo `quick_answer`; `supporting_keywords` zawiera 3–8 unikalnych fraz.
- `key_takeaways` zawiera dokładnie 4 kompletne wnioski. Po każdej zmianie tej listy sprawdź wszystkie indeksy `evidence_claims.location`.
- `quick_answer` zawiera 1–3 konkretne zdania, liczbę albo jawny warunek, odpowiada od razu i mieści się we wspólnym zakresie wszystkich bramek: 45–60 słów.
- Pytające H2 kończą się `?`. Pierwszy akapit odpowiada bezpośrednio i konkretnie; 30–70 słów jest zaleceniem, nie samodzielnym blokerem.
- Pierwszy akapit pod H2 kończy pełną myśl znakiem `.`, `!` albo `?`; nie może urywać się dwukropkiem zapowiadającym brakującą treść.
- Każda metafora jest domknięta mechanizmem. Niejasne „to”, „ten wniosek” i „ta obietnica” muszą mieć nazwany poprzednik.
- Tabela pozostaje semantycznym HTML: wrapper `.article-table-wrap`, `table.article-table`, `caption`, `thead`, `tbody` i właściwe `scope`. Bloków `div`, `table`, `figure`, `aside`, list, `blockquote` ani `pre` nie wolno umieszczać wewnątrz `<p>`.

## Źródła i dowody

Użyj co najmniej 4 rzeczywistych, wykorzystanych źródeł. Nie ma górnego limitu, jeżeli każde źródło wspiera konkretny claim. Preferuj:

- wytyczne towarzystw naukowych i instytucji publicznych,
- przeglądy systematyczne i metaanalizy,
- badania randomizowane, kohortowe i inne oryginalne publikacje,
- dokumenty regulatorów i oficjalne statystyki.

Nie używaj portali plotkarskich, tekstów sponsorowanych lub afiliacyjnych, anonimowych blogów, streszczeń AI ani strony wyników wyszukiwarki jako źródła. Artykuł popularnonaukowy może pomóc znaleźć publikację, ale nie zastępuje jej jako dowód.

```json
{
  "label": "Pełna nazwa instytucji lub publikacji i rodzaj materiału",
  "url": "https://...",
  "evidence_level": "guideline|systematic_review|meta_analysis|randomized_trial|cohort|primary_research|official_guidance|regulatory|official_statistics|technical_documentation",
  "publication_year": 2026,
  "doi_or_pmid": "DOI albo PMID, jeśli istnieje",
  "checked_at": "YYYY-MM-DD",
  "url_status": "reachable|requires_local_verification",
  "http_status": 200
}
```

Ustaw `reachable` i `http_status` tylko po rzeczywistym otwarciu URL-a i uzyskaniu końcowego kodu 2xx po przekierowaniach. Kod 3xx, 401, 403, 404, 429 lub 5xx nie jest dowodem dostępności dla draftu. W przeciwnym razie użyj `requires_local_verification` i pomiń `http_status`; walidator nada wtedy `DRAFT_REVIEW_REQUIRED`. Preferuj dostępny, kanoniczny rekord konkretnej publikacji w PubMed/PMC lub dokument instytucji zamiast zablokowanej strony DOI/wydawcy. Strona wyników wyszukiwania PubMed, PMC lub Google nigdy nie jest źródłem.

`checked_at` zapisuje dzień faktycznego sprawdzenia i jest ważne maksymalnie 180 dni. URL-e i identyfikatory `sources[].id` są unikalne. Publikacje naukowe mają `publication_year` oraz `doi_or_pmid`, jeśli identyfikator istnieje.

Każda liczba, próg, ryzyko, cena, mechanizm, rekomendacja, kategoryczna teza medyczna, wynik badania oraz merytoryczny podpis lub tekst ilustracji wymaga `evidence_claims`:

```json
{
  "claim": "Dokładny fragment występujący w treści lub podpisie",
  "location": "sections[2].paragraphs_html[0]",
  "claim_type": "medical|safety|mechanism|price|statistic|general",
  "source_urls": ["https://..."]
}
```

Każde źródło musi być użyte. `logic_links` łączą wniosek z wcześniejszymi przesłankami, gdy relacja nie jest prostym cytowaniem jednego źródła.

Każdy `claim` ma co najmniej 5 słów i jest dokładnym fragmentem finalnej wersji pola wskazanego przez `location`. `location` wskazuje pojedynczy tekst, nie całą listę lub obiekt. Po skróceniu, przeniesieniu albo usunięciu akapitu, sekcji lub wniosku przelicz indeksy i ponownie uruchom walidator; martwe odwołanie, np. `key_takeaways[4]` przy czterech elementach, blokuje draft.

## FAQ i linkowanie

Claude nie tworzy finalnego FAQ i nie próbuje ustalać linków wewnętrznych. Oba obszary zależą od danych, których nie ma w skillu.

- `answer_blocks: []`
- `faq_research: []`
- `editorial_notes.faq_gaps: []`
- brak `href` prowadzących do `*.html`
- dwa jawne zadania `LOCAL_AGENT_REQUIRED` w `editorial_notes.local_pipeline_tasks`

Brak FAQ i linków jest na etapie `DRAFT` prawidłowy. Nie pytaj użytkownika o pytania FAQ ani slugi linków. Lokalny agent zawsze wykonuje prawdziwy research FAQ i uzupełnia co najmniej cztery naturalne linki przed `CONTENT_READY`.

## Plan ilustracji

Liczba ilustracji wynika z treści. Wymagany jest jeden hero i przynajmniej jeden główny obraz dla każdej merytorycznej sekcji. Jeżeli sekcja naprawdę zyskuje na drugim wykresie, detalu, infografice lub scenie, dodaj kolejne obrazy zamiast ograniczać się do jednego.

- obraz główny sekcji: `sekcja-N`,
- dodatkowe obrazy: `sekcja-N-obraz-2`, `sekcja-N-obraz-3` itd.,
- `filename_base` jest unikalnym kebab-case,
- `source_file` jest zawsze dokładną pojedynczą nazwą, standardowo `${filename_base}.jpeg`; nie twórz równoległych źródeł `.jpeg` i `.jpg`.

```json
{
  "section_ref": "hero|sekcja-1|sekcja-1-obraz-2",
  "filename_base": "slug-krotki-temat",
  "source_file": "slug-krotki-temat.jpeg",
  "topic": "Konkretny temat i scena",
  "technique": "editorial photography|scientific 3D|paper collage|data visualization|infographic|macro photography|architectural lifestyle",
  "composition": "Konkretny kadr, perspektywa i układ",
  "purpose": "Co czytelnik ma zrozumieć i gdzie obraz trafia",
  "aspect_ratio": "16:9",
  "prompt_en": "Pełny prompt po angielsku; ewentualny tekst obrazu pozostaje dokładnie po polsku",
  "overlay_text_pl": "Opcjonalny dokładny polski napis albo pusty tekst",
  "negative_prompt": "Bez logo, watermarku, reklamy, błędnej anatomii, przypadkowych liter i nieudowodnionych liczb",
  "alt_pl": "Konkretny opis obrazu po polsku",
  "caption_pl": "Podpis wyjaśniający związek obrazu z sekcją",
  "visual_review": { "status": "PENDING_LOCAL_REVIEW" }
}
```

Obrazy mają być jasne, optymistyczne, współczesne i prawdziwe. Ludzie to głównie zadbane osoby 50–65 lat ze średniej klasy: naturalne twarze, sylwetki i ubrania, bez ostentacyjnego luksusu oraz bez stereotypu bezradnego seniora. Pokazuj kobiety i mężczyzn, różne pory roku, miasta, nowoczesne biura i przychodnie, domy, naturę, pracę, aktywność i podróż.

Dopuszczalne są fotografie, ilustracje naukowe, anatomiczne 3D, kolaże, wykresy, infografiki, makro i analogie wizualne. Tekst na obrazie może być naturalnym napisem środowiskowym albo celowym, czytelnym napisem graficznym po polsku. Zaplanuj go dokładnie w `overlay_text_pl`; liczba lub claim wymagają dowodu. Przypadkowy bełkot, obcy język, reklama, logo lub myląca informacja nadal blokują obraz.

Wymiary są zakresem, nie pracą mechaniczną: hero ma bezpieczne minimum 1024×560 i zalecenie 1080×600; obrazy sekcji minimum 800×450 i zalecenie 900×500; proporcja krajobrazowa 1.2–2.1. Drobne odchylenie od zalecenia nie blokuje.

Nie wymuszaj sztucznej liczby technik. Seria może być spójna, ale nie może powtarzać tego samego pliku, niemal identycznego kadru ani obrazu bez osobnej wartości. Zakazane są drastyczne zabiegi, upokarzanie, fałszywe „przed i po”, stockowy uścisk lekarza, medycznie błędna anatomia i nieudowodnione obietnice.

## Artykuły `mity`

Zachowaj rytm: nazwij MIT → podaj werdykt FitPo50 → pokaż dowody i mechanizm → wyjaśnij, co działa zamiast. Atakuj twierdzenie, nie ludzi ani firmy. Dodaj semantyczną tabelę `MIT`–`FAKT/DOWODY`. `ClaimReview` proponuj tylko dla jednego precyzyjnego twierdzenia; lokalny pipeline zdecyduje o publikacji.
