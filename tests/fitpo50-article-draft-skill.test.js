const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VALIDATOR = path.join(ROOT, 'docs/skills/fitpo50-article-draft/scripts/validate_fitpo50_draft.py');

function prompt(sectionRef, filenameBase) {
  return {
    section_ref: sectionRef,
    topic: 'Jasna i nowoczesna scena pokazująca temat artykułu osobom po pięćdziesiątce',
    technique: 'fotografia dokumentalna',
    composition: 'poziomy szeroki plan z czytelnym punktem skupienia',
    purpose: 'wyjaśnienie omawianego mechanizmu',
    season_and_time: 'Wiosenny poranek w naturalnym świetle',
    mood: 'Pogodny i spokojny',
    prompt_en: 'Bright optimistic modern documentary scene with middle-class adults aged over fifty, natural light and credible details.',
    alt_pl: 'Jasna scena ilustrująca temat artykułu i jego praktyczne znaczenie',
    caption_pl: 'Ilustracja pokazuje praktyczny kontekst informacji wyjaśnionych w tej części artykułu.',
    negative_prompt: 'dark mood, fear, distorted anatomy, fake medical equipment',
    filename_base: filenameBase,
    source_file: `${filenameBase}.jpg`,
    aspect_ratio: '16:9',
    overlay_text_pl: '',
    evidence_source_urls: [],
    requires_exact_data_render: false,
    visual_review: { status: 'PENDING_LOCAL_REVIEW' },
  };
}

function faqPair(question) {
  return {
    answer: {
      question,
      answer_html: '<p>Sprawdź autora, metodę, badaną populację oraz ograniczenia opisane przy wyniku.</p>',
    },
    research: {
      question,
      source_type: 'autocomplete',
      source_label: 'Google Autocomplete PL',
      source_url: `https://suggestqueries.google.com/complete/search?client=firefox&hl=pl&q=${encodeURIComponent(question)}`,
      checked_at: new Date().toISOString().slice(0, 10),
      url_status: 'reachable',
      http_status: 200,
      research_note: 'Pytanie wystąpiło jako dokładna podpowiedź w pobranej odpowiedzi Google Suggest.',
    },
  };
}

function validDraft() {
  const description = 'Sprawdź, jak oceniać nowe informacje zdrowotne po 50. roku życia, odróżniać mocne dowody od obietnic i przygotować pytania do specjalisty na wizytę.';
  assert.ok(description.length >= 145 && description.length <= 160);
  const urls = [1, 2, 3, 4].map((id) => `https://pubmed.ncbi.nlm.nih.gov/${id}/`);
  const claims = [
    'Aktualne wytyczne pomagają uporządkować bezpieczną decyzję.',
    'Badania porównawcze pokazują istotne ograniczenia ocenianych metod.',
    'Wynik grupowy nie przewiduje pewnie wyniku jednej osoby.',
    'Rozmowa ze specjalistą pozwala uwzględnić indywidualne przeciwwskazania.',
  ];
  const today = new Date().toISOString().slice(0, 10);
  const faqs = [
    faqPair('Jak ocenić wiarygodność informacji zdrowotnej?'),
    faqPair('Czy wynik jednego badania wystarczy do podjęcia decyzji?'),
    faqPair('Jak sprawdzić, czy badanie dotyczy osób po 50 roku życia?'),
  ];
  return {
    status: 'DRAFT',
    title: 'Jak rozsądnie oceniać informacje zdrowotne po 50. roku życia?',
    seo_title: 'Jak oceniać informacje zdrowotne po 50?',
    og_title: 'Jak oceniać informacje zdrowotne po 50?',
    twitter_title: 'Jak oceniać informacje zdrowotne po 50?',
    slug: 'jak-oceniac-informacje-zdrowotne-po-50',
    category: 'zdrowie',
    meta_description: description,
    og_description: description,
    twitter_description: description,
    schema_blogposting_description: description,
    listing_title: 'Jak oceniać informacje zdrowotne po 50. roku życia',
    listing_desc: 'Praktyczny przewodnik po ocenie dowodów, ograniczeń i pytań do specjalisty.',
    lead: 'Nowa informacja zdrowotna ma sens dopiero wtedy, gdy wiadomo, skąd pochodzi, czego dotyczy i czego jeszcze nie dowodzi.',
    quick_answer: 'Najpierw sprawdź źródło, rodzaj badania i grupę uczestników. Potem oddziel wynik statystyczny od obietnicy dla jednej osoby oraz zobacz, czy autorzy opisali ograniczenia. Jeśli informacja może zmienić leczenie, suplementację albo diagnostykę, przygotuj pytania i omów je ze specjalistą znającym Twoją sytuację i możliwe działania niepożądane terapii.',
    reading_time: '7 min czytania',
    hero_motto_html: '<em>Najpierw dowód, potem decyzja.</em>',
    search_intent: 'how-to',
    primary_keyword: 'informacje zdrowotne',
    supporting_keywords: ['jak ocenić badanie', 'wiarygodne źródła medyczne', 'rozmowa z lekarzem'],
    key_takeaways: ['Sprawdź źródło.', 'Oceń metodę.', 'Uwzględnij ograniczenia.', 'Skonsultuj decyzję.'],
    editorial_notes: {
      uncertain_claims: [], missing_evidence: [], faq_gaps: [], medical_risks: [], assumptions: [],
      local_pipeline_tasks: ['Lokalny agent wykonuje finalny research FAQ.', 'Lokalny agent przygotowuje linkowanie wewnętrzne.'],
    },
    sections: [{
      title: 'Jak ocenić siłę informacji?',
      paragraphs_html: [`<p>${claims.join(' ')}</p>`, '<p>Najpierw ustal, czy publikacja odpowiada na pytanie podobne do Twojego i czy opisuje ograniczenia.</p>'],
      list_items: ['Sprawdź autora i instytucję.', 'Przeczytaj opis metody.'],
      evidence_source_ids: ['S1', 'S2', 'S3', 'S4'],
    }],
    sources: urls.map((url, index) => ({
      id: `S${index + 1}`, label: `Oficjalne źródło dowodowe numer ${index + 1}`, url,
      evidence_level: 'official_guidance', checked_at: today, url_status: 'reachable', http_status: 200,
      fallback_url: null, evidence_scope: null, publication_date: null, checked_via: 'writer_http', recheck_after: null,
    })),
    evidence_claims: claims.map((claim, index) => ({
      claim, location: 'sections[0].paragraphs_html[0]', claim_type: 'general', source_urls: [urls[index]],
    })),
    logic_links: [],
    answer_blocks: faqs.map((item) => item.answer),
    faq_research: faqs.map((item) => item.research),
    image_prompts_v4: [prompt('hero', 'ocena-informacji-hero-v1'), prompt('sekcja-1', 'ocena-sily-informacji-v1'), prompt('sekcja-1-obraz-2', 'ocena-sily-wykres-v1')],
  };
}

