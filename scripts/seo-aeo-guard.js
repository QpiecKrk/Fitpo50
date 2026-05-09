#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html')
    .filter((f) => {
      const full = path.join(ROOT, f);
      const html = fs.readFileSync(full, 'utf8');
      return /<article\s+class="article-content">/i.test(html);
    })
    .sort();
}

function main() {
  const files = listArticleFiles();
  if (!files.length) {
    console.log('[PASS] seo-aeo-guard - brak artykułów do walidacji.');
    return;
  }

  const res = spawnSync('node', ['scripts/validate-article-standard.js', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
  console.log(`[PASS] seo-aeo-guard OK (pliki: ${files.length}).`);
}

main();
