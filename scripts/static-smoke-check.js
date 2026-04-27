#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targetDir = path.resolve(root, process.argv[2] || '_site');
const errors = [];

function read(rel) {
  return fs.readFileSync(path.join(targetDir, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(targetDir, rel));
}

function assertFile(rel) {
  if (!exists(rel)) errors.push(`Brak pliku: ${path.join(targetDir, rel)}`);
}

function main() {
  const required = ['index.html', 'porady.html', 'zdrowie.html', 'sitemap.xml', 'llms.txt', 'ads.txt'];
  for (const rel of required) assertFile(rel);
  if (errors.length) return fail();

  const index = read('index.html');
  const porady = read('porady.html');
  const zdrowie = read('zdrowie.html');
  const sitemap = read('sitemap.xml');
  const llms = read('llms.txt');
  const ads = read('ads.txt');

  if (!/google-adsense-account/i.test(index)) errors.push('index.html: brak meta google-adsense-account');
  const hasPoradyCount = /data-article-count=/i.test(porady);
  const poradyCards = (porady.match(/data-article-item/gi) || []).length;
  if (!hasPoradyCount && poradyCards === 0) {
    errors.push('porady.html: brak licznika i brak kart artykułów.');
  }
  if (!/<meta name="robots" content="index,follow">/i.test(zdrowie)) errors.push('zdrowie.html: brak robots index,follow');
  if (!/https:\/\/fitpo50\.pl\//i.test(sitemap)) errors.push('sitemap.xml: brak URL-i fitpo50.pl');
  if (!/https:\/\/fitpo50\.pl\//i.test(llms)) errors.push('llms.txt: brak URL-i fitpo50.pl');
  if (!/^google\.com,\s*pub-\d+,\s*DIRECT,\s*f08c47fec0942fa0\s*$/im.test(ads)) errors.push('ads.txt: brak prawidłowej linii AdSense');

  const urlMatches = [...sitemap.matchAll(/<loc>https:\/\/fitpo50\.pl\/([^<]+)<\/loc>/gi)]
    .map((m) => String(m[1] || '').trim())
    .filter(Boolean);
  const localPages = urlMatches.filter((u) => u.endsWith('.html')).slice(0, 3);
  for (const page of localPages) {
    if (!exists(page)) errors.push(`Sitemap wskazuje plik, którego brak w eksporcie: ${page}`);
  }

  if (errors.length) return fail();
  console.log(`[PASS] smoke:static - ${targetDir}`);
}

function fail() {
  console.log('\n[FAIL] smoke:static');
  for (const e of errors) console.log(`- ${e}`);
  process.exit(1);
}

main();
