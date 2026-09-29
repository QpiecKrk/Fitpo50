const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readGsc, visibilityDiagnosis } = require('../scripts/gsc-priority-map');

test('priority reader consumes canonical API exports for all three windows', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-priority-windows-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const days of [7, 28, 90]) {
    for (const period of ['current', 'previous']) {
      fs.writeFileSync(path.join(root, `web-${days}-${period}-pages.csv`),
        `page,clicks,impressions,ctr,position\nhttps://fitpo50.pl/a.html,2,${days},1,9\n`);
    }
  }
  const data = readGsc(root);
  for (const days of [7, 28, 90]) {
    for (const period of ['current', 'previous']) {
      assert.equal(data.pageWindows[`day_${days}`][period][0].impressions, days);
    }
  }
});

test('TOP10 CTR diagnosis requires at least 30 impressions', () => {
  const diagnose = (impressions) => visibilityDiagnosis({ type: 'article' },
    { impressions, clicks: 0, ctr: 0, position: 4.6 }, {}, null);
  assert.equal(diagnose(1), 'VISIBLE_LOW_SIGNAL');
  assert.equal(diagnose(29), 'VISIBLE_LOW_SIGNAL');
  assert.equal(diagnose(30), 'CTR_GAP_TOP10');
});
