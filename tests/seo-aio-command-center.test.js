const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function writeFixture(dir) {
  const priorityMap = {
    data_quality: {
      page_coverage: {
        performance_delta_available: true,
      },
    },
    priority_map: [
      {
        priority: 'P0_NEAR_PAGE_ONE',
        visibility_segment: 'CTR_GAP_TOP10',
        editorial_decision: 'promować',
        opportunity_score: 80,
        url: 'https://fitpo50.pl/test-artykul.html',
        path: 'test-artykul.html',
        type: 'article',
        title: 'Test artykuł',
        gsc: { clicks: 0, impressions: 100, ctr: 0.2, position: 8 },
        topology: {
          inbound_links: 2,
          outbound_internal_links: 4,
          suggested_sources: [{ from: 'source.html', anchor: 'test anchor' }],
        },
        keywords: {
          primary: 'test fraza',
          secondary: ['test fraza wspierająca'],
          intents: ['how-to'],
          evidence: [{ query: 'test fraza', impressions: 100, clicks: 0, ctr: 0.2, position: 8 }],
        },
        all_keyword_registry: [{ query: 'test fraza', impressions: 100, clicks: 0, ctr: 0.2, position: 8, intent: 'how-to', useful_for_planning: true }],
        refresh_impact: { baseline: { clicks: 0, impressions: 100, ctr: 0.2, position: 8 }, checkpoints: { day_7: '2026-06-11' } },
        performance_delta: { conclusion: 'NEW_VISIBILITY', delta: { impressions: 100, clicks: 0, ctr_pp: 0.2, position_improvement: 0 }, query_changes: [] },
        aeo_geo_ai: { ai_readiness_score: 55, has_quick_answer: false, faq_count: 1, has_faq_schema: false, has_blogposting: true, has_speakable: false, citation_count: 1 },
        gsc_submit_after_change: ['https://fitpo50.pl/test-artykul.html', 'https://fitpo50.pl/source.html'],
        promotion_places: [],
      },
      {
        priority: 'P3_MAINTAIN',
        visibility_segment: 'DORMANT_ZERO_VISIBILITY',
        editorial_decision: 'support',
        opportunity_score: 10,
        url: 'https://fitpo50.pl/polityka-prywatnosci.html',
        path: 'polityka-prywatnosci.html',
        type: 'article',
        title: 'Polityka prywatności',
        gsc: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        topology: { inbound_links: 0, outbound_internal_links: 0, suggested_sources: [] },
        keywords: { primary: 'polityka prywatności', secondary: [], intents: [], evidence: [] },
        all_keyword_registry: [],
        refresh_impact: { baseline: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, checkpoints: null },
        performance_delta: { conclusion: 'DORMANT', delta: { impressions: 0, clicks: 0, ctr_pp: 0, position_improvement: 0 }, query_changes: [] },
        aeo_geo_ai: { ai_readiness_score: 0, has_quick_answer: false, faq_count: 0, has_faq_schema: false, has_blogposting: false, has_speakable: false, citation_count: 0 },
        gsc_submit_after_change: ['https://fitpo50.pl/polityka-prywatnosci.html'],
        promotion_places: [],
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'gsc-priority-map.json'), `${JSON.stringify(priorityMap, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'gsc-weekly-report.json'), '{"status":"ok"}\n');
  fs.writeFileSync(path.join(dir, 'aeo-opportunities.json'), '{"status":"ok"}\n');
}

test('seo-aio command center builds waves, queues and support-page tasks', () => {
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-aio-input-'));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-aio-output-'));
  writeFixture(inputDir);

  const result = spawnSync(
    'node',
    ['scripts/seo-aio-command-center.js', '--input-dir', inputDir, '--output-dir', outputDir, '--no-mirror'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'seo-aio-command-center.json'), 'utf8'));
  assert.equal(report.portfolio.total_urls, 2);
  assert.equal(report.waves.wave_1_fast_page_one[0].url, 'https://fitpo50.pl/test-artykul.html');
  assert.ok(report.gsc_submit_queue.includes('https://fitpo50.pl/source.html'));

  const waveUrls = Object.values(report.waves).flat().map((card) => card.url);
  assert.equal(new Set(waveUrls).size, waveUrls.length);

  const supportCard = report.top_action_cards.find((card) => card.url.endsWith('/polityka-prywatnosci.html'));
  assert.ok(supportCard);
  assert.equal(supportCard.type, 'P3_CORE_MONITOR');
  assert.ok(supportCard.tasks.some((task) => task.includes('Nie dodawaj sztucznego FAQ')));
  assert.ok(!supportCard.tasks.some((task) => task.includes('Dodaj/odśwież FAQ')));
});
