#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.cwd();
const TMP_PREFIXES = ['fitpo50-import-', 'fitpo50-export-check-', 'fitpo50-export-check', 'fitpo50_pdf_'];
const REPO_TMP_SUFFIXES = ['.tmp', '.temp', '.bak', '.swp', '~'];

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

function removePath(absPath, dryRun) {
  if (!fs.existsSync(absPath)) return false;
  if (dryRun) return true;
  fs.rmSync(absPath, { recursive: true, force: true });
  return true;
}

function cleanupSystemTmp(dryRun) {
  const tmpRoot = os.tmpdir();
  if (!fs.existsSync(tmpRoot)) return [];
  const removed = [];
  const entries = fs.readdirSync(tmpRoot, { withFileTypes: true });
  for (const entry of entries) {
    const name = entry.name;
    if (!TMP_PREFIXES.some((p) => name.startsWith(p))) continue;
    const abs = path.join(tmpRoot, name);
    if (removePath(abs, dryRun)) removed.push(abs);
  }
  return removed;
}

function cleanupRepoTmpFiles(dryRun) {
  const scanDirs = [
    ROOT,
    path.join(ROOT, 'data', 'import'),
    path.join(ROOT, 'assets'),
    path.join(ROOT, '_site', 'assets'),
  ].filter((dir, idx, arr) => arr.indexOf(dir) === idx && fs.existsSync(dir));

  const removed = [];
  for (const dir of scanDirs) {
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const abs = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.git' || entry.name === 'node_modules') continue;
          stack.push(abs);
          continue;
        }
        if (!entry.isFile()) continue;
        const rel = abs.replace(`${ROOT}${path.sep}`, '');
        if (rel.startsWith('scripts/archive/')) continue;
        const lower = entry.name.toLowerCase();
        if (!REPO_TMP_SUFFIXES.some((sfx) => lower.endsWith(sfx))) continue;
        if (removePath(abs, dryRun)) removed.push(abs);
      }
    }
  }
  return removed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const removedSystem = cleanupSystemTmp(args.dryRun);
  const removedRepo = cleanupRepoTmpFiles(args.dryRun);
  const total = removedSystem.length + removedRepo.length;

  console.log(`[TMP-CLEANUP] mode=${args.dryRun ? 'dry-run' : 'apply'} system_tmp=${removedSystem.length} repo_tmp=${removedRepo.length} total=${total}`);
  if (total && args.dryRun) {
    [...removedSystem, ...removedRepo].slice(0, 30).forEach((p) => console.log(`- ${p}`));
  }
}

main();
