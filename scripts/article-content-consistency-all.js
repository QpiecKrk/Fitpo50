#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pageKind } = require('./lib/publication-page-kind');

const ROOT = process.cwd();
const CHECKER = path.join(ROOT, 'scripts', 'article-content-consistency.py');

function articleFiles() {
  return fs.readdirSync(ROOT)
    .filter((file) => file.endsWith('.html'))
    .filter((file) => file !== 'article-template-bento.html')
    .filter((file) => {
      const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return pageKind(raw) === 'article';
    })
    .sort();
}

function checkFile(file) {
  const result = spawnSync('python3', [CHECKER, path.join(ROOT, file)], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return [`${file}: walidator nie uruchomił się: ${(result.stderr || result.stdout || '').trim()}`];
  }
  try {
    const payload = JSON.parse(result.stdout || '{}');
    return (payload.errors || []).map((error) => `${file}: ${error}`);
  } catch (error) {
    return [`${file}: niepoprawna odpowiedź walidatora (${error.message || error}).`];
  }
}

function main() {
  const errors = articleFiles().flatMap(checkFile);
  if (errors.length) {
    console.error(`[FAIL] article-content-consistency-all — ${errors.length} niezgodności.`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log('[PASS] article-content-consistency-all — cały katalog artykułów jest zgodny.');
}

main();
