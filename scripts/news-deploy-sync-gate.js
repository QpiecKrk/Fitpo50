#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  EXIT,
  FtpsTransport,
  NewsPullError,
  isGitTracked,
  readCredentials,
} = require('./news-pull');
const { createManagedTempDir, disposeTempWorkspace } = require('./lib/temp-workspace');
const { validatePublicNewsCheckout } = require('./lib/news-public-integrity');

const FALLBACK_PATH = 'assets/data/news-fallback.json';
const PANEL_SYNC_GROUPS = Object.freeze([
  Object.freeze({
    name: 'live',
    account: 'data',
    remote: '/news-live.json',
    local: Object.freeze(['data/news-live.json', '_site/data/news-live.json']),
  }),
  Object.freeze({
    name: 'fallback',
    account: 'assets',
    remote: '/data/news-fallback.json',
    local: Object.freeze(['assets/data/news-fallback.json', '_site/assets/data/news-fallback.json']),
  }),
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validatePublicFallback(buffer, label) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new NewsPullError(`${label}: uszkodzony JSON (${error.message}).`, EXIT.DATA);
  }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new NewsPullError(`${label}: wymagane version=1 i items[].`, EXIT.DATA);
  }
  if (parsed.items.some((item) => String(item?.status || '').toLowerCase() === 'draft')) {
    throw new NewsPullError(`${label}: publiczny fallback zawiera szkic.`, EXIT.DATA);
  }
}

function validateLiveStore(buffer, label) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new NewsPullError(`${label}: uszkodzony JSON (${error.message}).`, EXIT.DATA);
  }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new NewsPullError(`${label}: wymagane version=1 i items[].`, EXIT.DATA);
  }
  return parsed;
}

function assertTrackedLiveContainsOnlyPublished(buffer, label) {
  const parsed = validateLiveStore(buffer, label);
  const blocked = parsed.items
    .filter((item) => String(item?.status || '').toLowerCase() !== 'published')
    .map((item) => String(item?.title || item?.id || '(bez tytułu)'));
  if (blocked.length) {
    throw new NewsPullError(
      'NEWS_DRAFTS_IN_TRACKED_FILE: śledzony plik live zawiera wpisy nieopublikowane. Opublikuj albo usuń szkice w panelu, potem uruchom news:pull.',
      EXIT.DATA,
      blocked.map((title) => `${label}: ${title}`),
    );
  }
  return parsed;
}

function checkNewsFallbackSync(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  for (const group of PANEL_SYNC_GROUPS) {
    for (const relative of group.local) {
      if (!fs.existsSync(path.join(root, relative))) {
        throw new NewsPullError(`NEWS_OUT_OF_SYNC: brak lokalnego ${relative}. Uruchom npm run news:pull.`, EXIT.DATA);
      }
      if (!isGitTracked(root, relative)) {
        throw new NewsPullError(`NEWS_OUT_OF_SYNC: ${relative} musi pozostać śledzony w Gicie do czasu przeniesienia danych panelu poza katalog deployu.`, EXIT.DATA);
      }
      if (group.name === 'live') {
        assertTrackedLiveContainsOnlyPublished(fs.readFileSync(path.join(root, relative)), relative);
      }
    }
  }

  const transport = options.transport || new FtpsTransport({ credentials: readCredentials(options.secretsFile) });
  const staging = createManagedTempDir({
    prefix: 'fitpo50-news-deploy-gate-',
    projectRoot: root,
    type: 'news-deploy-gate',
  });
  let completed = false;
  try {
    const localHashes = {};
    const remoteHashes = {};
    const outOfSync = [];
    for (const group of PANEL_SYNC_GROUPS) {
      const remotePath = path.join(staging, `${group.name}.json`);
      transport.download(group.account, group.remote, remotePath, 20 * 1024 * 1024);
      const remote = fs.readFileSync(remotePath);
      const remoteLabel = `serwer:${group.account}${group.remote}`;
      if (group.name === 'fallback') validatePublicFallback(remote, remoteLabel);
      else validateLiveStore(remote, remoteLabel);
      const remoteHash = sha256(remote);
      remoteHashes[group.name] = remoteHash;
      for (const file of group.local) {
        const local = fs.readFileSync(path.join(root, file));
        if (group.name === 'fallback') validatePublicFallback(local, file);
        else assertTrackedLiveContainsOnlyPublished(local, file);
        const localHash = sha256(local);
        localHashes[file] = localHash;
        if (localHash !== remoteHash) {
          outOfSync.push(`${file}: SHA-256 ${localHash}; odpowiadający plik serwera: ${remoteLabel}, SHA-256 ${remoteHash}`);
        }
      }
    }
    if (outOfSync.length) {
      throw new NewsPullError(
        'NEWS_OUT_OF_SYNC: śledzone pliki NEWS różnią się od odpowiadających im plików panelu. Uruchom npm run news:pull, sprawdź zmianę i zatwierdź ją przed deployment:prepare.',
        EXIT.DATA,
        outOfSync,
      );
    }
    const checkout = validatePublicNewsCheckout({ root });
    if (checkout.errors.length) {
      throw new NewsPullError(`NEWS_PUBLIC_INVALID: ${checkout.errors.join(' | ')}`, EXIT.DATA, checkout.errors);
    }
    const remoteNames = checkout.runtimeImages.length
      ? new Set(transport.list('assets', '/news/'))
      : new Set();
    const missing = checkout.runtimeImages
      .map((image) => path.basename(image.relative))
      .filter((name) => !remoteNames.has(name));
    if (missing.length) {
      throw new NewsPullError(
        `NEWS_IMAGE_MISSING: panel nie udostępnia wymaganych miniatur: ${missing.join(', ')}`,
        EXIT.DATA,
        missing,
      );
    }
    const runtimeImages = [];
    for (const image of checkout.runtimeImages) {
      const target = path.join(staging, 'news', path.basename(image.relative));
      transport.download('assets', image.remotePath, target, 20 * 1024 * 1024);
      runtimeImages.push({ path: image.relative, sha256: sha256(fs.readFileSync(target)) });
    }
    runtimeImages.sort((left, right) => left.path.localeCompare(right.path, 'pl'));
    completed = true;
    return {
      status: 'NEWS_IN_SYNC',
      local_sha256: localHashes[FALLBACK_PATH],
      local_hashes: localHashes,
      remote_sha256: remoteHashes.fallback,
      remote_hashes: remoteHashes,
      runtime_images_checked: checkout.runtimeImages.length,
      fallback_path: FALLBACK_PATH,
      fallback_sha256: remoteHashes.fallback,
      runtime_images: runtimeImages,
    };
  } finally {
    disposeTempWorkspace(staging, { status: completed ? 'COMPLETED' : 'FAILED' });
  }
}

function main() {
  try {
    const result = checkNewsFallbackSync();
    console.log(`[PASS] ${result.status}: assets/data/news-fallback.json jest zgodny z panelem.`);
  } catch (error) {
    const exitCode = error instanceof NewsPullError ? error.exitCode : EXIT.ENVIRONMENT;
    console.error(`[NEWS DEPLOY GATE][FAIL][${exitCode}] ${error.message || error}`);
    if (Array.isArray(error.details)) error.details.forEach((detail) => console.error(`- ${detail}`));
    process.exitCode = exitCode;
  }
}

if (require.main === module) main();

module.exports = {
  FALLBACK_PATH,
  PANEL_SYNC_GROUPS,
  checkNewsFallbackSync,
  sha256,
  assertTrackedLiveContainsOnlyPublished,
  validateLiveStore,
  validatePublicFallback,
};
