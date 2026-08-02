const test = require('node:test');
const assert = require('node:assert/strict');

const {
  estimatedTrafficGain,
  isNoindexSeoFile,
  metricDelta,
  textContract,
} = require('../scripts/growth-tool');

test('estimatedTrafficGain normalizes a 90-day GSC range to 30 days', () => {
  const result = estimatedTrafficGain({ impressions: 900, clicks: 15 }, 90);

  assert.equal(result.monthly_impressions, 300);
  assert.equal(result.current_monthly_clicks, 5);
  assert.equal(result.estimated_monthly_click_gain, 10);
});

test('estimatedTrafficGain clamps a negative opportunity to zero', () => {
  const result = estimatedTrafficGain({ impressions: 100, clicks: 10 }, 30);

  assert.equal(result.raw_monthly_click_gain, -5);
  assert.equal(result.estimated_monthly_click_gain, 0);
});

test('textContract enforces headline and meta description boundaries', () => {
  assert.equal(textContract('A'.repeat(55), 55, 70).status, 'PASS');
  assert.equal(textContract('A'.repeat(54), 55, 70).status, 'FIX_REQUIRED');
  assert.equal(textContract(`${'A'.repeat(144)}.`, 145, 160, true).status, 'PASS');
  assert.equal(textContract('A'.repeat(145), 145, 160, true).status, 'FIX_REQUIRED');
});

test('metricDelta treats a lower average position as an improvement', () => {
  const delta = metricDelta(
    { impressions: 100, clicks: 2, ctr: 2, position: 10.42 },
    { impressions: 130, clicks: 4, ctr: 3.08, position: 9.71 },
  );

  assert.deepEqual(delta, {
    impressions: 30,
    clicks: 2,
    ctr_percentage_points: 1.08,
    position_improvement: 0.71,
  });
});

test('noindex pages are excluded from SEO and GSC queues', () => {
  assert.equal(isNoindexSeoFile('kalkulator-bialka-po-50.html'), true);
  assert.equal(isNoindexSeoFile('centrum-bialka-po-50.html'), false);
});
