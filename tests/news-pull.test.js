'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  EXIT,
  NewsPullError,
  buildRemotePlan,
  parseArgs,
  pullNews,
  verifyBackupManifest,
} = require('../scripts/news-pull');

const BASE = 'news_20261025_120000_abcdef12';

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function samplePackage() {
  const images = {
    [`/news/${BASE}.jpg`]: Buffer.from('jpeg-image'),
    [`/news/${BASE}.webp`]: Buffer.from('webp-image'),
    [`/news/${BASE}.avif`]: Buffer.from('avif-image'),
  };
  const item = {
    id: 'news_example',
    title: 'Nowy news testowy',
    content_html: '<p>Treść testowa.</p>',
    status: 'published',
    sort_order: 1,
    image_base: BASE,
    image_alt: 'Opis obrazu',
    image_hashes: {
      jpg: sha1(images[`/news/${BASE}.jpg`]),
      webp: sha1(images[`/news/${BASE}.webp`]),
      avif: sha1(images[`/news/${BASE}.avif`]),
    },
    sources: [{ label: 'Źródło', url: 'https://example.com/source' }],
    created_at: '2026-10-25T12:00:00+01:00',
    updated_at: '2026-10-25T12:00:00+01:00',
    published_at: '2026-10-25T12:00:00+01:00',
  };
  const fallback = {
    id: item.id,
    title: item.title,
    content_html: item.content_html,
    sort_order: item.sort_order,
    image: Object.fromEntries(['jpg', 'webp', 'avif'].map((ext) => [ext, `./assets/news/${BASE}.${ext}`])),
    sources: item.sources,
    updated_at: item.updated_at,
    published_at: item.published_at,
    excerpt: 'Treść testowa.',
  };
  return {
    files: {
      '/news-live.json': Buffer.from(`${JSON.stringify({ version: 1, updatedAt: item.updated_at, items: [item] })}\n`),
      '/data/news-fallback.json': Buffer.from(`${JSON.stringify({ version: 1, updatedAt: item.updated_at, items: [fallback] })}\n`),
      '/news-backups/news-live-20261025_120000.json': Buffer.from('{}\n'),
      ...images,
    },
  };
}

class FakeTransport {
  constructor(pkg = samplePackage(), options = {}) {
    this.files = pkg.files;
    this.options = options;
    this.downloads = 0;
  }

  list(account, dir) {
    const key = `${account}:${dir}`;
    const lists = {
      'data:/': ['news-live.json', 'news-backups', 'private.json'],
      'data:/news-backups/': ['news-live-20261025_120000.json'],
      'assets:/': ['data', 'news', 'other-folder'],
      'assets:/data/': ['news-fallback.json'],
      'assets:/news/': [`${BASE}.jpg`, `${BASE}.webp`, `${BASE}.avif`],
    };
    return this.options.lists?.[key] || lists[key] || [];
  }

