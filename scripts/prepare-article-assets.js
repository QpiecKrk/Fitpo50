#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { prepareArticleMedia } = require('./lib/article-media');

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

function copyExact(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file ? path.resolve(args.file) : '';
  if (!file || !fs.existsSync(file)) {
    console.error('Użycie: node scripts/prepare-article-assets.js --file <path.fitpo50.json> [--from <katalog-artykulu>]');
    process.exit(1);
  }
  const assetsDir = path.resolve(args.from || path.dirname(file));
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = prepareArticleMedia(article, { assetsDir, mutate: false, ensureVariants: false });
  if (!result.ok) {
    result.errors.forEach((error) => console.error(`[FAIL] ${error}`));
    process.exit(1);
  }

  for (const entry of result.manifest.entries) {
    for (const variant of Object.values(entry.variants)) {
      const source = path.join(assetsDir, variant.file);
      copyExact(source, path.join(ROOT, 'assets', variant.file));
      if (fs.existsSync(path.join(ROOT, '_site'))) copyExact(source, path.join(ROOT, '_site', 'assets', variant.file));
      console.log(`[OK] ${entry.placement}: ${variant.file}`);
    }
  }
  console.log('[PASS] prepare-article-assets: skopiowano wyłącznie warianty zatwierdzone w manifeście.');
}

try {
  main();
} catch (error) {
  console.error(`[FAIL] prepare-article-assets: ${error.message || error}`);
  process.exit(1);
}

module.exports = { main, parseArgs };
