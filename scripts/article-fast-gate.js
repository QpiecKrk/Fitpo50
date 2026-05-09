#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = { write: true };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  if (Object.prototype.hasOwnProperty.call(out, 'write')) {
    const v = String(out.write).trim().toLowerCase();
    out.write = !['0', 'false', 'no', 'off'].includes(v);
  }
  return out;
}

function runStep(label, cmd, args) {
  console.log(`\n[FAST-GATE] ${label}`);
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`${label} failed (exit ${res.status ?? 'unknown'})`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/article-fast-gate.js --file <path.fitpo50.json> [--assets-dir <dir>]');
    process.exit(1);
  }

  const root = process.cwd();
  const file = path.resolve(root, args.file);
  if (!fs.existsSync(file)) {
    throw new Error(`Nie znaleziono pliku JSON: ${file}`);
  }
  const assetsDir = args['assets-dir'] ? path.resolve(root, args['assets-dir']) : path.dirname(file);

  runStep('Raw JSON parse', 'node', [
    'scripts/fix-fitpo50-json.js',
    '--file',
    file,
    '--write',
    args.write ? 'true' : 'false',
    '--check',
    args.write ? 'false' : 'true',
    '--allow-outside-repo',
    'true',
  ]);
  runStep('JSON semantic gate', 'node', ['scripts/json-fitpo50-gate-diff.js', '--file', file]);
  runStep('Article preflight', 'node', ['scripts/article-preflight.js', '--file', file, '--assets-dir', assetsDir]);

  console.log('\n[PASS] article-fast-gate OK');
}

try {
  main();
} catch (err) {
  console.error(`\n[FAIL] ${err.message || err}`);
  process.exit(1);
}
