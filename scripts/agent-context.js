#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { inspectGscInput } = require('./lib/gsc-data-contract');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const MD_PATH = path.join(REPORT_DIR, 'agent-context.md');
const JSON_PATH = path.join(REPORT_DIR, 'agent-context.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return {
    ok: res.status === 0,
    status: res.status,
    stdout: String(res.stdout || '').trim(),
    stderr: String(res.stderr || '').trim(),
  };
}

function listFiles(dir, limit = 12) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const abs = path.join(dir, entry.name);
      const st = fs.statSync(abs);
      return { name: entry.name, path: path.relative(ROOT, abs), mtimeMs: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit);
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const now = new Date().toISOString();
  const status = run('git', ['status', '--short']).stdout.split('\n').filter(Boolean);
  const lastCommit = run('git', ['log', '-1', '--oneline']).stdout;
  const branch = run('git', ['branch', '--show-current']).stdout;
  const gscDir = path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
  const gscFiles = ['queries.csv', 'pages.csv', 'query-pages.csv'].map((name) => ({
    name,
    exists: fs.existsSync(path.join(gscDir, name)),
  }));
  const gscDataContract = inspectGscInput(gscDir, { strictPeriods: true });
  const sensitiveSiteFiles = [
    '_site/admin/config.php',
    '_site/admin/init-db.php',
    '_site/admin/init-hash.php',
  ].filter(exists);
  const activeImportFiles = fs.existsSync(path.join(ROOT, 'data', 'import'))
    ? fs.readdirSync(path.join(ROOT, 'data', 'import')).filter((name) => /\.json$/i.test(name)).sort()
    : [];
  const recentReports = listFiles(REPORT_DIR, 10);

  const context = {
    generated_at: now,
    branch,
    last_commit: lastCommit,
    git_dirty_count: status.length,
    git_status: status,
    sensitive_site_files: sensitiveSiteFiles,
    gsc_work_dir: gscDir,
    gsc_files: gscFiles,
    gsc_data_contract: gscDataContract,
    active_import_files: activeImportFiles,
    recent_reports: recentReports,
    key_commands: {
      start: 'npm run session:start',
      doctor: 'npm run fitpo50:doctor',
      push_check: 'npm run prepush:local',
      export: './scripts/export_site.sh',
      gsc: 'npm run gsc:auto',
      article_publish: 'npm run article:publish --file=/path/to/file.fitpo50.json',
    },
  };

  const md = [
    '# Agent Context',
    '',
    `- Generated: ${now}`,
    `- Branch: ${branch || 'unknown'}`,
    `- Last commit: ${lastCommit || 'unknown'}`,
    `- Dirty files: ${status.length}`,
    '',
    '## Git Status',
    status.length ? status.map((line) => `- ${line}`).join('\n') : '- clean',
    '',
    '## Safety Signals',
    sensitiveSiteFiles.length ? sensitiveSiteFiles.map((file) => `- RED: ${file}`).join('\n') : '- `_site/admin` has no config/init files',
    '',
    '## GSC Input',
    gscFiles.map((file) => `- ${file.name}: ${file.exists ? 'OK' : 'MISSING'}`).join('\n'),
    `- Data contract: ${gscDataContract.status}`,
    `- Freshness: ${gscDataContract.freshness.status}; age ${gscDataContract.freshness.age_hours ?? 'UNKNOWN'} h`,
    `- Periods 7/28/90: ${gscDataContract.periods.status}`,
    `- Cohort: ${gscDataContract.cohort.status}`,
    ...(gscDataContract.errors || []).map((item) => `- BLOCKER: ${item}`),
    '',
    '## Active Import JSON',
    activeImportFiles.length ? activeImportFiles.map((name) => `- ${name}`).join('\n') : '- none',
    '',
    '## Recent Reports',
    recentReports.length ? recentReports.map((file) => `- ${file.path}`).join('\n') : '- none',
    '',
    '## Key Commands',
    Object.entries(context.key_commands).map(([key, value]) => `- ${key}: \`${value}\``).join('\n'),
    '',
  ].join('\n');

  fs.writeFileSync(JSON_PATH, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MD_PATH, md, 'utf8');
  console.log(`[PASS] agent-context written: ${path.relative(ROOT, MD_PATH)}, ${path.relative(ROOT, JSON_PATH)}`);
}

main();
