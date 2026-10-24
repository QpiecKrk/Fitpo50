const crypto = require('crypto');
const fs = require('fs');
const { atomicWriteFileSync } = require('./atomic-file');
const path = require('path');
const { issuePipelineCapability } = require('./pipeline-capability');
const { spawnSync } = require('child_process');
const { categoryFileFromKey, normalizeCategory } = require('./categories');
const { createManagedTempDir, disposeTempWorkspace, readWorkspaceManifest } = require('./temp-workspace');
const { validatePreviewReport } = require('./article-preview-report');
const { warsawIso } = require('./time');

const ALLOWED_TOP_LEVEL_DIRECTORIES = new Set(['scripts', 'assets', 'data', '_site', 'src', 'dist', 'templates', 'admin', 'docs', 'sukcesy']);
const EXCLUDED_TOP_LEVEL = new Set(['.git', 'node_modules', '.tmp', 'output', 'tmp']);
const TRANSACTION_DIR = path.join('.tmp', 'article-publication-transactions');
const TRANSACTION_LOCK = path.join('.tmp', 'article-publication.lock');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function assertSafeName(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalized)) {
    throw new Error(`${label} zawiera niedozwoloną nazwę: ${normalized || '(pusta)'}`);
  }
  return normalized;
}

function assertSafeRelative(relative) {
  const normalized = String(relative || '').replace(/\\/g, '/');
  if (!normalized || path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Niedozwolona ścieżka transakcji: ${relative}`);
  }
  return normalized;
}

function isSensitiveStagePath(relative) {
  const normalized = String(relative || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const base = path.posix.basename(normalized).toLowerCase();
  return normalized === '_site/admin' || normalized.startsWith('_site/admin/')
    || /^(?:admin\/)?uploads(?:\/|$)/i.test(normalized)
    || /^\.env(?:\.|$)/i.test(base)
    || /(?:^|\/)(?:config\.php|database\.sqlite)$/i.test(normalized)
    || /\.(?:pem|key|p12|pfx)$/i.test(base);
}

function isAllowedRootFile(name) {
  if (['.htaccess', '.editorconfig'].includes(name)) return true;
  return /\.(?:html|css|js|json|xml|txt|md|php|webmanifest|ico|png|svg)$/i.test(name);
}

function isAllowedStagePath(relative, isDirectory) {
  const normalized = String(relative || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || isSensitiveStagePath(normalized)) return false;
  const top = normalized.split('/')[0];
  if (EXCLUDED_TOP_LEVEL.has(top)) return false;
  if (normalized.includes('/')) return ALLOWED_TOP_LEVEL_DIRECTORIES.has(top);
  return isDirectory ? ALLOWED_TOP_LEVEL_DIRECTORIES.has(top) : isAllowedRootFile(top);
}

function cloneEntry(source, target, relative = '') {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) {
    throw new Error(`Staging nie kopiuje dowolnych symlinków: ${relative || source}`);
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(source)) {
      const childRelative = relative ? path.join(relative, name) : name;
      const childStat = fs.lstatSync(path.join(source, name));
      if (!isAllowedStagePath(childRelative, childStat.isDirectory())) continue;
      if (/^data\/reports\/(?:local|visual-current)(?:\/|$)/.test(childRelative.replace(/\\/g, '/'))) continue;
      cloneEntry(path.join(source, name), path.join(target, name), childRelative);
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_FICLONE);
  fs.chmodSync(target, stat.mode);
}

function collectStageFiles(root, relative = '', output = []) {
  if (!fs.existsSync(root)) return output;
  for (const name of fs.readdirSync(root)) {
    const childRelative = relative ? path.join(relative, name) : name;
    const normalized = childRelative.replace(/\\/g, '/');
    if (normalized === 'node_modules' || normalized.startsWith('node_modules/') || normalized === '.tmp' || normalized.startsWith('.tmp/')) continue;
    if (/^data\/reports\/(?:local|visual-current)(?:\/|$)/.test(normalized)) continue;
    if (['.fitpo50-workspace.json', '.fitpo50-workspace.lock', 'article-stage.json'].includes(normalized)) continue;
    const absolute = path.join(root, name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) collectStageFiles(absolute, childRelative, output);
    else if (stat.isFile()) output.push(normalized);
  }
  return output;
}

function collectAllowedSourceFiles(root, relative = '', output = []) {
  for (const name of fs.readdirSync(root)) {
    const childRelative = relative ? path.join(relative, name) : name;
    const normalized = childRelative.replace(/\\/g, '/');
    const absolute = path.join(root, name);
    const stat = fs.lstatSync(absolute);
    if (!isAllowedStagePath(normalized, stat.isDirectory())) continue;
    if (/^data\/reports\/(?:local|visual-current)(?:\/|$)/.test(normalized)) continue;
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) collectAllowedSourceFiles(absolute, childRelative, output);
    else if (stat.isFile()) output.push(normalized);
  }
  return output;
}

function assertNoUnexpectedStageChanges(sourceRoot, stageRoot, candidates) {
  const allowed = new Set(candidates.map((value) => String(value).replace(/\\/g, '/')));
  const unexpected = [];
  for (const relative of collectStageFiles(stageRoot)) {
    if (allowed.has(relative)) continue;
    const staged = path.join(stageRoot, relative);
    const source = path.join(sourceRoot, relative);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile() || sha256File(staged) !== sha256File(source)) unexpected.push(relative);
  }
  for (const relative of collectAllowedSourceFiles(sourceRoot)) {
    if (allowed.has(relative)) continue;
    if (!fs.existsSync(path.join(stageRoot, relative))) unexpected.push(`DELETED:${relative}`);
  }
  if (unexpected.length) throw new Error(`Staging zmienił pliki spoza manifestu publikacji: ${unexpected.join(', ')}`);
  return { ok: true, files_checked: collectStageFiles(stageRoot).length };
}

function createStagingWorkspace(sourceRoot, slug) {
  const stageRoot = createManagedTempDir({
    prefix: `fitpo50-preview-${slug}-`,
    type: 'article-publication-staging',
    projectRoot: sourceRoot,
    slug,
  });
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
  const slug = assertSafeName(article?.slug, 'Slug');
  const categoryFile = categoryFileFromKey(normalizeCategory(article?.category || 'ciekawe').key);
  const rootFiles = [
    `${slug}.html`,
    'index.html',
    'porady.html',
    categoryFile,
    'sitemap.xml',
    'llms.txt',
    'llms-full.txt',
    path.join('assets', 'data', 'search-index.json'),
    path.join('assets', 'pdf', `${slug}.pdf`),
    path.join('data', 'crosslink-suggestions', `${slug}.json`),
    path.join('data', 'reports', 'article-publications', `${slug}.json`),
    path.join('data', 'reports', 'article-preview', `${slug}.json`),
    path.join('data', 'reports', 'article-preview', `${slug}.md`),
    path.join('data', 'reports', 'published-articles-log.json'),
    path.join('data', 'reports', 'gsc-after-publication-queue.json'),
    path.join('data', 'reports', 'gsc-after-publication-queue.txt'),
    path.join('data', 'reports', 'link-topology-report.json'),
    path.join('data', 'reports', 'link-topology-report.md'),
  ];
  const mirrored = [
    `_site/${slug}.html`,
    '_site/index.html',
    '_site/porady.html',
    `_site/${categoryFile}`,
    '_site/sitemap.xml',
    '_site/llms.txt',
    '_site/llms-full.txt',
    path.join('_site', 'assets', 'data', 'search-index.json'),
    path.join('_site', 'assets', 'pdf', `${slug}.pdf`),
    path.join('_site', 'data', 'crosslink-suggestions', `${slug}.json`),
  ];
  return [...new Set([...rootFiles, ...mirrored, ...mediaPaths(article)].map((item) => item.replace(/\\/g, '/')))];
}

function snapshotCandidates(root, candidates) {
  const snapshot = new Map();
  candidates.map(assertSafeRelative).forEach((relative) => {
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

function atomicWriteJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.staging-${process.pid}-${Date.now()}`;
  atomicWriteFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

function changedFiles(stageRoot, candidates, baseline) {
  return candidates.map(assertSafeRelative).filter((relative) => {
    const staged = path.join(stageRoot, relative);
    if (!fs.existsSync(staged) || !fs.statSync(staged).isFile()) return false;
    return baseline.get(relative) !== sha256File(staged);
  });
}

function publicationManifestPath(slug) {
  return path.join('data', 'reports', 'article-publications', `${assertSafeName(slug, 'Slug')}.json`).replace(/\\/g, '/');
}

function validatePublicationSet(root, article, { requireManifest = false } = {}) {
  const slug = assertSafeName(article?.slug, 'Slug');
  const categoryFile = categoryFileFromKey(normalizeCategory(article?.category || 'ciekawe').key);
  const required = [
    `${slug}.html`,
    `_site/${slug}.html`,
    'index.html',
    '_site/index.html',
    'porady.html',
    '_site/porady.html',
    categoryFile,
    `_site/${categoryFile}`,
    'sitemap.xml',
    '_site/sitemap.xml',
    'llms.txt',
    '_site/llms.txt',
    'llms-full.txt',
    '_site/llms-full.txt',
    'assets/data/search-index.json',
    '_site/assets/data/search-index.json',
    `assets/pdf/${slug}.pdf`,
    `_site/assets/pdf/${slug}.pdf`,
    `data/reports/article-preview/${slug}.json`,
    `data/reports/article-preview/${slug}.md`,
    'data/reports/published-articles-log.json',
    'data/reports/gsc-after-publication-queue.json',
    'data/reports/gsc-after-publication-queue.txt',
    ...mediaPaths(article),
  ];
  if (requireManifest) required.push(publicationManifestPath(slug));
  const missing = [...new Set(required)].filter((relative) => {
    const target = path.join(root, relative);
    return !fs.existsSync(target) || !fs.statSync(target).isFile();
  });
  if (missing.length) throw new Error(`Niepełny zestaw publikacji; brak plików: ${missing.join(', ')}`);

  const exactPairs = [
    [`${slug}.html`, `_site/${slug}.html`],
    ['sitemap.xml', '_site/sitemap.xml'],
    ['llms.txt', '_site/llms.txt'],
    ['llms-full.txt', '_site/llms-full.txt'],
    ['assets/data/search-index.json', '_site/assets/data/search-index.json'],
    [`assets/pdf/${slug}.pdf`, `_site/assets/pdf/${slug}.pdf`],
  ];
  for (const entry of article?.media_manifest?.entries || []) {
    for (const variant of Object.values(entry.variants || {})) {
      if (!variant?.file || variant.file !== path.basename(variant.file)) continue;
      exactPairs.push([`assets/${variant.file}`, `_site/assets/${variant.file}`]);
    }
  }
  for (const [sourceRelative, mirrorRelative] of exactPairs) {
    if (sha256File(path.join(root, sourceRelative)) !== sha256File(path.join(root, mirrorRelative))) {
      throw new Error(`Niespójna para publikacji: ${sourceRelative} <-> ${mirrorRelative}`);
    }
  }
  const preview = validatePreviewReport(root, slug);
  if (!preview.ok) throw new Error(`Raport PREVIEW_READY jest nieaktualny albo niepełny: ${preview.errors.join(' | ')}`);

  const expectedHref = `${slug}.html`;
  for (const relative of ['index.html', 'porady.html', categoryFile, 'sitemap.xml', 'llms.txt']) {
    if (!fs.readFileSync(path.join(root, relative), 'utf8').includes(expectedHref)) {
      throw new Error(`Publikacja ${slug} nie została wpisana do ${relative}.`);
    }
  }
  const searchIndex = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'data', 'search-index.json'), 'utf8'));
  if (!Array.isArray(searchIndex) || !searchIndex.some((entry) => entry && (entry.slug === expectedHref || entry.url === expectedHref))) {
    throw new Error(`Indeks wyszukiwarki nie zawiera ${expectedHref}.`);
  }
  const publicationHistory = JSON.parse(fs.readFileSync(path.join(root, 'data/reports/published-articles-log.json'), 'utf8'));
  const historyItem = (publicationHistory.items || []).find((entry) => entry.slug === slug);
  if (!historyItem?.baseline || !historyItem?.checkpoints?.day_7 || !historyItem?.checkpoints?.day_14 || !historyItem?.checkpoints?.day_28) {
    throw new Error(`Historia publikacji ${slug} nie zawiera baseline i checkpointów 7/14/28.`);
  }
  if (!Array.isArray(historyItem.publication_events) || !historyItem.publication_events.some((event) => event.event_id === historyItem.transaction_id)) {
    throw new Error(`Historia publikacji ${slug} nie zawiera zdarzenia bieżącej transakcji.`);
  }
  const gscQueue = JSON.parse(fs.readFileSync(path.join(root, 'data/reports/gsc-after-publication-queue.json'), 'utf8'));
  const queueItem = (gscQueue.items || []).find((entry) => entry.slug === slug);
  if (!queueItem || queueItem.target_url !== `https://fitpo50.pl/${slug}.html`) {
    throw new Error(`Kolejka GSC po publikacji nie zawiera docelowego URL-a ${slug}.`);
  }
  if (!Array.isArray(queueItem.source_urls) || queueItem.source_urls.length < 1) {
    throw new Error(`Kolejka GSC po publikacji nie zawiera stron źródłowych dla ${slug}.`);
  }
  return { slug, categoryFile, files: [...new Set(required)], exactPairs };
}

