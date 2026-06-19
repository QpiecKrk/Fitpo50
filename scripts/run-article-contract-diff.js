#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateArticleContract } = require('./article-contract-check');

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

function changedHtmlFiles() {
  const primary = run('git', ['diff', '--name-status', 'origin/main...HEAD']);
  const out = primary.status === 0 ? primary.stdout : run('git', ['diff', '--name-status', 'HEAD~1..HEAD']).stdout;
  const files = String(out || '')
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
    .filter((f) => isArticleHtml(f));
  return [...new Set(files)];
}

function originMainRaw(file) {
  const res = run('git', ['show', `origin/main:${file}`]);
  if (res.status !== 0) return null;
  return res.stdout;
}

function validateRaw(raw, file) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-contract-'));
  const tmpFile = path.join(tmpDir, path.basename(file));
  try {
    fs.writeFileSync(tmpFile, raw, 'utf8');
    return validateArticleContract(tmpFile);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
    const newErrors = newErrorsOnly(current.errors, previous.errors);
    const legacyErrors = unchangedLegacyErrors(current.errors, previous.errors);

    current.warnings.forEach((warning) => console.log(`⚠ ${file}: ${warning}`));

    if (newErrors.length) {
      console.log(`✖ ${file}`);
      newErrors.forEach((error) => console.log(`  - ${error}`));
      if (legacyErrors.length) {
        console.log(`  - Pominięto stare błędy bez zmian: ${legacyErrors.length}.`);
      }
      fail = true;
    } else if (legacyErrors.length) {
      console.log(`⚠ ${file}: stare błędy kontraktu bez nowych naruszeń (${legacyErrors.length})`);
    } else {
      console.log(`✔ ${file}`);
    }
  }

  if (fail) process.exit(1);
}

main();
