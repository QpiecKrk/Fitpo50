#!/usr/bin/env node

const os = require('os');
const path = require('path');
const { inspectGscInput } = require('./lib/gsc-data-contract');

function parseArgs(argv) {
  const out = {
    inputDir: process.env.GSC_WORK_DIR || path.join(os.homedir(), 'Downloads', 'gsc-auto-input'),
    strictPeriods: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (token === '--input-dir') {
      out.inputDir = path.resolve(process.cwd(), String(argv[i + 1] || '').trim());
      i += 1;
    } else if (token === '--allow-unverified-periods') {
      out.strictPeriods = false;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = inspectGscInput(args.inputDir, { strictPeriods: args.strictPeriods });
  console.log(JSON.stringify(result, null, 2));
  if (result.blocking) process.exit(2);
}

main();
