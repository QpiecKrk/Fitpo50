#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

function prefixOutput(tag, stream, logger) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => logger(`[${tag}] ${line}`));
}

function runStep(tag, cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    prefixOutput(tag, child.stdout, console.log);
    prefixOutput(tag, child.stderr, console.error);
    child.on('error', (err) => reject(new Error(`${tag}: ${err.message || err}`)));
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`${tag}: exit ${code ?? 'unknown'}`));
      else resolve();
    });
  });
}

async function main() {
  const started = Date.now();
  console.log('Pre-push: start');

  await runStep('prepush:diff-guard', 'node', ['scripts/prepush-diff-guard.js']);

  await Promise.all([
    runStep('prepush:parallel:checks', 'node', ['scripts/prepush-parallel-checks.js']),
    runStep('check:site:fast', 'npm', ['run', 'check:site:fast']),
  ]);

  await runStep('tmp:cleanup', 'node', ['scripts/tmp-cleanup.js']);

  const sec = ((Date.now() - started) / 1000).toFixed(2);
  console.log(`Pre-push: OK (${sec}s)`);
}

main().catch((err) => {
  console.error(`Pre-push: FAIL -> ${err.message || err}`);
  process.exit(1);
});