  download(_account, remote, target) {
    this.downloads += 1;
    if (this.options.failAt === this.downloads) throw new NewsPullError('Zerwane połączenie.', EXIT.ENVIRONMENT);
    const value = this.files[remote];
    if (!value) throw new NewsPullError(`Brak fixture ${remote}`, EXIT.ENVIRONMENT);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  }
}

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-pull-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function mirror(root) {
  for (const [sourceRelative, targetRelative] of [
    ['data/news-live.json', 'data/news-live.json'],
    ['assets/data/news-fallback.json', 'assets/data/news-fallback.json'],
  ]) {
    const source = path.join(root, sourceRelative);
    const target = path.join(root, '_site', targetRelative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

const validInspector = (file) => ({
  format: path.extname(file).slice(1).toLowerCase() === 'jpg' ? 'JPEG' : path.extname(file).slice(1).toUpperCase(),
  width: 640,
  height: 480,
});

test('allowlista blokuje złośliwą nazwę z serwera', () => {
  const transport = new FakeTransport(samplePackage(), { lists: { 'assets:/news/': ['../config.php'] } });
  assert.throws(() => buildRemotePlan(transport), (error) => error.exitCode === EXIT.DATA && /Niebezpieczna nazwa/.test(error.message));
});

test('uszkodzony JSON kończy się kodem danych i niczego nie promuje', (t) => {
  const root = tempRoot(t);
  const pkg = samplePackage();
  pkg.files['/news-live.json'] = Buffer.from('{broken');
  assert.throws(() => pullNews({ root, transport: new FakeTransport(pkg), imageInspector: validInspector }),
    (error) => error.exitCode === EXIT.DATA && /uszkodzony JSON/.test(error.message));
  assert.equal(fs.existsSync(path.join(root, 'data/news-live.json')), false);
});

test('brak wariantu obrazu blokuje całą paczkę', (t) => {
  const root = tempRoot(t);
  const transport = new FakeTransport(samplePackage(), {
    lists: { 'assets:/news/': [`${BASE}.jpg`, `${BASE}.webp`] },
  });
  assert.throws(() => pullNews({ root, transport, imageInspector: validInspector }),
    (error) => error.exitCode === EXIT.DATA && error.details.some((item) => item.includes(`${BASE}.avif`)));
});

test('zły hash lub wymiar obrazu blokuje paczkę przed zapisem', (t) => {
  const root = tempRoot(t);
  const badHash = samplePackage();
  badHash.files[`/news/${BASE}.jpg`] = Buffer.from('podmieniony-obraz');
  assert.throws(() => pullNews({ root, transport: new FakeTransport(badHash), imageInspector: validInspector }),
    (error) => error.exitCode === EXIT.DATA && error.details.some((item) => item.includes('hashem zapisanym przez panel')));

  assert.throws(() => pullNews({
    root,
    transport: new FakeTransport(),
    imageInspector: () => ({ format: 'JPEG', width: 320, height: 240 }),
  }), (error) => error.exitCode === EXIT.DATA && error.details.some((item) => item.includes('oczekiwano 640x480')));
  assert.equal(fs.existsSync(path.join(root, 'data/news-live.json')), false);
});

test('zerwane pobieranie nie zmienia istniejących plików', (t) => {
  const root = tempRoot(t);
  const target = path.join(root, 'data/news-live.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'poprzednia-wersja');
  assert.throws(() => pullNews({ root, transport: new FakeTransport(samplePackage(), { failAt: 4 }), imageInspector: validInspector }),
    (error) => error.exitCode === EXIT.ENVIRONMENT);
  assert.equal(fs.readFileSync(target, 'utf8'), 'poprzednia-wersja');
});

test('dwa uruchomienia są idempotentne, a runtime obrazy nie trafiają do _site', (t) => {
  const root = tempRoot(t);
  const backupRoot = tempRoot(t);
  let runNumber = 0;
  const run = () => pullNews({
    root,
    backupRoot,
    now: () => new Date(`2026-10-27T12:00:0${runNumber++}Z`),
    transport: new FakeTransport(),
    imageInspector: validInspector,
    mirrorRunner: () => mirror(root),
  });
  const first = run();
  if (first.backup_dir) t.after(() => fs.rmSync(first.backup_dir, { recursive: true, force: true }));
  assert.ok(first.changed_files.includes('data/news-live.json'));
  assert.equal(fs.existsSync(path.join(root, `_site/assets/news/${BASE}.avif`)), false);
  const second = run();
  assert.deepEqual(second.changed_files, []);
  assert.equal(second.backup_dir, null);
  for (const relative of ['data/news-backups', '_site/data/news-backups']) {
    const directory = path.join(root, relative);
    const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name !== '.gitkeep') : [];
    assert.deepEqual(files, [], relative);
  }
});

test('zwykły pull archiwizuje pełny zestaw poza repo przed promocją', (t) => {
  const root = tempRoot(t);
  const backupRoot = tempRoot(t);
  const report = pullNews({
    root,
    backupRoot,
    now: () => new Date('2026-10-27T12:00:00Z'),
    transport: new FakeTransport(),
    imageInspector: validInspector,
    mirrorRunner: () => mirror(root),
  });
  const manifest = verifyBackupManifest(report.server_backup_dir);
  assert.ok(manifest.files.some((item) => item.path === 'data/news-backups/news-live-20261025_120000.json'));
  assert.equal(fs.existsSync(path.join(root, 'data/news-backups/news-live-20261025_120000.json')), false);
  assert.equal(fs.existsSync(path.join(root, '_site/data/news-backups/news-live-20261025_120000.json')), false);
});

test('błąd kopii serwerowej kończy się kodem 30 przed promocją', (t) => {
  const root = tempRoot(t);
  const blockedBackupRoot = path.join(tempRoot(t), 'nie-katalog');
  let mirrorCalls = 0;
  fs.writeFileSync(blockedBackupRoot, 'blokada');
  assert.throws(() => pullNews({
    root,
    backupRoot: blockedBackupRoot,
    transport: new FakeTransport(),
    imageInspector: validInspector,
    mirrorRunner: () => { mirrorCalls += 1; },
  }), (error) => error.exitCode === EXIT.ENVIRONMENT);
  assert.equal(mirrorCalls, 0);
  assert.equal(fs.existsSync(path.join(root, 'data/news-live.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'data/news-backups/news-live-20261025_120000.json')), false);
});

test('news:pull pobiera i zabezpiecza wszystkie śledzone publiczne kopie panelu', (t) => {
  const root = tempRoot(t);
  const backupRoot = tempRoot(t);
  const old = Buffer.from('{"version":1,"items":[]}\n');
  for (const relative of [
    'data/news-live.json',
    'assets/data/news-fallback.json',
    '_site/assets/data/news-fallback.json',
    '_site/data/news-live.json',
  ]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, old);
  }
  const report = pullNews({
    root,
    backupRoot,
    transport: new FakeTransport(),
    imageInspector: validInspector,
    mirrorRunner: () => mirror(root),
  });
  t.after(() => fs.rmSync(report.backup_dir, { recursive: true, force: true }));
  for (const relative of [
    'data/news-live.json',
    'assets/data/news-fallback.json',
    '_site/assets/data/news-fallback.json',
    '_site/data/news-live.json',
  ]) {
    assert.ok(report.changed_files.includes(relative), relative);
    assert.deepEqual(fs.readFileSync(path.join(report.backup_dir, relative)), old, `backup ${relative}`);
    const expected = relative.endsWith('data/news-live.json')
      ? samplePackage().files['/news-live.json']
      : samplePackage().files['/data/news-fallback.json'];
    assert.deepEqual(fs.readFileSync(path.join(root, relative)), expected, `promocja ${relative}`);
  }
});

test('dry-run pokazuje zmiany bez zapisu i bez mirroru', (t) => {
  const root = tempRoot(t);
  const backupRoot = tempRoot(t);
  let mirrorCalls = 0;
  const report = pullNews({
    root,
    backupRoot,
    dryRun: true,
    transport: new FakeTransport(),
    imageInspector: validInspector,
    mirrorRunner: () => { mirrorCalls += 1; },
  });
  assert.ok(report.changed_files.length > 0);
  assert.equal(mirrorCalls, 0);
  assert.equal(fs.existsSync(path.join(root, 'data/news-live.json')), false);
  assert.deepEqual(fs.readdirSync(backupRoot), []);
});

test('--backup-only tworzy kompletną zweryfikowaną kopię bez zmiany repo i mirroru', (t) => {
  const root = tempRoot(t);
  const backupRoot = tempRoot(t);
  const pkg = samplePackage();
  const before = fs.readdirSync(root).sort();
  let mirrorCalls = 0;
  const report = pullNews({
    root,
    backupOnly: true,
    backupRoot,
    now: () => new Date('2026-10-27T12:00:00Z'),
    transport: new FakeTransport(pkg),
    imageInspector: validInspector,
    mirrorRunner: () => { mirrorCalls += 1; },
  });
  assert.equal(report.status, 'OK');
  assert.equal(report.backup_only, true);
  assert.equal(mirrorCalls, 0);
  assert.deepEqual(fs.readdirSync(root).sort(), before);
  assert.equal(path.basename(report.backup_dir), 'news-2026-10-27T13-00-00+01-00');
  assert.deepEqual(fs.readdirSync(backupRoot), [path.basename(report.backup_dir)]);
  assert.equal(fs.statSync(report.backup_dir).mode & 0o777, 0o700);
  const manifest = verifyBackupManifest(report.backup_dir);
  assert.deepEqual(manifest.files.map((item) => item.path), [
    `assets/data/news-fallback.json`,
    `assets/news/${BASE}.avif`,
    `assets/news/${BASE}.jpg`,
    `assets/news/${BASE}.webp`,
    'data/news-backups/news-live-20261025_120000.json',
    'data/news-live.json',
  ]);
  for (const item of manifest.files) {
    const file = path.join(report.backup_dir, item.path);
    const remote = item.path === 'data/news-live.json'
      ? '/news-live.json'
      : (item.path === 'assets/data/news-fallback.json'
        ? '/data/news-fallback.json'
        : `/${item.path.replace(/^data\//, '') .replace(/^assets\//, '')}`);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600, item.path);
    assert.deepEqual(fs.readFileSync(file), pkg.files[remote], item.path);
    assert.equal(fs.statSync(file).size, item.bytes, item.path);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), item.sha256, item.path);
    let directory = path.dirname(file);
    while (directory.startsWith(report.backup_dir) && directory !== path.dirname(report.backup_dir)) {
      assert.equal(fs.statSync(directory).mode & 0o777, 0o700, directory);
      if (directory === report.backup_dir) break;
      directory = path.dirname(directory);
    }
  }
  assert.equal(fs.statSync(path.join(report.backup_dir, 'manifest.json')).mode & 0o777, 0o600);
});

test('--backup-only po zerwanym pobieraniu nie zostawia katalogu docelowego ani tymczasowego', (t) => {
  const root = tempRoot(t);
  const backupRoot = tempRoot(t);
  assert.throws(() => pullNews({
    root,
    backupOnly: true,
    backupRoot,
    now: () => new Date('2026-10-27T12:00:00Z'),
    transport: new FakeTransport(samplePackage(), { failAt: 3 }),
    imageInspector: validInspector,
  }), (error) => error.exitCode === EXIT.ENVIRONMENT && /Zerwane połączenie/.test(error.message));
  assert.deepEqual(fs.readdirSync(backupRoot), []);
  assert.equal(fs.existsSync(path.join(backupRoot, 'news-2026-10-27T13-00-00+01-00')), false);
});

test('--dry-run i --backup-only razem kończą się błędem danych przed pobieraniem', (t) => {
  assert.throws(() => parseArgs(['--dry-run', '--backup-only']),
    (error) => error.exitCode === EXIT.DATA && /nie można łączyć/.test(error.message));
  const root = tempRoot(t);
  const transport = new FakeTransport();
  assert.throws(() => pullNews({ root, dryRun: true, backupOnly: true, transport }),
    (error) => error.exitCode === EXIT.DATA && /nie można łączyć/.test(error.message));
  assert.equal(transport.downloads, 0);
});

test('przy szkicach news:pull zachowuje śledzony live i zapisuje prywatną kopię z SHA-256', (t) => {
  const root = tempRoot(t);
  const privateBackupRoot = tempRoot(t);
  const pkg = samplePackage();
  const live = JSON.parse(pkg.files['/news-live.json'].toString('utf8'));
  live.items.unshift({ ...live.items[0], id: 'news_private_draft', status: 'draft', title: 'TAJNY SZKIC' });
  pkg.files['/news-live.json'] = Buffer.from(`${JSON.stringify(live)}\n`);
  const oldLive = Buffer.from('{"version":1,"items":[]}\n');
  for (const relative of ['data/news-live.json', '_site/data/news-live.json']) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, oldLive);
  }
  let mirrorCalls = 0;
  const report = pullNews({
    root,
    transport: new FakeTransport(pkg),
    imageInspector: validInspector,
    privateStoreTracked: true,
    backupRoot: privateBackupRoot,
    privateBackupRoot,
    mirrorRunner: () => { mirrorCalls += 1; },
  });
  if (report.backup_dir) t.after(() => fs.rmSync(report.backup_dir, { recursive: true, force: true }));
  assert.equal(report.status, 'OK');
  assert.equal(mirrorCalls, 0);
  assert.deepEqual(fs.readFileSync(path.join(root, 'data/news-live.json')), oldLive);
  assert.deepEqual(fs.readFileSync(path.join(root, '_site/data/news-live.json')), oldLive);
  assert.deepEqual(fs.readFileSync(path.join(root, 'assets/data/news-fallback.json')), pkg.files['/data/news-fallback.json']);
  assert.deepEqual(fs.readFileSync(path.join(root, '_site/assets/data/news-fallback.json')), pkg.files['/data/news-fallback.json']);
  for (const ext of ['jpg', 'webp', 'avif']) {
    assert.deepEqual(fs.readFileSync(path.join(root, `assets/news/${BASE}.${ext}`)), pkg.files[`/news/${BASE}.${ext}`]);
  }
  assert.ok(report.private_live_backup_dir.startsWith(privateBackupRoot));
  const backedUpLive = path.join(report.private_live_backup_dir, 'data/news-live.json');
  assert.deepEqual(fs.readFileSync(backedUpLive), pkg.files['/news-live.json']);
  const manifest = JSON.parse(fs.readFileSync(path.join(report.private_live_backup_dir, 'manifest.json'), 'utf8'));
  const liveManifestEntry = manifest.files.find((item) => item.path === 'data/news-live.json');
  assert.equal(liveManifestEntry.sha256, crypto.createHash('sha256').update(pkg.files['/news-live.json']).digest('hex'));
  assert.equal(report.private_live_sha256, liveManifestEntry.sha256);
  assert.match(report.privacy_warning, /szkice nie trafiły do repo/);
});

