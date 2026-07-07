#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const DEFAULT_DAYS = 30;
const SAFE_DATA_REPORT_RX = /^(gsc-|seo-|aeo-|quick-answer-|content-freshness-|cwv-|link-topology-|assets-audit|pipeline-timings|fitpo50-doctor|agent-context|session-start-report|article-guard-blockers|seo-crawl-report).+\.(json|md|txt)$/i;
const SAFE_GROWTH_REPORT_RX = /^(growth-report|ai-visibility-audit|gsc-refresh|evidence-plan|hubs-report|link-assets|ai-visibility-test|entity-graph|structured-data-score|quick-answer-score|topical-authority-map|llms-check|perplexity-monitor|autopilot-plan|popraw-seo|apply-plan|verify)\.(json|md)$/i;
const SAFE_GSC_RX = /^(gsc-|seo-|aeo-|previous-|queries\.csv|pages\.csv|query-pages\.csv|seo-aio-|gsc-submit-queue).+|^(queries|pages|query-pages)\.csv$/i;

function parseArgs(argv) {
  const out = { dryRun: argv.includes('--dry-run'), days: DEFAULT_DAYS };
  const idx = argv.indexOf('--days');
  if (idx !== -1 && argv[idx + 1]) out.days = Math.max(1, Number(argv[idx + 1]) || DEFAULT_DAYS);
  return out;
}

function trackedSet() {
  const res = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return new Set(String(res.stdout || '').split('\n').filter(Boolean));
}

function collect(dir, safeRx, cutoffMs, tracked) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(ROOT, abs);
      const st = fs.statSync(abs);
      return { abs, rel, name: entry.name, ageDays: Math.floor((Date.now() - st.mtimeMs) / 86400000), size: st.size, mtimeMs: st.mtimeMs };
    })
    .filter((item) => item.mtimeMs < cutoffMs)
    .filter((item) => safeRx.test(item.name))
    .filter((item) => !tracked.has(item.rel));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cutoffMs = Date.now() - args.days * 86400000;
  const tracked = trackedSet();
  const candidates = [
    ...collect(path.join(ROOT, 'data', 'reports'), SAFE_DATA_REPORT_RX, cutoffMs, tracked),
    ...collect(path.join(ROOT, 'data', 'reports', 'growth'), SAFE_GROWTH_REPORT_RX, cutoffMs, tracked),
    ...collect(path.join(os.homedir(), 'Downloads', 'gsc-auto-input'), SAFE_GSC_RX, cutoffMs, tracked),
  ].sort((a, b) => a.mtimeMs - b.mtimeMs);

  console.log(`[REPORTS-PRUNE] mode=${args.dryRun ? 'dry-run' : 'apply'} days=${args.days} candidates=${candidates.length}`);
  for (const item of candidates.slice(0, 80)) {
    console.log(`- ${item.ageDays}d ${item.abs}`);
  }
  if (candidates.length > 80) console.log(`... ${candidates.length - 80} more`);

  if (!args.dryRun) {
    for (const item of candidates) fs.rmSync(item.abs, { force: true });
    console.log(`[REPORTS-PRUNE] removed=${candidates.length}`);
  }
}

main();
