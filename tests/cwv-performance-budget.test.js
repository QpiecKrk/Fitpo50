const test = require('node:test');
const assert = require('node:assert/strict');

const {
  installPerformanceObservers,
  measurePage,
} = require('../scripts/cwv-performance-budget');

test('CWV observers are installed once across multiple page measurements', async () => {
  const calls = {
    addInitScript: 0,
    goto: 0,
    evaluate: 0,
  };
  const page = {
    async addInitScript() {
      calls.addInitScript += 1;
    },
    async goto() {
      calls.goto += 1;
    },
    async evaluate() {
      calls.evaluate += 1;
      return { lcp: 100, cls: 0, tbt: 0 };
    },
    async waitForTimeout() {},
  };

  await installPerformanceObservers(page);
  await measurePage(page, 'http://127.0.0.1:3000/index.html');
  await measurePage(page, 'http://127.0.0.1:3000/porady.html');

  assert.equal(calls.addInitScript, 1);
  assert.equal(calls.goto, 2);
  assert.equal(calls.evaluate, 4);
});
