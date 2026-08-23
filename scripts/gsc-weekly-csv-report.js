#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.cwd();
const DEFAULT_WORK_DIR = process.env.GSC_WORK_DIR || path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
const DEFAULT_INPUT_DIR = DEFAULT_WORK_DIR;
const DEFAULT_OUTPUT_JSON = path.join(DEFAULT_WORK_DIR, 'gsc-weekly-report.json');
const DEFAULT_OUTPUT_MD = path.join(DEFAULT_WORK_DIR, 'gsc-weekly-report.md');
const DEFAULT_AEO_OUTPUT_JSON = path.join(DEFAULT_WORK_DIR, 'aeo-opportunities.json');
const DEFAULT_AEO_OUTPUT_MD = path.join(DEFAULT_WORK_DIR, 'aeo-opportunities.md');
const AI_QUERY_PATTERNS = [
  /\bchatgpt\b/i,
  /\bgemini\b/i,
  /\bperplexity\b/i,
  /\bclaude\b/i,
  /\bcopilot\b/i,
  /\bbing ai\b/i,
  /\bai search\b/i,
  /\bai overview(s)?\b/i,
];
const AI_REFERRER_HOSTS = [
  'chatgpt.com',
  'gemini.google.com',
  'perplexity.ai',
  'claude.ai',
  'copilot.microsoft.com',
  'bing.com',
];

function parseArgs(argv) {
  const out = {
    inputDir: DEFAULT_INPUT_DIR,
    outputJson: DEFAULT_OUTPUT_JSON,
    outputMd: DEFAULT_OUTPUT_MD,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = String(argv[i] || '').trim();
    if (t === '--input-dir') {
      out.inputDir = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (t === '--output-json') {
      out.outputJson = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (t === '--output-md') {
      out.outputMd = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
    }
  }
  return out;
}

function resolveAeoOutputs(inputDir) {
  const baseDir = path.resolve(ROOT, String(inputDir || DEFAULT_WORK_DIR));
  return {
    outputJson: path.join(baseDir, 'aeo-opportunities.json'),
    outputMd: path.join(baseDir, 'aeo-opportunities.md'),
  };
}

function normalizeKey(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNumber(input) {
  const raw = String(input || '').trim();
  if (!raw) return 0;
  const withoutPercent = raw.replace(/%/g, '').trim();
  const normalized = withoutPercent
    .replace(/\s+/g, '')
    .replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function parseCsv(text) {
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = src.split('\n')[0] || '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const score = firstLine.split(d).length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cell += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === best) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const filtered = rows.filter((r) => r.some((c) => String(c || '').trim() !== ''));
  if (!filtered.length) return [];
  const headers = filtered[0].map((h) => String(h || '').trim());
  const body = filtered.slice(1);
  return body.map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = String(r[idx] || '').trim();
    });
    return obj;
  });
}

function isAiQuery(query) {
  const q = String(query || '').trim();
  if (!q) return false;
  return AI_QUERY_PATTERNS.some((re) => re.test(q));
}

function extractHostname(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      return String(new URL(raw).hostname || '').toLowerCase();
    }
  } catch (_) {
    return '';
  }
  return raw.toLowerCase().replace(/^www\./, '').split('/')[0];
}

function isAiHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  return AI_REFERRER_HOSTS.some((base) => h === base || h.endsWith(`.${base}`));
}

function readAiReferrerRows(inputDir) {
  const referrersPath = path.join(inputDir, 'referrers.csv');
  if (!fs.existsSync(referrersPath)) {
    return { found: false, path: referrersPath, rows: [] };
  }
  const rawRows = parseCsv(fs.readFileSync(referrersPath, 'utf8'));
  const rows = rawRows.map((r) => {
    const keys = Object.keys(r || {});
    const hostKey = keys.find((k) => /(host|hostname|source|referrer|domain)/i.test(String(k || '')));
    const valueKey = keys.find((k) => /(users|sessions|visits|clicks|count|traffic)/i.test(String(k || '')));
    return {
      host: extractHostname(hostKey ? r[hostKey] : ''),
      visits: valueKey ? parseNumber(r[valueKey]) : 0,
    };
  }).filter((r) => r.host);
  return { found: true, path: referrersPath, rows };
}

function buildAiReferrerMonitor(queryRows, inputDir) {
  const aiQueries = queryRows
    .filter((r) => isAiQuery(r.query))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20)
    .map((r) => ({
      query: r.query,
      clicks: Math.round(Number(r.clicks || 0)),
      impressions: Math.round(Number(r.impressions || 0)),
      ctr: Number(Number(r.ctr || 0).toFixed(2)),
      position: Number(Number(r.position || 0).toFixed(2)),
    }));

  const ref = readAiReferrerRows(inputDir);
  const aiRefByHost = new Map();
  for (const row of ref.rows) {
    if (!isAiHost(row.host)) continue;
    const prev = aiRefByHost.get(row.host) || 0;
    aiRefByHost.set(row.host, prev + Number(row.visits || 0));
  }
  const aiReferrers = [...aiRefByHost.entries()]
    .map(([host, visits]) => ({ host, visits: Math.round(visits) }))
    .sort((a, b) => b.visits - a.visits);

  return {
    status: aiQueries.length || aiReferrers.length ? 'ok' : 'INSUFFICIENT_DATA',
    referrers_file_found: ref.found,
    referrers_file: ref.path,
    ai_queries: aiQueries,
    ai_referrers: aiReferrers,
  };
}

