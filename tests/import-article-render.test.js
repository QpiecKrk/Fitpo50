const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { normalizePayload, singleTrailingNewline } = require('../scripts/import-article');

test('importer przekazuje rzeczywiste wymiary hero do HTML', () => {
  const payload = normalizePayload({
    title: 'Jak wygląda porcja białka?',
    slug: 'porcja-bialka',
    category: 'jedzenie',
    lead: 'Praktyczne porcje produktów pokazane na talerzu.',
    hero_image: 'porcja-bialka-hero',
    hero_alt: 'Porcje produktów białkowych na stole',
    hero_width: 1080,
    hero_height: 589,
    sources: [],
    sections: [],
  });
  assert.equal(payload.heroWidth, 1080);
  assert.equal(payload.heroHeight, 589);
});

test('etykiety akcji artykułu nie schodzą poniżej 10 px', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'article.css'), 'utf8');
  assert.match(css, /pdf-hero-download__eyebrow[\s\S]*?font-size:\s*clamp\(0\.625rem,/);
  assert.match(css, /pdf-hero-download__badge::after[\s\S]*?font-size:\s*0\.625rem/);
  assert.doesNotMatch(css, /pdf-hero-download__badge\s*\{[\s\S]*?font-size:\s*0\s*;/);
});

test('wpis llms kończy się dokładnie jednym znakiem nowej linii', () => {
  assert.equal(singleTrailingNewline('wpis\n\n'), 'wpis\n');
  assert.equal(singleTrailingNewline('wpis'), 'wpis\n');
});
