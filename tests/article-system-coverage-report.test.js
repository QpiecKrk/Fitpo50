'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { collectPages } = require('../scripts/gsc-priority-map');
const {
  buildCoverageReport,
  classifyPreview,
  renderText,
  selectProductionArticles,
  writeOutputs,
} = require('../scripts/article-system-coverage-report');

const ROOT = path.resolve(__dirname, '..');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-coverage-'));
  fs.mkdirSync(path.join(root, 'data', 'reports', 'article-preview'), { recursive: true });
  return root;
}

test('katalog wykorzystuje wynik wspólnego collectPages i wybiera tylko artykuły z sitemap', () => {
  const pages = [
    { path: 'artykul.html', url: 'https://fitpo50.pl/artykul.html', title: 'Artykuł', type: 'article', content_role: 'editorial_article', in_sitemap: true, has_blogposting: true },
    { path: 'centrum-test.html', url: 'https://fitpo50.pl/centrum-test.html', title: 'Centrum', type: 'article', content_role: 'topic_center', in_sitemap: true, has_blogposting: true },
    { path: 'article-template-bento.html', type: 'article', content_role: 'editorial_article', in_sitemap: false, has_blogposting: true },
    { path: 'ukryty.html', type: 'excluded_noindex', in_sitemap: true, has_blogposting: true },
    { path: 'redirect.html', type: 'redirect', in_sitemap: false, has_blogposting: false },
    { path: 'porady.html', type: 'core', in_sitemap: true, has_blogposting: false },
  ];
  const result = selectProductionArticles(pages);
  assert.deepEqual(result.inventory.map((item) => item.path), ['artykul.html', 'centrum-test.html']);
  assert.deepEqual(result.excluded_blogposting_pages, [
    { path: 'article-template-bento.html', reason: 'NOT_IN_SITEMAP' },
    { path: 'ukryty.html', reason: 'NOINDEX' },
  ]);
});

test('preview rozróżnia v1, v2, v3, nieaktualny raport i brak bez własnej walidacji schema', () => {
  const root = tempRoot();
  const directory = path.join(root, 'data', 'reports', 'article-preview');
  for (const [slug, version] of [['v1', 1], ['v2', 2], ['v3', 3], ['bad', 3]]) {
    fs.writeFileSync(path.join(directory, `${slug}.json`), JSON.stringify({ slug, version }));
  }
  const validator = (_root, slug, options) => {
    assert.equal(options.allowLegacy, true);
    const version = JSON.parse(fs.readFileSync(path.join(directory, `${slug}.json`), 'utf8')).version;
    return { ok: slug !== 'bad', report: { version }, errors: slug === 'bad' ? ['fixture invalid'] : [] };
  };
  assert.equal(classifyPreview(root, 'v1', validator).classification, 'LEGACY_V1_CURRENT');
  assert.equal(classifyPreview(root, 'v2', validator).classification, 'LEGACY_V2_CURRENT');
  assert.equal(classifyPreview(root, 'v3', validator).classification, 'V3_PREVIEW_READY');
  assert.equal(classifyPreview(root, 'bad', validator).classification, 'STALE_OR_INVALID');
  assert.equal(classifyPreview(root, 'missing', validator).classification, 'MISSING');
});

test('raport nie skleja niezależnych statusów i zachowuje sumę klas preview', () => {
  const root = tempRoot();
  const pages = [
    { path: 'jeden.html', url: 'https://fitpo50.pl/jeden.html', title: 'Jeden', type: 'article', content_role: 'editorial_article', in_sitemap: true, has_blogposting: true },
    { path: 'dwa.html', url: 'https://fitpo50.pl/dwa.html', title: 'Dwa', type: 'article', content_role: 'topic_center', in_sitemap: true, has_blogposting: true },
  ];
  fs.writeFileSync(path.join(root, 'data', 'reports', 'article-preview', 'jeden.json'), JSON.stringify({ slug: 'jeden', version: 1 }));
  const report = buildCoverageReport({
    root,
    pages,
    now: new Date('2026-10-02T12:00:00Z'),
    git: { head_commit: 'abc', head_committed_at: '2026-10-02T11:00:00Z' },
    previewValidator: () => ({ ok: true, report: { version: 1 }, errors: [] }),
  });
  assert.equal(report.catalog.total, 2);
  assert.equal(Object.values(report.preview_coverage.counts).reduce((sum, value) => sum + value, 0), 2);
  assert.equal(report.preview_coverage.counts.LEGACY_V1_CURRENT, 1);
  assert.equal(report.preview_coverage.counts.MISSING, 1);
  assert.equal(report.system_statuses.static_validation.status, 'NOT_CHECKED');
  assert.equal(report.system_statuses.deployment.status, 'UNKNOWN');
  assert.equal(report.system_statuses.external_integrations.gsc.status, 'UNKNOWN');
  assert.equal(Object.hasOwn(report, 'status'), false);
});

