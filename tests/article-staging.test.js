const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  cloneEntry,
  promoteStaging,
  promotionCandidates,
  snapshotCandidates,
} = require('../scripts/lib/article-staging');
const { multisetCoverage, normalizeWords } = require('../scripts/article-preview-gate');

function temp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('staging jest kopią niezależną i pomija .git oraz node_modules', () => {
  const source = temp('fitpo50-stage-source-');
  const stage = temp('fitpo50-stage-target-');
  fs.mkdirSync(path.join(source, '.git'));
  fs.mkdirSync(path.join(source, 'node_modules'));
  fs.writeFileSync(path.join(source, '.git', 'config'), 'secret');
  fs.writeFileSync(path.join(source, 'node_modules', 'package'), 'dependency');
  fs.writeFileSync(path.join(source, 'article.html'), 'wersja publiczna');
  cloneEntry(source, stage);
  fs.writeFileSync(path.join(stage, 'article.html'), 'wersja stagingowa');
  assert.equal(fs.readFileSync(path.join(source, 'article.html'), 'utf8'), 'wersja publiczna');
  assert.equal(fs.existsSync(path.join(stage, '.git')), false);
  assert.equal(fs.existsSync(path.join(stage, 'node_modules')), false);
});

test('promocja kopiuje tylko zmienione pliki po sprawdzeniu baseline', () => {
  const source = temp('fitpo50-live-');
  const stage = temp('fitpo50-preview-');
  fs.writeFileSync(path.join(source, 'article.html'), 'old');
  fs.writeFileSync(path.join(stage, 'article.html'), 'new');
  fs.writeFileSync(path.join(stage, 'untouched.html'), 'ignored');
  const candidates = ['article.html'];
  const baseline = snapshotCandidates(source, candidates);
  const changed = promoteStaging({ sourceRoot: source, stageRoot: stage, candidates, baseline });
  assert.deepEqual(changed, ['article.html']);
  assert.equal(fs.readFileSync(path.join(source, 'article.html'), 'utf8'), 'new');
  assert.equal(fs.existsSync(path.join(source, 'untouched.html')), false);
});

test('promocja zatrzymuje nadpisanie zmiany wykonanej podczas stagingu', () => {
  const source = temp('fitpo50-live-conflict-');
  const stage = temp('fitpo50-preview-conflict-');
  fs.writeFileSync(path.join(source, 'article.html'), 'old');
  fs.writeFileSync(path.join(stage, 'article.html'), 'preview');
  const candidates = ['article.html'];
  const baseline = snapshotCandidates(source, candidates);
  fs.writeFileSync(path.join(source, 'article.html'), 'user change');
  assert.throws(
    () => promoteStaging({ sourceRoot: source, stageRoot: stage, candidates, baseline }),
    /zmieniło się podczas stagingu/,
  );
  assert.equal(fs.readFileSync(path.join(source, 'article.html'), 'utf8'), 'user change');
});

test('lista promocji obejmuje HTML, PDF, raport i dokładne warianty mediów', () => {
  const candidates = promotionCandidates({
    slug: 'nowy-artykul',
    category: 'zdrowie',
    media_manifest: { entries: [{ variants: {
      jpg: { file: 'nowy-hero.jpg' }, webp: { file: 'nowy-hero.webp' }, avif: { file: 'nowy-hero.avif' },
    } }] },
  });
  for (const required of [
    'nowy-artykul.html', '_site/nowy-artykul.html', 'assets/pdf/nowy-artykul.pdf',
    'data/reports/article-preview/nowy-artykul.json', 'zdrowie.html',
    'assets/nowy-hero.avif', '_site/assets/nowy-hero.avif',
  ]) assert.ok(candidates.includes(required), required);
});

test('porównanie HTML i PDF uwzględnia liczbę wystąpień słów', () => {
  const expected = normalizeWords('trening siłowy trening po pięćdziesiątce');
  const full = normalizeWords('FitPo50 trening siłowy trening po pięćdziesiątce źródło');
  const missing = normalizeWords('trening siłowy po pięćdziesiątce');
  assert.equal(multisetCoverage(expected, full), 1);
  assert.equal(multisetCoverage(expected, missing), 0.8);
});
