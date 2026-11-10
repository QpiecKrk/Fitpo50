'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { auditPackage } = require('../scripts/package-audit');
const { executeArticleAddCore } = require('../scripts/article-add');
const { runDryRun } = require('../scripts/article-dry-run');
const { buildStageDefinitions } = require('../scripts/article-json-workbench');
const { normalizePayload, buildHtmlFromTemplate } = require('../scripts/import-article');
const { inspectPreparedArtifact } = require('../scripts/lib/article-json-artifact');
const { publicationManifestPath, validationProfileForFile, sha256File } = require('../scripts/lib/article-staging');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/package-audit/valid-package');

function withPackage(callback) {
  const workspace = createManagedTempDir({ prefix: 'fitpo50-technical-flow-test-', type: 'article-technical-flow-test', projectRoot: ROOT });
  const assets = path.join(workspace, 'package');
  fs.mkdirSync(assets);
  for (const name of fs.readdirSync(FIXTURE)) fs.copyFileSync(path.join(FIXTURE, name), path.join(assets, name));
  const file = path.join(assets, 'package-audit-valid.fitpo50.json');
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  article.evidence_claims[0].location = 'nieistniejace.pole';
  article.quick_answer = 'Pierwsze zdanie. Drugie zdanie. Trzecie zdanie. Czwarte zdanie. Piąte zdanie. Szóste zdanie.';
  article.meta_description = 'Krótki opis autora.';
  article.seo_title = 'Tytuł autora '.repeat(10).trim();
  article.sections[0].title = 'Opisowy nagłówek autora';
  delete article.search_intent;
  delete article.primary_keyword;
  delete article.supporting_keywords;
  fs.writeFileSync(file, JSON.stringify(article));
  try { return callback({ workspace, assets, file, article }); }
  finally { disposeTempWorkspace(workspace, { status: 'COMPLETED' }); }
}

test('technical flow: kontroler nigdy nie wywołuje earlyEvidenceAudit i przekazuje profil', () => withPackage(({ workspace, assets, file }) => {
  const calls = [];
  const status = executeArticleAddCore({ file, 'assets-dir': assets, 'dry-run': 'true' }, {
    root: workspace,
    auditEvidence: () => assert.fail('Nie wolno uruchamiać wczesnej kontroli dowodów.'),
    auditPackage(args) { assert.equal(args.profile, 'technical'); return { exit_code: 0, by_owner: {} }; },
    printPackageAuditReport() {},
    runCommand(_cmd, args) { calls.push(args); return { status: 0 }; },
  });
  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'scripts/article-dry-run.js');
  assert.deepEqual(calls[0].slice(calls[0].indexOf('--profile'), calls[0].indexOf('--profile') + 2), ['--profile', 'technical']);
  assert.ok(buildStageDefinitions(file, assets, { profile: 'technical' }).every((stage) => stage.args.includes('technical')));
  assert.doesNotMatch(JSON.stringify(buildStageDefinitions(file, assets, { profile: 'technical' })), /python|evidence|json-fitpo50|fix-fitpo50/);
}));

