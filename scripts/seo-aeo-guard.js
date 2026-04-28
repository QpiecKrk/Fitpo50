#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ISO_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const errors = [];
const warnings = [];

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html')
    .filter((f) => /<article\s+class="article-content"/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
    .sort();
}

function extractMetaName(html, name) {
  const rx = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i');
  return (html.match(rx)?.[1] || '').trim();
}

function extractMetaProperty(html, name) {
  const rx = new RegExp(`<meta\\s+property="${name}"\\s+content="([^"]*)"`, 'i');
  return (html.match(rx)?.[1] || '').trim();
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const rx = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(rx)) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch (_err) {
      // skip invalid JSON-LD here; other validator covers parser errors
    }
  }
  return blocks;
}

function flatten(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (node['@graph'] && Array.isArray(node['@graph'])) return node['@graph'].flatMap(flatten);
  return [node];
}

function firstType(objects, name) {
  return objects.find((obj) => {
    const t = obj && obj['@type'];
    return t === name || (Array.isArray(t) && t.includes(name));
  });
}

function hasSelectorInHtml(html, selector) {
  const s = String(selector || '').trim();
  if (!s) return false;
  const token = s.split(/\s+/)[0].trim();
  if (token.startsWith('.')) {
    return new RegExp(`class="[^"]*\\b${token.slice(1)}\\b`).test(html);
  }
  if (token.startsWith('#')) {
    return new RegExp(`id="${token.slice(1)}"`).test(html);
  }
  return false;
}

function validateFile(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const desc = extractMetaName(html, 'description');
  if (!title) errors.push(`${file}: brak <title>.`);
  if (title.length > 65) errors.push(`${file}: <title> ma ${title.length} znakow (limit 65).`);
  if (!desc) errors.push(`${file}: brak meta description.`);
  if (desc.length > 160) errors.push(`${file}: meta description ma ${desc.length} znakow (limit 160).`);

  const pub = extractMetaProperty(html, 'article:published_time');
  const mod = extractMetaProperty(html, 'article:modified_time');
  if (!pub || !ISO_RX.test(pub)) errors.push(`${file}: article:published_time nie jest pelnym ISO 8601.`);
  if (!mod || !ISO_RX.test(mod)) errors.push(`${file}: article:modified_time nie jest pelnym ISO 8601.`);

  const parsed = parseJsonLdBlocks(html).flatMap(flatten);
  const blog = firstType(parsed, 'BlogPosting');
  if (!blog) {
    errors.push(`${file}: brak BlogPosting schema.`);
    return;
  }

  const dp = String(blog.datePublished || '').trim();
  const dm = String(blog.dateModified || '').trim();
  if (!dp || !ISO_RX.test(dp)) errors.push(`${file}: BlogPosting.datePublished nie jest pelnym ISO 8601.`);
  if (!dm || !ISO_RX.test(dm)) errors.push(`${file}: BlogPosting.dateModified nie jest pelnym ISO 8601.`);

  const speakable = blog.speakable;
  if (!speakable || typeof speakable !== 'object') {
    errors.push(`${file}: brak BlogPosting.speakable.`);
  } else {
    const selectors = Array.isArray(speakable.cssSelector) ? speakable.cssSelector : [speakable.cssSelector].filter(Boolean);
    if (!selectors.length) {
      errors.push(`${file}: speakable.cssSelector jest puste.`);
    } else {
      for (const sel of selectors) {
        if (!hasSelectorInHtml(html, sel)) {
          errors.push(`${file}: speakable selector nie istnieje w HTML (${sel}).`);
        }
      }
    }
  }

  const faqVisible = (html.match(/<[^>]+class="[^"]*\bfaq-item\b[^"]*"/gi) || []).length;
  const faqSchema = firstType(parsed, 'FAQPage');
  if (faqVisible > 0 && !faqSchema) {
    errors.push(`${file}: widoczne FAQ (${faqVisible}) ale brak FAQPage schema.`);
  }
  if (faqVisible > 0 && faqSchema && (!Array.isArray(faqSchema.mainEntity) || faqSchema.mainEntity.length === 0)) {
    errors.push(`${file}: FAQPage.mainEntity jest puste.`);
  }
  if (faqVisible === 0 && faqSchema) {
    warnings.push(`${file}: ma FAQPage schema, ale brak widocznej sekcji FAQ.`);
  }
}

function main() {
  const files = listArticleFiles();
  for (const file of files) validateFile(file);

  if (warnings.length) {
    console.log('\n[WARN] seo-aeo-guard');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL] seo-aeo-guard');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }
  console.log(`[PASS] seo-aeo-guard OK (pliki: ${files.length}).`);
}

main();