function headerType(sampleRow) {
  const keys = Object.keys(sampleRow || {}).map(normalizeKey);
  const hasQuery = keys.some((k) => /(^| )query( |$)|(^| )zapytan/.test(k));
  const hasPage = keys.some((k) => /(^| )page( |$)|(^| )stron/.test(k));
  if (hasQuery && hasPage) return 'query_pages';
  if (hasQuery) return 'queries';
  if (hasPage) return 'pages';
  return 'unknown';
}

function mapRow(raw) {
  const out = {
    query: '',
    page: '',
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };

  for (const [k, v] of Object.entries(raw || {})) {
    const nk = normalizeKey(k);
    if (!out.query && /(^| )query( |$)|(^| )zapytan/.test(nk)) out.query = String(v || '').trim();
    if (!out.page && /(^| )page( |$)|(^| )stron/.test(nk)) out.page = String(v || '').trim();
    if (/(^| )clicks( |$)|(^| )klikniec/.test(nk)) out.clicks = parseNumber(v);
    if (/(^| )impressions( |$)|(^| )wyswietlen/.test(nk)) out.impressions = parseNumber(v);
    if (/(^| )ctr( |$)/.test(nk)) out.ctr = parseNumber(v);
    if (/(^| )position( |$)|(^| )pozycj/.test(nk)) out.position = parseNumber(v);
  }

  return out;
}

function median(values) {
  const arr = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2) return arr[mid];
  return (arr[mid - 1] + arr[mid]) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function opportunityScore(row, ctrMedian) {
  const positionScore = row.position > 0 ? clamp((20 - row.position) / 20, 0, 1) : 0;
  const impressionsScore = clamp(Math.log10(Math.max(1, row.impressions)) / 4, 0, 1);
  const ctrGap = clamp((Math.max(ctrMedian, 1) - row.ctr) / Math.max(ctrMedian, 1), 0, 1);
  const clickDeficit = clamp((row.impressions - row.clicks) / Math.max(1, row.impressions), 0, 1);
  return Math.round((0.35 * positionScore + 0.3 * impressionsScore + 0.25 * ctrGap + 0.1 * clickDeficit) * 100);
}

function inferCategoryAndTitle(query) {
  const q = String(query || '').toLowerCase();
  const rules = [
    { category: 'jedzenie', re: /(dieta|bialko|białko|kreatyn|cholesterol|apob|apoa|glukoza|insulina|jedzen|odzyw|odżyw)/ },
    { category: 'ruch', re: /(trening|podciagn|podciąg|spacer|bieg|cwic|ćwic|silow|siła|mobiln)/ },
    { category: 'zdrowie', re: /(kortyzol|rtg|usg|badanie|cisnienie|ciśnienie|serce|horm|sen|stres|oponka)/ },
    { category: 'mity', re: /(mit|mity|fakt|ściema|sciema|nie działa|nie dziala|obal|obnaż|obnaz|prawda czy|czy to prawda)/ },
    { category: 'ciekawe', re: /(wiek biologic|epigen|sakad|longevity|nauk|biohack)/ },
  ];
  const matched = rules.find((r) => r.re.test(q));
  return matched || { category: 'ciekawe' };
}

function pickLatestByType(filesMeta, type) {
  const set = filesMeta.filter((f) => f.type === type);
  if (!set.length) return null;
  return set.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

function toDateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function safeUrlToPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const withoutDomain = raw.replace(/^https?:\/\/[^/]+/i, '');
  if (!withoutDomain || withoutDomain === '/') return '';
  return withoutDomain.startsWith('/') ? withoutDomain.slice(1) : withoutDomain;
}

