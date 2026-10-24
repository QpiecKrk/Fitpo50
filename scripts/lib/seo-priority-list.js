const fs = require('fs');
const os = require('os');
const path = require('path');
const { warsawIso } = require('./time');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SEO_STATE_DIR = path.join(ROOT, 'data', 'reports', 'local', 'seo-state');
const DEFAULT_GROWTH_REPORT_DIR = path.join(ROOT, 'data', 'reports', 'growth');
const LEGACY_SEO_STATE_DIR = path.join(os.homedir(), 'Downloads', 'fitpo50-seo-state');
const LEGACY_GROWTH_REPORT_DIR = path.join(os.homedir(), 'Downloads', 'fitpo50-growth-reports');

function normalizeFile(item) {
  const value = String(item?.file || item?.path || item?.url || '').trim();
  if (!value) return '';
  try {
    return new URL(value).pathname.replace(/^\/+/, '') || 'index.html';
  } catch (_) {
    return value.replace(/^\.?\//, '');
  }
}

function gscMetrics(item) {
  const explicit28 = item?.priority_metrics_28d || item?.gsc_windows?.day_28?.current;
  const hasWindowContract = Boolean(item && (Object.hasOwn(item, 'priority_metrics_28d') || Object.hasOwn(item, 'gsc_windows')));
  const gsc = explicit28 || (hasWindowContract ? {} : item?.gsc || item || {});
  return {
    impressions: Math.max(0, Number(gsc.impressions || 0)),
    clicks: Math.max(0, Number(gsc.clicks || 0)),
    ctr: Math.max(0, Number(gsc.ctr || 0)),
    position: Math.max(0, Number(gsc.position || 0)),
    data_status: explicit28 || !hasWindowContract ? 'OK_28D_OR_EXPLICIT_FIXTURE' : 'INSUFFICIENT_28D_DATA',
  };
}

function targetPosition(position) {
  if (position > 0 && position <= 3) return 1;
  if (position <= 10) return 3;
  if (position <= 20) return 5;
  if (position <= 50) return 10;
  return 20;
}

function benchmarkCtr(position) {
  if (position <= 1) return 0.28;
  if (position <= 3) return 0.10;
  if (position <= 5) return 0.07;
  if (position <= 10) return 0.03;
  return 0.015;
}

function estimatedClickGain(item) {
  const metrics = gscMetrics(item);
  const desiredPosition = targetPosition(metrics.position || 100);
  const targetCtr = benchmarkCtr(desiredPosition);
  const currentCtr = metrics.ctr / 100;
  return {
    estimated_click_gain_28d: Number((metrics.impressions * Math.max(0, targetCtr - currentCtr)).toFixed(3)),
    target_position: desiredPosition,
    target_ctr: Number((targetCtr * 100).toFixed(2)),
    current_ctr: metrics.ctr,
    impressions_28d: metrics.impressions,
    data_status: metrics.data_status,
  };
}

function buildSharedPriorityList(items) {
  return (items || [])
    .map((item) => ({ item, file: normalizeFile(item), ...estimatedClickGain(item) }))
    .filter((entry) => entry.file)
    .sort((a, b) => (
      b.estimated_click_gain_28d - a.estimated_click_gain_28d
      || b.impressions_28d - a.impressions_28d
      || a.file.localeCompare(b.file)
    ))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function hydrateSharedPriorityList(items, persisted) {
  if (!Array.isArray(persisted) || !persisted.length) return buildSharedPriorityList(items);
  const itemByFile = new Map((items || []).map((item) => [normalizeFile(item), item]).filter(([file]) => file));
  const hydrated = persisted
    .map((entry) => ({ ...entry, item: itemByFile.get(String(entry.file || '')) }))
    .filter((entry) => entry.item)
    .sort((a, b) => Number(a.rank || Number.MAX_SAFE_INTEGER) - Number(b.rank || Number.MAX_SAFE_INTEGER));
  const used = new Set(hydrated.map((entry) => entry.file));
  const missing = buildSharedPriorityList((items || []).filter((item) => !used.has(normalizeFile(item))))
    .map((entry, index) => ({ ...entry, rank: hydrated.length + index + 1 }));
  return [...hydrated, ...missing];
}

function rotationDiagnosis(item) {
  const metrics = gscMetrics(item);
  const inspection = item?.index_inspection || item?.inspection || {};
  const phrase = item?.keyword_plan?.primary || item?.keywords?.evidence?.[0]?.query || '';
  const inbound = Number(item?.topology?.inbound_links ?? item?.gsc?.inbound_links ?? 0);
  const inspectionVerdict = inspection.verdict || inspection.coverage_state || inspection.coverageState || '';
  return {
    indexation: inspectionVerdict
      ? { status: 'URL_INSPECTION_AVAILABLE', verdict: inspectionVerdict }
      : metrics.impressions > 0
        ? { status: 'SEEN_IN_GSC', verdict: 'Brak osobnego wyniku URL Inspection.' }
        : { status: 'URL_INSPECTION_REQUIRED_OR_NO_GSC_DATA', verdict: 'Brak strony w danych GSC nie przesądza o indeksacji.' },
    title_h1_intent: {
      status: 'SEO_DECISION_REQUIRED',
      phrase: phrase || null,
      decision: 'Sprawdź, czy title i H1 trafiają w realną frazę; bez potwierdzenia nie przepisuj treści.',
    },
    inbound_links: {
      count: inbound,
      status: inbound > 0 ? 'HAS_INBOUND_LINKS' : 'NO_CONFIRMED_INBOUND_LINKS',
      action: 'Ewentualne propozycje wyłącznie przez lokalny pipeline linkowania; bez ręcznego dopisywania linków.',
    },
  };
}

function selectPriorityWave(items, options = {}) {
  const size = Math.max(1, Number(options.size || 5));
  const gainSlots = Math.min(size, Math.round(size * 0.6));
  const rotationSlots = size - gainSlots;
  const state = options.state && typeof options.state === 'object' ? options.state : {};
  const advanceRotation = options.advanceRotation === true;
  const rotation = state.rotation && typeof state.rotation === 'object' ? state.rotation : {};
  let sequence = Number(state.sequence || 0);
  const ranked = buildSharedPriorityList(items);
  const roundKey = String(options.roundKey || '');
  const rankedByFile = new Map(ranked.map((entry) => [entry.file, entry]));
  const savedSelection = roundKey && state.round_key === roundKey && Array.isArray(state.last_selection)
    ? state.last_selection
        .map((saved) => ({ entry: rankedByFile.get(saved.file), source: saved.source }))
        .filter((saved) => saved.entry)
    : [];
  const previousSelection = savedSelection.length === Math.min(size, ranked.length) ? savedSelection : [];
  const gain = previousSelection.length
    ? previousSelection.filter((saved) => saved.source === 'ESTIMATED_CLICK_GAIN').map((saved) => saved.entry)
    : ranked.slice(0, gainSlots);
  const used = new Set(gain.map((entry) => entry.file));
  const topGainFiles = new Set(ranked.slice(0, 20).map((entry) => entry.file));
  const rotationCandidates = ranked
    .filter((entry) => !used.has(entry.file) && !topGainFiles.has(entry.file))
    .sort((a, b) => (
      Number(rotation[a.file]?.sequence || 0) - Number(rotation[b.file]?.sequence || 0)
      || String(a.item?.date_modified || '').localeCompare(String(b.item?.date_modified || ''))
      || a.file.localeCompare(b.file)
    ));
  const rotated = previousSelection.length
    ? previousSelection.filter((saved) => saved.source === 'ROTATION').map((saved) => saved.entry)
    : rotationCandidates.slice(0, rotationSlots);
  const selectedAt = options.selectedAt || warsawIso();
  if (advanceRotation && !previousSelection.length) {
    for (const entry of rotated) {
      sequence += 1;
      rotation[entry.file] = { sequence, last_selected_at: selectedAt };
    }
  }
  const decorate = (entry, source) => ({
    ...entry.item,
    file: entry.file,
    shared_priority_rank: entry.rank,
    estimated_click_gain: {
      clicks_28d: entry.estimated_click_gain_28d,
      target_position: entry.target_position,
      target_ctr: entry.target_ctr,
      current_ctr: entry.current_ctr,
      impressions_28d: entry.impressions_28d,
      data_status: entry.data_status,
    },
    wave_source: source,
    ...(source === 'ROTATION' ? { rotation_diagnosis: rotationDiagnosis(entry.item) } : {}),
  });
  const nextState = advanceRotation ? {
    version: 1,
    sequence,
    rotation,
    round_key: roundKey || null,
    last_selection: [
      ...gain.map((entry) => ({ file: entry.file, source: 'ESTIMATED_CLICK_GAIN' })),
      ...rotated.map((entry) => ({ file: entry.file, source: 'ROTATION' })),
    ],
  } : state;
  return {
    selected: [...gain.map((entry) => decorate(entry, 'ESTIMATED_CLICK_GAIN')), ...rotated.map((entry) => decorate(entry, 'ROTATION'))],
    gain_count: gain.length,
    rotation_count: rotated.length,
    state: nextState,
    ranked,
  };
}

function copyDirectoryIfMissing(source, target) {
  if (!fs.existsSync(source)) return { status: 'NO_LEGACY_DATA', source, target };
  fs.mkdirSync(target, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (fs.existsSync(to)) continue;
    fs.cpSync(from, to, { recursive: true, errorOnExist: false });
    copied += 1;
  }
  return { status: copied ? 'COPIED_NON_DESTRUCTIVELY' : 'TARGET_ALREADY_CURRENT', source, target, copied };
}

function resolveSeoStateDir() {
  return process.env.FITPO50_SEO_STATE_DIR
    ? path.resolve(process.env.FITPO50_SEO_STATE_DIR)
    : DEFAULT_SEO_STATE_DIR;
}

function migrateLegacySeoData() {
  return {
    state: copyDirectoryIfMissing(LEGACY_SEO_STATE_DIR, resolveSeoStateDir()),
    growth_reports: copyDirectoryIfMissing(LEGACY_GROWTH_REPORT_DIR, DEFAULT_GROWTH_REPORT_DIR),
  };
}

module.exports = {
  DEFAULT_GROWTH_REPORT_DIR,
  DEFAULT_SEO_STATE_DIR,
  LEGACY_GROWTH_REPORT_DIR,
  LEGACY_SEO_STATE_DIR,
  benchmarkCtr,
  buildSharedPriorityList,
  copyDirectoryIfMissing,
  estimatedClickGain,
  hydrateSharedPriorityList,
  migrateLegacySeoData,
  normalizeFile,
  resolveSeoStateDir,
  rotationDiagnosis,
  selectPriorityWave,
  targetPosition,
};
