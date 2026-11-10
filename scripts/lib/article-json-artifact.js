const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slugify');
const { atomicWriteFileSync } = require('./atomic-file');

function dependencyFiles(root, entries) {
  const visited = new Set();
  const visit = (relative) => {
    const file = path.resolve(root, relative);
    const key = path.relative(root, file).replace(/\\/g, '/');
    if (visited.has(key)) return;
    visited.add(key);
    if (!fs.existsSync(file) || !/\.js$/.test(file)) return;
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const base = path.resolve(path.dirname(file), match[1]);
      const target = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (target) visit(path.relative(root, target));
    }
  };
  entries.forEach(visit);
  return [...visited].sort();
}

function validationIdentity(root, { inputs = [], code = [], parameters = {} }) {
  const files = [...new Set([...inputs, ...dependencyFiles(root, code)])].sort();
  const entries = [];
  const visit = (name) => {
    const file = path.resolve(root, name);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      for (const child of fs.readdirSync(file).sort()) visit(path.join(name, child));
    } else entries.push([name.replace(/\\/g, '/'), fs.existsSync(file) ? sha256File(file) : null]);
  };
  files.forEach(visit);
  return crypto.createHash('sha256').update(JSON.stringify({ version: 1, node: process.version, platform: process.platform, arch: process.arch, parameters, entries })).digest('hex');
}

function readCheckReceipt(file, identity) {
  try {
    const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
    return receipt.version === 1 && receipt.status === 'PASS' && receipt.exit_code === 0 && receipt.identity === identity ? receipt : null;
  } catch (_error) { return null; }
}

function writeCheckReceipt(file, identity, result = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  atomicWriteFileSync(file, `${JSON.stringify({ ...result, version: 1, status: 'PASS', exit_code: 0, identity })}\n`, 'utf8');
}

function preparationCodeIdentity(root = path.resolve(__dirname, '../..')) {
  return validationIdentity(root, {
    code: ['scripts/article-json-workbench.js', 'scripts/prepare-article-architecture.js', 'scripts/prepare-article-media.js', 'scripts/article-preflight.js', 'scripts/package-audit.js'],
    inputs: ['package.json', 'package-lock.json', 'scripts/config'],
    parameters: { profile: 'technical' },
  });
}

function preparationIdentity(root, article, sourcePackageHash, parameters = {}) {
  const inventory = require('./article-intent-links').buildArticleInventory(root)
    .filter((entry) => entry.file !== `${article.slug}.html`).map((entry) => [entry.file, sha256File(path.join(root, entry.file))]);
  return crypto.createHash('sha256').update(JSON.stringify({ code: preparationCodeIdentity(), sourcePackageHash, inventory, parameters })).digest('hex');
}

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
  if (report?.validation_profile === 'technical' && report.preparation_code_sha256 !== preparationCodeIdentity()) {
    errors.push('Kod lub konfiguracja przygotowania zmieniły się; wymagany aktualny raport techniczny.');
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
  dependencyFiles,
  validationIdentity,
  readCheckReceipt,
  writeCheckReceipt,
  preparationCodeIdentity,
  preparationIdentity,
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
