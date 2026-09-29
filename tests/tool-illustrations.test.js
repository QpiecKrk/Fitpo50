const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const illustratedTools = [
  ['kalkulator-bialka-po-50.html', 'protein-planning-human-v1'],
  ['kalkulator-phenoage-wiek-fenotypowy.html', 'phenoage-blood-human-v1'],
  ['interpretator-wynikow-badan.html', 'lab-results-human-v1'],
  ['dzienniczek-cisnienia-7-dni.html', 'blood-pressure-human-v1']
];

test('pozostałe ukryte narzędzia mają responsywne ilustracje człowieka 50+', () => {
  const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  for (const [pageName, assetName] of illustratedTools) {
    const page = fs.readFileSync(path.join(root, pageName), 'utf8');
    assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
    assert.match(page, new RegExp(`assets/${assetName}\\.webp`));
    assert.match(page, new RegExp(`assets/${assetName}\\.png`));
    assert.match(page, /<figcaption><strong>/);
    assert.equal(fs.existsSync(path.join(root, 'assets', `${assetName}.webp`)), true);
    assert.equal(fs.existsSync(path.join(root, 'assets', `${assetName}.png`)), true);
    assert.doesNotMatch(homepage, new RegExp(pageName.replace('.', '\\.')));
  }

  assert.doesNotMatch(homepage, /href="narzedzia\.html"/);
});
