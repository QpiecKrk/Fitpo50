const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { normalizeFaqResearch } = require('../scripts/import-article');

test('importer preserves FAQ v2 provenance fields', () => {
  const question = 'Jak sprawdzić pytanie użytkownika?';
  const [normalized] = normalizeFaqResearch([{
    question,
    sourceLabel: 'Dane GSC strony',
    sourceUrl: 'https://example.org/gsc-evidence',
    sourceType: 'gsc',
    query: question,
    impressions: 3,
    researchNote: 'Pytanie pochodzi z rzeczywistego raportu zapytań.',
    checkedAt: '2026-10-23',
    urlStatus: 'reachable',
    httpStatus: 200,
  }]);
  assert.equal(normalized.source_type, 'gsc');
  assert.equal(normalized.query, question);
  assert.equal(normalized.impressions, 3);
  assert.equal(normalized.research_note, 'Pytanie pochodzi z rzeczywistego raportu zapytań.');
});

test('import-article precheck accepts faq_research in camelCase after normalization', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const source = path.join(repoRoot, 'data/import/archive/2026-06-15/apob-norma-cena-jak-czytac-wynik.fitpo50.json');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-faq-regression-'));
  const workFile = path.join(tmpDir, 'article.fitpo50.json');

  const json = JSON.parse(fs.readFileSync(source, 'utf8'));
  json.title = 'ApoB po 50: norma, cena i interpretacja wyniku krok po kroku';
  json.faq_research = (Array.isArray(json.faq_research) ? json.faq_research : []).map((item) => ({
    question: item.question,
    sourceLabel: item.source_label || item.sourceLabel || item.label || '',
    sourceUrl: item.source_url || item.sourceUrl || item.url || '',
  }));
  fs.writeFileSync(workFile, `${JSON.stringify(json, null, 2)}\n`);

  const result = spawnSync(
    'node',
    ['scripts/import-article.js', '--file', workFile, '--precheck', 'true'],
    { cwd: repoRoot, encoding: 'utf8' }
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /FAQ research #\d+: source_label jest zbyt ogólny\./);
  assert.doesNotMatch(result.stdout, /FAQ research #\d+: source_url musi zaczynać się od http\/https\./);
  assert.match(result.stdout, /Czy mogę użyć importera teraz: NIE/);
  assert.match(result.stdout, /Brak evidence_claims/);
});