function validate(payload, extraArgs = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-skill-test-'));
  const file = path.join(directory, 'draft.fitpo50.json');
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return spawnSync('python3', [VALIDATOR, ...extraArgs, file], { cwd: ROOT, encoding: 'utf8' });
}

test('local workbench may revalidate a genuinely reviewed package without pretending the Writer reviewed it', () => {
  const draft = validDraft();
  draft.image_prompts_v4.forEach((item) => { item.visual_review.status = 'VERIFIED'; });
  assert.notEqual(validate(draft).status, 0);
  assert.equal(validate(draft, ['--allow-verified-review']).status, 0);
});

test('Claude draft skill accepts flexible supplemental images and local FAQ/link tasks', () => {
  const result = validate(validDraft());
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /DRAFT_(?:VALID|REVIEW_REQUIRED)/);
});

test('exact-data overlay claim still blocks when source_url is absent from sources', () => {
  const draft = validDraft();
  const exact = draft.image_prompts_v4[0];
  exact.requires_exact_data_render = true;
  exact.overlay_text_pl = 'Wynik 12,9% po zmianie czasu';
  exact.overlay_claims = [{ claim: exact.overlay_text_pl, source_url: 'https://example.org/not-declared' }];
  const result = validate(draft);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /overlay_claims\[0\]\.source_url musi występować w sources/);
});

test('Claude draft validator nie liczy skrótów i liczb dziesiętnych jako zdań', () => {
  const draft = validDraft();
  draft.quick_answer = 'Zacznij od ok. 3 g dziennie, jeśli taki zakres wynika z ocenionego planu. Np. 2,5 g nie tworzy dodatkowego zdania.';
  const result = validate(draft);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /quick_answer ma .* zdań/);
});

