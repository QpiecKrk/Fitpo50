'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { verifyDeployment, sha256 } = require('../scripts/lib/deployment-live-verifier');
const { collect } = require('../scripts/deployment-live-verify');
const { prepareDeploymentMarker, runDeploymentPrepare } = require('../scripts/prepare-deployment-marker');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');

const BASE_URL = 'https://fitpo50.pl';
const COMMIT = '1'.repeat(40);
const FALLBACK_PATH = 'assets/data/news-fallback.json';
const IMAGE_PATH = 'assets/news/news_20261025_test.webp';
const JPG_PATH = 'assets/news/news_20261025_test.jpg';
const FALLBACK_BYTES = Buffer.from('{"version":1,"items":[]}\n');
const IMAGE_BYTES = Buffer.from('runtime-news-image');

function jpegBytes(width, height, variant = 0) {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, variant & 0xff, 0x00,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

function newsSnapshot() {
  return {
    fallback: { path: FALLBACK_PATH, sha256: sha256(FALLBACK_BYTES) },
    runtime_images: [{ path: IMAGE_PATH, sha256: sha256(IMAGE_BYTES) }],
  };
}

function marker(version = 3, withNews = true) {
  return {
    version,
    release_id: 'release-news-hashes',
    prepared_at: '2026-10-28T00:00:00+01:00',
    public_fingerprint_sha256: 'f'.repeat(64),
    ...(withNews ? { news: newsSnapshot() } : {}),
    articles: [],
  };
}

function responsesFor(currentMarker, overrides = {}) {
  const values = new Map([
    [`${BASE_URL}/deployment.json`, { status: 200, body: `${JSON.stringify(currentMarker, null, 2)}\n` }],
    [`${BASE_URL}/`, { status: 200, body: '<link rel="canonical" href="https://fitpo50.pl/">' }],
    [`${BASE_URL}/porady.html`, { status: 200, body: '<link rel="canonical" href="https://fitpo50.pl/porady.html">' }],
    [`${BASE_URL}/sitemap.xml`, { status: 200, body: '<urlset></urlset>' }],
    [`${BASE_URL}/llms.txt`, { status: 200, body: 'llms' }],
    [`${BASE_URL}/llms-full.txt`, { status: 200, body: 'llms-full' }],
    [`${BASE_URL}/ads.txt`, { status: 404, body: 'not found' }],
    [`${BASE_URL}/assets/data/search-index.json`, { status: 200, body: '[]' }],
    [`${BASE_URL}/${FALLBACK_PATH}`, { status: 200, body: FALLBACK_BYTES }],
    [`${BASE_URL}/${IMAGE_PATH}`, { status: 200, body: IMAGE_BYTES }],
  ]);
  for (const [url, value] of Object.entries(overrides)) values.set(url, value);
  return values;
}

function verify(currentMarker, responses = responsesFor(currentMarker), localNewsFiles = new Map()) {
  const baseFiles = [
    '/', '/porady.html', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/assets/data/search-index.json',
  ].map((urlPath) => {
    const url = `${BASE_URL}${urlPath}`;
    return { url, sha256: sha256(responses.get(url).body) };
  });
  return verifyDeployment({
    expectedCommit: COMMIT,
    remoteCommit: COMMIT,
    marker: currentMarker,
    responses,
    baseUrl: BASE_URL,
    baseFiles,
    readLocalNewsFile: (imagePath) => localNewsFiles.get(imagePath),
  });
}

test('marker v3 ze zgodnymi hashami NEWS przechodzi', () => {
  const result = verify(marker());
  assert.equal(result.status, 'LIVE_DEPLOYED_AND_VALIDATED');
  assert.equal(result.errors.length, 0);
});

test('marker v3 blokuje fallback HTTP 200 z jedną zmienioną wartością', () => {
  const current = marker();
  const responses = responsesFor(current, {
    [`${BASE_URL}/${FALLBACK_PATH}`]: { status: 200, body: Buffer.from('{"version":1,"items":[{"changed":true}]}\n') },
  });
  const result = verify(current, responses);
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => error.includes(FALLBACK_PATH) && /SHA-256|różni/.test(error)));
});

