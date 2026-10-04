#!/usr/bin/env node

const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
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
  createManagedTempDir,
  disposeTempWorkspace,
  markTempWorkspace,
  reactivateTempWorkspace,
  readWorkspaceManifest,
  resolveWorkspaceProjectRoot,
} = require('./lib/temp-workspace');
const { capabilityFromEnvironment } = require('./lib/pipeline-capability');
const {
  defaultGscInputDir,
  preparePublicationMonitoring,
} = require('./lib/post-publication-monitor');
const { submitIndexNow } = require('./lib/indexnow-client');
const { validatePreviewReport } = require('./lib/article-preview-report');

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
  const res = spawnSync('node', ['scripts/tmp-cleanup.js', '--dry-run'], { stdio: 'inherit' });
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
  const key = String(process.env.INDEXNOW_KEY || '').trim();
  const result = await submitIndexNow({
    host: 'fitpo50.pl',
    key,
    keyLocation: String(process.env.INDEXNOW_KEY_LOCATION || '').trim() || undefined,
    urlList: [`https://fitpo50.pl/${slug}.html`],
    enabled,
  });
  const evidenceDir = path.join(process.cwd(), 'data', 'reports', 'local', 'indexnow');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, `${slug}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return `${result.status} (${result.http_status || result.reason})`;
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
  const importDir = createManagedTempDir({
    prefix: 'fitpo50-import-',
    type: 'article-import-working-copy',
    projectRoot: resolveWorkspaceProjectRoot(),
    slug,
  });
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

function articleStageRecordPath(stageRoot) {
  return path.join(stageRoot, 'article-stage.json');
}

function isReviewMutableCandidate(relative, slug) {
  return relative === `data/reports/article-preview/${slug}.json`
    || relative === `data/reports/article-preview/${slug}.md`;
}

function candidateHashes(stageRoot, candidates, slug) {
  return Object.fromEntries(candidates
    .filter((relative) => !isReviewMutableCandidate(relative, slug))
    .filter((relative) => fs.existsSync(path.join(stageRoot, relative)))
    .map((relative) => [relative, sha256File(path.join(stageRoot, relative))]));
}

function writeArticleStageRecord({ stageRoot, sourceRoot, slug, input, candidates, baseline, transactionId, operation }) {
  const payload = {
    version: 1,
    source_root: sourceRoot,
    slug,
    input_file: input,
    input_sha256: sha256File(input),
    candidates,
    baseline: [...baseline],
    static_hashes: candidateHashes(stageRoot, candidates, slug),
    transaction_id: transactionId,
    operation,
    status: 'AWAITING_VISUAL_REVIEW',
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(articleStageRecordPath(stageRoot), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function readArticleStageRecord(stageRoot, sourceRoot, slug, input) {
  const workspace = readWorkspaceManifest(stageRoot);
  if (!workspace || workspace.workspace_type !== 'article-publication-staging' || path.resolve(workspace.project_root) !== path.resolve(sourceRoot)) {
    throw new Error('Wskazany katalog nie jest zarządzanym stagingiem publikacji tego repozytorium.');
  }
  const recordPath = articleStageRecordPath(stageRoot);
  if (!fs.existsSync(recordPath)) throw new Error(`Brak rekordu wznowienia: ${recordPath}`);
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  if (record.source_root !== sourceRoot || record.slug !== slug || record.input_file !== input) throw new Error('Staging należy do innego repozytorium, slugu albo artefaktu wejściowego.');
  if (record.input_sha256 !== sha256File(input)) throw new Error('Artefakt CONTENT_READY zmienił się podczas oczekiwania na review.');
  for (const [relative, hash] of Object.entries(record.static_hashes || {})) {
    const file = path.join(stageRoot, relative);
    if (!fs.existsSync(file) || sha256File(file) !== hash) throw new Error(`Staging zmienił się po kontroli technicznej: ${relative}`);
  }
  const preview = validatePreviewReport(stageRoot, slug, { requireRenderFiles: true });
  if (!preview.ok) throw new Error(`Staging nie ma kompletnego PREVIEW_READY v3:\n- ${preview.errors.join('\n- ')}`);
  return { ...record, preview_timing: preview.report?.timing || {} };
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
  if (stagingInternal) capabilityFromEnvironment('article-pipeline:staging', process.cwd());

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
    let operation = liveArticleExists ? 'UPDATE' : 'CREATE';
    let transactionId = `article-${slug}-${Date.now()}-${process.pid}`;
    let candidates = promotionCandidates(parsedInput);
    let baseline = snapshotCandidates(root, candidates);
    const resumeStage = String(args['promote-stage'] || '').trim();
    const stageRoot = resumeStage ? path.resolve(resumeStage) : createStagingWorkspace(root, slug);
    let stageStatus = 'FAILED';
    let keepForReview = Boolean(resumeStage);
    console.log(`[STAGING] Izolowany katalog: ${stageRoot}`);
    try {
      if (resumeStage) {
        const record = readArticleStageRecord(stageRoot, root, slug, input);
        reactivateTempWorkspace(stageRoot);
        keepForReview = false;
        operation = record.operation;
        transactionId = record.transaction_id;
        candidates = record.candidates;
        baseline = new Map(record.baseline);
        stepTimings.push({ tag: 'Techniczny preview HTML/PDF', durationMs: Number(record.preview_timing?.technical_ms || 0) });
        stepTimings.push({ tag: 'Oczekiwanie na rzeczywisty visual review', durationMs: Number(record.preview_timing?.review_wait_ms || 0) });
        console.log(`[RESUME] PREVIEW_READY v3 potwierdzony; wznawiam transakcję ${transactionId}.`);
      } else {
        console.log(`[PUBLICATION] Tryb ${operation}; transakcja ${transactionId}.`);
        let phaseStarted = Date.now();
        runInStaging(stageRoot, [...process.argv.slice(2), '--file', input, '--assets-dir', assetsDir]);
        stepTimings.push({ tag: 'Izolowany staging: HTML, media, PDF i walidatory', durationMs: Date.now() - phaseStarted });
        phaseStarted = Date.now();
        runPreviewGate(stageRoot, slug);
        stepTimings.push({ tag: 'Render desktop/mobile i kontrola PDF', durationMs: Date.now() - phaseStarted });
        writeArticleStageRecord({ stageRoot, sourceRoot: root, slug, input, candidates, baseline, transactionId, operation });
        markTempWorkspace(stageRoot, 'AWAITING_REVIEW');
        keepForReview = true;
        console.log(`[AWAITING_VISUAL_REVIEW] ${stageRoot}`);
        console.log(`[RESUME_COMMAND] npm run article:publish -- --file "${input}" --assets-dir "${assetsDir}" --force ${force} --promote-stage "${stageRoot}"`);
        appendTimingReport('article-pipeline-awaiting-review', stepTimings);
        return { workingCopy: '', artifactCleanup: null, awaitingReview: true };
      }
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
      artifactCleanup.retained.forEach((item) => console.warn(`[WARN] Opublikowany pakiet roboczy pozostał na dysku (${item.code}): ${item.path}`));
      console.log(`[PUBLISHED] ${operation}: zatwierdzono atomowo ${transaction.changed.length} plików po PREVIEW_READY i walidacji repo.`);
      appendTimingReport('article-pipeline-transactional', stepTimings);
      stageStatus = 'COMPLETED';
      return { workingCopy: '', artifactCleanup };
    } finally {
      if (!keepForReview) {
        disposeTempWorkspace(stageRoot, { status: stageStatus });
        console.log('[CLEANUP] Usunięto izolowany staging.');
      } else {
        console.log('[STAGING RETAINED] Dowody pozostają do rzeczywistego review i wznowienia transakcji.');
      }
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
        disposeTempWorkspace(path.dirname(tempWorkingCopy), { status: 'COMPLETED' });
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
        disposeTempWorkspace(path.dirname(tempWorkingCopy), { status: 'FAILED', error: err.message || err });
        console.log('[CLEANUP] Removed temporary working JSON directory after failure.');
      } catch (_err) {
        // no-op
      }
    }
    if (!transactionalOuter) runTempCleanup();
    process.exit(1);
  });
