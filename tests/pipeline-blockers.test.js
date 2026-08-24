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

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'pipeline-invalid');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.fitpo50.json`), 'utf8'));
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

test('pipeline blokuje fałszywe albo niedziałające źródło', () => {
  const result = validateArticleEvidence(fixture('fake-source'), { today: '2026-08-24' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /url_status|silnego źródła|dekoracyjna lista źródeł/);
});

test('pipeline blokuje generyczny quick answer', () => {
  const result = validators.validateQuickAnswer(fixture('generic-quick-answer').quick_answer);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /generyczna/);
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
