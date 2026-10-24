#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectArticlePackage } = require('./article-package-intake');
const { createManagedTempDir, disposeTempWorkspace } = require('./lib/temp-workspace');
const { sha256File } = require('./lib/article-json-artifact');
const { EXIT_CODES } = require('./lib/article-pipeline-status');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (token === '--json') out.json = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (!next || String(next).startsWith('--')) out[key] = 'true';
      else { out[key] = next; index += 1; }
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

function inferJsonPath(message) {
  const text = String(message || '');
  const indexed = text.match(/\b(sections|sources|evidence_claims|answer_blocks|faq_research|image_prompts_v4|image_prompts|key_takeaways)\[(\d+)\](?:\.([a-zA-Z0-9_]+))?/);
  if (indexed) return `/${indexed[1]}/${indexed[2]}${indexed[3] ? `/${indexed[3]}` : ''}`;
  const named = text.match(/\b(slug|title|seo_title|meta_description|category|lead|quick_answer|search_intent|primary_keyword|supporting_keywords|sources|evidence_claims|answer_blocks|faq_research|image_prompts_v4|sections|media_manifest)\b/);
  return named ? `/${named[1]}` : '/';
}

function diagnostic(type, owner, rule, message, pathValue) {
  const errorClass = type === 'REQUIRES_WRITER' ? 'REQUIRES_WRITER' : 'FIXABLE_LOCAL';
  return {
    path: pathValue || inferJsonPath(message),
    class: errorClass,
    type: errorClass,
    owner,
    rule,
    error_code: rule,
    severity: 'ERROR',
    message: String(message || ''),
    suggestion: errorClass === 'FIXABLE_LOCAL' ? 'Pipeline może wykonać deterministyczną korektę.' : `Poprawkę musi dostarczyć ${owner}.`,
  };
}

function normalizeGateDiagnostic(item) {
  const severity = item?.severity === 'WARNING' ? 'WARNING' : 'ERROR';
  const errorClass = item?.type === 'FIXABLE_LOCAL' || severity === 'WARNING' ? 'FIXABLE_LOCAL' : 'REQUIRES_WRITER';
  return {
    ...item,
    path: item?.path && item.path !== '/' ? item.path : inferJsonPath(item?.message),
    class: errorClass,
    type: errorClass,
    owner: item?.owner || (errorClass === 'REQUIRES_WRITER' ? 'WRITER' : 'PIPELINE'),
    error_code: item?.error_code || item?.rule || 'RULE_JSON_GATE',
    severity,
  };
}

function uniqueDiagnostics(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.severity}|${item.path}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseGateJson(result) {
  try { return JSON.parse(String(result.stdout || '').trim()); } catch (_error) { return null; }
}

