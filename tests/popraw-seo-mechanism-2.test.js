const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildCannibalizationMap,
  buildGscAfterChangeQueue,
  buildSeoApprovalWave,
  buildSeoWorkHistory,
} = require('../scripts/growth-tool');
const { classifyPriority } = require('../scripts/gsc-priority-map');
const {
  DEFAULT_GROWTH_REPORT_DIR,
  DEFAULT_SEO_STATE_DIR,
  buildSharedPriorityList,
  copyDirectoryIfMissing,
  selectPriorityWave,
} = require('../scripts/lib/seo-priority-list');

function article(path, diagnosis, gsc, requiredChange = 'Wykonaj działanie wynikające z diagnozy.') {
  return {
    type: 'article',
    path,
    url: `https://fitpo50.pl/${path}`,
    diagnosis,
    priority: 'P1_GROWTH',
    visibility_segment: 'LOW_VISIBILITY_LONG_TAIL',
    editorial_decision: 'sprawdź',
    opportunity_score: 50,
    date_modified: '2026-01-01T08:00:00+01:00',
    gsc,
    priority_metrics_28d: { ...gsc },
    gsc_windows: { day_28: { status: 'ok', current: { ...gsc }, previous: null } },
    keywords: {
      primary: path.replace('.html', ''),
      evidence: gsc.query ? [{ query: gsc.query, ...gsc }] : [],
      secondary: [],
      intents: [],
    },
    topology: { suggested_sources: [] },
    required_action: { action_type: 'TEST', required_change: requiredChange },
  };
}

test('3 impressions at position 8 is insufficient data, not P0', () => {
  assert.equal(
    classifyPriority({ impressions: 3, position: 8 }, { type: 'article', inbound_links: 1 }, 90),
    'P2_INSUFFICIENT_DATA',
  );
  assert.equal(
    classifyPriority({ impressions: 50, position: 8 }, { type: 'article', inbound_links: 1 }, 90),
    'P0_NEAR_PAGE_ONE',
  );
});

test('shared priority ranks 810 impressions at position 24 above 9 at position 8', () => {
  const ranked = buildSharedPriorityList([
    article('small-near.html', 'POSITION_11_30', { impressions: 9, clicks: 0, ctr: 0, position: 8 }),
    article('large-deeper.html', 'POSITION_11_30', { impressions: 810, clicks: 0, ctr: 0, position: 24 }),
  ]);
  assert.equal(ranked[0].file, 'large-deeper.html');
  assert.ok(ranked[0].estimated_click_gain_28d > ranked[1].estimated_click_gain_28d);
});

test('wave of 5 contains 3 estimated-gain and 2 rotation articles', () => {
  const items = Array.from({ length: 7 }, (_, index) => article(
    `wave-${index + 1}.html`,
    'POSITION_11_30',
    { impressions: 700 - index * 50, clicks: 0, ctr: 0, position: 15 + index },
  ));
  const wave = selectPriorityWave(items, { size: 5, state: {}, selectedAt: '2026-10-23T00:00:00Z' });
  assert.equal(wave.gain_count, 3);
  assert.equal(wave.rotation_count, 2);
  assert.deepEqual(wave.selected.map((item) => item.wave_source), [
    'ESTIMATED_CLICK_GAIN', 'ESTIMATED_CLICK_GAIN', 'ESTIMATED_CLICK_GAIN', 'ROTATION', 'ROTATION',
  ]);
  assert.ok(wave.selected.slice(3).every((item) => item.rotation_diagnosis?.title_h1_intent?.status === 'SEO_DECISION_REQUIRED'));
  assert.ok(wave.selected.slice(3).every((item) => item.rotation_diagnosis?.inbound_links?.action.includes('lokalny pipeline linkowania')));
});

test('rotation does not repeat an article before remaining candidates get a turn', () => {
  const items = Array.from({ length: 7 }, (_, index) => article(
    `rotate-${index + 1}.html`,
    'POSITION_11_30',
    { impressions: 700 - index * 50, clicks: 0, ctr: 0, position: 15 + index },
  ));
  const first = selectPriorityWave(items, { size: 5, state: {}, roundKey: 'round-1', selectedAt: '2026-10-23T00:00:00Z' });
  const second = selectPriorityWave(items, { size: 5, state: first.state, roundKey: 'round-2', selectedAt: '2026-10-24T00:00:00Z' });
  const firstRotation = first.selected.filter((item) => item.wave_source === 'ROTATION').map((item) => item.file);
  const secondRotation = second.selected.filter((item) => item.wave_source === 'ROTATION').map((item) => item.file);
  assert.deepEqual(firstRotation.filter((file) => secondRotation.includes(file)), []);
});

