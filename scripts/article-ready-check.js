#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const { inspectPreparedArtifact } = require('./lib/article-json-artifact');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) out[key] = 'true';
    else out[key] = next, i += 1;
  }
  return out;
}

function runStep(label, args) {
  console.log(`\n[READY-CHECK] ${label}`);
  const result = spawnSync('node', args, { cwd: process.cwd(), stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status ?? 'unknown'})`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Użycie: node scripts/article-ready-check.js --file <CONTENT_READY.fitpo50.json> --assets-dir <dir>');
    process.exit(1);
  }
  const root = process.cwd();
  const file = path.resolve(root, args.file);
  const artifact = inspectPreparedArtifact(file, root);
  if (!artifact.ok) {
    throw new Error(`Ready-check wymaga niezmienionego artefaktu CONTENT_READY:\n- ${artifact.errors.join('\n- ')}`);
  }
  const assetsDir = args['assets-dir'] ? path.resolve(root, args['assets-dir']) : path.dirname(file);
  runStep('Integralność treści, logiki, dowodów i FAQ', ['scripts/json-fitpo50-gate-diff.js', '--file', file]);
  runStep('Gotowość kompletnego pakietu z assetami', ['scripts/article-preflight.js', '--file', file, '--assets-dir', assetsDir]);
  console.log('\n[PASS] article-ready-check: CONTENT_READY + package ready; JSON nie został zmieniony.');
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] article-ready-check -> ${err.message || err}`);
  process.exit(1);
}
