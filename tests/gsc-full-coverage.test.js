const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

test('API reporting contract exposes 7/28/90 day windows', () => {
  const { reportingRanges } = require('../scripts/gsc-weekly-api-report');
  const ranges = reportingRanges();
  assert.deepEqual(Object.keys(ranges), ['day_7', 'day_28', 'day_90']);
  assert.ok(ranges.day_7.current.start < ranges.day_7.current.end);
  assert.ok(ranges.day_90.previous.start < ranges.day_90.previous.end);
});

test('priority map keeps decimal GSC positions with three decimal places', () => {
  const { parseNumber } = require('../scripts/gsc-priority-map');
  assert.equal(parseNumber('61.425'), 61.425);
  assert.equal(parseNumber('10,975'), 10.975);
});

test('priority map assigns a diagnosis and action to every article', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-full-coverage-'));
  const visibleUrl = 'https://fitpo50.pl/apob-norma-cena-jak-czytac-wynik.html';
  fs.writeFileSync(path.join(dir, 'pages.csv'), [
    'page,clicks,impressions,ctr,position',
    `${visibleUrl},2,200,1,12`,
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'queries.csv'), [
    'query,clicks,impressions,ctr,position',
    'inna ujawniona fraza,0,10,0,30',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'query-pages.csv'), [
    'query,page,clicks,impressions,ctr,position',
    'inna ujawniona fraza,https://fitpo50.pl/index.html,0,10,0,30',
  ].join('\n'));

  const result = spawnSync('node', [
    'scripts/gsc-priority-map.js',
    '--input-dir', dir,
    '--output-dir', dir,
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(fs.readFileSync(path.join(dir, 'gsc-priority-map.json'), 'utf8'));
  assert.equal(report.coverage_contract.status, 'PASS');
  assert.equal(report.coverage_contract.article_inventory, report.coverage_contract.diagnosed_articles);
  assert.equal(report.coverage_contract.article_inventory, report.coverage_contract.actions_assigned);
  assert.deepEqual(report.coverage_contract.omitted_articles, []);
  assert.ok(report.priority_map.filter((item) => item.type === 'article').every((item) => item.required_action?.required_change));

  const queryPrivatePage = report.priority_map.find((item) => item.url === visibleUrl);
  assert.equal(queryPrivatePage.gsc.query_privacy_note, 'PAGE_SIGNAL_VALID_QUERY_ANONYMIZED_OR_NOT_RETURNED');
  assert.equal(queryPrivatePage.diagnosis, 'POSITION_11_30');
});

test('approval wave keeps query-private and zero-visibility pages in the portfolio', () => {
  const { buildSeoApprovalWave } = require('../scripts/growth-tool');
  const report = {
    priority_map: [
      {
        type: 'article', path: 'pierwszy.html', url: 'https://fitpo50.pl/pierwszy.html',
        diagnosis: 'POSITION_11_30', priority: 'P0_NEAR_PAGE_ONE', visibility_segment: 'LOW_VISIBILITY_LONG_TAIL',
        editorial_decision: 'odświeżyć_i_linkować', opportunity_score: 70,
        gsc: { clicks: 1, impressions: 120, ctr: 0.83, position: 14 },
        keywords: { primary: 'Pierwszy temat', evidence: [], secondary: [], intents: [] },
        topology: { suggested_sources: [] },
        required_action: { action_type: 'INTENT_AND_LINKING', required_change: 'Dopasuj odpowiedź do potwierdzonej intencji.' },
      },
      {
        type: 'article', path: 'drugi.html', url: 'https://fitpo50.pl/drugi.html',
        diagnosis: 'ZERO_VISIBILITY_INSPECTION_REQUIRED', priority: 'P1_NO_GSC_DATA_BUILD_DISCOVERY', visibility_segment: 'DORMANT_ZERO_VISIBILITY',
        editorial_decision: 'sprawdzić_indeksację', opportunity_score: 20,
        gsc: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        keywords: { primary: 'Drugi temat', evidence: [], secondary: [], intents: [] },
        topology: { suggested_sources: [] },
        required_action: { action_type: 'URL_INSPECTION', required_change: 'Najpierw sprawdź indeksację.' },
      },
    ],
  };
  const articles = new Map([
    ['pierwszy.html', { title: 'Pierwszy', meta_description: '', date_modified: '' }],
    ['drugi.html', { title: 'Drugi', meta_description: '', date_modified: '' }],
  ]);
  const wave = buildSeoApprovalWave([], { action_cards: [] }, articles, 90, report);

  assert.equal(wave.coverage_contract.status, 'PASS');
  assert.equal(wave.coverage_contract.article_inventory, 2);
  assert.equal(wave.coverage_contract.assigned_actions, 2);
  assert.equal(wave.promising.length, 1);
  assert.equal(wave.repair.length, 1);
});

test('broad conclusions separate indexation from indexed zero visibility', () => {
  const { buildBroadSeoConclusions } = require('../scripts/growth-tool');
  const items = [
    ['CTR_GAP_TOP10', 100, 1, 'ruch'],
    ['POSITION_11_30', 80, 0, 'zdrowie'],
    ['ZERO_VISIBILITY_INDEXED', 0, 0, 'mity'],
    ['ZERO_VISIBILITY_CRAWLED_NOT_INDEXED', 0, 0, 'mity'],
  ].map(([diagnosis, impressions, clicks, category], index) => ({
    type: 'article', diagnosis, category,
    url: `https://fitpo50.pl/test-${index}.html`,
    gsc: { impressions, clicks },
  }));
  const weekly = {
    reporting_windows: {
      day_28: { property: { current: { total_clicks: 10, total_impressions: 1000, avg_position: 18 }, previous: { total_clicks: 20, total_impressions: 1200, avg_position: 16 } } },
    },
    secondary_search_types_28d: { image: { current_pages: [] } },
  };
  const result = buildBroadSeoConclusions({ priority_map: items }, weekly, { checked: [] });
  assert.equal(result.status, 'OK');
  assert.equal(result.summary.articles, 4);
  assert.equal(result.summary.indexed_zero_visibility, 1);
  assert.equal(result.summary.indexation_problem, 1);
  assert.equal(result.summary.visible_articles, 2);
  assert.equal(result.summary.day_28.clicks_change_pct, -50);
  assert.ok(result.priorities.some((item) => item.area === 'KLASTER_MITY'));
});
