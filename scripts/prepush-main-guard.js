#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertPreparedPublicationState, publicFingerprint } = require('./prepare-deployment-marker');
const { checkNewsFallbackSync } = require('./news-deploy-sync-gate');
const { NewsPullError } = require('./news-pull');

const MAIN_REF = 'refs/heads/main';
const ZERO_SHA = /^0{40,64}$/;

class PrepushMainGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PrepushMainGuardError';
    this.exitCode = 1;
  }
}

function normalizedLines(lines) {
  const values = Array.isArray(lines) ? lines : String(lines || '').split(/\r?\n/);
  return values.map((line) => String(line || '').trim()).filter(Boolean);
}

function parsePushLine(line) {
  const parts = line.split(/\s+/);
  if (parts.length !== 4) {
    throw new PrepushMainGuardError(`Nieprawidłowy rekord pre-push: oczekiwano 4 pól, otrzymano ${parts.length}.`);
  }
  const [localRef, localSha, remoteRef, remoteSha] = parts;
  return { localRef, localSha, remoteRef, remoteSha };
}

function evaluatePushRefs({
  lines,
  head,
  readMarker,
  assertState,
  publicFingerprintOk,
  newsCheck,
  isMainDeleteAllowed = false,
}) {
  const refs = normalizedLines(lines).map(parsePushLine);
  const mainRefs = refs.filter((ref) => ref.remoteRef === MAIN_REF);
  if (mainRefs.length === 0) {
    return { code: 0, reason: 'NON_MAIN_PUSH', checkedMainRefs: 0 };
  }

  if (!isMainDeleteAllowed && mainRefs.some((ref) => ZERO_SHA.test(ref.localSha))) {
    throw new PrepushMainGuardError('Usunięcie zdalnej gałęzi main jest zabronione przez lokalną bramkę pre-push.');
  }

  const mismatched = mainRefs.find((ref) => ref.localSha !== head);
  if (mismatched) {
    throw new PrepushMainGuardError(`Push do main musi wskazywać aktualny HEAD (${head}); otrzymano ${mismatched.localSha}.`);
  }

  let marker;
  try {
    marker = readMarker(head);
  } catch (error) {
    throw new PrepushMainGuardError(`Brak prawidłowego deployment.json w wysyłanym commicie: ${error.message || error}`);
  }
  if (!marker || typeof marker !== 'object') {
    throw new PrepushMainGuardError('Brak prawidłowego deployment.json w wysyłanym commicie.');
  }

  assertState(marker);
  if (!publicFingerprintOk(marker)) {
    throw new PrepushMainGuardError(
      'PUBLIC_FINGERPRINT_STALE: publiczny eksport _site nie zgadza się z deployment.json. Uruchom ponownie prepush:local i deployment:prepare.',
    );
  }
  newsCheck();

  return { code: 0, reason: 'MAIN_GUARD_PASS', checkedMainRefs: mainRefs.length };
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new PrepushMainGuardError(`Polecenie git ${args.join(' ')} nie powiodło się${detail ? `: ${detail}` : '.'}`);
  }
  return String(result.stdout || '').trim();
}

function readMarkerFromCommit(root, sha) {
  const raw = runGit(root, ['show', `${sha}:deployment.json`]);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new PrepushMainGuardError(`deployment.json ma nieprawidłowy JSON: ${error.message}`);
  }
}

function main() {
  const root = runGit(process.cwd(), ['rev-parse', '--show-toplevel']);
  const head = runGit(root, ['rev-parse', 'HEAD']);
  const lines = fs.readFileSync(0, 'utf8');
  const result = evaluatePushRefs({
    lines,
    head,
    readMarker: (sha) => readMarkerFromCommit(root, sha),
    assertState: (marker) => assertPreparedPublicationState(root, marker),
    publicFingerprintOk: (marker) => (
      marker.public_fingerprint_sha256 === publicFingerprint(path.join(root, '_site'))
    ),
    newsCheck: () => checkNewsFallbackSync({ root }),
    isMainDeleteAllowed: false,
  });
  console.log(`[PREPUSH:MAIN][PASS] ${result.reason}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const exitCode = error instanceof NewsPullError ? error.exitCode : 1;
    console.error(`[PREPUSH:MAIN][FAIL][${exitCode}] ${error.message || error}`);
    if (Array.isArray(error.details)) error.details.forEach((detail) => console.error(`- ${detail}`));
    process.exitCode = exitCode;
  }
}

module.exports = {
  MAIN_REF,
  PrepushMainGuardError,
  evaluatePushRefs,
  parsePushLine,
  readMarkerFromCommit,
};
