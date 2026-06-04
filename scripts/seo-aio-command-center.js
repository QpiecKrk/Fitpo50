#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.cwd();
const SITE_ORIGIN = 'https://fitpo50.pl';
const DEFAULT_WORK_DIR = path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
const DEFAULT_REPO_REPORT_DIR = path.join(ROOT, 'data', 'reports');
const SUPPORT_PAGES = new Set([
  'index.html',
  'porady.html',
  'rusz-sie.html',
  'jedzenie.html',
  'zdrowie.html',
  'ciekawe.html',
  'dziennik.html',
  'o-mnie.html',
  'polityka-prywatnosci.html',
  'search.html',
]);

function parseArgs(argv) {
  const out = {
    inputDir: DEFAULT_WORK_DIR,
    outputDir: DEFAULT_WORK_DIR,
    mirrorDir: DEFAULT_REPO_REPORT_DIR,
    baseUrl: SITE_ORIGIN,
    maxCards: 40,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    const value = String(argv[i + 1] || '').trim();
    if (token === '--input-dir' && value) {
      out.inputDir = path.resolve(ROOT, value);
      i += 1;
      continue;
    }
    if (token === '--output-dir' && value) {
      out.outputDir = path.resolve(ROOT, value);
      i += 1;
      continue;
    }
    if (token === '--mirror-dir' && value) {
      out.mirrorDir = path.resolve(ROOT, value);
      i += 1;
      continue;
    }
    if (token === '--no-mirror') {
      out.mirrorDir = '';
      continue;
    }
    if (token === '--base-url' && value) {
      out.baseUrl = value.replace(/\/+$/, '');
      i += 1;
      continue;
    }
    if (token === '--max-cards' && value) {
      out.maxCards = Math.max(5, Number(value) || out.maxCards);
      i += 1;
    }
  }
  return out;
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { status: 'PARSE_ERROR', file, error: err.message || String(err) };
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeText(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${String(data || '').trimEnd()}\n`, 'utf8');
}

function normalizeUrl(input, baseUrl) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value.replace(/#.*$/, '');
  return `${baseUrl}/${value.replace(/^\.?\//, '')}`.replace(/#.*$/, '');
}

function urlToPath(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\/+/, '') || 'index.html';
  } catch (_) {
    return value.replace(/^\.?\//, '');
  }
}

function isSupportPage(itemOrCard) {
  const file = itemOrCard.file || itemOrCard.path || urlToPath(itemOrCard.url);
  return itemOrCard.type === 'core' || SUPPORT_PAGES.has(String(file || '').replace(/^\.?\//, ''));
}

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromBoolean(value, full = 100, empty = 0) {
  return value ? full : empty;
}

function scoreArticle(item) {
  const gsc = item.gsc || {};
  const topology = item.topology || {};
  const ai = item.aeo_geo_ai || {};
  const performance = item.performance_delta || {};
  const position = Number(gsc.position || 0);
  const impressions = Number(gsc.impressions || 0);
  const ctr = Number(gsc.ctr || 0);
  const inbound = Number(topology.inbound_links || 0);
  const faqCount = Number(ai.faq_count || 0);
  const citationCount = Number(ai.citation_count || 0);

  const seo = Math.round(
    clamp(position > 0 ? (40 - position) * 1.9 : 0, 0, 55)
    + clamp(Math.log10(Math.max(1, impressions)) * 14, 0, 25)
    + clamp(inbound * 4, 0, 20),
  );
  const ctrOpportunity = Math.round(clamp((3 - ctr) * 12, 0, 35));
  const aeo = Math.round(
    scoreFromBoolean(ai.has_quick_answer, 28)
    + clamp(faqCount * 8, 0, 28)
    + scoreFromBoolean(ai.has_faq_schema, 22)
    + scoreFromBoolean(ai.has_speakable, 22),
  );
  const geo = Math.round(
    clamp(citationCount * 14, 0, 70)
    + scoreFromBoolean(ai.has_blogposting, 20)
    + (citationCount >= 4 ? 10 : 0),
  );
  const aio = Math.round(
    Number(ai.ai_readiness_score || 0) * 0.65
    + scoreFromBoolean(ai.has_speakable, 15)
    + scoreFromBoolean(ai.has_blogposting, 10)
    + (citationCount >= 4 ? 10 : 0),
  );
  const promotion = Math.round(
    clamp(inbound * 10, 0, 40)
    + (Array.isArray(topology.suggested_sources) && topology.suggested_sources.length ? 30 : 0)
    + (Array.isArray(item.gsc_submit_after_change) && item.gsc_submit_after_change.length ? 30 : 0),
  );
  const speed = Math.round(
    (item.priority === 'P0_NEAR_PAGE_ONE' ? 35 : 0)
    + (item.priority === 'P1_GROWTH' ? 25 : 0)
    + (performance.conclusion === 'NEW_VISIBILITY' ? 18 : 0)
    + (performance.conclusion === 'CTR_DROP' ? 22 : 0)
    + (topology.suggested_sources?.length ? 15 : 0)
    + (item.keywords?.primary ? 10 : 0),
  );
  const total = Math.round(
    clamp(Number(item.opportunity_score || 0), 0, 100) * 0.34
    + (100 - clamp(seo, 0, 100)) * 0.10
    + (100 - clamp(aeo, 0, 100)) * 0.14
    + (100 - clamp(geo, 0, 100)) * 0.12
    + (100 - clamp(aio, 0, 100)) * 0.10
    + ctrOpportunity * 0.08
    + clamp(speed, 0, 100) * 0.12,
  );

  return {
    total,
    seo: clamp(seo, 0, 100),
    aeo: clamp(aeo, 0, 100),
    geo: clamp(geo, 0, 100),
    aio: clamp(aio, 0, 100),
    promotion: clamp(promotion, 0, 100),
    speed: clamp(speed, 0, 100),
    ctr_opportunity: ctrOpportunity,
  };
}

function actionType(item, score) {
  if (isSupportPage(item)) {
    if (Number(item.gsc?.impressions || 0) > 0 || Number(item.topology?.outbound_internal_links || 0) > 0) {
      return 'P2_CORE_SUPPORT_LINKING';
    }
    return 'P3_CORE_MONITOR';
  }
  if (item.priority === 'P0_NEAR_PAGE_ONE') return 'P0_PUSH_TO_PAGE_ONE';
  if (item.performance_delta?.conclusion === 'CTR_DROP') return 'P0_FIX_CTR_SNIPPET';
  if (item.performance_delta?.conclusion === 'DECLINING_REFRESH') return 'P1_REFRESH_DECLINE';
  if (item.priority === 'P1_NO_GSC_DATA_BUILD_DISCOVERY') return 'P1_BUILD_DISCOVERY';
  if (score.aeo < 75) return 'P1_AEO_UPGRADE';
  if (score.geo < 70) return 'P1_GEO_CITATION_UPGRADE';
  if (score.aio < 80) return 'P2_AIO_EXTRACTION_UPGRADE';
  if (item.visibility_segment === 'LEADER_WINNER') return 'P2_SCALE_WINNER';
  return 'P3_MONITOR';
}

function buildEditTasks(item, score) {
  const tasks = [];
  if (isSupportPage(item)) {
    if (Number(item.gsc?.impressions || 0) > 0 && Number(item.gsc?.ctr || 0) < 1) {
      tasks.push('Popraw title/meta/lead strony wspierającej pod CTR i jasną intencję kategorii.');
    }
    tasks.push('Sprawdź, czy strona wspierająca kieruje moc do najważniejszych artykułów z tej fali.');
    tasks.push('Po zmianach zgłoś w GSC stronę wspierającą oraz najważniejsze artykuły, do których linkuje.');
    tasks.push('Nie dodawaj sztucznego FAQ/cytowań do strony technicznej, jeśli nie pasuje do jej funkcji.');
    return unique(tasks);
  }
  if (!item.aeo_geo_ai?.has_quick_answer) {
    tasks.push('Dodaj lub przebuduj blok Szybka odpowiedź: 45-65 słów, konkret, warunek, bez lania wody.');
  }
  if (Number(item.aeo_geo_ai?.faq_count || 0) < 4) {
    tasks.push('Dodaj/odśwież FAQ z query GSC i realnych pytań; minimum 4 pytania, zero generyków.');
  }
  if (!item.aeo_geo_ai?.has_faq_schema && Number(item.aeo_geo_ai?.faq_count || 0) > 0) {
    tasks.push('Zsynchronizuj widoczne FAQ z JSON-LD FAQPage.');
  }
  if (Number(item.aeo_geo_ai?.citation_count || 0) < 4) {
    tasks.push('Uzupełnij GEO: minimum 4 realne źródła URL wspierające konkretne claimy.');
  }
  if (Number(item.topology?.inbound_links || 0) < 4 || item.topology?.suggested_sources?.length) {
    tasks.push('Dodaj 2-4 linki kontekstowe z sugerowanych stron źródłowych i użyj anchorów opisujących intencję.');
  }
  if (Number(item.gsc?.ctr || 0) < 1 && Number(item.gsc?.impressions || 0) > 0) {
    tasks.push('Popraw title/meta/lead pod CTR: obietnica, konkret po 50-tce, bez clickbaitu.');
  }
  if (score.aio < 80) {
    tasks.push('Sprawdź AIO: BlogPosting, speakable, BreadcrumbList, quick answer i obecność w llms-full.txt.');
  }
  tasks.push('Po zmianie zaktualizuj article:modified_time oraz BlogPosting.dateModified.');
  return unique(tasks);
}

function buildValidationCommands(item) {
  const file = urlToPath(item.url);
  const slug = file.replace(/\.html$/i, '');
  return [
    `node scripts/validate-article-standard.js ${file}`,
    `node scripts/article-contract-check.js ${file} _site/${file}`,
    `node scripts/predeploy-gate.js --slug ${slug}`,
    'npm run llms:full',
    'npm run assets:mirror:sync',
    'npm run predeploy:check',
  ];
}

function buildPromotionQueue(item, baseUrl) {
  const fromPromotionPlaces = (item.promotion_places || []).flatMap((place) => place.urls || []);
  const fromSubmitList = item.gsc_submit_after_change || [];
  const sourceUrls = (item.topology?.suggested_sources || []).map((source) => normalizeUrl(source.from, baseUrl));
  return unique([item.url, ...fromSubmitList, ...sourceUrls, ...fromPromotionPlaces].map((url) => normalizeUrl(url, baseUrl)));
}

function buildCard(item, baseUrl) {
  const score = scoreArticle(item);
  const type = actionType(item, score);
  const queries = item.all_keyword_registry || item.keywords?.evidence || [];
  const usefulQueries = queries
    .filter((row) => row && (row.useful_for_planning !== false))
    .slice(0, 12)
    .map((row) => ({
      query: row.query || row.raw_query || '',
      intent: row.intent || 'informacyjna',
      impressions: Math.round(Number(row.impressions || 0)),
      clicks: Math.round(Number(row.clicks || 0)),
      position: Number(Number(row.position || 0).toFixed(2)),
    }));
  return {
    type,
    score,
    url: item.url,
    file: urlToPath(item.url),
    title: item.title || item.h1 || '',
    priority: item.priority,
    segment: item.visibility_segment,
    editorial_decision: item.editorial_decision,
    gsc: item.gsc,
    performance_delta: item.performance_delta,
    keyword_plan: {
      primary: item.keywords?.primary || '',
      secondary: item.keywords?.secondary || [],
      intents: item.keywords?.intents || [],
      useful_queries: usefulQueries,
    },
    tasks: buildEditTasks(item, score),
    internal_link_sources: (item.topology?.suggested_sources || []).slice(0, 8),
    promotion_urls: buildPromotionQueue(item, baseUrl),
    validation_commands: buildValidationCommands(item),
    measurement: {
      baseline: item.refresh_impact?.baseline || item.gsc,
      checkpoints: item.refresh_impact?.checkpoints || null,
      rule: 'Po deployu sprawdź GSC po 7/14/28 dniach: impressions, CTR, pozycja, kliknięcia i query_changes.',
    },
  };
}

function buildWaves(cards) {
  const actionable = cards.filter((card) => card.type !== 'P3_MONITOR');
  const used = new Set();
  const take = (predicate, limit) => {
    const picked = [];
    for (const card of actionable) {
      if (used.has(card.url) || !predicate(card)) continue;
      picked.push(card);
      used.add(card.url);
      if (picked.length >= limit) break;
    }
    return picked;
  };
  return {
    wave_1_fast_page_one: take((card) => card.type === 'P0_PUSH_TO_PAGE_ONE' || card.type === 'P0_FIX_CTR_SNIPPET', 12),
    wave_2_discovery: take((card) => card.type === 'P1_BUILD_DISCOVERY' || (card.segment === 'DORMANT_ZERO_VISIBILITY' && !card.type.includes('CORE')), 12),
    wave_3_refresh_geo_aio: take((card) => ['P1_REFRESH_DECLINE', 'P1_AEO_UPGRADE', 'P1_GEO_CITATION_UPGRADE', 'P2_AIO_EXTRACTION_UPGRADE'].includes(card.type), 12),
    wave_4_scale_winners: take((card) => card.type === 'P2_SCALE_WINNER' || card.segment === 'LEADER_WINNER', 8),
    wave_5_core_support: take((card) => card.type === 'P2_CORE_SUPPORT_LINKING', 8),
  };
}

function countBy(items, key) {
  const out = {};
  for (const item of items) {
    const value = String(item[key] || 'unknown');
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

function buildReport(args) {
  const priorityPath = path.join(args.inputDir, 'gsc-priority-map.json');
  const weeklyPath = path.join(args.inputDir, 'gsc-weekly-report.json');
  const weeklyApiPath = path.join(args.inputDir, 'gsc-weekly-report-api.json');
  const aeoPath = path.join(args.inputDir, 'aeo-opportunities.json');
  const priority = readJsonIfExists(priorityPath);
  if (!priority || !Array.isArray(priority.priority_map)) {
    throw new Error(`Brak poprawnego gsc-priority-map.json: ${priorityPath}`);
  }

  const weekly = readJsonIfExists(weeklyPath);
  const weeklyApi = readJsonIfExists(weeklyApiPath);
  const aeo = readJsonIfExists(aeoPath);
  const cards = priority.priority_map
    .filter((item) => item && item.type !== 'redirect')
    .map((item) => buildCard(item, args.baseUrl))
    .sort((a, b) => b.score.total - a.score.total || Number(b.gsc?.impressions || 0) - Number(a.gsc?.impressions || 0));
  const waves = buildWaves(cards);
  const gscSubmitQueue = unique([
    ...waves.wave_1_fast_page_one,
    ...waves.wave_2_discovery,
    ...waves.wave_3_refresh_geo_aio,
  ].flatMap((card) => card.promotion_urls)).slice(0, 120);

  return {
    generated_at: new Date().toISOString(),
    machine: {
      name: 'FitPo50 SEO -> AEO -> GEO -> AIO Command Center',
      purpose: 'Jedna kolejka decyzyjna: dane GSC + portfolio URL-i + szybkie paczki zmian + promocja + pomiar efektu.',
      input_dir: args.inputDir,
      output_dir: args.outputDir,
    },
    data_quality: {
      priority_map: priority.data_quality || null,
      weekly_report_status: weekly?.status || 'INSUFFICIENT_DATA',
      weekly_api_ranges: weeklyApi?.ranges || null,
      aeo_opportunities_status: aeo ? 'ok' : 'INSUFFICIENT_DATA',
      previous_delta_available: Boolean(priority.data_quality?.page_coverage?.performance_delta_available),
    },
    portfolio: {
      total_urls: cards.length,
      action_types: countBy(cards, 'type'),
      priorities: countBy(cards, 'priority'),
      segments: countBy(cards, 'segment'),
      average_scores: {
        total: average(cards.map((card) => card.score.total)),
        seo: average(cards.map((card) => card.score.seo)),
        aeo: average(cards.map((card) => card.score.aeo)),
        geo: average(cards.map((card) => card.score.geo)),
        aio: average(cards.map((card) => card.score.aio)),
        promotion: average(cards.map((card) => card.score.promotion)),
      },
    },
    waves,
    top_action_cards: cards.slice(0, args.maxCards),
    gsc_submit_queue: gscSubmitQueue,
    promotion_playbook: [
      'GSC URL Inspection: zgłaszaj target i strony źródłowe po dodaniu linków.',
      'Internal links: 2-4 linki kontekstowe z klastra, anchor ma opisywać intencję.',
      'Sitemap/dateModified: po zmianie aktualizuj daty i eksportuj _site.',
      'llms-full.txt: regeneruj po zmianie, żeby AI miało aktualny tekst.',
      'IndexNow/Bing: używaj dla nowych, dormant i no-data URL-i, jeśli konfiguracja jest aktywna.',
      'Social/LinkedIn/Facebook: traktuj jako dystrybucję, nie zamiennik indeksacji.',
    ],
    validation_pipeline: [
      'node --check scripts/gsc-weekly-api-report.js scripts/gsc-priority-map.js scripts/seo-aio-command-center.js',
      'npm run gsc:priority-map -- --input-dir ~/Downloads/gsc-auto-input --output-dir data/reports',
      'npm run seo:aio:machine -- --input-dir ~/Downloads/gsc-auto-input --output-dir ~/Downloads/gsc-auto-input',
      'npm run seo:aio:apply-wave -- --input ~/Downloads/gsc-auto-input/seo-aio-command-center.json --output-dir ~/Downloads/gsc-auto-input --wave 1 --limit 5',
      'npm run llms:full',
      'npm run assets:mirror:sync',
      'npm run predeploy:check',
    ],
  };
}

function average(values) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1));
}

function writeMarkdown(report, file) {
  const lines = [];
  lines.push('# FitPo50 SEO → AEO → GEO → AIO Command Center');
  lines.push('');
  lines.push(`Wygenerowano: ${report.generated_at}`);
  lines.push('');
  lines.push('## Decyzja Operacyjna');
  lines.push(`- URL-e w portfelu: ${report.portfolio.total_urls}`);
  lines.push(`- Średni score: total ${report.portfolio.average_scores.total}, SEO ${report.portfolio.average_scores.seo}, AEO ${report.portfolio.average_scores.aeo}, GEO ${report.portfolio.average_scores.geo}, AIO ${report.portfolio.average_scores.aio}`);
  lines.push(`- Delta previous 90d: ${report.data_quality.previous_delta_available ? 'dostępna' : 'brak danych w poprzednim okresie / INSufficient previous data'}`);
  lines.push('- Cel: szybko wdrażać fale zmian, ale każda fala ma mieć walidację, listę URL-i do GSC i pomiar 7/14/28 dni.');
  lines.push('');
  lines.push('## Fala 1 — Szybkie Wejście Na Pierwszą Stronę');
  pushCards(lines, report.waves.wave_1_fast_page_one, 12);
  lines.push('');
  lines.push('## Fala 2 — Uśpione I Nowe URL-e');
  pushCards(lines, report.waves.wave_2_discovery, 12);
  lines.push('');
  lines.push('## Fala 3 — Refresh GEO/AIO');
  pushCards(lines, report.waves.wave_3_refresh_geo_aio, 12);
  lines.push('');
  lines.push('## Fala 4 — Skalowanie Liderów');
  pushCards(lines, report.waves.wave_4_scale_winners, 8);
  lines.push('');
  lines.push('## Fala 5 — Strony Wspierające');
  pushCards(lines, report.waves.wave_5_core_support, 8);
  lines.push('');
  lines.push('## TOP Action Cards');
  pushCards(lines, report.top_action_cards, 20);
  lines.push('');
  lines.push('## GSC Submit Queue');
  report.gsc_submit_queue.slice(0, 80).forEach((url) => lines.push(`- ${url}`));
  lines.push('');
  lines.push('## Promotion Playbook');
  report.promotion_playbook.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('## Validation Pipeline');
  report.validation_pipeline.forEach((cmd) => lines.push(`- \`${cmd}\``));
  writeText(file, lines.join('\n'));
}

function pushCards(lines, cards, limit) {
  if (!cards.length) {
    lines.push('- Brak kart w tej grupie.');
    return;
  }
  cards.slice(0, limit).forEach((card, index) => {
    lines.push(`${index + 1}. ${card.url}`);
    lines.push(`   - typ: ${card.type}, score: ${card.score.total}, SEO/AEO/GEO/AIO: ${card.score.seo}/${card.score.aeo}/${card.score.geo}/${card.score.aio}`);
    lines.push(`   - GSC: impr ${card.gsc?.impressions || 0}, clicks ${card.gsc?.clicks || 0}, CTR ${card.gsc?.ctr || 0}%, pos ${card.gsc?.position || 0}`);
    lines.push(`   - fraza: ${card.keyword_plan.primary || 'INSUFFICIENT_DATA'}; decyzja: ${card.editorial_decision}`);
    card.tasks.slice(0, 4).forEach((task) => lines.push(`   - zadanie: ${task}`));
    const sources = card.internal_link_sources.slice(0, 3).map((source) => `${source.from} → "${source.anchor}"`);
    if (sources.length) lines.push(`   - linki źródłowe: ${sources.join(' ; ')}`);
    lines.push(`   - GSC: ${card.promotion_urls.slice(0, 5).join(', ')}`);
  });
}

function writeReportCopies(report, args) {
  const jsonName = 'seo-aio-command-center.json';
  const mdName = 'seo-aio-command-center.md';
  const queueName = 'gsc-submit-queue.txt';
  const changeQueueName = 'gsc-change-queue.json';
  const outputJson = path.join(args.outputDir, jsonName);
  const outputMd = path.join(args.outputDir, mdName);
  const outputQueue = path.join(args.outputDir, queueName);
  const outputChangeQueue = path.join(args.outputDir, changeQueueName);

  writeJson(outputJson, report);
  writeMarkdown(report, outputMd);
  writeText(outputQueue, report.gsc_submit_queue.join('\n'));
  writeJson(outputChangeQueue, report.top_action_cards);

  const outputs = { outputJson, outputMd, outputQueue, outputChangeQueue };
  if (args.mirrorDir) {
    const mirrorJson = path.join(args.mirrorDir, jsonName);
    const mirrorMd = path.join(args.mirrorDir, mdName);
    const mirrorQueue = path.join(args.mirrorDir, queueName);
    const mirrorChangeQueue = path.join(args.mirrorDir, changeQueueName);
    writeJson(mirrorJson, report);
    writeMarkdown(report, mirrorMd);
    writeText(mirrorQueue, report.gsc_submit_queue.join('\n'));
    writeJson(mirrorChangeQueue, report.top_action_cards);
    outputs.mirrorJson = mirrorJson;
    outputs.mirrorMd = mirrorMd;
    outputs.mirrorQueue = mirrorQueue;
    outputs.mirrorChangeQueue = mirrorChangeQueue;
  }
  return outputs;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport(args);
  const outputs = writeReportCopies(report, args);
  console.log(`[SEO-AIO-MACHINE] urls=${report.portfolio.total_urls} cards=${report.top_action_cards.length}`);
  console.log(`[SEO-AIO-MACHINE] report: ${outputs.outputMd}`);
  console.log(`[SEO-AIO-MACHINE] queue: ${outputs.outputQueue}`);
  if (outputs.mirrorMd) console.log(`[SEO-AIO-MACHINE] mirror: ${outputs.mirrorMd}`);
}

main();
