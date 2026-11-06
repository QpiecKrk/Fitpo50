'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  articleAddArgs,
  articleHeroAssets,
  assertExactCommitFiles,
  assertSafeChanges,
  checkArticle200,
  checkPublicAssets,
  expectedCommitFiles,
  findArticleJson,
  preparedArticleTask,
  protectedNewsPath,
  sensitivePath,
  statusEntries,
  taskCommitFiles,
  taskSlugFromEntries,
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

test('publikuj wznawia gotowy artykuł i dopuszcza tylko powiązany kod/test', () => {
  const expected = ['artykul.html', '_site/artykul.html', 'data/reports/article-publications/artykul.json', 'deployment.json', '_site/deployment.json'];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-publikuj-resume-'));
  fs.mkdirSync(path.join(root, 'data', 'reports', 'article-publications'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'reports', 'article-publications', 'artykul.json'), JSON.stringify({
    slug: 'artykul',
    files: [{ path: 'artykul.html' }, { path: '_site/artykul.html' }],
  }));
  const entries = expected.map((file) => ({ code: ' M', file })).concat([
    { code: ' M', file: 'scripts/publish-article.js' },
    { code: ' M', file: 'tests/publish-article-command.test.js' },
  ]);
  assert.equal(preparedArticleTask('artykul', root, []), false);
  assert.equal(preparedArticleTask('artykul', root, entries.slice(0, 3)), true);
  assert.deepEqual(taskCommitFiles(entries, expected).sort(), entries.map((entry) => entry.file).sort());
  assert.equal(taskSlugFromEntries([{ code: ' M', file: 'data/reports/article-publications/artykul.json' }]), 'artykul');
  assert.throws(() => taskCommitFiles(entries.concat({ code: ' M', file: 'random.txt' }), expected), /Niezwiązane/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('publikuj wyciąga z hero dokładnie AVIF/WebP/JPG', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-publikuj-hero-'));
  fs.mkdirSync(path.join(root, '_site'), { recursive: true });
  fs.writeFileSync(path.join(root, '_site', 'artykul.html'), '<div class="article-hero"><picture><source srcset="./assets/a.avif" type="image/avif"><source srcset="./assets/a.webp" type="image/webp"><img src="./assets/a.jpg"></picture></div>');
  assert.deepEqual(articleHeroAssets('artykul', root), ['assets/a.avif', 'assets/a.webp', 'assets/a.jpg']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('publikuj sprawdza hash hero bez dodatkowego pipeline’u', async () => {
  const body = Buffer.from('hero');
  const hash = require('node:crypto').createHash('sha256').update(body).digest('hex');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-publikuj-assets-'));
  fs.mkdirSync(path.join(root, '_site', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, '_site', 'assets', 'a.jpg'), body);
  await checkPublicAssets(['assets/a.jpg'], {
    root,
    requestStatus: async () => ({ status: 200, body }),
    wait: async () => {},
    intervalMs: 0,
    timeoutMs: 100,
  });
  assert.equal(hash.length, 64);
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
