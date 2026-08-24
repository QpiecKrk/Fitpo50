const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MANIFEST_NAME = 'gsc-data-manifest.json';
const API_REPORT_NAME = 'gsc-weekly-report-api.json';
const DEFAULT_MAX_AGE_HOURS = 72;
const DEFAULT_MAX_COHORT_SPREAD_MINUTES = 30;
const DEFAULT_MAX_RANGE_LAG_DAYS = 3;
const REQUIRED_INPUTS = [
  { key: 'queries', names: ['queries.csv'], expectedType: 'queries' },
  { key: 'pages', names: ['pages.csv'], expectedType: 'pages' },
  { key: 'query_pages', names: ['query-pages.csv', 'query_pages.csv'], expectedType: 'query_pages' },
];

function normalizeKey(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function detectCsvType(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return 'missing';
  const firstLine = String(fs.readFileSync(filePath, 'utf8') || '').split(/\r?\n/, 1)[0] || '';
  const candidates = [',', ';', '\t'];
  let delimiter = ',';
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = firstLine.split(candidate).length;
    if (score > bestScore) {
      delimiter = candidate;
      bestScore = score;
    }
  }
  const keys = firstLine.split(delimiter).map(normalizeKey);
  const hasQuery = keys.some((key) => /(^| )query( |$)|(^| )zapytan/.test(key));
  const hasPage = keys.some((key) => /(^| )page( |$)|(^| )stron/.test(key));
  if (hasQuery && hasPage) return 'query_pages';
  if (hasQuery) return 'queries';
  if (hasPage) return 'pages';
  return 'unknown';
}

