#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectTempWorkspace } = require('./lib/temp-workspace');

const ROOT = process.cwd();
const DEFAULT_MIN_AGE_HOURS = 12;
const TMP_PREFIXES = [
  'fitpo50-import-',
  'fitpo50-preview-',
  'fitpo50-export-check-',
  'fitpo50-prepush-export-',
  'fitpo50-json-workbench-',
  'fitpo50-contract-',
  'fitpo50_pdf_',
  'gsc-auto-',
];
const REPO_TMP_SUFFIXES = ['.tmp', '.temp', '.bak', '.swp', '~'];

function parseArgs(argv) {
  const out = {
    apply: false,
    minAgeHours: DEFAULT_MIN_AGE_HOURS,
    tempRoot: os.tmpdir(),
    projectRoot: ROOT,
    systemOnly: false,
    repoOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    const value = String(argv[index + 1] || '');
    if (token === '--apply') out.apply = true;
    else if (token === '--dry-run') out.apply = false;
    else if (token === '--min-age-hours' && value) {
      const hours = Number(value);
      if (!Number.isFinite(hours) || hours < 0) throw new Error(`Nieprawidłowe --min-age-hours: ${value}`);
      out.minAgeHours = hours;
      index += 1;
    }
    else if (token === '--temp-root' && value) { out.tempRoot = path.resolve(value); index += 1; }
    else if (token === '--project-root' && value) { out.projectRoot = path.resolve(value); index += 1; }
    else if (token === '--system-only') out.systemOnly = true;
    else if (token === '--repo-only') out.repoOnly = true;
  }
  if (out.systemOnly && out.repoOnly) throw new Error('Nie można łączyć --system-only i --repo-only.');
  return out;
}

function hasManagedPrefix(name) {
  return TMP_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function scanSystemTmp(options = {}) {
  const tempRoot = path.resolve(options.tempRoot || os.tmpdir());
  const projectRoot = path.resolve(options.projectRoot || ROOT);
  const minAgeMs = Number(options.minAgeMs || 0);
  const nowMs = options.nowMs === undefined ? Date.now() : Number(options.nowMs);
  if (!fs.existsSync(tempRoot)) return [];
  return fs.readdirSync(tempRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && hasManagedPrefix(entry.name))
    .map((entry) => inspectTempWorkspace(path.join(tempRoot, entry.name), { projectRoot, minAgeMs, nowMs }));
}

function scanRepoTempFiles(options = {}) {
  const root = path.resolve(options.projectRoot || ROOT);
  const minAgeMs = Number(options.minAgeMs || 0);
  const nowMs = options.nowMs === undefined ? Date.now() : Number(options.nowMs);
  const scanDirs = [root, path.join(root, 'data', 'import'), path.join(root, 'assets'), path.join(root, '_site', 'assets')]
    .filter((directory, index, all) => all.indexOf(directory) === index && fs.existsSync(directory));
  const found = [];
  for (const directory of scanDirs) {
    const stack = [directory];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'output') continue;
          stack.push(absolute);
          continue;
        }
        if (!entry.isFile()) continue;
        const relative = path.relative(root, absolute).replace(/\\/g, '/');
        if (relative.startsWith('scripts/archive/')) continue;
        if (!REPO_TMP_SUFFIXES.some((suffix) => entry.name.toLowerCase().endsWith(suffix))) continue;
        const ageMs = Math.max(0, nowMs - fs.statSync(absolute).mtimeMs);
        found.push({ eligible: false, reason: ageMs < minAgeMs ? 'FRESH_UNMANAGED_FILE' : 'UNMANAGED_FILE', directory: absolute, ageMs });
      }
    }
  }
  return found;
}

function executeCleanup(options = {}) {
  const apply = Boolean(options.apply);
  const minAgeMs = Number(options.minAgeMs === undefined ? DEFAULT_MIN_AGE_HOURS * 3600000 : options.minAgeMs);
  if (!Number.isFinite(minAgeMs) || minAgeMs < 0) throw new Error('Nieprawidłowy minimalny wiek workspace.');
  if (apply && minAgeMs < DEFAULT_MIN_AGE_HOURS * 3600000) throw new Error(`Tryb apply wymaga minimum ${DEFAULT_MIN_AGE_HOURS} godzin.`);
  const system = options.repoOnly ? [] : scanSystemTmp({ ...options, minAgeMs });
  const repo = options.systemOnly ? [] : scanRepoTempFiles({ ...options, minAgeMs });
  const removed = [];
  const candidates = [];
  const skipped = [];
  for (const item of [...system, ...repo]) {
    if (!item.eligible) { skipped.push(item); continue; }
    if (apply) {
      const current = inspectTempWorkspace(item.directory, {
        projectRoot: options.projectRoot || ROOT,
        minAgeMs,
        nowMs: options.nowMs === undefined ? Date.now() : Number(options.nowMs),
      });
      if (!current.eligible) {
        skipped.push(current);
        continue;
      }
      candidates.push(current);
      fs.rmSync(current.directory, { recursive: true, force: true });
      removed.push(current);
    } else candidates.push(item);
  }
  return { apply, minAgeMs, system, repo, candidates, removed, skipped };
}

function printResult(result) {
  console.log(`[TMP-CLEANUP] mode=${result.apply ? 'apply' : 'dry-run'} min_age_hours=${(result.minAgeMs / 3600000).toFixed(2)} candidates=${result.candidates.length} removed=${result.removed.length} skipped=${result.skipped.length}`);
  for (const item of result.candidates) console.log(`- ${result.apply ? 'REMOVED' : 'WOULD_REMOVE'} [${item.reason}] ${item.directory}`);
  for (const item of result.skipped.slice(0, 80)) console.log(`- SKIP [${item.reason}] ${item.directory}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = executeCleanup({
    apply: args.apply,
    minAgeMs: args.minAgeHours * 3600000,
    tempRoot: args.tempRoot,
    projectRoot: args.projectRoot,
    systemOnly: args.systemOnly,
    repoOnly: args.repoOnly,
  });
  printResult(result);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(`[TMP-CLEANUP][FAIL] ${error.message || error}`); process.exit(1); }
}

module.exports = {
  DEFAULT_MIN_AGE_HOURS,
  TMP_PREFIXES,
  executeCleanup,
  hasManagedPrefix,
  parseArgs,
  scanRepoTempFiles,
  scanSystemTmp,
};
