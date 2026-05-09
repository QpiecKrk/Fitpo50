#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOMAIN = 'https://fitpo50.pl';
const errors = [];

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

for (const file of htmlFiles) {
  const fullPath = path.join(ROOT, file);
  const html = fs.readFileSync(fullPath, 'utf8');

  if (html.includes('https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>')) {
    errors.push(`${file}: wykryto legacy sync/async GA snippet zamiast deferred loadera`);
  }

  const hasBlogPosting = /"@type":\s*"BlogPosting"/.test(html);
  const isTemplate = file === 'article-template-bento.html';
  if (hasBlogPosting && !isTemplate) {
    if (!/<meta name="author" content="FitPo50">/i.test(html)) {
      errors.push(`${file}: brak <meta name="author" content="FitPo50">`);
    }
    if (!/"wordCount":\s*\d+/m.test(html)) {
      errors.push(`${file}: brak wordCount w BlogPosting JSON-LD`);
    }
    if (!/"timeRequired":\s*"PT\d+M"/m.test(html)) {
      errors.push(`${file}: brak timeRequired (PTxM) w BlogPosting JSON-LD`);
    }
  }
}

const sitemapPath = path.join(ROOT, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
sitemap.replace(/<loc>(.*?)<\/loc>/g, (_full, loc) => {
  if (!loc.startsWith(DOMAIN)) return _full;
  const pathPart = loc.replace(DOMAIN, '');
  if (pathPart === '/' || pathPart === '') return _full;
  if (!pathPart.endsWith('.html')) return _full;

  const localPath = path.join(ROOT, pathPart.replace(/^\//, ''));
  if (!fs.existsSync(localPath)) {
    errors.push(`sitemap.xml: URL bez pliku lokalnego -> ${loc}`);
  }
  return _full;
});

const llmsPath = path.join(ROOT, 'llms.txt');
if (!fs.existsSync(llmsPath)) {
  errors.push('brak pliku llms.txt');
}

if (errors.length > 0) {
  console.error('Sprint 1 hardening check FAILED:\n');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log('Sprint 1 hardening check OK');
