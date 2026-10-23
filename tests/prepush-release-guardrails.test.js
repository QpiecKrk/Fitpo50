'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { changedFiles } = require('../scripts/prepush-diff-guard');
const { assertExportDidNotModifySources, changedSnapshotFiles, repositorySnapshot } = require('../scripts/run-all-prepush');

const ROOT = path.resolve(__dirname, '..');

function run(command, args, cwd, env = {}) {
  return spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
}

function git(cwd, ...args) {
  const result = run('git', args, cwd);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return String(result.stdout || '').trim();
}

test('GitHub live check verifies deployment and security and fails on timeout', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-live-check-'));
  try {
    const log = path.join(directory, 'calls.log');
    const fakeNode = path.join(directory, 'node');
    fs.writeFileSync(fakeNode, '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$CALL_LOG"\n', { mode: 0o755 });
    const result = run('bash', ['scripts/live-postpush-check.sh', 'https://example.test'], ROOT, {
      PATH: `${directory}:${process.env.PATH}`,
      CALL_LOG: log,
      RETRIES: '2',
      DELAY: '4',
      TIMEOUT: '7',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(fs.readFileSync(log, 'utf8').trim().split('\n'), [
      'scripts/deployment-live-verify.js --base-url https://example.test --retries 2 --delay-ms 4000 --timeout-ms 7000',
      'scripts/security-exposure-check.js https://example.test',
    ]);
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/live-postpush-check.yml'), 'utf8');
    assert.match(workflow, /if \[ "\$status" = "124" \][\s\S]*?\[ERROR\][\s\S]*?exit 1/);
    assert.doesNotMatch(workflow, /soft-pass|timed out[\s\S]*?exit 0/i);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('prepush blocks and lists every source file changed by export', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-export-snapshot-'));
  try {
    git(root, 'init');
    fs.writeFileSync(path.join(root, 'sitemap.xml'), 'old-map\n');
    fs.writeFileSync(path.join(root, 'llms-full.txt'), 'old-llms\n');
    fs.writeFileSync(path.join(root, 'same.html'), 'same\n');
    git(root, 'add', '.');
    const before = repositorySnapshot(root);
    fs.writeFileSync(path.join(root, 'sitemap.xml'), 'new-map\n');
    fs.writeFileSync(path.join(root, 'llms-full.txt'), 'new-llms\n');
    const after = repositorySnapshot(root);
    assert.deepEqual(changedSnapshotFiles(before, after), ['llms-full.txt', 'sitemap.xml']);
    assert.throws(
      () => assertExportDidNotModifySources(before, after),
      (error) => /export:fresh zmienił pliki źródłowe/.test(error.message)
        && error.message.includes('llms-full.txt')
        && error.message.includes('sitemap.xml'),
    );
    assert.doesNotThrow(() => assertExportDidNotModifySources(before, new Map(before)));
    const runner = fs.readFileSync(path.join(ROOT, 'scripts', 'run-all-prepush.js'), 'utf8');
    const beforeIndex = runner.indexOf('const sourceSnapshotBeforeExport = repositorySnapshot()');
    const exportIndex = runner.indexOf("runStep('export:fresh(tmp)'");
    const assertionIndex = runner.indexOf('assertExportDidNotModifySources(sourceSnapshotBeforeExport, repositorySnapshot())');
    assert.ok(beforeIndex >= 0 && beforeIndex < exportIndex && exportIndex < assertionIndex);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('prepush diff guard counts committed, staged, unstaged and untracked files once', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-diff-guard-'));
  try {
    git(root, 'init');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test');
    for (const file of ['committed.txt', 'staged.txt', 'unstaged.txt']) fs.writeFileSync(path.join(root, file), 'base\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'base');
    git(root, 'update-ref', 'refs/remotes/origin/main', git(root, 'rev-parse', 'HEAD'));
    fs.writeFileSync(path.join(root, 'committed.txt'), 'committed\n');
    git(root, 'add', 'committed.txt');
    git(root, 'commit', '-m', 'ahead');
    fs.writeFileSync(path.join(root, 'staged.txt'), 'staged\n');
    git(root, 'add', 'staged.txt');
    fs.writeFileSync(path.join(root, 'unstaged.txt'), 'unstaged\n');
    fs.writeFileSync(path.join(root, 'untracked.txt'), 'untracked\n');
    assert.deepEqual(changedFiles(root), ['committed.txt', 'staged.txt', 'unstaged.txt', 'untracked.txt']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
