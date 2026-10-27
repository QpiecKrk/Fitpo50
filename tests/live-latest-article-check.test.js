'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'live-latest-article-check.js');

function runLiveCheck(allowNetFailures) {
  const env = { ...process.env };
  delete env.ALLOW_NET_FAILURES;
  if (allowNetFailures !== undefined) env.ALLOW_NET_FAILURES = allowNetFailures;
  return spawnSync(process.execPath, [
    SCRIPT,
    '--base-url', 'http://127.0.0.1:1',
    '--retries', '0',
    '--delay-ms', '0',
    '--timeout-ms', '1000',
  ], { cwd: ROOT, env, encoding: 'utf8' });
}

function checkIgnored(file) {
  return spawnSync('git', ['check-ignore', '-q', '--no-index', file], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('network failure is an environment failure by default', () => {
  const result = runLiveCheck();
  assert.equal(result.status, 30, result.stdout + result.stderr);
  assert.match(result.stderr, /ENVIRONMENT_FAILURE/);
});

test('explicit diagnostic network bypass exits zero with an unambiguous warning', () => {
  const result = runLiveCheck('1');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /NETWORK_FAILURE_BYPASSED_DIAGNOSTIC_ONLY/);
  assert.match(result.stdout + result.stderr, /nie potwierdza produkcji/i);
});

test('only the exact value 1 enables diagnostic network bypass', () => {
  const result = runLiveCheck('true');
  assert.equal(result.status, 30, result.stdout + result.stderr);
});

test('private environment, config, key and backup file names are ignored', () => {
  for (const file of [
    '.env.production',
    'config.local.php',
    'klucz.pem',
    'x.key',
    'dump.sql.gz',
    'dump.sql.zip',
    'baza.dump',
    'plik.bak',
  ]) {
    assert.equal(checkIgnored(file).status, 0, `${file} should be ignored`);
  }
});

test('public examples and SQL schema remain eligible for tracking', () => {
  for (const file of [
    '.env.example',
    'admin/config.example.php',
    '_site/admin/config.example.php',
    'docs/admin-schema.sql',
  ]) {
    assert.equal(checkIgnored(file).status, 1, `${file} should not be ignored`);
  }
});
