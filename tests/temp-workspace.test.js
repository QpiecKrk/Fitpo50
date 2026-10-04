const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { executeCleanup } = require('../scripts/tmp-cleanup');
const { createManagedTempDir, disposeTempWorkspace, markTempWorkspace, reactivateTempWorkspace, readWorkspaceManifest, resolveWorkspaceProjectRoot } = require('../scripts/lib/temp-workspace');

const FIXTURE_ROOTS = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-temp-safety-'));
  FIXTURE_ROOTS.push(root);
  const tempRoot = path.join(root, 'system-tmp');
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(tempRoot);
  fs.mkdirSync(projectRoot);
  return { root, tempRoot, projectRoot };
}

test.after(() => {
  for (const root of FIXTURE_ROOTS) fs.rmSync(root, { recursive: true, force: true });
});

function oldIso(hours = 24) { return new Date(Date.now() - hours * 3600000).toISOString(); }

test('workspace zapisuje właściciela, PID, projekt, slug, status i lock', () => {
  const { tempRoot, projectRoot } = fixture();
  const directory = createManagedTempDir({ prefix: 'fitpo50-import-', type: 'article-import', projectRoot, tempRoot, slug: 'testowy-artykul' });
  const manifest = readWorkspaceManifest(directory);
  assert.equal(manifest.workspace_type, 'article-import');
  assert.equal(manifest.pid, process.pid);
  assert.equal(manifest.project_root, projectRoot);
  assert.equal(manifest.slug, 'testowy-artykul');
  assert.equal(manifest.status, 'ACTIVE');
  assert.equal(fs.existsSync(path.join(directory, '.fitpo50-workspace.lock')), true);
  disposeTempWorkspace(directory);
  assert.equal(fs.existsSync(directory), false);
});

test('zagnieżdżony proces dziedziczy główny katalog projektu ze stagingu', () => {
  const { tempRoot, projectRoot } = fixture();
  const stage = createManagedTempDir({ prefix: 'fitpo50-preview-nested-', type: 'article-preview', projectRoot, tempRoot });
  assert.equal(resolveWorkspaceProjectRoot(stage), projectRoot);
  disposeTempWorkspace(stage);
});

test('cleanup jest domyślnie dry-run i nie usuwa starego osieroconego workspace', () => {
  const { tempRoot, projectRoot } = fixture();
  const directory = createManagedTempDir({ prefix: 'fitpo50-import-', type: 'article-import', projectRoot, tempRoot, pid: 99999999, createdAt: oldIso() });
  const result = executeCleanup({ tempRoot, projectRoot, minAgeMs: 12 * 3600000, systemOnly: true });
  assert.equal(result.apply, false);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].reason, 'ORPHANED');
  assert.equal(fs.existsSync(directory), true);
});

test('cleanup nie usuwa świeżego katalogu z martwym PID-em', () => {
  const { tempRoot, projectRoot } = fixture();
  const directory = createManagedTempDir({ prefix: 'fitpo50-preview-test-', type: 'article-preview', projectRoot, tempRoot, pid: 99999999 });
  const result = executeCleanup({ apply: true, tempRoot, projectRoot, minAgeMs: 12 * 3600000, systemOnly: true });
  assert.equal(result.removed.length, 0);
  assert.equal(result.skipped[0].reason, 'FRESH');
  assert.equal(fs.existsSync(directory), true);
});

test('cleanup nie usuwa starego katalogu aktywnego procesu ani drugiej sesji', () => {
  const { tempRoot, projectRoot } = fixture();
  const first = createManagedTempDir({ prefix: 'fitpo50-import-', type: 'article-import', projectRoot, tempRoot, pid: process.pid, createdAt: oldIso() });
  const second = createManagedTempDir({ prefix: 'fitpo50-preview-other-', type: 'article-preview', projectRoot, tempRoot, pid: process.pid, createdAt: oldIso() });
  const result = executeCleanup({ apply: true, tempRoot, projectRoot, minAgeMs: 12 * 3600000, systemOnly: true });
  assert.equal(result.removed.length, 0);
  assert.equal(result.skipped.filter((item) => item.reason === 'ACTIVE_PROCESS').length, 2);
  assert.equal(fs.existsSync(first), true);
  assert.equal(fs.existsSync(second), true);
});

test('cleanup nie usuwa dowodów stagingu oczekujących na visual review, a wznowienie odtwarza lock', () => {
  const { tempRoot, projectRoot } = fixture();
  const directory = createManagedTempDir({ prefix: 'fitpo50-preview-review-', type: 'article-publication-staging', projectRoot, tempRoot, pid: 99999999, createdAt: oldIso() });
  markTempWorkspace(directory, 'AWAITING_REVIEW');
  const result = executeCleanup({ apply: true, tempRoot, projectRoot, minAgeMs: 12 * 3600000, systemOnly: true });
  assert.equal(result.removed.length, 0);
  assert.ok(result.skipped.some((item) => item.reason === 'AWAITING_REVIEW'));
  assert.equal(fs.existsSync(directory), true);
  reactivateTempWorkspace(directory);
  assert.equal(readWorkspaceManifest(directory).status, 'ACTIVE');
  assert.equal(fs.existsSync(path.join(directory, '.fitpo50-workspace.lock')), true);
  disposeTempWorkspace(directory);
});

