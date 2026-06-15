#!/usr/bin/env node

const { spawnSync } = require('child_process');

const COMMANDS = {
  import: 'scripts/article-pipeline.js',
  create: 'scripts/create-article-from-template.js',
  preflight: 'scripts/article-preflight.js',
  'fix-json': 'scripts/fix-fitpo50-json.js',
  'strict-json': 'scripts/json-autofix-strict.js',
  validate: 'scripts/validate-article.js',
  final: 'scripts/article-final-check.js',
};

function printHelp() {
  console.log(`FitPo50 article manager

Usage:
  node scripts/article-manager.js import --file <article.fitpo50.json> --category <ruch|jedzenie|zdrowie|ciekawe>
  node scripts/article-manager.js create --slug <slug> --title "..." --category <...> --description "..."
  node scripts/article-manager.js preflight --file <article.fitpo50.json> --assets-dir <dir>
  node scripts/article-manager.js fix-json --file <article.fitpo50.json> --write true
  node scripts/article-manager.js strict-json --file <article.fitpo50.json>
  node scripts/article-manager.js validate <file.html>
  node scripts/article-manager.js final --file <article.fitpo50.json> --assets-dir <dir>

Default command:
  import
`);
}

function resolve(argv) {
  const first = String(argv[0] || '').trim();
  if (first === '--help' || first === '-h' || first === 'help') return { help: true };
  if (COMMANDS[first]) return { command: first, args: argv.slice(1) };
  return { command: 'import', args: argv };
}

function main() {
  const resolved = resolve(process.argv.slice(2));
  if (resolved.help) {
    printHelp();
    return;
  }

  const script = COMMANDS[resolved.command];
  console.log(`[ARTICLE-MANAGER] ${resolved.command} -> node ${script} ${resolved.args.join(' ')}`.trim());
  const result = spawnSync('node', [script, ...resolved.args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  process.exit(Number(result.status || 0));
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] article-manager -> ${err.message || err}`);
  process.exit(1);
}
