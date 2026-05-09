#!/usr/bin/env node
/*
 * Hard-cleanup for files that were previously moved to assets/trash.
 * Default retention is 14 days based on mtime.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const DEFAULT_DAYS = 14;
const TARGET_DIRS = [
  path.join(ROOT, 'assets', 'trash'),
  path.join(ROOT, '_site', 'assets', 'trash'),
];

function parseArgs(argv) {
  const out = { days: DEFAULT_DAYS, dryRun: false, verbose: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--days') {
      const v = Number(argv[i + 1]);
      if (!Number.isFinite(v) || v < 0) throw new Error('--days musi byc liczba >= 0');
      out.days = v;
      i += 1;
    }
  }
  return out;
}

function walk(dir, acc) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function removeEmptyDirsBottomUp(rootDir) {
  if (!fs.existsSync(rootDir)) return 0;
  let removed = 0;

  function recurse(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) recurse(path.join(dir, entry.name));
    }

    if (dir === rootDir) return;
    const after = fs.readdirSync(dir);
    if (after.length === 0) {
      fs.rmdirSync(dir);
      removed += 1;
    }
  }

  recurse(rootDir);
  return removed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();
  const thresholdMs = args.days * 24 * 60 * 60 * 1000;

  let scanned = 0;
  let eligible = 0;
  let removed = 0;
  let bytes = 0;

  for (const dir of TARGET_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = [];
    walk(dir, files);
    scanned += files.length;

    for (const file of files) {
      if (!isInside(dir, file)) continue;

      const stat = fs.statSync(file);
      const age = now - stat.mtimeMs;
      if (age < thresholdMs) continue;

      eligible += 1;
      bytes += stat.size;

      if (!args.dryRun) {
        fs.unlinkSync(file);
        removed += 1;
      }

      if (args.verbose) {
        const rel = path.relative(ROOT, file);
        console.log(`${args.dryRun ? '[DRY]' : '[DEL]'} ${rel}`);
      }
    }

    if (!args.dryRun) removeEmptyDirsBottomUp(dir);
  }

  const mb = (bytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[ASSETS-TRASH-RETENTION] mode=${args.dryRun ? 'dry-run' : 'apply'} days=${args.days} scanned=${scanned} eligible=${eligible} removed=${removed} freedMB=${mb}`
  );
}

try {
  main();
} catch (err) {
  console.error('[ASSETS-TRASH-RETENTION] ERROR:', err.message || err);
  process.exit(1);
}