test('technical flow: rzeczywiste przygotowanie, preflight i precheck importera zachowują tekst autora', () => withPackage(({ workspace, assets, file, article }) => {
  const before = fs.readFileSync(file, 'utf8');
  const audit = auditPackage({ file, 'assets-dir': assets, 'report-dir': path.join(workspace, 'reports'), profile: 'technical' });
  assert.equal(audit.exit_code, 0, JSON.stringify(audit.by_owner));
  const args = ['scripts/article-json-workbench.js', '--file', file, '--assets-dir', assets, '--output-dir', path.join(workspace, 'ready'), '--profile', 'technical', '--audit-report', audit.report_file];
  const prepared = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  const output = prepared.stdout.match(/^\[ARTICLE-JSON\] JSON: (.+)$/m)?.[1];
  const artifact = inspectPreparedArtifact(output, ROOT);
  assert.equal(artifact.ok, true, JSON.stringify(artifact));
  assert.equal(artifact.report.validation_profile, 'technical');
  assert.equal(artifact.report.stages.length, 3);
  const ready = JSON.parse(fs.readFileSync(output, 'utf8'));
  for (const field of ['title', 'seo_title', 'meta_description', 'quick_answer', 'evidence_claims', 'sources', 'faq_research', 'image_prompts_v4']) assert.deepEqual(ready[field], article[field], field);
  assert.equal(ready.sections[0].title, article.sections[0].title);
  const payload = normalizePayload(ready, null, { profile: 'technical' });
  assert.equal(payload.quickAnswer, article.quick_answer);
  assert.equal(payload.metaDescription, article.meta_description);
  assert.equal(payload.seoTitleBase, article.seo_title);
  assert.equal(payload.sections[0].title, article.sections[0].title);
  fs.copyFileSync(path.join(ROOT, 'article-template-bento.html'), path.join(workspace, 'article-template-bento.html'));
  for (const target of ['assets', '_site/assets']) {
    fs.mkdirSync(path.join(workspace, target), { recursive: true });
    for (const name of fs.readdirSync(assets).filter((name) => /\.(avif|webp|jpg)$/.test(name))) fs.copyFileSync(path.join(assets, name), path.join(workspace, target, name));
  }
  const precheck = spawnSync(process.execPath, [path.join(ROOT, 'scripts/import-article.js'), '--file', output, '--profile', 'technical', '--precheck', 'true'], { cwd: workspace, encoding: 'utf8' });
  assert.equal(precheck.status, 0, precheck.stdout + precheck.stderr);
  assert.match(precheck.stdout, /TAK - mogę/);
  // Normalny importer dodaje BreadcrumbList w końcowym sync-title-breadcrumbs.
  const html = buildHtmlFromTemplate(fs.readFileSync(path.join(ROOT, 'article-template-bento.html'), 'utf8'), payload)
    .replace('</head>', '<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script></head>');
  const htmlFile = path.join(workspace, `${article.slug}.html`);
  fs.writeFileSync(htmlFile, html);
  for (const match of html.matchAll(/\b(?:src|href|srcset)="([^"\s,]+)"/g)) {
    const reference = match[1].split(/[?#]/)[0];
    if (!reference || /^(?:https?:|mailto:|tel:|data:|#|\/)/.test(match[1]) || reference.includes('..')) continue;
    const target = path.resolve(workspace, reference);
    if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, 'fixture'); }
  }
  const validate = (profile) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/validate-article-standard.js'), '--profile', profile, htmlFile], { cwd: workspace, encoding: 'utf8' });
  const technicalHtml = validate('technical');
  assert.equal(technicalHtml.status, 0, technicalHtml.stdout + technicalHtml.stderr);
  assert.notEqual(validate('editorial').status, 0, 'Jawny profil redakcyjny musi zachować bramki treści.');
  const manifest = path.join(workspace, publicationManifestPath(article.slug));
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, JSON.stringify({ slug: article.slug, status: 'PUBLISHED', validation_profile: 'technical', files: [{ path: `${article.slug}.html`, after_sha256: sha256File(htmlFile) }] }));
  const hookValidator = spawnSync(process.execPath, [path.join(ROOT, 'scripts/validate-article-standard.js'), '--profile', 'auto', htmlFile], { cwd: workspace, encoding: 'utf8' });
  assert.equal(hookValidator.status, 0, hookValidator.stdout + hookValidator.stderr);
  const defaultValidator = spawnSync(process.execPath, [path.join(ROOT, 'scripts/validate-article-standard.js'), htmlFile], { cwd: workspace, encoding: 'utf8' });
  assert.notEqual(defaultValidator.status, 0, 'Domyślny walidator popraw-seo zachowuje reguły redakcyjne także przy technicznym manifeście.');
  for (const name of ['index.html', 'porady.html', 'ciekawe.html', 'llms.txt', 'llms-full.txt']) fs.writeFileSync(path.join(workspace, name), `${article.slug}.html`);
  fs.writeFileSync(path.join(workspace, 'sitemap.xml'), `<urlset><url><loc>https://fitpo50.pl/${article.slug}.html</loc></url></urlset>`);
  const publicationFiles = [`${article.slug}.html`, 'index.html', 'porady.html', 'ciekawe.html', 'llms.txt', 'llms-full.txt', 'sitemap.xml', 'assets/data/search-index.json', `assets/pdf/${article.slug}.pdf`];
  for (const name of publicationFiles) {
    const source = path.join(workspace, name);
    if (!fs.existsSync(source)) { fs.mkdirSync(path.dirname(source), { recursive: true }); fs.writeFileSync(source, 'fixture'); }
    const target = path.join(workspace, '_site', name);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
  }
  fs.mkdirSync(path.join(workspace, 'data'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'data/news-live.json'), 'celowo niepoprawny NEWS poza zakresem');
  const mirrors = spawnSync(process.execPath, [path.join(ROOT, 'scripts/sync-site-assets-mirror.js'), '--slug', article.slug, '--profile', 'technical', '--check'], { cwd: workspace, encoding: 'utf8' });
  assert.equal(mirrors.status, 0, mirrors.stdout + mirrors.stderr);
  assert.equal(fs.existsSync(path.join(workspace, '_site/data/news-live.json')), false);
  const predeploy = spawnSync(process.execPath, [path.join(ROOT, 'scripts/predeploy-gate.js'), '--slug', article.slug, '--profile', 'technical'], { cwd: workspace, encoding: 'utf8' });
  assert.equal(predeploy.status, 0, predeploy.stdout + predeploy.stderr);
  fs.appendFileSync(path.join(workspace, '_site', `${article.slug}.html`), 'zmiana');
  const badMirror = spawnSync(process.execPath, [path.join(ROOT, 'scripts/predeploy-gate.js'), '--slug', article.slug, '--profile', 'technical'], { cwd: workspace, encoding: 'utf8' });
  assert.notEqual(badMirror.status, 0);
  assert.match(badMirror.stdout + badMirror.stderr, /source vs _site/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.existsSync(path.join(ROOT, `${article.slug}.html`)), false);

  const calls = [];
  const report = runDryRun({ file, 'assets-dir': assets, profile: 'technical', 'audit-report': audit.report_file }, {
    validateInput: () => assert.fail('Techniczny dry-run nie może wywołać redakcyjnego validateInput.'),
    createWorkspace: () => workspace, disposeWorkspace() {},
    spawnSync(_cmd, commandArgs) { calls.push(commandArgs); return { status: 0, stdout: `[ARTICLE-JSON] JSON: ${output}\n` }; },
  });
  assert.equal(report.status, 'READY');
  assert.ok(calls[0].includes('--audit-report'));
  assert.ok(calls[0].includes('technical'));
}));

