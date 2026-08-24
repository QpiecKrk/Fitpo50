#!/usr/bin/env node

const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
if (!args.includes('--file')) {
  console.error('Użycie: node scripts/article-fast-gate.js --file <CONTENT_READY.fitpo50.json> --assets-dir <dir>');
  process.exit(1);
}
console.log('[FAST-GATE] Korzystam z kanonicznego read-only article-ready-check.');
const result = spawnSync('node', ['scripts/article-ready-check.js', ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
});
if (result.error) {
  console.error(`[FAIL] article-fast-gate -> ${result.error.message || result.error}`);
  process.exit(1);
}
process.exit(Number(result.status || 0));
