#!/usr/bin/env node

const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let tempWorkingCopy = '';
const PUBLISHED_LOG_PATH = path.join(process.cwd(), 'data', 'reports', 'published-articles-log.json');

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

function runParallel(label, jobs) {
  console.log(`\n[STEP] ${label}`);
  jobs.forEach((job) => {
    console.log(`$ ${job.cmd} ${job.args.join(' ')}`);
  });
  return Promise.all(
    jobs.map((job) => new Promise((resolve, reject) => {
      const child = spawn(job.cmd, job.args, { stdio: 'inherit' });
      child.on('error', (err) => {
        reject(new Error(`${job.label} failed to start: ${err.message || err}`));
      });
      child.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`${job.label} failed (exit ${code ?? 'unknown'})`));
          return;
        }
        resolve();
      });
    })),
  );
}

function runTempCleanup() {
  const res = spawnSync('node', ['scripts/tmp-cleanup.js'], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.warn('[WARN] tmp-cleanup exited with non-zero status.');
  }
}

function registerPublishedArticle(slug) {
  const normalizedSlug = safeSlug(slug);
  if (!normalizedSlug) return;
  const nowIso = new Date().toISOString();
  const url = `https://fitpo50.pl/${normalizedSlug}.html`;
  const emptyState = {
    version: 1,
    updated_at: nowIso,
    items: [],
  };
  let state = emptyState;
  if (fs.existsSync(PUBLISHED_LOG_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(PUBLISHED_LOG_PATH, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        state = {
          version: 1,
          updated_at: String(parsed.updated_at || nowIso),
          items: Array.isArray(parsed.items) ? parsed.items : [],
        };
      }
    } catch (_err) {
      state = emptyState;
    }
  }
  const bySlug = new Map();
  for (const it of state.items) {
    const key = safeSlug(String(it.slug || ''));
    if (!key) continue;
    bySlug.set(key, it);
  }
  const prev = bySlug.get(normalizedSlug);
  bySlug.set(normalizedSlug, {
    slug: normalizedSlug,
    url,
    first_published_at: prev?.first_published_at || nowIso,
    last_published_at: nowIso,
    status: 'pending',
    last_checked_at: prev?.last_checked_at || '',
    last_crawl_time: prev?.last_crawl_time || '',
    notes: prev?.notes || '',
  });
  state.items = [...bySlug.values()].sort((a, b) => String(b.last_published_at || '').localeCompare(String(a.last_published_at || '')));
  state.updated_at = nowIso;
  fs.mkdirSync(path.dirname(PUBLISHED_LOG_PATH), { recursive: true });
  fs.writeFileSync(PUBLISHED_LOG_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log(`[INFO] Published log updated: ${path.relative(process.cwd(), PUBLISHED_LOG_PATH)}`);
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
  const importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-import-'));
  const target = path.join(importDir, `${safeSlug(slug)}.fitpo50.json`);
  fs.copyFileSync(sourcePath, target);
  return target;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.log('Usage: node scripts/article-pipeline.js --file <path.fitpo50.json> [--category ciekawe] [--force true]');
    process.exit(1);
  }

  const root = process.cwd();
  const input = path.resolve(root, args.file);
  if (!fs.existsSync(input)) throw new Error(`Nie znaleziono pliku: ${input}`);
  const parsedInput = parseJsonWithDiagnostics(input);

  const category = args.category ? String(args.category) : '';
  const force = boolOpt(args.force, true);
  const parallelTails = boolOpt(args['parallel-tails'], true);
  const assetsDir = args['assets-dir'] ? path.resolve(root, args['assets-dir']) : path.dirname(input);
  const slug = detectSlug(parsedInput, input);
  const workingCopy = ensureImportCopy(input, slug);
  tempWorkingCopy = workingCopy;
  console.log(`[INFO] Source JSON: ${input}`);
  console.log(`[INFO] Working copy JSON: ${workingCopy}`);
  console.log(`[INFO] Source assets dir: ${assetsDir}`);

  const common = ['scripts/import-article.js', '--file', workingCopy, '--faq-strict', 'true'];
  if (category) common.push('--category', category);

  run('Raw JSON parse gate (input)', 'node', ['scripts/fix-fitpo50-json.js', '--file', input, '--write', 'false', '--check', 'true', '--allow-outside-repo', 'true']);
  run('JSON auto-fix (working copy)', 'node', ['scripts/fix-fitpo50-json.js', '--file', workingCopy, '--write', 'true', '--allow-outside-repo', 'true']);
  run('JSON gate (single file)', 'node', ['scripts/json-fitpo50-gate-diff.js', '--file', workingCopy]);
  run('Article preflight (working copy)', 'node', ['scripts/article-preflight.js', '--file', workingCopy, '--assets-dir', assetsDir]);
  run('Prepare article assets (hero + sekcje)', 'node', ['scripts/prepare-article-assets.js', '--file', workingCopy, '--from', assetsDir]);
  run('Precheck (strict FAQ)', 'node', [...common, '--precheck', 'true']);
  run(
    'Import + walidacja + PDF + sync',
    'node',
    [
      ...common,
      '--publish', 'true',
      '--run-internal-links', 'auto',
      '--validate', 'true',
      '--force', force ? 'true' : 'false',
    ],
  );
  run('Sync assets mirror (_site)', 'node', ['scripts/sync-site-assets-mirror.js', '--slug', slug]);
  if (parallelTails) {
    await runParallel('Post-import parallel checks', [
      { label: 'Lint editorial placeholders (source HTML)', cmd: 'node', args: ['scripts/lint-editorial-placeholders.js', '--slug', slug] },
      { label: 'Lint editorial placeholders (_site HTML)', cmd: 'node', args: ['scripts/lint-editorial-placeholders.js', '--file', path.join('_site', `${slug}.html`)] },
      { label: 'NEWS integrity', cmd: 'node', args: ['scripts/news-integrity-check.js'] },
    ]);
  } else {
    run('Lint editorial placeholders (source HTML)', 'node', ['scripts/lint-editorial-placeholders.js', '--slug', slug]);
    run('Lint editorial placeholders (_site HTML)', 'node', ['scripts/lint-editorial-placeholders.js', '--file', path.join('_site', `${slug}.html`)]);
    run('NEWS integrity', 'node', ['scripts/news-integrity-check.js']);
  }
  run('Predeploy gate (slug)', 'node', ['scripts/predeploy-gate.js', '--slug', slug]);
  registerPublishedArticle(slug);

  console.log('\n[PASS] Article pipeline completed.');
  return { workingCopy };
}

main()
  .then((result) => {
    tempWorkingCopy = result?.workingCopy || '';
    if (tempWorkingCopy) {
      try {
        fs.rmSync(path.dirname(tempWorkingCopy), { recursive: true, force: true });
        console.log('[CLEANUP] Removed temporary working JSON directory.');
      } catch (_err) {
        console.warn('[WARN] Could not remove temporary working JSON directory.');
      }
    }
    runTempCleanup();
  })
  .catch((err) => {
    console.error(`\n[FAIL] ${err.message || err}`);
    if (tempWorkingCopy) {
      try {
        fs.rmSync(path.dirname(tempWorkingCopy), { recursive: true, force: true });
        console.log('[CLEANUP] Removed temporary working JSON directory after failure.');
      } catch (_err) {
        // no-op
      }
    }
    runTempCleanup();
    process.exit(1);
  });
