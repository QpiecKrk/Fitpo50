const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  beginPromotionTransaction,
  cloneEntry,
  promoteStaging,
  promotionCandidates,
  recoverInterruptedTransactions,
  snapshotCandidates,
  validatePublicationSet,
  writePublicationManifest,
} = require('../scripts/lib/article-staging');
const { multisetCoverage, normalizeWords } = require('../scripts/article-preview-gate');
const { deriveCategory } = require('../scripts/generate-search-index');

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

test('transakcja odrzuca slug i ścieżki wychodzące poza repozytorium', () => {
  assert.throws(() => promotionCandidates({ slug: '../../escape', category: 'zdrowie' }), /niedozwoloną nazwę/);
  const source = temp('fitpo50-path-live-');
  assert.throws(() => snapshotCandidates(source, ['../escape.html']), /Niedozwolona ścieżka/);
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
    'data/reports/article-publications/nowy-artykul.json',
    'assets/data/search-index.json', '_site/assets/data/search-index.json',
    'llms-full.txt', '_site/llms-full.txt',
    'assets/nowy-hero.avif', '_site/assets/nowy-hero.avif',
  ]) assert.ok(candidates.includes(required), required);
});

test('transakcja utrzymuje backup do walidacji i cofa cały zestaw po błędzie', () => {
  const source = temp('fitpo50-transaction-live-');
  const stage = temp('fitpo50-transaction-stage-');
  fs.writeFileSync(path.join(source, 'article.html'), 'old article');
  fs.writeFileSync(path.join(stage, 'article.html'), 'new article');
  fs.writeFileSync(path.join(stage, 'created.html'), 'new listing');
  const candidates = ['article.html', 'created.html'];
  const baseline = snapshotCandidates(source, candidates);
  const transaction = beginPromotionTransaction({
    sourceRoot: source,
    stageRoot: stage,
    candidates,
    baseline,
    transactionId: 'rollback-test',
  });
  assert.equal(fs.readFileSync(path.join(source, 'article.html'), 'utf8'), 'new article');
  assert.equal(fs.readFileSync(path.join(source, 'created.html'), 'utf8'), 'new listing');
  transaction.rollback('validator failed');
  assert.equal(fs.readFileSync(path.join(source, 'article.html'), 'utf8'), 'old article');
  assert.equal(fs.existsSync(path.join(source, 'created.html')), false);
  assert.equal(fs.existsSync(path.join(source, '.tmp', 'article-publication.lock')), false);
});

test('następne uruchomienie odzyskuje publikację przerwaną po promocji', () => {
  const source = temp('fitpo50-recovery-live-');
  const stage = temp('fitpo50-recovery-stage-');
  fs.writeFileSync(path.join(source, 'article.html'), 'before crash');
  fs.writeFileSync(path.join(stage, 'article.html'), 'after crash');
  const candidates = ['article.html'];
  const baseline = snapshotCandidates(source, candidates);
  beginPromotionTransaction({
    sourceRoot: source,
    stageRoot: stage,
    candidates,
    baseline,
    transactionId: 'crash-test',
  });
  const lockPath = path.join(source, '.tmp', 'article-publication.lock');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  fs.writeFileSync(lockPath, `${JSON.stringify({ ...lock, pid: 99999999 }, null, 2)}\n`);
  const recovered = recoverInterruptedTransactions(source);
  assert.deepEqual(recovered, ['crash-test']);
  assert.equal(fs.readFileSync(path.join(source, 'article.html'), 'utf8'), 'before crash');
  assert.equal(fs.existsSync(lockPath), false);
});

test('manifest rozróżnia CREATE i zapisuje dokładne hashe publikowanych plików', () => {
  const source = temp('fitpo50-manifest-live-');
  const stage = temp('fitpo50-manifest-stage-');
  fs.mkdirSync(path.join(stage, '_site'), { recursive: true });
  fs.writeFileSync(path.join(stage, 'fresh.html'), 'fresh source');
  fs.writeFileSync(path.join(stage, '_site', 'fresh.html'), 'fresh source');
  const article = { slug: 'fresh', category: 'ciekawe', media_manifest: { entries: [] } };
  const candidates = promotionCandidates(article);
  const baseline = snapshotCandidates(source, candidates);
  const result = writePublicationManifest({
    stageRoot: stage,
    article,
    candidates,
    baseline,
    transactionId: 'manifest-test',
  });
  assert.equal(result.payload.operation, 'CREATE');
  assert.equal(result.payload.files_count, 2);
  assert.deepEqual(result.payload.files.map((file) => file.path), ['fresh.html', '_site/fresh.html']);
  assert.ok(result.payload.files.every((file) => file.action === 'CREATE' && file.after_sha256));
});

