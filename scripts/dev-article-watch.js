#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const out = {};
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
  return out;
}

function now() {
  return new Date().toLocaleTimeString('pl-PL', { hour12: false });
}

function runFastGate(file, assetsDir) {
  return new Promise((resolve) => {
    const args = ['scripts/article-ready-check.js', '--file', file, '--write', 'false'];
    if (assetsDir) args.push('--assets-dir', assetsDir);
    console.log(`\n[${now()}] FAST-GATE start`);
    const child = spawn('node', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`[${now()}] FAST-GATE PASS`);
      } else {
        console.log(`[${now()}] FAST-GATE FAIL (exit ${code})`);
      }
      resolve(code);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/dev-article-watch.js --file <path.fitpo50.json> [--assets-dir <dir>]');
    process.exit(1);
  }

  const file = path.resolve(process.cwd(), String(args.file));
  const assetsDir = args['assets-dir'] ? path.resolve(process.cwd(), String(args['assets-dir'])) : '';
  if (!fs.existsSync(file)) {
    throw new Error(`Nie znaleziono pliku: ${file}`);
  }

  console.log(`[WATCH] ${file}`);
  if (assetsDir) console.log(`[ASSETS] ${assetsDir}`);
  console.log('[INFO] Zapisz plik, aby automatycznie uruchomić kontrolę CONTENT_READY. Ctrl+C aby zakończyć.');

  let timer = null;
  let running = false;
  let pending = false;

  const trigger = () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    runFastGate(file, assetsDir).finally(() => {
      running = false;
      if (pending) {
        pending = false;
        trigger();
      }
    });
  };

  await runFastGate(file, assetsDir);

  fs.watch(file, { persistent: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      trigger();
    }, 350);
  });
}

main().catch((err) => {
  console.error(`[FAIL] ${err.message || err}`);
  process.exit(1);
});
