#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const errors = [];
const warnings = [];
const CATEGORY_LANDING = new Set([
  'index.html',
  'porady.html',
  'rusz-sie.html',
  'jedzenie.html',
  'zdrowie.html',
  'ciekawe.html',
  'dziennik.html',
  'o-mnie.html',
]);

function parseArgs(argv) {
  return {
    diff: argv.includes('--diff'),
  };
}

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
}

function normalizeRel(value) {
  return String(value || '')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '')
    .trim();
}

function parseDiffHtmlFiles() {
  const diff = run('git', ['diff', '--name-only', 'origin/main...HEAD']);
  if (diff.status !== 0) {
    throw new Error(String(diff.stderr || diff.stdout || '').trim() || 'git diff failed');
  }
  return String(diff.stdout || '')
    .split('\n')
    .map((s) => normalizeRel(s))
    .filter((f) => f.endsWith('.html') && !f.startsWith('_site/'))
    .filter((f) => fs.existsSync(path.join(ROOT, f)));
}

function allArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => fs.existsSync(path.join(ROOT, f)));
}

function collectReadingRoomCards(html) {
  const section = html.match(/<section[^>]*id="porady-preview"[\s\S]*?<\/section>/i);
  if (!section) return [];
  const block = section[0];
  const rx = /<a\b[^>]*class="[^"]*\barticle-promo-card\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi;
  return [...block.matchAll(rx)].map((m) => m[0]);
}

function extractAttr(tag, name) {
  const m = String(tag || '').match(new RegExp(`${name}="([^"]+)"`, 'i'));
  return m ? String(m[1] || '').trim() : '';
}

function verifyImagePath(fromFile, rawPath) {
  const rel = normalizeRel(rawPath.split('#')[0].split('?')[0]);
  if (!rel) return;
  if (/^(https?:|data:|mailto:|tel:)/i.test(rawPath)) return;
  const source = path.join(ROOT, rel);
  const mirror = path.join(ROOT, '_site', rel);
  if (!fs.existsSync(source)) {
    errors.push(`${fromFile}: brak obrazka ${rel}`);
  }
  if (fs.existsSync(path.join(ROOT, '_site')) && !fs.existsSync(mirror)) {
    warnings.push(`${fromFile}: brak mirroru obrazka w _site/${rel}`);
  }
}

function verifyCard(fromFile, cardHtml) {
  const href = normalizeRel(extractAttr(cardHtml, 'href').split('#')[0].split('?')[0]);
  if (!href) {
    errors.push(`${fromFile}: karta Czytelni bez href.`);
  } else {
    if (!href.endsWith('.html')) errors.push(`${fromFile}: karta Czytelni ma nie-html href: ${href}`);
    if (CATEGORY_LANDING.has(href.toLowerCase())) warnings.push(`${fromFile}: karta Czytelni wskazuje landing (${href}).`);
    const target = path.join(ROOT, href);
    if (!fs.existsSync(target)) errors.push(`${fromFile}: karta Czytelni wskazuje nieistniejący plik: ${href}`);
    const mirror = path.join(ROOT, '_site', href);
    if (fs.existsSync(path.join(ROOT, '_site')) && !fs.existsSync(mirror)) warnings.push(`${fromFile}: brak mirroru _site dla linku Czytelni: ${href}`);
  }

  const imgTags = [...String(cardHtml).matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  if (!imgTags.length) {
    errors.push(`${fromFile}: karta Czytelni bez <img>.`);
  }
  for (const tag of imgTags) {
    const src = extractAttr(tag, 'src');
    if (!src) errors.push(`${fromFile}: obrazek karty Czytelni bez src.`);
    if (src) verifyImagePath(fromFile, src);
  }

  const sourceTags = [...String(cardHtml).matchAll(/<source\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of sourceTags) {
    const srcset = extractAttr(tag, 'srcset');
    if (!srcset) continue;
    verifyImagePath(fromFile, srcset.split(',')[0].trim().split(' ')[0]);
  }
}

function verifyFile(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (!/<article\s+class="article-content">/i.test(html)) return;
  const cards = collectReadingRoomCards(html);
  if (!cards.length) {
    errors.push(`${file}: brak sekcji/kart Czytelni (porady-preview + article-promo-card).`);
    return;
  }
  if (cards.length !== 3) {
    errors.push(`${file}: liczba kart Czytelni = ${cards.length} (oczekiwane 3).`);
  }
  for (const card of cards) {
    verifyCard(file, card);
  }
}

function printAndExit() {
  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL] reading-room-link-verifier');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }
  console.log('[PASS] reading-room-link-verifier OK.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = args.diff ? parseDiffHtmlFiles() : allArticleFiles();
  if (!files.length) {
    console.log('[PASS] reading-room-link-verifier - brak plików do sprawdzenia.');
    return;
  }
  for (const file of files) verifyFile(file);
  printAndExit();
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] reading-room-link-verifier -> ${err.message || err}`);
  process.exit(1);
}