test('dry-run ze szkicami niczego nie zapisuje, także prywatnej kopii', (t) => {
  const root = tempRoot(t);
  const privateBackupRoot = tempRoot(t);
  const pkg = samplePackage();
  const live = JSON.parse(pkg.files['/news-live.json'].toString('utf8'));
  live.items.unshift({ ...live.items[0], id: 'news_private_draft', status: 'draft', title: 'TAJNY SZKIC' });
  pkg.files['/news-live.json'] = Buffer.from(`${JSON.stringify(live)}\n`);
  const report = pullNews({
    root,
    dryRun: true,
    transport: new FakeTransport(pkg),
    imageInspector: validInspector,
    privateStoreTracked: true,
    privateBackupRoot,
  });
  assert.equal(report.status, 'OK');
  assert.equal(report.private_live_backup_dir, null);
  assert.equal(fs.existsSync(path.join(root, 'data/news-live.json')), false);
});

test('mirror nie kopiuje obrazów runtime news_20 do eksportu', (t) => {
  const root = tempRoot(t);
  const pkg = samplePackage();
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/news'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/news-live.json'), pkg.files['/news-live.json']);
  fs.writeFileSync(path.join(root, 'assets/data/news-fallback.json'), pkg.files['/data/news-fallback.json']);
  for (const ext of ['jpg', 'webp', 'avif']) fs.writeFileSync(path.join(root, `assets/news/${BASE}.${ext}`), pkg.files[`/news/${BASE}.${ext}`]);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/sync-site-assets-mirror.js')], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const ext of ['jpg', 'webp', 'avif']) assert.equal(fs.existsSync(path.join(root, `_site/assets/news/${BASE}.${ext}`)), false);
});