function validateInput(file, assetsDir, dependencies = {}) {
  const diagnostics = [];
  let article;
  try { article = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { return [diagnostic('REQUIRES_WRITER', 'WRITER', 'RULE_JSON_PARSE', error.message || error)]; }

  const intake = inspectArticlePackage(article, assetsDir);
  intake.issues.WRITER_FIX_REQUIRED.forEach((message) => diagnostics.push(diagnostic('REQUIRES_WRITER', 'WRITER', 'RULE_PACKAGE_WRITER', message)));
  intake.issues.ILLUSTRATOR_FIX_REQUIRED.forEach((message) => diagnostics.push(diagnostic('REQUIRES_WRITER', 'ILLUSTRATOR', 'RULE_PACKAGE_MEDIA', message)));

  const spawn = dependencies.spawnSync || spawnSync;
  const writer = spawn('python3', ['docs/skills/fitpo50-article-draft/scripts/validate_fitpo50_draft.py', '--allow-verified-review', file], { cwd: ROOT, encoding: 'utf8' });
  if (writer.error || writer.signal || writer.status === null || writer.status === undefined) {
    diagnostics.push(diagnostic('FIXABLE_LOCAL', 'ENVIRONMENT', 'RULE_ENVIRONMENT', `Walidator Pythona nie uruchomił się${writer.signal ? ` (sygnał ${writer.signal})` : ''}: ${writer.error?.message || 'brak kodu wyjścia'}.`));
    return uniqueDiagnostics(diagnostics);
  }
  String(`${writer.stdout || ''}\n${writer.stderr || ''}`).split('\n').filter((line) => line.startsWith('[FAIL] ') && !/errors=\d+/.test(line)).forEach((line) => {
    diagnostics.push(diagnostic('REQUIRES_WRITER', 'WRITER', 'RULE_DRAFT_CONTRACT', line.slice(7)));
  });

  if (writer.status !== 0 && !String(`${writer.stdout || ''}\n${writer.stderr || ''}`).includes('[FAIL] ')) {
    diagnostics.push(diagnostic('FIXABLE_LOCAL', 'ENVIRONMENT', 'RULE_ENVIRONMENT', `Walidator Pythona zakończył się kodem ${writer.status} bez diagnostyki treści.`));
    return uniqueDiagnostics(diagnostics);
  }
  const gate = spawn('node', ['scripts/json-fitpo50-gate-diff.js', '--file', file, '--phase', 'draft', '--json'], { cwd: ROOT, encoding: 'utf8' });
  const gateReport = parseGateJson(gate);
  if (gateReport?.diagnostics) diagnostics.push(...gateReport.diagnostics.map(normalizeGateDiagnostic));
  else if (gate.status !== 0) diagnostics.push(diagnostic('FIXABLE_LOCAL', 'PIPELINE', 'RULE_GATE_EXECUTION', String(gate.stderr || gate.stdout || 'json gate failed')));
  return uniqueDiagnostics(diagnostics);
}

function runDryRun(args, dependencies = {}) {
  if (!args.file) throw new Error('Użycie: article:add --dry-run --file <draft.fitpo50.json> [--assets-dir <katalog>] [--json]');
  const file = path.resolve(args.file);
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(file));
  const inputHash = fs.existsSync(file) ? sha256File(file) : '';
  if (!fs.existsSync(file)) return { version: 1, status: 'BLOCKED', input_sha256: inputHash, diagnostics: [diagnostic('REQUIRES_WRITER', 'WRITER', 'RULE_FILE_MISSING', `Brak pliku: ${file}`)], summary: { errors: 1, warnings: 0 } };
  const diagnostics = dependencies.validateInput ? dependencies.validateInput(file, assetsDir) : validateInput(file, assetsDir, dependencies);
  const blocking = diagnostics.filter((item) => item.severity === 'ERROR');
  if (blocking.length) {
    const environment = blocking.some((item) => item.owner === 'ENVIRONMENT' || item.rule === 'RULE_ENVIRONMENT');
    return { version: 1, status: environment ? 'ENVIRONMENT_FAILURE' : 'BLOCKED', input_sha256: inputHash, diagnostics, summary: { errors: blocking.length, warnings: diagnostics.length - blocking.length } };
  }

  const spawn = dependencies.spawnSync || spawnSync;
  const workspace = (dependencies.createWorkspace || createManagedTempDir)({ prefix: 'fitpo50-article-dry-run-', type: 'article-dry-run', projectRoot: ROOT });
  let keep = false;
  try {
    const outputDir = path.join(workspace, 'ready');
    const workbenchArgs = ['scripts/article-json-workbench.js', '--file', file, '--assets-dir', assetsDir, '--output-dir', outputDir, '--cache-file', path.join(workspace, 'evidence-cache.json'), '--force', 'true'];
    if (args['http-fixture']) workbenchArgs.push('--http-fixture', path.resolve(args['http-fixture']));
    const workbench = spawn('node', workbenchArgs, { cwd: ROOT, encoding: 'utf8' });
    if (workbench.status !== 0) {
      diagnostics.push(diagnostic(workbench.status === 30 ? 'FIXABLE_LOCAL' : 'REQUIRES_WRITER', workbench.status === 30 ? 'ENVIRONMENT' : 'WRITER', workbench.status === 30 ? 'RULE_ENVIRONMENT' : 'RULE_WORKBENCH', String(workbench.stderr || workbench.stdout || 'workbench failed')));
      return { version: 1, status: workbench.status === 30 ? 'ENVIRONMENT_FAILURE' : 'BLOCKED', input_sha256: inputHash, diagnostics, summary: { errors: diagnostics.length, warnings: 0 } };
    }
    const prepared = String(workbench.stdout || '').match(/^\[ARTICLE-JSON\] JSON: (.+)$/m)?.[1]?.trim();
    if (!prepared) throw new Error('WorkBench nie zwrócił ścieżki CONTENT_READY.');
    const pipelineArgs = ['scripts/article-pipeline.js', '--file', prepared, '--assets-dir', path.dirname(prepared), '--force', 'true', '--dry-run', 'true'];
    if (boolOpt(args['allow-overwrite-seo-patches'], false)) pipelineArgs.push('--allow-overwrite-seo-patches');
    const pipeline = spawn('node', pipelineArgs, { cwd: ROOT, encoding: 'utf8' });
    const stageRoot = String(`${pipeline.stdout || ''}\n${pipeline.stderr || ''}`).match(/^\[AWAITING_VISUAL_REVIEW\] (.+)$/m)?.[1]?.trim() || '';
    if (pipeline.status === 10 && stageRoot) {
      keep = true;
      return { version: 1, status: 'AWAITING_REVIEW', input_sha256: inputHash, diagnostics, artifacts: { stage_root: stageRoot, desktop: path.join(stageRoot, '.tmp', 'article-preview', path.basename(prepared).replace(/\.fitpo50\.json$/i, ''), 'desktop.png'), mobile: path.join(stageRoot, '.tmp', 'article-preview', path.basename(prepared).replace(/\.fitpo50\.json$/i, ''), 'mobile.png'), pdf_pages: path.join(stageRoot, '.tmp', 'article-preview', path.basename(prepared).replace(/\.fitpo50\.json$/i, ''), 'pdf-pages') }, summary: { errors: 0, warnings: diagnostics.length } };
    }
    diagnostics.push(diagnostic('FIXABLE_LOCAL', pipeline.status === 30 ? 'ENVIRONMENT' : 'PIPELINE', pipeline.status === 30 ? 'RULE_ENVIRONMENT' : 'RULE_STAGING', String(pipeline.stderr || pipeline.stdout || 'staging failed')));
    return { version: 1, status: pipeline.status === 30 ? 'ENVIRONMENT_FAILURE' : 'BLOCKED', input_sha256: inputHash, diagnostics, summary: { errors: diagnostics.length, warnings: 0 } };
  } finally {
    if (!keep) (dependencies.disposeWorkspace || disposeTempWorkspace)(workspace, { status: 'COMPLETED' });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = runDryRun(args);
  console.log(JSON.stringify(report, null, args.json ? 0 : 2));
  process.exitCode = exitCodeForReport(report);
}

function exitCodeForReport(report) {
  if (report?.status === 'PASS' || report?.status === 'READY') return EXIT_CODES.SUCCESS;
  if (report?.status === 'AWAITING_REVIEW') return EXIT_CODES.AWAITING_REVIEW;
  if (report?.status === 'ENVIRONMENT_FAILURE') return EXIT_CODES.ENVIRONMENT_FAILURE;
  return EXIT_CODES.CONTENT_BLOCKED;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`[ARTICLE-DRY-RUN][FAIL] ${error.message || error}`); process.exitCode = 30; }
}

module.exports = { boolOpt, diagnostic, exitCodeForReport, inferJsonPath, parseArgs, runDryRun, validateInput };
