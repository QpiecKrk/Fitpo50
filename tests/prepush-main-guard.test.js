'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EXIT, NewsPullError } = require('../scripts/news-pull');
const { evaluatePushRefs } = require('../scripts/prepush-main-guard');

const MAIN = 'refs/heads/main';
const ZERO = '0'.repeat(40);
const HEAD = 'a'.repeat(40);
const REMOTE = 'b'.repeat(40);

function line(localRef, localSha, remoteRef, remoteSha = REMOTE) {
  return `${localRef} ${localSha} ${remoteRef} ${remoteSha}`;
}

function forbiddenChecks() {
  const fail = () => { throw new Error('Kontrole main nie powinny zostać uruchomione.'); };
  return { readMarker: fail, assertState: fail, publicFingerprintOk: fail, newsCheck: fail };
}

function validChecks(overrides = {}) {
  const marker = {
    prepared_from_head: 'c'.repeat(40),
    publication_state_sha256: 'publication',
    public_fingerprint_sha256: 'public',
  };
  return {
    readMarker: () => marker,
    assertState: () => true,
    publicFingerprintOk: () => true,
    newsCheck: () => true,
    ...overrides,
  };
}

test('feature bez markera przechodzi bez kontroli main', () => {
  const result = evaluatePushRefs({
    lines: [line('refs/heads/feature', HEAD, 'refs/heads/feature')],
    head: HEAD,
    ...forbiddenChecks(),
  });
  assert.equal(result.code, 0);
  assert.equal(result.reason, 'NON_MAIN_PUSH');
});

test('zmiana dokumentacji na feature przechodzi bez markera', () => {
  const result = evaluatePushRefs({
    lines: [line('refs/heads/docs', HEAD, 'refs/heads/docs')],
    head: HEAD,
    ...forbiddenChecks(),
  });
  assert.equal(result.code, 0);
});

test('main bez markera jest blokowany', () => {
  assert.throws(() => evaluatePushRefs({
    lines: [line(MAIN, HEAD, MAIN)],
    head: HEAD,
    ...validChecks({ readMarker: () => { throw new Error('brak deployment.json'); } }),
  }), /deployment\.json/);
});

test('stary marker jest blokowany', () => {
  assert.throws(() => evaluatePushRefs({
    lines: [line(MAIN, HEAD, MAIN)],
    head: HEAD,
    ...validChecks({ assertState: () => { throw new Error('DEPLOYMENT_PREPARE_STALE'); } }),
  }), /DEPLOYMENT_PREPARE_STALE/);
});

test('aktualny marker przechodzi', () => {
  const result = evaluatePushRefs({ lines: [line(MAIN, HEAD, MAIN)], head: HEAD, ...validChecks() });
  assert.equal(result.code, 0);
  assert.equal(result.reason, 'MAIN_GUARD_PASS');
});

test('wiele refów z main uruchamia kontrolę markera tylko raz', () => {
  let reads = 0;
  let newsChecks = 0;
  const result = evaluatePushRefs({
    lines: [
      line('refs/heads/feature', HEAD, 'refs/heads/feature'),
      line(MAIN, HEAD, MAIN),
      line(MAIN, HEAD, MAIN),
    ],
    head: HEAD,
    ...validChecks({
      readMarker: () => { reads += 1; return validChecks().readMarker(); },
      newsCheck: () => { newsChecks += 1; return true; },
    }),
  });
  assert.equal(result.code, 0);
  assert.equal(reads, 1);
  assert.equal(newsChecks, 1);
});

test('marker przygotowany na rodzicu commita markera przechodzi przy zgodnym odcisku', () => {
  const parent = 'd'.repeat(40);
  const result = evaluatePushRefs({
    lines: [line(MAIN, HEAD, MAIN)],
    head: HEAD,
    ...validChecks({
      readMarker: () => ({
        prepared_from_head: parent,
        publication_state_sha256: 'publication',
        public_fingerprint_sha256: 'public',
      }),
    }),
  });
  assert.equal(result.code, 0);
});

test('usunięcie gałęzi innej niż main przechodzi, a usunięcie main jest blokowane', () => {
  const feature = evaluatePushRefs({
    lines: [line('(delete)', ZERO, 'refs/heads/old-feature')],
    head: HEAD,
    ...forbiddenChecks(),
  });
  assert.equal(feature.code, 0);
  assert.throws(() => evaluatePushRefs({
    lines: [line('(delete)', ZERO, MAIN)],
    head: HEAD,
    isMainDeleteAllowed: false,
    ...validChecks(),
  }), /Usunięcie.*main/);
});

test('tag przechodzi bez kontroli main', () => {
  const result = evaluatePushRefs({
    lines: [line('refs/tags/v1', HEAD, 'refs/tags/v1')],
    head: HEAD,
    ...forbiddenChecks(),
  });
  assert.equal(result.code, 0);
});

test('NEWS zmieniony po prepare blokuje z kodem danych lub środowiska', () => {
  for (const exitCode of [EXIT.DATA, EXIT.ENVIRONMENT]) {
    assert.throws(
      () => evaluatePushRefs({
        lines: [line(MAIN, HEAD, MAIN)],
        head: HEAD,
        ...validChecks({ newsCheck: () => { throw new NewsPullError('NEWS_OUT_OF_SYNC', exitCode); } }),
      }),
      (error) => error instanceof NewsPullError && error.exitCode === exitCode,
    );
  }
});
