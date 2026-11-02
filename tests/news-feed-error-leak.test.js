'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'admin/api/news-feed.php');
const MIRROR_PATH = path.join(ROOT, '_site/admin/api/news-feed.php');

function read(relativePath) {
  return fs.readFileSync(relativePath, 'utf8');
}

test('public NEWS feed returns a generic error without exception details', () => {
  const source = read(SOURCE_PATH);
  const mirror = read(MIRROR_PATH);

  assert.equal(mirror, source, 'admin/api/news-feed.php i jego mirror _site muszą być identyczne');

  for (const [label, php] of [['source', source], ['mirror', mirror]]) {
    assert.doesNotMatch(php, /getMessage\s*\(/, `${label}: odpowiedź nie może używać getMessage()`);
    assert.doesNotMatch(php, /getTraceAsString\s*\(/, `${label}: odpowiedź nie może używać getTraceAsString()`);

    const catchBlock = php.match(/catch\s*\(\s*Throwable\s+\$e\s*\)\s*\{([\s\S]*)\}\s*$/);
    assert.ok(catchBlock, `${label}: brak kontrolowanej obsługi błędu NEWS feed`);
    assert.match(catchBlock[1], /http_response_code\s*\(\s*500\s*\)/, `${label}: brak HTTP 500`);
    assert.match(catchBlock[1], /error_log\s*\(/, `${label}: brak prywatnego logu diagnostycznego`);

    const response = catchBlock[1].match(/echo\s+json_encode\s*\([\s\S]*?\)\s*;/);
    assert.ok(response, `${label}: brak odpowiedzi JSON dla błędu`);
    assert.doesNotMatch(response[0], /\$e\b/, `${label}: wyjątek nie może trafić do odpowiedzi`);
    assert.match(
      response[0],
      /echo\s+json_encode\s*\(\s*\[\s*'error'\s*=>\s*'NEWS_FEED_ERROR'\s*,?\s*\]\s*,\s*JSON_UNESCAPED_UNICODE\s*\|\s*JSON_UNESCAPED_SLASHES\s*\)\s*;/,
      `${label}: odpowiedź błędu ma zawierać wyłącznie ogólny kod NEWS_FEED_ERROR`,
    );
  }
});
