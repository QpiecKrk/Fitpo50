#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { collectChangedFiles, isAdminPath, withoutSitePrefix } = require('./lib/change-scope');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8' });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}: exit ${result.status ?? 30}`);
}

function relatedTests(files) {
  const normalized = files.map(withoutSitePrefix);
  const tests = new Set();
  if (normalized.some((file) => file === 'admin/news-form.php' || file === 'admin/assets/panel.css')) {
    tests.add('tests/news-editor-color.test.js');
  }
  if (normalized.some((file) => file === 'admin/news-form.php')) tests.add('tests/news-db-write.test.js');
  if (normalized.some((file) => /^admin\/(?:actions|helpers)\/news/.test(file))) {
    tests.add('tests/news-db-write.test.js');
    tests.add('tests/news-db-read-cache.test.js');
    tests.add('tests/news-db-schema.test.js');
  }
  if (normalized.some((file) => file === 'admin/api/news-feed.php')) {
    tests.add('tests/news-feed-error-leak.test.js');
    tests.add('tests/news-db-read-cache.test.js');
  }
  if (!tests.size) tests.add('tests/deployment-safety.test.js');
  return [...tests].sort();
}

function assertMirrors(files) {
  const sourcePaths = [...new Set(files.map(withoutSitePrefix).filter((file) => file.startsWith('admin/')))];
  for (const source of sourcePaths) {
    const mirror = path.join('_site', source);
    if (!fs.existsSync(source) || !fs.existsSync(mirror)) throw new Error(`Brak pary źródło/lustro: ${source} <> ${mirror}`);
    if (!fs.readFileSync(source).equals(fs.readFileSync(mirror))) throw new Error(`Niezgodne lustro: ${source} <> ${mirror}`);
    console.log(`[PASS] mirror ${source}`);
  }
}

function main() {
  const fileArgIndex = process.argv.indexOf('--files-json');
  const selected = fileArgIndex >= 0 ? JSON.parse(process.argv[fileArgIndex + 1] || '[]') : collectChangedFiles();
  const files = selected.filter(isAdminPath);
  if (!files.length) throw new Error('Brak zmienionych plików admin do sprawdzenia.');
  for (const file of files.filter((value) => /\.php$/i.test(value))) run('php', ['-l', file]);
  assertMirrors(files);
  const tests = relatedTests(files);
  run(process.execPath, ['--test', ...tests]);
  console.log(`[PASS] admin scope: ${files.length} plików, ${tests.length} zestawów testów.`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`[FAIL] admin scope -> ${error.message || error}`); process.exit(1); }
}

module.exports = { assertMirrors, relatedTests };
