#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function firstMatch(raw, rx) {
  const m = raw.match(rx);
  return m ? m[1] : '';
}

function escapeJson(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function withUpdatedMeta(raw, attrRegex, tagBuilder) {
  const match = raw.match(attrRegex);
  if (!match) return { raw, changed: false };
  const oldTag = match[0];
  const newTag = tagBuilder();
  if (oldTag === newTag) return { raw, changed: false };
  return { raw: raw.replace(oldTag, newTag), changed: true };
}

function ensureBreadcrumb(raw, canonicalUrl, articleTitle, categoryName, categoryUrl) {
  if (/"@type"\s*:\s*"BreadcrumbList"/i.test(raw)) {
    return { raw, changed: false };
  }
  const breadcrumb = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Strona główna",
      "item": "https://fitpo50.pl/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "${escapeJson(categoryName)}",
      "item": "${escapeJson(categoryUrl)}"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "${escapeJson(articleTitle)}",
      "item": "${escapeJson(canonicalUrl)}"
    }
  ]
}
</script>
`;
  const anchor = '</head>';
  const idx = raw.indexOf(anchor);
  if (idx === -1) return { raw, changed: false };
  const next = `${raw.slice(0, idx)}${breadcrumb}\n${raw.slice(idx)}`;
  return { raw: next, changed: true };
}

function normalizeTitle(title) {
  return String(title || '').replace(/\s*\|\s*FitPo50\s*$/i, '').trim();
}

function categoryToUrl(sectionRaw) {
  const section = String(sectionRaw || '').trim().toLowerCase();
  if (section === 'ruch') return { name: 'Ruch się', url: 'https://fitpo50.pl/rusz-sie.html' };
  if (section === 'jedzenie') return { name: 'Jedzenie', url: 'https://fitpo50.pl/jedzenie.html' };
  if (section === 'zdrowie') return { name: 'Zdrowie', url: 'https://fitpo50.pl/zdrowie.html' };
  if (section === 'ciekawe') return { name: 'Ciekawe', url: 'https://fitpo50.pl/ciekawe.html' };
  return { name: 'Porady', url: 'https://fitpo50.pl/porady.html' };
}

function syncFile(filePath) {
  const original = readUtf8(filePath);
  let raw = original;
  let changed = false;

  const titleTag = firstMatch(raw, /<title>([^<]+)<\/title>/i);
  const titleBase = normalizeTitle(titleTag);
  if (!titleBase) return { filePath, changed: false, warning: 'Brak <title>.' };

  const canonical = firstMatch(raw, /<link\s+rel="canonical"\s+href="([^"]+)"/i);
  if (!canonical) return { filePath, changed: false, warning: 'Brak canonical.' };

  const section = firstMatch(raw, /<meta\s+property="article:section"\s+content="([^"]+)"/i);
  const category = categoryToUrl(section);

  const og = withUpdatedMeta(
    raw,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*>/i,
    () => `<meta property="og:title" content="${titleBase}">`,
  );
  raw = og.raw;
  changed = changed || og.changed;

  const tw = withUpdatedMeta(
    raw,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*>/i,
    () => `<meta name="twitter:title" content="${titleBase}">`,
  );
  raw = tw.raw;
  changed = changed || tw.changed;

  const bc = ensureBreadcrumb(raw, canonical, titleBase, category.name, category.url);
  raw = bc.raw;
  changed = changed || bc.changed;

  if (changed) writeUtf8(filePath, raw);
  return { filePath, changed, warning: '' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug) {
    console.error('Usage: node scripts/sync-article-title-breadcrumb.js --slug <slug>');
    process.exit(1);
  }
  const slug = String(args.slug).trim();
  const files = [
    path.join(process.cwd(), `${slug}.html`),
    path.join(process.cwd(), '_site', `${slug}.html`),
  ];
  let changedCount = 0;
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.warn(`[SYNC-TITLE-BC] skip (missing): ${path.relative(process.cwd(), file)}`);
      continue;
    }
    const res = syncFile(file);
    if (res.warning) {
      console.warn(`[SYNC-TITLE-BC] ${path.relative(process.cwd(), file)}: ${res.warning}`);
      continue;
    }
    console.log(`[SYNC-TITLE-BC] ${path.relative(process.cwd(), file)}: ${res.changed ? 'updated' : 'already-synced'}`);
    if (res.changed) changedCount += 1;
  }
  console.log(`[SYNC-TITLE-BC] done, changed=${changedCount}`);
}

main();

