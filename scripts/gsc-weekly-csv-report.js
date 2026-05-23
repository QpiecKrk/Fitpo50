#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.cwd();
const DEFAULT_WORK_DIR = process.env.GSC_WORK_DIR || path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
const DEFAULT_INPUT_DIR = DEFAULT_WORK_DIR;
const DEFAULT_OUTPUT_JSON = path.join(DEFAULT_WORK_DIR, 'gsc-weekly-report.json');
const DEFAULT_OUTPUT_MD = path.join(DEFAULT_WORK_DIR, 'gsc-weekly-report.md');

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
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
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
    { category: 'jedzenie', re: /(dieta|bialko|białko|kreatyn|cholesterol|apob|apoa|glukoza|insulina|jedzen|odzyw|odżyw)/, title: `Co jeść po 50? ${query}` },
    { category: 'ruch', re: /(trening|podciagn|podciąg|spacer|bieg|cwic|ćwic|silow|siła|mobiln)/, title: `Ruch po 50: ${query} — plan krok po kroku` },
    { category: 'zdrowie', re: /(kortyzol|rtg|usg|badanie|cisnienie|ciśnienie|serce|horm|sen|stres|oponka)/, title: `Zdrowie po 50: ${query} — kiedy działa i dla kogo` },
    { category: 'ciekawe', re: /(wiek biologic|epigen|sakad|longevity|mit|fakt|nauk|biohack)/, title: `${query}: co mówi nauka po 50?` },
  ];
  const matched = rules.find((r) => r.re.test(q));
  return matched || { category: 'ciekawe', title: `${query}: praktyczne wyjaśnienie po 50` };
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
    lines.push('## Podsumowanie');
    lines.push(`- Kliknięcia: **${Math.round(report.summary.total_clicks)}**`);
    lines.push(`- Wyświetlenia: **${Math.round(report.summary.total_impressions)}**`);
    lines.push(`- Średni CTR: **${report.summary.avg_ctr.toFixed(2)}%**`);
    lines.push(`- Średnia pozycja: **${report.summary.avg_position.toFixed(2)}**`);
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
      if (!item || item.status === 'INSUFFICIENT_DATA') {
        lines.push(`- ${cat}: INSUFFICIENT_DATA`);
      } else {
        lines.push(`- ${cat}: ${item.title} (query: "${item.query}", score: ${item.score})`);
      }
    });
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
  };

  if (!latestQueries || !latestPages) {
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

  const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = queryRows.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const weightedPosNum = queryRows.reduce((s, r) => s + (r.position * r.impressions), 0);
  const avgPosition = totalImpressions > 0 ? weightedPosNum / totalImpressions : 0;

  const top3Zero = queryRows
    .filter((r) => r.clicks === 0 && r.position > 0 && r.position <= 3 && r.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions);

  const top10Zero = queryRows
    .filter((r) => r.clicks === 0 && r.position > 0 && r.position <= 10 && r.impressions >= 40)
    .sort((a, b) => b.impressions - a.impressions);

  const ctrPool = queryRows.filter((r) => r.impressions >= 80 && r.position > 0 && r.position <= 10);
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
    .filter((r) => r.impressions >= 80 && r.position > 0 && r.position <= 20)
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
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    avg_ctr: avgCtr,
    avg_position: avgPosition,
    ctr_pool_median: poolMedianCtr,
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

  const categoryOrder = ['jedzenie', 'ruch', 'zdrowie', 'ciekawe'];
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
    const inferred = inferCategoryAndTitle(hit.query);
    contentGaps[cat] = {
      status: 'OK',
      title: inferred.title,
      query: hit.query,
      score: hit.opportunity_score,
      position: Number(hit.position.toFixed(2)),
      impressions: Math.round(hit.impressions),
    };
  });
  report.content_gaps = contentGaps;

  writeOutputs(report, args.outputJson, args.outputMd);
  console.log(`[PASS] GSC weekly CSV report generated.`);
  console.log(`- JSON: ${path.relative(ROOT, args.outputJson)}`);
  console.log(`- MD: ${path.relative(ROOT, args.outputMd)}`);
  console.log(`- opportunities: top3_zero=${report.opportunities.top3_zero_click.length}, ctr=${report.opportunities.ctr_problems.length}, cannibalization=${report.opportunities.cannibalization.length}`);
}

main();
