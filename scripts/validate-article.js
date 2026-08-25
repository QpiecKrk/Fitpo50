#!/usr/bin/env node

const { spawnSync } = require('child_process');

const COMMANDS = {
  standard: 'scripts/validate-article-standard.js',
  contract: 'scripts/article-contract-check.js',
  schema: 'scripts/schema-validator.js',
  'reading-room': 'scripts/reading-room-link-verifier.js',
  'publish-guard': 'scripts/article-publish-guard.js',
};

function printHelp() {
  console.log(`FitPo50 article validation center

Usage:
  node scripts/validate-article.js [standard] [files/options]
  node scripts/validate-article.js contract <file.html> [_site/file.html]
  node scripts/validate-article.js schema --diff
  node scripts/validate-article.js reading-room --diff

Aliases:
  --contract       same as: contract
  --schema-only    same as: schema
  --reading-room   same as: reading-room
`);
}

function resolveCommand(argv) {
  const first = String(argv[0] || '').trim();
  if (first === '--help' || first === '-h' || first === 'help') {
    return { help: true };
  }
  if (COMMANDS[first]) {
    return { command: first, args: argv.slice(1) };
  }
  if (argv.includes('--contract')) {
    return { command: 'contract', args: argv.filter((arg) => arg !== '--contract') };
  }
  if (argv.includes('--schema-only')) {
    return { command: 'schema', args: argv.filter((arg) => arg !== '--schema-only') };
  }
  if (argv.includes('--reading-room')) {
    return { command: 'reading-room', args: argv.filter((arg) => arg !== '--reading-room') };
  }
  return { command: 'standard', args: argv };
}

function run(command, args) {
  const script = COMMANDS[command];
  if (!script) throw new Error(`Nieznana komenda walidacji: ${command}`);
  console.log(`[ARTICLE-VALIDATE] ${command} -> node ${script} ${args.join(' ')}`.trim());
  const result = spawnSync('node', [script, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  process.exit(Number(result.status || 0));
}

function main() {
  const resolved = resolveCommand(process.argv.slice(2));
  if (resolved.help) {
    printHelp();
    return;
  }
  run(resolved.command, resolved.args);
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] validate-article -> ${err.message || err}`);
  process.exit(1);
}
