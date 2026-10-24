#!/usr/bin/env node

const fs = require('node:fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const path = require('node:path');
const { submitIndexNow } = require('./lib/indexnow-client');
const { STATUS } = require('./lib/external-integration-status');
const { warsawIso } = require('./lib/time');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

async function main() {
  const marker = readJson('deployment.json');
  const live = readJson(path.join('data', 'reports', 'local', 'deployment-live-status.json'));
  const security = readJson(path.join('data', 'reports', 'local', 'security-exposure-status.json'));
  if (live.status !== 'LIVE_DEPLOYED_AND_VALIDATED' || live.release_id !== marker.release_id) {
    console.error('[INDEXNOW BLOCKED] Bieżące wydanie nie ma statusu LIVE_DEPLOYED_AND_VALIDATED.');
    process.exit(20);
  }
  if (security.status !== 'SECURITY_EXPOSURE_PASS' || security.release_id !== marker.release_id) {
    console.error('[INDEXNOW BLOCKED] Bieżące wydanie nie ma statusu SECURITY_EXPOSURE_PASS.');
    process.exit(20);
  }
  const urls = [...new Set((marker.articles || []).map((article) => article.url).filter(Boolean))];
  if (!urls.length) {
    console.log('[INDEXNOW] Brak zmienionych artykułów w tym wydaniu.');
    return;
  }
  const evidenceDir = path.join('data', 'reports', 'local', 'indexnow');
  const evidenceFile = path.join(evidenceDir, `${marker.release_id}.json`);
  if (fs.existsSync(evidenceFile)) {
    const previous = readJson(evidenceFile);
    if (previous.status === STATUS.OK_VERIFIED && JSON.stringify(previous.url_list) === JSON.stringify(urls)) {
      console.log(`[INDEXNOW] Wydanie ${marker.release_id} zostało już zgłoszone; pomijam duplikat.`);
      return;
    }
  }
  const key = String(process.env.INDEXNOW_KEY || '').trim();
  if (!key) {
    console.error('[INDEXNOW][FAIL] Brak INDEXNOW_KEY.');
    process.exit(30);
  }
  const result = await submitIndexNow({ host: 'fitpo50.pl', key, keyLocation: String(process.env.INDEXNOW_KEY_LOCATION || '').trim() || undefined, urlList: urls });
  fs.mkdirSync(evidenceDir, { recursive: true });
  atomicWriteFileSync(evidenceFile, `${JSON.stringify({ ...result, release_id: marker.release_id, url_list: urls, submitted_at: warsawIso() }, null, 2)}\n`, 'utf8');
  console.log(`[INDEXNOW] ${result.status} release=${marker.release_id} urls=${urls.length}`);
  if (result.status !== STATUS.OK_VERIFIED) process.exit(30);
}

if (require.main === module) main().catch((error) => { console.error(`[INDEXNOW][FAIL] ${error.message || error}`); process.exit(30); });
