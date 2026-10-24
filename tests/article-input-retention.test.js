'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('lokalna promocja zachowuje paczkę wejściową do potwierdzenia live', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'article-pipeline.js'), 'utf8');
  const promotionBlock = source.slice(source.indexOf('transaction.commit();'), source.indexOf("console.log(`[PUBLISHED]"));
  assert.doesNotMatch(promotionBlock, /cleanupPreparedArtifact\s*\(/);
  assert.match(promotionBlock, /AWAITING_LIVE_CONFIRMATION/);
  assert.match(promotionBlock, /LIVE_DEPLOYED_AND_VALIDATED/);
  assert.match(source, /status: 'AWAITING_LIVE_CONFIRMATION'/);
  assert.match(source, /package_sha256:/);
  assert.match(source, /package_files:/);
  assert.match(source, /transaction_id: transactionId/);
  assert.match(source, /recovered\.includes\(String\(recoveredStatus\.transaction_id/);
});