test('JSON i TXT powstają z jednego modelu, a zapis dotyczy tylko własnych wyników', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-coverage-output-'));
  const report = {
    generated_at: '2026-10-02T12:00:00.000Z', informational_only: true,
    git: { head_commit: 'abc' },
    catalog: { total: 1, editorial_articles: 1, topic_centers: 0, source: 'collector', rule: 'fixture', excluded_blogposting_pages: [] },
    preview_coverage: { counts: { V3_PREVIEW_READY: 0, LEGACY_V2_CURRENT: 0, LEGACY_V1_CURRENT: 1, STALE_OR_INVALID: 0, MISSING: 0 }, stale_or_invalid: [], missing: [], legacy_scope_note: 'legacy' },
    publication_coverage: { present: 0, missing: 1, slugs_with_manifest: [], source: 'manifests', source_state: 'SOURCE_CURRENT', scope_note: 'informacja' },
    system_statuses: {
      static_validation: { status: 'PASS', source_state: 'SOURCE_CURRENT', source_file: 'doctor.json', source_generated_at: 'now' },
      deployment: { status: 'LIVE_DEPLOYED_AND_VALIDATED', source_state: 'SOURCE_CURRENT', expected_commit: 'abc', release_id: 'r1', source_file: 'deployment.json' },
      external_integrations: { gsc: { status: 'OK_VERIFIED', source_state: 'SOURCE_CURRENT', data_contract: 'PASS', source_generated_at: 'now', source_file: 'gsc.json' } },
    },
    articles: [],
  };
  const files = writeOutputs(report, outputDir);
  assert.deepEqual(JSON.parse(fs.readFileSync(files.jsonFile, 'utf8')), report);
  assert.equal(fs.readFileSync(files.textFile, 'utf8'), renderText(report));
  assert.deepEqual(fs.readdirSync(outputDir).sort(), ['article-system-coverage.json', 'article-system-coverage.txt']);
});

test('reporter nie importuje ani nie wywołuje mechanizmów mutujących i sieciowych', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'article-system-coverage-report.js'), 'utf8');
  for (const forbidden of [
    'article-staging', 'article-pipeline', 'article-capability', 'export-parity',
    'playwright', 'deployment-live-verify', 'prepare-deployment-marker', 'fetch(', 'https.request', 'spawnSync(',
  ]) assert.equal(source.includes(forbidden), false, `Niedozwolone wywołanie/import: ${forbidden}`);
  assert.match(source, /require\('\.\/gsc-priority-map'\)/);
  assert.match(source, /require\('\.\/lib\/article-preview-report'\)/);
  assert.match(source, /require\('\.\/lib\/gsc-data-contract'\)/);
});

test('bieżący katalog produkcyjny zachowuje pełne pokrycie klasyfikacji', () => {
  const selected = selectProductionArticles(collectPages('https://fitpo50.pl'));
  const classes = selected.inventory.map((article) => classifyPreview(ROOT, article.slug).classification);
  assert.ok(selected.inventory.length > 0);
  assert.equal(classes.length, selected.inventory.length);
  assert.ok(classes.every((value) => ['V3_PREVIEW_READY', 'LEGACY_V2_CURRENT', 'LEGACY_V1_CURRENT', 'STALE_OR_INVALID', 'MISSING'].includes(value)));
});