function writePublicationManifest({ stageRoot, article, candidates, baseline, transactionId }) {
  const slug = assertSafeName(article?.slug, 'Slug');
  const manifestRelative = publicationManifestPath(slug);
  const files = changedFiles(stageRoot, candidates, baseline)
    .filter((relative) => relative !== manifestRelative)
    .map((relative) => {
      const staged = path.join(stageRoot, relative);
      const before = baseline.get(relative) || null;
      return {
        path: relative,
        action: before ? 'UPDATE' : 'CREATE',
        before_sha256: before,
        after_sha256: sha256File(staged),
        bytes: fs.statSync(staged).size,
      };
    });
  const articleRelative = `${slug}.html`;
  const operation = baseline.get(articleRelative) ? 'UPDATE' : 'CREATE';
  const payload = {
    version: 1,
    transaction_id: transactionId,
    generated_at: warsawIso(),
    status: 'PUBLISHED',
    operation,
    slug,
    url: `https://fitpo50.pl/${slug}.html`,
    manifest_file: manifestRelative,
    gates: [
      'CONTENT_READY',
      'ARTICLE_PREFLIGHT',
      'MEDIA_MANIFEST',
      'ARTICLE_CONTRACT',
      'MIRROR_SYNC',
      'NEWS_INTEGRITY',
      'PREDEPLOY_STAGING',
      'PREVIEW_READY_DESKTOP_MOBILE_PDF',
      'POST_PROMOTION_VALIDATION',
      'POST_PUBLICATION_BASELINE_AND_GSC_QUEUE',
    ],
    files,
    files_count: files.length,
  };
  atomicWriteJson(path.join(stageRoot, manifestRelative), payload);
  return { relative: manifestRelative, payload };
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function releaseLock(sourceRoot, transactionId) {
  const lockPath = path.join(sourceRoot, TRANSACTION_LOCK);
  if (!fs.existsSync(lockPath)) return;
  try {
    const lock = readJson(lockPath);
    if (transactionId && lock.transaction_id !== transactionId) return;
  } catch (_error) {
    if (transactionId) return;
  }
  fs.rmSync(lockPath, { force: true });
}

function restoreJournal(sourceRoot, transactionRoot, journal) {
  const conflicts = [];
  for (const file of [...journal.files].reverse()) {
    const live = path.join(sourceRoot, file.path);
    const backup = path.join(transactionRoot, 'backup', file.path);
    const currentHash = fs.existsSync(live) && fs.statSync(live).isFile() ? sha256File(live) : null;
    if (currentHash === file.before_sha256) continue;
    if (currentHash !== file.after_sha256) {
      conflicts.push(file.path);
      continue;
    }
    if (file.before_sha256) {
      if (!fs.existsSync(backup) || sha256File(backup) !== file.before_sha256) {
        conflicts.push(file.path);
        continue;
      }
      atomicCopy(backup, live);
    } else if (fs.existsSync(live)) {
      fs.rmSync(live);
    }
  }
  if (conflicts.length) {
    throw new Error(`Nie można automatycznie cofnąć transakcji ${journal.transaction_id}; pliki zmieniły się niezależnie: ${conflicts.join(', ')}`);
  }
}

function finalizeCommittedJournal(sourceRoot, transactionRoot, journal, options = {}) {
  const journalPath = path.join(transactionRoot, 'journal.json');
  const completion = journal.completion;
  for (const file of journal.files || []) {
    const live = path.join(sourceRoot, file.path);
    if (!fs.existsSync(live) || !fs.statSync(live).isFile() || sha256File(live) !== file.after_sha256) {
      throw new Error(`Nie można domknąć statusu COMMITTED; plik publikacji nie zgadza się z journalem: ${file.path}`);
    }
  }
  if (completion?.relative_path && completion?.payload) {
    const relative = assertSafeRelative(completion.relative_path);
    if (!relative.startsWith('data/reports/local/article-pipeline/') || !relative.endsWith('.status.json')) {
      throw new Error(`Niedozwolony rekord zakończenia transakcji: ${relative}`);
    }
    atomicWriteJson(path.join(sourceRoot, relative), completion.payload);
    completion.status = 'WRITTEN';
    completion.written_at = warsawIso();
  }
  journal.status = 'COMPLETED';
  journal.completed_at = warsawIso();
  atomicWriteJson(journalPath, journal);
  releaseLock(sourceRoot, journal.transaction_id);
  fs.rmSync(transactionRoot, { recursive: true, force: true });
  if (options.recovering && completion?.workspace_path && fs.existsSync(completion.workspace_path)) {
    const manifest = readWorkspaceManifest(completion.workspace_path);
    if (manifest && path.resolve(String(manifest.project_root || '')) === path.resolve(sourceRoot)) {
      disposeTempWorkspace(completion.workspace_path, { status: 'COMPLETED' });
    }
  }
}

function recoverInterruptedTransactions(sourceRoot) {
  const transactionsRoot = path.join(sourceRoot, TRANSACTION_DIR);
  const lockPath = path.join(sourceRoot, TRANSACTION_LOCK);
  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath);
    if (processIsAlive(Number(lock.pid))) {
      throw new Error(`Inna publikacja jest aktywna (PID ${lock.pid}, transakcja ${lock.transaction_id}).`);
    }
  }
  if (!fs.existsSync(transactionsRoot)) {
    releaseLock(sourceRoot);
    return [];
  }
  const recovered = [];
  try {
    for (const name of fs.readdirSync(transactionsRoot)) {
    const transactionRoot = path.join(transactionsRoot, name);
    const journalPath = path.join(transactionRoot, 'journal.json');
    if (!fs.existsSync(journalPath)) {
      fs.rmSync(transactionRoot, { recursive: true, force: true });
      continue;
    }
    const journal = readJson(journalPath);
    if (journal.status === 'COMMITTED') {
      finalizeCommittedJournal(sourceRoot, transactionRoot, journal, { recovering: true });
      recovered.push(journal.transaction_id);
      continue;
    }
    if (journal.status === 'COMPLETED' || journal.status === 'ROLLED_BACK') {
      fs.rmSync(transactionRoot, { recursive: true, force: true });
      continue;
    }
    restoreJournal(sourceRoot, transactionRoot, journal);
    journal.status = 'ROLLED_BACK';
    journal.recovered_at = warsawIso();
    atomicWriteJson(journalPath, journal);
    recovered.push(journal.transaction_id);
      fs.rmSync(transactionRoot, { recursive: true, force: true });
    }
  } finally {
    releaseLock(sourceRoot);
  }
  return recovered;
}

