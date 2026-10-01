const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const { STATUS, classifyExternalError, redactSecrets } = require('../scripts/lib/external-integration-status');
const { submitIndexNow } = require('../scripts/lib/indexnow-client');
const { publicAttempts } = require('../scripts/gsc-weekly-api-report');

const ROOT = path.resolve(__dirname, '..');

function fakeRequest(statusCode) {
  return (_url, _options, callback) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.destroy = () => {};
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = statusCode;
      callback(res);
      res.emit('end');
    };
    return req;
  };
}

test('external auth failures are classified by credential and access cause', () => {
  assert.equal(classifyExternalError('invalid_client: bad client secret').reason, 'OAUTH_CLIENT_INVALID');
  assert.equal(classifyExternalError('invalid_grant: refresh token revoked').reason, 'OAUTH_REFRESH_TOKEN_INVALID');
  assert.equal(classifyExternalError('error:0909006C:PEM routines', { authMode: 'service_account' }).reason, 'SERVICE_ACCOUNT_KEY_INVALID');
  assert.equal(
    classifyExternalError('User does not have access to this Search Console property', { authMode: 'service_account' }).reason,
    'SERVICE_ACCOUNT_PROPERTY_ACCESS_DENIED',
  );
});

test('secret values are redacted from diagnostics', () => {
  const secret = 'top-secret-refresh-token';
  assert.doesNotMatch(redactSecrets(`invalid_grant ${secret}`, [secret]), new RegExp(secret));
  assert.match(redactSecrets(`invalid_grant ${secret}`, [secret]), /REDACTED/);
});

test('successful fallback retains a redacted reason for the rejected auth mode', () => {
  const secret = 'oauth-secret-value';
  const previous = process.env.GSC_OAUTH_CLIENT_SECRET;
  process.env.GSC_OAUTH_CLIENT_SECRET = secret;
  try {
    const attempts = publicAttempts([{
      auth_mode: 'service_account',
      status: STATUS.AUTH_FAILED,
      reason: 'SERVICE_ACCOUNT_PROPERTY_ACCESS_DENIED',
      message: `permission denied ${secret}`,
    }]);
    assert.equal(attempts[0].reason, 'SERVICE_ACCOUNT_PROPERTY_ACCESS_DENIED');
    assert.doesNotMatch(JSON.stringify(attempts), new RegExp(secret));
  } finally {
    if (previous === undefined) delete process.env.GSC_OAUTH_CLIENT_SECRET;
    else process.env.GSC_OAUTH_CLIENT_SECRET = previous;
  }
});

test('IndexNow produces verifiable evidence without key or response body', async () => {
  const result = await submitIndexNow({
    host: 'fitpo50.pl',
    key: 'private-indexnow-key',
    keyLocation: 'https://fitpo50.pl/private-indexnow-key.txt',
    urlList: ['https://fitpo50.pl/test.html'],
    request: fakeRequest(202),
  });
  assert.equal(result.status, STATUS.OK_VERIFIED);
  assert.equal(result.http_status, 202);
  assert.equal(result.url_count, 1);
  assert.equal(result.url_list_sha256.length, 64);
  assert.equal(result.response_valid, true);
  assert.doesNotMatch(JSON.stringify(result), /private-indexnow-key/);
});

test('IndexNow distinguishes explicit skip, missing config and request rejection', async () => {
  assert.equal((await submitIndexNow({ enabled: false, urlList: [] })).status, STATUS.SKIPPED_EXPLICITLY);
  assert.equal((await submitIndexNow({ host: 'fitpo50.pl', urlList: ['https://fitpo50.pl/a'] })).status, STATUS.MISSING_CONFIG);
  assert.equal((await submitIndexNow({ host: 'fitpo50.pl', key: 'secret-key', urlList: ['https://fitpo50.pl/a'], request: fakeRequest(403) })).status, STATUS.REQUEST_FAILED);
});

test('malformed service account fails generator and creates diagnostic only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-gsc-auth-fail-'));
  const outputJson = path.join(dir, 'report.json');
  const outputMd = path.join(dir, 'report.md');
  const csvDir = path.join(dir, 'csv');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GSC_')));
  Object.assign(env, {
    GSC_SITE_URL: 'sc-domain:fitpo50.pl',
    GSC_SERVICE_ACCOUNT_JSON: '{"client_email":"broken"}',
  });
  const result = spawnSync('node', [
    'scripts/gsc-weekly-api-report.js',
    '--output-json', outputJson,
    '--output-md', outputMd,
    '--output-csv-dir', csvDir,
  ], { cwd: ROOT, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(outputJson, 'utf8'));
  assert.equal(report.report_kind, 'DIAGNOSTIC');
  assert.equal(report.status, STATUS.AUTH_FAILED);
  assert.equal(report.attempts[0].reason, 'SERVICE_ACCOUNT_KEY_INVALID');
  assert.equal(fs.existsSync(path.join(csvDir, 'queries.csv')), false);
  assert.equal(fs.existsSync(path.join(csvDir, 'gsc-data-manifest.json')), false);
  assert.match(fs.readFileSync(outputMd, 'utf8'), /to nie jest raport danych GSC/i);
});

test('status gate accepts only an OK_VERIFIED DATASET', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-gsc-status-'));
  const reportPath = path.join(dir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ status: STATUS.AUTH_FAILED, report_kind: 'DIAGNOSTIC' }));
  let result = spawnSync('node', ['scripts/gsc-report-status-check.js', reportPath], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  fs.writeFileSync(reportPath, JSON.stringify({ status: STATUS.OK_VERIFIED, report_kind: 'DATASET', auth_mode: 'oauth_refresh_token' }));
  result = spawnSync('node', ['scripts/gsc-report-status-check.js', reportPath], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('workflow gates issue updates and artifact upload behind verified status and data contract', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/gsc-weekly-reminder.yml'), 'utf8');
  const statusGate = workflow.indexOf('Require verified GSC dataset status');
  const contractGate = workflow.indexOf('Validate fresh and coherent GSC dataset');
  const upload = workflow.indexOf('Upload GSC CSV artifact');
  const issue = workflow.indexOf('Open or update weekly reminder issue');
  assert.ok(statusGate > workflow.indexOf('Generate weekly GSC API report'));
  assert.ok(contractGate > statusGate);
  assert.ok(upload > contractGate);
  assert.ok(issue > contractGate);
});