test('marker v3 blokuje obraz HTTP 200 z innymi bajtami', () => {
  const current = marker();
  const responses = responsesFor(current, {
    [`${BASE_URL}/${IMAGE_PATH}`]: { status: 200, body: Buffer.from('different-image') },
  });
  const result = verify(current, responses);
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => error.includes(IMAGE_PATH) && /SHA-256|różni/.test(error)));
});

test('marker v3 blokuje obraz NEWS z HTTP 404', () => {
  const current = marker();
  const responses = responsesFor(current, {
    [`${BASE_URL}/${IMAGE_PATH}`]: { status: 404, body: Buffer.alloc(0) },
  });
  const result = verify(current, responses);
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => error.includes(IMAGE_PATH) && /HTTP 200/.test(error)));
});

test('JPG NEWS po przekodowaniu CDN przechodzi przy tych samych wymiarach', () => {
  const localJpg = jpegBytes(640, 480, 1);
  const liveJpg = jpegBytes(640, 480, 2);
  const current = marker();
  current.news.runtime_images.push({ path: JPG_PATH, sha256: sha256(localJpg) });
  const responses = responsesFor(current, {
    [`${BASE_URL}/${JPG_PATH}`]: { status: 200, contentType: 'image/jpeg', body: liveJpg },
  });
  const result = verify(current, responses, new Map([[JPG_PATH, localJpg]]));
  assert.equal(result.status, 'LIVE_DEPLOYED_AND_VALIDATED');
  assert.equal(result.errors.length, 0);
});

test('JPG NEWS o innych wymiarach jest blokowany', () => {
  const localJpg = jpegBytes(640, 480, 1);
  const liveJpg = jpegBytes(641, 480, 2);
  const current = marker();
  current.news.runtime_images.push({ path: JPG_PATH, sha256: sha256(localJpg) });
  const responses = responsesFor(current, {
    [`${BASE_URL}/${JPG_PATH}`]: { status: 200, contentType: 'image/jpeg', body: liveJpg },
  });
  const result = verify(current, responses, new Map([[JPG_PATH, localJpg]]));
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => error.includes(JPG_PATH) && /wymiar/i.test(error)));
});

test('odpowiedź HTTP 200 niebędąca JPEG jest blokowana dla JPG NEWS', () => {
  const localJpg = jpegBytes(640, 480, 1);
  const current = marker();
  current.news.runtime_images.push({ path: JPG_PATH, sha256: sha256(localJpg) });
  const responses = responsesFor(current, {
    [`${BASE_URL}/${JPG_PATH}`]: { status: 200, contentType: 'text/html; charset=utf-8', body: Buffer.from('<html>error</html>') },
  });
  const result = verify(current, responses, new Map([[JPG_PATH, localJpg]]));
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => error.includes(JPG_PATH) && /JPEG|image\/jpeg/i.test(error)));
});

test('JPG NEWS z HTTP 404 jest blokowany', () => {
  const localJpg = jpegBytes(640, 480, 1);
  const current = marker();
  current.news.runtime_images.push({ path: JPG_PATH, sha256: sha256(localJpg) });
  const responses = responsesFor(current, {
    [`${BASE_URL}/${JPG_PATH}`]: { status: 404, contentType: 'image/jpeg', body: Buffer.alloc(0) },
  });
  const result = verify(current, responses, new Map([[JPG_PATH, localJpg]]));
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => error.includes(JPG_PATH) && /HTTP 200/.test(error)));
});

