#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const ISO_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
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

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function extractArticleContent(raw) {
  const m = raw.match(/<article\s+class="article-content">/i);
  if (!m || m.index === undefined) return '';
  const start = m.index + m[0].length;
  const end = raw.search(/<\/article>/i);
  if (end > start) return raw.slice(start, end);
  return raw.slice(start);
}

function countInternalContextLinks(articleContentHtml) {
  const rx = /<a\b[^>]*href="([^"]+)"/gi;
  const unique = new Set();
  for (const m of articleContentHtml.matchAll(rx)) {
    const href = String(m[1] || '').trim();
    if (!href) continue;
    if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
    if (!/\.html(?:[?#].*)?$/i.test(href)) continue;
    if (/^\.?\/?porady\.html(?:[?#].*)?$/i.test(href)) continue;
    unique.add(href.replace(/^\.\//, ''));
  }
  return unique.size;
}

function extractMeta(content, prop) {
  const rx = new RegExp(`<meta\\s+[^>]*property="${prop}"[^>]*content="([^"]+)"`, 'i');
  const m = content.match(rx);
  return m ? String(m[1] || '').trim() : '';
}

function extractMetaName(content, name) {
  const rx = new RegExp(`<meta\\s+[^>]*name="${name}"[^>]*content="([^"]+)"`, 'i');
  const m = content.match(rx);
  return m ? String(m[1] || '').trim() : '';
}

function parseJsonLdBlocks(content) {
  const rx = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  for (const m of content.matchAll(rx)) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      warnings.push('JSON-LD: pomijam nieparsowalny blok.');
    }
  }
  return out;
}

function flattenJsonLd(doc) {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc.flatMap(flattenJsonLd);
  if (doc['@graph'] && Array.isArray(doc['@graph'])) return doc['@graph'].flatMap(flattenJsonLd);
  return [doc];
}

function findBlogPosting(content) {
  const blocks = parseJsonLdBlocks(content).flatMap(flattenJsonLd);
  for (const obj of blocks) {
    const t = obj && obj['@type'];
    if (t === 'BlogPosting') return obj;
    if (Array.isArray(t) && t.includes('BlogPosting')) return obj;
  }
  return null;
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
  const res = spawnSync('node', ['scripts/validate-article-standard.js', relPath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    errors.push(`validate-article-standard FAIL dla ${relPath}`);
    const tail = `${res.stdout || ''}\n${res.stderr || ''}`.trim().split('\n').slice(-8).join('\n');
    if (tail) warnings.push(`Validator output (${relPath}):\n${tail}`);
  }
}

function validateTitleAndDescription(relPath, html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const desc = extractMetaName(html, 'description');
  if (!title) errors.push(`${relPath}: brak <title>.`);
  if (title.length > 65) errors.push(`${relPath}: <title> ma ${title.length} znakow (limit 65).`);
  if (!desc) errors.push(`${relPath}: brak meta description.`);
  if (desc.length > 160) errors.push(`${relPath}: meta description ma ${desc.length} znakow (limit 160).`);
}

function validateNoInlineStyles(relPath, html) {
  if (/<style\b/i.test(html)) errors.push(`${relPath}: wykryto lokalny <style>.`);
  if (/\sstyle\s*=\s*"[^"]*"/i.test(html)) errors.push(`${relPath}: wykryto inline style="...".`);
}

function validateDates(relPath, html, blogPosting) {
  const publishedMeta = extractMeta(html, 'article:published_time');
  const modifiedMeta = extractMeta(html, 'article:modified_time');
  if (!publishedMeta) errors.push(`${relPath}: brak article:published_time.`);
  if (!modifiedMeta) errors.push(`${relPath}: brak article:modified_time.`);
  if (publishedMeta && !ISO_RX.test(publishedMeta)) errors.push(`${relPath}: article:published_time nie jest pelnym ISO 8601.`);
  if (modifiedMeta && !ISO_RX.test(modifiedMeta)) errors.push(`${relPath}: article:modified_time nie jest pelnym ISO 8601.`);

  if (!blogPosting) {
    errors.push(`${relPath}: brak BlogPosting w JSON-LD.`);
    return;
  }
  const dp = String(blogPosting.datePublished || '').trim();
  const dm = String(blogPosting.dateModified || '').trim();
  if (!dp) errors.push(`${relPath}: BlogPosting.datePublished jest puste.`);
  if (!dm) errors.push(`${relPath}: BlogPosting.dateModified jest puste.`);
  if (dp && !ISO_RX.test(dp)) errors.push(`${relPath}: BlogPosting.datePublished nie jest pelnym ISO 8601.`);
  if (dm && !ISO_RX.test(dm)) errors.push(`${relPath}: BlogPosting.dateModified nie jest pelnym ISO 8601.`);
}

function validateSpeakable(relPath, html, blogPosting) {
  if (!blogPosting) return;
  const speakable = blogPosting.speakable;
  if (!speakable || typeof speakable !== 'object') {
    errors.push(`${relPath}: brak BlogPosting.speakable.`);
    return;
  }
  const selectors = Array.isArray(speakable.cssSelector) ? speakable.cssSelector : [speakable.cssSelector].filter(Boolean);
  if (!selectors.length) {
    errors.push(`${relPath}: speakable.cssSelector jest puste.`);
    return;
  }
  for (const sel of selectors) {
    const s = String(sel || '').trim();
    if (!s) continue;
    if (!(s.startsWith('.') || s.startsWith('#'))) {
      errors.push(`${relPath}: speakable selector "${s}" nie jest CSS class/id.`);
      continue;
    }
    const firstToken = s.split(/\s+/)[0].trim();
    if (firstToken.startsWith('.')) {
      const className = firstToken.slice(1);
      if (!new RegExp(`class="[^"]*\\b${className}\\b`).test(html)) {
        errors.push(`${relPath}: speakable selector "${s}" nie istnieje w HTML.`);
      }
      continue;
    }
    if (firstToken.startsWith('#') && !new RegExp(`id="${firstToken.slice(1)}"`).test(html)) {
      errors.push(`${relPath}: speakable selector "${s}" nie istnieje w HTML.`);
    }
  }
}

function validateKeyTakeaways(relPath, html, articleContent) {
  const keyPos = html.search(/class="key-takeaways"/i);
  if (keyPos === -1) {
    errors.push(`${relPath}: brak sekcji .key-takeaways.`);
    return;
  }
  const leadP = articleContent.search(/<p\b[^>]*>[\s\S]*?<\/p>/i);
  if (leadP !== -1 && keyPos < html.indexOf(articleContent) + leadP) {
    errors.push(`${relPath}: .key-takeaways jest przed wstepem (pierwszym akapitem).`);
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

function validateContentQuality(relPath, articleContent) {
  if (!articleContent) {
    errors.push(`${relPath}: brak <article class="article-content">.`);
    return;
  }
  const words = countWords(stripTags(articleContent));
  if (words < 350) warnings.push(`${relPath}: tresc artykulu ma tylko ${words} slow.`);
  const links = countInternalContextLinks(articleContent);
  if (links < 4) errors.push(`${relPath}: za malo linkow kontekstowych w tresci (${links}/4).`);
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
    const blogPosting = findBlogPosting(html);
    const articleContent = extractArticleContent(html);

    runArticleStandardValidator(relPath);
    assertMirror(relPath);
    validateTitleAndDescription(relPath, html);
    validateNoInlineStyles(relPath, html);
    validateDates(relPath, html, blogPosting);
    validateSpeakable(relPath, html, blogPosting);
    validateKeyTakeaways(relPath, html, articleContent);
    validatePdfButton(relPath, html);
    validateContentQuality(relPath, articleContent);
    validatePresenceInListings(relPath, sitemap, llms, porady, categories);
  }

  printAndExit();
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

main();
