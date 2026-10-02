const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { collectDomInventory } = require('../scripts/article-preview-gate');

async function inventory(html, isCenter = false) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    return await page.evaluate(collectDomInventory, isCenter);
  } finally {
    await browser.close();
  }
}

function picture(stem, placement = '') {
  return `<picture${placement ? ` data-preview-placement="${placement}"` : ''}><source type="image/avif" srcset="assets/${stem}.avif"><source type="image/webp" srcset="assets/${stem}.webp"><img src="assets/${stem}.jpg" alt="Konkretny obraz ${stem}"></picture>`;
}

test('kanoniczny DOM inventory obejmuje hero, quick answer, picture poza figure, nested FAQ i obraz po FAQ', async () => {
  const result = await inventory(`
    <main><section class="article-intro-grid"><figure class="article-hero">${picture('hero')}</figure></section>
    <section id="quick-answer">${picture('quick')}</section>
    <article class="article-content">
      <h2>Pierwsza sekcja?</h2><div>${picture('outside-figure')}</div>
      <section class="faq-section"><article class="faq-item"><h3>Pytanie?</h3>${picture('faq')}</article></section>
      <h2>Po FAQ?</h2><figure>${picture('after-faq')}<figcaption>Podpis obrazu po FAQ.</figcaption></figure>
      <section class="share-article-section">${picture('share')}</section>
    </article></main>`);
  assert.deepEqual(result.images.map((item) => item.role), ['hero', 'quick-answer', 'content', 'faq', 'content']);
  assert.equal(result.images.some((item) => item.variants.jpg.includes('share.jpg')), false);
  assert.equal(result.expectedImages, 5);
});

test('DOM inventory zachowuje jawnie powtórzony placement i ten sam obraz do blokady kontraktu', async () => {
  const result = await inventory(`<main><article class="article-content"><h2>Sekcja?</h2>
    ${picture('same', 'duplikat')}${picture('same', 'duplikat')}</article></main>`);
  assert.deepEqual(result.images.map((item) => item.placement), ['duplikat', 'duplikat']);
  assert.equal(result.images[0].variants.jpg, result.images[1].variants.jpg);
});

test('topic center używa tego samego inventory DOM dla wszystkich picture w main', async () => {
  const result = await inventory(`<main class="hub-shell"><h1>Centrum</h1><section><h2>Moduł?</h2>${picture('center-one')}</section><div>${picture('center-two')}</div></main>`, true);
  assert.equal(result.images.length, 2);
  assert.ok(result.images.every((item) => item.role === 'center'));
});
