const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const { validateArticleEvidence } = require('../scripts/lib/article-evidence');
const { validateArticleArchitecture } = require('../scripts/lib/article-intent-links');
const { validateManifestStructure } = require('../scripts/lib/article-media');
const { validators } = require('../scripts/lib/article-policy');
const { isPdfFile, validateSemanticTableMarkup } = require('../scripts/article-preview-gate');
const { validateAboutEntities } = require('../scripts/lib/entity-sameas-policy');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'pipeline-invalid');
const ANSWER_FIRST_FIXTURE = path.join(__dirname, 'fixtures', 'answer-first-cases.json');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.fitpo50.json`), 'utf8'));
}

function answerFirstCases() {
  return JSON.parse(fs.readFileSync(ANSWER_FIRST_FIXTURE, 'utf8'));
}

test('końcowa macierz błędnych JSON-ów zawiera wszystkie osiem wymaganych blokad', () => {
  const expected = new Set([
    'fake_source', 'generic_quick_answer', 'artificial_faq', 'nonexistent_internal_link',
    'missing_images', 'bad_semantic_table', 'broken_pdf', 'slug_collision',
  ]);
  const actual = new Set(fs.readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.fitpo50.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')).expected_blocker));
  assert.deepEqual(actual, expected);
});

test('globalny diff gate nie traktuje celowo błędnych fixture jako draftów publikacyjnych', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'json-fitpo50-gate-diff.js'), 'utf8');
  assert.match(source, /tests\/fixtures\/pipeline-invalid\//);
  assert.match(source, /!isIntentionalInvalidFixture\(file\)/);
});

test('wspólna polityka encji blokuje fałszywe sameAs i dopuszcza name-only oraz Q43656', () => {
  assert.deepEqual(validateAboutEntities([{ '@type': 'Thing', name: 'Diabetes' }]), []);
  assert.deepEqual(validateAboutEntities([{ '@type': 'Thing', name: 'Cholesterol', sameAs: 'https://www.wikidata.org/wiki/Q43656' }]), []);
  assert.match(validateAboutEntities([{ '@type': 'Thing', name: 'Diabetes', sameAs: 'https://www.wikidata.org/wiki/Q12204' }]).join('\n'), /Niezarejestrowana/);
});

test('pipeline blokuje fałszywe albo niedziałające źródło', () => {
  const result = validateArticleEvidence(fixture('fake-source'), { today: '2026-08-24' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /url_status|silnego źródła|dekoracyjna lista źródeł/);
});

test('bibliografia JSON blokuje wyniki wyszukiwania nawet z HTTP 200', () => {
  const json = fixture('fake-source');
  json.sources = [{ url: 'https://pubmed.ncbi.nlm.nih.gov/?term=fascia', label: 'Badania', evidence_level: 'systematic_review', checked_at: '2026-08-24', url_status: 'reachable', http_status: 200 }];
  const result = validateArticleEvidence(json, { today: '2026-08-24' });
  assert.match(result.errors.join('\n'), /wyniki wyszukiwania/);
});

test('reachable nie zastępuje poprawnego kodu HTTP', () => {
  const json = fixture('fake-source');
  json.sources = [{ url: 'https://pubmed.ncbi.nlm.nih.gov/25603749/', label: 'Badanie', evidence_level: 'systematic_review', checked_at: '2026-08-24', url_status: 'reachable', http_status: 503 }];
  const result = validateArticleEvidence(json, { today: '2026-08-24' });
  assert.match(result.errors.join('\n'), /HTTP.*503/);
});

test('pipeline blokuje generyczny quick answer', () => {
  const result = validators.validateQuickAnswer(fixture('generic-quick-answer').quick_answer);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /generyczna/);
});

test('answer-first accepts complete short and valuable long answers without strict 30-70 blocking', () => {
  const cases = answerFirstCases();
  const shortResult = validators.validateAnswerFirstParagraph(cases.short_complete.paragraph, { heading: cases.short_complete.heading });
  const longResult = validators.validateAnswerFirstParagraph(cases.long_valuable.paragraph, { heading: cases.long_valuable.heading });
  assert.equal(shortResult.ok, true);
  assert.equal(longResult.ok, true);
  assert.ok(shortResult.warnings.length > 0);
});

test('answer-first blocks generic, repeated, missing and unfinished opening answers', () => {
  const cases = answerFirstCases();
  const generic = validators.validateAnswerFirstParagraph(cases.generic_text.paragraph, { heading: cases.generic_text.heading });
  assert.equal(generic.ok, false);
  assert.match(generic.errors.join('\n'), /generyczna/);

  const repeated = validators.validateAnswerFirstParagraph(cases.repeated_lead.paragraph, {
    heading: cases.repeated_lead.heading,
    lead: cases.repeated_lead.lead,
  });
  assert.equal(repeated.ok, false);
  assert.match(repeated.errors.join('\n'), /kopią 1:1 leadu/);

  const missing = validators.validateAnswerFirstParagraph(cases.missing_answer.paragraph, { heading: cases.missing_answer.heading });
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join('\n'), /brak bezpośredniej odpowiedzi/);

  const unfinished = validators.validateAnswerFirstParagraph('Tak, bo', { heading: 'Czy to działa?' });
  assert.equal(unfinished.ok, false);
  assert.match(unfinished.errors.join('\n'), /niedomkniętą myśl|zbyt krótka/);
});

test('article validator rejects a non-paragraph element before the answer-first paragraph', () => {
  const cases = answerFirstCases();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-answer-first-dom-'));
  try {
    const htmlPath = path.join(dir, 'dom.html');
    fs.writeFileSync(htmlPath, `<!doctype html><html><head><title>Test answer-first | FitPo50</title></head><body class="article-template"><article class="article-content"><h2>${cases.element_before_paragraph.heading}</h2>${cases.element_before_paragraph.html}</article></body></html>`);
    const { validateFile } = require('../scripts/validate-article-standard');
    const result = validateFile(htmlPath);
    assert.match(result.errors.join('\n'), /pierwszy istotny element po H2 to <figure>/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('answer-first accepts a clear prior antecedent and blocks a vague opening reference', () => {
  const cases = answerFirstCases();
  const clear = validators.validateAnswerFirstParagraph(cases.clear_antecedent.paragraph, { heading: cases.clear_antecedent.heading });
  const clearWithBridge = validators.validateAnswerFirstParagraph(cases.clear_antecedent_with_bridge.paragraph, { heading: cases.clear_antecedent_with_bridge.heading });
  const vague = validators.validateAnswerFirstParagraph(cases.vague_without_antecedent.paragraph, { heading: cases.vague_without_antecedent.heading });
  assert.equal(clear.ok, true);
  assert.equal(clearWithBridge.ok, true);
  assert.equal(vague.ok, false);
  assert.match(vague.errors.join('\n'), /skrót logiczny bez lokalnego kontekstu/);
});

test('article validator does not add a missing-H2 error when eligible headings fail DOM order', () => {
  const cases = answerFirstCases();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-answer-first-diagnostic-'));
  try {
    const htmlPath = path.join(dir, 'dom.html');
    fs.writeFileSync(htmlPath, `<!doctype html><html><head><title>Test answer-first | FitPo50</title></head><body class="article-template"><article class="article-content"><h2>${cases.element_before_paragraph.heading}</h2>${cases.element_before_paragraph.html}</article></body></html>`);
    const { validateFile } = require('../scripts/validate-article-standard');
    const result = validateFile(htmlPath);
    assert.match(result.errors.join('\n'), /pierwszy istotny element po H2 to <figure>/);
    assert.doesNotMatch(result.errors.join('\n'), /Nie znaleziono sekcji H2/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('pipeline blokuje sztuczne FAQ oznaczone jako wariant', () => {
  const result = validateArticleEvidence(fixture('artificial-faq'), { today: '2026-08-24' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /wariant N/);
});

test('pipeline blokuje link do celu, którego nie ma w lokalnym inventory', () => {
  const result = validateArticleArchitecture(fixture('nonexistent-link'), { root: ROOT });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /nie istnieje|inventory|target/i);
});

test('pipeline blokuje brakujące obrazy i warianty manifestu', () => {
  const result = validateManifestStructure(fixture('missing-images'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /wymagane|placement|media_manifest/);
});

test('pipeline blokuje tabelę narysowaną bez semantycznej struktury', () => {
  const article = fixture('bad-table');
  const html = article.sections.flatMap((section) => section.paragraphs_html || []).join('\n');
  const errors = validateSemanticTableMarkup(html);
  assert.match(errors.join('\n'), /brak caption/);
  assert.match(errors.join('\n'), /brak thead/);
  assert.match(errors.join('\n'), /brak tbody/);
  assert.match(errors.join('\n'), /brak nagłówków th/);
});

test('pipeline blokuje plik udający PDF', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-broken-pdf-'));
  try {
    const data = fixture('broken-pdf');
    const file = path.join(dir, `${data.slug}.pdf`);
    fs.writeFileSync(file, data.pdf_fixture_content);
    assert.equal(isPdfFile(file), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('pipeline zatrzymuje kolizję slugu przy domyślnym force=false', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-slug-collision-'));
  try {
    const input = path.join(dir, 'collision.json');
    fs.copyFileSync(path.join(FIXTURES, 'slug-collision.fitpo50.json'), input);
    const outputDir = path.join(dir, 'ready');
    const result = spawnSync('node', ['scripts/article-json-workbench.js', '--file', input, '--output-dir', outputDir], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(result.status, 2);
    const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'apob-norma-cena-jak-czytac-wynik.fitpo50.report.json'), 'utf8'));
    assert.equal(report.status, 'BLOCKED');
    assert.match(report.blockers.join('\n'), /force=false|już istnieje/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