function beginPromotionTransaction({ sourceRoot, stageRoot, candidates, baseline, transactionId, completion = null }) {
  assertSafeName(transactionId, 'Identyfikator transakcji');
  const changed = changedFiles(stageRoot, candidates, baseline);
  for (const relative of changed) {
    const live = path.join(sourceRoot, relative);
    const current = fs.existsSync(live) && fs.statSync(live).isFile() ? sha256File(live) : null;
    if (current !== baseline.get(relative)) throw new Error(`Repozytorium zmieniło się podczas stagingu: ${relative}. Promocja zatrzymana.`);
  }

  const lockPath = path.join(sourceRoot, TRANSACTION_LOCK);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    atomicWriteFileSync(lockPath, `${JSON.stringify({ transaction_id: transactionId, pid: process.pid, created_at: warsawIso() }, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Inna publikacja posiada aktywną blokadę transakcji.');
    throw error;
  }

  const transactionRoot = path.join(sourceRoot, TRANSACTION_DIR, transactionId);
  const journalPath = path.join(transactionRoot, 'journal.json');
  let journal;
  try {
    journal = {
      version: 1,
      transaction_id: transactionId,
      pid: process.pid,
      created_at: warsawIso(),
      status: 'PREPARING',
      completion: completion ? { ...completion, status: 'PENDING' } : null,
      files: changed.map((relative) => ({
        path: relative,
        before_sha256: baseline.get(relative) || null,
        after_sha256: sha256File(path.join(stageRoot, relative)),
      })),
    };
    fs.mkdirSync(transactionRoot, { recursive: true });
    atomicWriteJson(journalPath, journal);
  } catch (error) {
    releaseLock(sourceRoot, transactionId);
    if (fs.existsSync(transactionRoot)) fs.rmSync(transactionRoot, { recursive: true, force: true });
    throw error;
  }

  const rollback = (reason = '') => {
    try {
      restoreJournal(sourceRoot, transactionRoot, journal);
      journal.status = 'ROLLED_BACK';
      journal.rolled_back_at = warsawIso();
      journal.rollback_reason = String(reason || 'publikacja przerwana');
      atomicWriteJson(journalPath, journal);
      fs.rmSync(transactionRoot, { recursive: true, force: true });
    } finally {
      releaseLock(sourceRoot, transactionId);
    }
  };

  try {
    for (const file of journal.files) {
      if (!file.before_sha256) continue;
      const live = path.join(sourceRoot, file.path);
      const backup = path.join(transactionRoot, 'backup', file.path);
      atomicCopy(live, backup);
      if (sha256File(backup) !== file.before_sha256) throw new Error(`Backup nie przeszedł kontroli SHA-256: ${file.path}`);
    }
    journal.status = 'BACKED_UP';
    atomicWriteJson(journalPath, journal);
    journal.status = 'PROMOTING';
    atomicWriteJson(journalPath, journal);
    for (const file of journal.files) atomicCopy(path.join(stageRoot, file.path), path.join(sourceRoot, file.path));
    for (const file of journal.files) {
      if (sha256File(path.join(sourceRoot, file.path)) !== file.after_sha256) {
        throw new Error(`Kontrola integralności po promocji nie przeszła: ${file.path}.`);
      }
    }
    journal.status = 'VALIDATING';
    journal.promoted_at = warsawIso();
    atomicWriteJson(journalPath, journal);
  } catch (error) {
    rollback(error.message || error);
    throw error;
  }

  return {
    changed,
    transactionId,
    verify() {
      for (const file of journal.files) {
        const live = path.join(sourceRoot, file.path);
        if (!fs.existsSync(live) || sha256File(live) !== file.after_sha256) {
          throw new Error(`Plik zmienił się przed zatwierdzeniem transakcji: ${file.path}`);
        }
      }
    },
    commit() {
      this.verify();
      journal.status = 'COMMITTED';
      journal.committed_at = warsawIso();
      atomicWriteJson(journalPath, journal);
      if (!journal.completion) {
        releaseLock(sourceRoot, transactionId);
        fs.rmSync(transactionRoot, { recursive: true, force: true });
      }
    },
    finalizeCompletion() {
      if (!journal.completion) return;
      if (journal.status !== 'COMMITTED') throw new Error(`Transakcja ${transactionId} nie jest gotowa do zapisania statusu końcowego.`);
      finalizeCommittedJournal(sourceRoot, transactionRoot, journal);
    },
    rollback,
  };
}

function promoteStaging({ sourceRoot, stageRoot, candidates, baseline }) {
  recoverInterruptedTransactions(sourceRoot);
  const transaction = beginPromotionTransaction({
    sourceRoot,
    stageRoot,
    candidates,
    baseline,
    transactionId: `legacy-${process.pid}-${Date.now()}`,
  });
  transaction.commit();
  return transaction.changed;
}

function runInStaging(stageRoot, args) {
  const capability = issuePipelineCapability(stageRoot, {
    operations: ['article-pipeline:staging', 'article-import:write'],
  });
  const result = spawnSync('node', ['scripts/article-pipeline.js', ...args, '--staging-internal', 'true'], {
    cwd: stageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    env: {
      ...process.env,
      FITPO50_STAGING_INTERNAL: '1',
      FITPO50_PIPELINE_CAPABILITY_TOKEN: capability.token,
      FITPO50_PIPELINE_CAPABILITY_FILE: capability.capabilityPath,
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
  beginPromotionTransaction,
  assertNoUnexpectedStageChanges,
  changedFiles,
  cloneEntry,
  createStagingWorkspace,
  mediaPaths,
  promoteStaging,
  promotionCandidates,
  publicationManifestPath,
  recoverInterruptedTransactions,
  runInStaging,
  runPreviewGate,
  sha256File,
  snapshotCandidates,
  validatePublicationSet,
  writePublicationManifest,
};
