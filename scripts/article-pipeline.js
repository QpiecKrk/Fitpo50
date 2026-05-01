#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let tempWorkingCopy = '';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function boolOpt(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const x = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(x)) return true;
  if (['0', 'false', 'no', 'off'].includes(x)) return false;
  return fallback;
}

function run(label, cmd, args) {
  console.log(`\n[STEP] ${label}`);
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`${label} failed (exit ${res.status ?? 'unknown'})`);
  }
}

function detectSlug(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  const slug = String(parsed.slug || '').trim();
  if (!slug) throw new Error('Brak slug w JSON.');
  return slug;
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
  const importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-import-'));
  const target = path.join(importDir, `${safeSlug(slug)}.fitpo50.json`);
  fs.copyFileSync(sourcePath, target);
  return target;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.log('Usage: node scripts/article-pipeline.js --file <path.fitpo50.json> [--category ciekawe] [--force true]');
    process.exit(1);
  }

  const root = process.cwd();
  const input = path.resolve(root, args.file);
  if (!fs.existsSync(input)) throw new Error(`Nie znaleziono pliku: ${input}`);

  const category = args.category ? String(args.category) : '';
  const force = boolOpt(args.force, false);
  const slug = detectSlug(input);
  const workingCopy = ensureImportCopy(input, slug);
  tempWorkingCopy = workingCopy;
  console.log(`[INFO] Source JSON: ${input}`);
  console.log(`[INFO] Working copy JSON: ${workingCopy}`);

  const common = ['scripts/import-article.js', '--file', workingCopy, '--faq-strict', 'true'];
  if (category) common.push('--category', category);

  run('JSON auto-fix (working copy)', 'node', ['scripts/fix-fitpo50-json.js', '--file', workingCopy, '--write', 'true', '--allow-outside-repo', 'true']);
  run('JSON gate (single file)', 'node', ['scripts/json-fitpo50-gate-diff.js', '--file', workingCopy]);
  run('Precheck (strict FAQ)', 'node', [...common, '--precheck', 'true']);
  run(
    'Import + walidacja + PDF + sync',
    'node',
    [
      ...common,
      '--publish', 'true',
      '--run-internal-links', 'false',
      '--validate', 'true',
      '--force', force ? 'true' : 'false',
    ],
  );
  run('Sync assets mirror (_site)', 'node', ['scripts/sync-site-assets-mirror.js', '--slug', slug]);
  run('NEWS integrity', 'node', ['scripts/news-integrity-check.js']);
  run('Predeploy gate (slug)', 'node', ['scripts/predeploy-gate.js', '--slug', slug]);

  console.log('\n[PASS] Article pipeline completed.');
  return { workingCopy };
}

try {
  const result = main();
  tempWorkingCopy = result?.workingCopy || '';
  if (tempWorkingCopy) {
    try {
      fs.rmSync(path.dirname(tempWorkingCopy), { recursive: true, force: true });
      console.log('[CLEANUP] Removed temporary working JSON directory.');
    } catch (_err) {
      console.warn('[WARN] Could not remove temporary working JSON directory.');
    }
  }
} catch (err) {
  console.error(`\n[FAIL] ${err.message || err}`);
  if (tempWorkingCopy) {
    try {
      fs.rmSync(path.dirname(tempWorkingCopy), { recursive: true, force: true });
      console.log('[CLEANUP] Removed temporary working JSON directory after failure.');
    } catch (_err) {
      // no-op
    }
  }
  process.exit(1);
}
