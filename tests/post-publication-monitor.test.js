const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildMonitoringItem,
  findIndexCoverage,
  metricDelta,
  parseCsv,
  preparePublicationMonitoring,
} = require('../scripts/lib/post-publication-monitor');

function temp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('parser danych stron GSC zachowuje URL i metryki', () => {
  const rows = parseCsv('page,clicks,impressions,ctr,position\n"https://fitpo50.pl/test.html",2,40,5,8.5\n');
  assert.deepEqual(rows, [{ page: 'https://fitpo50.pl/test.html', clicks: '2', impressions: '40', ctr: '5', position: '8.5' }]);
});

test('delta pokazuje wzrost kliknięć, wyświetleń, CTR i poprawę pozycji', () => {
  assert.deepEqual(
    metricDelta({ clicks: 1, impressions: 20, ctr: 5, position: 12 }, { clicks: 3, impressions: 50, ctr: 6, position: 8 }),
    { clicks: 2, impressions: 30, ctr_pp: 1, position_improvement: 4 },
  );
});

test('odczyt URL Inspection rozpoznaje checked jako zindeksowane i alerts jako niezindeksowane', () => {
  const inputDir = temp('fitpo50-index-coverage-');
  try {
    fs.writeFileSync(path.join(inputDir, 'gsc-indexing-coverage.json'), JSON.stringify({
      checked: [{ url: 'https://fitpo50.pl/pass.html', indexed: true, verdict: 'PASS' }],
      alerts: [{ url: 'https://fitpo50.pl/alert.html', indexed: false, verdict: 'NEUTRAL', coverage_state: 'Strona zeskanowana, ale jeszcze nie zindeksowana' }],
    }));
    assert.equal(findIndexCoverage(inputDir, 'https://fitpo50.pl/pass.html').indexed, true);
    assert.equal(findIndexCoverage(inputDir, 'https://fitpo50.pl/alert.html').indexed, false);
  } finally {
    fs.rmSync(inputDir, { recursive: true, force: true });
  }
});

test('publikacja atomowo zapisuje historię, baseline, checkpointy i kolejkę GSC', () => {
  const stageRoot = temp('fitpo50-monitor-stage-');
  const gscInputDir = temp('fitpo50-monitor-gsc-');
  try {
    for (const relative of ['index.html', 'porady.html', 'zdrowie.html']) {
      fs.writeFileSync(path.join(stageRoot, relative), '<a href="monitorowany-artykul.html">Artykuł</a>');
    }
    const result = preparePublicationMonitoring({
      stageRoot,
      article: { slug: 'monitorowany-artykul', category: 'zdrowie' },
      operation: 'CREATE',
      transactionId: 'monitor-test',
      gscInputDir,
      now: new Date('2026-08-24T12:00:00Z'),
    });
    assert.equal(result.item.baseline.status, 'GSC_INPUT_UNAVAILABLE');
    assert.equal(result.item.checkpoints.day_7.due_date, '2026-08-31');
    assert.equal(result.item.checkpoints.day_14.due_date, '2026-09-07');
    assert.equal(result.item.checkpoints.day_28.due_date, '2026-09-21');
    assert.deepEqual(result.item.publication_events.map((event) => event.event_id), ['monitor-test']);
    assert.deepEqual(result.queueItem.source_urls.sort(), [
      'https://fitpo50.pl/',
      'https://fitpo50.pl/porady.html',
      'https://fitpo50.pl/zdrowie.html',
    ]);
    const update = preparePublicationMonitoring({
      stageRoot,
      article: { slug: 'monitorowany-artykul', category: 'zdrowie' },
      operation: 'UPDATE',
      transactionId: 'monitor-test-update',
      gscInputDir,
      now: new Date('2026-08-25T12:00:00Z'),
    });
    assert.deepEqual(update.item.publication_events.map((event) => event.event_id), ['monitor-test', 'monitor-test-update']);
    assert.equal(update.item.first_published_at, '2026-08-24T12:00:00.000Z');
    for (const relative of [
      'data/reports/published-articles-log.json',
      'data/reports/gsc-after-publication-queue.json',
      'data/reports/gsc-after-publication-queue.txt',
    ]) assert.equal(fs.existsSync(path.join(stageRoot, relative)), true, relative);
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
    fs.rmSync(gscInputDir, { recursive: true, force: true });
  }
});

test('historyczny wpis bez baseline nie udaje pierwszego sygnału po publikacji', () => {
  const item = buildMonitoringItem({
    published: { slug: 'legacy', url: 'https://fitpo50.pl/legacy.html', last_published_at: '2026-08-01T00:00:00Z' },
    previous: { first_impression_after_publication_at: '2026-08-24T10:00:00Z' },
    current: { clicks: 2, impressions: 40, ctr: 5, position: 8 },
    indexCoverage: { indexed: true },
    observedAt: '2026-08-24T12:00:00Z',
  });
  assert.equal(item.status, 'LEGACY_BASELINE_MISSING');
  assert.equal(item.first_impression_after_publication_at, null);
  assert.equal(item.first_click_after_publication_at, null);
  assert.equal(item.delta_from_baseline, null);
});

test('baseline ze starych lub niepełnych danych pozostaje niedostępny, a nie zerowy', () => {
  const item = buildMonitoringItem({
    published: { slug: 'stale', url: 'https://fitpo50.pl/stale.html', baseline: { captured_at: '2026-08-24T10:00:00Z', status: 'GSC_INPUT_UNAVAILABLE', metrics: { clicks: 0, impressions: 0, ctr: 0, position: null } } },
    current: { clicks: 1, impressions: 20, ctr: 5, position: 9 },
    indexCoverage: { indexed: true },
    observedAt: '2026-08-25T12:00:00Z',
  });
  assert.equal(item.status, 'BASELINE_UNAVAILABLE');
  assert.equal(item.delta_from_baseline, null);
  assert.equal(item.first_click_after_publication_at, null);
});
