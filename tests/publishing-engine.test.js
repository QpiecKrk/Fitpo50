const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('node:child_process');

const { POLICY, utils, validators } = require('../scripts/lib/article-policy');

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

test('collectRepeatedLongSentences reports repeated long sentences via central thresholds', () => {
  const sentence = 'Kreatyna poprawia siłę, regenerację oraz jakość treningu po pięćdziesiątce w dobrze zaplanowanym programie.';
  const repeated = utils.collectRepeatedLongSentences([
    sentence,
    sentence,
    sentence,
    'Krótka fraza.',
  ]);

  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].count, POLICY.REPEATED_SENTENCES.MIN_REPEATS);
  assert.match(repeated[0].sentence, /kreatyna poprawia/i);
});

test('article-sync-pro dry-run succeeds for known slug', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const result = spawnSync(
    'node',
    [
      'scripts/article-sync-pro.js',
      '--slug',
      'zegar-epigenetyczny-horvatha-wiek-biologiczny-metylacja-dna',
      '--sync-seo',
      '--sync-listings',
      '--dry-run',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /DRY-RUN: article-sync-pro\.js/);
  assert.match(result.stdout, /Slug: zegar-epigenetyczny-horvatha-wiek-biologiczny-metylacja-dna/);
});
