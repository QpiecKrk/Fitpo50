const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const { parseArgs: parseAssetsAuditArgs } = require('../scripts/assets-audit');
const { executeRetention, parseArgs: parseRetentionArgs } = require('../scripts/assets-trash-retention');
const { assertExportOutput } = require('../scripts/lib/destructive-path-guard');
const { createManagedTempDir } = require('../scripts/lib/temp-workspace');
const { executePrune, parseArgs: parseReportsArgs, trackedSet } = require('../scripts/reports-prune');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = [];

function fixtureProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-destructive-safety-')));
  FIXTURES.push(root);
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fitpo50"}\n');
  fs.writeFileSync(path.join(root, 'scripts', 'export_site.sh'), '#!/usr/bin/env bash\n');
  return root;
}

function oldFile(file, content = 'old') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  const old = new Date(Date.now() - 45 * 86400000);
  fs.utimesSync(file, old, old);
}

test.after(() => {
  for (const root of FIXTURES) fs.rmSync(root, { recursive: true, force: true });
});

test('publiczne prune są domyślnie dry-run i wymagają jawnego apply', () => {
  assert.deepEqual(parseReportsArgs([]), { apply: false, days: 30 });
  assert.deepEqual(parseRetentionArgs([]), { days: 14, apply: false, verbose: false });
  assert.equal(parseReportsArgs(['--apply']).apply, true);
  assert.equal(parseRetentionArgs(['--apply']).apply, true);
  assert.throws(() => parseReportsArgs(['--apply', '--dry-run']), /Nie można łączyć/);
  assert.throws(() => parseRetentionArgs(['--apply', '--dry-run']), /Nie można łączyć/);
  assert.throws(() => parseReportsArgs(['--unknown']), /Nieznany argument/);
  assert.throws(() => parseRetentionArgs(['--apply', '--days', '0']), /minimum 14 dni/);
});

test('reports prune nie usuwa w dry-run i usuwa allowlistowany plik dopiero w apply', () => {
  const root = fixtureProject();
  const reports = path.join(root, 'data', 'reports');
  const file = path.join(reports, 'seo-old.json');
  oldFile(file);
  const roots = [{ directory: reports, safeRx: /^seo-.+\.json$/i }];
  const dry = executePrune({ root, roots, args: { apply: false, days: 30 }, loadTracked: () => new Set() });
  assert.equal(dry.candidates.length, 1);
  assert.equal(fs.existsSync(file), true);
  const applied = executePrune({ root, roots, args: { apply: true, days: 30 }, loadTracked: () => new Set() });
  assert.deepEqual(applied.removed, [file]);
  assert.equal(fs.existsSync(file), false);
});

test('reports prune działa fail-closed przy błędzie Git i ponownie chroni plik śledzony', () => {
  const root = fixtureProject();
  assert.throws(() => trackedSet(root, () => ({ status: 128, stdout: '', stderr: 'not a repository' })), /git ls-files nie powiódł się/);
  const reports = path.join(root, 'data', 'reports');
  const file = path.join(reports, 'seo-old.json');
  oldFile(file);
  let calls = 0;
  assert.throws(() => executePrune({
    root,
    roots: [{ directory: reports, safeRx: /^seo-.+\.json$/i }],
    args: { apply: true, days: 30 },
    loadTracked: () => (++calls === 1 ? new Set() : new Set(['data/reports/seo-old.json'])),
  }), /śledzonego pliku/);
  assert.equal(fs.existsSync(file), true);
});

test('assets trash retention nie usuwa w dry-run i respektuje 14 dni w apply', () => {
  const root = fixtureProject();
  const trash = path.join(root, 'assets', 'trash');
  const file = path.join(trash, 'nested', 'old.webp');
  oldFile(file);
  const dry = executeRetention({ root, targetDirectories: [trash], args: { apply: false, days: 14, verbose: false } });
  assert.equal(dry.candidates.length, 1);
  assert.equal(fs.existsSync(file), true);
  const applied = executeRetention({ root, targetDirectories: [trash], args: { apply: true, days: 14, verbose: false } });
  assert.deepEqual(applied.removed, [file]);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(path.dirname(file)), false);
});

test('symlink w assets trash blokuje cleanup bez naruszenia celu', () => {
  const root = fixtureProject();
  const trash = path.join(root, 'assets', 'trash');
  const external = path.join(root, 'outside.webp');
  fs.mkdirSync(trash, { recursive: true });
  fs.writeFileSync(external, 'keep');
  fs.symlinkSync(external, path.join(trash, 'link.webp'));
  assert.throws(() => executeRetention({ root, targetDirectories: [trash], args: { apply: false, days: 14, verbose: false } }), /Symlink/);
  assert.equal(fs.readFileSync(external, 'utf8'), 'keep');
});

test('export dopuszcza tylko _site albo aktywny zarządzany workspace', () => {
  const root = fixtureProject();
  const site = path.join(root, '_site');
  assert.equal(assertExportOutput(root, site), site);
  const workspace = createManagedTempDir({ prefix: 'fitpo50-export-check-', type: 'build-export-check', projectRoot: root });
  FIXTURES.push(workspace);
  assert.equal(assertExportOutput(root, path.join(workspace, 'site')), path.join(fs.realpathSync(workspace), 'site'));
  assert.throws(() => assertExportOutput(root, root), /wymaga katalogu workspace/);
  const ordinaryTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-ordinary-'));
  FIXTURES.push(ordinaryTemp);
  assert.throws(() => assertExportOutput(root, path.join(ordinaryTemp, 'site')), /zarządzanego workspace/);
});

test('export_site odrzuca niebezpieczny output przed buildem i kasowaniem', () => {
  const result = spawnSync('bash', ['scripts/export_site.sh', ROOT], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /DESTRUCTIVE-PATH-GUARD/);
});

test('assets audit odrzuca nieznane argumenty i brak wartości raportu', () => {
  assert.deepEqual(parseAssetsAuditArgs(['--apply', '--report', 'data/reports/assets-audit.json']), {
    apply: true,
    verbose: false,
    report: 'data/reports/assets-audit.json',
  });
  assert.throws(() => parseAssetsAuditArgs(['--report']), /Brak wartości/);
  assert.throws(() => parseAssetsAuditArgs(['--unknown']), /Nieznany argument/);
});
