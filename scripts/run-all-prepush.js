#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const crypto = require('crypto');
const path = require('path');
const { createManagedTempDir, disposeTempWorkspace } = require('./lib/temp-workspace');
const { warsawIso } = require('./lib/time');
const { classifyChangedFiles, collectChangedFiles } = require('./lib/change-scope');

function prefixOutput(tag, stream, logger) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => logger(`[${tag}] ${line}`));
}

function runStep(tag, cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    prefixOutput(tag, child.stdout, console.log);
    prefixOutput(tag, child.stderr, console.error);
    child.on('error', (err) => reject(new Error(`${tag}: ${err.message || err}`)));
    child.on('close', (code) => {
      const durationMs = Date.now() - started;
      if (code !== 0) reject(new Error(`${tag}: exit ${code ?? 'unknown'}`));
      else resolve({ tag, durationMs });
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

async function main() {
  const started = Date.now();
  const timings = [];
  let exportWorkspace = '';
  let exportDir = '';
  let exportStatus = 'FAILED';
  console.log('Pre-push: start');

  try {
    timings.push(await runStep('prepush:diff-guard', 'node', ['scripts/prepush-diff-guard.js']));
    const fileArgIndex = process.argv.indexOf('--files-json');
    const explicitFiles = fileArgIndex >= 0 ? JSON.parse(process.argv[fileArgIndex + 1] || '[]') : null;
    const classification = classifyChangedFiles(explicitFiles || collectChangedFiles());
    console.log(`[PREPUSH:SCOPE] ${classification.scopes.join('+')} (${classification.files.length} plików)`);
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
        timings.push(await runStep('news:tests', 'node', ['--test', 'tests/news-public-integrity.test.js', 'tests/news-deploy-sync-gate.test.js']));
      }
      if (classification.scopes.includes('articles')) {
        const articleChecks = await Promise.all([
          runStep('article:guard:diff', 'node', ['scripts/run-article-guard-diff.js']),
          runStep('article:contract:diff', 'node', ['scripts/run-article-contract-diff.js']),
          runStep('schema:validate', 'node', ['scripts/schema-validator.js', '--diff']),
          runStep('date:modified:guard', 'node', ['scripts/date-modified-guard.js']),
        ]);
        timings.push(...articleChecks);
      }
    }

    if (classification.full) {
      exportWorkspace = createManagedTempDir({ prefix: 'fitpo50-prepush-export-', type: 'prepush-export', projectRoot: process.cwd() });
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

module.exports = { assertExportDidNotModifySources, changedSnapshotFiles, repositorySnapshot };
