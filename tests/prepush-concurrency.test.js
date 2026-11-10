const test = require('node:test');
const assert = require('node:assert/strict');
const { TASKS, executionPlan, normalizeCloseCode } = require('../scripts/prepush-parallel-checks');
const { assertResolvedScope, classifyChangedFiles, filesForScope, isArticlePath, MODULES } = require('../scripts/lib/change-scope');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');
const ROOT = path.resolve(__dirname, '..');
const { runDeploymentPrepare } = require('../scripts/prepare-deployment-marker');
const { promotionCandidates } = require('../scripts/lib/article-staging');

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

test('potwierdzona wspólna infrastruktura wybiera pełny zestaw z powodem', () => {
  for (const file of ['.htaccess', 'style.css', '_site/robots.txt']) {
    const result = classifyChangedFiles([file]);
    assert.equal(result.full, true, file);
    assert.deepEqual(result.scopes, ['full'], file);
    assert.match(result.reasons[0].reason, /NEWS/);
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
  assert.deepEqual(result.scopes, ['pipeline', 'docs']);
});

test('artykuł i poprawka importera łączą zakresy i przypisane testy bez NEWS', () => {
  const result = assertResolvedScope(classifyChangedFiles(['test-artykul.html', '_site/test-artykul.html', 'scripts/import-article.js']));
  assert.deepEqual(result.scopes, ['articles', 'pipeline']);
  assert.equal(result.full, false);
  assert.ok(result.testFiles.includes('tests/article-technical-flow.test.js'));
  assert.equal(result.reasons.length, result.files.length);
  assert.ok(result.reasons.every((item) => item.reason && item.file));
});

test('wydanie centrum rozpoznaje szablony, druk i walidator bez UNKNOWN oraz NEWS', () => {
  const files = ['scripts/validate-topic-center.py', 'scripts/lib/topic-center-print.js', 'templates/topic-centers/centrum-snu-po-50.html'];
  const result = assertResolvedScope(classifyChangedFiles(files));
  assert.deepEqual(result.buckets.unknown, []);
  assert.deepEqual(result.buckets.news, []);
  assert.deepEqual(result.scopes, ['articles', 'pipeline']);
  assert.equal(result.articleWide, false);
  for (const file of ['tests/article-baseline-on-touch.test.js', 'tests/topic-center-pipeline.test.js', 'tests/article-preview-dom.test.js']) assert.ok(result.testFiles.includes(file), file);
  assert.equal(classifyChangedFiles(['templates/topic-centers/nowe-centrum.html']).blocked, false);
  assert.equal(classifyChangedFiles(['templates/topic-centers/zagniezdzone/plik.html']).blocked, true);
});

test('raporty artykułu nie powodują pełnego audytu ani zgłoszenia prywatnego raportu live', () => {
  const report = 'data/reports/article-publications/nowy-artykul.json';
  const result = classifyChangedFiles([report, 'data/reports/article-preview/nowy-artykul.md', 'data/reports/gsc-after-publication-queue.json']);
  assert.deepEqual(result.scopes, ['articles']);
  assert.equal(result.blocked, false);
  assert.equal(isArticlePath(report), false, 'Prywatny raport nie jest publicznym celem weryfikacji produkcji.');
});

test('pełny zestaw plików obecnego importera jest rozpoznawany bez NEWS i pełnego audytu', () => {
  for (const category of ['ruch', 'jedzenie', 'zdrowie', 'ciekawe', 'mity']) {
    const files = promotionCandidates({ slug: 'test-nowego-artykulu', category, media_manifest: { entries: [] } });
    const result = assertResolvedScope(classifyChangedFiles(files));
    assert.deepEqual(result.scopes, ['articles'], category);
    assert.equal(result.full, false);
    assert.ok(result.buckets.articles.includes('data/crosslink-suggestions/test-nowego-artykulu.json'));
    assert.ok(result.buckets.articles.includes('_site/data/crosslink-suggestions/test-nowego-artykulu.json'));
  }
});

test('wcześniejsze wydania artykułu i popraw-seo przechodzą klasyfikację rzeczywistych list plików', () => {
  // Snapshot list ścieżek, bez zależności testu od głębokości checkoutu Git.
  const releases = require('./fixtures/change-scope-past-releases.json');
  for (const [commit, files] of Object.entries(releases)) {
    assert.ok(files.length > 0);
    const result = assertResolvedScope(classifyChangedFiles(files));
    assert.equal(result.full, false, commit);
    assert.ok(result.scopes.includes('articles'), commit);
    assert.ok(result.scopes.includes('pipeline'), commit);
    assert.equal(result.scopes.includes('news'), false, commit);
    if (commit === 'fb938609') {
      for (const file of ['tests/article-evidence.test.js', 'tests/article-baseline-on-touch.test.js', 'tests/publishing-engine.test.js', 'tests/topic-center-pipeline.test.js', 'tests/pipeline-blockers.test.js']) assert.ok(result.testFiles.includes(file), file);
      assert.equal(isArticlePath('data/reports/popraw-seo-deployments.json'), false);
    }
  }
});

test('dokumentacja i pusty zakres nie budują portalu', () => {
  assert.deepEqual(classifyChangedFiles(['AGENTS.md', 'PROJECT_MEMORY.md', 'docs/command-registry.md']).scopes, ['docs']);
  const empty = classifyChangedFiles(['deployment.json', '_site/deployment.json']);
  assert.deepEqual(empty.scopes, []);
  assert.equal(empty.full, false);
});

test('szablon i CSS poszerzają kontrolę artykułów bez obejmowania NEWS', () => {
  for (const file of ['article-template-bento.html', '_site/article-template-bento.html', 'article.css']) {
    const result = classifyChangedFiles([file]);
    assert.equal(result.articleWide, true);
    assert.equal(result.full, false);
    assert.deepEqual(result.scopes, ['articles']);
  }
  assert.equal(classifyChangedFiles(['zwykly-link.html']).articleWide, false);
});

test('nieznany plik wymaga wyjaśnienia, nie uruchamia pełnego audytu po nazwie katalogu', () => {
  for (const file of ['nieznany.bin', 'scripts/article-nieznany.js', 'tests/nieznany.test.js', 'package.json', '.github/workflows/check.yml', 'docs/fitpo50-modernization-master-plan.md']) {
    const result = classifyChangedFiles([file]);
    assert.equal(result.blocked, true, file);
    assert.equal(result.full, false, file);
    assert.throws(() => assertResolvedScope(result), (error) => error.message.includes(file));
  }
});

test('mapa modułów ma istniejące pliki i testy bez podwójnych wpisów', () => {
  const registered = new Set();
  for (const module of MODULES) for (const file of [...module.files, ...module.tests]) assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  for (const module of MODULES) for (const file of module.files) { assert.equal(registered.has(file), false, file); registered.add(file); }
});

test('znany kod NEWS dobiera swój test bez obejmowania artykułów', () => {
  const result = assertResolvedScope(classifyChangedFiles(['scripts/news-pull.js']));
  assert.deepEqual(result.scopes, ['news']);
  assert.ok(result.testFiles.includes('tests/news-pull.test.js'));
  assert.equal(result.testFiles.filter((file) => file === 'tests/news-public-integrity.test.js').length, 1);
});

test('marker zatrzymuje nieznany zakres przed kontrolą NEWS i zapisem', () => {
  assert.throws(() => runDeploymentPrepare(ROOT, {
    markerOptions: { changedFiles: ['scripts/article-nieznany.js'] },
    newsSyncCheck: () => assert.fail('Nieznany zakres nie może uruchamiać połączenia NEWS.'),
    markerPrepare: () => assert.fail('Nieznany zakres nie może zapisać markera.'),
  }), /article-nieznany.js/);
});

test('runner dobiera rzeczywiste polecenia: artykuł+kod, dokumentacja, NEWS, szablon i nieznany plik', () => {
  const root = createManagedTempDir({ prefix: 'fitpo50-scope-test-', type: 'change-scope-test', projectRoot: ROOT });
  const fakeBin = path.join(root, 'bin');
  fs.mkdirSync(fakeBin);
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(path.join(fakeBin, 'node'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FITPO50_SCOPE_TEST_LOG"\n', { mode: 0o755 });
  try {
    const run = (files) => {
      fs.writeFileSync(log, '');
      const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/run-all-prepush.js'), '--files-json', JSON.stringify(files)], {
        cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, FITPO50_SCOPE_TEST_LOG: log },
      });
      return { result, calls: fs.readFileSync(log, 'utf8') };
    };
    const mixed = run(['nowy-artykul.html', 'scripts/import-article.js']);
    assert.equal(mixed.result.status, 0, mixed.result.stderr);
    assert.match(mixed.calls, /run-article-contract-diff/);
    assert.match(mixed.calls, /--test .*tests\/article-technical-flow.test.js/);
    assert.doesNotMatch(mixed.calls, /news|fitpo50-doctor|export_site|npm/);
    const docs = run(['PROJECT_MEMORY.md']);
    assert.equal(docs.result.status, 0, docs.result.stderr);
    assert.equal(docs.calls.trim(), 'scripts/prepush-diff-guard.js');
    const news = run(['data/news-live.json']);
    assert.equal(news.result.status, 0, news.result.stderr);
    assert.match(news.calls, /news-integrity-check/);
    assert.doesNotMatch(news.calls, /run-article-contract|fitpo50-doctor|export_site/);
    const newsCode = run(['scripts/news-pull.js']);
    assert.equal(newsCode.result.status, 0, newsCode.result.stderr);
    assert.match(newsCode.calls, /--test .*tests\/news-pull.test.js/);
    assert.match(newsCode.calls, /--check scripts\/news-pull.js/);
    const template = run(['article-template-bento.html']);
    assert.equal(template.result.status, 0, template.result.stderr);
    assert.match(template.calls, /validate-article-standard.js --profile technical/);
    assert.doesNotMatch(template.calls, /news|fitpo50-doctor/);
    const unknown = run(['scripts/article-nieznany.js']);
    assert.equal(unknown.result.status, 1);
    assert.equal(unknown.calls, '');
    assert.match(unknown.result.stderr, /article-nieznany.js/);
  } finally { disposeTempWorkspace(root, { status: 'COMPLETED' }); }
});