test('śledzony magazyn bez szkiców jest pobierany i zachowuje format live w obu kopiach', (t) => {
  const root = tempRoot(t);
  const backupRoot = tempRoot(t);
  const pkg = samplePackage();
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/news-live.json'), '{}\n');
  assert.equal(spawnSync('git', ['init'], { cwd: root }).status, 0);
  assert.equal(spawnSync('git', ['add', 'data/news-live.json'], { cwd: root }).status, 0);
  const report = pullNews({
    root, backupRoot, transport: new FakeTransport(pkg), imageInspector: validInspector, mirrorRunner: () => mirror(root),
  });
  if (report.backup_dir) t.after(() => fs.rmSync(report.backup_dir, { recursive: true, force: true }));
  assert.equal(report.status, 'OK');
  assert.deepEqual(fs.readFileSync(path.join(root, 'data/news-live.json')), pkg.files['/news-live.json']);
  assert.deepEqual(fs.readFileSync(path.join(root, '_site/data/news-live.json')), pkg.files['/news-live.json']);
  assert.ok(report.backup_dir);
  assert.equal(fs.existsSync(path.join(report.backup_dir, 'data/news-live.json')), true);
});

test('publiczny fallback nie zawiera szkiców także po bezpiecznym pobraniu', (t) => {
  const root = tempRoot(t);
  const pkg = samplePackage();
  const privateStore = JSON.parse(pkg.files['/news-live.json'].toString('utf8'));
  privateStore.items.unshift({ ...privateStore.items[0], id: 'news_private_draft', status: 'draft', title: 'TAJNY SZKIC' });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/news-live.json'), `${JSON.stringify(privateStore)}\n`);
  fs.writeFileSync(path.join(root, 'assets/data/news-fallback.json'), pkg.files['/data/news-fallback.json']);
  assert.equal(spawnSync('git', ['init'], { cwd: root }).status, 0);
  assert.equal(spawnSync('git', ['add', 'data/news-live.json'], { cwd: root }).status, 0);
  const fallback = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/news-fallback.json'), 'utf8'));
  assert.equal(fallback.items.some((item) => item.title === 'TAJNY SZKIC' || item.status === 'draft'), false);
  pkg.files['/news-live.json'] = Buffer.from(`${JSON.stringify(privateStore)}\n`);
  const privateBackupRoot = tempRoot(t);
  const report = pullNews({
    root,
    transport: new FakeTransport(pkg),
    imageInspector: validInspector,
    mirrorRunner: () => mirror(root),
    backupRoot: privateBackupRoot,
    privateBackupRoot,
  });
  if (report.backup_dir) t.after(() => fs.rmSync(report.backup_dir, { recursive: true, force: true }));
  const promotedFallback = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/news-fallback.json'), 'utf8'));
  assert.equal(promotedFallback.items.some((item) => item.title === 'TAJNY SZKIC' || item.status === 'draft'), false);
  assert.match(report.privacy_warning, /szkice nie trafiły do repo/);
});

