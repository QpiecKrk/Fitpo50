'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  articleAddArgs,
  assertExactCommitFiles,
  assertSafeChanges,
  checkArticle200,
  expectedCommitFiles,
  findArticleJson,
  protectedNewsPath,
  sensitivePath,
  statusEntries,
} = require('../scripts/publish-article');

const publishSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'publish-article.js'), 'utf8');

test('publikuj rozpoznaje dokładnie jeden JSON artykułu w katalogu', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-publikuj-'));
  const file = path.join(directory, 'test.fitpo50.json');
  fs.writeFileSync(file, '{}\n');
  assert.equal(findArticleJson(directory), file);
  fs.writeFileSync(path.join(directory, 'drugi.fitpo50.json'), '{}\n');
  assert.throws(() => findArticleJson(directory), /dokładnie jeden/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('publikuj zachowuje ochronę NEWS i sekretów', () => {
  for (const file of ['data/news-live.json', '_site/data/news-backups/a.json', 'assets/news/a.webp']) {
    assert.equal(protectedNewsPath(file), true, file);
    assert.throws(() => assertSafeChanges([{ code: ' D', file }]), /NEWS/);
  }
  for (const file of ['admin/config.php', '.env', 'private.key']) {
    assert.equal(sensitivePath(file), true, file);
    assert.throws(() => assertSafeChanges([{ code: '??', file }]), /wrażliwy/);
  }
});

test('publikuj poprawnie odczytuje status Git i ignoruje wyłącznie lokalny plan', () => {
  const entries = statusEntries(' M index.html\n?? docs/fitpo50-modernization-master-plan.md\n');
  assert.deepEqual(entries, [
    { code: ' M', file: 'index.html' },
    { code: '??', file: 'docs/fitpo50-modernization-master-plan.md' },
  ]);
  assert.doesNotThrow(() => assertSafeChanges(entries));
});

test('publikuj przygotowuje marker, ale nie uruchamia pełnego prepush ani finalizacji', () => {
  assert.match(publishSource, /run\('npm', \['run', 'deployment:prepare'\]\)/);
  assert.doesNotMatch(publishSource, /run\('npm', \['run', 'prepush:local'\]\)/);
  assert.doesNotMatch(publishSource, /run\('npm', \['run', 'deployment:finalize'\]\)/);
});

test('publikuj rozpoznaje CREATE i UPDATE istniejącego slugu', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-publikuj-mode-'));
  const source = path.join(root, 'artykul.fitpo50.json');
  fs.writeFileSync(source, '{}\n');
  assert.doesNotMatch(articleAddArgs(source, 'artykul', root).join(' '), /--force true/);
  fs.writeFileSync(path.join(root, 'artykul.html'), '<!doctype html>\n');
  assert.match(articleAddArgs(source, 'artykul', root).join(' '), /--force true/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('publikuj bierze listę commita wyłącznie z manifestu artykułu i dwóch markerów', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-publikuj-manifest-'));
  const directory = path.join(root, 'data', 'reports', 'article-publications');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'artykul.json'), `${JSON.stringify({
    slug: 'artykul',
    files: [{ path: 'artykul.html' }, { path: '_site/artykul.html' }],
  })}\n`);
  const expected = expectedCommitFiles('artykul', root);
  assert.deepEqual(expected, [
    '_site/artykul.html',
    '_site/deployment.json',
    'artykul.html',
    'data/reports/article-publications/artykul.json',
    'deployment.json',
  ]);
  assert.deepEqual(assertExactCommitFiles(expected.map((file) => ({ code: ' M', file })), expected), expected);
  assert.throws(() => assertExactCommitFiles([
    ...expected.map((file) => ({ code: ' M', file })),
    { code: ' M', file: 'niepowiazany.txt' },
  ], expected), /Nadmiar: niepowiazany\.txt/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('publikuj sprawdza wyłącznie URL artykułu do uzyskania HTTP 200', async () => {
  const urls = [];
  const responses = [
    { status: 404, body: '' },
    { status: 200, body: 'stara wersja' },
    { status: 200, body: 'aktualna wersja' },
  ];
  await checkArticle200('testowy-artykul', {
    intervalMs: 0,
    timeoutMs: 1000,
    expectedSha256: require('node:crypto').createHash('sha256').update('aktualna wersja').digest('hex'),
    requestStatus: async (url) => {
      urls.push(url);
      return responses.shift();
    },
    wait: async () => {},
  });
  assert.deepEqual(urls, [
    'https://fitpo50.pl/testowy-artykul.html',
    'https://fitpo50.pl/testowy-artykul.html',
    'https://fitpo50.pl/testowy-artykul.html',
  ]);
});

test('publikuj zatrzymuje kontrolę artykułu po limicie i podaje ostatni status HTTP', async () => {
  let now = 0;
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    await assert.rejects(checkArticle200('testowy-artykul', {
      intervalMs: 15000,
      timeoutMs: 180000,
      expectedSha256: '0'.repeat(64),
      requestStatus: async () => ({ status: 503, body: 'niedostępne' }),
      wait: async (delay) => { now += delay; },
    }), /Ostatni status: 503/);
  } finally {
    Date.now = originalNow;
  }
});
