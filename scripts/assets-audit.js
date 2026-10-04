#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { assertPathInside, assertProjectRoot } = require('./lib/destructive-path-guard');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SITE_DIR = path.join(ROOT, '_site');
const IMAGE_EXTS = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico']);
const DEFAULT_EXCLUDE_PREFIXES = ['assets/trash/', 'assets/pdf/', 'assets/news/', 'assets/data/'];
const IGNORE_DIRS = new Set(['.git', 'node_modules', '_site', 'assets/trash']);
const TEXT_FILE_EXTS = new Set(['.html', '.css', '.js', '.json']);

function parseArgs(argv) {
  const out = {
    apply: false,
    verbose: false,
    report: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--apply') out.apply = true;
    else if (token === '--verbose') out.verbose = true;
    else if (token === '--report') {
      out.report = String(argv[i + 1] || '').trim();
      if (!out.report) throw new Error('Brak wartości --report.');
      i += 1;
    } else throw new Error(`Nieznany argument: ${token || '(pusty)'}`);
  }
  return out;
}

function normalizeSlashes(p) {
  return String(p || '').replace(/\\/g, '/');
}

function relativeFromRoot(absPath) {
  return normalizeSlashes(path.relative(ROOT, absPath));
}

function walk(dir, shouldIncludeFile, out = []) {
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = relativeFromRoot(abs);
      if (entry.isSymbolicLink()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        throw new Error(`Symlink blokuje audyt assetów: ${abs}`);
      }
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        if (rel.startsWith('assets/trash/')) continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (shouldIncludeFile(abs, rel)) out.push(abs);
    }
  }
  return out;
}

