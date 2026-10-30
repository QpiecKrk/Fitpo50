'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  RETIRED_MODULE_PATHS,
  checkRetiredModuleExposure,
} = require('../scripts/security-exposure-check');

function response(status) {
  return { status };
}

test('retired module inventory contains the 13 approved paths', () => {
  assert.equal(RETIRED_MODULE_PATHS.length, 13);
  assert.deepEqual(RETIRED_MODULE_PATHS, [
    '/admin/dashboard.php',
    '/admin/entry-form.php',
    '/admin/sync-manual.php',
    '/admin/actions/save.php',
    '/admin/actions/delete.php',
    '/admin/actions/publish.php',
    '/admin/actions/unpublish.php',
    '/admin/api/calendar-entries.php',
    '/admin/helpers/calendar.php',
    '/admin/templates/article.php',
    '/admin/templates/carousel-script.php',
    '/admin/templates/day-list.php',
    '/assets/dziennik-hero.jpeg',
  ]);
});

for (const status of [404, 410]) {
  test(`retired module check accepts HTTP ${status}`, async () => {
    const seen = [];
    const result = await checkRetiredModuleExposure({
      baseUrl: 'https://fitpo50.example',
      adminBaseUrl: 'https://admin.fitpo50.example',
      cacheBust: 'test-token',
      fetchImpl: async (url) => {
        seen.push(String(url));
        return response(status);
      },
    });

    assert.equal(result.failures.length, 0);
    assert.equal(result.checks.length, 25);
    assert.equal(seen.length, 25);
    assert.ok(seen.every((url) => url.includes('fitpo50_security=test-token')));
    assert.ok(seen.includes('https://fitpo50.example/admin/dashboard.php?fitpo50_security=test-token'));
    assert.ok(seen.includes('https://admin.fitpo50.example/dashboard.php?fitpo50_security=test-token'));
  });
}

for (const status of [200, 302, 500]) {
  test(`retired module check rejects HTTP ${status}`, async () => {
    const result = await checkRetiredModuleExposure({
      baseUrl: 'https://fitpo50.example',
      adminBaseUrl: 'https://admin.fitpo50.example',
      cacheBust: 'test-token',
      fetchImpl: async () => response(status),
    });

    assert.equal(result.failures.length, 25);
    assert.ok(result.failures.every((item) => item.result === 'FAIL'));
    assert.ok(result.failures.every((item) => item.status === status));
  });
}

test('retired module check rejects a timeout without hiding the address', async () => {
  const result = await checkRetiredModuleExposure({
    baseUrl: 'https://fitpo50.example',
    adminBaseUrl: 'https://admin.fitpo50.example',
    cacheBust: 'test-token',
    fetchImpl: async () => {
      const error = new Error('request timed out');
      error.name = 'AbortError';
      throw error;
    },
  });

  assert.equal(result.failures.length, 25);
  assert.ok(result.failures.every((item) => item.result === 'FAIL'));
  assert.ok(result.failures.every((item) => item.status === 0));
  assert.ok(result.failures.every((item) => item.url.startsWith('https://')));
  assert.ok(result.failures.every((item) => item.error.includes('timed out')));
});
