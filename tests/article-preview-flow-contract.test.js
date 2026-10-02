const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('nowy artykuł i popraw-seo korzystają z jednego preview v3 i tego samego zarządzanego stagingu', () => {
  const article = read('scripts/article-pipeline.js');
  const seo = read('scripts/popraw-seo-apply.js');

  assert.match(article, /runPreviewGate\(stageRoot, slug\)/);
  assert.match(article, /validatePreviewReport\(stageRoot, slug, \{ requireRenderFiles: true \}\)/);
  assert.match(article, /createStagingWorkspace\(root, slug\)/);
  assert.match(seo, /article-preview-gate\.js/);
  assert.match(seo, /article-preview-report-check\.js/);
  assert.match(seo, /--require-render-files/);
  assert.match(seo, /createStagingWorkspace\(ROOT, 'seo'\)/);
  assert.doesNotMatch(article, /article-media-review\.py/);
  assert.doesNotMatch(seo, /article-media-review\.py/);
});

test('paczka F nie wprowadza drugiej capability, parity ani transakcji', () => {
  const changedRuntime = [
    'scripts/article-pipeline.js',
    'scripts/popraw-seo-apply.js',
    'scripts/article-preview-gate.js',
    'scripts/article-preview-report-check.js',
    'scripts/lib/article-preview-report.js',
    'scripts/lib/article-visual-review.js',
    'scripts/lib/temp-workspace.js',
  ].map(read).join('\n');

  assert.doesNotMatch(changedRuntime, /class\s+.*Capability|function\s+issue.*Capability/);
  assert.doesNotMatch(changedRuntime, /function\s+.*Parity|class\s+.*Parity/);
  assert.equal((changedRuntime.match(/require\('\.\/lib\/article-staging'\)/g) || []).length, 2);
  assert.doesNotMatch(changedRuntime, /require\([^)]*(?:capability-v2|parity-v2|staging-v2|transaction-v2)/i);
});
