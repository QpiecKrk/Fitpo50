#!/usr/bin/env node

const path = require('path');
const { defaultGscInputDir, refreshMonitoring } = require('./lib/post-publication-monitor');

function valueAfter(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

try {
  const root = path.resolve(valueAfter('--root', process.cwd()));
  const inputDir = path.resolve(valueAfter('--input-dir', defaultGscInputDir()));
  const outputDir = path.resolve(valueAfter('--output-dir', inputDir));
  const report = refreshMonitoring({ root, inputDir, outputDir });
  console.log(`[POST-PUBLISH] ${report.items.length} URL-i; raport: ${path.join(outputDir, 'post-publication-monitor.md')}`);
} catch (error) {
  console.error(`[POST-PUBLISH][FAIL] ${error.message || error}`);
  process.exit(1);
}