function isAssetImage(absPath, relPath) {
  const rel = normalizeSlashes(relPath || relativeFromRoot(absPath));
  if (!rel.startsWith('assets/')) return false;
  if (DEFAULT_EXCLUDE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return false;
  return IMAGE_EXTS.has(path.extname(rel).toLowerCase());
}

function isTextSource(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  return TEXT_FILE_EXTS.has(ext);
}

function normalizeAssetRef(rawValue, fileRel) {
  let v = String(rawValue || '').trim();
  if (!v) return '';
  v = v.replace(/^['"`]|['"`]$/g, '').trim();
  if (!v) return '';
  v = v.replace(/\\\//g, '/').split('#')[0].split('?')[0].trim();
  if (!v) return '';

  const fitpoMatch = v.match(/^https?:\/\/(?:www\.)?fitpo50\.pl\/(.+)$/i);
  if (fitpoMatch) v = fitpoMatch[1];

  if (v.startsWith('/')) v = v.replace(/^\/+/, '');
  if (v.startsWith('_site/assets/')) v = v.replace(/^_site\//, '');

  if (v.startsWith('./') || v.startsWith('../')) {
    const resolved = normalizeSlashes(path.normalize(path.join(path.dirname(fileRel), v)));
    if (resolved.startsWith('assets/')) return resolved;
  }

  if (v.startsWith('assets/')) return v;
  return '';
}

function collectRefsFromText(text, fileRel, sink) {
  const add = (candidate) => {
    const normalized = normalizeAssetRef(candidate, fileRel);
    if (!normalized) return;
    if (!IMAGE_EXTS.has(path.extname(normalized).toLowerCase())) return;
    sink.add(normalized);
  };

  const attrRx = /\b(?:src|href|poster|data-src|data-image)\s*=\s*["']([^"']+)["']/gi;
  for (const m of text.matchAll(attrRx)) add(m[1]);

  const srcsetRx = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  for (const m of text.matchAll(srcsetRx)) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    for (const part of raw.split(',')) {
      const one = part.trim().split(/\s+/)[0];
      if (one) add(one);
    }
  }

  const cssUrlRx = /url\(([^)]+)\)/gi;
  for (const m of text.matchAll(cssUrlRx)) add(m[1]);

  const quotedAssetRx = /["'`](?:https?:\/\/(?:www\.)?fitpo50\.pl\/)?(?:\.\/|\/)?assets\/[^"'`?#\s]+\.(?:avif|webp|jpg|jpeg|png|gif|svg|ico)["'`]/gi;
  for (const m of text.matchAll(quotedAssetRx)) add(String(m[0] || '').slice(1, -1));
}

function collectRefsFromNewsJson(text, sink) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  for (const item of items) {
    const base = String(item && item.image_base ? item.image_base : '').trim();
    if (!base) continue;
    sink.add(`assets/news/${base}.avif`);
    sink.add(`assets/news/${base}.webp`);
    sink.add(`assets/news/${base}.jpg`);
  }
}

function ensureDir(absDir) {
  fs.mkdirSync(absDir, { recursive: true });
}

function moveToTrash(relAssetPath) {
  const srcAbs = assertPathInside(ASSETS_DIR, path.join(ROOT, relAssetPath), { mustExist: true, type: 'file' });
  const trashRel = path.join('assets', 'trash', relAssetPath.replace(/^assets\//, ''));
  const trashRoot = path.join(ROOT, 'assets', 'trash');
  ensureDir(trashRoot);
  const trashAbs = assertPathInside(trashRoot, path.join(ROOT, trashRel));
  if (fs.existsSync(trashAbs)) throw new Error(`Cel w assets/trash już istnieje: ${trashAbs}`);

  const siteSrcRel = path.join('_site', relAssetPath);
  const siteSrcAbs = path.join(ROOT, siteSrcRel);
  let safeSiteSource = '';
  let siteTrashAbs = '';
  if (fs.existsSync(siteSrcAbs)) {
    const siteAssetsRoot = path.join(ROOT, '_site', 'assets');
    safeSiteSource = assertPathInside(siteAssetsRoot, siteSrcAbs, { mustExist: true, type: 'file' });
    const siteTrashRel = path.join('_site', 'assets', 'trash', relAssetPath.replace(/^assets\//, ''));
    const siteTrashRoot = path.join(ROOT, '_site', 'assets', 'trash');
    ensureDir(siteTrashRoot);
    siteTrashAbs = assertPathInside(siteTrashRoot, path.join(ROOT, siteTrashRel));
    if (fs.existsSync(siteTrashAbs)) throw new Error(`Cel w _site/assets/trash już istnieje: ${siteTrashAbs}`);
  }

  ensureDir(path.dirname(trashAbs));
  if (siteTrashAbs) ensureDir(path.dirname(siteTrashAbs));
  fs.renameSync(srcAbs, trashAbs);
  if (safeSiteSource) {
    fs.renameSync(safeSiteSource, siteTrashAbs);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertProjectRoot(ROOT);
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('[FAIL] Brak katalogu assets/.');
    process.exit(1);
  }

  const assetFiles = walk(ASSETS_DIR, (abs, rel) => isAssetImage(abs, rel))
    .map((abs) => relativeFromRoot(abs))
    .sort();
  const referenced = new Set();

  const textFiles = walk(ROOT, (abs) => isTextSource(abs))
    .map((abs) => relativeFromRoot(abs))
    .filter((rel) => !rel.startsWith('assets/'))
    .sort();

  for (const rel of textFiles) {
    const abs = path.join(ROOT, rel);
    const text = fs.readFileSync(abs, 'utf8');
    collectRefsFromText(text, rel, referenced);
    if (rel === 'data/news-live.json') collectRefsFromNewsJson(text, referenced);
  }

  const unused = assetFiles.filter((rel) => !referenced.has(rel));
  const usedCount = assetFiles.length - unused.length;

  const summary = {
    scanned_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    totals: {
      assets_images_scanned: assetFiles.length,
      references_detected: referenced.size,
      used_assets: usedCount,
      unused_assets: unused.length,
    },
    unused_assets: unused,
  };

  console.log(`[ASSETS-AUDIT] scanned=${assetFiles.length} used=${usedCount} unused=${unused.length}`);
  if (unused.length) {
    console.log('[ASSETS-AUDIT] Przykładowe nieużywane pliki:');
    unused.slice(0, 20).forEach((rel) => console.log(`- ${rel}`));
    if (unused.length > 20) console.log(`... +${unused.length - 20} kolejnych`);
  }

  if (args.report) {
    const reportsRoot = path.join(ROOT, 'data', 'reports');
    const reportAbs = assertPathInside(reportsRoot, path.resolve(ROOT, args.report));
    ensureDir(path.dirname(reportAbs));
    fs.writeFileSync(reportAbs, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(`[ASSETS-AUDIT] report: ${relativeFromRoot(reportAbs)}`);
  }

  if (!args.apply) {
    console.log('[ASSETS-AUDIT] dry-run complete. Użyj --apply, aby przenieść do assets/trash/.');
    return;
  }

  let moved = 0;
  for (const rel of unused) {
    try {
      moveToTrash(rel);
      moved += 1;
      if (args.verbose) console.log(`[MOVE] ${rel} -> assets/trash/`);
    } catch (err) {
      console.error(`[WARN] Nie udało się przenieść ${rel}: ${err.message || err}`);
    }
  }
  console.log(`[ASSETS-AUDIT] moved=${moved}/${unused.length} to assets/trash/`);

  // prune empty directories in assets (except protected)
  const protectedDirs = new Set(['assets', 'assets/news', 'assets/pdf', 'assets/data', 'assets/trash']);
  function pruneEmpty(dirAbs) {
    assertPathInside(ASSETS_DIR, dirAbs, { allowEqual: true, mustExist: true, type: 'directory' });
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error(`Symlink blokuje usuwanie pustych katalogów: ${path.join(dirAbs, entry.name)}`);
      if (!entry.isDirectory()) continue;
      pruneEmpty(path.join(dirAbs, entry.name));
    }
    const rel = relativeFromRoot(dirAbs);
    if (protectedDirs.has(rel)) return;
    const left = fs.readdirSync(dirAbs);
    if (!left.length) fs.rmdirSync(dirAbs);
  }
  pruneEmpty(ASSETS_DIR);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[ASSETS-AUDIT][FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { parseArgs };
