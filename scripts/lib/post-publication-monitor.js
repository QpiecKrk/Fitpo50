const fs = require('fs');
const os = require('os');
const path = require('path');
const { inspectGscInput } = require('./gsc-data-contract');
const { categoryFileFromKey, normalizeCategory } = require('./categories');

const SITE_ORIGIN = 'https://fitpo50.pl';
const HISTORY_RELATIVE = path.join('data', 'reports', 'published-articles-log.json');
const QUEUE_JSON_RELATIVE = path.join('data', 'reports', 'gsc-after-publication-queue.json');
const QUEUE_TXT_RELATIVE = path.join('data', 'reports', 'gsc-after-publication-queue.txt');

function readJson(filePath, fallback = null) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function atomicWrite(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.staging-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, contents, 'utf8');
  fs.renameSync(temporary, filePath);
}

function atomicWriteJson(filePath, payload) {
  atomicWrite(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || '').trim(), `${SITE_ORIGIN}/`);
    url.hash = '';
    url.search = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch (_error) {
    return '';
  }
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(raw || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => String(value).trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((value) => String(value).trim().toLowerCase());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()])));
}

function numberOrZero(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function metricsFromRow(row) {
  if (!row) return { clicks: 0, impressions: 0, ctr: 0, position: null };
  const impressions = numberOrZero(row.impressions);
  const clicks = numberOrZero(row.clicks);
  const csvCtr = numberOrZero(row.ctr);
  return {
    clicks,
    impressions,
    ctr: csvCtr || (impressions > 0 ? (clicks / impressions) * 100 : 0),
    position: row.position === '' || row.position === undefined ? null : numberOrZero(row.position),
  };
}

function pageMetrics(inputDir, url, preferredFile = '') {
  const candidates = [...new Set([path.basename(preferredFile || ''), 'web-28-current-pages.csv', 'pages.csv'].filter(Boolean))];
  const file = candidates.map((name) => path.join(inputDir, name)).find((candidate) => fs.existsSync(candidate));
  if (!file) return { file: '', found: false, window: 'unavailable', metrics: metricsFromRow(null) };
  const normalized = normalizeUrl(url);
  const row = parseCsv(fs.readFileSync(file, 'utf8')).find((entry) => normalizeUrl(entry.page || entry.strona) === normalized);
  return {
    file,
    found: Boolean(row),
    window: path.basename(file) === 'web-28-current-pages.csv' ? 'rolling_28_days' : 'canonical_pages_export',
    metrics: metricsFromRow(row),
  };
}

function addUtcDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function captureBaseline(inputDir, url, now = new Date()) {
  const inspection = inspectGscInput(inputDir, { strictPeriods: true, now });
  const page = pageMetrics(inputDir, url);
  const rangeKey = page.window === 'rolling_28_days' ? 'day_28' : 'day_90';
  const metricRange = inspection.periods?.details?.[rangeKey]?.current || null;
  return {
    captured_at: now.toISOString(),
    status: inspection.blocking ? 'GSC_INPUT_UNAVAILABLE' : (page.found ? 'GSC_ROW_FOUND' : 'NO_GSC_ROW_AT_PUBLICATION'),
    gsc_generated_at: inspection.freshness?.generated_at || '',
    window: page.window,
    range: metricRange,
    metrics: page.metrics,
    source_file: page.file ? path.basename(page.file) : '',
    contract_status: inspection.status,
    contract_errors: inspection.errors || [],
  };
}

function safeBaseline(inputDir, url, now = new Date()) {
  try {
    return captureBaseline(inputDir, url, now);
  } catch (error) {
    return {
      captured_at: now.toISOString(),
      status: 'GSC_INPUT_UNAVAILABLE',
      gsc_generated_at: '',
      window: 'unavailable',
      range: null,
      metrics: metricsFromRow(null),
      source_file: '',
      contract_status: 'FAIL',
      contract_errors: [String(error.message || error)],
    };
  }
}

function sourceUrlsFromStage(stageRoot, slug, categoryFile) {
  const target = `${slug}.html`;
  return [...new Set(['index.html', 'porady.html', categoryFile]
    .filter(Boolean)
    .filter((relative) => {
      const file = path.join(stageRoot, relative);
      return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(target);
    })
    .map((relative) => normalizeUrl(relative === 'index.html' ? '/' : relative))
    .filter(Boolean))];
}

function preparePublicationMonitoring({ stageRoot, article, operation, transactionId, gscInputDir, now = new Date() }) {
  const slug = String(article?.slug || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(slug)) throw new Error(`Nieprawidłowy slug monitoringu: ${slug || '(pusty)'}`);
  const url = normalizeUrl(`${slug}.html`);
  const categoryFile = categoryFileFromKey(normalizeCategory(article?.category || 'ciekawe').key);
  const baseline = safeBaseline(gscInputDir, url, now);
  const historyPath = path.join(stageRoot, HISTORY_RELATIVE);
  const previous = readJson(historyPath, { version: 2, items: [] });
  const items = Array.isArray(previous?.items) ? previous.items : [];
  const existing = items.find((item) => item.slug === slug) || {};
  const sourceUrls = sourceUrlsFromStage(stageRoot, slug, categoryFile);
  const checkpoints = {
    day_7: { due_date: addUtcDays(now.toISOString(), 7), snapshot: null },
    day_14: { due_date: addUtcDays(now.toISOString(), 14), snapshot: null },
    day_28: { due_date: addUtcDays(now.toISOString(), 28), snapshot: null },
  };
  const publicationEvent = {
    event_id: transactionId,
    operation,
    published_at: now.toISOString(),
    baseline,
    checkpoints,
    gsc_submission_urls: [url],
    source_urls_for_recrawl: sourceUrls,
  };
  const item = {
    ...existing,
    slug,
    url,
    operation,
    transaction_id: transactionId,
    first_published_at: existing.first_published_at || now.toISOString(),
    last_published_at: now.toISOString(),
    status: 'PUBLISHED_AWAITING_GSC',
    baseline,
    checkpoints,
    first_impression_after_publication_at: null,
    first_click_after_publication_at: null,
    indexed_without_impressions_at: null,
    gsc_submission_urls: [url],
    source_urls_for_recrawl: sourceUrls,
    sitemap_url: normalizeUrl('sitemap.xml'),
    publication_events: [...(Array.isArray(existing.publication_events) ? existing.publication_events : []), publicationEvent].slice(-50),
    signal_definition: 'Pierwszy sygnał oznacza pierwszy odczyt, w którym krocząca metryka 28-dniowa przekroczyła baseline; przy baseline równym 0 jest to pierwsze widoczne wyświetlenie lub kliknięcie.',
    monitoring_note: 'Metryki GSC są kroczącym oknem 28 dni; różnice są sygnałem po publikacji, nie czystą atrybucją efektu.',
  };
  const nextItems = [item, ...items.filter((entry) => entry.slug !== slug)]
    .sort((a, b) => String(b.last_published_at || '').localeCompare(String(a.last_published_at || '')));
  atomicWriteJson(historyPath, { version: 2, updated_at: now.toISOString(), items: nextItems });

  const queuePath = path.join(stageRoot, QUEUE_JSON_RELATIVE);
  const previousQueue = readJson(queuePath, { version: 1, items: [] });
  const queueItems = Array.isArray(previousQueue?.items) ? previousQueue.items : [];
  const queueItem = {
    slug,
    target_url: url,
    source_urls: sourceUrls,
    sitemap_url: item.sitemap_url,
    publication_at: now.toISOString(),
    transaction_id: transactionId,
    status: 'READY_AFTER_PUBLICATION',
  };
  const nextQueue = [queueItem, ...queueItems.filter((entry) => entry.slug !== slug)];
  atomicWriteJson(queuePath, { version: 1, updated_at: now.toISOString(), items: nextQueue });
  const textLines = nextQueue.flatMap((entry) => [
    `# ${entry.slug} | ${entry.status} | ${entry.publication_at}`,
    entry.target_url,
    ...entry.source_urls,
    entry.sitemap_url,
    '',
  ]);
  atomicWrite(path.join(stageRoot, QUEUE_TXT_RELATIVE), `${textLines.join('\n').trim()}\n`);
  return { item, queueItem };
}

function findIndexCoverage(inputDir, url) {
  const report = readJson(path.join(inputDir, 'gsc-indexing-coverage.json'), {});
  const candidates = [report?.checked, report?.alerts, report?.items, report?.results, report?.inspections, report?.coverage]
    .flatMap((value) => (Array.isArray(value) ? value : []));
  const normalized = normalizeUrl(url);
  const found = candidates.find((entry) => normalizeUrl(entry.url || entry.page || entry.inspectionUrl) === normalized) || null;
  const text = JSON.stringify(found || {}).toLowerCase();
  const indexed = Boolean(found) && (found.indexed === true || String(found.verdict || '').toUpperCase() === 'PASS'
    || (!/(not indexed|nie zindeks|excluded|error|fail)/.test(text)
      && /(indexed|zindeks|submitted and indexed|pass|success)/.test(text)));
  return { found: Boolean(found), indexed, details: found };
}

function buildMonitoringItem({ published, previous = {}, current, indexCoverage, observedAt }) {
  const today = observedAt.slice(0, 10);
  const baselineStatus = String(published.baseline?.status || '');
  const hasBaseline = Boolean(
    published.baseline?.captured_at
    && published.baseline?.metrics
    && ['GSC_ROW_FOUND', 'NO_GSC_ROW_AT_PUBLICATION'].includes(baselineStatus),
  );
  const missingBaselineStatus = published.baseline ? 'BASELINE_UNAVAILABLE' : 'LEGACY_BASELINE_MISSING';
  const base = hasBaseline ? published.baseline.metrics : metricsFromRow(null);
  const checkpoints = {};
  for (const [key, planned] of Object.entries(published.checkpoints || {})) {
    const oldCheckpoint = previous.checkpoints?.[key] || planned;
    checkpoints[key] = {
      due_date: planned.due_date,
      snapshot: oldCheckpoint.snapshot || (hasBaseline && planned.due_date && today >= planned.due_date ? {
        observed_at: observedAt,
        metrics: current,
        delta_from_baseline: metricDelta(base, current),
      } : null),
    };
  }
  const firstImpression = !hasBaseline ? null : (previous.first_impression_after_publication_at
    || published.first_impression_after_publication_at
    || (current.impressions > Number(base.impressions || 0) ? observedAt : null));
  const firstClick = !hasBaseline ? null : (previous.first_click_after_publication_at
    || published.first_click_after_publication_at
    || (current.clicks > Number(base.clicks || 0) ? observedAt : null));
  const indexedNoImpressions = !hasBaseline ? null : (previous.indexed_without_impressions_at
    || published.indexed_without_impressions_at
    || (indexCoverage.indexed && current.impressions === 0 ? observedAt : null));
  return {
    ...published,
    current: { observed_at: observedAt, metrics: current, index_coverage: indexCoverage },
    delta_from_baseline: hasBaseline ? metricDelta(base, current) : null,
    checkpoints,
    first_impression_after_publication_at: firstImpression,
    first_click_after_publication_at: firstClick,
    indexed_without_impressions_at: indexedNoImpressions,
    status: !hasBaseline ? missingBaselineStatus : firstClick ? 'CLICK_DETECTED' : firstImpression ? 'IMPRESSION_DETECTED' : indexedNoImpressions ? 'INDEXED_WITHOUT_IMPRESSIONS' : 'AWAITING_SIGNAL',
  };
}

function refreshMonitoring({ root, inputDir, outputDir = inputDir, now = new Date() }) {
  const history = readJson(path.join(root, HISTORY_RELATIVE), { items: [] });
  const previousPath = path.join(outputDir, 'post-publication-monitor.json');
  const previous = readJson(previousPath, { items: [] });
  const previousBySlug = new Map((previous.items || []).map((item) => [item.slug, item]));
  const inspection = inspectGscInput(inputDir, { strictPeriods: true, now });
  if (inspection.blocking) throw new Error(`Monitoring po publikacji wymaga świeżego kompletu GSC: ${inspection.errors.join('; ')}`);
  const observedAt = inspection.freshness?.generated_at || now.toISOString();
  const items = (history.items || []).map((published) => buildMonitoringItem({
    published,
    previous: previousBySlug.get(published.slug) || {},
    current: pageMetrics(inputDir, published.url, published.baseline?.source_file).metrics,
    indexCoverage: findIndexCoverage(inputDir, published.url),
    observedAt,
  }));
  const report = {
    version: 1,
    generated_at: now.toISOString(),
    gsc_observed_at: observedAt,
    data_contract: inspection.status,
    attribution_warning: 'GSC udostępnia tu kroczące okno 28 dni. Zmiany względem baseline są sygnałem kierunkowym, nie dowodem wyłącznego wpływu publikacji.',
    items,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  atomicWriteJson(previousPath, report);
  const md = [
    '# Monitoring po publikacji',
    '',
    `Wygenerowano: ${report.generated_at}`,
    `Dane GSC: ${observedAt}`,
    '',
    `> ${report.attribution_warning}`,
    '',
    '| URL | Status | Kliknięcia Δ | Wyświetlenia Δ | CTR Δ pp | Pozycja Δ |',
    '|---|---:|---:|---:|---:|---:|',
    ...items.map((item) => `| ${item.url} | ${item.status} | ${item.delta_from_baseline?.clicks ?? '—'} | ${item.delta_from_baseline?.impressions ?? '—'} | ${item.delta_from_baseline?.ctr_pp ?? '—'} | ${item.delta_from_baseline?.position_improvement ?? '—'} |`),
    '',
  ].join('\n');
  atomicWrite(path.join(outputDir, 'post-publication-monitor.md'), md);
  return report;
}

function metricDelta(baseline, current) {
  const baselinePosition = baseline.position === null || baseline.position === undefined ? null : Number(baseline.position);
  const currentPosition = current.position === null || current.position === undefined ? null : Number(current.position);
  return {
    clicks: Number(current.clicks || 0) - Number(baseline.clicks || 0),
    impressions: Number(current.impressions || 0) - Number(baseline.impressions || 0),
    ctr_pp: Number((Number(current.ctr || 0) - Number(baseline.ctr || 0)).toFixed(4)),
    position_improvement: baselinePosition === null || currentPosition === null ? null : Number((baselinePosition - currentPosition).toFixed(4)),
  };
}

function defaultGscInputDir() {
  return process.env.GSC_WORK_DIR || path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
}

module.exports = {
  HISTORY_RELATIVE,
  QUEUE_JSON_RELATIVE,
  QUEUE_TXT_RELATIVE,
  buildMonitoringItem,
  captureBaseline,
  defaultGscInputDir,
  findIndexCoverage,
  metricDelta,
  normalizeUrl,
  pageMetrics,
  parseCsv,
  preparePublicationMonitoring,
  refreshMonitoring,
};
