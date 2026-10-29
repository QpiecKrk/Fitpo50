#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const errors = [];
const warnings = [];

const REQUIRED_ADS_TXT_LINE = 'google.com, pub-4993821807276758, DIRECT, f08c47fec0942fa0';
const LEGACY_COUNT = 0;
const LEGACY_FILE = 'scripts/config/adsense-legacy-pages.json';
const ADSENSE_MARKER = /google-adsense-account|adsbygoogle(?:\.js)?|pagead2\.googlesyndication\.com|ca-pub-4993821807276758/i;
const EXPECTED_META = /<meta\b(?=[^>]*\bname="google-adsense-account")(?=[^>]*\bcontent="ca-pub-4993821807276758")[^>]*>/i;
const EXPECTED_SCRIPT = /https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-4993821807276758/i;

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assertMirror(rel) {
  const mirror = `_site/${rel}`;
  if (!exists(mirror)) {
    warnings.push(`Brak mirroru: ${mirror}`);
    return;
  }
  if (read(rel) !== read(mirror)) {
    errors.push(`Niespójność source vs _site: ${rel}`);
  }
}

function htmlFilesIn(dir = '') {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort();
}

function readLegacyPages() {
  if (!exists(LEGACY_FILE)) {
    errors.push(`Brak ścisłej listy legacy: ${LEGACY_FILE}`);
    return [];
  }
  let pages;
  try {
    pages = JSON.parse(read(LEGACY_FILE));
  } catch (err) {
    errors.push(`${LEGACY_FILE}: niepoprawny JSON (${err.message}).`);
    return [];
  }
  if (!Array.isArray(pages)) {
    errors.push(`${LEGACY_FILE}: oczekiwano tablicy.`);
    return [];
  }
  if (pages.length !== LEGACY_COUNT) {
    errors.push(`${LEGACY_FILE}: oczekiwano dokładnie ${LEGACY_COUNT} pozycji, jest ${pages.length}.`);
  }
  const unique = new Set(pages);
  if (unique.size !== pages.length) errors.push(`${LEGACY_FILE}: lista zawiera duplikaty.`);
  const sorted = [...pages].sort();
  if (JSON.stringify(pages) !== JSON.stringify(sorted)) errors.push(`${LEGACY_FILE}: lista musi być posortowana.`);
  for (const rel of pages) {
    if (typeof rel !== 'string' || path.basename(rel) !== rel || !rel.endsWith('.html')) {
      errors.push(`${LEGACY_FILE}: niedozwolona ścieżka ${JSON.stringify(rel)}.`);
    }
  }
  return pages.filter((rel) => typeof rel === 'string');
}

function checkLegacyPage(rel) {
  if (!exists(rel)) {
    errors.push(`Brak pliku legacy: ${rel}`);
    return;
  }
  const html = read(rel);
  if (ADSENSE_MARKER.test(html)) {
    const hasExpectedMeta = EXPECTED_META.test(html);
    const hasExpectedScript = EXPECTED_SCRIPT.test(html);
    const acceptedHomepageState = rel === 'index.html' && hasExpectedMeta && !hasExpectedScript;
    if (!acceptedHomepageState && (!hasExpectedMeta || !hasExpectedScript)) {
      errors.push(`${rel}: niepełny albo nieoczekiwany kod AdSense na stronie legacy.`);
    }
  }
  assertMirror(rel);
}

function rejectAdsenseOutsideLegacy(legacyPages) {
  const legacy = new Set(legacyPages);
  for (const rel of htmlFilesIn()) {
    if (!legacy.has(rel) && ADSENSE_MARKER.test(read(rel))) {
      errors.push(`${rel}: AdSense poza ścisłą listą legacy.`);
    }
  }
  for (const rel of htmlFilesIn('_site')) {
    if (!legacy.has(rel) && ADSENSE_MARKER.test(read(`_site/${rel}`))) {
      errors.push(`_site/${rel}: AdSense poza ścisłą listą legacy.`);
    }
  }
}

function main() {
  if (!exists('ads.txt')) {
    errors.push('Brak ads.txt');
  } else {
    const txt = read('ads.txt');
    if (!txt.includes(REQUIRED_ADS_TXT_LINE)) {
      errors.push('ads.txt: brak wymaganej linii AdSense.');
    }
    assertMirror('ads.txt');
  }

  const legacyPages = readLegacyPages();
  for (const page of legacyPages) checkLegacyPage(page);
  rejectAdsenseOutsideLegacy(legacyPages);

  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL] adsense-readiness-check');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }
  console.log('[PASS] adsense-readiness-check OK.');
}

main();
