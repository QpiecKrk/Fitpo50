#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { prepareArticleMedia } = require('./lib/article-media');

function parseArgs(argv) {
  const out = { write: false, 'ensure-variants': false };
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
  out.write = String(out.write).toLowerCase() === 'true';
  out['ensure-variants'] = String(out['ensure-variants']).toLowerCase() === 'true';
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log('Użycie: node scripts/prepare-article-media.js --file <draft.fitpo50.json> --assets-dir <katalog-artykulu> --write true --ensure-variants true');
    return;
  }
  if (!args.file) throw new Error('Brak --file.');
  const file = path.resolve(args.file);
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(file));
  if (!fs.existsSync(file)) throw new Error(`Brak JSON-u: ${file}`);
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = prepareArticleMedia(article, {
    assetsDir,
    mutate: args.write,
    ensureVariants: args['ensure-variants'],
  });
  if (args.write) fs.writeFileSync(file, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
  console.log(`[ARTICLE-MEDIA] directory=${assetsDir}`);
  console.log(`[ARTICLE-MEDIA] images=${result.entries.length} variants_created=${result.created.length}`);
  result.created.forEach((fileName) => console.log(`[ARTICLE-MEDIA] created=${fileName}`));
  result.warnings.forEach((warning) => console.warn(`[WARN] ${warning}`));
  if (!result.ok) {
    result.errors.forEach((error) => console.error(`[FAIL] ${error}`));
    process.exitCode = 2;
    return;
  }
  console.log('[PASS] Article media package OK.');
}

try {
  main();
} catch (error) {
  console.error(`[ARTICLE-MEDIA][FAIL] ${error.message || error}`);
  process.exit(1);
}

module.exports = { main, parseArgs };