function countCsvRows(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return Math.max(0, lines.filter((line) => line.trim()).length - 1);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function parseDate(value) {
  const date = new Date(String(value || '').trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateDiffDaysInclusive(start, end) {
  const a = parseDate(`${start}T00:00:00Z`);
  const b = parseDate(`${end}T00:00:00Z`);
  if (!a || !b || b < a) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function nextIsoDay(value) {
  const date = parseDate(`${value}T00:00:00Z`);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function validateReportingWindows(windows) {
  const errors = [];
  const details = {};
  let commonCurrentEnd = '';
  for (const days of [7, 28, 90]) {
    const key = `day_${days}`;
    const range = windows && windows[key] && (windows[key].range || windows[key]);
    const current = range && range.current;
    const previous = range && range.previous;
    if (!current?.start || !current?.end || !previous?.start || !previous?.end) {
      errors.push(`${key}: brak pełnego zakresu current/previous.`);
      continue;
    }
    const currentDays = dateDiffDaysInclusive(current.start, current.end);
    const previousDays = dateDiffDaysInclusive(previous.start, previous.end);
    const contiguous = nextIsoDay(previous.end) === current.start;
    if (currentDays !== days) errors.push(`${key}: current ma ${currentDays} dni zamiast ${days}.`);
    if (previousDays !== days) errors.push(`${key}: previous ma ${previousDays} dni zamiast ${days}.`);
    if (!contiguous) errors.push(`${key}: okresy previous/current nie są ciągłe.`);
    if (!commonCurrentEnd) commonCurrentEnd = current.end;
    else if (current.end !== commonCurrentEnd) errors.push(`${key}: current.end nie zgadza się z innymi oknami.`);
    details[key] = { current, previous, current_days: currentDays, previous_days: previousDays, contiguous };
  }
  return { status: errors.length ? 'FAIL' : 'PASS', errors, details, current_end: commonCurrentEnd };
}

function resolveRequiredFiles(inputDir) {
  const files = {};
  for (const spec of REQUIRED_INPUTS) {
    const candidates = spec.names.map((name) => path.join(inputDir, name)).filter((file) => fs.existsSync(file));
    files[spec.key] = candidates[0] || path.join(inputDir, spec.names[0]);
  }
  return files;
}

function inspectGscInput(inputDir, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const maxAgeHours = Number(options.maxAgeHours || process.env.GSC_MAX_INPUT_AGE_HOURS || DEFAULT_MAX_AGE_HOURS);
  const maxSpreadMinutes = Number(options.maxCohortSpreadMinutes || process.env.GSC_MAX_COHORT_SPREAD_MINUTES || DEFAULT_MAX_COHORT_SPREAD_MINUTES);
  const maxRangeLagDays = Number(options.maxRangeLagDays || process.env.GSC_MAX_RANGE_LAG_DAYS || DEFAULT_MAX_RANGE_LAG_DAYS);
  const strictPeriods = options.strictPeriods !== false;
  const requireManifest = options.requireManifest !== false;
  const resolvedDir = path.resolve(inputDir);
  const files = resolveRequiredFiles(resolvedDir);
  const errors = [];
  const warnings = [];
  const fileDetails = {};
  const mtimes = [];

  for (const spec of REQUIRED_INPUTS) {
    const file = files[spec.key];
    if (!fs.existsSync(file)) {
      errors.push(`${spec.key}: brak pliku ${spec.names.join(' lub ')}.`);
      fileDetails[spec.key] = { path: file, exists: false, rows: 0, type: 'missing' };
      continue;
    }
    const stat = fs.statSync(file);
    const rows = countCsvRows(file);
    const type = detectCsvType(file);
    if (rows <= 0) errors.push(`${spec.key}: plik nie zawiera danych.`);
    if (type !== spec.expectedType) errors.push(`${spec.key}: nagłówki wskazują typ ${type}, oczekiwano ${spec.expectedType}.`);
    mtimes.push(stat.mtimeMs);
    fileDetails[spec.key] = {
      path: file,
      exists: true,
      rows,
      type,
      mtime: stat.mtime.toISOString(),
      sha256: sha256File(file),
    };
  }

  const dashAlias = path.join(resolvedDir, 'query-pages.csv');
  const underscoreAlias = path.join(resolvedDir, 'query_pages.csv');
  let aliasStatus = 'ONE_CANONICAL_FILE';
  if (fs.existsSync(dashAlias) && fs.existsSync(underscoreAlias)) {
    aliasStatus = sha256File(dashAlias) === sha256File(underscoreAlias) ? 'PASS' : 'FAIL';
    if (aliasStatus === 'FAIL') errors.push('query-pages.csv i query_pages.csv zawierają różne dane.');
  }

  const manifestPath = path.join(resolvedDir, MANIFEST_NAME);
  const apiReportPath = path.join(resolvedDir, API_REPORT_NAME);
  const manifest = readJson(manifestPath);
  const apiReport = readJson(apiReportPath);
  if (requireManifest && !manifest) errors.push(`Brak obowiązkowego manifestu ${MANIFEST_NAME}.`);
  const generatedAtRaw = manifest?.generated_at || apiReport?.generated_at || '';
  const generatedAt = parseDate(generatedAtRaw);
  const newestFallbackMtime = mtimes.length ? Math.min(...mtimes) : 0;
  const freshnessReference = generatedAt || (newestFallbackMtime ? new Date(newestFallbackMtime) : null);
  const ageHours = freshnessReference ? (now.getTime() - freshnessReference.getTime()) / 3600000 : Infinity;
  const futureHours = freshnessReference ? (freshnessReference.getTime() - now.getTime()) / 3600000 : 0;
  if (!freshnessReference) errors.push('Nie można ustalić czasu wygenerowania danych GSC.');
  else if (futureHours > 1) errors.push(`Dane GSC mają czas z przyszłości (${futureHours.toFixed(1)} h).`);
  else if (ageHours > maxAgeHours) errors.push(`Dane GSC są nieaktualne: ${ageHours.toFixed(1)} h, limit ${maxAgeHours} h.`);

  const spreadMinutes = mtimes.length > 1 ? (Math.max(...mtimes) - Math.min(...mtimes)) / 60000 : 0;
  if (spreadMinutes > maxSpreadMinutes) {
    errors.push(`Pliki GSC nie tworzą jednego eksportu: rozrzut czasu ${spreadMinutes.toFixed(1)} min, limit ${maxSpreadMinutes} min.`);
  }

  let rangeSource = '';
  let reportingWindows = null;
  if (manifest?.reporting_windows) {
    reportingWindows = manifest.reporting_windows;
    rangeSource = 'manifest';
  } else if (apiReport?.reporting_windows) {
    reportingWindows = apiReport.reporting_windows;
    rangeSource = 'api_report';
  }
  const rangeContract = reportingWindows
    ? validateReportingWindows(reportingWindows)
    : { status: 'UNVERIFIED', errors: ['Brak metadanych zakresów 7/28/90.'], details: {}, current_end: '' };
  if (rangeContract.status === 'FAIL') errors.push(...rangeContract.errors);
  if (rangeContract.status === 'UNVERIFIED') {
    if (strictPeriods) errors.push(...rangeContract.errors);
    else warnings.push(...rangeContract.errors);
  }
  const rangeEndDate = rangeContract.current_end ? parseDate(`${rangeContract.current_end}T23:59:59Z`) : null;
  const rangeLagDays = rangeEndDate ? (now.getTime() - rangeEndDate.getTime()) / 86400000 : Infinity;
  if (rangeEndDate && rangeLagDays > maxRangeLagDays) {
    errors.push(`Końcowa data GSC jest zbyt stara: ${rangeContract.current_end} (${rangeLagDays.toFixed(1)} dnia; limit ${maxRangeLagDays}).`);
  }
  if (rangeEndDate && rangeLagDays < -1) {
    errors.push(`Końcowa data GSC jest w przyszłości: ${rangeContract.current_end}.`);
  }

  const expectedFiles = manifest?.files && typeof manifest.files === 'object' ? manifest.files : null;
  if (expectedFiles) {
    for (const spec of REQUIRED_INPUTS) {
      const expected = expectedFiles[spec.key];
      const actual = fileDetails[spec.key];
      if (!expected || !actual?.exists) continue;
      if (expected.sha256 && expected.sha256 !== actual.sha256) errors.push(`${spec.key}: hash nie zgadza się z manifestem.`);
      if (Number.isFinite(Number(expected.rows)) && Number(expected.rows) !== actual.rows) errors.push(`${spec.key}: liczba wierszy nie zgadza się z manifestem.`);
    }
  } else {
    warnings.push('Brak hashy i liczby wierszy w manifeście; spójność plików potwierdzono tylko lokalnie.');
  }

  const truncation = manifest?.pagination?.potentially_truncated_datasets
    || apiReport?.collection_quality?.potentially_truncated_datasets
    || [];
  if (Array.isArray(truncation) && truncation.length) {
    warnings.push(`API osiągnęło limit wierszy dla: ${truncation.join(', ')}.`);
  }

  return {
    status: errors.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS',
    blocking: errors.length > 0,
    checked_at: now.toISOString(),
    input_dir: resolvedDir,
    source: manifest?.source || (apiReport?.status === 'ok' ? 'gsc_api' : 'manual_csv'),
    property: manifest?.property || apiReport?.property || '',
    freshness: {
      status: freshnessReference && ageHours <= maxAgeHours && futureHours <= 1 ? 'PASS' : 'FAIL',
      generated_at: freshnessReference ? freshnessReference.toISOString() : '',
      age_hours: Number.isFinite(ageHours) ? Number(ageHours.toFixed(2)) : null,
      max_age_hours: maxAgeHours,
    },
    cohort: {
      status: spreadMinutes <= maxSpreadMinutes ? 'PASS' : 'FAIL',
      spread_minutes: Number(spreadMinutes.toFixed(2)),
      max_spread_minutes: maxSpreadMinutes,
      alias_status: aliasStatus,
    },
    periods: {
      ...rangeContract,
      source: rangeSource || 'none',
      range_lag_days: Number.isFinite(rangeLagDays) ? Number(rangeLagDays.toFixed(2)) : null,
      max_range_lag_days: maxRangeLagDays,
    },
    files: fileDetails,
    pagination: {
      status: Array.isArray(truncation) && truncation.length ? 'WARN_LIMIT_REACHED' : 'PASS',
      potentially_truncated_datasets: Array.isArray(truncation) ? truncation : [],
    },
    errors,
    warnings,
  };
}

function buildManifestFromApiReport(report, outputDir) {
  const files = resolveRequiredFiles(outputDir);
  const fileManifest = {};
  for (const spec of REQUIRED_INPUTS) {
    const file = files[spec.key];
    if (!fs.existsSync(file)) continue;
    fileManifest[spec.key] = {
      name: path.basename(file),
      type: detectCsvType(file),
      rows: countCsvRows(file),
      sha256: sha256File(file),
      range: report?.reporting_windows?.day_90?.range || report?.reporting_windows?.day_90 || report?.ranges || null,
    };
  }
  const potentiallyTruncated = Array.isArray(report?.collection_quality?.potentially_truncated_datasets)
    ? report.collection_quality.potentially_truncated_datasets
    : [];
  return {
    version: 1,
    generated_at: report.generated_at,
    source: 'gsc_api',
    property: report.property,
    data_state: 'final',
    canonical_window: 'day_90',
    reporting_windows: report.reporting_windows,
    files: fileManifest,
    pagination: {
      datasets: report?.collection_quality?.datasets || [],
      potentially_truncated_datasets: potentiallyTruncated,
    },
    privacy: {
      disclosed_queries_are_incomplete: true,
      primary_site_result_layer: 'property',
      article_performance_layer: 'pages',
    },
  };
}

function writeManifestFromApiReport(report, outputDir) {
  const manifest = buildManifestFromApiReport(report, outputDir);
  const outputPath = path.join(path.resolve(outputDir), MANIFEST_NAME);
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return outputPath;
}

module.exports = {
  API_REPORT_NAME,
  DEFAULT_MAX_AGE_HOURS,
  MANIFEST_NAME,
  buildManifestFromApiReport,
  countCsvRows,
  detectCsvType,
  inspectGscInput,
  validateReportingWindows,
  writeManifestFromApiReport,
};