test('technical flow: hook wybiera profil wyłącznie z manifestu zgodnego z hashem HTML', () => withPackage(({ workspace }) => {
  const file = path.join(workspace, 'testowy-artykul.html');
  fs.writeFileSync(file, '<html>wersja sprawdzona</html>');
  const manifest = path.join(workspace, publicationManifestPath('testowy-artykul'));
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  assert.equal(validationProfileForFile(file, workspace), 'editorial');
  fs.writeFileSync(manifest, JSON.stringify({ slug: 'testowy-artykul', status: 'PUBLISHED', validation_profile: 'technical', files: [{ path: 'testowy-artykul.html', after_sha256: sha256File(file) }] }));
  assert.equal(validationProfileForFile(file, workspace), 'technical');
  fs.appendFileSync(file, '<p>zmiana</p>');
  assert.equal(validationProfileForFile(file, workspace), 'editorial');
}));

test('technical dry-run: zmieniona paczka unieważnia raport, błąd składni pozostaje błędem danych', () => withPackage(({ workspace, assets, file }) => {
  const audit = auditPackage({ file, 'assets-dir': assets, 'report-dir': path.join(workspace, 'reports'), profile: 'technical' });
  fs.appendFileSync(file, ' ');
  assert.throws(() => runDryRun({ file, 'assets-dir': assets, profile: 'technical', 'audit-report': audit.report_file }), /nie odpowiada bieżącej paczce/);
  fs.writeFileSync(file, '{');
  const report = runDryRun({ file, 'assets-dir': assets, profile: 'technical', 'report-dir': path.join(workspace, 'reports') }, {
    spawnSync: () => assert.fail('Błędny JSON nie może uruchomić przygotowania ani renderu.'),
  });
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.diagnostics.some((item) => item.error_code === 'JSON_PARSE_ERROR'));
}));
