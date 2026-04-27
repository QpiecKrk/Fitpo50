#!/usr/bin/env node

const { spawnSync } = require('child_process');

const HARD_LIMIT = 180;
const WARN_LIMIT = 80;
const BYPASS_ENV = 'FITPO50_BYPASS_DIFF_GUARD';

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function changedFiles() {
  const diff = run('git', ['diff', '--name-only', 'origin/main...HEAD']);
  if (diff.status !== 0) {
    const msg = String(diff.stderr || diff.stdout || '').trim();
    throw new Error(`Nie udało się odczytać diff origin/main...HEAD: ${msg}`);
  }
  return String(diff.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function topGroup(file) {
  const p = String(file || '').trim();
  if (!p.includes('/')) return '(root)';
  return p.split('/')[0] || '(root)';
}

function main() {
  if (String(process.env[BYPASS_ENV] || '').trim() === '1') {
    console.log(`[WARN] prepush:diff-guard pominięty (${BYPASS_ENV}=1).`);
    return;
  }

  const files = changedFiles();
  const total = files.length;
  const groups = [...new Set(files.map(topGroup))];

  if (total === 0) {
    console.log('[PASS] prepush:diff-guard - brak zmian względem origin/main.');
    return;
  }

  if (total > HARD_LIMIT) {
    console.log('\n[FAIL] prepush:diff-guard');
    console.log(`- Zmian jest ${total}, limit twardy to ${HARD_LIMIT}.`);
    console.log(`- Zakres grup: ${groups.join(', ')}`);
    console.log(`- Jeśli to świadomy duży push, uruchom ponownie z ${BYPASS_ENV}=1.`);
    process.exit(1);
  }

  if (total > WARN_LIMIT) {
    console.log('\n[WARN] prepush:diff-guard');
    console.log(`- Duży zakres: ${total} plików (próg ostrzegawczy ${WARN_LIMIT}).`);
    console.log(`- Grupy: ${groups.join(', ')}`);
  }

  console.log(`[PASS] prepush:diff-guard - ${total} plików, grupy: ${groups.join(', ')}`);
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] prepush:diff-guard -> ${err.message || err}`);
  process.exit(1);
}

