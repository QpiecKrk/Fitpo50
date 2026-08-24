const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { categoryFileFromKey, normalizeCategory } = require('./categories');

const EXCLUDED_TOP_LEVEL = new Set(['.git', 'node_modules', '.tmp', 'output', 'tmp']);

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function cloneEntry(source, target, relative = '') {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) {
    fs.symlinkSync(fs.readlinkSync(source), target);
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(source)) {
      const childRelative = relative ? path.join(relative, name) : name;
      const top = childRelative.split(path.sep)[0];
      if (EXCLUDED_TOP_LEVEL.has(top)) continue;
      if (/^data\/reports\/(?:local|visual-current)(?:\/|$)/.test(childRelative.replace(/\\/g, '/'))) continue;
      cloneEntry(path.join(source, name), path.join(target, name), childRelative);
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_FICLONE);
  fs.chmodSync(target, stat.mode);
}

function createStagingWorkspace(sourceRoot, slug) {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), `fitpo50-preview-${slug}-`));
  cloneEntry(sourceRoot, stageRoot);
  const nodeModules = path.join(sourceRoot, 'node_modules');
  if (fs.existsSync(nodeModules)) fs.symlinkSync(nodeModules, path.join(stageRoot, 'node_modules'));
  return stageRoot;
}

function mediaPaths(article) {
  const paths = [];
  for (const entry of article?.media_manifest?.entries || []) {
    for (const variant of Object.values(entry.variants || {})) {
      if (!variant?.file || variant.file !== path.basename(variant.file)) continue;
      paths.push(path.join('assets', variant.file), path.join('_site', 'assets', variant.file));
    }
  }
  return paths;
}

function promotionCandidates(article) {
  const slug = String(article?.slug || '').trim();
  const categoryFile = categoryFileFromKey(normalizeCategory(article?.category || 'ciekawe').key);
  const rootFiles = [
    `${slug}.html`,
    'index.html',
    'porady.html',
    categoryFile,
    'sitemap.xml',
    'llms.txt',
    'llms-full.txt',
    path.join('assets', 'pdf', `${slug}.pdf`),
    path.join('data', 'crosslink-suggestions', `${slug}.json`),
    path.join('data', 'reports', 'article-preview', `${slug}.json`),
    path.join('data', 'reports', 'article-preview', `${slug}.md`),
  ];
  const mirrored = [
    `_site/${slug}.html`,
    '_site/index.html',
    '_site/porady.html',
    `_site/${categoryFile}`,
    '_site/sitemap.xml',
    '_site/llms.txt',
    path.join('_site', 'assets', 'pdf', `${slug}.pdf`),
    path.join('_site', 'data', 'crosslink-suggestions', `${slug}.json`),
  ];
  return [...new Set([...rootFiles, ...mirrored, ...mediaPaths(article)].map((item) => item.replace(/\\/g, '/')))];
}

function snapshotCandidates(root, candidates) {
  const snapshot = new Map();
  candidates.forEach((relative) => {
    const target = path.join(root, relative);
    snapshot.set(relative, fs.existsSync(target) && fs.statSync(target).isFile() ? sha256File(target) : null);
  });
  return snapshot;
}

function atomicCopy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.staging-${process.pid}-${Date.now()}`;
  fs.copyFileSync(source, temporary);
  fs.renameSync(temporary, destination);
}

function promoteStaging({ sourceRoot, stageRoot, candidates, baseline }) {
  const changed = candidates.filter((relative) => {
    const staged = path.join(stageRoot, relative);
    if (!fs.existsSync(staged) || !fs.statSync(staged).isFile()) return false;
    return baseline.get(relative) !== sha256File(staged);
  });
  for (const relative of changed) {
    const live = path.join(sourceRoot, relative);
    const current = fs.existsSync(live) && fs.statSync(live).isFile() ? sha256File(live) : null;
    if (current !== baseline.get(relative)) throw new Error(`Repozytorium zmieniło się podczas stagingu: ${relative}. Promocja zatrzymana.`);
  }

  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-promotion-backup-'));
  const promoted = [];
  try {
    for (const relative of changed) {
      const live = path.join(sourceRoot, relative);
      if (fs.existsSync(live)) atomicCopy(live, path.join(backupRoot, relative));
      atomicCopy(path.join(stageRoot, relative), live);
      promoted.push(relative);
    }
    for (const relative of promoted) {
      if (sha256File(path.join(sourceRoot, relative)) !== sha256File(path.join(stageRoot, relative))) {
        throw new Error(`Kontrola integralności po promocji nie przeszła: ${relative}.`);
      }
    }
  } catch (error) {
    for (const relative of promoted.reverse()) {
      const backup = path.join(backupRoot, relative);
      const live = path.join(sourceRoot, relative);
      if (fs.existsSync(backup)) atomicCopy(backup, live);
      else if (fs.existsSync(live)) fs.rmSync(live);
    }
    throw error;
  } finally {
    fs.rmSync(backupRoot, { recursive: true, force: true });
  }
  return changed;
}

function runInStaging(stageRoot, args) {
  const result = spawnSync('node', ['scripts/article-pipeline.js', ...args, '--staging-internal', 'true', '--indexnow', 'false'], {
    cwd: stageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    env: {
      ...process.env,
      FITPO50_STAGING_INTERNAL: '1',
      FITPO50_PIPELINE_TIMINGS_PATH: path.join(stageRoot, 'data', 'reports', 'local', 'pipeline-timings.json'),
    },
  });
  if (result.status !== 0) throw new Error(`Stagingowy pipeline nie przeszedł (exit ${result.status ?? 'unknown'}). Repozytorium nie zostało zmienione.`);
}

function runPreviewGate(stageRoot, slug) {
  const result = spawnSync('node', ['scripts/article-preview-gate.js', '--slug', slug], { cwd: stageRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Bramka podglądu nie przeszła (exit ${result.status ?? 'unknown'}). Repozytorium nie zostało zmienione.`);
}

module.exports = {
  cloneEntry,
  createStagingWorkspace,
  mediaPaths,
  promoteStaging,
  promotionCandidates,
  runInStaging,
  runPreviewGate,
  sha256File,
  snapshotCandidates,
};
