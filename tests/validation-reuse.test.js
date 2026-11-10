'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runStep } = require('../scripts/run-all-prepush');
const { validationIdentity, readCheckReceipt, preparationIdentity, preparationCodeIdentity, inspectPreparedArtifact } = require('../scripts/lib/article-json-artifact');
const { articleValidationIdentity, reusableArticleChecks, publicationManifestPath, writePublicationManifest } = require('../scripts/lib/article-staging');
const { packageHashesMatch, executeArticleAddCore } = require('../scripts/article-add');
const { packageIdentity } = require('../scripts/lib/package-identity');
const { auditPackage } = require('../scripts/package-audit');
const { runDeploymentPrepare } = require('../scripts/prepare-deployment-marker');
const { evaluatePushRefs } = require('../scripts/prepush-main-guard');
const { expectedNewsFiles } = require('../scripts/lib/deployment-live-verifier');
const { newsUrlsFor } = require('../scripts/deployment-live-verify');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');

const ROOT = path.resolve(__dirname, '..');

async function withWorkspace(callback) {
  const root = createManagedTempDir({ prefix: 'fitpo50-validation-reuse-', type: 'validation-reuse-test', projectRoot: ROOT });
  try { return await callback(root); }
  finally { disposeTempWorkspace(root, { status: 'COMPLETED' }); }
}

function write(root, file, content) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

function evaluate(files, newsCheck) {
  const head = 'a'.repeat(40);
  return evaluatePushRefs({ lines: `refs/heads/main ${head} refs/heads/main ${'b'.repeat(40)}`, head, changedFiles: files,
    readMarker: () => ({ release_files: files }), assertState() {}, publicFingerprintOk: () => true, newsCheck,
  });
}

test('reuse: artykuł, kod i dokumentacja nie łączą się z NEWS; NEWS i wspólna infrastruktura zachowują kontrolę', () => {
  for (const files of [['artykul.html'], ['PROJECT_MEMORY.md'], ['artykul.html', 'scripts/import-article.js']]) {
    assert.equal(evaluate(files, () => assert.fail('NEWS poza zakresem.')).news, 'NOT_IN_SCOPE');
  }
  for (const files of [['data/news-live.json'], ['.htaccess']]) {
    let called = 0;
    assert.equal(evaluate(files, () => { called += 1; }).news, 'EXECUTED');
    assert.equal(called, 1);
  }
});

test('kontroler HTTP NEWS nie wywołuje FTPS, lecz dane NEWS wymagają kontroli', () => {
  const { classifyChangedFiles } = require('../scripts/lib/change-scope');
  const control = classifyChangedFiles(['scripts/news-public-http-check.js']);
  assert.deepEqual(control.scopes, ['pipeline']);
  for (const file of ['tests/news-public-integrity.test.js', 'tests/news-deploy-sync-gate.test.js', 'tests/validation-reuse.test.js']) assert.ok(control.testFiles.includes(file));
  assert.equal(evaluate(['scripts/news-public-http-check.js'], () => assert.fail('FTPS nie jest wymagany.')).news, 'NOT_IN_SCOPE');
  for (const file of ['data/news-live.json']) {
    let calls = 0;
    assert.equal(evaluate([file], () => { calls += 1; }).news, 'EXECUTED', file);
    assert.equal(calls, 1, file);
  }
});

test('reuse: marker bez NEWS zachowuje snapshot mimo niezwiązanych zmian fallbacku; brak snapshotu nie uruchamia FTPS', () => withWorkspace((root) => {
  const options = { markerOptions: { changedFiles: ['PROJECT_MEMORY.md'] }, newsSyncCheck: () => assert.fail('Nie wolno łączyć się przez FTPS.'), markerPrepare: (_root, data) => data.newsSnapshot };
  assert.throws(() => runDeploymentPrepare(root, options), /NEWS_SNAPSHOT_MISSING/);
  write(root, 'deployment.json', JSON.stringify({ news: { fallback: { path: 'assets/data/news-fallback.json', sha256: 'a'.repeat(64) }, runtime_images: [] } }));
  write(root, 'assets/data/news-fallback.json', 'niezwiązana lokalna zmiana');
  assert.equal(runDeploymentPrepare(root, options).fallback_sha256, 'a'.repeat(64));
}));

test('reuse: kontrola live również pomija NEWS poza zakresem', () => withWorkspace((root) => {
  const errors = [];
  assert.deepEqual(expectedNewsFiles({ version: 4, change_scope: ['articles'] }, errors), []);
  assert.deepEqual(newsUrlsFor('https://example.test', { version: 4, change_scope: ['articles'], news: { fallback: { path: 'assets/data/news-fallback.json' } } }), []);
  assert.deepEqual(errors, []);
  const requiredErrors = [];
  expectedNewsFiles({ version: 4, change_scope: ['news'] }, requiredErrors);
  assert.ok(requiredErrors.length > 0, 'Brak snapshotu NEWS nadal blokuje wydanie NEWS.');
  write(root, 'deployment.json', '{"change_scope":["articles"]}');
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/news-public-http-check.js'), '--release-scope'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /NOT_IN_SCOPE/);
}));

