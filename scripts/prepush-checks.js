#!/usr/bin/env node

const { spawnSync } = require('child_process');

const COMMANDS = {
  local: ['node', ['scripts/run-all-prepush.js']],
  parallel: ['node', ['scripts/prepush-parallel-checks.js']],
  diff: ['node', ['scripts/prepush-diff-guard.js']],
  deploy: ['node', ['scripts/predeploy-gate.js']],
  strict: ['npm', ['run', 'prepush:strict']],
};

function printHelp() {
  console.log(`FitPo50 pre-push/deploy checks center

Usage:
  node scripts/prepush-checks.js local
  node scripts/prepush-checks.js parallel
  node scripts/prepush-checks.js diff
  node scripts/prepush-checks.js deploy [--slug <slug>]
  node scripts/prepush-checks.js strict

Default command:
  local
`);
}

function resolve(argv) {
  const first = String(argv[0] || '').trim();
  if (first === '--help' || first === '-h' || first === 'help') return { help: true };
  if (COMMANDS[first]) return { command: first, args: argv.slice(1) };
  return { command: 'local', args: argv };
}

function main() {
  const resolved = resolve(process.argv.slice(2));
  if (resolved.help) {
    printHelp();
    return;
  }

  const [cmd, baseArgs] = COMMANDS[resolved.command];
  const args = [...baseArgs, ...resolved.args];
  console.log(`[PREPUSH-CHECKS] ${resolved.command} -> ${cmd} ${args.join(' ')}`.trim());
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  process.exit(Number(result.status || 0));
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] prepush-checks -> ${err.message || err}`);
  process.exit(1);
}
