const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pageKind } = require('../scripts/lib/publication-page-kind');
const { buildPatchedFiles, buildDeploymentManifest } = require('../scripts/lib/popraw-seo-approved-patches');
const { isA4Page } = require('../scripts/article-preview-gate');
const { spawnSync } = require('node:child_process');

test('center contract rejects duplicate schema, missing evidence, broken links and FAQ mismatch', () => {
  const repo = path.resolve(__dirname, '..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'center-contract-'));
  const name = 'centrum-snu-po-50.html';
  const valid = fs.readFileSync(path.join(__dirname, 'fixtures/topic-centers', name), 'utf8');
  for (const file of fs.readdirSync(repo).filter((file) => file.endsWith('.html') && file !== name)) {
    fs.symlinkSync(path.join(repo, file), path.join(root, file));
  }
  const run = (html) => {
    fs.writeFileSync(path.join(root, name), html);
    return spawnSync('python3', [path.join(repo, 'scripts/validate-topic-center.py'), path.join(root, name)], {encoding: 'utf8'});
  };
  const result = run(valid);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const cases = [
    [valid.replace('</head>', '<script type="application/ld+json">{"@type":"BlogPosting"}</script></head>'), 'bez duplikatów'],
    [valid.replaceAll('data-evidence=', 'data-unused='), 'wykorzystane przy konkretnej tezie'],
    [valid.replace('href="sen-po-50.html"', 'href="missing.html"'), 'Uszkodzony link'],
    [valid.replace('Ile godzin snu zaleca się dorosłym?</h3>', 'Inne pytanie?</h3>'), 'FAQ HTML i schema'],
    [valid.replace('class="hub-article-link"', 'class="other-link"'), 'ItemList'],
  ];
  for (const [html, error] of cases) {
    const failed = run(html);
    assert.notEqual(failed.status, 0, error);
    assert.ok(failed.stdout.includes(error), failed.stdout + failed.stderr);
  }
});

test('A4 accepts Chromium rounding but rejects Letter, landscape and missing dimensions', () => {
  assert.ok(isA4Page('Page size: 594.96 x 841.92 pts (A4)'));
  assert.ok(isA4Page('Page size: 595.276 x 841.89 pts (A4)'));
  assert.equal(isA4Page('Page size: 612 x 792 pts (letter)'), false);
  assert.equal(isA4Page('Page size: 841.89 x 595.276 pts (A4)'), false);
  assert.equal(isA4Page(''), false);
});

test('whole-page deployment verifies final dates and generated PDF metadata', () => {
  const finalHtml = '<!DOCTYPE html><html><head><meta content="2026-09-05"></head><body>PDF 547 KB</body></html>';
  const items = [{id: 'BOOST 1', file: 'center.html', operations: [{after: '<!DOCTYPE html><html>Draft</html>'}]}];
  const deployment = buildDeploymentManifest({manifest: {}, items, contents: new Map([['center.html', finalHtml]]), targetFiles: ['center.html'], iso: '2026-09-05T10:00:00+02:00'});
  assert.deepEqual(deployment.targets[0].content_needles, [finalHtml]);
});

test('layout, not BlogPosting or filename, selects the publication contract', () => {
  assert.equal(pageKind('<div class="hub-shell"><main><h1 id="hub-title">Sen</h1></main></div>'), 'topic_center');
  assert.equal(pageKind("<article id='body' class='reveal article-content'>Treść</article>"), 'article');
  assert.equal(pageKind('<script>{"@type":"BlogPosting"}</script>'), 'unsupported');
});

test('a linked source center receives dates, PDF and live validation obligations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'center-pipeline-'));
  const html = '<meta property="article:modified_time" content="2026-08-01T10:00:00+02:00"><script>{"@type":"BlogPosting","dateModified":"2026-08-01T10:00:00+02:00"}</script><div class="hub-shell"><main><h1 id="hub-title">Sen</h1><p>Rytm snu.</p></main></div>';
  fs.writeFileSync(path.join(root, 'target.html'), html);
  fs.writeFileSync(path.join(root, 'support.html'), html);
  const items = [{ id: 'BOOST 1', file: 'target.html', operations: [
    { before: 'Rytm snu.', after: 'Dzienniczek snu.' },
    { file: 'support.html', before: 'Rytm snu.', after: '<a href="target.html">Dzienniczek snu</a>.' },
  ] }];
  const iso = '2026-09-05T10:00:00+02:00';
  const result = buildPatchedFiles({}, items, root, iso);
  assert.deepEqual(new Set(result.articleFiles), new Set(['target.html', 'support.html']));
  assert.ok(result.contents.get('support.html').includes(iso));
  const deployment = buildDeploymentManifest({ manifest: {}, items, contents: result.contents, targetFiles: result.targetFiles, iso });
  assert.equal(deployment.targets[0].source_pages[0].pdf_url, 'https://fitpo50.pl/assets/pdf/support.pdf');
});
