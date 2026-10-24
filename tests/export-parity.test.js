const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { compareExportTrees, isParityManagedPath } = require('../scripts/lib/export-parity');
const { buildDocument } = require('../scripts/generate-llms-full');

const roots = [];

function temp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-parity-'));
  roots.push(root);
  return root;
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

test.after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

test('parity wykrywa zmianę tylko w źródłowym HTML-u i tylko w _site', () => {
  const expected = temp();
  const actual = temp();
  write(expected, 'artykul.html', 'nowa treść');
  write(actual, 'artykul.html', 'stara treść');
  let report = compareExportTrees(expected, actual);
  assert.equal(report.ok, false);
  assert.deepEqual(report.different.map((item) => [item.path, item.kind]), [['artykul.html', 'HTML']]);

  write(actual, 'artykul.html', 'nowa treść');
  write(actual, 'tylko-site.html', 'osierocony plik');
  report = compareExportTrees(expected, actual);
  assert.deepEqual(report.extra.map((item) => item.path), ['tylko-site.html']);
});

test('parity klasyfikuje brak PDF-u, danych i wariantu obrazu', () => {
  const expected = temp();
  const actual = temp();
  write(expected, 'assets/pdf/a.pdf', 'pdf');
  write(expected, 'assets/data/search-index.json', '{}');
  write(expected, 'assets/a.avif', 'image');
  const report = compareExportTrees(expected, actual);
  assert.deepEqual(report.missing.map((item) => item.kind).sort(), ['ASSET', 'DATA', 'PDF']);
});

test('parity obejmuje publiczny llms-full i pomija wyłącznie artefakty runtime', () => {
  assert.equal(isParityManagedPath('llms-full.txt'), true);
  assert.equal(isParityManagedPath('admin/uploads/example.webp'), false);
  assert.equal(isParityManagedPath('assets/news/news_20260625_example.avif'), false);
  assert.equal(isParityManagedPath('assets/news/editorial-cover.avif'), true);
  assert.equal(isParityManagedPath('artykul.html'), true);

  const expected = temp();
  const actual = temp();
  write(expected, 'artykul.html', 'ta sama treść');
  write(actual, 'artykul.html', 'ta sama treść');
  write(expected, 'llms-full.txt', 'generowane');
  write(actual, 'llms-full.txt', 'generowane');
  write(expected, 'admin/uploads/example.webp', 'runtime');
  write(expected, 'assets/news/news_20260625_example.avif', 'runtime');
  const report = compareExportTrees(expected, actual);
  assert.equal(report.ok, true);
  assert.equal(report.expected_files, 2);
  assert.equal(report.actual_files, 2);
});

test('llms-full ma deterministyczny generated_at wynikający z treści', () => {
  const items = [
    { title: 'A', slug: 'a.html', url: 'https://fitpo50.pl/a.html', content: 'A', modified: '2026-01-02T10:00:00+01:00' },
    { title: 'B', slug: 'b.html', url: 'https://fitpo50.pl/b.html', content: 'B', modified: '2026-02-03T12:00:00+01:00' },
  ];
  const first = buildDocument(items);
  const second = buildDocument(items);
  assert.equal(first, second);
  assert.match(first, /generated_at: 2026-02-03T11:00:00\.000Z/);
});

test('eksport wyklucza pliki robocze, środowisko Python i fonty przeznaczone wyłącznie dla generatora PDF', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export_site.sh'), 'utf8');
  assert.match(script, /--exclude="\/HANDOFF\.md"/);
  assert.match(script, /--exclude="\/requirements\*\.txt"/);
  assert.match(script, /--exclude="\/assets\/fonts\/pdf\/"/);
  assert.match(script, /--exclude="\/\.venv\/"/);
  assert.match(script, /--exclude="__pycache__\/"/);
  assert.match(script, /--exclude="\*\.py"/);
  assert.match(script, /--exclude="\*\.pyc"/);
  assert.match(script, /--exclude="admin\/\*\.md"/);
});

test('eksport nie kopiuje .cache, a parity pomija lokalny cache dowodów', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export_site.sh'), 'utf8');
  assert.match(script, /--exclude="\.cache\/"/);
  assert.equal(isParityManagedPath('.cache/article-evidence-urls.json'), false);

  const source = temp();
  const exported = temp();
  write(source, 'index.html', 'publiczna strona');
  write(source, '.cache/article-evidence-urls.json', '{"runtime":true}');
  const rsync = spawnSync('rsync', ['-a', '--exclude=.cache/', `${source}/`, `${exported}/`], { encoding: 'utf8' });
  assert.equal(rsync.status, 0, rsync.stderr || rsync.stdout);
  assert.equal(fs.existsSync(path.join(exported, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(exported, '.cache')), false);

  write(exported, '.cache/article-evidence-urls.json', '{"stale":true}');
  const report = compareExportTrees(source, exported);
  assert.equal(report.ok, true);
  assert.equal(report.expected_files, 1);
  assert.equal(report.actual_files, 1);
});

test('eksport tylko sprawdza sitemap lastmod i podaje jawną komendę synchronizacji', () => {
  const exportScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'export_site.sh'), 'utf8');
  const syncScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'sync-sitemap-lastmod.js'), 'utf8');
  assert.match(exportScript, /sync-sitemap-lastmod\.js --check/);
  assert.doesNotMatch(exportScript, /sync-sitemap-lastmod\.js\s*\n/);
  assert.match(syncScript, /npm run sitemap:lastmod:sync/);
});
