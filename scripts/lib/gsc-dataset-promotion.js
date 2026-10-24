'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { atomicWriteFileSync } = require('./atomic-file');
const path = require('node:path');
const { warsawIso } = require('./time');

const WORKSPACE_FILES = new Set(['.fitpo50-workspace.json', '.fitpo50-workspace.lock']);
const PRESERVED_ACTIVE_FILES = new Set(['automation-run-events.json']);

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function atomicWriteJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.writing-${process.pid}-${Date.now()}`;
  atomicWriteFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function copyTree(source, target, options = {}, relative = '') {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!relative && WORKSPACE_FILES.has(entry.name)) continue;
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`GSC staging nie przyjmuje symlinków: ${childRelative}`);
    if (entry.isDirectory()) copyTree(from, to, options, childRelative);
    else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      const stat = fs.statSync(from);
      fs.utimesSync(to, stat.atime, stat.mtime);
    }
  }
  if (!relative && options.preserveFrom && fs.existsSync(options.preserveFrom)) {
    for (const name of PRESERVED_ACTIVE_FILES) {
      const from = path.join(options.preserveFrom, name);
      const to = path.join(target, name);
      if (fs.existsSync(from) && !fs.existsSync(to) && fs.statSync(from).isFile()) fs.copyFileSync(from, to);
    }
  }
}

function directoryIdentity(directory, relative = '', output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!relative && WORKSPACE_FILES.has(entry.name)) continue;
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) directoryIdentity(target, childRelative, output);
    else if (entry.isFile()) output.push({ path: childRelative.replace(/\\/g, '/'), sha256: sha256File(target) });
  }
  return output.sort((left, right) => left.path.localeCompare(right.path, 'pl'));
}

function identityMatches(directory, expected) {
  return JSON.stringify(directoryIdentity(directory)) === JSON.stringify(expected || []);
}

function promotionPaths(targetDir) {
  const parent = path.dirname(targetDir);
  const name = path.basename(targetDir);
  return {
    journal: path.join(parent, `.${name}.promotion.json`),
    candidate: path.join(parent, `.${name}.candidate`),
    backup: path.join(parent, `.${name}.backup`),
  };
}

function recoverGscDatasetPromotion(targetDir) {
  const paths = promotionPaths(path.resolve(targetDir));
  if (!fs.existsSync(paths.journal)) return { recovered: false };
  const journal = JSON.parse(fs.readFileSync(paths.journal, 'utf8'));
  const target = path.resolve(targetDir);
  if (fs.existsSync(target) && identityMatches(target, journal.expected_files)) {
    fs.rmSync(paths.backup, { recursive: true, force: true });
    fs.rmSync(paths.candidate, { recursive: true, force: true });
    fs.rmSync(paths.journal, { force: true });
    return { recovered: true, action: 'COMPLETED_PROMOTION' };
  }
  if (fs.existsSync(paths.backup)) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(paths.backup, target);
  }
  fs.rmSync(paths.candidate, { recursive: true, force: true });
  fs.rmSync(paths.journal, { force: true });
  return { recovered: true, action: 'ROLLED_BACK' };
}

function promoteValidatedGscDataset({ sourceDir, targetDir, validate, hooks = {} }) {
  const source = path.resolve(sourceDir);
  const target = path.resolve(targetDir);
  const paths = promotionPaths(target);
  recoverGscDatasetPromotion(target);
  for (const transient of [paths.candidate, paths.backup]) fs.rmSync(transient, { recursive: true, force: true });
  copyTree(source, paths.candidate, { preserveFrom: target });
  const validation = validate(paths.candidate);
  if (validation?.blocking) {
    fs.rmSync(paths.candidate, { recursive: true, force: true });
    throw new Error(`GSC_DATA_CONTRACT_FAILED:\n${(validation.errors || []).map((item) => `- ${item}`).join('\n')}`);
  }
  const expectedFiles = directoryIdentity(paths.candidate);
  const journal = {
    version: 1,
    status: 'PREPARED',
    target,
    expected_files: expectedFiles,
    created_at: warsawIso(),
  };
  atomicWriteJson(paths.journal, journal);
  try {
    if (fs.existsSync(target)) fs.renameSync(target, paths.backup);
    journal.status = 'BACKED_UP';
    atomicWriteJson(paths.journal, journal);
    if (hooks.afterBackup) hooks.afterBackup({ ...paths, target });
    fs.renameSync(paths.candidate, target);
    journal.status = 'PROMOTED';
    atomicWriteJson(paths.journal, journal);
    if (hooks.afterPromote) hooks.afterPromote({ ...paths, target });
    if (!identityMatches(target, expectedFiles)) throw new Error('SHA-256 aktywnego zestawu GSC nie zgadza się ze stagingiem.');
    fs.rmSync(paths.backup, { recursive: true, force: true });
    fs.rmSync(paths.journal, { force: true });
    return { status: 'PROMOTED', files: expectedFiles, validation };
  } catch (error) {
    if (fs.existsSync(paths.backup)) {
      fs.rmSync(target, { recursive: true, force: true });
      fs.renameSync(paths.backup, target);
    }
    fs.rmSync(paths.candidate, { recursive: true, force: true });
    fs.rmSync(paths.journal, { force: true });
    throw error;
  }
}

module.exports = {
  directoryIdentity,
  promoteValidatedGscDataset,
  promotionPaths,
  recoverGscDatasetPromotion,
};
