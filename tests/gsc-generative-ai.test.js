const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function runReport(inputDir, outputDir) {
  const result = spawnSync(process.execPath, ['scripts/growth-tool.js', 'gsc-generative-ai'], {
    cwd: ROOT,
    env: {
      ...process.env,
      GSC_WORK_DIR: inputDir,
      FITPO50_GROWTH_REPORT_DIR: outputDir,
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(fs.readFileSync(path.join(outputDir, 'gsc-generative-ai.json'), 'utf8'));
}

test('missing generative AI export is unavailable and never reported as zero', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-gsc-ai-empty-'));
  const report = runReport(path.join(temp, 'input'), path.join(temp, 'output'));

  assert.equal(report.status, 'GSC_INPUT_UNAVAILABLE');
  assert.equal(report.summary.pages, null);
  assert.equal(report.summary.impressions, null);
  assert.equal(report.summary.clicks, null);
});

test('generative AI export preserves URL, country, device and daily trend', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-gsc-ai-data-'));
  const input = path.join(temp, 'input');
  fs.mkdirSync(input, { recursive: true });
  fs.writeFileSync(path.join(input, 'generative-ai-performance.csv'), [
    'page,impressions,clicks,country,device,date,feature',
    'https://fitpo50.pl/test-ai.html,10,1,Poland,MOBILE,2026-08-30,AI Overviews',
    'https://fitpo50.pl/test-ai.html,15,2,Germany,DESKTOP,2026-08-31,AI Overviews',
  ].join('\n'));

  const report = runReport(input, path.join(temp, 'output'));
  assert.equal(report.status, 'OK');
  assert.deepEqual(report.dimensions, ['url', 'country', 'device', 'date', 'feature']);
  assert.equal(report.pages[0].file, 'test-ai.html');
  assert.deepEqual(report.pages[0].trend, [
    { date: '2026-08-30', impressions: 10, clicks: 1 },
    { date: '2026-08-31', impressions: 15, clicks: 2 },
  ]);
  assert.deepEqual(report.pages[0].countries, ['Germany', 'Poland']);
  assert.deepEqual(report.pages[0].devices, ['DESKTOP', 'MOBILE']);
});
