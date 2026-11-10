'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { selectedFiles, filesFromPushRefs, assertReleaseFiles } = require('../scripts/lib/change-scope');
const { taskCommitFiles, preparedArticleTask, statusEntries, main: publish } = require('../scripts/publish-article');
const { articleDeploymentEntry, prepareDeploymentMarker, assertPreparedPublicationState, publicFingerprint } = require('../scripts/prepare-deployment-marker');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');
const { packageIdentity } = require('../scripts/lib/package-identity');

const ROOT = path.resolve(__dirname, '..');
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const markers = ['_site/deployment.json', 'deployment.json'];

async function withRepo(callback) {
  const root = createManagedTempDir({ prefix: 'fitpo50-release-scope-', type: 'release-scope-test', projectRoot: ROOT });
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  fs.writeFileSync(path.join(root, 'README.md'), 'baseline');
  git('add', '--', 'README.md');
  git('commit', '-qm', 'fixture baseline');
  try { return await callback({ root, git }); }
  finally { disposeTempWorkspace(root, { status: 'COMPLETED' }); }
}

test('release scope: jawny wybór łączy artykuł i kod, pomijając niezwiązany kod', () => {
  const entries = ['artykul.html', 'scripts/import-article.js', 'scripts/news-pull.js'].map((file) => ({ code: ' M', file }));
  assert.deepEqual(taskCommitFiles(entries, ['artykul.html'], ['scripts/import-article.js']), ['artykul.html', 'scripts/import-article.js']);
  assert.deepEqual(selectedFiles([], { FITPO50_CHANGED_FILES_JSON: '[]' }), []);
  assert.deepEqual(selectedFiles(['--files-json', '["README.md"]'], { FITPO50_CHANGED_FILES_JSON: '["other.md"]' }), ['README.md']);
  assert.throws(() => selectedFiles(['--files-json', '["../escape"]'], {}), /Nieprawidłowa/);
  assert.throws(() => selectedFiles(['--files-json'], {}), /Brak wartości/);
  assert.throws(() => taskCommitFiles([{ code: '??', file: 'docs/fitpo50-modernization-master-plan.md' }], ['docs/fitpo50-modernization-master-plan.md']), /modernizacji/);
});

test('release scope: zakres pusha pochodzi z remote SHA i obejmuje kilka commitów, bez working tree', () => withRepo(({ root, git }) => {
  const base = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'a.md'), 'one'); git('add', '--', 'a.md'); git('commit', '-qm', 'fixture one');
  fs.writeFileSync(path.join(root, 'b.md'), 'two'); git('add', '--', 'b.md'); git('commit', '-qm', 'fixture two');
  const head = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', head);
  fs.writeFileSync(path.join(root, 'niezwiazany.md'), 'local'); git('add', '--', 'niezwiazany.md');
  fs.writeFileSync(path.join(root, 'a.md'), 'unstaged');
  const files = filesFromPushRefs(`refs/heads/main ${head} refs/heads/main ${base}`, root);
  assert.deepEqual(files, ['a.md', 'b.md']);
  assert.throws(() => filesFromPushRefs(`refs/heads/main ${base} refs/heads/main ${head}`, root), /Nie można ustalić/);
}));

test('release scope: marker odrzuca pominięty, dodatkowy albo zmieniony plik', () => {
  const files = ['README.md', ...markers].sort();
  const marker = { release_files: files, release_file_hashes: { 'README.md': hash('approved') } };
  assert.deepEqual(assertReleaseFiles(marker, files, () => hash('approved')), files);
  assert.throws(() => assertReleaseFiles(marker, [...files, 'other.md'], () => hash('approved')), /Zakres/);
  assert.throws(() => assertReleaseFiles(marker, markers, () => hash('approved')), /Zakres/);
  assert.throws(() => assertReleaseFiles(marker, files, () => hash('changed')), /README.md/);
});