function buildArticleDeltaPlan(report, qpRows) {
  const ctr = Array.isArray(report?.opportunities?.ctr_problems) ? report.opportunities.ctr_problems : [];
  const topZero = Array.isArray(report?.opportunities?.top10_zero_click) ? report.opportunities.top10_zero_click : [];
  const pageOpp = Array.isArray(report?.opportunities?.page_opportunities) ? report.opportunities.page_opportunities : [];
  const seed = [...ctr, ...topZero].slice(0, 25);
  const byQueryPages = new Map();
  qpRows.forEach((row) => {
    const q = String(row.query || '').trim().toLowerCase();
    if (!q) return;
    if (!byQueryPages.has(q)) byQueryPages.set(q, []);
    byQueryPages.get(q).push(row);
  });

  const plans = [];
  const usedUrls = new Set();
  seed.forEach((item) => {
    const query = String(item.query || '').trim();
    if (!query) return;
    const pagesForQuery = (byQueryPages.get(query.toLowerCase()) || [])
      .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0));
    const targetUrl = pagesForQuery[0]?.page || '';
    if (!targetUrl || usedUrls.has(targetUrl)) return;
    usedUrls.add(targetUrl);

    const pageStats = pageOpp.find((p) => p.page === targetUrl);
    const score = Number(item.opportunity_score || 0);
    const filePath = safeUrlToPath(targetUrl);

    plans.push({
      url: targetUrl,
      file_path: filePath || '(nieustalony)',
      main_query: query,
      opportunity_score: score,
      current_metrics: {
        impressions: Math.round(Number(pageStats?.impressions || item.impressions || 0)),
        clicks: Math.round(Number(pageStats?.clicks || item.clicks || 0)),
        ctr: Number(Number(pageStats?.ctr || item.ctr || 0).toFixed(2)),
        position: Number(Number(pageStats?.position || item.position || 0).toFixed(2)),
      },
      editorial_status: 'REQUIRES_MANUAL_ON_PAGE_REVIEW',
      delta: null,
      next_step: 'Przeczytaj docelowy artykuł i źródła, a następnie przygotuj konkretny title/meta/H2/FAQ dopiero po zatwierdzeniu ID w popraw-seo.',
      qa_gate: {
        title_max_65: 'REQUIRED',
        description_max_160: 'REQUIRED',
        min_4_internal_links: 'REQUIRED',
        faq_real_intent: 'REQUIRED',
        dates_iso8601: 'REQUIRED',
      },
      tracking_plan: {
        day_7: 'Sprawdź CTR i pozycję dla query głównej.',
        day_14: 'Porównaj kliknięcia vs baseline oraz widoczność long-tail.',
        day_28: 'Decyzja: skalować, iterować snippet, albo zmienić kąt treści.',
      },
    });
  });

  return plans.slice(0, 10);
}

function buildAeoOpportunities(report, qpRows) {
  const byUrl = new Map();
  const urlRows = Array.isArray(report?.opportunities?.page_opportunities) ? report.opportunities.page_opportunities : [];
  const ctrRows = Array.isArray(report?.opportunities?.ctr_problems) ? report.opportunities.ctr_problems : [];
  const queryRows = Array.isArray(report?.opportunities?.top10_zero_click) ? report.opportunities.top10_zero_click : [];

  for (const row of urlRows) {
    const url = String(row.page || '').trim();
    if (!url) continue;
    byUrl.set(url, {
      url,
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0),
      opportunity_score: 0,
      reasons: ['page_opportunity'],
      supporting_queries: [],
    });
  }

  const queryTarget = new Map();
  for (const row of qpRows || []) {
    const query = String(row.query || '').trim().toLowerCase();
    const page = String(row.page || '').trim();
    if (!query || !page) continue;
    const current = queryTarget.get(query);
    if (!current || Number(row.impressions || 0) > Number(current.impressions || 0)) queryTarget.set(query, row);
  }

  const attachQuery = (row, reason) => {
    const q = String(row.query || '').trim();
    if (!q) return;
    const target = queryTarget.get(q.toLowerCase());
    const candidate = target ? byUrl.get(String(target.page || '').trim()) : null;
    if (!candidate || candidate.supporting_queries.length >= 6) return;
    candidate.supporting_queries.push(q);
    candidate.opportunity_score = Math.max(candidate.opportunity_score, Number(row.opportunity_score || 0));
    if (!candidate.reasons.includes(reason)) candidate.reasons.push(reason);
  };

  for (const row of ctrRows) attachQuery(row, 'ctr_gap');

  for (const row of queryRows) attachQuery(row, 'zero_click');

  const top10 = [...byUrl.values()]
    .map((item) => {
      const ctrGapEstimate = Math.max(0, Number((report?.summary?.ctr_pool_median || 0) - (item.ctr || 0)));
      return {
        ...item,
        ctr_gap_estimate: Number(ctrGapEstimate.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.opportunity_score !== a.opportunity_score) return b.opportunity_score - a.opportunity_score;
      return b.impressions - a.impressions;
    })
    .slice(0, 10);

  return {
    generated_at: report.generated_at,
    status: top10.length ? 'ok' : 'INSUFFICIENT_DATA',
    strategic_priority: 'SEO -> AEO -> GEO -> AIO',
    top10_urls: top10,
  };
}