test('obecny kontrakt repo zachowuje śledzone pliki panelu do czasu Paczki 3', () => {
  const root = path.resolve(__dirname, '..');
  const expected = ['data/news-live.json', 'data/news-backups/.gitkeep', '_site/data/news-live.json', '_site/data/news-backups/.gitkeep'];
  const tracked = spawnSync('git', ['ls-files', '--', ...expected], { cwd: root, encoding: 'utf8' });
  assert.equal(tracked.status, 0);
  assert.deepEqual(tracked.stdout.trim().split('\n').sort(), expected.sort());
  for (const relative of ['assets/data/news-fallback.json', '_site/assets/data/news-fallback.json']) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
    assert.equal(payload.items.some((item) => String(item?.status || '').toLowerCase() === 'draft'), false, relative);
  }
});

test('obrazy opublikowanych newsów pozostają w indeksie Git', () => {
  const root = path.resolve(__dirname, '..');
  const expected = [
    'assets/news/news_20260416_094003_237b3c7b.jpg',
    '_site/assets/news/news_20260416_094003_237b3c7b.jpg',
  ];
  const tracked = spawnSync('git', ['ls-files', '--', ...expected], { cwd: root, encoding: 'utf8' });
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.deepEqual(tracked.stdout.trim().split('\n').sort(), expected.sort());
});
