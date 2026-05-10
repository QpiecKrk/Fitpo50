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
  const base = path.basename(rel);
  if (base === 'article-template-bento.html') return false;
  if (!rel.endsWith('.html')) return false;
  if (!exists(rel)) return false;
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return /<article\s+class="article-content">/i.test(html);
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
  const res = spawnSync('node', ['scripts/validate-article-standard.js', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return Number(res.status || 0);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const changedArticles = detectChangedArticles(args.changed);
  if (!changedArticles.length) {
    console.log('[PASS] Article publish guard wrapper: brak zmienionych plikow artykulow.');
    return;
  }

  const targets = [];
  for (const rel of changedArticles) {
    targets.push(rel);
    const mirror = `_site/${rel}`;
    if (exists(mirror)) targets.push(mirror);
  }

  const status = runValidator(targets);
  if (status !== 0) {
    console.log('\n[FAIL] Article publish guard wrapper');
    process.exit(status);
  }
  console.log(`\n[PASS] Article publish guard wrapper OK (artykuly: ${changedArticles.length}).`);
}

main();
