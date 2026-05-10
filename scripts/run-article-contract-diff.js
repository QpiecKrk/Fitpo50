#!/usr/bin/env node

const { spawnSync } = require('child_process');

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function changedHtmlFiles() {
  const primary = run('git', ['diff', '--name-status', 'origin/main...HEAD']);
  const out = primary.status === 0 ? primary.stdout : run('git', ['diff', '--name-status', 'HEAD~1..HEAD']).stdout;
  const files = String(out || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = String(parts[0] || '');
      const file = status.startsWith('R') || status.startsWith('C') ? parts[2] : parts[1];
      return { status, file };
    })
    .filter((x) => x.file && !String(x.status).startsWith('D'))
    .map((x) => x.file)
    .filter((f) => f.endsWith('.html') && !f.startsWith('admin/'));
  return [...new Set(files)];
}

function main() {
  const files = changedHtmlFiles();
  if (!files.length) {
    console.log('[SKIP] article-contract-diff: brak zmienionych plików HTML.');
    return;
  }
  const res = spawnSync('node', ['scripts/article-contract-check.js', ...files], { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}

main();
