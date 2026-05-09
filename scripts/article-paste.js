#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function boolOpt(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const x = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(x)) return true;
  if (['0', 'false', 'no', 'off'].includes(x)) return false;
  return fallback;
}

function runAndRead(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  if (res.status !== 0) return null;
  return String(res.stdout || '').trim();
}

function readClipboard() {
  const candidates = [
    ['pbpaste', []],
    ['powershell', ['-NoProfile', '-Command', 'Get-Clipboard']],
    ['xclip', ['-o', '-selection', 'clipboard']],
    ['wl-paste', ['-n']],
  ];
  for (const [cmd, args] of candidates) {
    const value = runAndRead(cmd, args);
    if (value) return value;
  }
  return '';
}

function stripMarkdownFence(text) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return String(fenced[1] || '').trim();
  return raw;
}

function extractLikelyJson(text) {
  const stripped = stripMarkdownFence(text);
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return stripped.slice(first, last + 1).trim();
  }
  return stripped;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = args.out
    ? path.resolve(process.cwd(), String(args.out))
    : path.resolve(process.cwd(), 'data/import/draft.fitpo50.json');
  const runFix = boolOpt(args.fix, true);

  const clip = readClipboard();
  if (!clip) {
    throw new Error('Schowek jest pusty albo niedostępny.');
  }
  const body = extractLikelyJson(clip);
  if (!body.includes('{') || !body.includes('}')) {
    throw new Error('W schowku nie wykryto obiektu JSON.');
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${body}\n`, 'utf8');
  console.log(`[OK] Zapisano draft ze schowka: ${out}`);

  if (!runFix) return;
  const res = spawnSync(
    'node',
    ['scripts/fix-fitpo50-json.js', '--file', out, '--write', 'true'],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) {
    throw new Error('Auto-fix JSON nie przeszedł.');
  }
  console.log('[PASS] Clipboard -> draft -> fix-json');
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] ${err.message || err}`);
  process.exit(1);
}