test('same reporting round is idempotent and does not consume another rotation turn', () => {
  const items = Array.from({ length: 7 }, (_, index) => article(
    `stable-${index + 1}.html`,
    'POSITION_11_30',
    { impressions: 700 - index * 50, clicks: 0, ctr: 0, position: 15 + index },
  ));
  const first = selectPriorityWave(items, { size: 5, state: {}, roundKey: 'same-round', selectedAt: '2026-10-23T00:00:00Z' });
  const repeated = selectPriorityWave(items, { size: 5, state: first.state, roundKey: 'same-round', selectedAt: '2026-10-24T00:00:00Z' });
  assert.deepEqual(repeated.state, first.state);
  assert.deepEqual(repeated.selected.map((item) => item.file), first.selected.map((item) => item.file));
});

test('SEO state and growth reports use git-ignored repo storage and legacy migration is non-destructive', () => {
  assert.match(DEFAULT_SEO_STATE_DIR, /data\/reports\/local\/seo-state$/);
  assert.match(DEFAULT_GROWTH_REPORT_DIR, /data\/reports\/growth$/);
  assert.ok(!DEFAULT_SEO_STATE_DIR.includes(`${path.sep}Downloads${path.sep}`));
  assert.ok(!DEFAULT_GROWTH_REPORT_DIR.includes(`${path.sep}Downloads${path.sep}`));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-migration-'));
  const legacy = path.join(root, 'legacy');
  const target = path.join(root, 'target');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'rotation.json'), '{"round":1}\n');
  const result = copyDirectoryIfMissing(legacy, target);
  assert.equal(result.status, 'COPIED_NON_DESTRUCTIVELY');
  assert.equal(fs.existsSync(path.join(legacy, 'rotation.json')), true);
  assert.equal(fs.readFileSync(path.join(target, 'rotation.json'), 'utf8'), '{"round":1}\n');
});

test('MECHANIZM 2 assigns every article to exactly one of four baskets', () => {
  const recentDate = new Date(Date.now() - 2 * 86400000).toISOString();
  const priorityMap = [
    article('boost.html', 'CTR_GAP_TOP10', { query: 'boost test', clicks: 0, impressions: 100, ctr: 0, position: 7 }),
    article('rokuje.html', 'POSITION_11_30', { query: 'rokuje test', clicks: 1, impressions: 80, ctr: 1.25, position: 15 }),
    article('naprawa.html', 'ZERO_VISIBILITY_INDEXED', { clicks: 0, impressions: 0, ctr: 0, position: 0 }),
    { ...article('monitoring.html', 'POSITION_11_30', { query: 'monitoring test', clicks: 2, impressions: 40, ctr: 5, position: 12 }), date_modified: recentDate },
  ];
  const articleByFile = new Map(priorityMap.map((item) => [item.path, { date_modified: item.date_modified, title: item.path, meta_description: '' }]));
  const wave = buildSeoApprovalWave([], { action_cards: [] }, articleByFile, 28, { priority_map: priorityMap });
  const groups = [wave.boost, wave.promising, wave.repair, wave.monitoring];
  const files = groups.flat().map((item) => item.file);

  assert.equal(wave.coverage_contract.status, 'PASS');
  assert.equal(files.length, 4);
  assert.equal(new Set(files).size, 4);
  assert.deepEqual(wave.coverage_contract.basket_counts, { BOOST: 1, ROKUJE: 1, NAPRAWA: 1, MONITORING: 1 });
  assert.equal(wave.monitoring[0].execution_status, 'COOLDOWN_MONITORUJ');
  assert.equal(wave.rokuje_execution_sequence.pilot_size, 4);
  assert.equal(wave.rokuje_execution_sequence.expansion_size, 20);
  assert.equal(wave.rokuje_execution_sequence.expansion_gate, 'PILOT_LIVE_DEPLOYED_AND_VALIDATED');
  assert.equal(wave.rokuje_execution_sequence.regenerate_before_expansion, true);
});

test('MECHANIZM 2 ranks ROKUJE deterministically before the 4 plus 20 sequence', () => {
  const priorityMap = Array.from({ length: 26 }, (_, index) => article(
    `rokuje-${String(index + 1).padStart(2, '0')}.html`,
    'POSITION_11_30',
    { query: `rokuje ${index + 1}`, clicks: 0, impressions: index + 1, ctr: 0, position: 20 },
  ));
  const articleByFile = new Map(priorityMap.map((item) => [item.path, { date_modified: item.date_modified, title: item.path, meta_description: '' }]));
  const wave = buildSeoApprovalWave([], { action_cards: [] }, articleByFile, 28, { priority_map: priorityMap });

  assert.equal(wave.promising.length, 26);
  assert.equal(wave.priority_contract.source, 'scripts/lib/seo-priority-list.js');
  assert.equal(wave.promising[0].file, 'rokuje-26.html');
  assert.equal(wave.promising[3].file, 'rokuje-23.html');
  assert.equal(wave.promising[23].file, 'rokuje-03.html');
});

