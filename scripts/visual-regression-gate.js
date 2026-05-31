#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (!n || n.startsWith('--')) out[k] = 'true';
    else { out[k] = n; i += 1; }
  }
  return out;
}

function boolOpt(v, fallback) {
  if (v === undefined) return fallback;
  const x = String(v).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(x)) return true;
  if (['0', 'false', 'no', 'off'].includes(x)) return false;
  return fallback;
}

function pngDimensions(buf) {
  if (buf.length < 24 || String(buf.slice(1, 4)) !== 'PNG') return { w: 0, h: 0 };
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function byteDiffRatio(a, b) {
  const len = Math.max(a.length, b.length);
  if (!len) return 0;
  let diff = 0;
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) diff += 1;
  }
  return diff / len;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const updateBaseline = boolOpt(args['update-baseline'], false);
  const threshold = Number(args.threshold || 0.01);
  const root = process.cwd();
  const siteDir = path.join(root, '_site');
  const baselineDir = path.join(root, 'tests', 'visual-baseline');
  const currentDir = path.join(root, 'data', 'reports', 'visual-current');
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });

  const targets = [
    { name: 'index-desktop', file: 'index.html', viewport: { width: 1440, height: 2200 } },
    { name: 'porady-desktop', file: 'porady.html', viewport: { width: 1440, height: 2400 } },
    { name: 'ruch-mobile', file: 'rusz-sie.html', viewport: { width: 393, height: 2556 } },
    { name: 'article-mobile', file: 'jak-zaczac-sie-podciagac-po-50.html', viewport: { width: 393, height: 2556 } },
  ].filter((t) => fs.existsSync(path.join(siteDir, t.file)));

  if (!targets.length) {
    console.log('[VISREG] No targets found in _site.');
    return;
  }

  let playwright;
  try {
    playwright = require('playwright');
  } catch (_err) {
    console.error('[FAIL] playwright not available. Install dependencies first.');
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  const failures = [];

  for (const t of targets) {
    await page.setViewportSize(t.viewport);
    await page.goto(`file://${path.join(siteDir, t.file)}`, { waitUntil: 'load' });
    const currentPath = path.join(currentDir, `${t.name}.png`);
    await page.screenshot({ path: currentPath, fullPage: true });

    const basePath = path.join(baselineDir, `${t.name}.png`);
    if (updateBaseline || !fs.existsSync(basePath)) {
      fs.copyFileSync(currentPath, basePath);
      console.log(`[VISREG] baseline updated: ${path.relative(root, basePath)}`);
      continue;
    }

    const curr = fs.readFileSync(currentPath);
    const base = fs.readFileSync(basePath);
    const dimA = pngDimensions(base);
    const dimB = pngDimensions(curr);
    const hashEqual = sha256(base) === sha256(curr);
    const ratio = hashEqual ? 0 : byteDiffRatio(base, curr);

    if (dimA.w !== dimB.w || dimA.h !== dimB.h || ratio > threshold) {
      failures.push({ name: t.name, ratio, baseline: basePath, current: currentPath, dimA, dimB });
    }
  }

  await browser.close();

  if (failures.length) {
    console.error('\n[FAIL] visual-regression-gate');
    failures.forEach((f) => {
      console.error(`- ${f.name}: diff_ratio=${(f.ratio * 100).toFixed(2)}% baseline=${f.dimA.w}x${f.dimA.h} current=${f.dimB.w}x${f.dimB.h}`);
    });
    console.error('Use --update-baseline true to accept intentional visual changes.');
    process.exit(1);
  }

  console.log(`[PASS] visual-regression-gate (${targets.length} targets)`);
}

main().catch((err) => {
  console.error(`[FAIL] visual-regression-gate -> ${err.message || err}`);
  process.exit(1);
});