test('reuse: kontrola jest wykonywana raz; zmiana danych, zależnego kodu, konfiguracji i parametrów ją unieważnia', () => withWorkspace(async (root) => {
  write(root, 'input.txt', 'one'); write(root, 'config.json', '{}'); write(root, 'dependency.js', 'module.exports=1;');
  write(root, 'check.js', 'require("./dependency");require("fs").appendFileSync("count.txt","x");');
  const descriptor = { inputs: ['input.txt', 'config.json'], code: ['check.js'], parameters: { mode: 'technical' } };
  const check = () => runStep('fixture', process.execPath, ['check.js'], { root, receipt: descriptor });
  assert.equal((await check()).status, 'EXECUTED');
  assert.equal((await check()).status, 'REUSED');
  assert.equal(fs.readFileSync(path.join(root, 'count.txt'), 'utf8'), 'x');
  for (const [file, content] of [['input.txt', 'two'], ['dependency.js', 'module.exports=2;'], ['config.json', '{"changed":true}']]) {
    write(root, file, content);
    assert.equal((await check()).status, 'EXECUTED', file);
  }
  descriptor.parameters.mode = 'changed';
  assert.equal((await check()).status, 'EXECUTED');
  assert.equal(fs.readFileSync(path.join(root, 'count.txt'), 'utf8'), 'xxxxx');
  const receipt = path.join(root, 'data/reports/local/validation-results', fs.readdirSync(path.join(root, 'data/reports/local/validation-results'))[0]);
  fs.writeFileSync(receipt, '{');
  assert.equal((await check()).status, 'EXECUTED');
}));

test('reuse: błąd, przerwanie i zmiana wejścia podczas kontroli nie są zapisywane jako PASS', () => withWorkspace(async (root) => {
  write(root, 'input.txt', 'one');
  const options = { root, receipt: { inputs: ['input.txt'], code: [] } };
  await assert.rejects(runStep('failure', process.execPath, ['-e', 'process.exit(20)'], options), /exit 20/);
  await assert.rejects(runStep('signal', process.execPath, ['-e', 'process.kill(process.pid,"SIGTERM")'], options), /exit unknown/);
  await assert.rejects(runStep('mutating', process.execPath, ['-e', 'require("fs").writeFileSync("input.txt","changed")'], options), /zależności zmieniły/);
  assert.equal(fs.existsSync(path.join(root, 'data/reports/local/validation-results')), false);
  assert.equal(readCheckReceipt(path.join(root, 'missing.json'), 'unknown'), null);
}));

test('reuse: wynik stagingu wymaga zgodnych danych i kodu, a nie samego markera', () => withWorkspace((root) => {
  write(root, 'article.html', '<body class="article-template"><a href="linked.html">link</a></body>');
  write(root, '_site/article.html', 'mirror'); write(root, 'linked.html', 'target');
  write(root, 'scripts/schema-validator.js', '// validation v1');
  const files = ['article.html', '_site/article.html'];
  const manifestFile = publicationManifestPath('article');
  const manifest = writePublicationManifest({ stageRoot: root, article: { slug: 'article' }, candidates: files, baseline: new Map(files.map((file) => [file, null])), transactionId: 'fixture', profile: 'technical' }).payload;
  assert.equal(manifest.validation_receipt, articleValidationIdentity(root, files, 'technical'));
  assert.equal(reusableArticleChecks(root, files), true);
  assert.equal(reusableArticleChecks(root, [...files, 'scripts/import-article.js', manifestFile, 'deployment.json']), true);
  write(root, 'article.html', 'changed');
  assert.equal(reusableArticleChecks(root, files), false);
  write(root, 'article.html', '<body class="article-template"><a href="linked.html">link</a></body>');
  write(root, 'scripts/schema-validator.js', '// validation v2');
  assert.equal(reusableArticleChecks(root, files), false);
  write(root, 'scripts/schema-validator.js', '// validation v1');
  write(root, 'linked.html', 'changed target');
  assert.equal(reusableArticleChecks(root, files), false);
  assert.equal(reusableArticleChecks(root, [...files, 'other.html']), false);
  write(root, 'linked.html', 'target');
  assert.equal(reusableArticleChecks(root, files), true);
  write(root, 'scripts/prepare-article-media.js', '// zmiana wcześniejszego etapu');
  assert.equal(reusableArticleChecks(root, files), false, 'Zmiana przygotowania unieważnia zależny wynik stagingu.');
}));

test('reuse: tożsamość kontroli zależy od zawartości, nie daty pliku', () => withWorkspace((root) => {
  write(root, 'data.json', 'one');
  const file = path.join(root, 'data.json'); const before = fs.statSync(file);
  const first = validationIdentity(root, { inputs: ['data.json'] });
  fs.writeFileSync(file, 'two'); fs.utimesSync(file, before.atime, before.mtime);
  assert.notEqual(validationIdentity(root, { inputs: ['data.json'] }), first);
}));

