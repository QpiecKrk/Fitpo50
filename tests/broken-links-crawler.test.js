const test = require('node:test');
const assert = require('node:assert/strict');

const { extractCanonical, extractRobots } = require('../scripts/broken-links-crawler.js');

test('canonical parser accepts valid attributes in any order', () => {
  assert.equal(
    extractCanonical('<link href="https://fitpo50.pl/artykul.html" rel="canonical"/>'),
    'https://fitpo50.pl/artykul.html'
  );
});

test('robots parser accepts valid attributes in any order', () => {
  assert.equal(extractRobots('<meta content="index,follow" name="robots"/>'), 'index,follow');
});
