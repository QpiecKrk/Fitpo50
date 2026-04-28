#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TITLE_MAX = 65;
const DESC_MAX = 160;

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html')
    .filter((f) => {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      return /<article\s+class="article-content"/i.test(raw);
    })
    .sort();
}

function truncateAtWordBoundary(text, maxChars) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= maxChars) return value;
  const probe = value.slice(0, maxChars + 1);
  const cut = probe.lastIndexOf(' ');
  if (cut >= Math.floor(maxChars * 0.6)) return probe.slice(0, cut).trim();
  return value.slice(0, maxChars).trim();
}

function buildSpeakableSelectors(html) {
  const selectors = ['.article-header__title', '.article-content p'];
  if (/class="[^"]*\bkey-takeaways\b[^"]*"/i.test(html)) {
    selectors.push('.key-takeaways h2', '.key-takeaways li');
  }
  return selectors;
}

function parseJsonLdBlocks(html) {
  const rx = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let match;
  while ((match = rx.exec(html))) {
    const full = match[0];
    const jsonText = String(match[1] || '').trim();
    try {
      blocks.push({ full, parsed: JSON.parse(jsonText) });
    } catch (_err) {
      // ignore invalid JSON-LD blocks
    }
  }
  return blocks;
}

function patchBlogPostingSpeakable(html) {
  const blocks = parseJsonLdBlocks(html);
  if (!blocks.length) return html;
  const selectors = buildSpeakableSelectors(html);

  for (const block of blocks) {
    const nodes = Array.isArray(block.parsed) ? block.parsed : [block.parsed];
    let touched = false;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isBlogPosting = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
      if (!isBlogPosting) continue;
      node.speakable = {
        '@type': 'SpeakableSpecification',
        cssSelector: selectors,
      };
      touched = true;
    }
    if (!touched) continue;
    const next = `<script type="application/ld+json">\n${JSON.stringify(block.parsed, null, 2)}\n</script>`;
    return html.replace(block.full, next);
  }

  return html;
}

function patchTitleAndDescription(html) {
  let out = html;

  const titleRx = /<title>([\s\S]*?)<\/title>/i;
  const titleM = out.match(titleRx);
  if (titleM) {
    const current = String(titleM[1] || '').trim();
    const next = truncateAtWordBoundary(current, TITLE_MAX);
    if (next && next !== current) {
      out = out.replace(titleRx, `<title>${next}</title>`);
    }
  }

  const descRx = /<meta\s+name="description"\s+content="([^"]*)"\s*>/i;
  const descM = out.match(descRx);
  if (descM) {
    const current = String(descM[1] || '').replace(/\s+/g, ' ').trim();
    const next = truncateAtWordBoundary(current, DESC_MAX);
    if (next !== current) {
      out = out.replace(descRx, `<meta name="description" content="${next}">`);
    }
  }

  return out;
}

function writeMirrorIfExists(file, content) {
  const mirror = path.join(ROOT, '_site', file);
  if (!fs.existsSync(path.join(ROOT, '_site'))) return;
  fs.writeFileSync(mirror, content, 'utf8');
}

function main() {
  const files = listArticleFiles();
  let updated = 0;
  for (const file of files) {
    const abs = path.join(ROOT, file);
    const original = fs.readFileSync(abs, 'utf8');
    let next = patchTitleAndDescription(original);
    next = patchBlogPostingSpeakable(next);
    if (next !== original) {
      fs.writeFileSync(abs, next, 'utf8');
      writeMirrorIfExists(file, next);
      updated += 1;
    }
  }
  console.log(`[OK] repair-seo-aeo: updated ${updated} article files.`);
}

main();