test('MECHANIZM 2 keeps history, baseline and 7/14/28 checkpoints for every URL', () => {
  const generatedAt = '2026-08-24T12:00:00+02:00';
  const articles = [
    { file: 'a.html', url: 'https://fitpo50.pl/a.html', date_modified: '2026-08-01T08:00:00+02:00', gsc: { clicks: 2, impressions: 100, ctr: 2, position: 12 } },
    { file: 'b.html', url: 'https://fitpo50.pl/b.html', date_modified: '2026-08-20T08:00:00+02:00', gsc: { clicks: 0, impressions: 0, ctr: 0, position: 0 } },
  ];
  const previous = {
    urls: [{
      file: 'a.html', date_modified: '2026-07-01T08:00:00+02:00',
      baseline: { clicks: 1, impressions: 60, ctr: 1.67, position: 18 }, snapshots: [], change_events: [],
    }],
  };
  const history = buildSeoWorkHistory(articles, generatedAt, previous, 28);

  assert.equal(history.coverage.article_inventory, 2);
  assert.equal(history.coverage.urls_with_history, 2);
  assert.deepEqual(history.coverage.omitted_urls, []);
  assert.equal(history.urls[0].change_detected_this_run, true);
  assert.deepEqual(Object.keys(history.urls[0].delta_tracker), ['day_7', 'day_14', 'day_28']);
  assert.ok(history.urls.every((item) => item.baseline && item.checkpoints && item.change_events.length >= 1));
});

test('MECHANIZM 2 keeps the GSC queue blocked until production is validated', () => {
  const approvalWave = {
    boost: [{
      id: 'BOOST 1', file: 'a.html', url: 'https://fitpo50.pl/a.html',
      gsc_submit_after_change: ['https://fitpo50.pl/a.html', 'https://fitpo50.pl/source.html'],
    }],
  };
  const baseHistory = {
    generated_at: '2026-08-24T12:00:00+02:00',
    urls: [{ file: 'a.html', date_modified: '2026-08-24T08:00:00+02:00', change_detected_this_run: true }],
  };
  const incomplete = buildGscAfterChangeQueue(approvalWave, baseHistory, null, () => ({ status: 'LOCAL_DEPLOYMENT_INCOMPLETE', checks: {} }));
  assert.equal(incomplete.status, 'EMPTY_AWAITING_LOCAL_CHANGE');
  assert.deepEqual(incomplete.submit_targets, []);

  const local = buildGscAfterChangeQueue(approvalWave, baseHistory, null, () => ({ status: 'COMMITTED_LOCALLY', checks: { all: true } }));
  assert.equal(local.status, 'AWAITING_LIVE_DEPLOYMENT');
  assert.deepEqual(local.submit_targets, []);
  assert.deepEqual(local.items[0].planned_submit_urls, ['https://fitpo50.pl/a.html', 'https://fitpo50.pl/source.html']);
  assert.equal(local.items[0].status, 'AWAITING_LIVE_DEPLOYMENT');
});

test('MECHANIZM 2 preserves a confirmed main URL in the durable intent map', () => {
  const cards = [
    {
      file: 'strong-now.html', url: 'https://fitpo50.pl/strong-now.html',
      gsc: { clicks: 8, impressions: 400, position: 4 },
      keyword_plan: { primary: 'apob norma', evidence: [{ query: 'apob norma', clicks: 8, impressions: 400, position: 4 }] },
    },
    {
      file: 'confirmed-owner.html', url: 'https://fitpo50.pl/confirmed-owner.html',
      gsc: { clicks: 1, impressions: 50, position: 12 },
      keyword_plan: { primary: 'apob norma', evidence: [{ query: 'apob norma', clicks: 1, impressions: 50, position: 12 }] },
    },
  ];
  const previous = {
    intent_owners: [{
      intent_key: 'apob norma', main_file: 'confirmed-owner.html', owner_status: 'CONFIRMED', first_seen_at: '2026-08-01T00:00:00Z',
    }],
  };
  const map = buildCannibalizationMap(cards, { cannibalization: [] }, previous);

  assert.equal(map.intent_owners.length, 1);
  assert.equal(map.intent_owners[0].main_file, 'confirmed-owner.html');
  assert.equal(map.intent_owners[0].owner_status, 'CONFIRMED');
  assert.equal(map.conflicts[0].main_file, 'confirmed-owner.html');
});
