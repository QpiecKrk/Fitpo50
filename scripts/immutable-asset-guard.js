#!/usr/bin/env node

const { spawnSync } = require('child_process');

const IMMUTABLE_ASSET_RX = /^(?:_site\/)?assets\/.+\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

function parseNameStatus(output) {
  return String(output || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = String(parts[0] || '').trim();
      const assetPath = status.startsWith('R') || status.startsWith('C') ? parts[2] : parts[1];
      return { status, path: String(assetPath || '').trim() };
    })
    .filter((entry) => entry.path);
}

function immutableAssetViolations(entries) {
  const seen = new Set();
  const violations = [];
  for (const entry of entries || []) {
    const status = String(entry.status || '').trim();
    const assetPath = String(entry.path || '').trim();
    if (!IMMUTABLE_ASSET_RX.test(assetPath)) continue;
    if (!status.startsWith('M') && !status.startsWith('T')) continue;
    const key = `${status}:${assetPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({ status, path: assetPath });
  }
  return violations;
}

function gitDiff(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return parseNameStatus(result.stdout);
}

function changedEntries() {
  return [
    ...gitDiff(['diff', '--name-status', 'origin/main...HEAD']),
    ...gitDiff(['diff', '--cached', '--name-status']),
    ...gitDiff(['diff', '--name-status']),
  ];
}

function main() {
  const violations = immutableAssetViolations(changedEntries());
  if (!violations.length) {
    console.log('[PASS] immutable-asset-guard — brak nadpisanych obrazów z rocznym cache.');
    return;
  }

  console.error('[FAIL] immutable-asset-guard — zmieniono zawartość obrazu pod istniejącym adresem:');
  violations.forEach((entry) => console.error(`- ${entry.path} (${entry.status})`));
  console.error('Zapisz nową wersję pod nową nazwą i zaktualizuj odwołania w HTML, metadanych oraz _site.');
  process.exit(1);
}

if (require.main === module) main();

module.exports = {
  IMMUTABLE_ASSET_RX,
  immutableAssetViolations,
  parseNameStatus,
};
