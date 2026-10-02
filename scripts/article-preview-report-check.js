#!/usr/bin/env node

const { validatePreviewReport } = require('./lib/article-preview-report');

const slugIndex = process.argv.indexOf('--slug');
const slug = slugIndex >= 0 ? String(process.argv[slugIndex + 1] || '').trim() : '';
const requireRenderFiles = process.argv.includes('--require-render-files');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('[FAIL] Podaj poprawny --slug.');
  process.exit(1);
}
const result = validatePreviewReport(process.cwd(), slug, { requireRenderFiles });
if (!result.ok) {
  result.errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(2);
}
console.log(`[PASS] PREVIEW_READY v3 = TECHNICAL_PASS + VISUAL_REVIEW_VERIFIED: ${slug}.`);
