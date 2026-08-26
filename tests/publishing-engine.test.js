const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('node:child_process');

const { POLICY, utils, validators } = require('../scripts/lib/article-policy');
const {
  categoryFileFromKey,
  categoryLabelFromKey,
  categoryPageFromImportCategory,
  isSupportedCategory,
  normalizeCategory,
} = require('../scripts/lib/categories');
const { ensureCaptionedTables, normalizeSections, normalizeSeoTitleBase } = require('../scripts/import-article');

test('validateSeoDescriptionLength accepts valid SEO description', () => {
  const desc = 'Badanie ApoB (Apolipoproteina B) to najlepszy marker ryzyka miażdżycy po 50-tce. Sprawdź normy, cenę i dlaczego warto je zrobić zamiast LDL dziś.';
  const result = validators.validateSeoDescriptionLength(desc);
  assert.equal(result.ok, true);
});

test('validateSeoDescriptionLength rejects too short description', () => {
  const result = validators.validateSeoDescriptionLength('Za krótki opis.');
  assert.equal(result.ok, false);
  assert.match(result.error, /wymagane/i);
});

test('countInternalHtmlLinks counts unique internal html links and ignores porady.html', () => {
  const html = `
    <p>
      <a href="./wino-i-miesnie-po-50.html">Wino</a>
      <a href="wino-i-miesnie-po-50.html#sekcja">Wino 2</a>
      <a href="https://fitpo50.pl/kreatyna-po-50-tce-kompletny-przewodnik.html">Kreatyna</a>
      <a href="porady.html">Porady</a>
      <a href="mailto:test@example.com">Mail</a>
    </p>
  `;
  const count = utils.countInternalHtmlLinks(html);
  assert.equal(count, 2);
});

test('importer turns draft tables into semantic mobile-safe HTML tables', () => {
  const html = '<table><thead><tr><th>MIT</th><th>Fakt</th></tr></thead><tbody><tr><td>Twierdzenie</td><td>Stan dowodów</td></tr></tbody></table>';
  const normalized = ensureCaptionedTables(html, 'Co pokazują dowody?');
  assert.match(normalized, /class="article-table-wrap"/);
  assert.match(normalized, /class="article-table"/);
  assert.match(normalized, /<caption>Tabela: Co pokazują dowody\.<\/caption>/);
  assert.match(normalized, /<th scope="col">MIT<\/th>/);
  assert.match(normalized, /<th scope="row">Twierdzenie<\/th>/);
});

test('importer preserves inline links and emphasis in the first paragraph under H2', () => {
  const [section] = normalizeSections([{
    heading: 'Dlaczego to ważne?',
    paragraphs_html: ['<p>To jest <strong>ważne wyjaśnienie</strong> z <a href="badania.html">kontekstowym linkiem</a>, którego importer nie może usuwać.</p>'],
  }]);
  assert.match(section.blocks[0].html, /<strong>ważne wyjaśnienie<\/strong>/);
  assert.match(section.blocks[0].html, /<a href="(?:\.\/)?badania\.html">kontekstowym linkiem<\/a>/);
  assert.equal(utils.countWords(utils.stripTags(section.blocks[0].html)), 12);
});

test('SEO title base reserves space for the FitPo50 brand suffix', () => {
  const base = normalizeSeoTitleBase('Czy bardzo długi tytuł artykułu może przekroczyć limit Google i zepsuć walidację strony');
  assert.ok(base.length <= POLICY.TITLE.SEO_BASE_MAX);
  assert.ok(`${base}${POLICY.TITLE.BRAND_SUFFIX}`.length <= POLICY.TITLE.MAX);
});

test('collectRepeatedLongSentences reports repeated long sentences via central thresholds', () => {
  const sentence = 'Kreatyna poprawia siłę, regenerację oraz jakość treningu po pięćdziesiątce w dobrze zaplanowanym programie.';
  const repeated = utils.collectRepeatedLongSentences([
    sentence,
    sentence,
    sentence,
    sentence,
    'Krótka fraza.',
  ]);

  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].count, POLICY.REPEATED_SENTENCES.MIN_REPEATS);
  assert.match(repeated[0].sentence, /kreatyna poprawia/i);
});

test('central category registry maps myth aliases to Mity landing page', () => {
  for (const raw of ['mity', 'mit', 'obnazamy-mity', 'obnażamy-mity', 'sciema-czy-fakt', 'ściema-czy-fakt']) {
    const category = normalizeCategory(raw);
    assert.equal(category.key, 'mity');
    assert.equal(category.label, 'Mity');
    assert.equal(category.file, 'mity.html');
    assert.equal(isSupportedCategory(raw), true);
    assert.equal(categoryPageFromImportCategory(raw), 'mity.html');
  }

  assert.equal(categoryFileFromKey('mity'), 'mity.html');
  assert.equal(categoryLabelFromKey('mity'), 'Mity');
});

test('article-sync-pro dry-run reports missing import JSON clearly', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const result = spawnSync(
    'node',
    [
      'scripts/article-sync-pro.js',
      '--slug',
      'testowy-slug-bez-json',
      '--sync-seo',
      '--sync-listings',
      '--dry-run',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Nie znaleziono pliku JSON w data\/import\/ dla slug "testowy-slug-bez-json"/);
});
