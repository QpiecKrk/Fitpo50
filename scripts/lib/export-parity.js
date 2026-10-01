'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walk(root, relative = '') {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, child));
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(child.split(path.sep).join('/'));
  }
  return files;
}

function kindFor(relative) {
  const normalized = String(relative || '').toLowerCase();
  if (normalized.endsWith('.html')) return 'HTML';
  if (normalized.endsWith('.pdf')) return 'PDF';
  if (normalized.startsWith('data/') || /\.(json|xml|txt|csv)$/i.test(normalized)) return 'DATA';
  return 'ASSET';
}

function item(relative) {
  return { path: relative, kind: kindFor(relative) };
}

function compareExportTrees(expectedRoot, actualRoot) {
  const expected = path.resolve(expectedRoot);
  const actual = path.resolve(actualRoot);
  if (!fs.existsSync(expected) || !fs.statSync(expected).isDirectory()) throw new Error(`Brak katalogu oczekiwanego eksportu: ${expected}`);
  if (!fs.existsSync(actual) || !fs.statSync(actual).isDirectory()) throw new Error(`Brak katalogu publicznego eksportu: ${actual}`);
  const expectedFiles = walk(expected);
  const actualFiles = walk(actual);
  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);
  const missing = expectedFiles.filter((relative) => !actualSet.has(relative)).map(item);
  const extra = actualFiles.filter((relative) => !expectedSet.has(relative)).map(item);
  const different = expectedFiles
    .filter((relative) => actualSet.has(relative) && sha256(path.join(expected, relative)) !== sha256(path.join(actual, relative)))
    .map(item);
  return {
    ok: missing.length === 0 && extra.length === 0 && different.length === 0,
    expected_root: expected,
    actual_root: actual,
    expected_files: expectedFiles.length,
    actual_files: actualFiles.length,
    missing,
    extra,
    different,
  };
}

module.exports = { compareExportTrees, kindFor, walk };
