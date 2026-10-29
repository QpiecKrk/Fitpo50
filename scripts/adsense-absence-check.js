#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const errors = [];
const ADSENSE_MARKER = /google-adsense-account|adsbygoogle(?:\.js)?|pagead2\.googlesyndication\.com|ca-pub-4993821807276758/i;

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function htmlFilesIn(dir = '') {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort();
}

function rejectAdsenseInHtml() {
  for (const rel of htmlFilesIn()) {
    if (ADSENSE_MARKER.test(read(rel))) errors.push(`${rel}: wykryto zabroniony kod AdSense.`);
  }
  for (const rel of htmlFilesIn('_site')) {
    if (ADSENSE_MARKER.test(read(`_site/${rel}`))) errors.push(`_site/${rel}: wykryto zabroniony kod AdSense.`);
  }
}

function main() {
  for (const rel of ['ads.txt', '_site/ads.txt']) {
    if (exists(rel)) errors.push(`${rel}: plik deklarujący sprzedawcę AdSense nie może być publikowany.`);
  }
  rejectAdsenseInHtml();

  if (errors.length) {
    console.log('\n[FAIL] adsense-absence-check');
    errors.forEach((error) => console.log(`- ${error}`));
    process.exit(1);
  }
  console.log('[PASS] adsense-absence-check OK.');
}

main();
