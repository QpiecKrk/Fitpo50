#!/usr/bin/env node

const { spawnSync } = require('child_process');

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function parseNameStatus(output) {
  return String(output || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      return { status: parts[0], file: parts[1] || '' };
    })
    .filter((x) => x.status === 'A')
    .map((x) => x.file);
}

function readChangedFiles() {
  const primary = run('git', ['diff', '--name-status', 'origin/main...HEAD']);
  if (primary.status === 0) {
    return parseNameStatus(primary.stdout);
  }

  // CI fallback: shallow/detached checkout often lacks origin/main.
  const fallback = run('git', ['diff', '--name-status', 'HEAD~1..HEAD']);
  if (fallback.status === 0) {
    return parseNameStatus(fallback.stdout);
  }

  const msg = String(primary.stderr || primary.stdout || fallback.stderr || fallback.stdout || '').trim();
  throw new Error(`Nie udało się odczytać diff (origin/main...HEAD ani HEAD~1..HEAD): ${msg}`);
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
