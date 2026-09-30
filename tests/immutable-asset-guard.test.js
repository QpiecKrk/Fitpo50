const test = require('node:test');
const assert = require('node:assert/strict');
const {
  immutableAssetViolations,
  parseNameStatus,
} = require('../scripts/immutable-asset-guard');

test('blokuje nadpisanie istniejącego obrazu objętego immutable cache', () => {
  const entries = parseNameStatus([
    'M\tassets/hero.webp',
    'M\t_site/assets/hero.webp',
  ].join('\n'));

  assert.deepEqual(immutableAssetViolations(entries), [
    { status: 'M', path: 'assets/hero.webp' },
    { status: 'M', path: '_site/assets/hero.webp' },
  ]);
});

test('dopuszcza nową wersjonowaną nazwę i zmianę odwołującego HTML', () => {
  const entries = parseNameStatus([
    'A\tassets/hero-20260929.webp',
    'A\t_site/assets/hero-20260929.webp',
    'M\tartykul.html',
    'M\t_site/artykul.html',
  ].join('\n'));

  assert.deepEqual(immutableAssetViolations(entries), []);
});
