const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  inspectGscInput,
  validateReportingWindows,
  writeManifestFromApiReport,
} = require('../scripts/lib/gsc-data-contract');

function isoDay(offset, now = new Date()) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function rangePair(days, now = new Date()) {
  return {
    current: { start: isoDay(-days, now), end: isoDay(-1, now) },
    previous: { start: isoDay(-(days * 2), now), end: isoDay(-(days + 1), now) },
  };
}

function makeDataset() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-gsc-contract-'));
  fs.writeFileSync(path.join(dir, 'queries.csv'), 'query,clicks,impressions,ctr,position\napob,1,10,10,4\n');
  fs.writeFileSync(path.join(dir, 'pages.csv'), 'page,clicks,impressions,ctr,position\nhttps://fitpo50.pl/apob.html,1,10,10,4\n');
  fs.writeFileSync(path.join(dir, 'query-pages.csv'), 'query,page,clicks,impressions,ctr,position\napob,https://fitpo50.pl/apob.html,1,10,10,4\n');
  const report = {
    generated_at: new Date().toISOString(),
    status: 'ok',
    property: 'sc-domain:fitpo50.pl',
    reporting_windows: {
      day_7: { range: rangePair(7) },
      day_28: { range: rangePair(28) },
      day_90: { range: rangePair(90) },
    },
    collection_quality: { datasets: [], potentially_truncated_datasets: [] },
  };
  fs.writeFileSync(path.join(dir, 'gsc-weekly-report-api.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeManifestFromApiReport(report, dir);
  return { dir, report };
}

test('fresh coherent GSC cohort passes the strict contract', () => {
  const { dir } = makeDataset();
  const result = inspectGscInput(dir, { strictPeriods: true });
  assert.equal(result.status, 'PASS');
  assert.equal(result.freshness.status, 'PASS');
  assert.equal(result.periods.status, 'PASS');
  assert.equal(result.cohort.status, 'PASS');
  assert.equal(result.files.query_pages.type, 'query_pages');
});

test('stale GSC data is blocking even when all CSV files exist', () => {
  const { dir } = makeDataset();
  const future = new Date(Date.now() + (96 * 3600000));
  const result = inspectGscInput(dir, { strictPeriods: true, now: future, maxAgeHours: 72 });
  assert.equal(result.blocking, true);
  assert.equal(result.freshness.status, 'FAIL');
  assert.ok(result.errors.some((item) => item.includes('nieaktualne')));
});

test('three loose CSV files without a manifest are not accepted', () => {
  const { dir } = makeDataset();
  fs.unlinkSync(path.join(dir, 'gsc-data-manifest.json'));
  const result = inspectGscInput(dir, { strictPeriods: true });
  assert.equal(result.blocking, true);
  assert.ok(result.errors.some((item) => item.includes('manifestu')));
});

test('fresh files with an old reporting window are rejected', () => {
  const { dir, report } = makeDataset();
  const oldNow = new Date(Date.now() - (10 * 86400000));
  report.reporting_windows = {
    day_7: { range: rangePair(7, oldNow) },
    day_28: { range: rangePair(28, oldNow) },
    day_90: { range: rangePair(90, oldNow) },
  };
  fs.writeFileSync(path.join(dir, 'gsc-weekly-report-api.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeManifestFromApiReport(report, dir);
  const result = inspectGscInput(dir, { strictPeriods: true });
  assert.equal(result.blocking, true);
  assert.ok(result.errors.some((item) => item.includes('Końcowa data GSC jest zbyt stara')));
});

test('a pages export disguised as query-pages is rejected', () => {
  const { dir } = makeDataset();
  fs.writeFileSync(path.join(dir, 'query-pages.csv'), 'page,clicks,impressions,ctr,position\nhttps://fitpo50.pl/apob.html,1,10,10,4\n');
  const result = inspectGscInput(dir, { strictPeriods: true });
  assert.equal(result.blocking, true);
  assert.ok(result.errors.some((item) => item.includes('oczekiwano query_pages')));
});

test('different query-pages aliases are rejected', () => {
  const { dir } = makeDataset();
  fs.writeFileSync(path.join(dir, 'query_pages.csv'), 'query,page,clicks,impressions,ctr,position\ninna,https://fitpo50.pl/inna.html,0,2,0,20\n');
  const result = inspectGscInput(dir, { strictPeriods: true });
  assert.equal(result.blocking, true);
  assert.equal(result.cohort.alias_status, 'FAIL');
});

test('inconsistent 7/28/90 windows are rejected', () => {
  const broken = {
    day_7: { range: rangePair(7) },
    day_28: { range: rangePair(28) },
    day_90: { range: { current: { start: isoDay(-89), end: isoDay(-1) }, previous: rangePair(90).previous } },
  };
  const result = validateReportingWindows(broken);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some((item) => item.includes('89 dni')));
});

test('API row-cap diagnostics remain visible as a warning', () => {
  const { dir, report } = makeDataset();
  report.collection_quality = {
    datasets: [],
    potentially_truncated_datasets: ['web:query+page:2026-01-01:2026-03-31'],
  };
  fs.writeFileSync(path.join(dir, 'gsc-weekly-report-api.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeManifestFromApiReport(report, dir);
  const result = inspectGscInput(dir, { strictPeriods: true });
  assert.equal(result.blocking, false);
  assert.equal(result.status, 'WARN');
  assert.equal(result.pagination.status, 'WARN_LIMIT_REACHED');
});

test('GSC API collector paginates and records a possible 50k cap', async () => {
  const { API_COLLECTION_DIAGNOSTICS, gscQueryAllRows } = require('../scripts/gsc-weekly-api-report');
  const originalFetch = global.fetch;
  API_COLLECTION_DIAGNOSTICS.length = 0;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const count = body.startRow < 50000 ? 25000 : 0;
    return {
      ok: true,
      json: async () => ({ rows: Array.from({ length: count }, (_, index) => ({ keys: [`${body.startRow + index}`] })) }),
    };
  };
  try {
    const rows = await gscQueryAllRows('token', 'sc-domain:fitpo50.pl', {
      startDate: '2026-05-01',
      endDate: '2026-07-29',
      dimensions: ['query'],
      type: 'web',
    });
    assert.equal(rows.length, 50000);
    assert.equal(API_COLLECTION_DIAGNOSTICS.length, 1);
    assert.equal(API_COLLECTION_DIAGNOSTICS[0].batches.length, 3);
    assert.equal(API_COLLECTION_DIAGNOSTICS[0].potential_api_row_cap, true);
  } finally {
    global.fetch = originalFetch;
  }
});
