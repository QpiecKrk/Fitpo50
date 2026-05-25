#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SKIPPED_H2 = new Set([
  'kluczowe wnioski',
  'najczęściej zadawane pytania',
  'najczesciej zadawane pytania',
  'zrodla',
  'źródła',
  'szybka odpowiedź',
  'szybka odpowiedz'
]);

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function clipWords(text, maxWords) {
  const words = String(text || '').match(/[\p{L}\p{N}'’.-]+/gu) || [];
  if (words.length <= maxWords) return text;
  const out = words.slice(0, maxWords).join(' ').replace(/[,:;\s]+$/g, '').trim();
  return /[.!?]$/.test(out) ? out : `${out}.`;
}

function slugFromPath(filePath) {
  return path.basename(filePath).replace(/\.html$/i, '');
}

function normalizeTitle(rawTitle) {
  return String(rawTitle || '').replace(/\s*\|\s*FitPo50\s*$/i, '').trim();
}

function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function categoryInfo(section) {
  const s = String(section || '').trim().toLowerCase();
  if (s === 'ruch') return { name: 'Rusz się', url: 'https://fitpo50.pl/rusz-sie.html' };
  if (s === 'jedzenie') return { name: 'Jedzenie', url: 'https://fitpo50.pl/jedzenie.html' };
  if (s === 'zdrowie') return { name: 'Zdrowie', url: 'https://fitpo50.pl/zdrowie.html' };
  if (s === 'ciekawe') return { name: 'Ciekawe', url: 'https://fitpo50.pl/ciekawe.html' };
  return { name: 'Porady', url: 'https://fitpo50.pl/porady.html' };
}

function ensureBreadcrumb(raw, filePath) {
  if (/"@type"\s*:\s*"BreadcrumbList"/i.test(raw)) return { raw, changed: false };

  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/i);
  const title = normalizeTitle(titleMatch ? stripTags(titleMatch[1]) : slugFromPath(filePath));

  const canonicalMatch = raw.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || raw.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : `https://fitpo50.pl/${slugFromPath(filePath)}.html`;

  const sectionMatch = raw.match(/<meta[^>]*property=["']article:section["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || raw.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:section["'][^>]*>/i);
  const category = categoryInfo(sectionMatch ? sectionMatch[1] : '');

  const json = `\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "BreadcrumbList",\n  "itemListElement": [\n    {\n      "@type": "ListItem",\n      "position": 1,\n      "name": "Strona główna",\n      "item": "https://fitpo50.pl/"\n    },\n    {\n      "@type": "ListItem",\n      "position": 2,\n      "name": "${esc(category.name)}",\n      "item": "${esc(category.url)}"\n    },\n    {\n      "@type": "ListItem",\n      "position": 3,\n      "name": "${esc(title)}",\n      "item": "${esc(canonical)}"\n    }\n  ]\n}\n</script>\n`;

  const headClose = raw.search(/<\/head>/i);
  if (headClose === -1) return { raw, changed: false };
  return { raw: raw.slice(0, headClose) + json + raw.slice(headClose), changed: true };
}

function trimIntroParagraphs(raw) {
  const h2Rx = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  const matches = [...raw.matchAll(h2Rx)];
  if (!matches.length) return { raw, changed: false };

  let out = raw;
  let offset = 0;
  let changed = false;

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const headingHtml = m[1] || '';
    const headingText = stripTags(headingHtml).toLowerCase();
    if (SKIPPED_H2.has(headingText)) continue;

    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const segStart = start + offset;
    const segEnd = end + offset;
    const segment = out.slice(segStart, segEnd);

    const pRx = /<p\b([^>]*)>([\s\S]*?)<\/p>/i;
    const pMatch = segment.match(pRx);
    if (!pMatch) continue;

    const pFull = pMatch[0];
    const pAttrs = pMatch[1] || '';
    const pInner = pMatch[2] || '';
    const words = countWords(stripTags(pInner));
    if (words <= 70) continue;

    const clipped = clipWords(stripTags(pInner), 70);
    const repl = `<p${pAttrs}>${clipped}</p>`;
    const nextSegment = segment.replace(pFull, repl);

    out = out.slice(0, segStart) + nextSegment + out.slice(segEnd);
    offset += nextSegment.length - segment.length;
    changed = true;
  }

  return { raw: out, changed };
}

function main() {
  const files = process.argv.slice(2).filter((p) => p.endsWith('.html'));
  if (!files.length) {
    console.error('Usage: node scripts/fix-article-guard-issues.js <file1.html> [file2.html ...]');
    process.exit(1);
  }

  let touched = 0;
  for (const rel of files) {
    const filePath = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(filePath)) continue;

    const original = fs.readFileSync(filePath, 'utf8');
    const b = ensureBreadcrumb(original, filePath);
    const t = trimIntroParagraphs(b.raw);
    const next = t.raw;

    if (next !== original) {
      fs.writeFileSync(filePath, next, 'utf8');
      touched += 1;
      console.log(`[FIXED] ${rel}`);
    }
  }
  console.log(`[DONE] touched=${touched}`);
}

main();
