#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file') out.file = String(argv[i + 1] || '').trim();
    if (argv[i] === '--slug') out.slug = String(argv[i + 1] || '').trim();
  }
  return out;
}

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function updateOne(filePath) {
  if (!fs.existsSync(filePath)) return { filePath, changed: false, reason: 'missing' };
  let raw = fs.readFileSync(filePath, 'utf8');
  const metaMatch = raw.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const metaDescription = metaMatch ? String(metaMatch[1] || '').trim() : '';
  if (!metaDescription) return { filePath, changed: false, reason: 'meta-description-missing' };

  const safe = escapeAttr(metaDescription);
  const escapedJson = JSON.stringify(metaDescription).slice(1, -1);
  let out = raw;
  out = out.replace(/(<meta\s+property="og:description"\s+content=")([^"]*)("\s*>)/i, `$1${safe}$3`);
  out = out.replace(/(<meta\s+name="twitter:description"\s+content=")([^"]*)("\s*>)/i, `$1${safe}$3`);

  const scripts = [...out.matchAll(/<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi)];
  for (const m of scripts) {
    const block = String(m[0] || '');
    const inner = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    let parsed;
    try {
      parsed = JSON.parse(inner);
    } catch (_err) {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    let touched = false;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isBlogPosting = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
      if (!isBlogPosting) continue;
      node.description = metaDescription;
      touched = true;
    }
    if (touched) {
      const json = JSON.stringify(Array.isArray(parsed) ? nodes : nodes[0], null, 2);
      const replaced = `<script type="application/ld+json">\n${json}\n<\/script>`;
      out = out.replace(block, replaced);
    }
  }

  if (out !== raw) {
    fs.writeFileSync(filePath, out, 'utf8');
    return { filePath, changed: true, reason: 'synced' };
  }
  return { filePath, changed: false, reason: 'already-synced' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = [];
  if (args.file) files.push(path.resolve(process.cwd(), args.file));
  if (args.slug) {
    files.push(path.resolve(process.cwd(), `${args.slug}.html`));
    files.push(path.resolve(process.cwd(), '_site', `${args.slug}.html`));
  }
  if (!files.length) {
    console.error('Usage: node scripts/sync-article-head-descriptions.js --slug <slug> OR --file <path.html>');
    process.exit(1);
  }

  let changed = 0;
  for (const file of files) {
    const res = updateOne(file);
    if (res.reason === 'missing') continue;
    if (res.changed) changed += 1;
    console.log(`[SYNC-HEAD] ${path.relative(process.cwd(), file)}: ${res.reason}`);
  }
  console.log(`[SYNC-HEAD] done, changed=${changed}`);
}

main();
