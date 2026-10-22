const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slugify');

const STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  CONTENT_READY: 'CONTENT_READY',
  BLOCKED: 'BLOCKED',
});

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function packageMediaNames(json) {
  const names = new Set();
  for (const entry of Array.isArray(json?.media_manifest?.entries) ? json.media_manifest.entries : []) {
    if (entry?.source_file) names.add(String(entry.source_file));
    Object.values(entry?.variants || {}).forEach((variant) => {
      if (variant?.file) names.add(String(variant.file));
    });
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'pl'));
}

function computePreparedPackageFingerprint(inputPath, jsonValue = null) {
  const file = path.resolve(inputPath);
  const json = jsonValue || JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = [{ relative_path: path.basename(file), sha256: sha256File(file) }];
  for (const name of packageMediaNames(json)) {
    if (!name || name !== path.basename(name)) throw new Error(`Niebezpieczna nazwa pliku w media_manifest: ${name}`);
    const mediaPath = path.join(path.dirname(file), name);
    if (!fs.existsSync(mediaPath) || !fs.statSync(mediaPath).isFile()) throw new Error(`Brak pliku pakietu CONTENT_READY: ${name}`);
    entries.push({ relative_path: name, sha256: sha256File(mediaPath) });
  }
  const fingerprint = crypto.createHash('sha256')
    .update(entries.map((entry) => `${entry.relative_path}\0${entry.sha256}`).join('\n'))
    .digest('hex');
  return { fingerprint, entries };
}

function safeSlug(value) {
  return slugify(value);
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
    try {
      const packageState = computePreparedPackageFingerprint(file, json);
      if (!report.package_sha256) errors.push('Raport nie zawiera skrótu całej paczki CONTENT_READY; przygotuj JSON ponownie.');
      else if (report.package_sha256 !== packageState.fingerprint) errors.push('SHA-256 całej paczki nie zgadza się z raportem; JSON albo obraz został zmieniony po akceptacji.');
    } catch (error) {
      errors.push(error.message || String(error));
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

function cleanupPreparedArtifact(inputPath, options = {}) {
  const file = path.resolve(inputPath);
  const remove = options.remove || fs.rmSync;
  const packageDir = path.dirname(file);
  const slug = safeSlug(path.basename(packageDir));
  const isGeneratedReadyPackage = path.basename(path.dirname(packageDir)) === 'fitpo50-json-ready'
    && slug
    && new RegExp(`^${slug}(?:-r\\d+)?\\.fitpo50\\.json$`, 'i').test(path.basename(file));
  const retained = [];
  const safelyRemove = (target, removeOptions) => {
    try {
      remove(target, removeOptions);
      return true;
    } catch (error) {
      if (['EACCES', 'EPERM', 'EBUSY'].includes(error?.code)) {
        retained.push({ path: target, code: error.code });
        return false;
      }
      throw error;
    }
  };
  if (isGeneratedReadyPackage) {
    const removed = safelyRemove(packageDir, { recursive: true, force: true });
    return { removed: [], removed_directories: removed ? [packageDir] : [], missing: [], retained };
  }
  const targets = [file, reportPathForJson(file), markdownReportPathForJson(file)];
  const removed = [];
  const missing = [];
  for (const target of targets) {
    if (!fs.existsSync(target)) {
      missing.push(target);
      continue;
    }
    if (safelyRemove(target)) removed.push(target);
  }
  return { removed, removed_directories: [], missing, retained };
}

module.exports = {
  STATUSES,
  cleanupPreparedArtifact,
  computePreparedPackageFingerprint,
  inspectPreparedArtifact,
  markdownReportPathForJson,
  reportPathForJson,
  safeSlug,
  sha256File,
  packageMediaNames,
};
