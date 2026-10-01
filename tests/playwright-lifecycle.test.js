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

test('zamyka Chromium po sukcesie zadania', async () => {
  const fake = fakeChromium();
  const value = await withChromium(fake.chromium, async () => 'PASS');
  assert.equal(value, 'PASS');
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

test('bezpośredni chromium.launch występuje wyłącznie w kanonicznym wrapperze', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..', 'scripts');
  const hits = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.(?:js|cjs|mjs)$/.test(entry.name) && /chromium\.launch\s*\(/.test(fs.readFileSync(absolute, 'utf8'))) hits.push(path.relative(root, absolute).replace(/\\/g, '/'));
    }
  }
  assert.deepEqual(hits, ['lib/playwright-lifecycle.js']);
});
