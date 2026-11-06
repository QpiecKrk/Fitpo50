#!/usr/bin/env node

'use strict';

const fs = require('fs');
const crypto = require('crypto');
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
const { atomicWriteFileSync } = require('./lib/atomic-file');
const { articleOperationInHead } = require('./lib/article-publication-state');
const { createManagedTempDir, disposeTempWorkspace } = require('./lib/temp-workspace');
const { MAX_REPAIR_ATTEMPTS, readAttemptState, recordRepairFailure } = require('./lib/article-repair-attempts');
const { packageIdentity } = require('./lib/package-identity');
const { auditPackage, printReport: printPackageAuditReport } = require('./package-audit');

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

function earlyEvidenceAudit(source, args, runCommand = run) {
  const workspace = createManagedTempDir({
    prefix: 'fitpo50-early-evidence-',
    type: 'article-json-workbench',
    projectRoot: ROOT,
  });
  const copy = path.join(workspace, path.basename(source));
  fs.copyFileSync(source, copy);
  try {
    const commandArgs = [
      'scripts/verify-article-evidence.js', '--file', copy,
      '--write', 'true', '--refresh', 'true',
      '--cache-file', path.join(workspace, 'evidence-cache.json'),
    ];
    if (args['http-fixture']) commandArgs.push('--http-fixture', path.resolve(args['http-fixture']));
    const result = runCommand('node', commandArgs);
    if (result?.status === 0 && fs.existsSync(copy)) result.verifiedJson = fs.readFileSync(copy, 'utf8');
    return result;
  } finally {
    disposeTempWorkspace(workspace, { status: 'COMPLETED' });
  }
}

function auditMessages(packageReport, evidenceResult) {
  const messages = Object.values(packageReport.by_owner || {}).flatMap((items) => (items || [])
    .filter((item) => item && item.message)
    .map((item) => ({ key: String(item.message), display: `${item.path || '/'}: ${item.message}` })));
  const evidence = `${evidenceResult?.stdout || ''}\n${evidenceResult?.stderr || ''}`
    .split('\n').map((line) => line.trim()).filter((line) => line.startsWith('- '))
    .map((line) => ({ key: line.slice(2), display: line.slice(2) }));
  const unique = new Map();
  for (const item of [...messages, ...evidence]) if (!unique.has(item.key)) unique.set(item.key, item.display);
  return [...unique.values()];
}

