#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const path = require('path');
const { validateArticleContract } = require('./article-contract-check');
const { createManagedTempDir, disposeTempWorkspace } = require('./lib/temp-workspace');

const MUST_FIX_ON_TOUCH = [
  /^Niespójny tytuł: <title> \(bez "\| FitPo50"\) != (?:og:title|twitter:title)\.$/,
  /^(?:og:image|twitter:image) powinno wskazywać plik \.jpg \(kompatybilność social scraperów\)\.$/,
];

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function isArticleHtml(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  const base = normalized.split('/').pop();
  if (base === 'article-template-bento.html') return false;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return /<body[^>]*class="[^"]*\barticle-template\b/i.test(raw);
  } catch (_err) {
    return false;
  }
}

function changedArticleFilesFromNameStatus(output, { isArticle = isArticleHtml } = {}) {
  const files = String(output || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = String(parts[0] || '');
      const file = status.startsWith('R') || status.startsWith('C') ? parts[2] : parts[1];
      return { status, file };
    })
    .filter((x) => x.file && !String(x.status).startsWith('D'))
    .map((x) => x.file)
    .filter((f) => f.endsWith('.html') && !f.startsWith('admin/'))
    .filter((f) => isArticle(f));
  return [...new Set(files)];
}

function changedHtmlFiles() {
  const primary = run('git', ['diff', '--name-status', 'origin/main...HEAD']);
  const out = primary.status === 0 ? primary.stdout : run('git', ['diff', '--name-status', 'HEAD~1..HEAD']).stdout;
  return changedArticleFilesFromNameStatus(out);
}

function originMainRaw(file) {
  const res = run('git', ['show', `origin/main:${file}`]);
  if (res.status !== 0) return null;
  return res.stdout;
}

function validateRaw(raw, file) {
  const tmpDir = createManagedTempDir({ prefix: 'fitpo50-contract-', type: 'article-contract-fixture', projectRoot: process.cwd() });
  const tmpFile = path.join(tmpDir, path.basename(file));
  try {
    atomicWriteFileSync(tmpFile, raw, 'utf8');
    return validateArticleContract(tmpFile);
  } finally {
    try {
      disposeTempWorkspace(tmpDir, { status: 'COMPLETED' });
    } catch (_err) {
      // Temp cleanup failure should not hide the actual contract result.
    }
  }
}

function unchangedLegacyErrors(currentErrors, previousErrors) {
  const previous = new Set(previousErrors);
  return currentErrors.filter((error) => previous.has(error));
}

function newErrorsOnly(currentErrors, previousErrors) {
  const previous = new Set(previousErrors);
  return currentErrors.filter((error) => !previous.has(error));
}

function mustFixOnTouchErrors(currentErrors) {
  return currentErrors.filter((error) => MUST_FIX_ON_TOUCH.some((rx) => rx.test(error)));
}

function mustFixOnTouchWarnings(currentWarnings) {
  return currentWarnings.filter((warning) => MUST_FIX_ON_TOUCH.some((rx) => rx.test(warning)));
}

function classifyContractResult(current, previous) {
  const preExistingErrors = unchangedLegacyErrors(current.errors, previous.errors);
  const newErrors = newErrorsOnly(current.errors, previous.errors);
  const blockingErrors = [...new Set([
    ...current.errors,
    ...mustFixOnTouchWarnings(current.warnings),
  ])];
  return { blockingErrors, newErrors, preExistingErrors };
}

function main() {
  const files = changedHtmlFiles();
  if (!files.length) {
    console.log('[SKIP] article-contract-diff: brak zmienionych plików HTML.');
    return;
  }

  let fail = false;
  for (const file of files) {
    const current = validateArticleContract(file);
    const previousRaw = originMainRaw(file);
    const previous = previousRaw ? validateRaw(previousRaw, file) : { errors: [], warnings: [] };
    const { blockingErrors: reportableErrors, preExistingErrors: legacyErrors } = classifyContractResult(current, previous);
    const reportable = new Set(reportableErrors);

    current.warnings
      .filter((warning) => !reportable.has(warning))
      .forEach((warning) => console.log(`⚠ ${file}: ${warning}`));

    if (reportableErrors.length) {
      console.log(`✖ ${file}`);
      reportableErrors.forEach((error) => console.log(`  - ${error}`));
      if (legacyErrors.length) {
        console.log(`  - Już obecne w origin/main (informacja, nadal blokują): ${legacyErrors.length}.`);
      }
      fail = true;
    } else {
      console.log(`✔ ${file}`);
    }
  }

  if (fail) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  changedArticleFilesFromNameStatus,
  classifyContractResult,
};
