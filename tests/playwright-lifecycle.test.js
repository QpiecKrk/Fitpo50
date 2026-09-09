const test = require('node:test');
const assert = require('node:assert/strict');
const { withChromium } = require('../scripts/lib/playwright-lifecycle');

function fakeChromium() {
  const state = { closes: 0 };
  return {
    state,
    chromium: {
      async launch() {
        return {
          async close() {
            state.closes += 1;
          },
        };
      },
    },
  };
}

test('zamyka Chromium po błędzie zadania', async () => {
  const fake = fakeChromium();
  await assert.rejects(
    withChromium(fake.chromium, async () => { throw new Error('celowy błąd'); }),
    /celowy błąd/,
  );
  assert.equal(fake.state.closes, 1);
});

test('zamyka Chromium po przekroczeniu limitu czasu', async () => {
  const fake = fakeChromium();
  await assert.rejects(
    withChromium(fake.chromium, () => new Promise(() => {}), { timeoutMs: 20, label: 'Test zawieszenia' }),
    /Test zawieszenia przekroczył limit/,
  );
  assert.equal(fake.state.closes, 1);
});