test('manifest oznacza istniejący artykuł jako UPDATE i zachowuje hash poprzedniej wersji', () => {
  const source = temp('fitpo50-manifest-update-live-');
  const stage = temp('fitpo50-manifest-update-stage-');
  fs.writeFileSync(path.join(source, 'existing.html'), 'old');
  fs.writeFileSync(path.join(stage, 'existing.html'), 'new');
  const article = { slug: 'existing', category: 'ciekawe', media_manifest: { entries: [] } };
  const candidates = promotionCandidates(article);
  const baseline = snapshotCandidates(source, candidates);
  const result = writePublicationManifest({
    stageRoot: stage,
    article,
    candidates,
    baseline,
    transactionId: 'manifest-update-test',
  });
  assert.equal(result.payload.operation, 'UPDATE');
  assert.equal(result.payload.files[0].action, 'UPDATE');
  assert.ok(result.payload.files[0].before_sha256);
  assert.notEqual(result.payload.files[0].before_sha256, result.payload.files[0].after_sha256);
});

test('bramka kompletności wymaga listingów, sitemap, indeksu, PDF i par source/_site', () => {
  const root = temp('fitpo50-publication-set-');
  const slug = 'complete';
  const article = { slug, category: 'zdrowie', media_manifest: { entries: [] } };
  const samePairs = [
    [`${slug}.html`, `_site/${slug}.html`, '<body>article</body>'],
    ['sitemap.xml', '_site/sitemap.xml', `<loc>https://fitpo50.pl/${slug}.html</loc>`],
    ['llms.txt', '_site/llms.txt', `- url: https://fitpo50.pl/${slug}.html`],
    ['llms-full.txt', '_site/llms-full.txt', 'full'],
    ['assets/data/search-index.json', '_site/assets/data/search-index.json', JSON.stringify([{ slug: `${slug}.html` }])],
    [`assets/pdf/${slug}.pdf`, `_site/assets/pdf/${slug}.pdf`, 'pdf'],
  ];
  for (const [sourceRelative, mirrorRelative, content] of samePairs) {
    fs.mkdirSync(path.dirname(path.join(root, sourceRelative)), { recursive: true });
    fs.mkdirSync(path.dirname(path.join(root, mirrorRelative)), { recursive: true });
    fs.writeFileSync(path.join(root, sourceRelative), content);
    fs.writeFileSync(path.join(root, mirrorRelative), content);
  }
  for (const relative of ['index.html', 'porady.html', 'zdrowie.html']) {
    fs.writeFileSync(path.join(root, relative), `<a href="${slug}.html">test</a>`);
    fs.mkdirSync(path.dirname(path.join(root, '_site', relative)), { recursive: true });
    fs.writeFileSync(path.join(root, '_site', relative), `<a href="${slug}.html">test</a>`);
  }
  for (const relative of [
    `data/reports/article-preview/${slug}.json`,
    `data/reports/article-preview/${slug}.md`,
    'data/reports/published-articles-log.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), '{}');
  }
  assert.doesNotThrow(() => validatePublicationSet(root, article));
  fs.rmSync(path.join(root, '_site', 'assets', 'pdf', `${slug}.pdf`));
  assert.throws(() => validatePublicationSet(root, article), /Niepełny zestaw publikacji/);
});

test('porównanie HTML i PDF uwzględnia liczbę wystąpień słów', () => {
  const expected = normalizeWords('trening siłowy trening po pięćdziesiątce');
  const full = normalizeWords('FitPo50 trening siłowy trening po pięćdziesiątce źródło');
  const missing = normalizeWords('trening siłowy po pięćdziesiątce');
  assert.equal(multisetCoverage(expected, full), 1);
  assert.equal(multisetCoverage(expected, missing), 0.8);
});

test('indeks wyszukiwarki zachowuje osobną kategorię Mity', () => {
  assert.equal(deriveCategory('article-template article--mity', 'Mity', 'mit.html'), 'Mity');
});
