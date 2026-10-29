const test = require('node:test');
const assert = require('node:assert/strict');

const { isArticleHtml } = require('../scripts/date-modified-guard');

test('date-modified guard classifies legal pages separately from articles', () => {
  assert.equal(isArticleHtml('polityka-prywatnosci.html'), false);
  assert.equal(isArticleHtml('ai-w-diagnostyce-i-lekach-na-raka.html'), true);
  assert.equal(isArticleHtml('_site/ai-w-diagnostyce-i-lekach-na-raka.html'), false);
});
