#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function normalizeReadingLabel(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return raw;
  const m = raw.match(/(\d+)/);
  if (!m) return raw;
  return `${m[1]} min czytania`;
}

function patchHtml(raw) {
  let next = String(raw || '');

  next = next.replace(
    /(<p class="article-kicker-card__meta">[\s\S]*?<span class="article-kicker-card__category-pill">[\s\S]*?<\/span><span>)([^<]+)(<\/span><\/p>)/g,
    (_m, start, label, end) => `${start}${normalizeReadingLabel(label)}${end}`,
  );

  next = next.replace(
    /(<span class="article-index-card__meta">)([^<]+)(<\/span>)/g,
    (_m, start, label, end) => `${start}${normalizeReadingLabel(label)}${end}`,
  );

  next = next.replace(
    /(data-read-time=")([^"]+)(")/g,
    (_m, start, label, end) => `${start}${normalizeReadingLabel(label)}${end}`,
  );

  return next;
}

function collectHtmlFiles() {
  const result = [];
  for (const dir of ['.', '_site']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs)) {
      if (!file.endsWith('.html')) continue;
      result.push(path.join(abs, file));
    }
  }
  return result.sort();
}

function main() {
  const files = collectHtmlFiles();
  let changed = 0;
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const patched = patchHtml(raw);
    if (patched !== raw) {
      fs.writeFileSync(file, patched, 'utf8');
      changed += 1;
      console.log(`[OK] normalized reading labels: ${path.relative(ROOT, file)}`);
    }
  }
  console.log(`[DONE] reading labels normalized, changed=${changed}`);
}

main();
