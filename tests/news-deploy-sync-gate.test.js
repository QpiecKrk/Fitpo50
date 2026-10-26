const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { EXIT, NewsPullError } = require('../scripts/news-pull');
const { checkNewsFallbackSync } = require('../scripts/news-deploy-sync-gate');
const { runDeploymentPrepare } = require('../scripts/prepare-deployment-marker');

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function fixtureRoot(t, fallbackContent, liveContent = livePayload()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-gate-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets/data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, '_site/assets/data'), { recursive: true });
  fs.mkdirSync(path.join(root, '_site/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/data/news-fallback.json'), fallbackContent);
  fs.writeFileSync(path.join(root, '_site/assets/data/news-fallback.json'), fallbackContent);
  fs.writeFileSync(path.join(root, 'data/news-live.json'), liveContent);
  fs.writeFileSync(path.join(root, '_site/data/news-live.json'), liveContent);
  fs.writeFileSync(path.join(root, '.gitignore'), 'assets/news/news_20*\n_site/assets/news/news_20*\n');
  git(root, 'init');
  git(root, 'add', 'assets/data/news-fallback.json', '_site/assets/data/news-fallback.json', 'data/news-live.json', '_site/data/news-live.json', '.gitignore');
  return root;
}

function livePayload(title = 'News panelu') {
  return Buffer.from(`${JSON.stringify({
    version: 1,
    items: [{ id: 'news_1', title, status: 'published' }],
  })}\n`);
}

function payload(title = 'News') {
  return Buffer.from(`${JSON.stringify({
    version: 1,
    items: [{
      id: 'news_1',
      title,
      image: {
        avif: './assets/news/news_20261025_test.avif',
        webp: './assets/news/news_20261025_test.webp',
        jpg: './assets/news/news_20261025_test.jpg',
      },
    }],
  })}\n`);
}

class FakeTransport {
  constructor(remoteFallback, error = null, names = null, remoteLive = livePayload()) {
    this.remoteFallback = remoteFallback;
    this.remoteLive = remoteLive;
    this.error = error;
    this.names = names || [
      'news_20261025_test.avif', 'news_20261025_test.webp', 'news_20261025_test.jpg',
    ];
  }

  download(_account, remotePath, target) {
    if (this.error) throw this.error;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const content = remotePath === '/data/news-fallback.json'
      ? this.remoteFallback
      : remotePath === '/news-live.json'
        ? this.remoteLive
        : Buffer.from('image');
    fs.writeFileSync(target, content);
  }

  list(account, remotePath) {
    assert.equal(account, 'assets');
    assert.equal(remotePath, '/news/');
    return this.names;
  }
}

test('bramka NEWS przepuszcza fallback identyczny z panelem', (t) => {
  const content = payload();
  const live = livePayload();
  const root = fixtureRoot(t, content, live);
  const result = checkNewsFallbackSync({ root, transport: new FakeTransport(content, null, null, live) });
  assert.equal(result.status, 'NEWS_IN_SYNC');
  assert.equal(result.local_sha256, result.remote_sha256);
  assert.equal(Object.keys(result.local_hashes).length, 4);
  assert.notEqual(result.remote_hashes.live, result.remote_hashes.fallback);
  assert.equal(result.runtime_images_checked, 3);
});

test('bramka NEWS porównuje także śledzony mirror _site/data/news-live.json', (t) => {
  const content = payload();
  const live = livePayload();
  const root = fixtureRoot(t, content, live);
  fs.writeFileSync(path.join(root, '_site/data/news-live.json'), livePayload('Stara kopia z deployu'));
  assert.throws(
    () => checkNewsFallbackSync({ root, transport: new FakeTransport(content, null, null, live) }),
    (error) => error.exitCode === EXIT.DATA
      && /NEWS_OUT_OF_SYNC/.test(error.message)
      && error.details.some((detail) => detail.includes('_site/data/news-live.json')),
  );
});

test('bramka NEWS blokuje śledzony live z każdym wpisem innym niż published', (t) => {
  const content = payload();
  const live = JSON.parse(livePayload().toString('utf8'));
  live.items.unshift({ id: 'news_private', title: 'Prywatny szkic', status: 'draft' });
  const liveWithDraft = Buffer.from(`${JSON.stringify(live)}\n`);
  const root = fixtureRoot(t, content, liveWithDraft);
  let remoteRead = false;
  const transport = new FakeTransport(content, null, null, liveWithDraft);
  const originalDownload = transport.download.bind(transport);
  transport.download = (...args) => { remoteRead = true; return originalDownload(...args); };
  assert.throws(
    () => checkNewsFallbackSync({ root, transport }),
    (error) => error.exitCode === EXIT.DATA
      && /NEWS_DRAFTS_IN_TRACKED_FILE/.test(error.message)
      && /Opublikuj albo usuń szkice w panelu, potem uruchom news:pull/.test(error.message),
  );
  assert.equal(remoteRead, false, 'lokalny szkic ma blokować przed odczytem sieciowym');
});

test('deployment:prepare nie zapisuje markera, gdy śledzony live zawiera szkic', () => {
  let markerCalled = false;
  assert.throws(() => runDeploymentPrepare('/tmp/example', {
    newsSyncCheck: () => { throw new NewsPullError('NEWS_DRAFTS_IN_TRACKED_FILE', EXIT.DATA); },
    markerPrepare: () => { markerCalled = true; },
  }), /NEWS_DRAFTS_IN_TRACKED_FILE/);
  assert.equal(markerCalled, false);
});

test('bramka NEWS blokuje brak runtime miniatury na serwerze', (t) => {
  const content = payload();
  const root = fixtureRoot(t, content);
  assert.throws(
    () => checkNewsFallbackSync({
      root,
      transport: new FakeTransport(content, null, ['news_20261025_test.avif', 'news_20261025_test.webp']),
    }),
    (error) => error.exitCode === EXIT.DATA && /NEWS_IMAGE_MISSING.*jpg/.test(error.message),
  );
});

test('bramka NEWS blokuje różnicę bez możliwości obejścia', (t) => {
  const root = fixtureRoot(t, payload('Wersja Git'));
  assert.throws(
    () => checkNewsFallbackSync({ root, transport: new FakeTransport(payload('Wersja panelu')) }),
    (error) => error.exitCode === EXIT.DATA && /NEWS_OUT_OF_SYNC.*news:pull/.test(error.message),
  );
  let markerCalled = false;
  assert.throws(() => runDeploymentPrepare(root, {
    newsSyncCheck: () => { throw new NewsPullError('NEWS_OUT_OF_SYNC', EXIT.DATA); },
    markerPrepare: () => { markerCalled = true; },
  }), /NEWS_OUT_OF_SYNC/);
  assert.equal(markerCalled, false);
});

test('bramka NEWS klasyfikuje brak połączenia jako kod 30', (t) => {
  const root = fixtureRoot(t, payload());
  assert.throws(
    () => checkNewsFallbackSync({
      root,
      transport: new FakeTransport(null, new NewsPullError('Brak połączenia FTPS.', EXIT.ENVIRONMENT)),
    }),
    (error) => error.exitCode === EXIT.ENVIRONMENT,
  );
});

test('deployment:prepare uruchamia bramkę NEWS przed zapisem markera', () => {
  const order = [];
  const marker = runDeploymentPrepare('/tmp/example', {
    newsSyncCheck: () => order.push('news-gate'),
    markerPrepare: () => { order.push('marker'); return { release_id: 'test' }; },
  });
  assert.deepEqual(order, ['news-gate', 'marker']);
  assert.equal(marker.release_id, 'test');
});
