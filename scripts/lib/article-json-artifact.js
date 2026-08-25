const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  CONTENT_READY: 'CONTENT_READY',
  BLOCKED: 'BLOCKED',
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function safeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function reportPathForJson(jsonPath) {
  const value = String(jsonPath);
  return /\.fitpo50\.json$/i.test(value)
    ? value.replace(/\.fitpo50\.json$/i, '.fitpo50.report.json')
    : `${value}.fitpo50.report.json`;
}

function markdownReportPathForJson(jsonPath) {
  const value = String(jsonPath);
  return /\.fitpo50\.json$/i.test(value)
    ? value.replace(/\.fitpo50\.json$/i, '.fitpo50.report.md')
    : `${value}.fitpo50.report.md`;
}

function inspectPreparedArtifact(inputPath, repoRoot = process.cwd()) {
  const file = path.resolve(inputPath);
  const reportPath = reportPathForJson(file);
  const errors = [];
  let report = null;
  let json = null;
  if (!fs.existsSync(file)) errors.push(`Brak JSON-u: ${file}`);
  if (!fs.existsSync(reportPath)) errors.push(`Brak raportu przygotowania: ${reportPath}`);
  if (!errors.length) {
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      errors.push(`Niepoprawny JSON: ${err.message || err}`);
    }
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (err) {
      errors.push(`Niepoprawny raport przygotowania: ${err.message || err}`);
    }
  }
  if (report && report.status !== STATUSES.CONTENT_READY) {
    errors.push(`Status artefaktu to ${report.status || 'MISSING'}, wymagany ${STATUSES.CONTENT_READY}.`);
  }
  if (report && fs.existsSync(file)) {
    const actualHash = sha256File(file);
    if (report.output_sha256 !== actualHash) {
      errors.push('SHA-256 JSON-u nie zgadza się z raportem przygotowania; plik został zmieniony po akceptacji.');
    }
    if (path.resolve(report.output_file || '') !== file) {
      errors.push('Raport przygotowania wskazuje inny plik wynikowy.');
    }
  }
  const slug = safeSlug(json?.slug || '');
  if (!slug) errors.push('Brak poprawnego slug w przygotowanym JSON-ie.');
  const htmlPath = slug ? path.join(repoRoot, `${slug}.html`) : '';
  return {
    ok: errors.length === 0,
    status: errors.length ? STATUSES.BLOCKED : STATUSES.CONTENT_READY,
    file,
    report_path: reportPath,
    report,
    json,
    slug,
    html_path: htmlPath,
    html_exists: Boolean(htmlPath && fs.existsSync(htmlPath)),
    errors,
  };
}

function cleanupPreparedArtifact(inputPath) {
  const file = path.resolve(inputPath);
  const packageDir = path.dirname(file);
  const slug = safeSlug(path.basename(packageDir));
  const isGeneratedReadyPackage = path.basename(path.dirname(packageDir)) === 'fitpo50-json-ready'
    && slug
    && new RegExp(`^${slug}(?:-r\\d+)?\\.fitpo50\\.json$`, 'i').test(path.basename(file));
  if (isGeneratedReadyPackage) {
    fs.rmSync(packageDir, { recursive: true, force: true });
    return { removed: [], removed_directories: [packageDir], missing: [] };
  }
  const targets = [file, reportPathForJson(file), markdownReportPathForJson(file)];
  const removed = [];
  const missing = [];
  for (const target of targets) {
    if (!fs.existsSync(target)) {
      missing.push(target);
      continue;
    }
    fs.rmSync(target);
    removed.push(target);
  }
  return { removed, removed_directories: [], missing };
}

module.exports = {
  STATUSES,
  cleanupPreparedArtifact,
  inspectPreparedArtifact,
  markdownReportPathForJson,
  reportPathForJson,
  safeSlug,
  sha256File,
};
