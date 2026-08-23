#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    bdquo: '„',
    gt: '>',
    ldquo: '“',
    lt: '<',
    mdash: '—',
    ndash: '–',
    nbsp: ' ',
    oacute: 'ó',
    quot: '"',
    rdquo: '”'
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function plainText(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function findFaqPage(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFaqPage(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (value['@type'] === 'FAQPage') return value;
  for (const child of Object.values(value)) {
    const found = findFaqPage(child);
    if (found) return found;
  }
  return null;
}

function visibleFaq(html) {
  const section = html.match(/<section\b[^>]*class=["'][^"']*\bfaq-list\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i);
  if (!section) return [];
  const items = [];
  const articlePattern = /<article\b[^>]*class=["'][^"']*\bfaq-item\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
  for (const article of section[1].matchAll(articlePattern)) {
    const question = article[1].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const answer = article[1].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!question || !answer) continue;
    items.push({
      '@type': 'Question',
      name: plainText(question[1]),
      acceptedAnswer: {
        '@type': 'Answer',
        text: plainText(answer[1])
      }
    });
  }
  return items;
}

function syncFile(file) {
  const absolute = path.resolve(file);
  let html = fs.readFileSync(absolute, 'utf8');
  const items = visibleFaq(html);
  if (items.length === 0) throw new Error(`${file}: brak widocznego FAQ.`);

  let updated = false;
  html = html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, open, content, close) => {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return whole;
    }
    const faqPage = findFaqPage(parsed);
    if (!faqPage) return whole;
    if (updated) throw new Error(`${file}: więcej niż jeden schemat FAQPage.`);
    faqPage.mainEntity = items;
    updated = true;
    return `${open}\n${JSON.stringify(parsed, null, 2)}\n${close}`;
  });

  if (!updated) throw new Error(`${file}: brak schematu FAQPage.`);
  fs.writeFileSync(absolute, html);
  console.log(`[FAQ-SYNC] ${file}: ${items.length} pytań.`);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Użycie: node scripts/sync-visible-faq-schema.js <plik.html> [...]');
  process.exit(1);
}

try {
  files.forEach(syncFile);
} catch (error) {
  console.error(`[FAQ-SYNC] ${error.message}`);
  process.exit(1);
}
