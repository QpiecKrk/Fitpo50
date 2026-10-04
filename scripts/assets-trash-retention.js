#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assertPathInside, assertProjectRoot } = require('./lib/destructive-path-guard');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DAYS = 14;
const MIN_APPLY_DAYS = 14;

function parseArgs(argv) {
  const out = { days: DEFAULT_DAYS, apply: false, verbose: false };
  let mode = '';
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (token === '--apply' || token === '--dry-run') {
      if (mode && mode !== token) throw new Error('Nie można łączyć --apply i --dry-run.');
      mode = token;
      out.apply = token === '--apply';
    } else if (token === '--verbose') {
      out.verbose = true;
    } else if (token === '--days') {
      const value = String(argv[index + 1] || '');
      const days = Number(value);
      if (!value || !Number.isFinite(days) || days < 0) throw new Error(`Nieprawidłowe --days: ${value || '(brak)'}`);
      out.days = days;
      index += 1;
    } else {
      throw new Error(`Nieznany argument: ${token || '(pusty)'}`);
    }
  }
  if (out.apply && out.days < MIN_APPLY_DAYS) throw new Error(`Tryb apply wymaga retencji minimum ${MIN_APPLY_DAYS} dni.`);
  return out;
}

function walk(rootDirectory, accumulator) {
  const entries = fs.readdirSync(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(rootDirectory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink w assets/trash blokuje cleanup: ${absolute}`);
    if (entry.isDirectory()) walk(absolute, accumulator);
    else if (entry.isFile()) accumulator.push(absolute);
  }
}

function removeEmptyDirectories(rootDirectory) {
  let removed = 0;
  function recurse(directory) {
    assertPathInside(rootDirectory, directory, { allowEqual: true, mustExist: true, type: 'directory' });
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink w assets/trash blokuje cleanup: ${absolute}`);
      if (entry.isDirectory()) recurse(absolute);
    }
    if (directory !== rootDirectory && fs.readdirSync(directory).length === 0) {
      fs.rmdirSync(directory);
      removed += 1;
    }
  }
  recurse(rootDirectory);
  return removed;
}

function executeRetention(options = {}) {
  const root = assertProjectRoot(options.root || ROOT);
  const args = options.args || { days: DEFAULT_DAYS, apply: false, verbose: false };
  if (args.apply && args.days < MIN_APPLY_DAYS) throw new Error(`Tryb apply wymaga retencji minimum ${MIN_APPLY_DAYS} dni.`);
  const nowMs = Number(options.nowMs === undefined ? Date.now() : options.nowMs);
  const thresholdMs = args.days * 86400000;
  const targetDirectories = options.targetDirectories || [path.join(root, 'assets', 'trash'), path.join(root, '_site', 'assets', 'trash')];
  const candidates = [];
  let scanned = 0;
  let bytes = 0;
  let removedDirectories = 0;

  for (const requestedDirectory of targetDirectories) {
    if (!fs.existsSync(requestedDirectory)) continue;
    const directory = assertPathInside(requestedDirectory, requestedDirectory, { allowEqual: true, mustExist: true, type: 'directory' });
    const files = [];
    walk(directory, files);
    scanned += files.length;
    for (const requestedFile of files) {
      const file = assertPathInside(directory, requestedFile, { mustExist: true, type: 'file' });
      const stat = fs.statSync(file);
      if (nowMs - stat.mtimeMs < thresholdMs) continue;
      candidates.push({ file, directory, size: stat.size, mtimeMs: stat.mtimeMs });
      bytes += stat.size;
    }
  }

  const removed = [];
  if (args.apply) {
    for (const item of candidates) {
      const file = assertPathInside(item.directory, item.file, { mustExist: true, type: 'file' });
      const stat = fs.statSync(file);
      if (nowMs - stat.mtimeMs < thresholdMs) throw new Error(`Plik nie spełnia już retencji: ${file}`);
      fs.unlinkSync(file);
      removed.push(file);
    }
    for (const requestedDirectory of targetDirectories) {
      if (!fs.existsSync(requestedDirectory)) continue;
      const directory = assertPathInside(requestedDirectory, requestedDirectory, { allowEqual: true, mustExist: true, type: 'directory' });
      removedDirectories += removeEmptyDirectories(directory);
    }
  }

  return { apply: Boolean(args.apply), days: args.days, verbose: Boolean(args.verbose), scanned, candidates, removed, removedDirectories, bytes };
}

function printResult(result, root = ROOT) {
  if (!result.apply || result.verbose) {
    for (const item of result.candidates.slice(0, 80)) console.log(`${result.apply ? '[DEL]' : '[DRY]'} ${path.relative(root, item.file)}`);
    if (result.candidates.length > 80) console.log(`... ${result.candidates.length - 80} more`);
  }
  const megabytes = (result.bytes / (1024 * 1024)).toFixed(2);
  console.log(`[ASSETS-TRASH-RETENTION] mode=${result.apply ? 'apply' : 'dry-run'} days=${result.days} scanned=${result.scanned} eligible=${result.candidates.length} removed=${result.removed.length} removedDirs=${result.removedDirectories} freedMB=${megabytes}`);
  if (!result.apply) console.log('[ASSETS-TRASH-RETENTION] bez zmian; użyj --apply po przeglądzie listy.');
}

if (require.main === module) {
  try {
    printResult(executeRetention({ args: parseArgs(process.argv.slice(2)) }));
  } catch (error) {
    console.error(`[ASSETS-TRASH-RETENTION][FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { DEFAULT_DAYS, MIN_APPLY_DAYS, executeRetention, parseArgs };
