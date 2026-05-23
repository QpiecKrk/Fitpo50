#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validateArticleHeadContract } = require('./lib/article-head-contract');

const ROOT = process.cwd();
const TITLE_SUFFIX = ' | FitPo50';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = String(argv[i + 1] || '').trim();
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function boolOpt(value, fallback) {
  if (value === undefined) return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(v)) return true;
  if (['0', 'false', 'no', 'n'].includes(v)) return false;
  return fallback;
}

function normalizeTitleBase(input) {
  return String(input || '').replace(/\s*\|\s*FitPo50\s*$/i, '').trim();
}

function validateInput(titleBase, description) {
  const problems = [];
  const fullTitle = `${titleBase}${TITLE_SUFFIX}`;
  const d = String(description || '').trim();

  if (!titleBase) problems.push('Brak wartości --title.');
  if (!d) problems.push('Brak wartości --description.');
  if (fullTitle.length > 65) {
    problems.push(`<title> przekracza 65 znaków (jest ${fullTitle.length}).`);
  }
  if (d.length < 145 || d.length > 160) {
    problems.push(`Opis SEO poza zakresem 145-160 znaków (jest ${d.length}).`);
  }
  if (!/[.!?]$/.test(d)) {
    problems.push('Opis SEO musi kończyć się ".", "!" lub "?".');
  }
  return problems;
}

function escapeAttr(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function updateLdJsonBlocks(raw, titleBase, description) {
  const blocks = [...raw.matchAll(/<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi)];
  let out = raw;

  for (const match of blocks) {
    const block = String(match[0] || '');
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
      const isBreadcrumb = type === 'BreadcrumbList' || (Array.isArray(type) && type.includes('BreadcrumbList'));

      if (isBlogPosting) {
        if (typeof node.description === 'string') {
          node.description = description;
          touched = true;
        }
        if (typeof node.headline === 'string') {
          node.headline = titleBase;
          touched = true;
        }
        if (typeof node.name === 'string') {
          node.name = titleBase;
          touched = true;
        }
      }

      if (isBreadcrumb && Array.isArray(node.itemListElement)) {
        for (const item of node.itemListElement) {
          if (!item || typeof item !== 'object') continue;
          if (Number(item.position) === 3 && typeof item.name === 'string') {
            item.name = titleBase;
            touched = true;
          }
        }
      }
    }

    if (touched) {
      const nextInner = JSON.stringify(Array.isArray(parsed) ? nodes : nodes[0], null, 2);
      const nextBlock = `<script type="application/ld+json">\n${nextInner}\n<\/script>`;
      out = out.replace(block, nextBlock);
    }
  }

  return out;
}

function replaceOrFail(raw, regex, replacement, missingMsg) {
  if (!regex.test(raw)) {
    throw new Error(missingMsg);
  }
  return raw.replace(regex, replacement);
}

function updateFile(filePath, titleBase, description) {
  const titleFull = `${titleBase}${TITLE_SUFFIX}`;
  const safeTitle = escapeAttr(titleBase);
  const safeDescription = escapeAttr(description);
  const safeTitleFull = escapeAttr(titleFull);

  const original = fs.readFileSync(filePath, 'utf8');
  let out = original;

  out = replaceOrFail(
    out,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${safeTitleFull}</title>`,
    `Brak <title> w ${path.basename(filePath)}.`,
  );
  out = replaceOrFail(
    out,
    /(<meta\s+name="description"\s+content=")([^"]*)("\s*>)/i,
    `$1${safeDescription}$3`,
    `Brak meta description w ${path.basename(filePath)}.`,
  );
  out = replaceOrFail(
    out,
    /(<meta\s+property="og:title"\s+content=")([^"]*)("\s*>)/i,
    `$1${safeTitle}$3`,
    `Brak og:title w ${path.basename(filePath)}.`,
  );
  out = replaceOrFail(
    out,
    /(<meta\s+property="og:description"\s+content=")([^"]*)("\s*>)/i,
    `$1${safeDescription}$3`,
    `Brak og:description w ${path.basename(filePath)}.`,
  );
  out = replaceOrFail(
    out,
    /(<meta\s+name="twitter:title"\s+content=")([^"]*)("\s*>)/i,
    `$1${safeTitle}$3`,
    `Brak twitter:title w ${path.basename(filePath)}.`,
  );
  out = replaceOrFail(
    out,
    /(<meta\s+name="twitter:description"\s+content=")([^"]*)("\s*>)/i,
    `$1${safeDescription}$3`,
    `Brak twitter:description w ${path.basename(filePath)}.`,
  );

  out = updateLdJsonBlocks(out, titleBase, description);

  const contract = validateArticleHeadContract(out);
  if (contract.errors.length) {
    throw new Error(`${path.basename(filePath)}: ${contract.errors.join(' | ')}`);
  }

  if (out !== original) {
    fs.writeFileSync(filePath, out, 'utf8');
    return true;
  }
  return false;
}

function resolveTargets(args) {
  const syncSite = boolOpt(args['sync-site'], true);
  const targets = [];

  if (args.slug) {
    const slug = String(args.slug || '').trim();
    targets.push(path.join(ROOT, `${slug}.html`));
    if (syncSite) targets.push(path.join(ROOT, '_site', `${slug}.html`));
    return targets.filter((p) => fs.existsSync(p));
  }

  if (args.file) {
    const base = path.resolve(ROOT, String(args.file || '').trim());
    if (!fs.existsSync(base)) return [];
    targets.push(base);
    if (syncSite && !base.includes(`${path.sep}_site${path.sep}`) && base.endsWith('.html')) {
      const rel = path.relative(ROOT, base);
      const mirror = path.join(ROOT, '_site', rel);
      if (fs.existsSync(mirror)) targets.push(mirror);
    }
    return targets;
  }

  return [];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const titleBase = normalizeTitleBase(args.title);
  const description = String(args.description || '').trim();
  const issues = validateInput(titleBase, description);
  if (issues.length) {
    console.error('Błąd danych wejściowych:');
    for (const item of issues) console.error(`- ${item}`);
    process.exit(1);
  }

  const targets = resolveTargets(args);
  if (!targets.length) {
    console.error('Usage: node scripts/article-meta-set.js --slug <slug> --title "..." --description "..." [--sync-site true|false]');
    console.error('   or: node scripts/article-meta-set.js --file <path.html> --title "..." --description "..." [--sync-site true|false]');
    console.error('Nie znaleziono docelowych plików do aktualizacji.');
    process.exit(1);
  }

  let changed = 0;
  for (const filePath of targets) {
    const wasChanged = updateFile(filePath, titleBase, description);
    if (wasChanged) changed += 1;
    console.log(`[META-SET] ${path.relative(ROOT, filePath)}: ${wasChanged ? 'updated' : 'already-synced'}`);
  }

  console.log(`[META-SET] done, changed=${changed}`);
}

main();