function packageAuditAsDryRunReport(report) {
  const diagnostics = Object.entries(report.by_owner || {}).flatMap(([owner, items]) => (items || []).map((item) => ({
    path: item.path || '/',
    class: owner === 'CODEX' ? 'FIXABLE_LOCAL' : 'REQUIRES_WRITER',
    type: owner === 'CODEX' ? 'FIXABLE_LOCAL' : 'REQUIRES_WRITER',
    owner,
    error_code: item.code,
    severity: 'ERROR',
    message: item.message,
    fix: item.fix,
    ...(item.proposed_change ? { proposed_change: item.proposed_change } : {}),
    ...(item.illustrator_prompt ? { illustrator_prompt: item.illustrator_prompt } : {}),
  })));
  return {
    version: 1,
    status: report.status === 'ENVIRONMENT_FAILURE' ? 'ENVIRONMENT_FAILURE' : 'BLOCKED',
    input_sha256: report.package_sha256,
    package_audit_report: report.report_file,
    diagnostics,
    blocked_dependencies: report.blocked_dependencies || [],
    warnings: report.warnings || [],
    proposed_changes: report.proposed_changes || [],
    mandatory_visual_review: report.mandatory_visual_review,
    summary: { errors: diagnostics.length, warnings: (report.warnings || []).length },
  };
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
  const sourceArticle = readJson(source);
  const currentSourcePackage = packageIdentity(source, sourceAssetsDir, sourceArticle);
  if (!inspected.report.source_package_sha256 || inspected.report.source_package_sha256 !== currentSourcePackage.hash) return false;
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

function publishPrepared({ preparedFile, assetsDir, force, parallelTails, allowOverwriteSeoPatches, runCommand }) {
  const publishArgs = ['scripts/article-pipeline.js', '--file', preparedFile, '--assets-dir', assetsDir, '--force', force ? 'true' : 'false'];
  if (allowOverwriteSeoPatches) publishArgs.push('--allow-overwrite-seo-patches');
  if (parallelTails !== undefined) publishArgs.push('--parallel-tails', parallelTails ? 'true' : 'false');
  const result = runCommand('node', publishArgs, { stdio: 'inherit' });
  ensureSuccessfulStart(result, 'Publikację artykułu');
  return Number(result.status);
}

function executeArticleAddCore(args, dependencies = {}) {
  const root = dependencies.root || ROOT;
  const runCommand = dependencies.runCommand || run;
  if (args.help || args.h) {
    console.log('Użycie: npm run article:add -- --file <draft.fitpo50.json> [--assets-dir <katalog>] [--dry-run] [--json] [--force true] [--allow-overwrite-seo-patches] [--status true]');
    return EXIT_CODES.SUCCESS;
  }
  if (!args.file) throw contentBlocked('Podaj --file <draft.fitpo50.json>.');
  const source = path.resolve(args.file);
  if (!fs.existsSync(source)) throw contentBlocked(`Brak pliku: ${source}`);
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(source));
  const sourcePreparedAtStart = inspectPreparedArtifact(source, root);

  if (boolOpt(args.status, false)) {
    const statusSlug = detectSlug(source);
    const state = readStatus(root, statusSlug);
    console.log(state ? JSON.stringify(state, null, 2) : `[ARTICLE-ADD] Brak zapisanego stanu dla ${statusSlug}.`);
    return EXIT_CODES.SUCCESS;
  }

  const runAudit = dependencies.auditPackage || auditPackage;
  const auditSource = sourcePreparedAtStart.ok ? path.resolve(String(sourcePreparedAtStart.report.source_file || '')) : source;
  if (!auditSource || !fs.existsSync(auditSource)) {
    throw environmentFailure('Nie można wykonać obowiązkowego package:audit: pakiet CONTENT_READY nie ma zachowanego źródłowego draftu.');
  }
  const auditAssetsDir = sourcePreparedAtStart.ok ? path.dirname(auditSource) : assetsDir;
  const auditReport = runAudit({ file: auditSource, 'assets-dir': auditAssetsDir }, dependencies.packageAuditDependencies || {});
  const evidenceResult = dependencies.auditEvidence
    ? dependencies.auditEvidence(auditSource, args)
    : (dependencies.runCommand ? { status: 0, stdout: '', stderr: '' } : earlyEvidenceAudit(auditSource, args));
  const combinedAuditMessages = auditMessages(auditReport, evidenceResult);
  if (!boolOpt(args.json, false)) (dependencies.printPackageAuditReport || printPackageAuditReport)(auditReport);
  if (auditReport.exit_code !== EXIT_CODES.SUCCESS || evidenceResult.status !== 0) {
    if (!boolOpt(args.json, false) && combinedAuditMessages.length) {
      console.error(`[ARTICLE-ADD][EARLY_JSON_AUDIT] ${combinedAuditMessages.length} błędów przed mediami i renderami:`);
      combinedAuditMessages.forEach((message) => console.error(`- ${message}`));
    }
    if (boolOpt(args.json, false)) console.log(JSON.stringify(packageAuditAsDryRunReport(auditReport), null, 2));
    else console.error(`[ARTICLE-ADD][PACKAGE_AUDIT_BLOCKED] Etap mediów i renderów nie został uruchomiony. Raport: ${auditReport.report_file}`);
    if (auditReport.exit_code === EXIT_CODES.ENVIRONMENT_FAILURE
      || (auditReport.exit_code === EXIT_CODES.SUCCESS && evidenceResult.status === EXIT_CODES.ENVIRONMENT_FAILURE)) {
      return EXIT_CODES.ENVIRONMENT_FAILURE;
    }
    return EXIT_CODES.CONTENT_BLOCKED;
  }

  const slug = detectSlug(source);
  const context = {
    root,
    slug,
    source,
    sourceSha256: sha256File(source),
    force: boolOpt(args.force, false),
    allowOverwriteSeoPatches: boolOpt(args['allow-overwrite-seo-patches'], false),
    parallelTails: args['parallel-tails'] === undefined ? undefined : boolOpt(args['parallel-tails'], true),
  };

  if (boolOpt(args['dry-run'], false)) {
    const dryArgs = ['scripts/article-dry-run.js', '--file', source, '--assets-dir', assetsDir];
    if (boolOpt(args.json, false)) dryArgs.push('--json');
    if (args['http-fixture']) dryArgs.push('--http-fixture', path.resolve(args['http-fixture']));
    if (context.allowOverwriteSeoPatches) dryArgs.push('--allow-overwrite-seo-patches');
    const result = runCommand('node', dryArgs, { stdio: 'inherit' });
    ensureSuccessfulStart(result, 'Dry-run artykułu');
    return Number(result.status);
  }

  const sourcePrepared = sourcePreparedAtStart;
  const sourceArticle = readJson(source);
  const prompts = Array.isArray(sourceArticle.image_prompts_v4)
    ? sourceArticle.image_prompts_v4
    : (Array.isArray(sourceArticle.image_prompts) ? sourceArticle.image_prompts : []);
  const operationForSlug = dependencies.articleOperationInHead || articleOperationInHead;
  const operation = prompts.length || sourceArticle?.media_manifest
    ? operationForSlug(root, slug)
    : 'CREATE';
  if (operation === 'CREATE' && sourceArticle?.media_manifest?.version === 2) {
    throw contentBlocked('Nowy slug nie może wejść z legacy media_manifest.version=2; wymagany jest nowy review AVIF/WebP/JPG i manifest v3.');
  }
  let preparedFile = sourcePrepared.ok ? source : expectedPreparedPath(source, args['output-dir']);
  if (sourcePrepared.ok) {
    console.log('[ARTICLE-ADD] Faza 1/3: wejście jest niezmienionym pakietem CONTENT_READY — pomijam ponowne przygotowanie.');
  } else if (packageHashesMatch(source, assetsDir, preparedFile)) {
    console.log('[ARTICLE-ADD] Faza 1/3: REUSED — JSON i obrazy nie zmieniły się od ostatniego CONTENT_READY.');
  } else {
    console.log('[ARTICLE-ADD] Faza 1/3: treść, źródła, FAQ, intencja, linki i media.');
    const prepareArgs = ['scripts/article-json-workbench.js', '--file', source, '--assets-dir', assetsDir, '--force', context.force ? 'true' : 'false'];
    let evidenceWorkspace = '';
    if (evidenceResult.verifiedJson) {
      evidenceWorkspace = createManagedTempDir({ prefix: 'fitpo50-evidence-proof-', type: 'article-json-workbench', projectRoot: root, slug });
      const preverifiedFile = path.join(evidenceWorkspace, `${slug}.fitpo50.json`);
      atomicWriteFileSync(preverifiedFile, evidenceResult.verifiedJson, 'utf8');
      prepareArgs.push('--preverified-file', preverifiedFile);
    }
    if (args['output-dir']) prepareArgs.push('--output-dir', path.resolve(args['output-dir']));
    if (args['keep-revisions']) prepareArgs.push('--keep-revisions', args['keep-revisions']);
    let prepared;
    try {
      prepared = runCommand('node', prepareArgs);
    } finally {
      if (evidenceWorkspace) disposeTempWorkspace(evidenceWorkspace, { status: prepared?.status === 0 ? 'COMPLETED' : 'FAILED' });
    }
    printChildOutput(prepared);
    ensureSuccessfulStart(prepared, 'Przygotowanie JSON-u');
    if (prepared.status !== 0) {
      const isContentFailure = prepared.status === EXIT_CODES.CONTENT_BLOCKED || prepared.status === 2;
      const failureStatus = isContentFailure ? 'CONTENT_BLOCKED' : 'ENVIRONMENT_FAILURE';
      writePipelineStatus(root, slug, failureStatus, {
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
  console.log('[ARTICLE-ADD] Faza 3/3: techniczna kontrola HTML/PDF i lokalne domknięcie bez ręcznego review.');
  const status = publishPrepared({
    preparedFile,
    assetsDir: path.dirname(preparedFile),
    force: context.force,
    parallelTails: context.parallelTails,
    allowOverwriteSeoPatches: context.allowOverwriteSeoPatches,
    runCommand,
  });
  return status;
}

function repairAttemptIdentity(args, root) {
  if (args.help || args.h || boolOpt(args['dry-run'], false) || boolOpt(args.status, false) || !args.file) return null;
  const source = path.resolve(args.file);
  if (!fs.existsSync(source)) return null;
  try {
    const pipelineHash = crypto.createHash('sha256');
    for (const relative of [
      'scripts/article-add.js',
      'scripts/article-json-workbench.js',
      'scripts/article-pipeline.js',
      'scripts/lib/article-media.js',
    ]) {
      const file = path.join(root, relative);
      if (fs.existsSync(file)) pipelineHash.update(relative).update(fs.readFileSync(file));
    }
    return { root, slug: detectSlug(source), draftHash: sha256File(source), pipelineHash: pipelineHash.digest('hex') };
  } catch (_error) {
    return null;
  }
}

function executeArticleAdd(args, dependencies = {}) {
  const root = dependencies.root || ROOT;
  const identity = repairAttemptIdentity(args, root);
  if (identity) {
    const attempts = readAttemptState(identity.root, identity.slug, identity.draftHash, identity.pipelineHash);
    if (attempts.repair_attempts >= MAX_REPAIR_ATTEMPTS) {
      throw contentBlocked(`Przekroczono limit ${MAX_REPAIR_ATTEMPTS} prób automatycznej naprawy dla tej wersji draftu. Zmiana JSON-u albo kodu automatycznie rozpocznie nowy licznik.`);
    }
  }

  try {
    const status = executeArticleAddCore(args, dependencies);
    if (identity && status === EXIT_CODES.CONTENT_BLOCKED) {
      recordRepairFailure(identity.root, identity.slug, identity.draftHash, { stage: 'article:add' }, identity.pipelineHash);
    }
    return status;
  } catch (error) {
    if (identity && classifyPipelineFailure(error).exitCode === EXIT_CODES.CONTENT_BLOCKED) {
      recordRepairFailure(identity.root, identity.slug, identity.draftHash, { stage: 'article:add' }, identity.pipelineHash);
    }
    throw error;
  }
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
      writePipelineStatus(ROOT, slug, failure.status, {
        next_action: failure.nextAction,
        error_code: failure.code,
        error: String(error.message || error),
      });
    }
    process.exitCode = failure.exitCode;
  }
}

if (require.main === module) main();

module.exports = {
  auditMessages,
  boolOpt,
  executeArticleAdd,
  executeArticleAddCore,
  earlyEvidenceAudit,
  expectedPreparedPath,
  packageHashesMatch,
  packageAuditAsDryRunReport,
  parseArgs,
  preparedPathFromOutput,
};