test('zmiana jednego bajtu AVIF i WebP nadal jest blokowana przez SHA-256', () => {
  const avifPath = 'assets/news/news_20261025_test.avif';
  const webpPath = 'assets/news/news_20261025_test.webp';
  const avifBytes = Buffer.from('avif-original');
  const webpBytes = Buffer.from('webp-original');
  const current = marker();
  current.news.runtime_images = [
    { path: avifPath, sha256: sha256(avifBytes) },
    { path: webpPath, sha256: sha256(webpBytes) },
  ];
  const responses = responsesFor(current, {
    [`${BASE_URL}/${avifPath}`]: { status: 200, body: Buffer.from('avif-originaL') },
    [`${BASE_URL}/${webpPath}`]: { status: 200, body: Buffer.from('webp-originaL') },
  });
  const result = verify(current, responses);
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => error.includes(avifPath) && /SHA-256|różni/.test(error)));
  assert.ok(result.errors.some((error) => error.includes(webpPath) && /SHA-256|różni/.test(error)));
});

test('marker v3 bez sekcji news jest blokowany', () => {
  const current = marker(3, false);
  const result = verify(current, responsesFor(current));
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => /news/i.test(error)));
});

test('marker v2 bez sekcji news zachowuje dotychczasowe zachowanie', () => {
  const current = marker(2, false);
  const result = verify(current, responsesFor(current));
  assert.equal(result.status, 'LIVE_DEPLOYED_AND_VALIDATED');
});

test('deployment:prepare blokuje wynik bramki bez fallback_sha256', () => {
  let markerCalled = false;
  assert.throws(() => runDeploymentPrepare('/tmp/example', {
    newsSyncCheck: () => ({
      status: 'NEWS_IN_SYNC',
      fallback_path: FALLBACK_PATH,
      runtime_images: [],
    }),
    markerPrepare: () => { markerCalled = true; },
  }), /fallback_sha256/);
  assert.equal(markerCalled, false);
});

test('marker v3 zapisuje identyczny snapshot NEWS w źródle i eksporcie', () => {
  const root = createManagedTempDir({ prefix: 'fitpo50-deployment-news-marker-', projectRoot: process.cwd(), type: 'test' });
  try {
    for (const args of [
      ['init'], ['config', 'user.email', 'test@example.com'], ['config', 'user.name', 'Test'],
      ['commit', '--allow-empty', '-m', 'initial'],
    ]) {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    fs.mkdirSync(path.join(root, '_site/assets/data'), { recursive: true });
    for (const file of ['index.html', 'porady.html', 'sitemap.xml', 'llms.txt', 'llms-full.txt']) {
      fs.writeFileSync(path.join(root, '_site', file), file);
    }
    fs.writeFileSync(path.join(root, '_site/assets/data/search-index.json'), '[]');
    const snapshot = {
      fallback_path: FALLBACK_PATH,
      fallback_sha256: sha256(FALLBACK_BYTES),
      runtime_images: [{ path: IMAGE_PATH, sha256: sha256(IMAGE_BYTES) }],
    };
    const current = prepareDeploymentMarker(root, { newsSnapshot: snapshot });
    assert.equal(current.version, 3);
    assert.deepEqual(current.news, newsSnapshot());
    assert.equal(
      fs.readFileSync(path.join(root, 'deployment.json'), 'utf8'),
      fs.readFileSync(path.join(root, '_site/deployment.json'), 'utf8'),
    );
  } finally {
    disposeTempWorkspace(root, { status: 'COMPLETED' });
  }
});

test('finalize pobiera pliki NEWS z cache-bustem związanym z release_id', async (t) => {
  const url = `${BASE_URL}/${FALLBACK_PATH}`;
  const requests = [];
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async (requestUrl) => {
    requests.push(String(requestUrl));
    return { status: 200, arrayBuffer: async () => FALLBACK_BYTES };
  };
  const responses = await collect([url], 1000, {
    cacheBustedUrls: new Set([url]),
    releaseId: 'release-news-hashes',
  });
  assert.equal(responses.get(url).status, 200);
  assert.equal(new URL(requests[0]).searchParams.get('__fitpo50_release'), 'release-news-hashes');
});
