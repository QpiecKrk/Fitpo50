#!/usr/bin/env node

const fs = require('node:fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const path = require('node:path');
const { warsawIso } = require('./lib/time');

const SENSITIVE_PATHS = Object.freeze([
  '/README.md', '/DEPLOY.md', '/SEO_AIO_PLAYBOOK.md',
  '/ARTICLE_STANDARD.md', '/PROJECT_MEMORY.md', '/AGENTS.md', '/package.json', '/package-lock.json',
  '/requirements-dev.txt', '/requirements-pdf.txt', '/.gitignore', '/tool.py',
  '/.cursorrules', '/.editorconfig', '/.github/workflows/assets-hygiene.yml', '/.githooks/pre-push',
  '/scripts/export_site.sh', '/tests/deployment-safety.test.js', '/docs/command-registry.md',
  '/.venv/bin/python', '/__pycache__/module.pyc', '/admin/CHANGELOG.md', '/data/entities.json', '/_site/index.html',
  '/.env', '/.env.local', '/admin/config.php', '/admin/database.sqlite', '/_site/admin/database.sqlite',
  '/article-template-bento.html', '/admin/init-db.php', '/admin/init-hash.php',
]);

const ADMIN_SENSITIVE_PATHS = Object.freeze([
  '/CHANGELOG.md', '/deploy-notes.md', '/init-db.php', '/init-hash.php',
  '/.cursorrules', '/.editorconfig', '/.github/workflows/assets-hygiene.yml', '/.githooks/pre-push',
]);

function classifyExposureResponse(status) {
  const code = Number(status || 0);
  if ([403, 404, 410].includes(code)) return 'PROTECTED';
  if (code >= 200 && code < 400) return 'EXPOSED';
  return 'INCONCLUSIVE';
}

async function fetchStatus(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: 'manual', cache: 'no-store', headers: { 'user-agent': 'FitPo50-Security-Exposure-Check/1.0' }, signal: controller.signal });
    return { status: response.status, result: classifyExposureResponse(response.status) };
  } catch (error) {
    return { status: 0, result: 'INCONCLUSIVE', error: String(error.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const baseUrl = String(process.argv[2] || 'https://fitpo50.pl').replace(/\/$/, '');
  const adminBaseUrl = String(process.argv[3] || 'https://admin.fitpo50.pl').replace(/\/$/, '');
  const marker = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
  const targets = [
    ...SENSITIVE_PATHS.map((pathname) => ({ host: 'site', pathname, url: `${baseUrl}${pathname}` })),
    ...ADMIN_SENSITIVE_PATHS.map((pathname) => ({ host: 'admin', pathname, url: `${adminBaseUrl}${pathname}` })),
  ];
  const checks = await Promise.all(targets.map(async (target) => ({ ...target, ...await fetchStatus(target.url, 15000) })));
  const exposed = checks.filter((item) => item.result === 'EXPOSED');
  const inconclusive = checks.filter((item) => item.result === 'INCONCLUSIVE');
  const status = exposed.length ? 'SECURITY_EXPOSURE_BLOCKED' : (inconclusive.length ? 'SECURITY_EXPOSURE_INCONCLUSIVE' : 'SECURITY_EXPOSURE_PASS');
  const report = { version: 1, status, release_id: marker.release_id, checked_at: warsawIso(), checks, exposed: exposed.map((item) => item.pathname) };
  const file = path.join('data', 'reports', 'local', 'security-exposure-status.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  atomicWriteFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[${status}] release=${marker.release_id}`);
  exposed.forEach((item) => console.error(`[EXPOSED] ${item.url} HTTP ${item.status}`));
  inconclusive.forEach((item) => console.error(`[INCONCLUSIVE] ${item.url} ${item.error || `HTTP ${item.status}`}`));
  if (exposed.length) process.exit(20);
  if (inconclusive.length) process.exit(30);
}

if (require.main === module) main().catch((error) => { console.error(`[SECURITY][FAIL] ${error.message || error}`); process.exit(30); });

module.exports = { ADMIN_SENSITIVE_PATHS, SENSITIVE_PATHS, classifyExposureResponse, fetchStatus };