test('release scope: przygotowanie markera obejmuje wybraną dokumentację bez niezwiązanych stron', () => withRepo(({ root }) => {
  fs.mkdirSync(path.join(root, '_site'));
  fs.writeFileSync(path.join(root, '_site/niezwiazany.html'), '<script>{"@type":"BlogPosting"}</script>');
  const files = ['README.md', ...markers].sort();
  const marker = prepareDeploymentMarker(root, { changedFiles: files, newsSnapshot: { fallback_path: 'assets/data/news-fallback.json', fallback_sha256: 'a'.repeat(64), runtime_images: [] } });
  assert.deepEqual(marker.release_files, files);
  assert.deepEqual(marker.articles, []);
  assert.equal(marker.release_file_hashes['README.md'], hash('baseline'));
  fs.appendFileSync(path.join(root, '_site/niezwiazany.html'), 'local changes');
  assert.equal(assertPreparedPublicationState(root, marker), true);
  assert.equal(publicFingerprint(path.join(root, '_site'), files), marker.public_fingerprint_sha256);
}));

function writeDeploymentArticleFixture(root, slug, options = {}) {
  const site = path.join(root, '_site');
  fs.mkdirSync(path.join(site, 'assets', 'data'), { recursive: true });
  fs.mkdirSync(path.join(site, 'assets', 'pdf'), { recursive: true });
  fs.writeFileSync(path.join(site, `${slug}.html`), [
    `<link rel="canonical" href="https://fitpo50.pl/${slug}.html">`,
    '<meta property="article:modified_time" content="2026-11-10T08:00:00+01:00">',
    '<meta property="article:section" content="Zdrowie">',
    '<script type="application/ld+json">{"@type":"BlogPosting","dateModified":"2026-11-10T08:00:00+01:00"}</script>',
  ].join(''));
  fs.writeFileSync(path.join(site, 'assets', 'pdf', `${slug}.pdf`), '%PDF-test');
  fs.writeFileSync(path.join(site, 'assets', 'data', 'search-index.json'), `[{"url":"${slug}.html"}]`);
  if (options.category) fs.writeFileSync(path.join(site, 'zdrowie.html'), `<a href="${slug}.html">dział</a>`);
  if (options.center) {
    fs.mkdirSync(path.join(root, 'templates', 'topic-centers'), { recursive: true });
    fs.writeFileSync(path.join(root, 'templates', 'topic-centers', `${slug}.html`), 'centrum');
  }
}

test('release scope: centrum bez wpisu w porady przechodzi, gdy pozostaje w wyszukiwarce', () => withRepo(({ root }) => {
  writeDeploymentArticleFixture(root, 'centrum-testowe', { center: true });
  const entry = articleDeploymentEntry(root, 'centrum-testowe.html');
  assert.deepEqual(entry.listing_paths, ['assets/data/search-index.json']);
}));

test('release scope: zwykły artykuł bez wpisu w porady nadal blokuje marker', () => withRepo(({ root }) => {
  writeDeploymentArticleFixture(root, 'artykul-testowy', { category: true });
  assert.throws(
    () => articleDeploymentEntry(root, 'artykul-testowy.html'),
    /eksport nie zawiera artykułu w porady\.html/,
  );
}));

test('release scope: precommit sprawdza staged i odrzuca walidację innej kopii roboczej', () => withRepo(({ root, git }) => {
  const check = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/article-publish-guard.js'), '--staged'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(root, 'README.md'), 'approved'); git('add', '--', 'README.md');
  fs.writeFileSync(path.join(root, 'niezwiazany.html'), 'celowo zły HTML poza staged');
  assert.equal(check().status, 0);
  fs.appendFileSync(path.join(root, 'README.md'), 'changed after add');
  const bad = check();
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Staged różni się/);
  fs.writeFileSync(path.join(root, 'README.md'), 'approved');
  const files = ['README.md', ...markers].sort();
  const marker = JSON.stringify({ release_files: files, release_file_hashes: { 'README.md': hash('approved') } });
  fs.mkdirSync(path.join(root, '_site'));
  for (const file of markers) fs.writeFileSync(path.join(root, file), marker);
  git('add', '--', ...markers);
  assert.equal(check().status, 0);
  fs.writeFileSync(path.join(root, 'other.md'), 'not approved'); git('add', '--', 'other.md');
  const extra = check();
  assert.equal(extra.status, 1);
  assert.match(extra.stderr, /Zakres staged/);
}));

