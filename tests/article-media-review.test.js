const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('SEO article media review is explicit and bound to current files', () => {
  const result = spawnSync('python3', [path.join(__dirname, 'article_media_review_test.py')], {
    encoding: 'utf8', timeout: 60000,
  });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
});
