#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { cleanupPreparedArtifact, safeSlug } = require('./lib/article-json-artifact');
const { contentBlocked, environmentFailure, statusPath } = require('./lib/article-pipeline-status');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (!token.startsWith('--')) continue;
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[token.slice(2)] = true;
    else { out[token.slice(2)] = next; index += 1; }
  }
  return out;
}

function readJson(file, label) {
  if (!fs.existsSync(file)) throw contentBlocked(`${label}: brak pliku ${file}.`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw environmentFailure(`${label}: nie można odczytać JSON (${error.message || error}).`); }
}

function writeJsonAtomic(file, payload) {
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function assertLiveConfirmation(root, slug) {
  const live = readJson(path.join(root, 'data', 'reports', 'local', 'deployment-live-status.json'), 'Potwierdzenie live');
  const marker = readJson(path.join(root, 'deployment.json'), 'Marker wdrożenia');
  if (live.status !== 'LIVE_DEPLOYED_AND_VALIDATED') throw contentBlocked(`Brak LIVE_DEPLOYED_AND_VALIDATED dla ${slug}.`);
  if (!live.release_id || live.release_id !== marker.release_id) throw contentBlocked('Raport live nie odpowiada bieżącemu markerowi wdrożenia.');
  const article = (Array.isArray(marker.articles) ? marker.articles : []).find((item) => item?.slug === slug);
  if (!article?.url) throw contentBlocked(`Bieżący marker nie potwierdza artykułu ${slug}.`);
  const liveCheck = (Array.isArray(live.checks) ? live.checks : []).find((item) => item?.type === 'ARTICLE' && item?.url === article.url && item?.pass === true);
  if (!liveCheck) throw contentBlocked(`Raport live nie zawiera pozytywnej kontroli ARTICLE dla ${slug}.`);
  return { live, marker, article };
}

function cleanupArticleInput({ root = ROOT, slug, cleanup = cleanupPreparedArtifact }) {
  const normalizedSlug = safeSlug(slug);
  if (!normalizedSlug || normalizedSlug !== slug) throw contentBlocked('Podaj bezpieczny, dokładny --slug.');
  const pipelineStatusFile = statusPath(root, normalizedSlug);
  const state = readJson(pipelineStatusFile, 'Stan article:add');
  const pending = state?.input_cleanup;
  if (pending?.status !== 'AWAITING_LIVE_CONFIRMATION' || !pending?.path) {
    throw contentBlocked(`${normalizedSlug}: brak stanu input_cleanup=AWAITING_LIVE_CONFIRMATION.`);
  }
  assertLiveConfirmation(root, normalizedSlug);
  const inputPath = path.resolve(String(pending.path));
  if (!new RegExp(`^${normalizedSlug}(?:-r\\d+)?\\.fitpo50\\.json$`, 'i').test(path.basename(inputPath))) {
    throw contentBlocked(`Stan cleanup wskazuje plik spoza sluga ${normalizedSlug}: ${inputPath}`);
  }
  const result = cleanup(inputPath);
  if (result.retained?.length) throw environmentFailure(`Nie udało się usunąć całej paczki: ${result.retained.map((item) => `${item.path} (${item.code})`).join(', ')}`);
  if (!(result.removed?.length || result.removed_directories?.length)) throw environmentFailure(`Nie usunięto żadnego pliku wejściowego dla ${normalizedSlug}.`);
  const now = new Date().toISOString();
  const updated = {
    ...state,
    updated_at: now,
    input_cleanup: {
      status: 'CLEANED_AFTER_LIVE_CONFIRMATION',
      path: inputPath,
      cleaned_at: now,
      removed: result.removed || [],
      removed_directories: result.removed_directories || [],
    },
  };
  writeJsonAtomic(pipelineStatusFile, updated);
  return updated.input_cleanup;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug) throw contentBlocked('Użycie: npm run article:cleanup-input -- --slug <slug>.');
  const result = cleanupArticleInput({ slug: String(args.slug) });
  console.log(`[ARTICLE_INPUT_CLEANED] ${args.slug}: ${JSON.stringify(result)}`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(`[ARTICLE_INPUT_CLEANUP_BLOCKED] ${error.message || error}`);
    process.exitCode = error?.pipelineStatus === 'CONTENT_BLOCKED' ? 20 : 30;
  }
}

module.exports = { assertLiveConfirmation, cleanupArticleInput, parseArgs };
