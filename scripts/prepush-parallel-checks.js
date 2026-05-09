#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

const DEFAULT_TASKS = [
  'assets:mirror:check',
  'predeploy:check',
  'news:integrity',
  'article:guard:diff',
  'schema:validate',
  'adsense:readiness',
  'json:gate:diff',
];

function parseArgs(argv) {
  const tasks = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--task') {
      const v = String(argv[i + 1] || '').trim();
      if (v) tasks.push(v);
      i += 1;
    }
  }
  return { tasks: tasks.length ? tasks : DEFAULT_TASKS };
}

function prefixOutput(task, stream, logger) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => logger(`[${task}] ${line}`));
}

function runTask(task) {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', task], {
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
  const { tasks } = parseArgs(process.argv.slice(2));
  console.log(`[PREPUSH-PARALLEL] start tasks=${tasks.length}`);
  const startedAt = Date.now();

  const results = await Promise.all(tasks.map((task) => runTask(task)));
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
