#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();

function readDimensions(assetPath) {
  const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', assetPath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Nie udało się odczytać wymiarów ${assetPath}: ${result.stderr || result.stdout}`);
  }
  const width = result.stdout.match(/pixelWidth:\s*(\d+)/);
  const height = result.stdout.match(/pixelHeight:\s*(\d+)/);
  if (!width || !height) throw new Error(`Brak wymiarów obrazu: ${assetPath}`);
  return { width: width[1], height: height[1] };
}

function resolveAsset(htmlPath, src) {
  if (/^(?:https?:|data:|\/\/)/i.test(src)) return null;
  return path.resolve(path.dirname(htmlPath), src.split(/[?#]/, 1)[0]);
}

function updateFile(input) {
  const htmlPath = path.resolve(ROOT, input);
  const original = fs.readFileSync(htmlPath, 'utf8');
  let changed = 0;
  const next = original.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bwidth\s*=/.test(tag) && /\bheight\s*=/.test(tag)) return tag;
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return tag;
    const assetPath = resolveAsset(htmlPath, srcMatch[1]);
    if (!assetPath || !fs.existsSync(assetPath)) return tag;
    const dimensions = readDimensions(assetPath);
    let out = tag;
    if (!/\bwidth\s*=/.test(out)) out = out.replace(/>$/, ` width="${dimensions.width}">`);
    if (!/\bheight\s*=/.test(out)) out = out.replace(/>$/, ` height="${dimensions.height}">`);
    if (out !== tag) changed += 1;
    return out;
  });
  if (next !== original) fs.writeFileSync(htmlPath, next, 'utf8');
  console.log(`[IMAGE-DIMENSIONS] ${input}: ${changed} updated`);
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    throw new Error('Podaj co najmniej jeden plik HTML.');
  }
  for (const file of files) updateFile(file);
}

try {
  main();
} catch (error) {
  console.error(`[IMAGE-DIMENSIONS] FAIL: ${error.message || error}`);
  process.exit(1);
}
