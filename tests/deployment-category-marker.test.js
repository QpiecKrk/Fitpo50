const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { articleDeploymentEntry } = require('../scripts/prepare-deployment-marker');
const { normalizeCategory } = require('../scripts/lib/categories');

const ROOT = path.resolve(__dirname, '..');

function withArticleFixture(sectionMeta, categoryFile, options, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-deployment-category-'));
  const slug = 'testowy-artykul';
  const file = `${slug}.html`;
  const site = path.join(root, '_site');
  try {
    fs.mkdirSync(path.join(site, 'assets', 'data'), { recursive: true });
    fs.mkdirSync(path.join(site, 'assets', 'pdf'), { recursive: true });
    fs.writeFileSync(path.join(site, file), [
      `<link rel="canonical" href="https://fitpo50.pl/${file}">`,
      '<meta property="article:modified_time" content="2026-10-28T08:00:00+01:00">',
      sectionMeta,
      '<script type="application/ld+json">{"@type":"BlogPosting","dateModified":"2026-10-28T08:00:00+01:00"}</script>',
    ].join(''));
    fs.writeFileSync(path.join(site, 'assets', 'pdf', `${slug}.pdf`), '%PDF-test');
    fs.writeFileSync(path.join(site, 'porady.html'), `<a href="${file}">porada</a>`);
    fs.writeFileSync(path.join(site, 'assets', 'data', 'search-index.json'), `[{"url":"${file}"}]`);
    fs.writeFileSync(
      path.join(site, categoryFile),
      options?.includeCategory === false ? '<p>inny artykuł</p>' : `<a href="${file}">dział</a>`,
    );
    callback({ root, file });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('deployment marker reads article:section regardless of meta attribute order', () => {
  withArticleFixture('<meta content="Zdrowie" property="article:section">', 'zdrowie.html', {}, ({ root, file }) => {
    const entry = articleDeploymentEntry(root, file);
    assert.ok(entry.listing_paths.includes('zdrowie.html'));
  });
});

test('deployment marker category aliases match the actual article listings', () => {
  assert.equal(normalizeCategory('Dieta & Jedzenie').file, 'jedzenie.html');
  assert.equal(normalizeCategory('Jedzenie & Nawyk').file, 'jedzenie.html');
  assert.equal(normalizeCategory('Badania & Zdrowie').file, 'zdrowie.html');
});

test('deployment marker still blocks a BlogPosting missing from its category listing', () => {
  withArticleFixture(
    '<meta property="article:section" content="Zdrowie">',
    'zdrowie.html',
    { includeCategory: false },
    ({ root, file }) => {
      assert.throws(
        () => articleDeploymentEntry(root, file),
        /eksport nie zawiera artykułu w zdrowie\.html/,
      );
    },
  );
});

test('pelvic-floor training article is listed only in the Ruch category', () => {
  const article = 'miesnie-dna-miednicy-trening-core-po-50.html';
  const movement = fs.readFileSync(path.join(ROOT, 'rusz-sie.html'), 'utf8');
  const interesting = fs.readFileSync(path.join(ROOT, 'ciekawe.html'), 'utf8');
  assert.match(movement, new RegExp(`href=["']${article}["']`));
  assert.doesNotMatch(interesting, new RegExp(`href=["']${article}["']`));
});
