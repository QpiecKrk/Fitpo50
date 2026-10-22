const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { buildScholarlyMentions, normalizePayload, singleTrailingNewline, upsertBlogPostingSchema } = require('../scripts/import-article');

test('source with only a publication year never gets an invented January 1 date', () => {
  const [mention] = buildScholarlyMentions([{ label: 'Badanie kohortowe 2024', url: 'https://example.org/study', publication_year: 2024, publication_date: null }]);
  assert.equal(mention.datePublished, '2024');
  assert.notEqual(mention.datePublished, '2024-01-01');
});

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

test('importer przenosi zatwierdzony internal_link_plan do walidacji finalnego HTML', () => {
  const plan = [{ target: 'sen-po-50.html', anchor: 'dobry sen', location: 'sections[0].paragraphs_html[0]' }];
  const payload = normalizePayload({
    title: 'Zmiana czasu a sen',
    slug: 'zmiana-czasu-a-sen',
    category: 'ciekawe',
    lead: 'Zmiana czasu może chwilowo wpływać na sen.',
    hero_image: 'zmiana-czasu-hero',
    sections: [],
    sources: [],
    internal_link_plan: plan,
  });
  assert.deepEqual(payload.internalLinkPlan, plan);
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

test('BlogPosting.citation zachowuje wszystkie źródła także powyżej 12 pozycji', () => {
  const citations = Array.from({ length: 13 }, (_unused, index) => `https://example.org/source-${index + 1}`);
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'BlogPosting', headline: 'Artykuł testowy' })}</script>`;
  const result = upsertBlogPostingSchema(html, {
    wordCount: 100,
    timeRequired: 'PT1M',
    hasKeyTakeaways: false,
    about: [],
    mentions: [],
    citations,
  });
  const schema = JSON.parse(result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(schema.citation, citations);
});
