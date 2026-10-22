#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { inspectPreparedArtifact, safeSlug, sha256File } = require('./lib/article-json-artifact');
const {
  EXIT_CODES,
  classifyPipelineFailure,
  contentBlocked,
  environmentFailure,
  statusPath,
  writePipelineStatus,
} = require('./lib/article-pipeline-status');
const { validatePreviewReport } = require('./lib/article-preview-report');
const { disposeTempWorkspace, readWorkspaceManifest } = require('./lib/temp-workspace');
const { MAX_REPAIR_ATTEMPTS, readAttemptState, recordRepairFailure, resetSameDraft } = require('./lib/article-repair-attempts');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function boolOpt(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: options.stdio === 'inherit' ? undefined : 'utf8',
    stdio: options.stdio || 'pipe',
  });
}

function preparedPathFromOutput(output) {
  const match = String(output || '').match(/^\[ARTICLE-JSON\] JSON: (.+)$/m);
  return match ? match[1].trim() : '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function detectSlug(file) {
  const draft = readJson(file);
  const fallback = path.basename(file).replace(/\.fitpo50\.json$/i, '').replace(/\.json$/i, '');
  const slug = safeSlug(draft.slug || fallback);
  if (!slug) throw contentBlocked('Brak poprawnego slug w JSON-ie i nazwie pliku.');
  return slug;
}

function expectedPreparedPath(source, outputDir = '') {
  try {
    const slug = detectSlug(source);
    return outputDir
      ? path.join(path.resolve(outputDir), `${slug}.fitpo50.json`)
      : path.join(os.homedir(), 'Downloads', 'fitpo50-json-ready', slug, `${slug}.fitpo50.json`);
  } catch (_error) {
    return '';
  }
}

function packageHashesMatch(source, sourceAssetsDir, preparedFile) {
  if (!preparedFile || !fs.existsSync(preparedFile)) return false;
  const inspected = inspectPreparedArtifact(preparedFile, ROOT);
  if (!inspected.ok || path.resolve(inspected.report.source_file || '') !== path.resolve(source)) return false;
  if (inspected.report.source_sha256 !== sha256File(source)) return false;
  const entries = Array.isArray(inspected.json?.media_manifest?.entries) ? inspected.json.media_manifest.entries : [];
  if (!entries.length) return false;
  for (const entry of entries) {
    const sourceName = String(entry.source_file || '');
    const original = path.join(sourceAssetsDir, sourceName);
    const packaged = path.join(path.dirname(preparedFile), sourceName);
    if (!fs.existsSync(original) || !fs.existsSync(packaged)) return false;
    if (sha256File(original) !== entry.source?.sha256 || sha256File(packaged) !== entry.source?.sha256) return false;
    for (const variant of Object.values(entry.variants || {})) {
      const variantFile = path.join(path.dirname(preparedFile), String(variant?.file || ''));
      if (!variant?.file || !fs.existsSync(variantFile) || sha256File(variantFile) !== variant.sha256) return false;
    }
  }
  return true;
}

function readStatus(root, slug) {
  try {
    return readJson(statusPath(root, slug));
  } catch (_error) {
    return null;
  }
}

