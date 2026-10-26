'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { EXIT } = require('../scripts/news-pull');
const { validatePublicNewsCheckout } = require('../scripts/lib/news-public-integrity');
const { checkPublicNewsImagesHttp } = require('../scripts/news-public-http-check');

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function fixture(t, base = 'news_20261025_runtime', trackedImages = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-public-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets', 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'news'), { recursive: true });
  fs.mkdirSync(path.join(root, '_site', 'assets', 'news'), { recursive: true });
  const image = Object.fromEntries(['avif', 'webp', 'jpg'].map((ext) => [ext, `./assets/news/${base}.${ext}`]));
  fs.writeFileSync(path.join(root, 'assets', 'data', 'news-fallback.json'), `${JSON.stringify({
    version: 1,
    items: [{ id: 'news_1', title: 'News testowy', image }],
  })}\n`);
  fs.writeFileSync(path.join(root, '.gitignore'), 'assets/news/news_20*\n_site/assets/news/news_20*\n');
  git(root, 'init');
  git(root, 'add', '.gitignore', 'assets/data/news-fallback.json');
  if (trackedImages) {
    for (const ext of ['avif', 'webp', 'jpg']) {
      fs.writeFileSync(path.join(root, 'assets', 'news', `${base}.${ext}`), ext);
      git(root, 'add', `assets/news/${base}.${ext}`);
    }
  }
  return root;
}

test('wspólna kontrola wymaga obrazów NEWS śledzonych przez Git', (t) => {
  const root = fixture(t, 'news_historyczny', true);
  assert.deepEqual(validatePublicNewsCheckout({ root }).errors, []);
  fs.rmSync(path.join(root, 'assets', 'news', 'news_historyczny.webp'));
  const result = validatePublicNewsCheckout({ root });
  assert.ok(result.errors.some((error) => /news_historyczny\.webp.*nie istnieje w checkout/.test(error)));
});

test('runtime news_20 nie wymaga pliku w checkout, ale zwraca trzy cele zdalne', (t) => {
  const root = fixture(t);
  const result = validatePublicNewsCheckout({ root });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.runtimeImages.map((image) => image.remotePath), [
    '/news/news_20261025_runtime.avif',
    '/news/news_20261025_runtime.jpg',
    '/news/news_20261025_runtime.webp',
  ]);
});

test('kontrola HTTP wymaga 200 dla każdego wariantu runtime NEWS', async (t) => {
  const root = fixture(t);
  assert.equal(validatePublicNewsCheckout({ root }).runtimeImages.length, 3, 'runtime nie może zniknąć z planu kontroli');
  const ok = await checkPublicNewsImagesHttp({
    root,
    fetchImpl: async () => ({ status: 200 }),
  });
  assert.equal(ok.checked, 3);

  await assert.rejects(
    checkPublicNewsImagesHttp({
      root,
      fetchImpl: async (url) => ({ status: url.endsWith('.webp') ? 404 : 200 }),
    }),
    (error) => error.exitCode === EXIT.DATA && /NEWS_IMAGE_MISSING.*webp.*HTTP 404/.test(error.message),
  );
});

test('pusta lista runtime nie maskuje niekompletnej miniatury NEWS', async (t) => {
  const root = fixture(t);
  const fallbackPath = path.join(root, 'assets/data/news-fallback.json');
  const fallback = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
  delete fallback.items[0].image;
  fs.writeFileSync(fallbackPath, `${JSON.stringify(fallback)}\n`);
  await assert.rejects(
    checkPublicNewsImagesHttp({ root, fetchImpl: async () => ({ status: 200 }) }),
    (error) => error.exitCode === EXIT.DATA
      && /NEWS_PUBLIC_INVALID/.test(error.message)
      && /nie ma obiektu image/.test(error.message),
  );
});

test('awaria sieci kontroli HTTP jest błędem środowiskowym 30', async (t) => {
  const root = fixture(t);
  await assert.rejects(
    checkPublicNewsImagesHttp({
      root,
      timeoutMs: 5,
      fetchImpl: async () => { throw new Error('network down'); },
    }),
    (error) => error.exitCode === EXIT.ENVIRONMENT && /NEWS_HTTP_ENVIRONMENT/.test(error.message),
  );
});

test('nightly i oba tryby finalize uruchamiają publiczną kontrolę HTTP NEWS', () => {
  const nightly = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'broken-links-nightly.yml'), 'utf8');
  const finalize = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'deployment-finalize.js'), 'utf8');
  const postpush = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'live-postpush-check.sh'), 'utf8');
  assert.match(nightly, /node scripts\/news-public-http-check\.js/);
  assert.match(finalize, /scripts\/news-public-http-check\.js/);
  assert.match(postpush, /node scripts\/news-public-http-check\.js/);
});

test('news-integrity i predeploy korzystają z jednego wspólnego walidatora NEWS', () => {
  const integrity = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'news-integrity-check.js'), 'utf8');
  const predeploy = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'predeploy-gate.js'), 'utf8');
  assert.match(integrity, /validatePublicNewsCheckout/);
  assert.match(predeploy, /validatePublicNewsCheckout/);
  assert.doesNotMatch(predeploy, /function validatePublishedNewsImages/);
});

test('news-integrity porównuje live z live, fallback z fallback i dopuszcza szkic tylko w chronionym live', (t) => {
  const root = fixture(t);
  const fallback = fs.readFileSync(path.join(root, 'assets/data/news-fallback.json'));
  const parsedFallback = JSON.parse(fallback.toString('utf8'));
  parsedFallback.items[0].status = 'published';
  parsedFallback.items[0].id = 'news_1';
  const normalizedFallback = `${JSON.stringify(parsedFallback)}\n`;
  fs.writeFileSync(path.join(root, 'assets/data/news-fallback.json'), normalizedFallback);
  fs.mkdirSync(path.join(root, '_site', 'assets', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, '_site/assets/data/news-fallback.json'), normalizedFallback);

  const live = `${JSON.stringify({
    version: 1,
    items: [
      { id: 'news_private', title: 'Szkic prywatny', status: 'draft' },
      { id: 'news_1', title: 'News testowy', status: 'published' },
    ],
  })}\n`;
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, '_site', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/news-live.json'), live);
  fs.writeFileSync(path.join(root, '_site/data/news-live.json'), live);

  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/news-integrity-check.js')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /\[PASS\] NEWS integrity check OK/);
});
