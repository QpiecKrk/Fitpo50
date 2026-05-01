#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_EXTS = ['avif', 'webp', 'jpg'];

function abs(rel) {
  return path.join(ROOT, rel);
}

function ensureDir(relDir) {
  fs.mkdirSync(abs(relDir), { recursive: true });
}

function copyIfDifferent(srcRel, dstRel) {
  const src = abs(srcRel);
  const dst = abs(dstRel);
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dstRel));
  if (fs.existsSync(dst)) {
    const srcBuf = fs.readFileSync(src);
    const dstBuf = fs.readFileSync(dst);
    if (Buffer.compare(srcBuf, dstBuf) === 0) return false;
  }
  fs.copyFileSync(src, dst);
  return true;
}

function isDifferent(srcRel, dstRel) {
  const src = abs(srcRel);
  const dst = abs(dstRel);
  if (!fs.existsSync(src) || !fs.existsSync(dst)) return true;
  const srcBuf = fs.readFileSync(src);
  const dstBuf = fs.readFileSync(dst);
  return Buffer.compare(srcBuf, dstBuf) !== 0;
}

function syncNewsDataMirror(checkOnly) {
  const pairs = [
    ['data/news-live.json', '_site/data/news-live.json'],
    ['assets/data/news-fallback.json', '_site/assets/data/news-fallback.json'],
  ];
  let changed = 0;
  for (const [src, dst] of pairs) {
    if (checkOnly) {
      if (isDifferent(src, dst)) changed += 1;
    } else if (copyIfDifferent(src, dst)) {
      changed += 1;
    }
  }
  return changed;
}

function syncNewsThumbnailsMirror(checkOnly) {
  const livePath = abs('data/news-live.json');
  if (!fs.existsSync(livePath)) return 0;

  let changed = 0;
  const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
  const items = Array.isArray(live.items) ? live.items : [];
  const published = items.filter((it) => it && it.status === 'published');

  for (const item of published) {
    const imageBase = String(item.image_base || '').trim();
    if (!imageBase) continue;
    for (const ext of NEWS_EXTS) {
      const src = `assets/news/${imageBase}.${ext}`;
      const dst = `_site/assets/news/${imageBase}.${ext}`;
      if (checkOnly) {
        if (isDifferent(src, dst)) changed += 1;
      } else if (copyIfDifferent(src, dst)) {
        changed += 1;
      }
    }
  }
  return changed;
}

function syncPdfMirror(slugs, checkOnly) {
  const pdfDir = abs('assets/pdf');
  if (!fs.existsSync(pdfDir)) return 0;
  ensureDir('_site/assets/pdf');

  let changed = 0;
  const allow = new Set((slugs || []).map((s) => String(s || '').trim()).filter(Boolean));
  const files = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
  for (const file of files) {
    const slug = file.replace(/\.pdf$/i, '');
    if (allow.size && !allow.has(slug)) continue;
    const src = `assets/pdf/${file}`;
    const dst = `_site/assets/pdf/${file}`;
    if (checkOnly) {
      if (isDifferent(src, dst)) changed += 1;
    } else if (copyIfDifferent(src, dst)) {
      changed += 1;
    }
  }
  return changed;
}

function parseSlugs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--slug') continue;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out.push(next);
      i += 1;
    }
  }
  return out;
}

function parseCheckOnly(argv) {
  return argv.includes('--check');
}

function main() {
  const argv = process.argv.slice(2);
  const slugs = parseSlugs(argv);
  const checkOnly = parseCheckOnly(argv);
  let changed = 0;
  changed += syncNewsDataMirror(checkOnly);
  changed += syncNewsThumbnailsMirror(checkOnly);
  changed += syncPdfMirror(slugs, checkOnly);

  if (checkOnly) {
    if (changed > 0) {
      console.error(`[FAIL] sync-site-assets-mirror: niespojnosci=${changed}. Uruchom: npm run assets:mirror:sync`);
      process.exit(1);
    }
    console.log('[PASS] sync-site-assets-mirror: mirrors consistent');
    return;
  }

  console.log(`[PASS] sync-site-assets-mirror: updated files=${changed}`);
}

main();
