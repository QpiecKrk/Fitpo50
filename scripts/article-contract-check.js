#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validateArticleHeadContract } = require('./lib/article-head-contract');

function countMatches(raw, regex) {
  return [...String(raw || '').matchAll(regex)].length;
}

function validateArticleContract(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];

  const head = validateArticleHeadContract(raw);
  errors.push(...head.errors);
  warnings.push(...head.warnings);

  const quickAnswer = /<section\s+class="quick-answer[^\"]*"[\s\S]*?<\/section>/i.test(raw);
  if (!quickAnswer) errors.push('Brak sekcji quick-answer.');

  const keyTakeaways = /<section\s+class="key-takeaways/.test(raw);
  if (!keyTakeaways) errors.push('Brak sekcji key-takeaways.');

  const contextualLinks = countMatches(raw, /<a\b[^>]*href="(\.\/)?[a-z0-9-]+\.html(?:[?#][^\"]*)?"/gi);
  if (contextualLinks < 4) errors.push(`Za mało linków wewnętrznych .html (jest ${contextualLinks}, min 4).`);

  const faqQuestions = countMatches(raw, /<(?:details|article)\s+class="faq-item"/gi);
  if (faqQuestions < 4) errors.push(`FAQ: za mało pytań (jest ${faqQuestions}, min 4).`);

  const hasBreadcrumbList = /"@type"\s*:\s*"BreadcrumbList"/i.test(raw);
  if (!hasBreadcrumbList) warnings.push('Brak schema BreadcrumbList.');

  const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;
  const pub = (raw.match(/article:published_time"\s+content="([^"]+)"/i) || [])[1] || '';
  const mod = (raw.match(/article:modified_time"\s+content="([^"]+)"/i) || [])[1] || '';
  if (pub && !isoDate.test(pub)) errors.push('article:published_time nie jest ISO 8601 z TZ.');
  if (mod && !isoDate.test(mod)) errors.push('article:modified_time nie jest ISO 8601 z TZ.');

  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node scripts/article-contract-check.js <file.html> [more files]');
    process.exit(1);
  }

  let fail = false;
  for (const f of args) {
    const filePath = path.resolve(process.cwd(), f);
    if (!fs.existsSync(filePath)) {
      console.log(`✖ ${f}`);
      console.log('  - Brak pliku.');
      fail = true;
      continue;
    }
    const { errors, warnings } = validateArticleContract(filePath);
    if (warnings.length) {
      warnings.forEach((w) => console.log(`⚠ ${f}: ${w}`));
    }
    if (errors.length) {
      console.log(`✖ ${f}`);
      errors.forEach((e) => console.log(`  - ${e}`));
      fail = true;
    } else {
      console.log(`✔ ${f}`);
    }
  }

  if (fail) process.exit(1);
}

main();
