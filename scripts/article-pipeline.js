#!/usr/bin/env node

const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  cleanupPreparedArtifact,
  inspectPreparedArtifact,
  reportPathForJson,
  safeSlug,
  sha256File,
} = require('./lib/article-json-artifact');
const {
  beginPromotionTransaction,
  createStagingWorkspace,
  promotionCandidates,
  recoverInterruptedTransactions,
  runInStaging,
  runPreviewGate,
  snapshotCandidates,
  validatePublicationSet,
  writePublicationManifest,
} = require('./lib/article-staging');
const {
  defaultGscInputDir,
  preparePublicationMonitoring,
} = require('./lib/post-publication-monitor');
const { submitIndexNow } = require('./import-article');

let tempWorkingCopy = '';
let transactionalOuter = false;
const TIMINGS_PATH = process.env.FITPO50_PIPELINE_TIMINGS_PATH
  ? path.resolve(process.env.FITPO50_PIPELINE_TIMINGS_PATH)
  : path.join(process.cwd(), 'data', 'reports', 'local', 'pipeline-timings.json');
const stepTimings = [];

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
  const started = Date.now();
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  stepTimings.push({ tag: label, durationMs: Date.now() - started });
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
      const started = Date.now();
      const child = spawn(job.cmd, job.args, { stdio: 'inherit' });
      child.on('error', (err) => {
        reject(new Error(`${job.label} failed to start: ${err.message || err}`));
      });
      child.on('exit', (code) => {
        stepTimings.push({ tag: job.label, durationMs: Date.now() - started });
        if (code !== 0) {
          reject(new Error(`${job.label} failed (exit ${code ?? 'unknown'})`));
          return;
        }
        resolve();
      });
    })),
  );
}