test('Claude draft skill accepts documented FAQ and leaves local verification to the pipeline', () => {
  const draft = validDraft();
  const result = validate(draft);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('Claude draft validator enforces shared GSC and PAA FAQ provenance requirements', () => {
  const invalid = validDraft();
  invalid.faq_research[0].source_type = 'gsc';
  invalid.faq_research[1].source_type = 'paa';
  const rejected = validate(invalid);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stdout, /GSC wymaga query oraz impressions >= 1/);
  assert.match(rejected.stdout, /PAA wymaga query i research_note \(min\. 20 znaków\)/);

  invalid.faq_research[0].query = invalid.faq_research[0].question;
  invalid.faq_research[0].impressions = 1;
  invalid.faq_research[1].query = invalid.faq_research[1].question;
  const accepted = validate(invalid);
  assert.equal(accepted.status, 0, `${accepted.stdout}\n${accepted.stderr}`);
});

test('Claude draft skill accepts any FAQ count when every item has documented research', () => {
  const tooFew = validDraft();
  tooFew.answer_blocks = tooFew.answer_blocks.slice(0, 2);
  tooFew.faq_research = tooFew.faq_research.slice(0, 2);
  const first = validate(tooFew);
  assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);

  const tooMany = validDraft();
  for (let index = 4; index <= 8; index += 1) {
    const pair = faqPair(`Jak ocenić dodatkowe pytanie numer ${index}?`);
    tooMany.answer_blocks.push(pair.answer);
    tooMany.faq_research.push(pair.research);
  }
  const second = validate(tooMany);
  assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);

  const none = validDraft();
  none.answer_blocks = [];
  none.faq_research = [];
  const third = validate(none);
  assert.equal(third.status, 0, `${third.stdout}\n${third.stderr}`);
});

test('Claude draft skill reserves FAQ verification fields for the local pipeline', () => {
  const draft = validDraft();
  draft.faq_research[0].intent_verified = true;
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /nie może zawierać lokalnego pola intent_verified/);
});

test('Claude draft skill requires versioned JPG source names for Illustrator handoff', () => {
  const draft = validDraft();
  draft.image_prompts_v4[0].filename_base = 'ocena-informacji-hero';
  draft.image_prompts_v4[0].source_file = 'ocena-informacji-hero.jpeg';
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /kończyć się wersją -vN/);
  assert.match(result.stdout, /filename_base \+ \.jpg/);
});

test('Claude draft skill rejects an evidence-bearing image caption without declared sources', () => {
  const draft = validDraft();
  draft.image_prompts_v4[0].caption_pl = 'Dlatego ten wynik zmniejsza ryzyko zawału o 20%.';
  draft.image_prompts_v4[0].evidence_source_urls = [];
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /caption_pl zawiera wniosek, liczbę lub tezę medyczną/);
});

test('Claude draft skill rejects FAQ without a matching research record', () => {
  const draft = validDraft();
  draft.answer_blocks = [{ question: 'Czy to działa?', answer_html: '<p>Tak, jeśli twierdzenie potwierdza właściwe badanie.</p>' }];
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /odpowiadać sobie 1:1|nie ma dopasowania 1:1/);
});

test('Claude draft skill rejects MASLD-class structural mismatches before local import', () => {
  const draft = validDraft();
  draft.title = 'Stłuszczona wątroba bez alkoholu: dlaczego wynik USG wymaga pełnego i spokojnego wyjaśnienia';
  draft.search_intent = 'praktyczna edukacja pacjenta po wyniku USG';
  draft.key_takeaways.push('Piąty wniosek zostałby później obcięty przez fixer.');
  draft.sources[0].http_status = 403;
  draft.evidence_claims[0].claim = 'Wytyczne pomagają.';
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /title ma .*maksimum to 65/);
  assert.match(result.stdout, /search_intent musi być jednym z/);
  assert.match(result.stdout, /key_takeaways musi zawierać dokładnie 4/);
  assert.match(result.stdout, /końcowego HTTP 2xx/);
  assert.match(result.stdout, /claim musi zawierać co najmniej 5 słów/);
});

test('Claude draft skill rejects stale evidence locations and nested semantic blocks', () => {
  const draft = validDraft();
  draft.evidence_claims[0].location = 'key_takeaways[4]';
  draft.sections[0].paragraphs_html[1] = '<p><div class="article-table-wrap"><table class="article-table"><caption>Plan</caption><thead><tr><th scope="col">Krok</th></tr></thead><tbody><tr><th scope="row">1</th></tr></tbody></table></div></p>';
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /location nie wskazuje istniejącego pola/);
  assert.match(result.stdout, /blok semantyczny wewnątrz <p>/);
});

test('Claude draft skill keeps internal linking local and reports unresolved FAQ gaps', () => {
  const draft = validDraft();
  draft.editorial_notes.faq_gaps = ['Czy użytkownicy pytają o czas działania?'];
  draft.sections[0].paragraphs_html.push('<p>Zobacz też <a href="wymyslony-slug.html">inny tekst</a>.</p>');
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /nierozstrzygnięte pytania/);
  assert.match(result.stdout, /Claude nie może dodawać linków wewnętrznych/);
});
