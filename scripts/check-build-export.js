#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function run(label, cmd, args, opts = {}) {
  console.log(`\n[CHECK-BUILD-EXPORT] ${label}`);
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    throw new Error(`${label} failed (exit ${res.status ?? 'unknown'})`);
  }
}

function rmSafe(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

function main() {
  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-export-check-'));
  try {
    run('TypeScript build', 'npm', ['run', 'build']);
    run('Static export', 'bash', ['./scripts/export_site.sh', exportDir], {
      env: { ...process.env, SKIP_TS_BUILD: '1' },
    });
    run('Smoke check', 'node', ['scripts/static-smoke-check.js', exportDir]);
    run('Broken links crawl', 'node', ['scripts/broken-links-crawler.js', exportDir]);
    console.log(`\n[PASS] check-build-export OK (${exportDir})`);
  } finally {
    rmSafe(exportDir);
    console.log('[CLEANUP] Removed temporary export directory.');
  }
}

try {
  main();
} catch (err) {
  console.error(`\n[FAIL] ${err.message || err}`);
  process.exit(1);
}
