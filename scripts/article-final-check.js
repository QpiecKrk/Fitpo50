#!/usr/bin/env node

const { spawnSync } = require('child_process');

function main() {
  const forwarded = process.argv.slice(2);
  if (!forwarded.includes('--file')) {
    console.error('Użycie: node scripts/article-final-check.js --file <CONTENT_READY.fitpo50.json> [--assets-dir <dir>] [--category zdrowie] [--force true|false]');
    process.exit(1);
  }
  console.log('[FINAL-CHECK] Publikacja korzysta z jednego chronionego pipeline; JSON nie będzie automatycznie poprawiany.');
  const result = spawnSync('node', ['scripts/article-pipeline.js', ...forwarded], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exit(Number(result.status || 0));
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] article-final-check -> ${err.message || err}`);
  process.exit(1);
}
