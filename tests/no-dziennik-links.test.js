const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PAGES = new Set(['dziennik.html', 'moje-sukcesy.html']);
const MODULE_LINK_RX = /href\s*=\s*["'](?:\.\/|\/)?(?:dziennik|moje-sukcesy)\.html(?:[#?][^"']*)?["']/i;

function publicHtmlFiles() {
  const files = [];
  for (const base of [ROOT, path.join(ROOT, '_site')]) {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.html') || MODULE_PAGES.has(entry.name)) continue;
      files.push(path.join(base, entry.name));
    }
  }
  return files;
}

test('public pages, footer generator and entities contain no links to Dziennik/Moje Sukcesy', () => {
  const checked = [
    ...publicHtmlFiles(),
    path.join(ROOT, 'src', 'footer.ts'),
    path.join(ROOT, 'dist', 'footer.js'),
    path.join(ROOT, 'data', 'entities.json'),
    path.join(ROOT, '_site', 'data', 'entities.json'),
  ];

  const offenders = checked
    .filter((file) => MODULE_LINK_RX.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(ROOT, file))
    .sort();

  assert.deepEqual(offenders, []);
});
