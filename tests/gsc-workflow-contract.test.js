const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { writeManifestFromApiReport } = require('../scripts/lib/gsc-data-contract');
const { reportingRanges } = require('../scripts/gsc-weekly-api-report');
const { isEditorialQuery } = require('../scripts/lib/gsc-editorial-query');

const ROOT = path.resolve(__dirname, '..');

test('search operators stay in raw GSC data but cannot drive editorial opportunities', () => {
  assert.equal(isEditorialQuery('krew pępowinowa -site:reddit.com'), false);
  assert.equal(isEditorialQuery('nadcisnienia site:fitpo50.pl'), false);
  assert.equal(isEditorialQuery('dorsifleksja'), true);
  assert.equal(isEditorialQuery('kreatyna a białko'), true);
});

test('GSC separates property, page and disclosed-query metrics without generic copy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-gsc-test-'));
  fs.writeFileSync(path.join(dir, 'queries.csv'), [
    'query,clicks,impressions,ctr,position',
    'apob norma,0,100,0,8',
    'sakady,0,90,0,9',
    'krew pepowinowa -site:reddit.com,0,150,0,1.4',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'pages.csv'), [
    'page,clicks,impressions,ctr,position',
    'https://fitpo50.pl/apob.html,3,600,0.5,11',
    'https://fitpo50.pl/sakady.html,4,400,1,9',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'query-pages.csv'), [
    'query,page,clicks,impressions,ctr,position',
    'apob norma,https://fitpo50.pl/apob.html,0,100,0,8',
    'sakady,https://fitpo50.pl/sakady.html,0,90,0,9',
    'krew pepowinowa -site:reddit.com,https://fitpo50.pl/apob.html,0,150,0,1.4',
  ].join('\n'));
  const apiReport = {
    generated_at: new Date().toISOString(),
    status: 'ok',
    property: 'sc-domain:fitpo50.pl',
    reporting_windows: Object.fromEntries(Object.entries(reportingRanges()).map(([key, range]) => [key, { range }])),
    summary: {
      primary_layer: 'property',
      layers: {
        property: {
          status: 'PRIMARY',
          current: { total_clicks: 50, total_impressions: 5000, avg_ctr: 1, avg_position: 18 },
          previous: { total_clicks: 30, total_impressions: 4000, avg_ctr: 0.75, avg_position: 20 },
        },
      },
    },
  };
  fs.writeFileSync(path.join(dir, 'gsc-weekly-report-api.json'), JSON.stringify(apiReport));
  writeManifestFromApiReport(apiReport, dir);

  const outputJson = path.join(dir, 'report.json');
  const outputMd = path.join(dir, 'report.md');
  const result = spawnSync('node', [
    'scripts/gsc-weekly-csv-report.js',
    '--input-dir', dir,
    '--output-json', outputJson,
    '--output-md', outputMd,
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(fs.readFileSync(outputJson, 'utf8'));
  const markdown = fs.readFileSync(outputMd, 'utf8');
  const aeo = JSON.parse(fs.readFileSync(path.join(dir, 'aeo-opportunities.json'), 'utf8'));
  assert.equal(report.summary.primary_layer, 'property');
  assert.equal(report.summary.total_clicks, 50);
  assert.equal(report.summary.layers.pages.current.total_clicks, 7);
  assert.equal(report.summary.layers.disclosed_queries.current.total_impressions, 340);
  assert.equal(report.data_quality.rows_search_operator_queries_excluded_from_opportunities, 1);
  assert.equal(report.data_quality.min_impressions_for_ctr_review, 30);
  assert.deepEqual(report.opportunities.top3_zero_click, []);
  assert.ok(report.opportunities.top3_zero_click.every((item) => !item.query.includes('site:')));
  assert.ok(report.opportunities.ctr_problems.every((item) => !item.query.includes('site:')));
  assert.ok(report.weekly_plan.every((item) => !item.includes('site:')));
  assert.equal(report.article_delta_plan[0].editorial_status, 'REQUIRES_MANUAL_ON_PAGE_REVIEW');
  assert.equal(report.article_delta_plan[0].delta, null);
  assert.equal(aeo.top10_urls.find((item) => item.supporting_queries.includes('sakady')).url, 'https://fitpo50.pl/sakady.html');
  assert.match(markdown, /Warstwy pomiaru GSC/);
  assert.doesNotMatch(markdown, /co działa i jak zacząć|Konkretne kroki|Ile czasu potrzeba/);
});
