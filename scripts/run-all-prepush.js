#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const crypto = require('crypto');
const path = require('path');
const { createManagedTempDir, disposeTempWorkspace } = require('./lib/temp-workspace');
const { warsawIso } = require('./lib/time');
const { assertResolvedScope, classifyChangedFiles, collectChangedFiles } = require('./lib/change-scope');
const { compareExportTrees } = require('./lib/export-parity');
const { validationIdentity, readCheckReceipt, writeCheckReceipt } = require('./lib/article-json-artifact');
const { reusableArticleChecks } = require('./lib/article-staging');

function prefixOutput(tag, stream, logger) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => logger(`[${tag}] ${line}`));
}

function runStep(tag, cmd, args, options = {}) {
  const root = options.root || process.cwd();
  const receiptFile = path.join(root, 'data/reports/local/validation-results', crypto.createHash('sha256').update(JSON.stringify([tag, cmd, args])).digest('hex') + '.json');
  const identityFor = () => validationIdentity(root, {
    ...options.receipt,
    code: ['scripts/run-all-prepush.js', 'scripts/lib/article-json-artifact.js', ...(options.receipt?.code || [])],
    parameters: { cmd, args, scope: process.env.FITPO50_CHANGED_FILES_JSON || '', base: process.env.FITPO50_PUSH_BASE || '', nodeOptions: process.env.NODE_OPTIONS || '', ...(options.receipt?.parameters || {}) },
  });
  const identity = options.receipt ? identityFor() : '';
  if (identity && readCheckReceipt(receiptFile, identity)) {
    console.log(`[REUSED] ${tag}: zgodne dane, kod, konfiguracja i parametry.`);
    return Promise.resolve({ tag, durationMs: 0, status: 'REUSED', identity });
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, ...(args.includes('--test') ? { FITPO50_CHANGED_FILES_JSON: undefined, FITPO50_PUSH_BASE: undefined } : {}), ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    prefixOutput(tag, child.stdout, console.log);
    prefixOutput(tag, child.stderr, console.error);
    child.on('error', (err) => reject(new Error(`${tag}: ${err.message || err}`)));
    child.on('close', (code) => {
      const durationMs = Date.now() - started;
      if (code !== 0) reject(new Error(`${tag}: exit ${code ?? 'unknown'}`));
      else {
        try {
          if (identity) {
            if (identityFor() !== identity) throw new Error(`${tag}: zależności zmieniły się podczas kontroli.`);
            writeCheckReceipt(receiptFile, identity, { tag });
          }
          resolve({ tag, durationMs, status: 'EXECUTED' });
        } catch (error) { reject(error); }
      }
    });
  });
}

function appendTimingReport(scope, totalMs, steps) {
  try {
    const reportPath = process.env.FITPO50_PIPELINE_TIMINGS_PATH
      ? path.resolve(process.env.FITPO50_PIPELINE_TIMINGS_PATH)
      : path.join(process.cwd(), 'data', 'reports', 'local', 'pipeline-timings.json');
    const nowIso = warsawIso();
    const payload = fs.existsSync(reportPath)
      ? JSON.parse(fs.readFileSync(reportPath, 'utf8'))
      : { version: 1, updated_at: nowIso, records: [] };
    const records = Array.isArray(payload.records) ? payload.records : [];
    records.push({
      scope,
      at: nowIso,
      total_ms: totalMs,
      steps,
    });
    payload.records = records.slice(-120);
    payload.updated_at = nowIso;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    atomicWriteFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch (_err) {
    // best effort only
  }
}

function repositorySnapshot(root = process.cwd()) {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'buffer' },
  );
  if (result.status !== 0) throw new Error(`Nie udało się utworzyć migawki źródeł: ${String(result.stderr || result.stdout || '').trim()}`);
  const files = result.stdout.toString('utf8').split('\0').filter(Boolean);
  return new Map(files.map((relative) => {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return [relative, 'MISSING'];
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) return [relative, `LINK:${fs.readlinkSync(absolute)}`];
    if (!stat.isFile()) return [relative, `OTHER:${stat.mode}`];
    return [relative, crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')];
  }));
}

function changedSnapshotFiles(before, after) {
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((file) => before.get(file) !== after.get(file))
    .sort();
}

function assertExportDidNotModifySources(before, after) {
  const changed = changedSnapshotFiles(before, after);
  if (changed.length) {
    throw new Error(`export:fresh zmienił pliki źródłowe:\n- ${changed.join('\n- ')}\nZapisz wymagane aktualizacje przed ponownym prepush:local.`);
  }
}

function exportImpact(report) {
  return [...new Set([
    ...(report?.missing || []).map((entry) => entry.path),
    ...(report?.extra || []).map((entry) => entry.path),
    ...(report?.different || []).map((entry) => entry.path),
  ])].sort();
}

