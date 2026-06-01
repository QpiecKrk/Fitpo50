#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const readline = require('readline');

const TASKS = {
  'assets:mirror:check': { cmd: 'node', args: ['scripts/sync-site-assets-mirror.js', '--check'], always: true },
  'article:validate': { cmd: 'node', args: ['scripts/validate-article-standard.js'], always: true },
  'predeploy:check': { cmd: 'node', args: ['scripts/predeploy-gate.js'], always: true },
  'news:integrity': { cmd: 'node', args: ['scripts/news-integrity-check.js'], match: [/^data\/news-live\.json$/, /^assets\/data\/news-fallback\.json$/, /^admin\/news/i] },
  'article:guard:diff': { cmd: 'node', args: ['scripts/run-article-guard-diff.js'], match: [/\.html$/i] },
  'article:contract:diff': { cmd: 'node', args: ['scripts/run-article-contract-diff.js'], match: [/\.html$/i] },
  'schema:validate': { cmd: 'node', args: ['scripts/schema-validator.js', '--diff'], match: [/\.html$/i] },
  'adsense:readiness': { cmd: 'node', args: ['scripts/adsense-readiness-check.js'], always: true },
  'json:gate:diff': { cmd: 'node', args: ['scripts/json-fitpo50-gate-diff.js'], match: [/\.fitpo50\.json$/i] },
  'date:modified:guard': { cmd: 'node', args: ['scripts/date-modified-guard.js'], match: [/\.html$/i] },
};
const DEFAULT_TASKS = Object.keys(TASKS);

function parseArgs(argv) {
  const tasks = [];
  let all = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--task') {
      const v = String(argv[i + 1] || '').trim();
      if (v) tasks.push(v);
      i += 1;
      continue;
    }
    if (argv[i] === '--all') {
      all = true;
    }
  }
  return { tasks: tasks.length ? tasks : DEFAULT_TASKS, all };
}

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function changedFiles() {
  const primary = run('git', ['diff', '--name-status', 'origin/main...HEAD']);
  const parse = (out) => String(out || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = String(parts[0] || '').trim();
      const file = status.startsWith('R') || status.startsWith('C') ? (parts[2] || '') : (parts[1] || '');
      return { status, file };
    })
    .filter((x) => x.file && !x.status.startsWith('D'))
    .map((x) => x.file);

  if (primary.status === 0) return parse(primary.stdout);
  const fallback = run('git', ['diff', '--name-status', 'HEAD~1..HEAD']);
  if (fallback.status === 0) return parse(fallback.stdout);
  const msg = String(primary.stderr || primary.stdout || fallback.stderr || fallback.stdout || '').trim();
  throw new Error(`Nie udało się odczytać diff: ${msg}`);
}

function shouldRunTask(taskName, changed, forceAll) {
  const task = TASKS[taskName];
  if (!task) return true;
  if (forceAll || task.always) return true;
  const matchers = Array.isArray(task.match) ? task.match : [];
  if (!matchers.length) return true;
  return changed.some((file) => matchers.some((rx) => rx.test(file)));
}

function resolveRunnableTasks(tasks, changed, forceAll) {
  const runnables = [];
  const skipped = [];
  for (const t of tasks) {
    if (shouldRunTask(t, changed, forceAll)) runnables.push(t);
    else skipped.push(t);
  }
  return { runnables, skipped };
}

function prefixOutput(task, stream, logger) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => logger(`[${task}] ${line}`));
}

function runTask(task) {
  return new Promise((resolve) => {
    const spec = TASKS[task];
    if (!spec) {
      resolve({ task, code: 1, error: `Nieznane zadanie: ${task}` });
      return;
    }

    const child = spawn(spec.cmd, spec.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    prefixOutput(task, child.stdout, console.log);
    prefixOutput(task, child.stderr, console.error);

    child.on('error', (err) => {
      resolve({ task, code: 1, error: err.message || String(err) });
    });

    child.on('close', (code) => {
      resolve({ task, code: Number(code || 0) });
    });
  });
}

async function main() {
  const { tasks, all } = parseArgs(process.argv.slice(2));
  const changed = changedFiles();
  const { runnables, skipped } = resolveRunnableTasks(tasks, changed, all);
  console.log(`[PREPUSH-PARALLEL] start tasks=${runnables.length}/${tasks.length}`);
  if (skipped.length) {
    console.log(`[PREPUSH-PARALLEL] skipped: ${skipped.join(', ')}`);
  }
  const startedAt = Date.now();

  const results = await Promise.all(runnables.map((task) => runTask(task)));
  const failed = results.filter((r) => r.code !== 0);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);

  if (failed.length) {
    console.error(`\n[FAIL] prepush-parallel-checks in ${seconds}s`);
    for (const f of failed) {
      if (f.error) console.error(`- ${f.task}: ${f.error}`);
      else console.error(`- ${f.task}: exit ${f.code}`);
    }
    process.exit(1);
  }

  console.log(`\n[PASS] prepush-parallel-checks in ${seconds}s`);
}

main().catch((err) => {
  console.error(`[FAIL] prepush-parallel-checks -> ${err.message || err}`);
  process.exit(1);
});