function appendTimingReport(scope, steps) {
  try {
    const nowIso = new Date().toISOString();
    const totalMs = steps.reduce((acc, s) => acc + Number(s.durationMs || 0), 0);
    const payload = fs.existsSync(TIMINGS_PATH)
      ? JSON.parse(fs.readFileSync(TIMINGS_PATH, 'utf8'))
      : { version: 1, updated_at: nowIso, records: [] };
    const records = Array.isArray(payload.records) ? payload.records : [];
    records.push({
      scope,
      at: nowIso,
      total_ms: totalMs,
      steps,
    });
    payload.records = records.slice(-120);
    payload.updated_at = nowIso;
    fs.mkdirSync(path.dirname(TIMINGS_PATH), { recursive: true });
    fs.writeFileSync(TIMINGS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch (_err) {
    // best effort
  }
}

function runTempCleanup() {
  const res = spawnSync('node', ['scripts/tmp-cleanup.js'], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.warn('[WARN] tmp-cleanup exited with non-zero status.');
  }
}

function verifyMirrorPair(root, sourceRelative, mirrorRelative) {
  const source = path.join(root, sourceRelative);
  const mirror = path.join(root, mirrorRelative);
  if (!fs.existsSync(source) || !fs.existsSync(mirror)) {
    throw new Error(`Brak pary source/_site: ${sourceRelative} <-> ${mirrorRelative}`);
  }
  if (sha256File(source) !== sha256File(mirror)) {
    throw new Error(`Niespójna para source/_site: ${sourceRelative} <-> ${mirrorRelative}`);
  }
}

function runPostPromotionValidation(root, slug, article) {
  run('Post-promotion article standard', 'node', ['scripts/validate-article-standard.js', `${slug}.html`]);
  run('Post-promotion article contract', 'node', ['scripts/article-contract-check.js', `${slug}.html`, path.join('_site', `${slug}.html`)]);
  run('Post-promotion mirror check', 'node', ['scripts/sync-site-assets-mirror.js', '--check', '--slug', slug]);
  run('Post-promotion predeploy gate', 'node', ['scripts/predeploy-gate.js', '--slug', slug]);
  verifyMirrorPair(root, `${slug}.html`, path.join('_site', `${slug}.html`));
  verifyMirrorPair(root, path.join('assets', 'pdf', `${slug}.pdf`), path.join('_site', 'assets', 'pdf', `${slug}.pdf`));
  verifyMirrorPair(root, 'llms-full.txt', path.join('_site', 'llms-full.txt'));
  verifyMirrorPair(root, path.join('assets', 'data', 'search-index.json'), path.join('_site', 'assets', 'data', 'search-index.json'));
  validatePublicationSet(root, article, { requireManifest: true });
}

async function submitIndexNowAfterPromotion(slug, enabled) {
  if (!enabled) return 'wyłączone';
  const key = String(process.env.INDEXNOW_KEY || '').trim();
  if (!key) return 'pominięto (brak INDEXNOW_KEY)';
  const result = await submitIndexNow({
    host: 'fitpo50.pl',
    key,
    keyLocation: String(process.env.INDEXNOW_KEY_LOCATION || '').trim() || undefined,
    urlList: [`https://fitpo50.pl/${slug}.html`],
  });
  return result.ok ? `OK (${result.status || 200})` : `błąd (${result.status || result.error || 'network'})`;
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

function ensureImportCopy(sourcePath, slug, preparedReport) {
  const importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-import-'));
  const target = path.join(importDir, `${safeSlug(slug)}.fitpo50.json`);
  fs.copyFileSync(sourcePath, target);
  fs.writeFileSync(reportPathForJson(target), `${JSON.stringify({
    ...preparedReport,
    output_file: target,
    output_sha256: sha256File(target),
    pipeline_working_copy: true,
  }, null, 2)}\n`, 'utf8');
  return target;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.log('Usage: node scripts/article-pipeline.js --file <CONTENT_READY.fitpo50.json> [--category ciekawe] [--force true|false]');
    process.exit(1);
  }
  const stagingInternal = boolOpt(args['staging-internal'], false);
  transactionalOuter = !stagingInternal;
  if (stagingInternal && process.env.FITPO50_STAGING_INTERNAL !== '1') {
    throw new Error('--staging-internal jest prywatnym trybem pipeline i nie może być uruchamiany bez kontrolera stagingu.');
  }

  const root = process.cwd();
  const input = path.resolve(root, args.file);
  if (!fs.existsSync(input)) throw new Error(`Nie znaleziono pliku: ${input}`);
  const prepared = inspectPreparedArtifact(input, root);
  if (!prepared.ok) {
    throw new Error(`Publikacja wymaga niezmienionego artefaktu CONTENT_READY:\n- ${prepared.errors.join('\n- ')}\nNajpierw uruchom article:prepare-json.`);
  }
  const parsedInput = parseJsonWithDiagnostics(input);

  const category = args.category ? String(args.category) : '';
  const force = boolOpt(args.force, false);
  const parallelTails = boolOpt(args['parallel-tails'], true);
  const assetsDir = args['assets-dir'] ? path.resolve(root, args['assets-dir']) : path.dirname(input);
  const slug = detectSlug(parsedInput, input);
  if (!stagingInternal) {
    const recovered = recoverInterruptedTransactions(root);
    recovered.forEach((transactionId) => console.log(`[RECOVERY] Cofnięto przerwaną publikację: ${transactionId}`));
    const liveArticleExists = fs.existsSync(path.join(root, `${slug}.html`));
    if (liveArticleExists && !force) {
      throw new Error(`Slug ${slug} już istnieje. Aktualizacja wymaga jawnego --force true.`);
    }
    const operation = liveArticleExists ? 'UPDATE' : 'CREATE';
    const transactionId = `article-${slug}-${Date.now()}-${process.pid}`;
    const candidates = promotionCandidates(parsedInput);
    const baseline = snapshotCandidates(root, candidates);
    const stageRoot = createStagingWorkspace(root, slug);
    console.log(`[STAGING] Izolowany katalog: ${stageRoot}`);
    console.log(`[PUBLICATION] Tryb ${operation}; transakcja ${transactionId}.`);
    try {
      runInStaging(stageRoot, [...process.argv.slice(2), '--file', input, '--assets-dir', assetsDir]);
      runPreviewGate(stageRoot, slug);
      const monitoring = preparePublicationMonitoring({
        stageRoot,
        article: parsedInput,
        operation,
        transactionId,
        gscInputDir: defaultGscInputDir(),
      });
      console.log(`[GSC AFTER PUBLICATION] Baseline: ${monitoring.item.baseline.status}; URL-i źródłowe: ${monitoring.queueItem.source_urls.length}.`);
      validatePublicationSet(stageRoot, parsedInput);
      const manifest = writePublicationManifest({
        stageRoot,
        article: parsedInput,
        candidates,
        baseline,
        transactionId,
      });
      console.log(`[MANIFEST] ${manifest.relative}: ${manifest.payload.operation}, ${manifest.payload.files_count} plików.`);
      const transaction = beginPromotionTransaction({ sourceRoot: root, stageRoot, candidates, baseline, transactionId });
      try {
        runPostPromotionValidation(root, slug, parsedInput);
        transaction.verify();
        transaction.commit();
      } catch (error) {
        transaction.rollback(error.message || error);
        throw new Error(`Publikacja cofnięta po błędzie walidacji: ${error.message || error}`);
      }
      const indexNowStatus = await submitIndexNowAfterPromotion(slug, boolOpt(args.indexnow, true));
      console.log(`[INDEXNOW] ${indexNowStatus} — wysyłka dopiero po PREVIEW_READY i promocji.`);
      const artifactCleanup = cleanupPreparedArtifact(input);
      artifactCleanup.removed.forEach((file) => console.log(`[CLEANUP] Usunięto opublikowany artefakt JSON: ${file}`));
      artifactCleanup.removed_directories.forEach((directory) => console.log(`[CLEANUP] Usunięto wykorzystany pakiet roboczy JSON i mediów: ${directory}`));
      console.log(`[PUBLISHED] ${operation}: zatwierdzono atomowo ${transaction.changed.length} plików po PREVIEW_READY i walidacji repo.`);
      appendTimingReport('article-pipeline-transactional', stepTimings);
      return { workingCopy: '', artifactCleanup };
    } finally {
      fs.rmSync(stageRoot, { recursive: true, force: true });
      console.log('[CLEANUP] Usunięto izolowany staging.');
    }
  }
  if (prepared.html_exists && !force) {
    throw new Error(`Slug ${prepared.slug} już istnieje jako ${prepared.html_path}. Publikacja zatrzymana (force=false).`);
  }
  const workingCopy = ensureImportCopy(input, slug, prepared.report);
  tempWorkingCopy = workingCopy;
  console.log(`[INFO] Source JSON: ${input}`);
  console.log(`[INFO] Working copy JSON: ${workingCopy}`);
  console.log(`[INFO] Source assets dir: ${assetsDir}`);

  const common = ['scripts/import-article.js', '--file', workingCopy, '--faq-strict', 'true'];
  if (category) common.push('--category', category);

  run('CONTENT_READY integrity gate', 'node', ['scripts/json-fitpo50-gate-diff.js', '--file', workingCopy]);
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
  run('Sync social title + BreadcrumbList (source/_site)', 'node', ['scripts/sync-article-title-breadcrumb.js', '--slug', slug]);
  run('Sync meta description across head/schema', 'node', ['scripts/sync-article-head-descriptions.js', '--slug', slug]);
  run('Generate search index (source/_site)', 'node', ['scripts/generate-search-index.js', '--output', path.join('_site', 'assets', 'data', 'search-index.json')]);
  run('Generate llms-full (source/_site)', 'node', ['scripts/generate-llms-full.js', '--output', path.join('_site', 'llms-full.txt')]);
  run('Article contract check (source/_site)', 'node', ['scripts/article-contract-check.js', `${slug}.html`, path.join('_site', `${slug}.html`)]);
  run('Sync assets mirror (_site)', 'node', ['scripts/sync-site-assets-mirror.js', '--slug', slug]);
  run('Global link topology report', 'node', ['scripts/global-link-topology-optimizer.js', '--min-inbound', '2']);
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
  console.log('\n[PREVIEW BUILD PASS] Wewnętrzny pipeline stagingowy zakończony; repozytorium publiczne nie zostało zmienione.');
  appendTimingReport('article-pipeline-staging-internal', stepTimings);
  return { workingCopy, artifactCleanup: null };
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
    if (!transactionalOuter) appendTimingReport('article-pipeline-fail', stepTimings);
    if (tempWorkingCopy) {
      try {
        fs.rmSync(path.dirname(tempWorkingCopy), { recursive: true, force: true });
        console.log('[CLEANUP] Removed temporary working JSON directory after failure.');
      } catch (_err) {
        // no-op
      }
    }
    if (!transactionalOuter) runTempCleanup();
    process.exit(1);
  });
