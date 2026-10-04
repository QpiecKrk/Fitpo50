const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { normalizeFaqResearch, normalizeImagePromptSectionRef } = require('../scripts/fix-fitpo50-json');

test('JSON fixer preserves provenance required by the FAQ evidence gate', () => {
  const item = {
    question: 'Jak poznać właściwe tempo?',
    source_label: 'CDC — kryterium mowy',
    source_url: 'https://www.cdc.gov/example',
    source_type: 'manual_research',
    query: 'CDC talk test walking',
    research_note: 'Ręczny przegląd źródła potwierdził rzeczywiste pytanie i odpowiedź.',
    checked_at: '2026-08-25',
    url_status: 'reachable',
    http_status: 200,
    final_url: 'https://www.cdc.gov/example',
  };

  assert.deepEqual(normalizeFaqResearch([item]), [item]);
});

test('JSON fixer preserves supplemental section image placement', () => {
  assert.equal(normalizeImagePromptSectionRef('sekcja-2-obraz-3', -1, 4), 'sekcja-2-obraz-3');
  assert.equal(normalizeImagePromptSectionRef('Sekcja-2', -1, 2), 'sekcja-2');
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
