#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { canonicalFromHtml, modifiedDates } = require('./lib/deployment-live-verifier');
const { categoryFileFromKey, normalizeCategory } = require('./lib/categories');

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

function changedRootArticles(rootDir) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: rootDir, encoding: 'utf8' });
  if (result.status !== 0) return [];
  const fromStatus = String(result.stdout || '').split('\n').map((line) => line.slice(3).trim()).filter(Boolean);
  const ahead = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD', '--', '*.html'], { cwd: rootDir, encoding: 'utf8' });
  const fromAhead = ahead.status === 0 ? String(ahead.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean) : [];
  return [...new Set([...fromStatus, ...fromAhead].map((file) => file.replace(/^_site\//, '')))]
    .filter((file) => /^[^/]+\.html$/i.test(file))
    .filter((file) => fs.existsSync(path.join(rootDir, '_site', file)))
    .filter((file) => /"@type"\s*:\s*"BlogPosting"/.test(fs.readFileSync(path.join(rootDir, '_site', file), 'utf8')))
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
  const imagePaths = [...html.matchAll(/<(?:source|img)\b[^>]+(?:src|srcset)=["']([^"']+)["']/gi)]
    .flatMap((match) => match[1].split(',').map((entry) => entry.trim().split(/\s+/)[0]))
    .filter((value) => value && !/^(?:https?:|data:|\/\/)/.test(value))
    .map((value) => value.replace(/^\.\//, ''))
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
  const marker = {
    version: 2,
    release_id: options.releaseId || crypto.randomUUID(),
    prepared_at: options.preparedAt || new Date().toISOString(),
    public_fingerprint_sha256: publicFingerprint(siteDir),
    articles,
  };
  const serialized = `${JSON.stringify(marker, null, 2)}\n`;
  fs.writeFileSync(path.join(rootDir, 'deployment.json'), serialized, 'utf8');
  fs.writeFileSync(path.join(siteDir, 'deployment.json'), serialized, 'utf8');
  return marker;
}

if (require.main === module) {
  try {
    const marker = prepareDeploymentMarker(process.cwd());
    console.log(`[DEPLOYMENT PREPARED] ${marker.release_id}`);
    console.log('Marker: deployment.json oraz _site/deployment.json');
  } catch (error) {
    console.error(`[DEPLOYMENT PREPARE][FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { articleDeploymentEntry, changedRootArticles, prepareDeploymentMarker, publicFingerprint, sha256 };
