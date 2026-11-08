const test = require('node:test');
const assert = require('node:assert/strict');
const { TASKS, executionPlan, normalizeCloseCode } = require('../scripts/prepush-parallel-checks');
const { classifyChangedFiles, filesForScope } = require('../scripts/lib/change-scope');

test('każde zadanie prepush jawnie deklaruje odczyt albo zapis', () => {
  for (const [name, task] of Object.entries(TASKS)) assert.ok(['read', 'write'].includes(task.access), name);
});

test('zadania zapisujące nie trafiają do puli równoległej', () => {
  const definitions = {
    readA: { access: 'read' },
    writeA: { access: 'write' },
    readB: { access: 'read' },
    writeB: { access: 'write' },
  };
  const plan = executionPlan(['readA', 'writeA', 'readB', 'writeB'], definitions);
  assert.deepEqual(plan.parallelRead, ['readA', 'readB']);
  assert.deepEqual(plan.sequentialWrite, ['writeA', 'writeB']);
});

test('zadanie bez deklaracji dostępu blokuje wykonanie', () => {
  assert.throws(() => executionPlan(['unknown'], { unknown: {} }), /nie deklaruje access/);
});

test('proces zakończony sygnałem nie jest liczony jako PASS', () => {
  assert.equal(normalizeCloseCode(null, 'SIGKILL'), 30);
  assert.equal(normalizeCloseCode(0, null), 0);
});

test('admin-only uruchamia wyłącznie kontrole panelu, luster i bezpieczeństwa', () => {
  const result = classifyChangedFiles([
    'admin/news-form.php',
    '_site/admin/news-form.php',
    'tests/news-editor-color.test.js',
    'deployment.json',
    '_site/deployment.json',
  ]);
  assert.deepEqual(result.scopes, ['admin']);
  assert.equal(result.full, false);
  assert.deepEqual(filesForScope(result, 'admin'), [
    '_site/admin/news-form.php',
    'admin/news-form.php',
  ]);
});

test('każda grupa danych NEWS uruchamia kontrolę NEWS', () => {
  for (const file of [
    'data/news-live.json',
    'assets/news/news_20261105_test.webp',
    'assets/data/news-fallback.json',
    '_site/data/news-live.json',
    '_site/assets/news/news_20261105_test.jpg',
    '_site/assets/data/news-fallback.json',
  ]) {
    const result = classifyChangedFiles([file]);
    assert.ok(result.scopes.includes('news'), file);
    assert.equal(result.full, false, file);
  }
});

test('HTML, sitemap i llms uruchamiają kontrole artykułów', () => {
  const result = classifyChangedFiles(['nowy-artykul.html', '_site/nowy-artykul.html', 'sitemap.xml', 'llms-full.txt']);
  assert.deepEqual(result.scopes, ['articles']);
  assert.equal(result.full, false);
});

test('szybka ścieżka artykułu nie uruchamia pełnego eksportu ani pełnego builda', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'scripts', 'run-all-prepush.js'), 'utf8');
  assert.match(source, /if \(classification\.full\) \{\s*exportWorkspace/);
  const articleBlock = source.match(/if \(classification\.scopes\.includes\('articles'\)\) \{([\s\S]*?)\n\s*\}/)?.[1] || '';
  assert.doesNotMatch(articleBlock, /npm[^\n]*build|export:fresh/);
});

test('infrastruktura i nieznany plik wybierają pełny zestaw fail-safe', () => {
  for (const file of ['package.json', '.htaccess', '.github/workflows/check.yml', 'scripts/predeploy-gate.js', 'nieznany.bin']) {
    const result = classifyChangedFiles([file]);
    assert.equal(result.full, true, file);
    assert.deepEqual(result.scopes, ['full'], file);
  }
});

test('profil wpływu nie zakłada wyniku eksportu i wymaga sondy dla skryptu eksportu', () => {
  const result = classifyChangedFiles([
    'scripts/export_site.sh',
    'scripts/prepare-deployment-marker.js',
    'tests/prepush-release-guardrails.test.js',
  ]);
  assert.equal(result.full, false);
  assert.equal(result.requiresExportProbe, true);
  assert.deepEqual(result.scopes, ['pipeline']);
  assert.deepEqual(result.buckets.export_probe, ['scripts/export_site.sh']);
});

test('profil pipeline-only nie uruchamia sondy, gdy zmiana nie dotyka eksportu', () => {
  const result = classifyChangedFiles([
    'scripts/prepare-deployment-marker.js',
    'tests/news-deploy-sync-gate.test.js',
    'docs/command-registry.md',
  ]);
  assert.equal(result.full, false);
  assert.equal(result.requiresExportProbe, false);
  assert.deepEqual(result.scopes, ['pipeline']);
});
