'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectWithCredentialFallback } = require('../scripts/gsc-indexing-watchdog');
const { isRuntimeNewsThumb } = require('../scripts/sync-site-assets-mirror');

test('runtime NEWS thumbnails ignored by Git do not enter the mirror contract', () => {
  assert.equal(isRuntimeNewsThumb('news_20260625_143840_68617897'), true);
  assert.equal(isRuntimeNewsThumb('news_20250101_runtime'), true);
  assert.equal(isRuntimeNewsThumb('news_coffee_minerals_01'), false);
});

test('URL Inspection falls back from an unusable service account to OAuth', async () => {
  const calls = [];
  const result = await inspectWithCredentialFallback({
    token: 'service-token',
    authMode: 'service_account',
    oauth: { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' },
    siteUrl: 'sc-domain:fitpo50.pl',
    inspectionUrl: 'https://fitpo50.pl/test.html',
    getOauthToken: async () => 'oauth-token',
    inspect: async (token) => {
      calls.push(token);
      if (token === 'service-token') throw new Error('User does not have sufficient permission for site.');
      return { verdict: 'PASS' };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.authMode, 'oauth_refresh_token');
  assert.deepEqual(calls, ['service-token', 'oauth-token']);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].status, 'AUTH_FAILED');
  assert.equal(result.attempts[0].reason, 'SERVICE_ACCOUNT_PROPERTY_ACCESS_DENIED');
});

test('URL Inspection preserves a real failure when no fallback is configured', async () => {
  const result = await inspectWithCredentialFallback({
    token: 'service-token',
    authMode: 'service_account',
    oauth: null,
    siteUrl: 'sc-domain:fitpo50.pl',
    inspectionUrl: 'https://fitpo50.pl/test.html',
    inspect: async () => { throw new Error('backend unavailable'); },
  });

  assert.equal(result.ok, false);
  assert.equal(result.authMode, 'service_account');
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].status, 'REQUEST_FAILED');
});
