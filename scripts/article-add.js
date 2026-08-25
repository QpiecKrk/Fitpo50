#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { inspectPreparedArtifact, safeSlug, sha256File } = require('./lib/article-json-artifact');

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

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    ...options,
  });
}

function preparedPathFromOutput(output) {
  const match = String(output || '').match(/^\[ARTICLE-JSON\] JSON: (.+)$/m);
  return match ? match[1].trim() : '';
}

function expectedPreparedPath(source, outputDir = '') {
  try {
    const draft = JSON.parse(fs.readFileSync(source, 'utf8'));
    const fallback = path.basename(source).replace(/\.fitpo50\.json$/i, '').replace(/\.json$/i, '');
    const slug = safeSlug(draft.slug || fallback);
    if (!slug) return '';
    return outputDir
      ? path.join(path.resolve(outputDir), `${slug}.fitpo50.json`)
      : path.join(os.homedir(), 'Downloads', 'fitpo50-json-ready', slug, `${slug}.fitpo50.json`);
  } catch (_error) {
    return '';
  }
}

function packageHashesMatch(source, sourceAssetsDir, preparedFile) {
  if (!preparedFile || !fs.existsSync(preparedFile)) return false;
  const inspected = inspectPreparedArtifact(preparedFile, process.cwd());
  if (!inspected.ok || path.resolve(inspected.report.source_file || '') !== path.resolve(source)) return false;
  if (inspected.report.source_sha256 !== sha256File(source)) return false;
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log('Użycie: npm run article:add -- --file <draft.fitpo50.json> [--assets-dir <katalog>] [--force true]');
    return;
  }
  if (!args.file) {
    console.error('Użycie: node scripts/article-add.js --file <draft.fitpo50.json> [--assets-dir <katalog>] [--force true]');
    process.exit(1);
  }
  const source = path.resolve(args.file);
  if (!fs.existsSync(source)) throw new Error(`Brak pliku: ${source}`);
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(source));
  const prepareArgs = ['scripts/article-json-workbench.js', '--file', source, '--assets-dir', assetsDir];
  if (args['output-dir']) prepareArgs.push('--output-dir', path.resolve(args['output-dir']));
  if (args.force) prepareArgs.push('--force', args.force);

  let preparedFile = expectedPreparedPath(source, args['output-dir']);
  if (packageHashesMatch(source, assetsDir, preparedFile)) {
    console.log('[ARTICLE-ADD] Faza 1/2: REUSED — JSON i obrazy nie zmieniły się od ostatniego CONTENT_READY.');
  } else {
    console.log('[ARTICLE-ADD] Faza 1/2: szybkie przygotowanie i kompletna kontrola pakietu.');
    const prepared = run('node', prepareArgs);
    if (prepared.stdout) process.stdout.write(prepared.stdout);
    if (prepared.stderr) process.stderr.write(prepared.stderr);
    if (prepared.status !== 0) {
      console.error('[ARTICLE-ADD] STOP: atom publikacyjny nie został uruchomiony. Popraw zachowany pakiet BLOCKED i ponów tę samą komendę.');
      process.exit(Number(prepared.status || 1));
    }
    preparedFile = preparedPathFromOutput(prepared.stdout);
  }
  if (!preparedFile || !fs.existsSync(preparedFile)) throw new Error('Nie udało się odczytać ścieżki artefaktu CONTENT_READY.');

  console.log('[ARTICLE-ADD] Faza 2/2: jeden atom HTML + obrazy + PDF + listingi + sitemap + _site.');
  const publishArgs = ['scripts/article-pipeline.js', '--file', preparedFile, '--assets-dir', path.dirname(preparedFile)];
  if (args.force) publishArgs.push('--force', args.force);
  const published = run('node', publishArgs, { stdio: 'inherit', encoding: undefined });
  if (published.error) throw published.error;
  if (published.status === null) throw new Error(`Atom publikacyjny został przerwany sygnałem ${published.signal || 'UNKNOWN'}.`);
  process.exit(Number(published.status || 0));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[ARTICLE-ADD][FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { expectedPreparedPath, main, packageHashesMatch, parseArgs, preparedPathFromOutput };
