#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validatePublicNewsCheckout } = require('./lib/news-public-integrity');

const ROOT = process.cwd();

const REQUIRED_FILES = [
  'data/news-live.json',
  'assets/data/news-fallback.json',
  '_site/data/news-live.json',
  '_site/assets/data/news-fallback.json',
];

const errors = [];
const warnings = [];

function abs(relPath) {
  return path.join(ROOT, relPath);
}

function exists(relPath) {
  return fs.existsSync(abs(relPath));
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(abs(relPath), 'utf8'));
}

function normalizedJsonString(relPath) {
  return JSON.stringify(readJson(relPath));
}

function validateFilesPresence() {
  for (const rel of REQUIRED_FILES) {
    if (!exists(rel)) errors.push(`Brak pliku: ${rel}`);
  }
}

function validateMirrorSync() {
  const pairs = [
    ['data/news-live.json', '_site/data/news-live.json'],
    ['assets/data/news-fallback.json', '_site/assets/data/news-fallback.json'],
  ];

  for (const [source, mirror] of pairs) {
    if (!exists(source) || !exists(mirror)) continue;
    if (normalizedJsonString(source) !== normalizedJsonString(mirror)) {
      errors.push(`Niespojnosc danych: ${source} != ${mirror}`);
    }
  }
}

function validateNoDraftsInPublicMirrors() {
  for (const rel of ['assets/data/news-fallback.json', '_site/assets/data/news-fallback.json']) {
    if (!exists(rel)) continue;
    const items = readJson(rel).items || [];
    if (items.some((item) => item && String(item.status || '').toLowerCase() === 'draft')) {
      errors.push(`Prywatny szkic NEWS trafił do publicznego pliku: ${rel}`);
    }
  }
}

function validatePublishedImagesAndFallback() {
  if (!exists('data/news-live.json')) {
    warnings.push('Brak lokalnego prywatnego data/news-live.json — pełna kontrola NEWS wymaga npm run news:pull.');
    return;
  }
  if (!exists('assets/data/news-fallback.json')) return;

  const live = readJson('data/news-live.json');
  const fallback = readJson('assets/data/news-fallback.json');

  const liveItems = Array.isArray(live.items) ? live.items : [];
  const fallbackItems = Array.isArray(fallback.items) ? fallback.items : [];

  const published = liveItems.filter((item) => item && item.status === 'published');
  const publishedIds = published.map((item) => String(item.id || ''));
  const fallbackIds = fallbackItems.map((item) => String(item && item.id ? item.id : ''));

  if (JSON.stringify(publishedIds) !== JSON.stringify(fallbackIds)) {
    errors.push('Niespojnosc listy opublikowanych newsow: data/news-live.json vs assets/data/news-fallback.json');
  }

}

function printAndExit() {
  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL]');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }
  console.log('\n[PASS] NEWS integrity check OK.');
}

function main() {
  validateFilesPresence();
  validateMirrorSync();
  validateNoDraftsInPublicMirrors();
  const publicNews = validatePublicNewsCheckout({ root: ROOT });
  errors.push(...publicNews.errors);
  warnings.push(...publicNews.warnings);
  validatePublishedImagesAndFallback();
  printAndExit();
}

main();
