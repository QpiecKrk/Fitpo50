#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const CATEGORY_FILES = ['rusz-sie.html', 'jedzenie.html', 'zdrowie.html', 'ciekawe.html'];

const errors = [];
const warnings = [];

function parseArgs(argv) {
  const out = { changed: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--changed') {
      out.changed.push(String(argv[i + 1] || '').trim());
      i += 1;
    }
  }
  return out;
}

function abs(rel) {
  return path.join(ROOT, rel);
}

function exists(rel) {
  return fs.existsSync(abs(rel));
}

function read(rel) {
  return fs.readFileSync(abs(rel), 'utf8');
}

function normalize(rel) {
  return String(rel || '').replace(/^\.?\//, '');
}

function ensureCoreFiles() {
  const req = [
    'porady.html',
    'sitemap.xml',
    'llms.txt',
    '_site/porady.html',
    '_site/sitemap.xml',
    '_site/llms.txt',
    ...CATEGORY_FILES,
    ...CATEGORY_FILES.map((f) => `_site/${f}`),
  ];
  for (const rel of req) {
    if (!exists(rel)) errors.push(`Brak wymaganego pliku pomocniczego: ${rel}`);
  }
}

function detectChangedArticleFiles(changedPaths) {
  const articleSet = new Set();
  for (const raw of changedPaths) {
    const rel = normalize(raw);
    if (!rel.endsWith('.html')) continue;
    const sourceRel = rel.startsWith('_site/') ? rel.slice('_site/'.length) : rel;
    if (!exists(sourceRel)) continue;
    const html = read(sourceRel);
    if (/<article\s+class="article-content">/i.test(html)) articleSet.add(sourceRel);
  }
  return [...articleSet];
}

function assertMirror(relPath) {
  const mirror = `_site/${relPath}`;
  if (!exists(relPath)) {
    errors.push(`Brak source: ${relPath}`);
    return;
  }
  if (!exists(mirror)) {
    errors.push(`Brak mirroru w _site: ${mirror}`);
    return;
  }
  if (read(relPath) !== read(mirror)) {
    errors.push(`Niespojnosc source vs _site: ${relPath} != ${mirror}`);
  }
}

function runArticleStandardValidator(relPath) {
  const mirror = `_site/${relPath}`;
  const targets = [relPath];
  if (exists(mirror)) targets.push(mirror);
  const res = spawnSync('node', ['scripts/validate-article-standard.js', ...targets], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    errors.push(`validate-article-standard FAIL dla ${relPath}`);
    const tail = `${res.stdout || ''}\n${res.stderr || ''}`.trim().split('\n').slice(-12).join('\n');
    if (tail) warnings.push(`Validator output (${relPath}):\n${tail}`);
  }
}

function validatePdfButton(relPath, html) {
  const m = html.match(/<a\b[^>]*class="[^"]*\bpdf-hero-download\b[^"]*"[^>]*href="([^"]+)"/i);
  if (!m) {
    errors.push(`${relPath}: brak przycisku .pdf-hero-download.`);
    return;
  }
  const href = String(m[1] || '').trim().replace(/^\.\//, '');
  if (!href) {
    errors.push(`${relPath}: pusty href przy .pdf-hero-download.`);
    return;
  }
  if (!exists(href)) errors.push(`${relPath}: brak PDF w source (${href}).`);
  if (!exists(`_site/${href}`)) errors.push(`${relPath}: brak PDF w _site (_site/${href}).`);
}

function validatePresenceInListings(relPath, sitemap, llms, porady, categories) {
  const slug = relPath;
  if (!porady.includes(slug)) errors.push(`${relPath}: brak artykulu na porady.html.`);
  if (!categories.some((c) => c.includes(slug))) {
    errors.push(`${relPath}: brak artykulu na stronie kategorii.`);
  }
  const absoluteUrl = `https://fitpo50.pl/${slug}`;
  if (!sitemap.includes(absoluteUrl)) errors.push(`${relPath}: brak URL w sitemap.xml.`);
  if (!llms.includes(absoluteUrl)) errors.push(`${relPath}: brak URL w llms.txt.`);
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
  console.log('\n[PASS] Article publish guard OK.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureCoreFiles();
  if (errors.length) return printAndExit();

  const changedArticles = detectChangedArticleFiles(args.changed);
  if (!changedArticles.length) {
    console.log('[PASS] Article publish guard: brak zmienionych plikow artykulow.');
    process.exit(0);
  }

  const sitemap = read('sitemap.xml');
  const llms = read('llms.txt');
  const porady = read('porady.html');
  const categories = CATEGORY_FILES.map((f) => read(f));

  for (const relPath of changedArticles) {
    const html = read(relPath);
    runArticleStandardValidator(relPath);
    assertMirror(relPath);
    validatePdfButton(relPath, html);
    validatePresenceInListings(relPath, sitemap, llms, porady, categories);
  }

  printAndExit();
}

main();
