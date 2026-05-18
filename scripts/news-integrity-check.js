#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IMAGE_EXTS = ['avif', 'webp', 'jpg'];

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

function hasAnyVariant(dirRel, imageBase) {
  return IMAGE_EXTS.some((ext) => exists(`${dirRel}/${imageBase}.${ext}`));
}

function isRuntimeNewsThumb(imageBase) {
  return /^news_20/i.test(String(imageBase || '').trim());
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

function validatePublishedImagesAndFallback() {
  if (!exists('data/news-live.json') || !exists('assets/data/news-fallback.json')) return;

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

  const publishedById = new Map();
  for (const item of published) {
    publishedById.set(String(item.id || ''), item);
  }

  for (const item of published) {
    const title = String(item.title || item.id || '(bez tytulu)');
    const imageBase = String(item.image_base || '').trim();
    if (!imageBase) {
      errors.push(`Opublikowany news "${title}" nie ma image_base.`);
      continue;
    }

    if (!hasAnyVariant('assets/news', imageBase)) {
      if (isRuntimeNewsThumb(imageBase)) {
        warnings.push(`Brak runtime miniatur dla "${title}" w assets/news (image_base="${imageBase}") — pomijam jako asset serwerowy.`);
      } else {
        errors.push(`Brak miniatur dla "${title}" w assets/news (image_base="${imageBase}").`);
      }
    }
    if (!hasAnyVariant('_site/assets/news', imageBase)) {
      warnings.push(`Brak miniatur dla "${title}" w _site/assets/news (image_base="${imageBase}").`);
    }
  }

  for (const item of fallbackItems) {
    if (!item) continue;
    const id = String(item.id || '');
    const liveItem = publishedById.get(id);
    if (!liveItem) continue;

    const imageBase = String(liveItem.image_base || '').trim();
    const image = item.image || {};
    if (!image || typeof image !== 'object') {
      errors.push(`Fallback news id="${id}" nie ma obiektu image.`);
      continue;
    }

    for (const ext of IMAGE_EXTS) {
      const expected = `./assets/news/${imageBase}.${ext}`;
      const got = String(image[ext] || '').trim();
      if (!got) {
        errors.push(`Fallback news id="${id}" nie ma image.${ext}.`);
        continue;
      }
      if (got !== expected) {
        warnings.push(`Fallback news id="${id}" ma image.${ext}="${got}" (oczekiwane: "${expected}").`);
      }
    }
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
  validatePublishedImagesAndFallback();
  printAndExit();
}

main();
