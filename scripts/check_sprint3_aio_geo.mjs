#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_HOST = 'fitpo50.pl';
const errors = [];

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

function hasExternalCitationCandidate(html) {
  const articleMatch = html.match(/<article class="article-content"[\s\S]*?<\/article>/i);
  const source = articleMatch ? articleMatch[0] : html;
  const regex = /href="(https?:\/\/[^"]+)"/gi;
  let match;
  while ((match = regex.exec(source))) {
    try {
      const host = new URL(match[1]).hostname;
      if (host !== SITE_HOST && !host.endsWith(`.${SITE_HOST}`)) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

for (const file of htmlFiles) {
  const fullPath = path.join(ROOT, file);
  const html = fs.readFileSync(fullPath, 'utf8');

  if (!/"@type":\s*"BlogPosting"/.test(html)) continue;

  if (!/class="key-takeaways/i.test(html)) {
    errors.push(`${file}: brak bloku "Kluczowe wnioski" (key-takeaways)`);
  }
  if (!/"about":\s*\[/m.test(html)) {
    errors.push(`${file}: brak "about" w BlogPosting JSON-LD`);
  }
  if (!/"mentions":\s*\[/m.test(html)) {
    errors.push(`${file}: brak "mentions" w BlogPosting JSON-LD`);
  }
  if (hasExternalCitationCandidate(html) && !/"citation":\s*\[/m.test(html)) {
    errors.push(`${file}: brak "citation" mimo linków zewnętrznych`);
  }
}

if (errors.length > 0) {
  console.error('Sprint 3 AIO/GEO check FAILED:\n');
  errors.forEach((err) => console.error(`- ${err}`));
  process.exit(1);
}

console.log('Sprint 3 AIO/GEO check OK');
