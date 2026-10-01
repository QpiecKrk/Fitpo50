#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { compareExportTrees } = require('./lib/export-parity');

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = String(argv[index] || '');
    const value = argv[index + 1];
    if (key === '--expected' && value) { out.expected = value; index += 1; }
    else if (key === '--actual' && value) { out.actual = value; index += 1; }
    else if (key === '--report' && value) { out.report = value; index += 1; }
  }
  return out;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.expected) throw new Error('Użycie: export-parity-check --expected <świeży-eksport> [--actual _site] [--report <plik>]');
  const report = compareExportTrees(args.expected, args.actual || '_site');
  if (args.report) {
    const output = path.resolve(args.report);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  for (const group of ['missing', 'extra', 'different']) {
    for (const entry of report[group]) console.error(`[EXPORT-PARITY] ${group.toUpperCase()} ${entry.kind}: ${entry.path}`);
  }
  if (!report.ok) {
    throw new Error(`Niezgodny eksport: brak=${report.missing.length}, nadmiar=${report.extra.length}, różne=${report.different.length}.`);
  }
  console.log(`[PASS] source/_site parity: ${report.expected_files} plików.`);
}

try {
  main();
} catch (error) {
  console.error(`[FAIL] ${error.message || error}`);
  process.exit(1);
}
