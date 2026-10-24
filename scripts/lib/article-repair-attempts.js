'use strict';

const fs = require('node:fs');
const { atomicWriteFileSync } = require('./atomic-file');
const path = require('node:path');
const { warsawIso } = require('./time');

const MAX_REPAIR_ATTEMPTS = 2;

function attemptStatePath(root, slug) {
  return path.join(root, 'data', 'reports', 'local', 'article-pipeline', `${slug}.attempts.json`);
}

function readAttemptState(root, slug, draftHash) {
  try {
    const state = JSON.parse(fs.readFileSync(attemptStatePath(root, slug), 'utf8'));
    if (state.draft_sha256 === draftHash) return state;
  } catch (_error) {
    // Nowy slug albo nowy hash zaczyna od zera.
  }
  return { version: 1, slug, draft_sha256: draftHash, repair_attempts: 0, history: [] };
}

function writeAttemptState(root, state) {
  const file = attemptStatePath(root, state.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  atomicWriteFileSync(temporary, `${JSON.stringify({ ...state, updated_at: warsawIso() }, null, 2)}\n`);
  fs.renameSync(temporary, file);
  return file;
}

function recordRepairFailure(root, slug, draftHash, details = {}) {
  const state = readAttemptState(root, slug, draftHash);
  state.repair_attempts += 1;
  state.history.push({ at: warsawIso(), result: 'CONTENT_BLOCKED', ...details });
  writeAttemptState(root, state);
  return state;
}

function resetSameDraft(root, slug, draftHash) {
  const state = { version: 1, slug, draft_sha256: draftHash, repair_attempts: 0, history: [{ at: warsawIso(), result: 'EXPLICIT_RESTART' }] };
  writeAttemptState(root, state);
  return state;
}

module.exports = { MAX_REPAIR_ATTEMPTS, attemptStatePath, readAttemptState, recordRepairFailure, resetSameDraft, writeAttemptState };
