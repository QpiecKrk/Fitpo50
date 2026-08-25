#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { inspectGscInput } = require('./lib/gsc-data-contract');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const MD_PATH = path.join(REPORT_DIR, 'fitpo50-doctor.md');
const JSON_PATH = path.join(REPORT_DIR, 'fitpo50-doctor.json');

function run(cmd, args) {
  const started = Date.now();
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return {
    ok: res.status === 0,
    status: res.status,
    duration_ms: Date.now() - started,
    stdout: String(res.stdout || '').trim(),
    stderr: String(res.stderr || '').trim(),
  };
}

function check(label, level, ok, details = '') {
  return { label, level, ok, details: String(details || '').trim() };
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).length;
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const now = new Date().toISOString();
  const checks = [];

  const gitStatus = run('git', ['status', '--short']);
  const dirtyLines = gitStatus.stdout.split('\n').filter(Boolean);
  checks.push(check('Git status', 'warn', dirtyLines.length === 0, dirtyLines.length ? `${dirtyLines.length} changed files` : 'clean'));

  const secretTracked = run('git', ['ls-files', 'admin/config.php', '_site/admin/config.php', '_site/admin/init-db.php', '_site/admin/init-hash.php']);
  checks.push(check('Tracked private admin files', 'red', !secretTracked.stdout, secretTracked.stdout || 'none'));

  const sensitiveSiteFiles = ['_site/admin/config.php', '_site/admin/init-db.php', '_site/admin/init-hash.php'].filter(exists);
  checks.push(check('Private files in _site/admin', 'red', sensitiveSiteFiles.length === 0, sensitiveSiteFiles.join('\n') || 'none'));

  const llmsTracked = run('git', ['ls-files', 'llms-full.txt', '_site/llms-full.txt']);
  checks.push(check('Tracked llms-full artifacts', 'warn', !llmsTracked.stdout, llmsTracked.stdout || 'none'));

  const mirrorCheck = run('npm', ['run', 'assets:mirror:check']);
  checks.push(check('Assets mirror check', 'red', mirrorCheck.ok, mirrorCheck.ok ? 'PASS' : (mirrorCheck.stderr || mirrorCheck.stdout)));

  const predeploy = run('npm', ['run', 'predeploy:check']);
  checks.push(check('Predeploy check', 'red', predeploy.ok, predeploy.ok ? 'PASS' : (predeploy.stderr || predeploy.stdout)));

  const adminDoctor = run('node', ['scripts/admin-doctor.js']);
  checks.push(check('Admin doctor', 'red', adminDoctor.ok, adminDoctor.ok ? 'PASS' : (adminDoctor.stderr || adminDoctor.stdout)));

  const gscDir = path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
  const gscMissing = ['queries.csv', 'pages.csv', 'query-pages.csv'].filter((name) => !fs.existsSync(path.join(gscDir, name)));
  checks.push(check('GSC input files', 'warn', gscMissing.length === 0, gscMissing.length ? `missing: ${gscMissing.join(', ')}` : 'OK'));
  const gscContract = inspectGscInput(gscDir, { strictPeriods: true });
  checks.push(check(
    'GSC data contract',
    'warn',
    !gscContract.blocking,
    gscContract.blocking
      ? gscContract.errors.join(' | ')
      : `${gscContract.status}; age=${gscContract.freshness.age_hours}h; periods=${gscContract.periods.status}; cohort=${gscContract.cohort.status}`,
  ));

  const activeImports = countFiles(path.join(ROOT, 'data', 'import'));
  checks.push(check('Active data/import files', 'warn', activeImports === 0, activeImports ? `${activeImports} active import files` : 'none'));

  const reportCount = countFiles(REPORT_DIR);
  checks.push(check('Report count', 'warn', reportCount < 40, `${reportCount} files in data/reports`));

  const pruneDry = run('node', ['scripts/reports-prune.js', '--dry-run']);
  const pruneMatch = pruneDry.stdout.match(/candidates=(\d+)/);
  const pruneCandidates = pruneMatch ? Number(pruneMatch[1]) : 0;
  checks.push(check(
    'Reports prune candidates',
    'warn',
    pruneDry.ok && pruneCandidates === 0,
    pruneDry.ok ? `${pruneCandidates} old safe-report files` : (pruneDry.stderr || pruneDry.stdout)
  ));

  const red = checks.filter((item) => item.level === 'red' && !item.ok);
  const warn = checks.filter((item) => item.level === 'warn' && !item.ok);
  const status = red.length ? 'RED' : warn.length ? 'YELLOW' : 'GREEN';
  const payload = { generated_at: now, status, checks };

  const icon = (item) => item.ok ? '✅' : item.level === 'red' ? '🔴' : '🟡';
  const md = [
    '# FitPo50 Doctor',
    '',
    `- Generated: ${now}`,
    `- Status: ${status}`,
    '',
    '## Checks',
    ...checks.map((item) => `- ${icon(item)} ${item.label}: ${item.details || (item.ok ? 'OK' : 'problem')}`),
    '',
    '## Meaning',
    '- GREEN: można pracować normalnie.',
    '- YELLOW: można pracować, ale warto przeczytać ostrzeżenia.',
    '- RED: nie pushować/deployować bez naprawy.',
    '',
  ].join('\n');

  fs.writeFileSync(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MD_PATH, md, 'utf8');
  console.log(`[${status}] fitpo50:doctor -> ${path.relative(ROOT, MD_PATH)}`);
  if (red.length) process.exit(1);
}

main();
