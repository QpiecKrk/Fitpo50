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
    prompt_en: 'Bright optimistic modern documentary scene with middle-class adults aged over fifty, natural light and credible details.',
    alt_pl: 'Jasna scena ilustrująca temat artykułu i jego praktyczne znaczenie',
    caption_pl: 'Ilustracja pokazuje praktyczny kontekst informacji wyjaśnionych w tej części artykułu.',
    negative_prompt: 'dark mood, fear, distorted anatomy, fake medical equipment',
    filename_base: filenameBase,
    source_file: `${filenameBase}.jpeg`,
    aspect_ratio: '16:9',
    overlay_text_pl: '',
    visual_review: { status: 'PENDING_LOCAL_REVIEW' },
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
    })),
    evidence_claims: claims.map((claim, index) => ({
      claim, location: 'sections[0].paragraphs_html[0]', claim_type: 'general', source_urls: [urls[index]],
    })),
    logic_links: [],
    answer_blocks: [],
    faq_research: [],
    image_prompts_v4: [prompt('hero', 'ocena-informacji-hero'), prompt('sekcja-1', 'ocena-sily-informacji'), prompt('sekcja-1-obraz-2', 'ocena-sily-wykres')],
  };
}

function validate(payload) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-skill-test-'));
  const file = path.join(directory, 'draft.fitpo50.json');
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return spawnSync('python3', [VALIDATOR, file], { cwd: ROOT, encoding: 'utf8' });
}

test('Claude draft skill accepts flexible supplemental images and local FAQ/link tasks', () => {
  const result = validate(validDraft());
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /DRAFT_(?:VALID|REVIEW_REQUIRED)/);
});

test('Claude draft skill rejects generated FAQ because local agent owns final FAQ', () => {
  const draft = validDraft();
  draft.answer_blocks = [{ question: 'Czy to działa?', answer_html: '<p>Tak.</p>' }];
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /answer_blocks musi pozostać puste/);
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

test('Claude draft skill keeps FAQ research and internal linking exclusively local', () => {
  const draft = validDraft();
  draft.editorial_notes.faq_gaps = ['Czy użytkownicy pytają o czas działania?'];
  draft.sections[0].paragraphs_html.push('<p>Zobacz też <a href="wymyslony-slug.html">inny tekst</a>.</p>');
  const result = validate(draft);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /editorial_notes\.faq_gaps musi pozostać puste/);
  assert.match(result.stdout, /Claude nie może dodawać linków wewnętrznych/);
});
