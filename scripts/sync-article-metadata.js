#!/usr/bin/env node

const { spawnSync } = require('child_process');

function printHelp() {
  console.log(`FitPo50 article metadata sync center

Usage:
  node scripts/sync-article-metadata.js full --slug <slug>
  node scripts/sync-article-metadata.js full --slug <slug> --title "..." --description "..."
  node scripts/sync-article-metadata.js set --slug <slug> --title "..." --description "..."
  node scripts/sync-article-metadata.js head --slug <slug>
  node scripts/sync-article-metadata.js breadcrumb --slug <slug>

Default command:
  full
`);
}

function parse(argv) {
  const first = String(argv[0] || '').trim();
  if (first === '--help' || first === '-h' || first === 'help') return { help: true };
  const commands = new Set(['full', 'set', 'head', 'breadcrumb']);
  if (commands.has(first)) return { command: first, args: argv.slice(1) };
  return { command: 'full', args: argv };
}

function hasArg(args, name) {
  return args.includes(name);
}

function runStep(label, script, args) {
  console.log(`\n[ARTICLE-META] ${label}`);
  console.log(`$ node ${script} ${args.join(' ')}`.trim());
  const result = spawnSync('node', [script, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? 'unknown'})`);
  }
}

function main() {
  const parsed = parse(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const args = parsed.args;
  const command = parsed.command;
  const hasTitleAndDescription = hasArg(args, '--title') && hasArg(args, '--description');
  const hasSlug = hasArg(args, '--slug');

  if (command === 'set') {
    runStep('set title/description/head/schema', 'scripts/article-meta-set.js', args);
    return;
  }
  if (command === 'head') {
    runStep('sync descriptions', 'scripts/sync-article-head-descriptions.js', args);
    return;
  }
  if (command === 'breadcrumb') {
    runStep('sync title + breadcrumb', 'scripts/sync-article-title-breadcrumb.js', args);
    return;
  }

  if (hasTitleAndDescription) {
    runStep('set title/description/head/schema', 'scripts/article-meta-set.js', args);
  }
  if (hasSlug) {
    runStep('sync title + breadcrumb', 'scripts/sync-article-title-breadcrumb.js', args);
  }
  runStep('sync descriptions', 'scripts/sync-article-head-descriptions.js', args);
}

try {
  main();
} catch (err) {
  console.error(`\n[FAIL] sync-article-metadata -> ${err.message || err}`);
  process.exit(1);
}
