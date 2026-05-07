#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const PLACEHOLDER_PATTERNS = [
  /Wniosek praktyczny do doprecyzowania na etapie redakcji\./i,
  /do doprecyzowania/i,
  /do uzupelnienia/i,
  /\{\{[^}]+\}\}/,
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const key = t.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function filesFromArgs(args) {
  if (args.file) return [path.resolve(args.file)];
  if (args.slug) return [path.resolve(`${args.slug}.html`)];
  return [];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = filesFromArgs(args);
  if (!files.length) {
    console.error('Usage: node scripts/lint-editorial-placeholders.js --file <file.html> OR --slug <slug>');
    process.exit(1);
  }
  const errors = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      errors.push(`Brak pliku: ${file}`);
      continue;
    }
    const raw = fs.readFileSync(file, 'utf8');
    for (const rx of PLACEHOLDER_PATTERNS) {
      if (rx.test(raw)) {
        errors.push(`${path.basename(file)}: wykryto placeholder (${rx})`);
      }
    }
  }

  if (errors.length) {
    console.error('[FAIL] lint-editorial-placeholders');
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }
  console.log('[PASS] lint-editorial-placeholders OK');
}

main();