function writeAeoOutputs(aeoReport, outputJsonPath, outputMdPath) {
  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputMdPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, `${JSON.stringify(aeoReport, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# AEO Opportunity Bot');
  lines.push('');
  lines.push(`Wygenerowano: ${aeoReport.generated_at}`);
  lines.push(`Status: ${aeoReport.status}`);
  lines.push(`Priorytet: ${aeoReport.strategic_priority}`);
  lines.push('');
  lines.push('## TOP 10 URL-i z CTR gap');
  if (!aeoReport.top10_urls.length) {
    lines.push('- INSUFFICIENT_DATA');
  } else {
    aeoReport.top10_urls.forEach((row, idx) => {
      lines.push(`${idx + 1}. ${row.url}`);
      lines.push(`   - impressions: ${Math.round(row.impressions)}`);
      lines.push(`   - clicks: ${Math.round(row.clicks)}`);
      lines.push(`   - ctr: ${Number(row.ctr || 0).toFixed(2)}%`);
      lines.push(`   - position: ${Number(row.position || 0).toFixed(2)}`);
      lines.push(`   - ctr_gap_estimate: ${Number(row.ctr_gap_estimate || 0).toFixed(2)} pp`);
      lines.push(`   - opportunity_score: ${Math.round(row.opportunity_score || 0)}`);
      if (row.supporting_queries?.length) {
        lines.push(`   - supporting_queries: ${row.supporting_queries.slice(0, 6).join(' | ')}`);
      }
    });
  }
  fs.writeFileSync(outputMdPath, `${lines.join('\n')}\n`, 'utf8');
}

function writeOutputs(report, outputJson, outputMd) {
  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.mkdirSync(path.dirname(outputMd), { recursive: true });

  fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# GSC Weekly Report (CSV)');
  lines.push('');
  lines.push(`Wygenerowano: ${report.generated_at}`);
  lines.push(`Status: ${report.status}`);
  lines.push('');

  if (report.status !== 'ok') {
    lines.push('## Brak danych wejściowych');
    lines.push('Potrzebny jest komplet niepustych CSV w `~/Downloads/gsc-auto-input`:');
    lines.push('- zapytania (queries)');
    lines.push('- strony (pages)');
    lines.push('- zapytania + strony (query pages)');
    lines.push('');
    lines.push('Następnie uruchom: `npm run gsc:auto`');
  } else {
    lines.push('## Data Quality Gate');
    lines.push(`- status: **${report.data_quality.status}**`);
    lines.push(`- rows: queries=${report.data_quality.rows_queries}, pages=${report.data_quality.rows_pages}, query_pages=${report.data_quality.rows_query_pages}`);
    lines.push(`- duplicates (query+page): ${report.data_quality.duplicate_query_page_pairs}`);
    lines.push(`- anomalies: ctr>100=${report.data_quality.anomalies_ctr_over_100}, position<=0=${report.data_quality.anomalies_position_non_positive}`);
    lines.push('');
    lines.push('## Podsumowanie — główna warstwa');
    lines.push(`- Źródło głównego wyniku: **${report.summary.primary_layer === 'property' ? 'cała usługa GSC (bez wymiarów)' : 'suma stron (brak agregatu całej usługi)' }**`);
    lines.push(`- Kliknięcia: **${Math.round(report.summary.total_clicks)}**`);
    lines.push(`- Wyświetlenia: **${Math.round(report.summary.total_impressions)}**`);
    lines.push(`- Średni CTR: **${report.summary.avg_ctr.toFixed(2)}%**`);
    lines.push(`- Średnia pozycja: **${report.summary.avg_position.toFixed(2)}**`);
    lines.push('');
    lines.push('## Warstwy pomiaru GSC');
    lines.push(`- Cała usługa: ${report.summary.layers.property.status === 'PRIMARY' ? `kliknięcia ${Math.round(report.summary.layers.property.current.total_clicks)}, wyświetlenia ${Math.round(report.summary.layers.property.current.total_impressions)}` : 'INSUFFICIENT_DATA'}.`);
    lines.push(`- Strony: kliknięcia ${Math.round(report.summary.layers.pages.current.total_clicks)}, wyświetlenia ${Math.round(report.summary.layers.pages.current.total_impressions)}.`);
    lines.push(`- Ujawnione zapytania: kliknięcia ${Math.round(report.summary.layers.disclosed_queries.current.total_clicks)}, wyświetlenia ${Math.round(report.summary.layers.disclosed_queries.current.total_impressions)} — niepełne z powodu anonimizacji zapytań.`);
    lines.push('');
    lines.push('## Priorytet A: P1-3 i 0 klików');
    if (!report.opportunities.top3_zero_click.length) {
      lines.push('- Brak kandydatów.');
    } else {
      report.opportunities.top3_zero_click.slice(0, 10).forEach((r, idx) => {
        lines.push(`${idx + 1}. \`${r.query}\` — impr: ${Math.round(r.impressions)}, pos: ${r.position.toFixed(1)}, CTR: ${r.ctr.toFixed(2)}%`);
      });
    }
    lines.push('');
    lines.push('## Priorytet B: CTR problemy (pozycja <=10)');
    if (!report.opportunities.ctr_problems.length) {
      lines.push('- Brak kandydatów.');
    } else {
      report.opportunities.ctr_problems.slice(0, 10).forEach((r, idx) => {
        lines.push(`${idx + 1}. \`${r.query}\` — impr: ${Math.round(r.impressions)}, pos: ${r.position.toFixed(1)}, CTR: ${r.ctr.toFixed(2)}%`);
      });
    }
    lines.push('');
    lines.push('## Priorytet C: Kanibalizacja');
    if (!report.opportunities.cannibalization.length) {
      lines.push('- Brak kandydatów.');
    } else {
      report.opportunities.cannibalization.slice(0, 10).forEach((r, idx) => {
        lines.push(`${idx + 1}. \`${r.query}\` — URL: ${r.pages.length}, impr: ${Math.round(r.total_impressions)}`);
      });
    }
    lines.push('');
    lines.push('## Plan tygodnia (auto)');
    report.weekly_plan.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
    lines.push('');
    lines.push('## Propozycje nowych artykułów (1/kategoria)');
    Object.entries(report.content_gaps || {}).forEach(([cat, item]) => {
      if (!item || item.status !== 'OK') {
        lines.push(`- ${cat}: ${item?.status || 'INSUFFICIENT_DATA'}${item?.query ? ` — query "${item.query}", najpierw sprawdź istniejący URL ${item.target_url || '(brak mapowania)'}` : ''}`);
      } else {
        lines.push(`- ${cat}: ${item.title} (query: "${item.query}", score: ${item.score})`);
      }
    });
    lines.push('');
    lines.push('## GLOBAL Discovery (Nowe Tematy)');
    lines.push('- Tryb: GLOBAL_EXTRA (Autocomplete/PAA/Trends) do doboru nowych artykułów.');
    if (!report.global_discovery || report.global_discovery.status !== 'ok') {
      lines.push('- INSUFFICIENT_DATA_GLOBAL');
      lines.push('- Uwaga: sekcja LOCAL (GSC CSV) służy głównie do optymalizacji istniejących URL-i.');
    } else {
      for (const item of report.global_discovery.topics || []) {
        lines.push(`- ${item.category}: ${item.title} (${item.intent})`);
      }
    }
    lines.push('');
    lines.push('## AI Referrer Monitor');
    if (!report.ai_referrer_monitor || report.ai_referrer_monitor.status !== 'ok') {
      lines.push('- INSUFFICIENT_DATA');
      if (report.ai_referrer_monitor?.referrers_file_found === false) {
        lines.push(`- Brak pliku: ${report.ai_referrer_monitor.referrers_file}`);
      }
    } else {
      lines.push(`- referrers.csv: ${report.ai_referrer_monitor.referrers_file_found ? 'FOUND' : 'MISSING'}`);
      if (report.ai_referrer_monitor.ai_referrers.length) {
        lines.push('- AI hosty:');
        report.ai_referrer_monitor.ai_referrers.slice(0, 10).forEach((row) => {
          lines.push(`  - ${row.host}: ${row.visits}`);
        });
      }
      if (report.ai_referrer_monitor.ai_queries.length) {
        lines.push('- Zapytania AI brand:');
        report.ai_referrer_monitor.ai_queries.slice(0, 10).forEach((row) => {
          lines.push(`  - ${row.query} (impr: ${row.impressions}, clicks: ${row.clicks}, ctr: ${row.ctr}%)`);
        });
      }
    }
    lines.push('');
    lines.push('## AEO Opportunity Bot');
    if (!report.aeo_opportunity_bot || report.aeo_opportunity_bot.status !== 'ok') {
      lines.push('- INSUFFICIENT_DATA');
    } else {
      lines.push('- TOP 10 URL-i z CTR gap: zapisano do:');
      lines.push(`  - ${report.aeo_opportunity_bot.output_md}`);
      lines.push(`  - ${report.aeo_opportunity_bot.output_json}`);
    }
    lines.push('');
    lines.push('## Priorytet strategiczny');
    lines.push(`- ${report.strategic_priority || 'SEO -> AEO -> GEO -> AIO'}`);
    lines.push('');
    lines.push('## Article Delta Plan (po CSV)');
    if (!Array.isArray(report.article_delta_plan) || !report.article_delta_plan.length) {
      lines.push('- INSUFFICIENT_DATA');
    } else {
      report.article_delta_plan.forEach((plan, idx) => {
        lines.push(`${idx + 1}. URL: ${plan.url}`);
        lines.push(`   - query: ${plan.main_query}`);
        lines.push(`   - score: ${plan.opportunity_score}`);
        lines.push(`   - file: ${plan.file_path}`);
        lines.push(`   - status: ${plan.editorial_status}`);
        lines.push(`   - następny krok: ${plan.next_step}`);
      });
    }
  }

  lines.push('');
  lines.push('## Źródła plików');
  lines.push(`- queries: ${report.inputs.queries || '(brak)'}`);
  lines.push(`- pages: ${report.inputs.pages || '(brak)'}`);
  lines.push(`- query_pages: ${report.inputs.query_pages || '(brak)'}`);
  lines.push('');
  lines.push(`Okres raportu: ${toDateLabel(report.generated_at)} (wygenerowano lokalnie)`);

  fs.writeFileSync(outputMd, `${lines.join('\n')}\n`, 'utf8');
}

