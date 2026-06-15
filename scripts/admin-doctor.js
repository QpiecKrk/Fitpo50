#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const MD_PATH = path.join(REPORT_DIR, 'admin-doctor.md');
const JSON_PATH = path.join(REPORT_DIR, 'admin-doctor.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return {
    ok: res.status === 0,
    status: res.status,
    stdout: String(res.stdout || '').trim(),
    stderr: String(res.stderr || '').trim(),
  };
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function read(relPath) {
  return fs.existsSync(path.join(ROOT, relPath)) ? fs.readFileSync(path.join(ROOT, relPath), 'utf8') : '';
}

function check(label, level, ok, details = '') {
  return { label, level, ok, details: String(details || '').trim() };
}

function collectPhpFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (rel.startsWith('admin/uploads')) continue;
        stack.push(abs);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.php') && rel !== 'admin/config.php') out.push(rel);
    }
  }
  return out.sort();
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const now = new Date().toISOString();
  const checks = [];

  const trackedPrivate = run('git', ['ls-files', 'admin/config.php', '_site/admin/config.php', '_site/admin/init-db.php', '_site/admin/init-hash.php']);
  checks.push(check('Tracked private admin files', 'red', !trackedPrivate.stdout, trackedPrivate.stdout || 'none'));

  const sitePrivate = ['_site/admin/config.php', '_site/admin/init-db.php', '_site/admin/init-hash.php'].filter(exists);
  checks.push(check('Private files in _site/admin', 'red', sitePrivate.length === 0, sitePrivate.join('\n') || 'none'));

  checks.push(check('Config example exists', 'red', exists('admin/config.example.php'), exists('admin/config.example.php') ? 'admin/config.example.php' : 'missing'));
  checks.push(check('Local config ignored', 'warn', exists('admin/config.php'), exists('admin/config.php') ? 'local file exists and should stay ignored' : 'missing local admin/config.php'));

  const htaccess = read('admin/.htaccess');
  const cspDirectives = ['Content-Security-Policy', "default-src 'self'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'"];
  const missingCsp = cspDirectives.filter((needle) => !htaccess.includes(needle));
  checks.push(check('Admin CSP directives', 'red', missingCsp.length === 0, missingCsp.length ? `missing: ${missingCsp.join(', ')}` : 'OK'));

  const auth = read('admin/auth.php');
  const login = read('admin/login.php');
  const ratePieces = ['function isRateLimited', 'function recordFailedLogin', 'function clearFailedLogins'];
  const missingRate = ratePieces.filter((needle) => !auth.includes(needle));
  if (!/isRateLimited\(\$ip\)/.test(login)) missingRate.push('login.php uses isRateLimited($ip)');
  if (!/recordFailedLogin\(\$ip\)/.test(login)) missingRate.push('login.php uses recordFailedLogin($ip)');
  checks.push(check('Login rate limiting wiring', 'red', missingRate.length === 0, missingRate.length ? `missing: ${missingRate.join(', ')}` : 'OK'));

  const phpFiles = collectPhpFiles(path.join(ROOT, 'admin'));
  const lintFailures = [];
  for (const file of phpFiles) {
    const res = run('php', ['-l', file]);
    if (!res.ok) lintFailures.push(`${file}: ${res.stderr || res.stdout}`);
  }
  checks.push(check('PHP lint admin files', 'red', lintFailures.length === 0, lintFailures.length ? lintFailures.slice(0, 8).join('\n') : `${phpFiles.length} files OK`));

  const red = checks.filter((item) => item.level === 'red' && !item.ok);
  const warn = checks.filter((item) => item.level === 'warn' && !item.ok);
  const status = red.length ? 'RED' : warn.length ? 'YELLOW' : 'GREEN';
  const payload = { generated_at: now, status, checks };
  const icon = (item) => item.ok ? '✅' : item.level === 'red' ? '🔴' : '🟡';
  const md = [
    '# Admin Doctor',
    '',
    `- Generated: ${now}`,
    `- Status: ${status}`,
    '',
    '## Checks',
    ...checks.map((item) => `- ${icon(item)} ${item.label}: ${item.details || (item.ok ? 'OK' : 'problem')}`),
    '',
  ].join('\n');

  fs.writeFileSync(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MD_PATH, md, 'utf8');
  console.log(`[${status}] admin-doctor -> ${path.relative(ROOT, MD_PATH)}`);
  if (red.length) process.exit(1);
}

main();