function isInside(directory, target) {
  const relative = path.relative(path.resolve(directory), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function reviewArtifacts(stageRoot, slug) {
  return {
    stage_root: stageRoot,
    review_template: path.join(stageRoot, '.tmp', 'article-preview', slug, 'visual-review-template.json'),
    desktop: path.join(stageRoot, '.tmp', 'article-preview', slug, 'desktop.png'),
    mobile: path.join(stageRoot, '.tmp', 'article-preview', slug, 'mobile.png'),
    pdf_pages: path.join(stageRoot, '.tmp', 'article-preview', slug, 'pdf-pages'),
  };
}

function validateAwaitingWorkspace(context, stageRoot, preparedFile) {
  const manifest = readWorkspaceManifest(stageRoot);
  if (!manifest
    || manifest.workspace_type !== 'article-publication-staging'
    || manifest.status !== 'AWAITING_REVIEW'
    || path.resolve(String(manifest.project_root || '')) !== path.resolve(context.root)
    || String(manifest.slug || '') !== context.slug) {
    throw contentBlocked('Zapisany stan nie wskazuje zarządzanego stagingu AWAITING_REVIEW dla tego repozytorium i artykułu.');
  }
  const recordFile = path.join(stageRoot, 'article-stage.json');
  if (!fs.existsSync(recordFile)) throw contentBlocked(`Brak rekordu wznowienia stagingu: ${recordFile}`);
  const record = readJson(recordFile);
  if (path.resolve(String(record.source_root || '')) !== path.resolve(context.root)
    || String(record.slug || '') !== context.slug
    || path.resolve(String(record.input_file || '')) !== path.resolve(preparedFile)) {
    throw contentBlocked('Rekord wznowienia należy do innego repozytorium, slugu albo pakietu CONTENT_READY.');
  }
  if (String(record.input_sha256 || '') !== sha256File(preparedFile)) {
    throw contentBlocked('Pakiet CONTENT_READY zmienił się po utworzeniu stagingu; poprzedniego review nie wolno użyć.');
  }
  return { manifest, record };
}

function printChildOutput(result) {
  if (result?.stdout) process.stdout.write(result.stdout);
  if (result?.stderr) process.stderr.write(result.stderr);
}

function ensureSuccessfulStart(result, label) {
  if (result?.error) throw result.error;
  if (result?.status === null || result?.status === undefined) {
    throw environmentFailure(`${label} przerwano sygnałem ${result?.signal || 'UNKNOWN'}.`);
  }
}

function applyReview({ root, slug, stageRoot, reviewFile, runCommand }) {
  if (!reviewFile) return;
  const sourceReview = path.resolve(reviewFile);
  if (!fs.existsSync(sourceReview)) throw contentBlocked(`Brak pliku review: ${sourceReview}`);
  let managedReview = sourceReview;
  if (!isInside(stageRoot, sourceReview)) {
    managedReview = path.join(stageRoot, '.tmp', 'article-preview', slug, 'visual-review-submitted.json');
    fs.mkdirSync(path.dirname(managedReview), { recursive: true });
    fs.copyFileSync(sourceReview, managedReview);
  }
  const result = runCommand('node', [path.join(root, 'scripts', 'article-preview-gate.js'), '--slug', slug, '--review-file', managedReview], { cwd: stageRoot });
  printChildOutput(result);
  ensureSuccessfulStart(result, 'Zastosowanie visual review');
  if (result.status !== 0) throw contentBlocked(`Visual review nie przeszedł (exit ${result.status}).`);
}

function publishPrepared({ preparedFile, assetsDir, force, parallelTails, stageRoot, runCommand }) {
  const publishArgs = ['scripts/article-pipeline.js', '--file', preparedFile, '--assets-dir', assetsDir, '--force', force ? 'true' : 'false'];
  if (parallelTails !== undefined) publishArgs.push('--parallel-tails', parallelTails ? 'true' : 'false');
  if (stageRoot) publishArgs.push('--promote-stage', stageRoot);
  const result = runCommand('node', publishArgs, { stdio: 'inherit' });
  ensureSuccessfulStart(result, 'Publikację artykułu');
  return Number(result.status);
}

function continueAwaitingReview(context, state, args, runCommand) {
  const next = state?.next_args || {};
  const stageRoot = path.resolve(String(next.stage_root || ''));
  const preparedFile = path.resolve(String(next.input_file || ''));
  if (!String(next.stage_root || '') || !String(next.input_file || '') || !fs.existsSync(stageRoot) || !fs.existsSync(preparedFile)) {
    throw contentBlocked('Zapisany stan AWAITING_REVIEW jest niekompletny; brakuje stagingu albo artefaktu CONTENT_READY.');
  }
  validateAwaitingWorkspace(context, stageRoot, preparedFile);
  const artifacts = reviewArtifacts(stageRoot, context.slug);
  if (args['review-file']) applyReview({ ...context, stageRoot, reviewFile: args['review-file'], runCommand });
  const preview = validatePreviewReport(stageRoot, context.slug, { requireRenderFiles: true });
  if (!preview.ok) {
    writePipelineStatus(context.root, context.slug, 'AWAITING_REVIEW', {
      source_file: context.source,
      source_sha256: context.sourceSha256,
      prepared_file: preparedFile,
      next_action: 'REVIEW_VISUAL_ARTIFACTS',
      next_args: { ...next, stage_root: stageRoot, input_file: preparedFile },
      review_artifacts: artifacts,
    });
    console.log('[ARTICLE-ADD] Artykuł jest technicznie przygotowany. Obejrzyj desktop, mobile, wszystkie obrazy i wszystkie strony PDF, uzupełnij review_template i ponów to samo polecenie z --review-file.');
    return EXIT_CODES.AWAITING_REVIEW;
  }
  console.log('[ARTICLE-ADD] Visual review jest kompletne; wznawiam dokładnie tę samą transakcję.');
  return publishPrepared({
    preparedFile,
    assetsDir: path.resolve(String(next.assets_dir || path.dirname(preparedFile))),
    force: boolOpt(next.force, context.force),
    parallelTails: context.parallelTails,
    stageRoot,
    runCommand,
  });
}

function executeArticleAdd(args, dependencies = {}) {
  const root = dependencies.root || ROOT;
  const runCommand = dependencies.runCommand || run;
  if (args.help || args.h) {
    console.log('Użycie: npm run article:add -- --file <draft.fitpo50.json> [--assets-dir <katalog>] [--dry-run] [--json] [--force true] [--review-file <review.json>] [--status true] [--restart true]');
    return EXIT_CODES.SUCCESS;
  }
  if (!args.file) throw contentBlocked('Podaj --file <draft.fitpo50.json>.');
  const source = path.resolve(args.file);
  if (!fs.existsSync(source)) throw contentBlocked(`Brak pliku: ${source}`);
  const slug = detectSlug(source);
  const context = {
    root,
    slug,
    source,
    sourceSha256: sha256File(source),
    force: boolOpt(args.force, false),
    parallelTails: args['parallel-tails'] === undefined ? undefined : boolOpt(args['parallel-tails'], true),
  };

  if (boolOpt(args['dry-run'], false)) {
    const dryArgs = ['scripts/article-dry-run.js', '--file', source, '--assets-dir', path.resolve(args['assets-dir'] || path.dirname(source))];
    if (boolOpt(args.json, false)) dryArgs.push('--json');
    if (args['http-fixture']) dryArgs.push('--http-fixture', path.resolve(args['http-fixture']));
    const result = runCommand('node', dryArgs, { stdio: 'inherit' });
    ensureSuccessfulStart(result, 'Dry-run artykułu');
    return Number(result.status);
  }

  if (boolOpt(args.status, false)) {
    const state = readStatus(root, slug);
    console.log(state ? JSON.stringify(state, null, 2) : `[ARTICLE-ADD] Brak zapisanego stanu dla ${slug}.`);
    return EXIT_CODES.SUCCESS;
  }

  const state = readStatus(root, slug);
  const hasPendingReview = state?.status === 'AWAITING_REVIEW';
  const samePendingSource = hasPendingReview && state.source_sha256 === context.sourceSha256;
  if (hasPendingReview && boolOpt(args.restart, false)) {
    const stageRoot = String(state?.next_args?.stage_root || '');
    const preparedFile = String(state?.next_args?.input_file || '');
    if (stageRoot && preparedFile && fs.existsSync(stageRoot) && fs.existsSync(preparedFile)) {
      validateAwaitingWorkspace(context, path.resolve(stageRoot), path.resolve(preparedFile));
      disposeTempWorkspace(path.resolve(stageRoot), { status: 'FAILED', error: 'Jawny restart article:add.' });
      console.log('[ARTICLE-ADD] Poprzedni zarządzany staging został bezpiecznie zakończony na jawne --restart true.');
    }
    resetSameDraft(root, slug, context.sourceSha256);
  } else if (samePendingSource) {
    return continueAwaitingReview(context, state, args, runCommand);
  } else if (hasPendingReview) {
    console.error('[ARTICLE-ADD] JSON zmienił się podczas oczekiwania na visual review. Stary staging pozostaje nienaruszony; po świadomej decyzji uruchom z --restart true.');
    return EXIT_CODES.CONTENT_BLOCKED;
  }
  if (boolOpt(args.restart, false) && !hasPendingReview) {
    resetSameDraft(root, slug, context.sourceSha256);
    console.log('[ARTICLE-ADD] Jawny restart wyzerował licznik prób wyłącznie dla tej samej wersji draftu.');
  }
  if (args['review-file'] || boolOpt(args.resume, false)) {
    throw contentBlocked('Nie ma aktywnego stagingu AWAITING_REVIEW dla tej wersji JSON-u. Uruchom zwykłe article:add.');
  }

  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(source));
  const sourcePrepared = inspectPreparedArtifact(source, root);
  let preparedFile = sourcePrepared.ok ? source : expectedPreparedPath(source, args['output-dir']);
  if (sourcePrepared.ok) {
    console.log('[ARTICLE-ADD] Faza 1/3: wejście jest niezmienionym pakietem CONTENT_READY — pomijam ponowne przygotowanie.');
  } else if (packageHashesMatch(source, assetsDir, preparedFile)) {
    console.log('[ARTICLE-ADD] Faza 1/3: REUSED — JSON i obrazy nie zmieniły się od ostatniego CONTENT_READY.');
  } else {
    const attempts = readAttemptState(root, slug, context.sourceSha256);
    if (attempts.repair_attempts >= MAX_REPAIR_ATTEMPTS) {
      throw contentBlocked(`Przekroczono limit ${MAX_REPAIR_ATTEMPTS} prób automatycznej naprawy dla tej wersji draftu. Popraw draft u Pisarza albo użyj jawnego --restart true.`);
    }
    console.log('[ARTICLE-ADD] Faza 1/3: treść, źródła, FAQ, intencja, linki i media.');
    const prepareArgs = ['scripts/article-json-workbench.js', '--file', source, '--assets-dir', assetsDir, '--force', context.force ? 'true' : 'false'];
    if (args['output-dir']) prepareArgs.push('--output-dir', path.resolve(args['output-dir']));
    if (args['keep-revisions']) prepareArgs.push('--keep-revisions', args['keep-revisions']);
    const prepared = runCommand('node', prepareArgs);
    printChildOutput(prepared);
    ensureSuccessfulStart(prepared, 'Przygotowanie JSON-u');
    if (prepared.status !== 0) {
      const isContentFailure = prepared.status === EXIT_CODES.CONTENT_BLOCKED || prepared.status === 2;
      if (isContentFailure) {
        recordRepairFailure(root, slug, context.sourceSha256, { stage: 'article-json-workbench' });
      }
      writePipelineStatus(root, slug, isContentFailure ? 'CONTENT_BLOCKED' : 'ENVIRONMENT_FAILURE', {
        source_file: source,
        source_sha256: context.sourceSha256,
        next_action: isContentFailure ? 'FIX_CONTENT_OR_PACKAGE' : 'FIX_ENVIRONMENT_AND_RETRY',
      });
      return isContentFailure ? EXIT_CODES.CONTENT_BLOCKED : EXIT_CODES.ENVIRONMENT_FAILURE;
    }
    preparedFile = preparedPathFromOutput(prepared.stdout);
  }
  if (!preparedFile || !fs.existsSync(preparedFile)) throw environmentFailure('Nie udało się odczytać ścieżki artefaktu CONTENT_READY.');

  console.log('[ARTICLE-ADD] Faza 2/3: atomowy staging HTML, mediów, PDF, listingów, sitemap i _site.');
  console.log('[ARTICLE-ADD] Faza 3/3 zatrzyma się wyłącznie na rzeczywistą kontrolę desktop/mobile/obrazów/PDF.');
  const status = publishPrepared({
    preparedFile,
    assetsDir: path.dirname(preparedFile),
    force: context.force,
    parallelTails: context.parallelTails,
    runCommand,
  });
  if (status === EXIT_CODES.AWAITING_REVIEW) {
    const pending = readStatus(root, slug) || {};
    const stageRoot = String(pending?.next_args?.stage_root || '');
    writePipelineStatus(root, slug, 'AWAITING_REVIEW', {
      source_file: source,
      source_sha256: context.sourceSha256,
      prepared_file: preparedFile,
      next_action: 'REVIEW_VISUAL_ARTIFACTS',
      next_args: pending.next_args || {},
      review_artifacts: stageRoot ? reviewArtifacts(stageRoot, slug) : {},
    });
  }
  return status;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let slug = '';
  try {
    if (args.file && fs.existsSync(path.resolve(args.file))) slug = detectSlug(path.resolve(args.file));
    process.exitCode = executeArticleAdd(args);
  } catch (error) {
    const failure = classifyPipelineFailure(error);
    console.error(`[ARTICLE-ADD][FAIL] ${error.message || error}`);
    if (slug) {
      const existing = readStatus(ROOT, slug);
      if (existing?.status === 'AWAITING_REVIEW') {
        writePipelineStatus(ROOT, slug, 'AWAITING_REVIEW', {
          source_file: existing.source_file,
          source_sha256: existing.source_sha256,
          prepared_file: existing.prepared_file,
          next_action: 'REVIEW_VISUAL_ARTIFACTS',
          next_args: existing.next_args,
          review_artifacts: existing.review_artifacts,
          review_error: String(error.message || error),
        });
      } else {
        writePipelineStatus(ROOT, slug, failure.status, {
          next_action: failure.nextAction,
          error_code: failure.code,
          error: String(error.message || error),
        });
      }
    }
    process.exitCode = failure.exitCode;
  }
}

if (require.main === module) main();

module.exports = {
  boolOpt,
  continueAwaitingReview,
  executeArticleAdd,
  expectedPreparedPath,
  packageHashesMatch,
  parseArgs,
  preparedPathFromOutput,
  reviewArtifacts,
  validateAwaitingWorkspace,
};
