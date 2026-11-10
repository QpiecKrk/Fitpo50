#!/usr/bin/env node

/**
 * Legacy compatibility wrapper.
 *
 * Cel: utrzymać istniejące entrypointy (`article:guard`, `article:guard:diff`)
 * bez duplikowania logiki walidacji HTML.
 *
 * Zasada:
 * - wykrywamy zmienione artykuły (source HTML),
 * - walidujemy je przez `validate-article-standard.js` (source + _site mirror),
 * - brak własnych, równoległych reguł.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pageKind } = require('./lib/publication-page-kind');
const { assertReleaseFiles } = require('./lib/change-scope');
const crypto = require('crypto');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = { changed: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--changed') {
      out.changed.push(String(argv[i + 1] || '').trim());
      i += 1;
    }
  }
  return out;
}

function normalize(rel) {
  return String(rel || '').replace(/^\.?\//, '');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function isArticleHtml(rel) {
  if (rel.includes('/')) return false;
  const base = path.basename(rel);
  if (base === 'article-template-bento.html') return false;
  if (!rel.endsWith('.html')) return false;
  if (!exists(rel)) return false;
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return pageKind(html) !== 'unsupported';
}

function detectChangedArticles(changedPaths) {
  const set = new Set();
  for (const raw of changedPaths) {
    const rel = normalize(raw);
    const sourceRel = rel.startsWith('_site/') ? rel.slice('_site/'.length) : rel;
    if (isArticleHtml(sourceRel)) set.add(sourceRel);
  }
  return [...set].sort();
}

function runValidator(files) {
  const res = spawnSync('node', ['scripts/validate-article-standard.js', '--profile', 'auto', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return Number(res.status || 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const staged = process.argv.includes('--staged');
  if (staged) {
    const diff = spawnSync('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], { cwd: ROOT, encoding: 'utf8' });
    if (diff.status !== 0) throw new Error('Nie można odczytać indeksu Git.');
    args.changed = diff.stdout.split('\0').filter(Boolean);
    const hashes = new Map();
    for (const file of args.changed) {
      const blob = spawnSync('git', ['show', `:${file}`], { cwd: ROOT, encoding: null, maxBuffer: 100 * 1024 * 1024 });
      const hash = blob.status === 0 ? crypto.createHash('sha256').update(blob.stdout).digest('hex') : null;
      const local = fs.existsSync(path.join(ROOT, file)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex') : null;
      if (hash !== local) throw new Error(`Staged różni się od kopii roboczej: ${file}. Hook nie sprawdzi innej zawartości.`);
      hashes.set(file, hash);
    }
    require('./publish-article').assertSafeChanges(args.changed.map((file) => ({ file, code: hashes.get(file) === null ? 'D' : 'M' })));
    if (args.changed.some((file) => ['deployment.json', '_site/deployment.json'].includes(file))) {
      const read = (file) => spawnSync('git', ['show', `:${file}`], { cwd: ROOT, encoding: 'utf8' });
      const source = read('deployment.json');
      const mirror = read('_site/deployment.json');
      if (source.status !== 0 || mirror.status !== 0 || source.stdout !== mirror.stdout) throw new Error('Niezgodne markery staged.');
      assertReleaseFiles(JSON.parse(source.stdout), args.changed, (file) => hashes.get(file));
    }
  }
  if (require('./lib/article-staging').reusableArticleChecks(ROOT, args.changed)) {
    console.log('[REUSED] Article publish guard: aktualny wynik stagingu, zgodne dane, kod i konfiguracja.');
    return;
  }
  const changedArticles = detectChangedArticles(args.changed);
  if (!changedArticles.length) {
    console.log('[PASS] Article publish guard wrapper: brak zmienionych plikow artykulow.');
    return;
  }

  const targets = [];
  for (const rel of changedArticles) {
    targets.push(rel);
    const mirror = `_site/${rel}`;
    if (exists(mirror) && args.changed.includes(mirror)) targets.push(mirror);
  }

  const status = runValidator(targets);
  if (status !== 0) {
    console.log('\n[FAIL] Article publish guard wrapper');
    process.exit(status);
  }
  console.log(`\n[PASS] Article publish guard wrapper OK (artykuly: ${changedArticles.length}).`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`[PRECOMMIT][FAIL] ${error.message}`); process.exitCode = 1; }
}
