'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'admin', 'helpers', 'git-sync.php');
const FORBIDDEN = new Set(['add', 'commit', 'push', 'pull', 'rebase', 'checkout', 'reset']);

function phpLiteral(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-git-sync-block-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  const log = path.join(root, 'git.log');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'data'), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(repo, 'data', 'news-live.json'), '{"items":[]}\n');

  const stub = path.join(bin, 'git');
  fs.writeFileSync(stub, `#!/bin/sh
printf '%s\\n' "$*" >> "$FITPO50_GIT_STUB_LOG"
if [ "$1" = "rev-parse" ] && [ "$2" = "--is-inside-work-tree" ]; then
  printf 'true\\n'
elif [ "$1" = "rev-parse" ]; then
  printf 'main\\n'
elif [ "$1" = "diff" ]; then
  exit 1
fi
exit 0
`);
  fs.chmodSync(stub, 0o700);

  const source = fs.readFileSync(SOURCE, 'utf8')
    .replace(/^<\?php\s*/u, '')
    .replace(/^require_once __DIR__ \. '\/\.\.\/bootstrap\.php';\s*$/mu, '');
  const harness = path.join(root, 'harness.php');
  fs.writeFileSync(harness, `<?php
define('SITE_ROOT', ${phpLiteral(repo)});
${source}
$action = $argv[1] ?? '';
if ($action === 'auto') {
    echo json_encode(runGitAutoSync(['news'], 'test'), JSON_UNESCAPED_UNICODE);
} elseif ($action === 'write') {
    echo json_encode(runGitCommand(['git', (string)($argv[2] ?? '')], SITE_ROOT), JSON_UNESCAPED_UNICODE);
} elseif ($action === 'rev-parse') {
    echo json_encode(runGitCommand(['git', 'rev-parse', '--is-inside-work-tree'], SITE_ROOT), JSON_UNESCAPED_UNICODE);
} elseif ($action === 'presentation') {
    $result = runGitAutoSync(['news'], 'test');
    echo json_encode([
        'result' => $result,
        'note' => gitSyncResultNote($result),
        'flash_error' => gitSyncFlashError($result),
    ], JSON_UNESCAPED_UNICODE);
}
`);

  function run(action, autoSync, extraArgs = []) {
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH || '/usr/bin:/bin'}`,
      FITPO50_GIT_STUB_LOG: log,
    };
    delete env.FITPO50_AUTO_GIT_SYNC;
    if (autoSync !== undefined) env.FITPO50_AUTO_GIT_SYNC = autoSync;
    const result = spawnSync('php', [harness, action, ...extraArgs], { cwd: repo, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  }

  function calls() {
    if (!fs.existsSync(log)) return [];
    return fs.readFileSync(log, 'utf8').trim().split(/\n/u).filter(Boolean);
  }

  return { run, calls };
}

function forbiddenCalls(calls) {
  return calls.filter((line) => FORBIDDEN.has(String(line).split(/\s+/u)[0]));
}

test('FITPO50_AUTO_GIT_SYNC=1 remains blocked before any Git process starts', (t) => {
  const fixture = createFixture(t);
  const result = fixture.run('auto', '1');
  assert.equal(result.status, 'blocked');
  assert.deepEqual(forbiddenCalls(fixture.calls()), [], `write calls: ${fixture.calls().join(' | ')}`);
  assert.deepEqual(fixture.calls(), [], `unexpected Git calls: ${fixture.calls().join(' | ')}`);
});

test('unset FITPO50_AUTO_GIT_SYNC is blocked with no Git process', (t) => {
  const fixture = createFixture(t);
  const result = fixture.run('auto');
  assert.equal(result.status, 'blocked');
  assert.deepEqual(fixture.calls(), []);
});

test('runGitCommand blocks every write-capable subcommand without invoking the Git stub', (t) => {
  const fixture = createFixture(t);
  for (const subcommand of FORBIDDEN) {
    const result = fixture.run('write', undefined, [subcommand]);
    assert.notEqual(result.exit_code, 0, `${subcommand} should be blocked`);
    assert.match(result.stderr, /zablokowane/u);
  }
  assert.deepEqual(fixture.calls(), []);
});

test('runGitCommand allows rev-parse as a read-only command', (t) => {
  const fixture = createFixture(t);
  const result = fixture.run('rev-parse');
  assert.equal(result.exit_code, 0);
  assert.equal(result.stdout.trim(), 'true');
  assert.deepEqual(fixture.calls(), ['rev-parse --is-inside-work-tree']);
});

test('blocked auto-sync produces a calm note and no flash error', (t) => {
  const fixture = createFixture(t);
  const result = fixture.run('presentation', '1');
  assert.equal(result.result.status, 'blocked');
  assert.match(result.note, /wyłączon/u);
  assert.equal(result.flash_error, null);
  assert.deepEqual(fixture.calls(), []);
});