function pickQueryPagesInput(inputDir) {
  const dash = path.join(inputDir, 'query-pages.csv');
  const underscore = path.join(inputDir, 'query_pages.csv');
  if (fs.existsSync(dash)) return dash;
  if (fs.existsSync(underscore)) return underscore;
  return '';
}

function countCsvDataRows(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((line) => line.trim() !== '').length;
  return Math.max(0, nonEmpty - 1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const aeoOutputs = resolveAeoOutputs(args.inputDir);
  const filesMeta = [];

  if (!fs.existsSync(args.inputDir)) {
    fs.mkdirSync(args.inputDir, { recursive: true });
  }

  const queryPagesInput = pickQueryPagesInput(args.inputDir);
  const queriesPath = path.join(args.inputDir, 'queries.csv');
  const pagesPath = path.join(args.inputDir, 'pages.csv');
  const required = [
    { name: 'queries.csv', ok: fs.existsSync(queriesPath) && countCsvDataRows(queriesPath) > 0 },
    { name: 'pages.csv', ok: fs.existsSync(pagesPath) && countCsvDataRows(pagesPath) > 0 },
    { name: 'query-pages.csv|query_pages.csv', ok: Boolean(queryPagesInput) && countCsvDataRows(queryPagesInput) > 0 },
  ];
  const missingRequired = required.filter((r) => !r.ok).map((r) => r.name);
  if (missingRequired.length) {
    const aeoReport = {
      generated_at: new Date().toISOString(),
      status: 'INSUFFICIENT_DATA',
      strategic_priority: 'SEO -> AEO -> GEO -> AIO',
      top10_urls: [],
    };
    writeAeoOutputs(aeoReport, aeoOutputs.outputJson, aeoOutputs.outputMd);
    const report = {
      generated_at: new Date().toISOString(),
      status: 'INSUFFICIENT_DATA',
      reason: `Brak wymaganych plików: ${missingRequired.join(', ')}`,
      inputs: {
        input_dir: args.inputDir,
        queries: fs.existsSync(queriesPath) ? queriesPath : '',
        pages: fs.existsSync(pagesPath) ? pagesPath : '',
        query_pages: queryPagesInput,
      },
      summary: { total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0 },
      data_quality: { status: 'FAIL', rows_queries: 0, rows_pages: 0, rows_query_pages: 0, duplicate_query_page_pairs: 0, anomalies_ctr_over_100: 0, anomalies_position_non_positive: 0 },
      opportunities: { top3_zero_click: [], top10_zero_click: [], ctr_problems: [], cannibalization: [], page_opportunities: [] },
      weekly_plan: ['Dostarcz 3 pliki CSV do ~/Downloads/gsc-auto-input i uruchom ponownie.'],
      content_gaps: {},
      strategic_priority: 'SEO -> AEO -> GEO -> AIO',
      aeo_opportunity_bot: {
        status: 'INSUFFICIENT_DATA',
        output_json: aeoOutputs.outputJson,
        output_md: aeoOutputs.outputMd,
        top10_count: 0,
      },
      ai_referrer_monitor: {
        status: 'INSUFFICIENT_DATA',
        referrers_file_found: false,
        referrers_file: path.join(args.inputDir, 'referrers.csv'),
        ai_queries: [],
        ai_referrers: [],
      },
    };
    writeOutputs(report, args.outputJson, args.outputMd);
    console.log(`[FAIL] ${report.reason}`);
    process.exitCode = 2;
    return;
  }

  const files = fs.readdirSync(args.inputDir).filter((f) => f.toLowerCase().endsWith('.csv'));
  for (const file of files) {
    const abs = path.join(args.inputDir, file);
    const stat = fs.statSync(abs);
    const rawRows = parseCsv(fs.readFileSync(abs, 'utf8'));
    if (!rawRows.length) continue;
    const type = headerType(rawRows[0]);
    filesMeta.push({
      name: file,
      abs,
      mtimeMs: stat.mtimeMs,
      type,
      rawRows,
    });
  }

  const latestQueries = filesMeta.find((f) => f.name === 'queries.csv') || pickLatestByType(filesMeta, 'queries');
  const latestPages = filesMeta.find((f) => f.name === 'pages.csv') || pickLatestByType(filesMeta, 'pages');
  const latestQueryPages = filesMeta.find((f) => f.name === 'query-pages.csv')
    || filesMeta.find((f) => f.name === 'query_pages.csv')
    || pickLatestByType(filesMeta, 'query_pages');

  const report = {
    generated_at: new Date().toISOString(),
    status: 'missing_data',
    inputs: {
      queries: latestQueries ? latestQueries.abs : '',
      pages: latestPages ? latestPages.abs : '',
      query_pages: latestQueryPages ? latestQueryPages.abs : '',
    },
    summary: {
      total_clicks: 0,
      total_impressions: 0,
      avg_ctr: 0,
      avg_position: 0,
    },
    data_quality: {
      status: 'FAIL',
      rows_queries: 0,
      rows_pages: 0,
      rows_query_pages: 0,
      duplicate_query_page_pairs: 0,
      anomalies_ctr_over_100: 0,
      anomalies_position_non_positive: 0,
    },
    opportunities: {
      top3_zero_click: [],
      top10_zero_click: [],
      ctr_problems: [],
      cannibalization: [],
      page_opportunities: [],
    },
    weekly_plan: [],
    strategic_priority: 'SEO -> AEO -> GEO -> AIO',
    global_discovery: {
      status: 'INSUFFICIENT_DATA_GLOBAL',
      mode: 'GLOBAL_EXTRA',
      topics: [],
    },
  };

  if (!latestQueries || !latestPages) {
    const aeoReport = {
      generated_at: new Date().toISOString(),
      status: 'INSUFFICIENT_DATA',
      strategic_priority: 'SEO -> AEO -> GEO -> AIO',
      top10_urls: [],
    };
    writeAeoOutputs(aeoReport, aeoOutputs.outputJson, aeoOutputs.outputMd);
    report.aeo_opportunity_bot = {
      status: 'INSUFFICIENT_DATA',
      output_json: aeoOutputs.outputJson,
      output_md: aeoOutputs.outputMd,
      top10_count: 0,
    };
    report.ai_referrer_monitor = {
      status: 'INSUFFICIENT_DATA',
      referrers_file_found: false,
      referrers_file: path.join(args.inputDir, 'referrers.csv'),
      ai_queries: [],
      ai_referrers: [],
    };
    report.weekly_plan = [
      'Wyeksportuj z GSC CSV: Queries, Pages i Query+Page (zakres ostatnich 3 miesięcy).',
      'Skopiuj CSV do katalogu ~/Downloads/gsc-auto-input.',
      'Uruchom npm run gsc:auto.',
      'Wybierz 3-5 okazji i popraw 2-3 artykuły.',
      'Po publikacji poproś o indeksację w GSC.',
    ];
    writeOutputs(report, args.outputJson, args.outputMd);
    console.log(`[WARN] Brak kompletu CSV w ${args.inputDir}. Wygenerowano tylko checklistę przypominającą.`);
    console.log(`- JSON: ${path.relative(ROOT, args.outputJson)}`);
    console.log(`- MD: ${path.relative(ROOT, args.outputMd)}`);
    process.exitCode = 2;
    return;
  }

  const queryRows = latestQueries.rawRows.map(mapRow).filter((r) => r.query);
  const pageRows = latestPages.rawRows.map(mapRow).filter((r) => r.page);
  const qpRows = latestQueryPages ? latestQueryPages.rawRows.map(mapRow).filter((r) => r.query && r.page) : [];

  const summarize = (rows) => {
    const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
    const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    const weightedPosition = rows.reduce((sum, row) => sum + (row.position * row.impressions), 0);
    return {
      total_clicks: totalClicks,
      total_impressions: totalImpressions,
      avg_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avg_position: totalImpressions > 0 ? weightedPosition / totalImpressions : 0,
    };
  };
  const querySummary = summarize(queryRows);
  const pageSummary = summarize(pageRows);
  let apiProperty = null;
  const apiReportPath = path.join(args.inputDir, 'gsc-weekly-report-api.json');
  if (fs.existsSync(apiReportPath)) {
    try {
      const apiReport = JSON.parse(fs.readFileSync(apiReportPath, 'utf8'));
      apiProperty = apiReport?.summary?.primary_layer === 'property'
        ? apiReport?.summary?.layers?.property || null
        : null;
    } catch (err) {
      apiProperty = null;
    }
  }
  const primarySummary = apiProperty?.current || pageSummary;

  const top3Zero = queryRows
    .filter((r) => r.clicks === 0 && r.position > 0 && r.position <= 3 && r.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions);

  const top10Zero = queryRows
    .filter((r) => r.clicks === 0 && r.position > 0 && r.position <= 10 && r.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions);

  const ctrPool = queryRows.filter((r) => r.impressions > 0 && r.position > 0 && r.position <= 10);
  const poolMedianCtr = median(ctrPool.map((r) => r.ctr));
  const ctrProblems = ctrPool
    .filter((r) => r.ctr <= Math.max(1.0, poolMedianCtr * 0.6))
    .sort((a, b) => b.impressions - a.impressions);

  const cannibalization = [];
  if (qpRows.length) {
    const byQuery = new Map();
    for (const row of qpRows) {
      const q = row.query.trim().toLowerCase();
      if (!byQuery.has(q)) byQuery.set(q, []);
      byQuery.get(q).push(row);
    }
    for (const [query, rows] of byQuery.entries()) {
      const pagesMap = new Map();
      rows.forEach((r) => {
        const key = r.page.trim();
        if (!pagesMap.has(key)) {
          pagesMap.set(key, { page: key, clicks: 0, impressions: 0, ctr: 0, positionWeighted: 0 });
        }
        const p = pagesMap.get(key);
        p.clicks += r.clicks;
        p.impressions += r.impressions;
        p.positionWeighted += r.position * r.impressions;
      });
      const pages = [...pagesMap.values()].map((p) => ({
        page: p.page,
        clicks: p.clicks,
        impressions: p.impressions,
        position: p.impressions > 0 ? p.positionWeighted / p.impressions : 0,
        ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      }));
      if (pages.length < 2) continue;
      const totalImpr = pages.reduce((s, p) => s + p.impressions, 0);
      if (totalImpr < 30) continue;
      cannibalization.push({
        query,
        total_impressions: totalImpr,
        pages: pages.sort((a, b) => b.impressions - a.impressions).slice(0, 4),
      });
    }
    cannibalization.sort((a, b) => b.total_impressions - a.total_impressions);
  }

  const pageOpp = pageRows
    .filter((r) => r.impressions > 0 && r.position > 0 && r.position <= 30)
    .map((r) => ({
      page: r.page,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }))
    .sort((a, b) => b.impressions - a.impressions);

  const dupPairs = new Set();
  qpRows.forEach((r) => dupPairs.add(`${r.query.toLowerCase()}||${r.page.toLowerCase()}`));
  const anomaliesCtr = queryRows.filter((r) => r.ctr > 100).length + pageRows.filter((r) => r.ctr > 100).length;
  const anomaliesPos = queryRows.filter((r) => r.position <= 0).length + pageRows.filter((r) => r.position <= 0).length;

  report.status = 'ok';
  report.data_quality = {
    status: anomaliesCtr === 0 && anomaliesPos === 0 ? 'PASS' : 'WARN',
    rows_queries: queryRows.length,
    rows_pages: pageRows.length,
    rows_query_pages: qpRows.length,
    duplicate_query_page_pairs: qpRows.length - dupPairs.size,
    anomalies_ctr_over_100: anomaliesCtr,
    anomalies_position_non_positive: anomaliesPos,
  };
  report.summary = {
    total_clicks: primarySummary.total_clicks,
    total_impressions: primarySummary.total_impressions,
    avg_ctr: primarySummary.avg_ctr,
    avg_position: primarySummary.avg_position,
    ctr_pool_median: poolMedianCtr,
    primary_layer: apiProperty?.current ? 'property' : 'pages',
    layers: {
      property: apiProperty || { current: null, previous: null, status: 'INSUFFICIENT_DATA' },
      pages: { current: pageSummary, status: 'GROUPED_BY_PAGE' },
      disclosed_queries: { current: querySummary, status: 'PRIVACY_LIMITED', privacy_limited: true },
    },
  };
  const enrichedTop10 = top10Zero.map((r) => ({ ...r, opportunity_score: opportunityScore(r, poolMedianCtr) }))
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const enrichedCtrProblems = ctrProblems.map((r) => ({ ...r, opportunity_score: opportunityScore(r, poolMedianCtr) }))
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  report.opportunities = {
    top3_zero_click: top3Zero.slice(0, 20),
    top10_zero_click: enrichedTop10.slice(0, 30),
    ctr_problems: enrichedCtrProblems.slice(0, 30),
    cannibalization: cannibalization.slice(0, 20),
    page_opportunities: pageOpp.slice(0, 20),
  };

  const topQueryA = report.opportunities.top3_zero_click[0];
  const topQueryB = report.opportunities.ctr_problems[0];
  const topCann = report.opportunities.cannibalization[0];
  const topPage = report.opportunities.page_opportunities[0];

  report.weekly_plan = [
    topQueryA
      ? `Zoptymalizuj artykuł pod zapytanie "${topQueryA.query}" (P1-3 i 0 klików).`
      : 'Brak P1-3 i 0 klików: skup się na top10 i CTR.',
    topQueryB
      ? `Popraw title/meta + quick-answer dla "${topQueryB.query}" (CTR problem).`
      : 'Brak krytycznych CTR problemów: podbijaj zapytania z najwyższymi wyświetleniami.',
    topCann
      ? `Rozwiąż kanibalizację dla "${topCann.query}" (scalenie intencji lub rozdział tematów).`
      : 'Brak silnej kanibalizacji: utrzymuj 1 główny URL na 1 intencję.',
    topPage
      ? `Dołóż 2-3 linki wewnętrzne do ${topPage.page} z mocnych stron kategorii.`
      : 'Dołóż linki wewnętrzne do niedolinkowanych artykułów z filarów.',
    'Po zmianach: request indexing w GSC i weryfikacja efektu po 7 dniach.',
  ];

  const categoryOrder = ['jedzenie', 'ruch', 'zdrowie', 'mity', 'ciekawe'];
  const usedQueries = new Set();
  const candidates = [...enrichedTop10, ...enrichedCtrProblems]
    .filter((r) => r.impressions >= 10 && r.position >= 3 && r.position <= 90)
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const contentGaps = {};
  categoryOrder.forEach((cat) => {
    const hit = candidates.find((r) => {
      if (usedQueries.has(r.query)) return false;
      const inferred = inferCategoryAndTitle(r.query);
      return inferred.category === cat;
    });
    if (!hit) {
      contentGaps[cat] = { status: 'INSUFFICIENT_DATA' };
      return;
    }
    usedQueries.add(hit.query);
    const target = qpRows
      .filter((row) => String(row.query || '').trim().toLowerCase() === String(hit.query || '').trim().toLowerCase())
      .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))[0];
    contentGaps[cat] = {
      status: 'EXISTING_URL_REVIEW_REQUIRED',
      query: hit.query,
      target_url: target?.page || '',
      score: hit.opportunity_score,
      position: Number(hit.position.toFixed(2)),
      impressions: Math.round(hit.impressions),
    };
  });
  report.content_gaps = contentGaps;
  report.article_delta_plan = buildArticleDeltaPlan(report, qpRows);
  report.ai_referrer_monitor = buildAiReferrerMonitor(queryRows, args.inputDir);

  const aeoReport = buildAeoOpportunities(report, qpRows);
  writeAeoOutputs(aeoReport, aeoOutputs.outputJson, aeoOutputs.outputMd);
  report.aeo_opportunity_bot = {
    status: aeoReport.status,
    output_json: aeoOutputs.outputJson,
    output_md: aeoOutputs.outputMd,
    top10_count: Array.isArray(aeoReport.top10_urls) ? aeoReport.top10_urls.length : 0,
  };

  writeOutputs(report, args.outputJson, args.outputMd);
  console.log(`[PASS] GSC weekly CSV report generated.`);
  console.log(`- JSON: ${path.relative(ROOT, args.outputJson)}`);
  console.log(`- MD: ${path.relative(ROOT, args.outputMd)}`);
  console.log(`- AEO JSON: ${aeoOutputs.outputJson}`);
  console.log(`- AEO MD: ${aeoOutputs.outputMd}`);
  console.log(`- opportunities: top3_zero=${report.opportunities.top3_zero_click.length}, ctr=${report.opportunities.ctr_problems.length}, cannibalization=${report.opportunities.cannibalization.length}`);
}

main();