test('reuse: rzeczywista paczka ponownie wykorzystuje audyt i przygotowanie, a zmiana wejścia je unieważnia', () => withWorkspace((root) => {
  const assets = path.join(root, 'package'); fs.mkdirSync(assets);
  const fixture = path.join(ROOT, 'tests/fixtures/package-audit/valid-package');
  for (const name of fs.readdirSync(fixture)) fs.copyFileSync(path.join(fixture, name), path.join(assets, name));
  const file = path.join(assets, 'package-audit-valid.fitpo50.json');
  const args = { file, 'assets-dir': assets, 'report-dir': path.join(root, 'reports'), profile: 'technical' };
  const first = auditPackage(args, { root }); assert.equal(first.exit_code, 0);
  assert.equal(auditPackage(args, { root }).reused, true);
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  const workbench = spawnSync(process.execPath, ['scripts/article-json-workbench.js', '--file', file, '--assets-dir', assets, '--output-dir', path.join(root, 'ready'), '--profile', 'technical', '--audit-report', first.report_file], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(workbench.status, 0, workbench.stdout + workbench.stderr);
  const prepared = workbench.stdout.match(/^\[ARTICLE-JSON\] JSON: (.+)$/m)[1];
  assert.equal(packageHashesMatch(file, assets, prepared, 'technical'), true);
  assert.equal(packageHashesMatch(file, assets, prepared, 'technical', { force: true }), false);
  const sourceHash = packageIdentity(file, assets, article).hash;
  const identity = preparationIdentity(ROOT, article, sourceHash, { force: false, keepRevisions: false });
  assert.equal(JSON.parse(fs.readFileSync(prepared.replace('.fitpo50.json', '.fitpo50.report.json'), 'utf8')).preparation_identity, identity);
  assert.equal(inspectPreparedArtifact(prepared).ok, true);
  assert.ok(preparationCodeIdentity().length === 64);
  for (const force of [false, true]) {
    const calls = [];
    assert.equal(executeArticleAddCore({ file: prepared, force, 'output-dir': path.dirname(prepared) }, {
      root: ROOT, articleOperationInHead: () => 'CREATE', auditPackage: () => ({ exit_code: 0, by_owner: {} }), printPackageAuditReport() {},
      runCommand(_command, commandArgs) { calls.push(commandArgs); return { status: 0, stdout: `[ARTICLE-JSON] JSON: ${prepared}\n` }; },
    }), 0);
    assert.equal(calls.some((commandArgs) => commandArgs[0] === 'scripts/article-json-workbench.js'), force, 'Inny force unieważnia także bezpośrednio podany pakiet przygotowany.');
  }
  fs.appendFileSync(file, ' ');
  assert.notEqual(auditPackage(args, { root }).reused, true);
  assert.equal(packageHashesMatch(file, assets, prepared, 'technical'), false);
  write(root, `${article.slug}.html`, 'fixture collision');
  assert.equal(auditPackage({ ...args, force: '1' }, { root }).exit_code, 0);
  assert.equal(auditPackage({ ...args, force: 'false' }, { root }).exit_code, 20, 'Wynik force=1 nie uprawnia do ponownego użycia bez zgody na nadpisanie.');
}));

test('reuse: kontrola schema przed zapisem wyniku stagingu obejmuje tylko artykuł i zachowuje błędy techniczne', () => withWorkspace((root) => {
  const schema = { '@type': 'BlogPosting', datePublished: '2026-11-10T08:00:00+01:00', dateModified: '2026-11-10T08:00:00+01:00', speakable: { cssSelector: ['.quick-answer'] } };
  const render = () => `<article class="article-content"><section class="quick-answer">Tekst testowy.</section></article><script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  write(root, 'article.html', render());
  write(root, 'unrelated.html', '<article class="article-content">celowo błędna schema poza zakresem</article>');
  const check = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/schema-validator.js'), '--diff', '--files-json', '["article.html"]'], { cwd: root, encoding: 'utf8' });
  const good = check(); assert.equal(good.status, 0, good.stdout + good.stderr);
  schema.datePublished = 'invalid'; write(root, 'article.html', render());
  assert.equal(check().status, 1);
}));

test('reuse: precommit wykorzystuje wynik stagingu dopiero po sprawdzeniu zawartości staged', () => withWorkspace((root) => {
  const files = ['article.html', '_site/article.html'];
  for (const file of files) write(root, file, '<body class="article-template"><article class="article-content">fixture</article></body>');
  const manifest = writePublicationManifest({ stageRoot: root, article: { slug: 'article' }, candidates: files, baseline: new Map(files.map((file) => [file, null])), transactionId: 'fixture', profile: 'technical' });
  const git = (...args) => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); };
  git('init', '-q'); git('add', '--', ...files, manifest.relative);
  const check = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/article-publish-guard.js'), '--staged'], { cwd: root, encoding: 'utf8' });
  const result = check(); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /REUSED/);
  fs.appendFileSync(path.join(root, 'article.html'), 'zmiana po staged');
  const changed = check(); assert.equal(changed.status, 1);
  assert.match(changed.stderr, /Staged różni się/);
}));
