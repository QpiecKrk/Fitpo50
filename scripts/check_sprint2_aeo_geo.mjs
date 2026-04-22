#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

for (const file of htmlFiles) {
  const fullPath = path.join(ROOT, file);
  const html = fs.readFileSync(fullPath, 'utf8');
  const isBlogArticle = /"@type":\s*"BlogPosting"/.test(html);
  const isTemplate = file === 'article-template-bento.html';
  if (!isBlogArticle || isTemplate) continue;

  if (!/"@type":\s*"FAQPage"/.test(html)) {
    errors.push(`${file}: brak FAQPage schema`);
  }

  if (!/"@type":\s*"SpeakableSpecification"/.test(html)) {
    errors.push(`${file}: brak SpeakableSpecification`);
  }

  if (!/<meta property="article:section" content="[^"]+"/i.test(html)) {
    errors.push(`${file}: brak meta article:section`);
  }
}

if (errors.length > 0) {
  console.error('Sprint 2 AEO/GEO check FAILED:\n');
  errors.forEach((err) => console.error(`- ${err}`));
  process.exit(1);
}

console.log('Sprint 2 AEO/GEO check OK');
