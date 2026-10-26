'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync, spawnSync } = require('node:child_process');
const { atomicWriteFileSync } = require('../scripts/lib/atomic-file');
const { GSC_FRESHNESS_MAX_AGE_HOURS, isFreshGscTimestamp } = require('../scripts/lib/gsc-policy');
const { warsawIso } = require('../scripts/lib/time');
const { httpGetJson } = require('../scripts/gsc-auto-report');
const { classifyHttpStatus, requestUrl } = require('../scripts/verify-article-evidence');
const {
  assertPreparedPublicationState,
  changedRootArticles,
  extractLocalAssetPaths,
  publicationStateFingerprint,
  publicationStateSnapshot,
  publicationStateDetailsPath,
} = require('../scripts/prepare-deployment-marker');

const ROOT = path.join(__dirname, '..');

function temporary(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'archive') walk(absolute, output);
    } else if (entry.isFile() && entry.name.endsWith('.js')) output.push(absolute);
  }
  return output;
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function writePublicationDetails(root, snapshot) {
  const file = publicationStateDetailsPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({
    publication_state_sha256: snapshot.fingerprint,
    files: snapshot.files,
  })}\n`);
}

test('atomowy zapis zachowuje poprzedni plik po przerwaniu i wszystkie aktywne skrypty używają helpera', () => {
  const root = temporary('fitpo50-atomic-write-');
  const file = path.join(root, 'state.json');
  fs.writeFileSync(file, 'poprzedni\n');
  assert.throws(() => atomicWriteFileSync(file, 'ucięty\n', {
    atomicHooks: { beforeCommit: () => { throw new Error('symulowane przerwanie'); } },
  }), /symulowane przerwanie/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'poprzedni\n');
  const unsafe = walk(path.join(ROOT, 'scripts'))
    .filter((candidate) => candidate !== path.join(ROOT, 'scripts', 'lib', 'atomic-file.js'))
    .filter((candidate) => /\bfs\.writeFileSync\s*\(/.test(fs.readFileSync(candidate, 'utf8')));
  assert.deepEqual(unsafe, []);
  const pythonScan = spawnSync('rg', [
    '-l', '\\.write_text\\(', path.join(ROOT, 'scripts'), '--glob', '*.py', '--glob', '!archive/**',
  ], { encoding: 'utf8' });
  assert.ok([0, 1].includes(pythonScan.status), pythonScan.stderr);
  const pythonUnsafe = String(pythonScan.stdout || '').trim().split('\n').filter(Boolean);
  assert.deepEqual(pythonUnsafe, []);
  const sessionReport = fs.readFileSync(path.join(ROOT, 'scripts', 'session-start-report.sh'), 'utf8');
  assert.match(sessionReport, /cat > "\$REPORT_TMP"/);
  assert.match(sessionReport, /mv "\$REPORT_TMP" "\$REPORT_FILE"/);
  assert.match(sessionReport, /mv "\$DOWNLOADS_LATEST\.tmp\.\$\$" "\$DOWNLOADS_LATEST"/);
  assert.match(sessionReport, /mv "\$DOWNLOADS_ARCHIVE\.tmp\.\$\$" "\$DOWNLOADS_ARCHIVE"/);
  const recovery = fs.readFileSync(path.join(ROOT, 'scripts', 'hostinger-deploy-recovery.sh'), 'utf8');
  assert.match(recovery, /mv "\$SUMS_TMP" "\$BACKUP_DIR\/SHA256SUMS"/);
});

test('GitHub i autocomplete kończą timeout czytelnym błędem środowiskowym', async () => {
  const hangingGet = () => {
    const request = new EventEmitter();
    request.setTimeout = (_milliseconds, callback) => setImmediate(callback);
    request.destroy = (error) => setImmediate(() => request.emit('error', error));
    return request;
  };
  await assert.rejects(
    httpGetJson('https://api.github.com/test', {}, 0, { timeoutMs: 5, get: hangingGet }),
    (error) => error?.exitCode === 30 && /GITHUB_TIMEOUT.*5 ms/.test(error.message),
  );

  const hangingFetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });
  const result = await requestUrl('https://suggestqueries.google.com/complete/search?q=żółć', 5, {
    captureAutocomplete: true,
    fetchImpl: hangingFetch,
  });
  assert.equal(result.url_status, 'verification_failed');
  assert.match(result.error, /HTTP_TIMEOUT po 5 ms/);
});

test('HTTP 408 jest ponawiany i pozostaje błędem środowiskowym, nie treści', async () => {
  let calls = 0;
  const fetchImpl = async () => ({ status: (++calls === 1 ? 408 : 408), url: 'https://example.test/' });
  const result = await requestUrl('https://example.test/', 100, { fetchImpl });
  assert.equal(calls, 2);
  assert.equal(classifyHttpStatus(408), 'temporarily_unavailable');
  assert.equal(result.url_status, 'temporarily_unavailable');

  const response408 = () => {
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.destroy = (error) => request.emit('error', error);
    setImmediate(() => {
      const response = new EventEmitter();
      response.statusCode = 408;
      response.headers = {};
      response.resume = () => {};
      request.emit('response', response);
    });
    return request;
  };
  const githubGet = (_url, _options, callback) => {
    const request = response408();
    request.once('response', callback);
    return request;
  };
  await assert.rejects(
    httpGetJson('https://api.github.com/test', {}, 0, { timeoutMs: 100, get: githubGet }),
    (error) => error?.exitCode === 30 && /GITHUB_HTTP_408/.test(error.message),
  );
});

test('budżet GitHub Actions mieści pełne ponowienia kontroli live i popraw-seo', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'live-postpush-check.yml'), 'utf8');
  const minutes = Number(workflow.match(/timeout-minutes:\s*(\d+)/)?.[1]);
  const outerSeconds = Number(workflow.match(/timeout --foreground (\d+)s/)?.[1]);
  const retries = Number(workflow.match(/RETRIES:\s*"(\d+)"/)?.[1]);
  const delay = Number(workflow.match(/DELAY:\s*"(\d+)"/)?.[1]);
  const timeout = Number(workflow.match(/TIMEOUT:\s*"(\d+)"/)?.[1]);
  const firstStageWorst = (retries + 1) * timeout * 2 + retries * delay + 20;
  const seoWorst = (12 + 1) * 12 + 12 * 15;
  assert.ok(outerSeconds >= firstStageWorst, `${outerSeconds}s < ${firstStageWorst}s`);
  assert.ok(minutes * 60 >= outerSeconds + seoWorst + 60, 'job może uciąć drugą kontrolę podczas ponowień');
});

test('świeżość GSC ma jedną wspólną, nieprzekraczalną regułę 72 h', () => {
  assert.equal(GSC_FRESHNESS_MAX_AGE_HOURS, 72);
  const now = new Date('2026-10-25T12:00:00Z');
  assert.equal(isFreshGscTimestamp(new Date(now.getTime() - 71.99 * 3600000), now), true);
  assert.equal(isFreshGscTimestamp(new Date(now.getTime() - 72 * 3600000), now), false);
  const contract = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'gsc-data-contract.js'), 'utf8');
  assert.match(contract, /GSC_FRESHNESS_MAX_AGE_HOURS/);
  assert.doesNotMatch(contract, /GSC_MAX_INPUT_AGE_HOURS/);
});

test('raporty i marker korzystają ze wspólnego czasu Europe/Warsaw z DST', () => {
  assert.equal(warsawIso(new Date('2026-01-15T12:00:00Z')), '2026-01-15T13:00:00+01:00');
  assert.equal(warsawIso(new Date('2026-07-15T12:00:00Z')), '2026-07-15T14:00:00+02:00');
  const offenders = walk(path.join(ROOT, 'scripts')).filter((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return /(?:generated_at|updated_at|checked_at|prepared_at|created_at|published_at|captured_at)[^\n]*toISOString\(\)/.test(source);
  });
  assert.deepEqual(offenders, []);
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts', 'prepare-deployment-marker.js'), 'utf8'), /prepared_at: options\.preparedAt \|\| warsawIso\(\)/);
});

test('finalizacja odrzuca marker po zmianie śledzonego pliku publikacji i wskazuje plik', (t) => {
  const root = temporary('fitpo50-marker-head-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  fs.mkdirSync(path.join(root, '_site'));
  fs.writeFileSync(path.join(root, 'index.html'), 'wersja 1');
  fs.writeFileSync(path.join(root, '_site', 'index.html'), 'wersja 1');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'base');
  const prepared = publicationStateSnapshot(root);
  const marker = {
    prepared_from_head: git(root, 'rev-parse', 'HEAD'),
    publication_state_sha256: prepared.fingerprint,
  };
  writePublicationDetails(root, prepared);
  assert.equal(assertPreparedPublicationState(root, marker), true);
  fs.writeFileSync(path.join(root, 'index.html'), 'wersja 2');
  fs.writeFileSync(path.join(root, '_site', 'index.html'), 'wersja 2');
  assert.throws(
    () => assertPreparedPublicationState(root, marker),
    (error) => /DEPLOYMENT_PREPARE_STALE/.test(error.message)
      && /zmienione: .*index\.html/.test(error.message),
  );
});

test('fingerprint ignoruje runtime, obejmuje nowe pliki i jest identyczny z czystym checkoutem', (t) => {
  const root = temporary('fitpo50-marker-files-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  fs.mkdirSync(path.join(root, '_site', 'assets', 'news'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'news'), { recursive: true });
  fs.writeFileSync(path.join(root, '.gitignore'), 'assets/news/news_20*\n_site/assets/news/news_20*\n');
  fs.writeFileSync(path.join(root, 'index.html'), 'index');
  fs.writeFileSync(path.join(root, '_site', 'index.html'), 'index');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'base');

  const clean = publicationStateFingerprint(root);
  for (const prefix of ['assets/news', '_site/assets/news']) {
    fs.writeFileSync(path.join(root, prefix, 'news_20261025_runtime.jpg'), 'runtime');
  }
  assert.equal(publicationStateFingerprint(root), clean, 'ignorowane pliki nie mogą zmieniać fingerprintu');

  fs.writeFileSync(path.join(root, 'nowy-artykul.html'), 'nowy');
  fs.writeFileSync(path.join(root, '_site', 'nowy-artykul.html'), 'nowy');
  const withArticle = publicationStateFingerprint(root);
  assert.notEqual(withArticle, clean, 'nowy nieignorowany artykuł musi wejść do fingerprintu');

  fs.rmSync(path.join(root, 'assets', 'news', 'news_20261025_runtime.jpg'));
  fs.rmSync(path.join(root, '_site', 'assets', 'news', 'news_20261025_runtime.jpg'));
  assert.equal(publicationStateFingerprint(root), withArticle, 'czysty checkout bez ignorowanych miniatur ma ten sam fingerprint');
});

test('DEPLOYMENT_PREPARE_STALE wypisuje brakujące, dodatkowe i zmienione pliki', (t) => {
  const root = temporary('fitpo50-marker-diff-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  fs.mkdirSync(path.join(root, '_site'));
  for (const name of ['missing.html', 'changed.html']) {
    fs.writeFileSync(path.join(root, name), name);
    fs.writeFileSync(path.join(root, '_site', name), name);
  }
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'base');
  const prepared = publicationStateSnapshot(root);
  const marker = {
    prepared_from_head: git(root, 'rev-parse', 'HEAD'),
    publication_state_sha256: prepared.fingerprint,
  };
  writePublicationDetails(root, prepared);
  fs.rmSync(path.join(root, '_site', 'missing.html'));
  fs.writeFileSync(path.join(root, '_site', 'changed.html'), 'changed-v2');
  fs.writeFileSync(path.join(root, '_site', 'additional.html'), 'additional');
  assert.throws(
    () => assertPreparedPublicationState(root, marker),
    (error) => /brakujące: _site\/missing\.html/.test(error.message)
      && /dodatkowe: _site\/additional\.html/.test(error.message)
      && /zmienione: _site\/changed\.html/.test(error.message),
  );
});

test('publiczny marker nie ujawnia listy plików, a czysty checkout nadal blokuje zły odcisk', (t) => {
  const root = temporary('fitpo50-marker-public-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  fs.mkdirSync(path.join(root, '_site'));
  fs.writeFileSync(path.join(root, 'index.html'), 'index');
  fs.writeFileSync(path.join(root, '_site', 'index.html'), 'index');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'base');
  const prepared = publicationStateSnapshot(root);
  const marker = {
    prepared_from_head: git(root, 'rev-parse', 'HEAD'),
    publication_state_sha256: prepared.fingerprint,
  };
  fs.writeFileSync(path.join(root, '_site', 'index.html'), 'zmiana');
  assert.throws(
    () => assertPreparedPublicationState(root, marker),
    (error) => /DEPLOYMENT_PREPARE_STALE/.test(error.message)
      && /szczegóły plików niedostępne/.test(error.message),
  );
  assert.equal(Object.hasOwn(marker, 'publication_state_files'), false);
});

test('kontrola live odświeża origin/main wewnątrz każdej próby', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'deployment-live-verify.js'), 'utf8');
  const loop = source.slice(source.indexOf('for (let attempt = 0; attempt <= args.retries'), source.indexOf('const reportDir'));
  assert.match(loop, /git\(\['ls-remote', 'origin', 'refs\/heads\/main'\]\)/);
  assert.doesNotMatch(source.slice(source.indexOf('const expectedCommit'), source.indexOf('for (let attempt')), /ls-remote/);
});

test('parser artefaktów zbiera jednocześnie src i cały srcset tego samego znacznika', () => {
  assert.deepEqual(extractLocalAssetPaths('<picture><source src="assets/a.jpg" srcset="assets/a.webp 1x, assets/a.avif 2x"><img src="assets/b.jpg" srcset="assets/b.webp 1x"></picture>'), [
    'assets/a.jpg', 'assets/a.webp', 'assets/a.avif', 'assets/b.jpg', 'assets/b.webp',
  ]);
});

test('zmiana wspólnego logo przypisuje do markera każdy artykuł, który je wykorzystuje', () => {
  const root = temporary('fitpo50-shared-logo-');
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  fs.mkdirSync(path.join(root, '_site', 'assets'), { recursive: true });
  for (const slug of ['pierwszy', 'drugi']) {
    fs.writeFileSync(path.join(root, '_site', `${slug}.html`), `<script type="application/ld+json">{"@type":"BlogPosting"}</script><img src="./assets/logo.webp">`);
  }
  fs.writeFileSync(path.join(root, '_site', 'assets', 'logo.webp'), 'logo-v1');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'base');
  git(root, 'update-ref', 'refs/remotes/origin/main', git(root, 'rev-parse', 'HEAD'));
  fs.writeFileSync(path.join(root, '_site', 'assets', 'logo.webp'), 'logo-v2');
  assert.deepEqual(changedRootArticles(root), ['drugi.html', 'pierwszy.html']);
});
