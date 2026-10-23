const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  normalizeFaqResearch,
  normalizeImagePromptSectionRef,
  normalizeSectionRole,
  requiredImagePromptPlacements,
  addImagePromptEvidenceClaims,
  validateFaqSourceTypes,
} = require('../scripts/fix-fitpo50-json');

test('JSON fixer preserves allowed provenance required by the FAQ evidence gate', () => {
  const item = {
    question: 'Jak poznać właściwe tempo?',
    source_label: 'CDC — kryterium mowy',
    source_url: 'https://www.cdc.gov/example',
    source_type: 'gsc',
    impressions: 4,
    query: 'CDC talk test walking',
    research_note: 'Ręczny przegląd źródła potwierdził rzeczywiste pytanie i odpowiedź.',
    checked_at: '2026-08-25',
    url_status: 'reachable',
    http_status: 200,
    final_url: 'https://www.cdc.gov/example',
    intent_verified: true,
    verified_suggestion: 'Jak poznać właściwe tempo?',
  };

  assert.deepEqual(normalizeFaqResearch([item]), [item]);
});

test('JSON fixer never accepts manual_research as provenance for a new FAQ', () => {
  assert.match(
    validateFaqSourceTypes([{ source_type: 'manual_research' }]).join('\n'),
    /source_type musi być jednym z: gsc, paa, autocomplete/,
  );
  for (const sourceType of ['gsc', 'paa', 'autocomplete']) {
    assert.deepEqual(validateFaqSourceTypes([{ source_type: sourceType }]), []);
  }
});

test('JSON fixer preserves supplemental section image placement', () => {
  assert.equal(normalizeImagePromptSectionRef('sekcja-2-obraz-3', -1, 4), 'sekcja-2-obraz-3');
  assert.equal(normalizeImagePromptSectionRef('Sekcja-2', -1, 2), 'sekcja-2');
});

test('JSON fixer preserves utility sections and does not invent their image placement', () => {
  assert.equal(normalizeSectionRole('utility'), 'utility');
  assert.equal(normalizeSectionRole('main'), 'main');
  assert.deepEqual(
    [...requiredImagePromptPlacements([{ section_role: 'main' }, { section_role: 'utility' }])],
    ['hero', 'sekcja-1'],
  );
});

test('JSON fixer maps factual image text only to declared article sources', () => {
  const sourceUrl = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10351306/';
  const json = {
    title: 'Zmiana czasu i sen',
    category: 'ciekawe',
    sources: [{ url: sourceUrl }],
    evidence_claims: [],
    sections: [{ image: { alt: 'Wykres snu po zmianie czasu.', caption: 'Dlatego warto obserwować swój sen po zmianie czasu.' } }],
    image_prompts_v4: [{
      section_ref: 'sekcja-1',
      alt_pl: 'Wykres problemów ze snem przed i po zmianie czasu.',
      caption_pl: 'Neutralny podpis bez twierdzenia.',
      overlay_text_pl: 'Kłopot z zasypianiem: 3,3% → 7,1%',
      evidence_source_urls: [sourceUrl, 'https://example.com/undeclared'],
    }],
  };
  addImagePromptEvidenceClaims(json, 'image_prompts_v4');
  assert.deepEqual(json.evidence_claims.map((claim) => claim.location), [
    'image_prompts_v4[0].overlay_text_pl',
    'sections[0].image.alt',
    'sections[0].image.caption',
  ]);
  assert.ok(json.evidence_claims.every((claim) => claim.source_urls.length === 1 && claim.source_urls[0] === sourceUrl));
});

test('JSON fixer blocks an overlong editorial title without silently truncating it', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/zegar.fitpo50.json'), 'utf8'));
  const originalTitle = 'Stłuszczona wątroba bez alkoholu: dlaczego wynik USG wymaga pełnego i spokojnego wyjaśnienia';
  fixture.title = originalTitle;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-title-regression-'));
  const file = path.join(dir, 'title.fitpo50.json');
  try {
    fs.writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
    const result = spawnSync('node', [
      'scripts/fix-fitpo50-json.js',
      '--file', file,
      '--write', 'true',
      '--allow-outside-repo', 'true',
    ], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /title: przekracza 65 znaków/);
    assert.equal(after.title, originalTitle);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
