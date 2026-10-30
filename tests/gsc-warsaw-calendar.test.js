'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const time = require('../scripts/lib/time');
const { reportingRanges } = require('../scripts/gsc-weekly-api-report');
const { toDateLabel } = require('../scripts/gsc-weekly-csv-report');
const { currentRange: ga4CurrentRange } = require('../scripts/ga4-report');

const OCTOBER_NOW = new Date('2026-10-25T23:30:00Z');
const MARCH_NOW = new Date('2026-03-29T22:30:00Z');

function source(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

test('wspólny helper eksportuje warszawską arytmetykę dni kalendarzowych', () => {
  assert.equal(typeof time.shiftWarsawDay, 'function');
  assert.equal(typeof time.warsawDayDifference, 'function');
  assert.equal(typeof time.warsawCompletedRange, 'function');
});

test('GSC zwraca ten sam warszawski zakres przy TZ=UTC i TZ=Asia/Bangkok', () => {
  const script = [
    "const { reportingRanges } = require('./scripts/gsc-weekly-api-report');",
    "process.stdout.write(JSON.stringify(reportingRanges(new Date('2026-10-25T23:30:00Z'))));",
  ].join('');
  const outputs = ['UTC', 'Asia/Bangkok'].map((tz) => spawnSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  }));
  outputs.forEach((result) => assert.equal(result.status, 0, result.stderr));
  assert.equal(outputs[0].stdout, outputs[1].stdout);
  assert.deepEqual(JSON.parse(outputs[0].stdout).day_7, {
    current: { start: '2026-10-19', end: '2026-10-25' },
    previous: { start: '2026-10-12', end: '2026-10-18' },
  });
});

test('GSC liczy dokładne zakresy 7/28/90 dni według dnia Warszawy', () => {
  const ranges = reportingRanges(OCTOBER_NOW);
  assert.deepEqual(ranges.day_7, {
    current: { start: '2026-10-19', end: '2026-10-25' },
    previous: { start: '2026-10-12', end: '2026-10-18' },
  });
  assert.deepEqual(ranges.day_28, {
    current: { start: '2026-09-28', end: '2026-10-25' },
    previous: { start: '2026-08-31', end: '2026-09-27' },
  });
  assert.deepEqual(ranges.day_90, {
    current: { start: '2026-07-28', end: '2026-10-25' },
    previous: { start: '2026-04-29', end: '2026-07-27' },
  });
  assert.deepEqual(reportingRanges(MARCH_NOW).day_7.current, {
    start: '2026-03-23',
    end: '2026-03-29',
  });
});

test('etykiety, wiek danych i checkpointy zachowują warszawski dzień przez DST', () => {
  assert.equal(toDateLabel('2026-10-26T00:30:00+01:00'), '2026-10-26');
  assert.equal(time.warsawDayDifference('2026-10-25', '2026-10-26'), 1);
  assert.equal(time.shiftWarsawDay(new Date('2026-10-25T00:30:00+02:00'), 7), '2026-11-01');
  assert.equal(time.shiftWarsawDay(new Date('2026-10-25T00:30:00+02:00'), 14), '2026-11-08');
  assert.equal(time.shiftWarsawDay(new Date('2026-10-25T00:30:00+02:00'), 28), '2026-11-22');
  assert.equal(time.shiftWarsawDay(new Date('2026-03-29T00:30:00+01:00'), 7), '2026-04-05');
  assert.deepEqual(time.warsawCompletedRange(7, OCTOBER_NOW), {
    start: '2026-10-19',
    end: '2026-10-25',
  });
});

test('próg opóźnienia GSC po północy korzysta z całych dni Warszawy', () => {
  const justAfterWarsawMidnight = new Date('2026-10-26T23:30:00Z');
  assert.equal(time.warsawDay(justAfterWarsawMidnight), '2026-10-27');
  assert.equal(time.warsawDayDifference('2026-10-24', time.warsawDay(justAfterWarsawMidnight)), 3);
  assert.match(source('scripts/lib/gsc-data-contract.js'), /warsawDayDifference\(rangeContract\.current_end, warsawDay\(now\)\)/);
});

test('GA4 używa tego samego zakresu pełnych dni co GSC', () => {
  assert.deepEqual(ga4CurrentRange(7, OCTOBER_NOW), reportingRanges(OCTOBER_NOW).day_7.current);
  assert.deepEqual(ga4CurrentRange(7, MARCH_NOW), reportingRanges(MARCH_NOW).day_7.current);
});

test('wszyscy konsumenci kalendarza GSC i GA4 używają wspólnego helpera', () => {
  const weeklyApi = source('scripts/gsc-weekly-api-report.js');
  const weeklyCsv = source('scripts/gsc-weekly-csv-report.js');
  const contract = source('scripts/lib/gsc-data-contract.js');
  const priority = source('scripts/gsc-priority-map.js');
  const monitor = source('scripts/lib/post-publication-monitor.js');
  const growth = source('scripts/growth-tool.js');
  const ga4 = source('scripts/ga4-report.js');

  assert.match(weeklyApi, /warsawCompletedRange/);
  assert.doesNotMatch(weeklyApi, /function dateIso\(/);
  assert.match(weeklyCsv, /return warsawDay\(iso\)/);
  assert.match(contract, /warsawDayDifference/);
  assert.match(contract, /shiftWarsawDay/);
  assert.match(priority, /warsawDayDifference/);
  assert.match(priority, /shiftWarsawDay/);
  assert.match(monitor, /shiftWarsawDay/);
  assert.match(growth, /shiftWarsawDay/);
  assert.match(ga4, /warsawCompletedRange/);
  assert.doesNotMatch(ga4, /function dateIso\(/);
});

test('warsawIso zachowuje dotychczasowe przesunięcia zimowe i letnie', () => {
  assert.equal(time.warsawIso(new Date('2026-01-15T12:00:00Z')), '2026-01-15T13:00:00+01:00');
  assert.equal(time.warsawIso(new Date('2026-07-15T12:00:00Z')), '2026-07-15T14:00:00+02:00');
});
