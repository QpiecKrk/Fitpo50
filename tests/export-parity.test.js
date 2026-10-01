const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { compareExportTrees } = require('../scripts/lib/export-parity');
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
