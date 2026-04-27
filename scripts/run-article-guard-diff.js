#!/usr/bin/env node

const { spawnSync } = require('child_process');

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function readChangedFiles() {
  const diff = run('git', ['diff', '--name-only', 'origin/main...HEAD']);
  if (diff.status !== 0) {
    const msg = String(diff.stderr || diff.stdout || '').trim();
    throw new Error(`Nie udało się odczytać diff origin/main...HEAD: ${msg}`);
  }
  return String(diff.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const changed = readChangedFiles();
  const args = ['scripts/article-publish-guard.js'];
  for (const f of changed) {
    args.push('--changed', f);
  }

  const res = run('node', args);
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  process.exit(res.status || 0);
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] article:guard:diff -> ${err.message || err}`);
  process.exit(1);
}