function assertExportProbeClean(report) {
  if (report.ok) return;
  const paths = exportImpact(report);
  throw new Error(`Eksport ujawnił różnice publiczne (${paths.length}):${paths.length ? `\n- ${paths.join('\n- ')}` : ' brak listy'}. Zaktualizuj jawny zakres publiczny i uruchom ponownie.`);
}

async function runPipelineChecks(classification, timings) {
  const pipelineFiles = [
    ...(classification.buckets?.pipeline || []),
    ...(classification.buckets?.export_probe || []),
    ...(classification.buckets?.news || []).filter((file) => file.startsWith('scripts/')),
  ];
  const testFiles = classification.testFiles || [];
  const controlledTests = new Set(['tests/prepush-concurrency.test.js', 'tests/prepush-release-guardrails.test.js', 'tests/release-scope.test.js', 'tests/publish-article-command.test.js']);
  const reusable = testFiles.filter((file) => controlledTests.has(file));
  const ordinary = testFiles.filter((file) => !controlledTests.has(file));
  if (reusable.length) {
    const modules = require('./lib/change-scope').MODULES;
    const code = [...new Set([...reusable, ...modules.filter((module) => module.tests.some((file) => reusable.includes(file))).flatMap((module) => module.files)])];
    timings.push(await runStep('pipeline:tests:controlled', 'node', ['--test', ...reusable], { receipt: {
      code, inputs: ['package.json', 'package-lock.json', 'scripts/config', 'tests/fixtures/change-scope-past-releases.json', '.github/workflows/live-postpush-check.yml', 'scripts/live-postpush-check.sh', '.githooks/pre-commit', '.githooks/pre-push', ...(reusable.includes('tests/prepush-concurrency.test.js') ? modules.flatMap((module) => [...module.files, ...module.tests]) : [])],
    } }));
  }
  if (ordinary.length) {
    timings.push(await runStep('pipeline:tests', 'node', ['--test', ...ordinary]));
  }
  const jsFiles = pipelineFiles
    .filter((file) => /^scripts\/.*\.js$/i.test(file));
  if (jsFiles.length) {
    const checks = await Promise.all(jsFiles.map((file) => runStep(`pipeline:syntax:${file}`, 'node', ['--check', file], { receipt: { code: ['scripts/run-all-prepush.js'], inputs: [file] } })));
    timings.push(...checks);
  }
  const shellFiles = pipelineFiles
    .filter((file) => /^scripts\/.*\.sh$/i.test(file));
  if (shellFiles.length) {
    const checks = await Promise.all(shellFiles.map((file) => runStep(`pipeline:shell:${file}`, 'bash', ['-n', file])));
    timings.push(...checks);
  }
}

