#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 30);
  return result.status;
}

run('node', ['scripts/deployment-live-verify.js', '--base-url', 'https://fitpo50.pl']);
const marker = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
const scopes = Array.isArray(marker.change_scope) ? marker.change_scope : ['full'];
if (scopes.includes('full') || scopes.includes('news')) run('node', ['scripts/news-public-http-check.js']);
else console.log('[SKIP] Publiczna kontrola NEWS: bieżące wydanie nie zmienia NEWS.');
run('node', ['scripts/security-exposure-check.js', 'https://fitpo50.pl']);
const liveReport = JSON.parse(fs.readFileSync('data/reports/local/deployment-live-status.json', 'utf8'));
const liveStatus = liveReport.status === 'CDN_REFRESH_PENDING' ? 'CDN_REFRESH_PENDING' : 'LIVE_DEPLOYED_AND_VALIDATED';
console.log(`[DEPLOYMENT_FINALIZED] ${liveStatus} + SECURITY_EXPOSURE_PASS.`);
console.log('[NEXT_ACTION] IndexNow jest osobnym krokiem: npm run indexnow:release');
