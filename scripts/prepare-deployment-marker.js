#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { canonicalFromHtml, modifiedDates } = require('./lib/deployment-live-verifier');
const { categoryFileFromKey, normalizeCategory } = require('./lib/categories');
const { warsawIso } = require('./lib/time');
const { checkNewsFallbackSync } = require('./news-deploy-sync-gate');

const PUBLICATION_STATE_DETAILS = path.join('.cache', 'deployment-publication-state.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function publicFingerprint(siteDir) {
  const required = ['index.html', 'porady.html', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'ads.txt', 'assets/data/search-index.json'];
  const entries = required.map((relativePath) => {
    const absolutePath = path.join(siteDir, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Brak wymaganego pliku eksportu: ${relativePath}`);
    return `${relativePath}\0${sha256(fs.readFileSync(absolutePath))}`;
  });
  return sha256(entries.join('\n'));
}

function gitPublicationPaths(rootDir) {
  const result = spawnSync('git', [
    'ls-files', '-z', '--cached', '--others', '--exclude-standard',
  ], { cwd: rootDir, encoding: null, maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`Nie można ustalić plików publikacji z indeksu Git: ${String(result.stderr || result.stdout || '').trim()}`);
  }
  return new Set(result.stdout.toString('utf8').split('\0').filter(Boolean).map((file) => file.replace(/\\/g, '/')));
}

function publicationStateSnapshot(rootDir) {
  const eligible = gitPublicationPaths(rootDir);
  const siteFiles = [...eligible]
    .filter((file) => file.startsWith('_site/') && file !== '_site/deployment.json')
    .filter((file) => {
      const absolute = path.join(rootDir, file);
      if (!fs.existsSync(absolute)) return false;
      if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`Eksport publikacji zawiera niedozwolony symlink: ${file}`);
      return fs.statSync(absolute).isFile();
    });
  const files = [];
  for (const sitePath of siteFiles) {
    files.push({ path: sitePath, sha256: sha256(fs.readFileSync(path.join(rootDir, sitePath))) });
    const sourcePath = sitePath.slice('_site/'.length);
    const source = path.join(rootDir, sourcePath);
    if (eligible.has(sourcePath) && fs.existsSync(source) && fs.statSync(source).isFile()) {
      files.push({ path: sourcePath, sha256: sha256(fs.readFileSync(source)) });
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path, 'pl'));
  return {
    files,
    fingerprint: sha256(files.map((entry) => `${entry.path}\0${entry.sha256}`).join('\n')),
  };
}

function publicationStateFingerprint(rootDir) {
  return publicationStateSnapshot(rootDir).fingerprint;
}

function publicationStateDifferences(expectedFiles, actualFiles) {
  const expected = new Map((expectedFiles || []).map((entry) => [entry.path, entry.sha256]));
  const actual = new Map((actualFiles || []).map((entry) => [entry.path, entry.sha256]));
  return {
    missing: [...expected.keys()].filter((file) => !actual.has(file)).sort((a, b) => a.localeCompare(b, 'pl')),
    additional: [...actual.keys()].filter((file) => !expected.has(file)).sort((a, b) => a.localeCompare(b, 'pl')),
    changed: [...expected.keys()].filter((file) => actual.has(file) && actual.get(file) !== expected.get(file)).sort((a, b) => a.localeCompare(b, 'pl')),
  };
}

function publicationStateDetailsPath(rootDir) {
  return path.join(rootDir, PUBLICATION_STATE_DETAILS);
}

function readPublicationStateDetails(rootDir, fingerprint) {
  const file = publicationStateDetailsPath(rootDir);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed.publication_state_sha256 !== fingerprint || !Array.isArray(parsed.files)) return null;
    return parsed.files;
  } catch (_error) {
    return null;
  }
}

function assertPreparedPublicationState(rootDir, marker) {
  if (!marker?.prepared_from_head || !marker?.publication_state_sha256) {
    throw new Error('deployment.json nie jest powiązany z HEAD i pełnym stanem publikacji. Uruchom npm run deployment:prepare.');
  }
  const current = publicationStateSnapshot(rootDir);
  if (current.fingerprint !== marker.publication_state_sha256) {
    const currentHead = gitLines(rootDir, ['rev-parse', 'HEAD'])[0] || 'UNKNOWN';
    const expectedFiles = readPublicationStateDetails(rootDir, marker.publication_state_sha256);
    const detail = expectedFiles
      ? (() => {
        const differences = publicationStateDifferences(expectedFiles, current.files);
        const format = (values) => (values.length ? values.join(', ') : '(brak)');
        return `; brakujące: ${format(differences.missing)}; dodatkowe: ${format(differences.additional)}; zmienione: ${format(differences.changed)}`;
      })()
      : '; szczegóły plików niedostępne w tym checkout (lokalny plik diagnostyczny nie jest publikowany)';
    throw new Error(`DEPLOYMENT_PREPARE_STALE: pliki publikacji zmieniły się po przygotowaniu markera (prepared_from_head=${marker.prepared_from_head}, current_head=${currentHead})${detail}. Uruchom ponownie prepush:local i deployment:prepare.`);
  }
  return true;
}

function gitLines(rootDir, args) {
  const result = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean) : [];
}

function normalizeDeploymentPath(file) {
  return String(file || '').replace(/^.* -> /, '').replace(/^_site\//, '').replace(/\\/g, '/');
}

function changedDeploymentPaths(rootDir, options = {}) {
  const statusResult = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: rootDir, encoding: 'utf8' });
  const status = statusResult.status === 0
    ? String(statusResult.stdout || '').split('\n').filter(Boolean).map((line) => line.slice(3).trim())
    : [];
  const ahead = gitLines(rootDir, ['diff', '--name-only', '--no-renames', 'origin/main...HEAD']);
  const boundary = gitLines(rootDir, ['log', '-1', '--format=%H', '--', 'deployment.json'])[0] || '';
  const sinceMarker = boundary ? gitLines(rootDir, ['diff', '--name-only', '--no-renames', boundary, '--']) : [];
  const historical = options.includeSinceMarker ? sinceMarker : [];
  return [...new Set([...status, ...ahead, ...historical].map(normalizeDeploymentPath).filter(Boolean))];
}

function blogPostingFiles(rootDir) {
  const siteDir = path.join(rootDir, '_site');
  if (!fs.existsSync(siteDir)) return [];
  return fs.readdirSync(siteDir)
    .filter((file) => /^[^/]+\.html$/i.test(file))
    .filter((file) => /"@type"\s*:\s*"BlogPosting"/.test(fs.readFileSync(path.join(siteDir, file), 'utf8')));
}

function extractLocalAssetPaths(html) {
  const values = [];
  for (const tag of String(html || '').matchAll(/<(?:source|img)\b[^>]*>/gi)) {
    for (const attribute of tag[0].matchAll(/\b(?:src|srcset)\s*=\s*["']([^"']+)["']/gi)) {
      values.push(...attribute[1].split(',').map((entry) => entry.trim().split(/\s+/)[0]));
    }
  }
  return [...new Set(values
    .filter((value) => value && !/^(?:https?:|data:|\/\/)/i.test(value))
    .map((value) => value.replace(/^\.?\//, '').split(/[?#]/)[0])
    .filter(Boolean))];
}

function ownedArtifactPaths(rootDir, file) {
  const slug = path.basename(file, '.html');
  const html = fs.readFileSync(path.join(rootDir, '_site', file), 'utf8');
  const images = extractLocalAssetPaths(html);
  return new Set([file, `assets/pdf/${slug}.pdf`, ...images]);
}

function changedRootArticles(rootDir) {
  const changed = new Set(changedDeploymentPaths(rootDir));
  return blogPostingFiles(rootDir)
    .filter((file) => [...ownedArtifactPaths(rootDir, file)].some((artifact) => changed.has(artifact)))
    .sort((a, b) => a.localeCompare(b, 'pl'));
}

// The last committed marker remains a release boundary even after origin/main
// advances. Do not use origin/main as the only completeness check.
function assertArticleInventoryComplete(rootDir, articles) {
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Kontrola kompletności markera: git ${args.join(' ')}: ${result.stderr || result.stdout}`);
    return String(result.stdout || '').trim();
  };
  const boundary = git(['log', '-1', '--format=%H', '--', 'deployment.json']);
  const changed = boundary
    ? git(['diff', '--name-only', '--no-renames', boundary, '--', '_site/*.html']).split('\n')
    : git(['ls-files', '--', '_site/*.html']).split('\n');
  changed.push(...git(['ls-files', '--others', '--exclude-standard', '--', '_site/*.html']).split('\n'));
  const included = new Set(articles.map((article) => article.file));
  const missing = [...new Set(changed)]
    .filter((file) => /^_site\/[^/]+\.html$/i.test(file))
    .filter((file) => fs.existsSync(path.join(rootDir, file)))
    .filter((file) => /"@type"\s*:\s*"BlogPosting"/.test(fs.readFileSync(path.join(rootDir, file), 'utf8')))
    .map((file) => file.slice('_site/'.length))
    .filter((file) => !included.has(file));
  const changedPaths = new Set(changedDeploymentPaths(rootDir, { includeSinceMarker: true }));
  for (const file of blogPostingFiles(rootDir)) {
    if (included.has(file)) continue;
    const changedArtifacts = [...ownedArtifactPaths(rootDir, file)].filter((artifact) => artifact !== file && changedPaths.has(artifact));
    if (changedArtifacts.length) missing.push(`${file} (artefakty: ${changedArtifacts.join(', ')})`);
  }
  if (missing.length) throw new Error(`DEPLOYMENT_ARTICLES_INCOMPLETE: zmienione BlogPosting w _site pominięte w articles: ${missing.join(', ')}. Marker przygotuj przed commitem i jednym pushem treści oraz markera.`);
}

function articleDeploymentEntry(rootDir, file) {
  const htmlPath = path.join(rootDir, '_site', file);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const canonical = canonicalFromHtml(html);
  const dates = modifiedDates(html);
  if (!canonical || dates.length !== 1) throw new Error(`${file}: marker wymaga jednego canonical i dateModified.`);
  const slug = path.basename(file, '.html');
  const pdfRelative = path.join('assets', 'pdf', `${slug}.pdf`);
  const pdfPath = path.join(rootDir, '_site', pdfRelative);
  if (!fs.existsSync(pdfPath)) throw new Error(`${file}: brak PDF w _site.`);
  const imagePaths = extractLocalAssetPaths(html)
    .filter((value) => fs.existsSync(path.join(rootDir, '_site', value)));
  const section = html.match(/<meta\s+property=["']article:section["']\s+content=["']([^"']+)["']/i)?.[1] || 'ciekawe';
  const categoryFile = categoryFileFromKey(normalizeCategory(section).key);
  const listingCandidates = ['index.html', 'porady.html', categoryFile, 'assets/data/search-index.json'];
  const listingPaths = listingCandidates.filter((relativePath) => {
    const listing = path.join(rootDir, '_site', relativePath);
    return fs.existsSync(listing) && fs.readFileSync(listing, 'utf8').includes(file);
  });
  for (const requiredListing of ['porady.html', categoryFile, 'assets/data/search-index.json']) {
    if (!listingPaths.includes(requiredListing)) throw new Error(`${file}: eksport nie zawiera artykułu w ${requiredListing}.`);
  }
  return {
    file,
    slug,
    url: canonical,
    date_modified: dates[0],
    html_sha256: sha256(fs.readFileSync(htmlPath)),
    pdf_path: pdfRelative.replace(/\\/g, '/'),
    pdf_sha256: sha256(fs.readFileSync(pdfPath)),
    images: [...new Set(imagePaths)].sort().map((relativePath) => ({ path: relativePath, sha256: sha256(fs.readFileSync(path.join(rootDir, '_site', relativePath))) })),
    listing_paths: listingPaths,
  };
}

function prepareDeploymentMarker(rootDir, options = {}) {
  const siteDir = path.join(rootDir, '_site');
  if (!fs.existsSync(siteDir)) throw new Error('Brak katalogu _site. Najpierw wykonaj eksport.');
  const articles = changedRootArticles(rootDir).map((file) => articleDeploymentEntry(rootDir, file));
  assertArticleInventoryComplete(rootDir, articles);
  const publicationState = publicationStateSnapshot(rootDir);
  const marker = {
    version: 2,
    release_id: options.releaseId || crypto.randomUUID(),
    prepared_at: options.preparedAt || warsawIso(),
    prepared_from_head: gitLines(rootDir, ['rev-parse', 'HEAD'])[0] || '',
    publication_state_sha256: publicationState.fingerprint,
    public_fingerprint_sha256: publicFingerprint(siteDir),
    articles,
  };
  fs.mkdirSync(path.dirname(publicationStateDetailsPath(rootDir)), { recursive: true });
  atomicWriteFileSync(publicationStateDetailsPath(rootDir), `${JSON.stringify({
    publication_state_sha256: publicationState.fingerprint,
    files: publicationState.files,
  }, null, 2)}\n`, 'utf8');
  const serialized = `${JSON.stringify(marker, null, 2)}\n`;
  atomicWriteFileSync(path.join(rootDir, 'deployment.json'), serialized, 'utf8');
  atomicWriteFileSync(path.join(siteDir, 'deployment.json'), serialized, 'utf8');
  return marker;
}

function runDeploymentPrepare(rootDir, options = {}) {
  const newsSyncCheck = options.newsSyncCheck || checkNewsFallbackSync;
  const markerPrepare = options.markerPrepare || prepareDeploymentMarker;
  newsSyncCheck({ root: rootDir });
  return markerPrepare(rootDir, options.markerOptions || {});
}

if (require.main === module) {
  try {
    const marker = runDeploymentPrepare(process.cwd());
    console.log(`[DEPLOYMENT PREPARED] ${marker.release_id}`);
    console.log('Marker: deployment.json oraz _site/deployment.json');
  } catch (error) {
    console.error(`[DEPLOYMENT PREPARE][FAIL] ${error.message || error}`);
    process.exit(error && Number.isInteger(error.exitCode) ? error.exitCode : 1);
  }
}

module.exports = {
  articleDeploymentEntry,
  assertPreparedPublicationState,
  changedDeploymentPaths,
  changedRootArticles,
  extractLocalAssetPaths,
  prepareDeploymentMarker,
  runDeploymentPrepare,
  publicationStateFingerprint,
  publicationStateDifferences,
  publicationStateSnapshot,
  publicationStateDetailsPath,
  readPublicationStateDetails,
  publicFingerprint,
  sha256,
};