async function main() {
  const started = Date.now();
  const timings = [];
  let exportWorkspace = '';
  let exportDir = '';
  let exportStatus = 'FAILED';
  console.log('Pre-push: start');

  try {
    const explicitFiles = require('./lib/change-scope').selectedFiles();
    let classification = assertResolvedScope(classifyChangedFiles(explicitFiles || collectChangedFiles()));
    process.env.FITPO50_CHANGED_FILES_JSON = JSON.stringify(explicitFiles || classification.files);
    console.log(`[PREPUSH:SCOPE] ${classification.scopes.join('+')} (${classification.files.length} plików)`);
    classification.reasons.forEach((item) => console.log(`[PREPUSH:WHY] ${item.file} -> ${item.scope}: ${item.reason}`));
    timings.push(await runStep('prepush:diff-guard', 'node', ['scripts/prepush-diff-guard.js']));
    if (classification.requiresExportProbe) {
      exportWorkspace = createManagedTempDir({ prefix: 'fitpo50-prepush-export-probe-', type: 'prepush-export-probe', projectRoot: process.cwd() });
      exportDir = path.join(exportWorkspace, 'site');
      const sourceSnapshotBeforeExport = repositorySnapshot();
      timings.push(await runStep('export:probe(tmp)', 'bash', ['./scripts/export_site.sh', exportDir], {
        env: { SKIP_TS_BUILD: '1' },
      }));
      assertExportDidNotModifySources(sourceSnapshotBeforeExport, repositorySnapshot());
      const probe = compareExportTrees(exportDir, path.resolve('_site'));
      assertExportProbeClean(probe);
      exportStatus = 'COMPLETED';
      classification = { ...classification, requiresExportProbe: false };
      console.log('[PREPUSH:IMPACT] eksport nie ujawnił różnic publicznych; zakres pozostaje pipeline.');
    }
    if (classification.full) {
      timings.push(await runStep('fitpo50:doctor', 'node', ['scripts/fitpo50-doctor.js', '--skip-release-overlaps']));
      const parallel = await Promise.all([
        runStep('prepush:parallel:checks', 'node', ['scripts/prepush-parallel-checks.js', '--worktree', '--all']),
        runStep('build', 'npm', ['run', 'build']),
      ]);
      timings.push(...parallel);
    } else {
      if (classification.scopes.includes('admin')) {
        timings.push(await runStep('admin:changed', 'node', [
          'scripts/run-admin-change-checks.js',
          ...(explicitFiles ? ['--files-json', JSON.stringify(explicitFiles)] : []),
        ]));
        timings.push(await runStep('security:exposure', 'node', ['scripts/security-exposure-check.js', 'https://fitpo50.pl']));
      }
      if (classification.scopes.includes('news')) {
        timings.push(await runStep('news:integrity', 'node', ['scripts/news-integrity-check.js']));
        timings.push(await runStep('assets:mirror:check', 'node', ['scripts/sync-site-assets-mirror.js', '--check']));
      }
      if (classification.scopes.includes('articles')) {
        if (classification.articleWide) {
          timings.push(await runStep('article:validate:all', 'node', ['scripts/validate-article-standard.js', '--profile', 'technical']));
        }
        const previous = !classification.articleWide && reusableArticleChecks(process.cwd(), explicitFiles || classification.files);
        const articleStep = (tag, script, args = []) => {
          if (!previous) return runStep(tag, 'node', [script, ...args]);
          console.log(`[REUSED] ${tag}: aktualny wynik stagingu HTML/PDF, zgodne dane, kod i konfiguracja.`);
          return Promise.resolve({ tag, status: 'REUSED', durationMs: 0 });
        };
        const articleChecks = await Promise.all([
          articleStep('article:guard:diff', 'scripts/run-article-guard-diff.js'),
          articleStep('article:contract:diff', 'scripts/run-article-contract-diff.js'),
          articleStep('schema:validate', 'scripts/schema-validator.js', ['--diff']),
          runStep('date:modified:guard', 'node', ['scripts/date-modified-guard.js']),
        ]);
        timings.push(...articleChecks);
      }
    }
    if (classification.testFiles.length || classification.buckets.pipeline.length || classification.buckets.export_probe.length) {
      await runPipelineChecks(classification, timings);
    }

    if (classification.full) {
      exportWorkspace = exportWorkspace || createManagedTempDir({ prefix: 'fitpo50-prepush-export-', type: 'prepush-export', projectRoot: process.cwd() });
      exportDir = path.join(exportWorkspace, 'site');
      const sourceSnapshotBeforeExport = repositorySnapshot();
      timings.push(await runStep('export:fresh(tmp)', 'bash', ['./scripts/export_site.sh', exportDir], {
        env: { SKIP_TS_BUILD: '1', FITPO50_SKIP_PREDEPLOY: '1' },
      }));
      assertExportDidNotModifySources(sourceSnapshotBeforeExport, repositorySnapshot());
      timings.push(await runStep('export:parity', 'node', [
        'scripts/export-parity-check.js',
        '--expected', exportDir,
        '--actual', path.resolve('_site'),
        '--report', path.resolve('data/reports/local/export-parity.json'),
      ]));
      timings.push(await runStep('smoke:static(fresh-export)', 'node', ['scripts/static-smoke-check.js', exportDir]));
      exportStatus = 'COMPLETED';
      timings.push(await runStep('tmp:cleanup:dry', 'node', ['scripts/tmp-cleanup.js', '--dry-run']));
    }
    if (exportWorkspace && !classification.full) {
      timings.push(await runStep('export:parity', 'node', [
        'scripts/export-parity-check.js',
        '--expected', exportDir,
        '--actual', path.resolve('_site'),
        '--report', path.resolve('data/reports/local/export-parity.json'),
      ]));
      timings.push(await runStep('smoke:static(fresh-export)', 'node', ['scripts/static-smoke-check.js', exportDir]));
      timings.push(await runStep('tmp:cleanup:dry', 'node', ['scripts/tmp-cleanup.js', '--dry-run']));
    }
  } finally {
    if (exportWorkspace) {
      disposeTempWorkspace(exportWorkspace, { status: exportStatus });
    }
  }

  const totalMs = Date.now() - started;
  const sec = (totalMs / 1000).toFixed(2);
  appendTimingReport('prepush-local', totalMs, timings);
  console.log(`Pre-push: OK (${sec}s)`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Pre-push: FAIL -> ${err.message || err}`);
    process.exit(1);
  });
}

module.exports = { assertExportDidNotModifySources, changedSnapshotFiles, repositorySnapshot, runStep };
