#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { assertPathInside, assertProjectRoot } = require('./lib/destructive-path-guard');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DAYS = 30;
const SAFE_DATA_REPORT_RX = /^(gsc-|seo-|aeo-|quick-answer-|content-freshness-|cwv-|link-topology-|assets-audit|pipeline-timings|fitpo50-doctor|agent-context|session-start-report|article-guard-blockers|seo-crawl-report).+\.(json|md|txt)$/i;
const SAFE_GROWTH_REPORT_RX = /^(growth-report|ai-visibility-audit|gsc-refresh|evidence-plan|hubs-report|link-assets|ai-visibility-test|entity-graph|structured-data-score|quick-answer-score|gsc-generative-ai|snippet-controls-audit|post-deploy-kpi-plan|originality-score|topical-authority-map|llms-check|perplexity-monitor|autopilot-plan|popraw-seo|apply-plan|verify)\.(json|md)$|^popraw-seo-decyzje\.md$/i;
const SAFE_GSC_RX = /^(gsc-|seo-|aeo-|previous-|queries\.csv|pages\.csv|query-pages\.csv|seo-aio-|gsc-submit-queue).+|^(queries|pages|query-pages)\.csv$/i;

function parseArgs(argv) {
  const out = { apply: false, days: DEFAULT_DAYS };
  let mode = '';
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (token === '--apply' || token === '--dry-run') {
      if (mode && mode !== token) throw new Error('Nie można łączyć --apply i --dry-run.');
      mode = token;
      out.apply = token === '--apply';
    } else if (token === '--days') {
      const value = String(argv[index + 1] || '');
      const days = Number(value);
      if (!value || !Number.isFinite(days) || days < 1) throw new Error(`Nieprawidłowe --days: ${value || '(brak)'}`);
      out.days = days;
      index += 1;
    } else {
      throw new Error(`Nieznany argument: ${token || '(pusty)'}`);
    }
  }
  return out;
}

function trackedSet(root, runner = spawnSync) {
  const result = runner('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ls-files nie powiódł się: ${String(result.stderr || result.stdout || '').trim() || `exit ${result.status}`}`);
  return new Set(String(result.stdout || '').split('\n').map((item) => item.replace(/\\/g, '/')).filter(Boolean));
}

function collect(directory, safeRx, cutoffMs, tracked, root) {
  if (!fs.existsSync(directory)) return [];
  const safeDirectory = assertPathInside(directory, directory, { allowEqual: true, mustExist: true, type: 'directory' });
  return fs.readdirSync(safeDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
    .map((entry) => {
      const absolute = assertPathInside(safeDirectory, path.join(safeDirectory, entry.name), { mustExist: true, type: 'file' });
      const relative = path.relative(root, absolute).replace(/\\/g, '/');
      const stat = fs.statSync(absolute);
      return { absolute, relative, directory: safeDirectory, safeRx, name: entry.name, ageDays: Math.floor((Date.now() - stat.mtimeMs) / 86400000), size: stat.size, mtimeMs: stat.mtimeMs };
    })
    .filter((item) => item.mtimeMs < cutoffMs)
    .filter((item) => safeRx.test(item.name))
    .filter((item) => !tracked.has(item.relative));
}

function defaultRoots(root) {
  return [
    { directory: path.join(root, 'data', 'reports'), safeRx: SAFE_DATA_REPORT_RX },
    { directory: path.join(root, 'data', 'reports', 'growth'), safeRx: SAFE_GROWTH_REPORT_RX },
    { directory: path.join(os.homedir(), 'Downloads', 'gsc-auto-input'), safeRx: SAFE_GSC_RX },
  ];
}

function validateCandidate(item, cutoffMs, tracked, root) {
  const absolute = assertPathInside(item.directory, item.absolute, { mustExist: true, type: 'file' });
  const stat = fs.statSync(absolute);
  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  if (stat.mtimeMs >= cutoffMs) throw new Error(`Kandydat nie spełnia już wieku retencji: ${absolute}`);
  if (!item.safeRx.test(path.basename(absolute))) throw new Error(`Kandydat nie spełnia allowlisty nazwy: ${absolute}`);
  if (tracked.has(relative)) throw new Error(`Odmowa usunięcia śledzonego pliku: ${relative}`);
  return absolute;
}

function executePrune(options = {}) {
  const root = assertProjectRoot(options.root || ROOT);
  const args = options.args || { apply: false, days: DEFAULT_DAYS };
  const cutoffMs = Number(options.nowMs === undefined ? Date.now() : options.nowMs) - args.days * 86400000;
  const loadTracked = options.loadTracked || ((projectRoot) => trackedSet(projectRoot));
  const tracked = loadTracked(root);
  const roots = options.roots || defaultRoots(root);
  const candidates = roots.flatMap(({ directory, safeRx }) => collect(directory, safeRx, cutoffMs, tracked, root))
    .sort((left, right) => left.mtimeMs - right.mtimeMs);
  const removed = [];
  if (args.apply) {
    const currentTracked = loadTracked(root);
    for (const item of candidates) {
      const absolute = validateCandidate(item, cutoffMs, currentTracked, root);
      fs.unlinkSync(absolute);
      removed.push(absolute);
    }
  }
  return { apply: Boolean(args.apply), days: args.days, candidates, removed };
}

function printResult(result) {
  console.log(`[REPORTS-PRUNE] mode=${result.apply ? 'apply' : 'dry-run'} days=${result.days} candidates=${result.candidates.length}`);
  for (const item of result.candidates.slice(0, 80)) console.log(`- ${item.ageDays}d ${item.absolute}`);
  if (result.candidates.length > 80) console.log(`... ${result.candidates.length - 80} more`);
  if (result.apply) console.log(`[REPORTS-PRUNE] removed=${result.removed.length}`);
  else console.log('[REPORTS-PRUNE] bez zmian; użyj --apply po przeglądzie listy.');
}

function main() {
  printResult(executePrune({ args: parseArgs(process.argv.slice(2)) }));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[REPORTS-PRUNE][FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { DEFAULT_DAYS, executePrune, parseArgs, trackedSet, validateCandidate };