test('release scope: walidatory dostają tę samą listę i nie odczytują ponownie diffu', () => withRepo(({ root }) => {
  fs.symlinkSync(path.join(ROOT, 'scripts'), path.join(root, 'scripts'));
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\necho "Nie wolno ponawiać diffu" >&2\nexit 99\n', { mode: 0o755 });
  const scripts = ['run-article-guard-diff.js', 'run-article-contract-diff.js', 'schema-validator.js', 'date-modified-guard.js', 'json-fitpo50-gate-diff.js', 'prepush-diff-guard.js', 'immutable-asset-guard.js'];
  for (const script of scripts) {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...(script === 'schema-validator.js' ? ['--diff'] : [])], {
      cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FITPO50_CHANGED_FILES_JSON: '[]' },
    });
    assert.equal(result.status, 0, `${script}: ${result.stdout}${result.stderr}`);
  }
}));

test('release scope: publikuj pyta raz, przekazuje ten sam zakres markerowi i git add, commit/push raz', () => withRepo(async ({ root, git }) => {
  const files = ['PROJECT_MEMORY.md', 'scripts/import-article.js', ...markers].sort();
  const calls = [];
  let prepared = false;
  let added = false;
  let approvals = 0;
  let committed = false;
  let pushed = false;
  const base = git('rev-parse', 'HEAD');
  const head = 'a'.repeat(40);
  fs.writeFileSync(path.join(root, 'PROJECT_MEMORY.md'), 'fixture');
  fs.mkdirSync(path.join(root, 'scripts')); fs.writeFileSync(path.join(root, 'scripts/import-article.js'), 'fixture');
  await publish({ root, argv: ['--task-files-json', JSON.stringify(files.filter((file) => !markers.includes(file)))], ask: async () => { approvals += 1; return true; }, run(command, args) {
    calls.push([command, ...args]);
    if (command === 'git' && args[0] === 'status') return { stdout: ' M PROJECT_MEMORY.md\n M scripts/import-article.js\n M scripts/news-pull.js\n M data/reports/article-publications/niezwiazany.json\n' + (prepared ? ' M deployment.json\n M _site/deployment.json\n' : '') };
    if (command === 'git' && args[0] === 'diff') return { stdout: added ? files.join('\n') : '' };
    if (command === 'git' && args[0] === 'rev-parse') return { stdout: committed ? head : base };
    if (command === 'git' && args[0] === 'rev-list') return { stdout: '0' };
    if (command === 'git' && args[0] === 'branch') return { stdout: 'main' };
    if (command === 'git' && args[0] === 'ls-remote') return { stdout: `${pushed ? head : base}\trefs/heads/main` };
    if (command === 'git' && args[0] === 'commit') committed = true;
    if (command === 'git' && args[0] === 'push') pushed = true;
    if (command === 'npm') {
      assert.deepEqual(JSON.parse(args.at(-1)), files); prepared = true;
      const marker = { release_id: 'fixture', prepared_from_head: base, release_files: files, release_file_hashes: Object.fromEntries(files.filter((file) => !markers.includes(file)).map((file) => [file, hash('fixture')])), verification_targets: [], articles: [], change_scope: ['pipeline', 'docs'] };
      fs.mkdirSync(path.join(root, '_site'));
      for (const file of markers) fs.writeFileSync(path.join(root, file), JSON.stringify(marker));
    }
    if (command === 'git' && args[0] === 'add') { assert.deepEqual(args.slice(2), files); added = true; }
    return { stdout: '' };
  } });
  assert.equal(approvals, 1);
  assert.equal(calls.filter((call) => call[1] === 'commit').length, 1);
  assert.equal(calls.filter((call) => call[1] === 'push').length, 1);
  assert.equal(calls.some((call) => call.includes('prepush:local') || call.includes('article:add') || call.includes('--force') || call.includes('--no-verify')), false);
}));