test('cleanup usuwa wyłącznie stary zarządzany katalog z martwym PID-em', () => {
  const { tempRoot, projectRoot } = fixture();
  const orphan = createManagedTempDir({ prefix: 'fitpo50-prepush-export-', type: 'prepush-export', projectRoot, tempRoot, pid: 99999999, createdAt: oldIso() });
  const unmanaged = fs.mkdtempSync(path.join(tempRoot, 'fitpo50-import-'));
  const result = executeCleanup({ apply: true, tempRoot, projectRoot, minAgeMs: 12 * 3600000, systemOnly: true });
  assert.deepEqual(result.removed.map((item) => item.directory), [orphan]);
  assert.equal(fs.existsSync(orphan), false);
  assert.equal(fs.existsSync(unmanaged), true);
  assert.ok(result.skipped.some((item) => item.directory === unmanaged && item.reason === 'UNMANAGED'));
});

test('cleanup odrzuca workspace należący do innego projektu', () => {
  const { tempRoot, projectRoot } = fixture();
  const foreign = createManagedTempDir({ prefix: 'fitpo50-import-', type: 'article-import', projectRoot: `${projectRoot}-other`, tempRoot, pid: 99999999, createdAt: oldIso() });
  const result = executeCleanup({ apply: true, tempRoot, projectRoot, minAgeMs: 12 * 3600000, systemOnly: true });
  assert.equal(result.removed.length, 0);
  assert.equal(result.skipped[0].reason, 'FOREIGN_PROJECT');
  assert.equal(fs.existsSync(foreign), true);
});

test('tryb apply nie pozwala obniżyć minimalnego wieku poniżej 12 godzin', () => {
  const { tempRoot, projectRoot } = fixture();
  assert.throws(() => executeCleanup({ apply: true, tempRoot, projectRoot, minAgeMs: 3600000, systemOnly: true }), /minimum 12 godzin/);
});

test('CLI bez --apply nie zmienia fixture', () => {
  const { tempRoot } = fixture();
  const projectRoot = path.resolve(__dirname, '..');
  const directory = createManagedTempDir({ prefix: 'fitpo50-import-', type: 'article-import', projectRoot, tempRoot, pid: 99999999, createdAt: oldIso() });
  const result = spawnSync('node', ['scripts/tmp-cleanup.js', '--temp-root', tempRoot, '--project-root', projectRoot, '--system-only', '--min-age-hours', '12'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /mode=dry-run/);
  assert.equal(fs.existsSync(directory), true);
});

test('nieprawidłowy wiek CLI kończy się błędem zamiast przejścia na zero', () => {
  const result = spawnSync('node', ['scripts/tmp-cleanup.js', '--min-age-hours', 'abc'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Nieprawidłowe --min-age-hours/);
});

test('CLI odrzuca konflikt trybów, nieznany argument i obcy root projektu', () => {
  const cwd = path.resolve(__dirname, '..');
  let result = spawnSync('node', ['scripts/tmp-cleanup.js', '--apply', '--dry-run'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Nie można łączyć/);
  result = spawnSync('node', ['scripts/tmp-cleanup.js', '--unknown'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Nieznany argument/);
  result = spawnSync('node', ['scripts/tmp-cleanup.js', '--project-root', os.tmpdir()], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /bieżący projekt/);
});

test('nowe katalogi tymczasowe JS mogą powstawać tylko przez wspólny moduł', () => {
  const scriptsRoot = path.resolve(__dirname, '..', 'scripts');
  const hits = [];
  const stack = [scriptsRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && entry.name.endsWith('.js') && /fs\.mkdtempSync\s*\(/.test(fs.readFileSync(absolute, 'utf8'))) hits.push(path.relative(scriptsRoot, absolute).replace(/\\/g, '/'));
    }
  }
  assert.deepEqual(hits, ['lib/temp-workspace.js']);
});

test('workspace PDF zapisuje manifest i lock natychmiast po utworzeniu', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'generate_article_pdf.py'), 'utf8');
  assert.match(source, /TemporaryDirectory\(prefix="fitpo50_pdf_"\)[\s\S]{0,180}write_temp_workspace_owner\(tmp_dir, input_html\)/);
  assert.match(source, /\.fitpo50-workspace\.json/);
  assert.match(source, /\.fitpo50-workspace\.lock/);
});
