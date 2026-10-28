const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const ADMIN = path.join(ROOT, 'admin');
const REMOVED_MODULE_FILES = [
  'dashboard.php',
  'entry-form.php',
  'sync-manual.php',
  'actions/save.php',
  'actions/delete.php',
  'actions/publish.php',
  'actions/unpublish.php',
  'api/calendar-entries.php',
  'helpers/calendar.php',
  'templates/article.php',
  'templates/carousel-script.php',
  'templates/day-list.php',
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('admin entry points redirect authenticated users to the NEWS dashboard', () => {
  assert.match(read('admin/index.php'), /Location:\s*news-dashboard\.php/);
  assert.match(read('admin/login.php'), /ADMIN_URL\s*\.\s*'news-dashboard\.php'/);
});

test('NEWS views and NEWS runtime have no dependency on the removed module', () => {
  for (const file of [
    'admin/news-dashboard.php',
    'admin/news-form.php',
    'admin/helpers/news.php',
    'admin/api/news-feed.php',
    'admin/bootstrap.php',
    'admin/auth.php',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /(?:>Wpisy<|href=["']dashboard\.php|entry-form\.php|calendar-entries|helpers\/calendar)/i, file);
  }
});

test('success module files no longer exist and legacy public URLs return 410', () => {
  for (const file of REMOVED_MODULE_FILES) {
    assert.equal(fs.existsSync(path.join(ADMIN, file)), false, file);
    assert.equal(fs.existsSync(path.join(ROOT, '_site', 'admin', file)), false, `_site/admin/${file}`);
  }
  const htaccess = read('.htaccess');
  assert.match(htaccess, /RewriteRule \^dziennik\\\.html\$ - \[G,L\]/);
  assert.match(htaccess, /RewriteRule \^moje-sukcesy\\\.html\$ - \[G,L\]/);
});
