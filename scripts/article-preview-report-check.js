#!/usr/bin/env node

const { validatePreviewReport } = require('./lib/article-preview-report');

const slugIndex = process.argv.indexOf('--slug');
const slug = slugIndex >= 0 ? String(process.argv[slugIndex + 1] || '').trim() : '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('[FAIL] Podaj poprawny --slug.');
  process.exit(1);
}
const result = validatePreviewReport(process.cwd(), slug);
if (!result.ok) {
  result.errors.forEach((error) => console.error(`[FAIL] ${error}`));
  process.exit(2);
}
console.log(`[PASS] PREVIEW_READY v2 jest zgodny z bieżącym HTML-em, PDF-em, obrazami i kompletem stron PDF: ${slug}.`);
