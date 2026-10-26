#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 30);
}

run('node', ['scripts/deployment-live-verify.js', '--base-url', 'https://fitpo50.pl']);
run('node', ['scripts/news-public-http-check.js']);
run('node', ['scripts/security-exposure-check.js', 'https://fitpo50.pl']);
console.log('[DEPLOYMENT_FINALIZED] LIVE_DEPLOYED_AND_VALIDATED + SECURITY_EXPOSURE_PASS.');
console.log('[NEXT_ACTION] IndexNow jest osobnym krokiem: npm run indexnow:release');
