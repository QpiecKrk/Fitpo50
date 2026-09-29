const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('PDF preserves article content and images', () => {
  const result = spawnSync('python3', [path.join(__dirname, 'article_pdf_content_test.py')], {
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
});
