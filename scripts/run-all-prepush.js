#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

function prefixOutput(tag, stream, logger) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => logger(`[${tag}] ${line}`));
}

function runStep(tag, cmd, args) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    prefixOutput(tag, child.stdout, console.log);
    prefixOutput(tag, child.stderr, console.error);
    child.on('error', (err) => reject(new Error(`${tag}: ${err.message || err}`)));
    child.on('close', (code) => {
      const durationMs = Date.now() - started;
      if (code !== 0) reject(new Error(`${tag}: exit ${code ?? 'unknown'}`));
      else resolve({ tag, durationMs });
    });
  });
}

function appendTimingReport(scope, totalMs, steps) {
  try {
    const reportPath = path.join(process.cwd(), 'data', 'reports', 'pipeline-timings.json');
    const nowIso = new Date().toISOString();
    const payload = fs.existsSync(reportPath)
      ? JSON.parse(fs.readFileSync(reportPath, 'utf8'))
      : { version: 1, updated_at: nowIso, records: [] };
    const records = Array.isArray(payload.records) ? payload.records : [];
    records.push({
      scope,
      at: nowIso,
      total_ms: totalMs,
      steps,
    });
    payload.records = records.slice(-120);
    payload.updated_at = nowIso;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch (_err) {
    // best effort only
  }
}

async function main() {
  const started = Date.now();
  const timings = [];
  console.log('Pre-push: start');

  timings.push(await runStep('prepush:diff-guard', 'node', ['scripts/prepush-diff-guard.js']));

  const parallel = await Promise.all([
    runStep('prepush:parallel:checks', 'node', ['scripts/prepush-parallel-checks.js']),
    runStep('build:esbuild', 'node_modules/.bin/esbuild', ['src/app.ts', 'src/cmp.ts', 'src/footer.ts', '--outdir=dist', '--target=es2018', '--format=iife', '--log-level=error']),
    runStep('smoke:static(_site)', 'node', ['scripts/static-smoke-check.js', '_site']),
  ]);
  timings.push(...parallel);

  timings.push(await runStep('tmp:cleanup', 'node', ['scripts/tmp-cleanup.js']));

  const totalMs = Date.now() - started;
  const sec = (totalMs / 1000).toFixed(2);
  appendTimingReport('prepush-local', totalMs, timings);
  console.log(`Pre-push: OK (${sec}s)`);
}

main().catch((err) => {
  console.error(`Pre-push: FAIL -> ${err.message || err}`);
  process.exit(1);
});
