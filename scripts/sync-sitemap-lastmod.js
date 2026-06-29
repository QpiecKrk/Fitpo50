#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_MIRROR_PATH = path.join(ROOT, '_site', 'sitemap.xml');
const BASE_URL = 'https://fitpo50.pl/';

function parseArgs(argv) {
  return {
    check: argv.includes('--check'),
  };
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFileAtomic(filePath, content) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  for (const match of String(html || '').matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(String(match[1] || '').trim()));
    } catch (_err) {
      // Invalid JSON-LD is handled by schema validators; sitemap sync just falls back to meta tags.
    }
  }
  return blocks;
}

function flattenJsonLd(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  out.push(node);
  if (Array.isArray(node['@graph'])) {
    for (const item of node['@graph']) flattenJsonLd(item, out);
  }
  return out;
}

function isBlogPosting(node) {
  const type = node && node['@type'];
  return type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
}

function datePart(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function extractArticleLastmod(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return '';
  const html = readUtf8(abs);
  for (const block of parseJsonLdBlocks(html)) {
    for (const node of flattenJsonLd(block)) {
      if (!isBlogPosting(node)) continue;
      const modified = datePart(node.dateModified);
      if (modified) return modified;
      const published = datePart(node.datePublished);
      if (published) return published;
    }
  }

  return datePart((html.match(/<meta\s+property="article:modified_time"\s+content="([^"]+)"/i) || [])[1])
    || datePart((html.match(/<meta\s+property="article:published_time"\s+content="([^"]+)"/i) || [])[1]);
}

function updateSitemap(xml) {
  const changes = [];
  const missingFiles = [];
  const updated = xml.replace(/<url>([\s\S]*?)<\/url>/g, (full, body) => {
    const loc = (body.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '';
    if (!loc.startsWith(BASE_URL) || !loc.endsWith('.html')) return full;

    const relPath = loc.slice(BASE_URL.length);
    const articleDate = extractArticleLastmod(relPath);
    if (!articleDate) {
      if (!fs.existsSync(path.join(ROOT, relPath))) missingFiles.push(relPath);
      return full;
    }

    const currentDate = (body.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '';
    if (currentDate === articleDate) return full;

    changes.push({ url: loc, from: currentDate || '(brak)', to: articleDate });
    if (/<lastmod>[^<]*<\/lastmod>/.test(full)) {
      return full.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${articleDate}</lastmod>`);
    }
    return full.replace(/(<loc>[^<]+<\/loc>)/, `$1\n    <lastmod>${articleDate}</lastmod>`);
  });

  return { updated, changes, missingFiles };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error('[FAIL] sitemap-lastmod: brak sitemap.xml');
    process.exit(1);
  }

  const before = readUtf8(SITEMAP_PATH);
  const { updated, changes, missingFiles } = updateSitemap(before);

  if (missingFiles.length) {
    console.error(`[FAIL] sitemap-lastmod: URL-e bez pliku lokalnego: ${missingFiles.join(', ')}`);
    process.exit(1);
  }

  if (args.check) {
    const mirrorOk = !fs.existsSync(SITE_MIRROR_PATH) || readUtf8(SITE_MIRROR_PATH) === before;
    if (changes.length || !mirrorOk) {
      console.error('[FAIL] sitemap-lastmod: sitemap.xml nie jest zsynchronizowana z dateModified artykulow.');
      for (const item of changes.slice(0, 20)) {
        console.error(`- ${item.url}: ${item.from} -> ${item.to}`);
      }
      if (changes.length > 20) console.error(`- ... oraz ${changes.length - 20} kolejnych zmian`);
      if (!mirrorOk) console.error('- _site/sitemap.xml rozni sie od sitemap.xml');
      process.exit(1);
    }
    console.log('[PASS] sitemap-lastmod: OK');
    return;
  }

  if (changes.length) {
    writeFileAtomic(SITEMAP_PATH, updated);
    if (fs.existsSync(path.dirname(SITE_MIRROR_PATH))) {
      writeFileAtomic(SITE_MIRROR_PATH, updated);
    }
  } else if (fs.existsSync(SITE_MIRROR_PATH) && readUtf8(SITE_MIRROR_PATH) !== before) {
    writeFileAtomic(SITE_MIRROR_PATH, before);
  }

  console.log(`[PASS] sitemap-lastmod: updated=${changes.length}`);
}

main();
