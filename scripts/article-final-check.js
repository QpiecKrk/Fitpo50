#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function runStep(label, cmd, args) {
  console.log(`\n[FINAL-CHECK] ${label}`);
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`${label} failed (exit ${res.status ?? 'unknown'})`);
  }
}

function parseJsonWithDiagnostics(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    const posMatch = message.match(/position (\d+)/i);
    if (!posMatch) throw new Error(`JSON parse error: ${message}`);
    const pos = Number(posMatch[1]);
    const head = raw.slice(0, pos);
    const line = head.split('\n').length;
    const col = pos - head.lastIndexOf('\n');
    const lineText = raw.split('\n')[line - 1] || '';
    throw new Error(`JSON parse error: ${message} (line ${line}, col ${col}): ${lineText.trim()}`);
  }
}

function detectSlug(parsed, inputPath) {
  const fromJson = parsed && typeof parsed === 'object' ? String(parsed.slug || '').trim() : '';
  if (fromJson) return fromJson;
  const fallback = path.basename(inputPath).replace(/\.fitpo50\.json$/i, '').replace(/\.json$/i, '');
  if (!fallback) throw new Error('Brak slug w JSON i brak nazwy pliku do fallbacku.');
  return fallback;
}

function safeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureImportCopy(sourcePath, slug) {
  const importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-final-check-'));
  const target = path.join(importDir, `${safeSlug(slug)}.fitpo50.json`);
  fs.copyFileSync(sourcePath, target);
  return target;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/article-final-check.js --file <path.fitpo50.json> [--assets-dir <dir>] [--category zdrowie]');
    process.exit(1);
  }

  const root = process.cwd();
  const input = path.resolve(root, args.file);
  if (!fs.existsSync(input)) throw new Error(`Nie znaleziono pliku: ${input}`);

  const parsedInput = parseJsonWithDiagnostics(input);
  const slug = detectSlug(parsedInput, input);
  const assetsDir = args['assets-dir'] ? path.resolve(root, args['assets-dir']) : path.dirname(input);
  const workingCopy = ensureImportCopy(input, slug);

  console.log(`[INFO] Source JSON: ${input}`);
  console.log(`[INFO] Working copy JSON: ${workingCopy}`);
  console.log(`[INFO] Source assets dir: ${assetsDir}`);
  console.log(`[INFO] Slug: ${slug}`);

  runStep('Raw JSON parse gate (input)', 'node', ['scripts/fix-fitpo50-json.js', '--file', input, '--write', 'false', '--check', 'true', '--allow-outside-repo', 'true']);
  runStep('JSON auto-fix (working copy)', 'node', ['scripts/fix-fitpo50-json.js', '--file', workingCopy, '--write', 'true', '--allow-outside-repo', 'true']);
  runStep('JSON strict autofix', 'node', ['scripts/json-autofix-strict.js', '--file', workingCopy, '--map', 'data/internal-link-map.json']);
  runStep('JSON semantic gate', 'node', ['scripts/json-fitpo50-gate-diff.js', '--file', workingCopy]);
  runStep('Article preflight', 'node', ['scripts/article-preflight.js', '--file', workingCopy, '--assets-dir', assetsDir]);
  runStep('Prepare article assets', 'node', ['scripts/prepare-article-assets.js', '--file', workingCopy, '--from', assetsDir]);

  const importArgs = [
    'scripts/import-article.js',
    '--file',
    workingCopy,
    '--faq-strict',
    'true',
    '--publish',
    'true',
    '--run-internal-links',
    'auto',
    '--validate',
    'true',
    '--force',
    'true',
  ];
  if (args.category) importArgs.push('--category', String(args.category));
  runStep('Import + local publish + validate', 'node', importArgs);

  runStep('Sync head description contract', 'node', ['scripts/sync-article-head-descriptions.js', '--slug', slug]);
  runStep('Article contract check', 'node', ['scripts/article-contract-check.js', `${slug}.html`, path.join('_site', `${slug}.html`)]);
  runStep('Sync assets mirror', 'node', ['scripts/sync-site-assets-mirror.js', '--slug', slug]);
  runStep('Predeploy gate', 'node', ['scripts/predeploy-gate.js', '--slug', slug]);

  console.log('\n[PASS] article-final-check OK');
}

try {
  main();
} catch (err) {
  console.error(`\n[FAIL] ${err.message || err}`);
  process.exit(1);
}