test('release scope: gotowy artykuł wznawia się po zmianie wspólnych plików, ale zmiana własnego pliku unieważnia gotowość', () => withRepo(async ({ root }) => {
  assert.equal(preparedArticleTask('brak-manifestu', root, []), false);
  const directory = path.join(root, 'package'); fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'artykul.fitpo50.json'), '{"slug":"artykul"}');
  const manifest = 'data/reports/article-publications/artykul.json';
  fs.mkdirSync(path.dirname(path.join(root, manifest)), { recursive: true });
  const shared = ['sitemap.xml', 'llms-full.txt', 'assets/data/search-index.json'].flatMap((file) => [file, `_site/${file}`]);
  const owned = ['artykul.html', '_site/artykul.html', 'porady.html'];
  fs.writeFileSync(path.join(root, manifest), JSON.stringify({ slug: 'artykul', status: 'PUBLISHED', source_package_sha256: packageIdentity(path.join(directory, 'artykul.fitpo50.json'), directory, { slug: 'artykul' }).hash, files: [...owned, ...shared].map((file) => ({ path: file, after_sha256: hash('fixture') })) }));
  fs.writeFileSync(path.join(root, 'artykul.html'), 'fixture');
  fs.mkdirSync(path.join(root, '_site')); fs.writeFileSync(path.join(root, '_site/artykul.html'), 'fixture');
  fs.writeFileSync(path.join(root, 'porady.html'), 'fixture');
  for (const file of shared) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), 'zmiana centrum');
  }
  assert.equal(preparedArticleTask('artykul', root, [], path.join(directory, 'artykul.fitpo50.json')), true);
  const calls = [];
  await publish({ root, argv: [directory, '--task-files-json', '["scripts/import-article.js"]'], ask: async () => false, run(command, args) {
    calls.push([command, ...args]);
    if (args[0] === 'status') return { stdout: ` M artykul.html\n M _site/artykul.html\n M porady.html\n${shared.map((file) => ` M ${file}\n`).join('')} M ${manifest}\n M scripts/import-article.js\n M data/news-live.json\n` };
    if (args[0] === 'diff') return { stdout: '' };
    if (args[0] === 'rev-parse') return { stdout: 'a'.repeat(40) };
    if (args[0] === 'rev-list') return { stdout: '0' };
    if (args[0] === 'branch') return { stdout: 'main' };
    assert.fail(`Nieoczekiwany zapis: ${command} ${args.join(' ')}`);
  } });
  assert.equal(calls.some((call) => call.includes('article:add') || call.includes('add') || call.includes('commit') || call.includes('push')), false);
  fs.writeFileSync(path.join(root, 'artykul.html'), 'zmiana treści');
  assert.equal(preparedArticleTask('artykul', root, [], path.join(directory, 'artykul.fitpo50.json')), false);
  fs.writeFileSync(path.join(root, 'artykul.html'), 'fixture');
  fs.writeFileSync(path.join(root, 'porady.html'), 'zmiana listingu');
  assert.equal(preparedArticleTask('artykul', root, [], path.join(directory, 'artykul.fitpo50.json')), false);
}));

test('release scope: status NUL zachowuje polskie nazwy, spacje i obie strony rename', () => {
  assert.deepEqual(statusEntries(' M docs/Zażółć gęślą.md\0R  nowy.html\0stary.html\0'), [
    { code: ' M', file: 'docs/Zażółć gęślą.md' }, { code: 'D', file: 'stary.html' }, { code: 'A', file: 'nowy.html' },
  ]);
});

test('release scope: prawdziwy entrypoint prepush odrzuca nieznany zakres przed markerem i NEWS', () => withRepo(({ root, git }) => {
  const base = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'nieznany.bin'), 'fixture'); git('add', '--', 'nieznany.bin'); git('commit', '-qm', 'fixture unknown scope');
  const head = git('rev-parse', 'HEAD');
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/prepush-main-guard.js')], {
    cwd: root, encoding: 'utf8', input: `refs/heads/main ${head} refs/heads/main ${base}\n`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Nieustalony wpływ zmian/);
  assert.match(result.stderr, /nieznany.bin/);
}));
