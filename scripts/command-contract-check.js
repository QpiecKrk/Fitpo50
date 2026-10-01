#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const STATUSES = new Set(['PUBLIC', 'INTERNAL', 'RECOVERY', 'RETIRED']);
const REQUIRED_STATUSES = new Map([
  ['article:add', 'PUBLIC'],
  ['article:prepare-json', 'PUBLIC'],
  ['article:publish', 'PUBLIC'],
  ['article:assets:prepare', 'INTERNAL'],
  ['article:architecture', 'INTERNAL'],
  ['article:media', 'INTERNAL'],
  ['article:meta:set', 'INTERNAL'],
  ['article:meta:sync', 'INTERNAL'],
  ['article:head:sync', 'INTERNAL'],
  ['hostinger:clean-repo', 'RETIRED'],
  ['hostinger:recovery', 'RECOVERY'],
  ['prepush:strict', 'RETIRED'],
]);

function loadCommandRegistry(filePath) {
  const registry = new Map();
  const raw = fs.readFileSync(filePath, 'utf8');
  const pattern = /^- \[(PUBLIC|INTERNAL|RECOVERY|RETIRED)\] `npm run ([^`\s]+)`\s+[—-]\s+(.+)$/gm;
  let match;
  while ((match = pattern.exec(raw))) {
    const [, status, command, description] = match;
    if (registry.has(command)) throw new Error(`Duplikat komendy w rejestrze: ${command}`);
    registry.set(command, { status, description: description.trim() });
  }
  return registry;
}

function validateCommandContract({ packageScripts, registry }) {
  const errors = [];
  const scriptNames = Object.keys(packageScripts || {}).sort();
  for (const command of scriptNames) {
    if (!registry.has(command)) errors.push(`Brak komendy package.json w rejestrze: ${command}.`);
  }
  for (const [command, entry] of registry.entries()) {
    if (!Object.prototype.hasOwnProperty.call(packageScripts || {}, command)) {
      errors.push(`Rejestr opisuje nieistniejącą komendę package.json: ${command}.`);
    }
    if (!STATUSES.has(entry.status)) errors.push(`Nieprawidłowy status komendy ${command}: ${entry.status}.`);
    if (entry.status === 'INTERNAL' && /(zalecan\w*.*użytkownik|użytkownik.*zalecan\w*|uruchom.*bezpośrednio)/iu.test(entry.description)) {
      errors.push(`Komenda INTERNAL ${command} jest przedstawiona jako zalecana użytkownikowi.`);
    }
  }
  for (const [command, status] of REQUIRED_STATUSES.entries()) {
    const actual = registry.get(command)?.status;
    if (actual && actual !== status) errors.push(`Komenda ${command} musi mieć status ${status}, ma ${actual}.`);
  }
  return { ok: errors.length === 0, errors, commands: scriptNames.length };
}

function validateRecommendedCommands(text, registry, label = 'dokument') {
  const errors = [];
  for (const [index, line] of String(text || '').split(/\r?\n/).entries()) {
    if (/^- \[(PUBLIC|INTERNAL|RECOVERY|RETIRED)\]/.test(line)) continue;
    if (!/(uruchom|użyj|wykonaj|zalecan|wejści)/iu.test(line)) continue;
    if (/(nie uruchamiaj|nie używaj|wywołuje kontroler|wywoływany przez kontroler|workflow push|przed commitem)/iu.test(line)) continue;
    for (const match of line.matchAll(/npm run ([a-z0-9:_-]+)/gi)) {
      const command = match[1];
      if (registry.get(command)?.status === 'INTERNAL') {
        errors.push(`${label}:${index + 1} zaleca użytkownikowi komendę INTERNAL: ${command}.`);
      }
    }
  }
  return errors;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const registry = loadCommandRegistry(path.join(root, 'docs', 'command-registry.md'));
  const report = validateCommandContract({ packageScripts: packageJson.scripts, registry });
  for (const relative of ['docs/command-registry.md', 'AGENTS.md', 'PROJECT_MEMORY.md', 'SESSION_START_MAX.md']) {
    report.errors.push(...validateRecommendedCommands(fs.readFileSync(path.join(root, relative), 'utf8'), registry, relative));
  }
  report.ok = report.errors.length === 0;
  if (!report.ok) throw new Error(report.errors.join('\n'));
  console.log(`[PASS] command contract: ${report.commands} komend, każda ma jeden status.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { loadCommandRegistry, validateCommandContract, validateRecommendedCommands };
