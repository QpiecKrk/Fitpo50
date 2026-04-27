#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const errors = [];
const warnings = [];

const REQUIRED_ADS_TXT_LINE = 'google.com, pub-4993821807276758, DIRECT, f08c47fec0942fa0';
const KEY_PAGES = ['index.html', 'porady.html', 'rusz-sie.html', 'jedzenie.html', 'zdrowie.html', 'ciekawe.html'];

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

function checkPage(rel) {
  if (!exists(rel)) {
    errors.push(`Brak pliku: ${rel}`);
    return;
  }
  const html = read(rel);
  if (!/meta\s+name="google-adsense-account"\s+content="ca-pub-4993821807276758"/i.test(html)) {
    errors.push(`${rel}: brak meta google-adsense-account.`);
  }
  if (!/https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-4993821807276758/i.test(html)) {
    errors.push(`${rel}: brak skryptu adsbygoogle.js z poprawnym client.`);
  }
  assertMirror(rel);
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

  for (const page of KEY_PAGES) {
    checkPage(page);
  }

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

