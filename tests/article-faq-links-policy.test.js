const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { POLICY } = require('../scripts/lib/article-policy');

test('wspólna polityka jawnie dopuszcza brak FAQ', () => {
  assert.equal(POLICY.FAQ?.MINIMUM, 0);
});

if (POLICY.FAQ?.MINIMUM === 0) {
  const { buildEditTasks } = require('../scripts/seo-aio-command-center');
  const {
    buildActions,
    evaluateGrowthArticle,
    scoreArticle,
  } = require('../scripts/growth-tool');
  const { priorityScore } = require('../scripts/content-freshness-bot');
  const { buildFaqRefreshReport } = require('../scripts/faq-refresh-report');

  function seoItem(overrides = {}) {
    return {
      type: 'article',
      gsc: { impressions: 0, ctr: 0 },
      topology: { inbound_links: 4, suggested_sources: [] },
      aeo_geo_ai: {
        has_quick_answer: true,
        faq_count: 0,
        has_faq_schema: false,
        citation_count: 4,
      },
      ...overrides,
    };
  }

  function growthArticle(overrides = {}) {
    return {
      has_quick_answer: true,
      has_evidence_box: true,
      has_doctor_box: true,
      faq_items: 0,
      citation_count: 4,
      inbound_link_count: 3,
      internal_link_count: 2,
      table_count: 0,
      tables_with_caption: 0,
      pdf_links: ['article.pdf'],
      has_blogposting: true,
      has_breadcrumbs: true,
      topic: 'inne',
      ...overrides,
    };
  }

  test('0 FAQ nie tworzy zadań ani kar w konsumentach polityki', () => {
    const seoTasks = buildEditTasks(seoItem(), { aio: 100 });
    const growthActions = buildActions(growthArticle(), null);
    const scoreWithoutFaq = scoreArticle(growthArticle(), null);
    const scoreWithFaq = scoreArticle(growthArticle({ faq_items: 4 }), null);
    const freshnessWithoutFaq = priorityScore({
      ageClass: 'fresh', faqCount: 0, sourceCount: 4, linkCount: 2, words: 500,
    });
    const freshnessWithFaq = priorityScore({
      ageClass: 'fresh', faqCount: 4, sourceCount: 4, linkCount: 2, words: 500,
    });

    assert.equal(seoTasks.some((task) => /dodaj|rozbuduj/i.test(task) && /FAQ/i.test(task)), false);
    assert.equal(growthActions.some((action) => action.type === 'faq'), false);
    assert.equal(scoreWithoutFaq, scoreWithFaq);
    assert.equal(freshnessWithoutFaq, freshnessWithFaq);
  });

  test('źródła FAQ pozostają ograniczone do GSC, PAA i autocomplete', () => {
    assert.deepEqual(POLICY.FAQ_SOURCE_TYPES.allowed_for_new_content, ['gsc', 'paa', 'autocomplete']);
    assert.equal(POLICY.FAQ_SOURCE_TYPES.allowed_for_new_content.includes('manual_research'), false);
    assert.equal(POLICY.FAQ_SOURCE_TYPES.legacy_type, 'manual_research');
    assert.equal(POLICY.FAQ_SOURCE_TYPES.legacy_baseline_error, 'FAQ_RESEARCH_MANUAL_RESEARCH_LEGACY');
  });

  test('linki w treści poniżej 2 ostrzegają, ale nie blokują growth verify', () => {
    for (const internal_link_count of [0, 1]) {
      const result = evaluateGrowthArticle(growthArticle({ internal_link_count }));
      assert.deepEqual(result.failures, []);
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0], /mniej niż 2 linki wewnętrzne/);
    }

    const enough = evaluateGrowthArticle(growthArticle({ internal_link_count: 2 }));
    assert.deepEqual(enough.failures, []);
    assert.deepEqual(enough.warnings, []);
  });

  test('minimum 4 źródeł pozostaje wspólnym progiem', () => {
    const freshnessThree = priorityScore({
      ageClass: 'fresh', faqCount: 0, sourceCount: 3, linkCount: 2, words: 500,
    });
    const freshnessFour = priorityScore({
      ageClass: 'fresh', faqCount: 0, sourceCount: 4, linkCount: 2, words: 500,
    });
    const actionsThree = buildActions(growthArticle({ citation_count: 3 }), null);
    const actionsFour = buildActions(growthArticle({ citation_count: 4 }), null);

    assert.ok(freshnessThree > freshnessFour);
    assert.equal(freshnessFour, 0);
    assert.equal(actionsThree.some((action) => action.type === 'citations'), true);
    assert.equal(actionsFour.some((action) => action.type === 'citations'), false);
  });

  test('linki przychodzące pozostają sugestią SEO, a nie bramką treści', () => {
    const article = growthArticle({ inbound_link_count: 0, internal_link_count: 2 });
    const actions = buildActions(article, null);
    const verification = evaluateGrowthArticle(article);

    assert.equal(actions.some((action) => action.type === 'internal-links'), true);
    assert.deepEqual(verification.failures, []);
    assert.deepEqual(verification.warnings, []);
  });

  test('raport FAQ obejmuje tylko istniejące FAQ wymagające odświeżenia', () => {
    const report = buildFaqRefreshReport([
      { file: 'bez-faq.html', faqCount: 0, dateModified: '2020-01-01', ageDays: 500 },
      { file: 'stare-faq.html', faqCount: 1, dateModified: '2020-01-01', ageDays: 500 },
      { file: 'swieze-faq.html', faqCount: 1, dateModified: '2026-10-28', ageDays: 1 },
    ]);

    assert.deepEqual(report.stale.map((item) => item.file), ['stare-faq.html']);
    assert.equal(report.totals.staleFaqCandidates, 1);
    assert.equal('lowFaq' in report, false);
    assert.equal('lowFaqCount' in report.totals, false);
  });

  test('CLI raportu FAQ działa bez zapisu w repo', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-faq-policy-'));
    const script = path.resolve(__dirname, '..', 'scripts', 'faq-refresh-report.js');
    const result = spawnSync(process.execPath, [script], { cwd: workspace, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /stale FAQ candidates: 0/);
    assert.equal(fs.existsSync(path.join(workspace, 'data', 'reports', 'faq-refresh-report.json')), true);
  });

  test('konsumenci odczytują progi ze wspólnego obiektu POLICY', () => {
    const original = {
      faq: POLICY.FAQ.MINIMUM,
      sources: POLICY.WORDS.CITATION_MIN_URLS,
      links: POLICY.WORDS.INTERNAL_LINKS_WARN_BELOW,
    };

    try {
      POLICY.FAQ.MINIMUM = 1;
      POLICY.WORDS.CITATION_MIN_URLS = 5;
      POLICY.WORDS.INTERNAL_LINKS_WARN_BELOW = 3;

      assert.equal(
        buildEditTasks(seoItem(), { aio: 100 }).some((task) => /FAQ/i.test(task)),
        true,
      );
      assert.equal(
        buildActions(growthArticle({ faq_items: 0, citation_count: 4 }), null).some((action) => action.type === 'faq'),
        true,
      );
      assert.ok(priorityScore({
        ageClass: 'fresh', faqCount: 0, sourceCount: 4, linkCount: 2, words: 500,
      }) > 0);

      const verification = evaluateGrowthArticle(growthArticle({ internal_link_count: 2 }));
      assert.equal(verification.warnings.length, 1);

      const report = buildFaqRefreshReport([
        { file: 'jedno-faq.html', faqCount: 1, dateModified: '2020-01-01', ageDays: 500 },
        { file: 'dwa-faq.html', faqCount: 2, dateModified: '2020-01-01', ageDays: 500 },
      ]);
      assert.deepEqual(report.stale.map((item) => item.file), ['dwa-faq.html']);
    } finally {
      POLICY.FAQ.MINIMUM = original.faq;
      POLICY.WORDS.CITATION_MIN_URLS = original.sources;
      POLICY.WORDS.INTERNAL_LINKS_WARN_BELOW = original.links;
    }
  });
}
