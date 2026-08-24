#!/usr/bin/env node

const { spawnSync } = require('child_process');

const COMMANDS = {
  check: 'scripts/gsc-data-contract.js',
  auto: 'scripts/gsc-auto-report.js',
  api: 'scripts/gsc-weekly-api-report.js',
  csv: 'scripts/gsc-weekly-csv-report.js',
  report: 'scripts/gsc-weekly-csv-report.js',
  'priority-map': 'scripts/gsc-priority-map.js',
  watchdog: 'scripts/gsc-indexing-watchdog.js',
  'command-center': 'scripts/seo-aio-command-center.js',
  'apply-wave': 'scripts/seo-aio-wave-autopilot.js',
};

function printHelp() {
  console.log(`FitPo50 GSC/SEO tool center

Usage:
  node scripts/gsc-tool.js auto
  node scripts/gsc-tool.js check [--input-dir <dir>]
  node scripts/gsc-tool.js api [options]
  node scripts/gsc-tool.js csv [options]
  node scripts/gsc-tool.js priority-map [options]
  node scripts/gsc-tool.js watchdog [options]
  node scripts/gsc-tool.js command-center [options]
  node scripts/gsc-tool.js apply-wave [options]

Default command:
  auto
`);
}

function resolve(argv) {
  const first = String(argv[0] || '').trim();
  if (first === '--help' || first === '-h' || first === 'help') return { help: true };
  if (COMMANDS[first]) return { command: first, args: argv.slice(1) };
  return { command: 'auto', args: argv };
}

function main() {
  const resolved = resolve(process.argv.slice(2));
  if (resolved.help) {
    printHelp();
    return;
  }

  const script = COMMANDS[resolved.command];
  console.log(`[GSC-TOOL] ${resolved.command} -> node ${script} ${resolved.args.join(' ')}`.trim());
  const result = spawnSync('node', [script, ...resolved.args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  process.exit(Number(result.status || 0));
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] gsc-tool -> ${err.message || err}`);
  process.exit(1);
}
