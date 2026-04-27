#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const ISO_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const errors = [];
const warnings = [];

function parseArgs(argv) {
  return {
    diff: argv.includes('--diff'),
  };
}

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
}

function normalizeRel(value) {
  return String(value || '').replace(/^\.?\//, '').replace(/^\/+/, '').trim();
}

function diffHtmlFiles() {
  const diff = run('git', ['diff', '--name-only', 'origin/main...HEAD']);
  if (diff.status !== 0) {
    throw new Error(String(diff.stderr || diff.stdout || '').trim() || 'git diff failed');
  }
  return String(diff.stdout || '')
    .split('\n')
    .map((s) => normalizeRel(s))
    .filter((f) => f.endsWith('.html') && !f.startsWith('_site/'));
}

function allHtmlFiles() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
}

function parseJsonLdBlocks(html, file) {
  const blocks = [];
  const rx = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(rx)) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch (err) {
      errors.push(`${file}: nieparsowalny blok JSON-LD (${err.message}).`);
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
  const first = s.split(/\s+/)[0].trim();
  if (first.startsWith('.')) {
    return new RegExp(`class="[^"]*\\b${first.slice(1)}\\b`).test(html);
  }
  if (first.startsWith('#')) {
    return new RegExp(`id="${first.slice(1)}"`).test(html);
  }
  return false;
}

function validateArticleSchemas(file, html) {
  const parsed = parseJsonLdBlocks(html, file).flatMap(flatten);
  if (!parsed.length) {
    errors.push(`${file}: brak JSON-LD.`);
    return;
  }

  const blog = firstType(parsed, 'BlogPosting');
  if (!blog) {
    errors.push(`${file}: brak BlogPosting w JSON-LD.`);
  } else {
    const dp = String(blog.datePublished || '').trim();
    const dm = String(blog.dateModified || '').trim();
    if (!dp || !ISO_RX.test(dp)) errors.push(`${file}: BlogPosting.datePublished nie jest pełnym ISO 8601.`);
    if (!dm || !ISO_RX.test(dm)) errors.push(`${file}: BlogPosting.dateModified nie jest pełnym ISO 8601.`);
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
  }

  const faqItems = (html.match(/<article\s+class="faq-item"/gi) || []).length;
  const faqSchema = firstType(parsed, 'FAQPage');
  if (faqItems > 0 && !faqSchema) {
    errors.push(`${file}: ma sekcję FAQ (${faqItems}) ale brak FAQPage schema.`);
  }
  if (faqSchema && (!Array.isArray(faqSchema.mainEntity) || faqSchema.mainEntity.length < 1)) {
    errors.push(`${file}: FAQPage ma puste mainEntity.`);
  }
  if (faqItems > 0 && faqSchema && Array.isArray(faqSchema.mainEntity) && faqSchema.mainEntity.length < faqItems) {
    warnings.push(`${file}: FAQPage ma mniej pozycji (${faqSchema.mainEntity.length}) niż widoczne FAQ (${faqItems}).`);
  }
}

function verifyMirror(file) {
  const mirror = path.join(ROOT, '_site', file);
  if (!fs.existsSync(mirror)) {
    warnings.push(`${file}: brak mirroru _site/${file}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = args.diff ? diffHtmlFiles() : allHtmlFiles();
  const targets = [];
  for (const file of files) {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    const html = fs.readFileSync(abs, 'utf8');
    if (!/<article\s+class="article-content">/i.test(html)) continue;
    targets.push({ file, html });
  }
  if (!targets.length) {
    console.log('[PASS] schema-validator - brak plików artykułów do sprawdzenia.');
    return;
  }

  for (const { file, html } of targets) {
    validateArticleSchemas(file, html);
    verifyMirror(file);
  }

  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL] schema-validator');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }

  console.log(`[PASS] schema-validator OK (pliki: ${targets.length}).`);
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] schema-validator -> ${err.message || err}`);
  process.exit(1);
}

