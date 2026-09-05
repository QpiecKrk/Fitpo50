#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pageKind } = require('./lib/publication-page-kind');

const ROOT_DIR = path.resolve(__dirname, '..');
const LLMS_TXT_PATH = path.join(ROOT_DIR, 'llms.txt');
const DEFAULT_OUTPUT = path.join(ROOT_DIR, 'llms-full.txt');
const BASE_URL = 'https://fitpo50.pl/';

function parseArgs(argv) {
  const args = { output: null, limit: 999 };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--output') {
      args.output = argv[i + 1] || null;
      i += 1;
    } else if (token === '--limit') {
      const raw = Number(argv[i + 1] || 999);
      args.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 999;
      i += 1;
    }
  }
  return args;
}

function decodeHtmlEntities(input) {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeSpace(input) {
  return input.replace(/\s+/g, ' ').trim();
}

function stripTags(input) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function sanitizeText(input) {
  return normalizeSpace(decodeHtmlEntities(stripTags(input || '')));
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseLlmsArticleUrls(llmsTxt) {
  const lines = llmsTxt.split(/\r?\n/);
  const urls = [];
  for (const line of lines) {
    const match = line.match(/^\s*-\s*url:\s*(https?:\/\/\S+)\s*$/i);
    if (!match) continue;
    const value = match[1].trim();
    if (!value.startsWith(BASE_URL)) continue;
    urls.push(value);
  }
  const seen = new Set();
  const unique = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }
  return unique;
}

function toSlug(url) {
  return url.replace(BASE_URL, '').replace(/^\//, '');
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  const raw = m ? sanitizeText(m[1]) : '';
  return raw.replace(/\s*\|\s*FitPo50\s*$/i, '').trim();
}

function extractDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? sanitizeText(m[1]) : '';
}

function extractArticleHtml(html) {
  if (pageKind(html) === 'topic_center') return html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
  const m = html.match(/<article[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i);
  return m ? m[1] : '';
}

function articleToMarkdown(articleHtml) {
  let text = articleHtml;
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  text = text.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = decodeHtmlEntities(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function buildDocument(items) {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('# FitPo50 — llms-full.txt');
  lines.push('');
  lines.push(`source: ${BASE_URL}`);
  lines.push('language: pl-PL');
  lines.push(`generated_at: ${now}`);
  lines.push(`articles_count: ${items.length}`);
  lines.push('');
  for (const item of items) {
    lines.push(`## ${item.title || item.slug}`);
    lines.push(`URL: ${item.url}`);
    if (item.description) lines.push(`Opis: ${item.description}`);
    lines.push('');
    lines.push(item.content || '(Brak treści artykułu)');
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

function loadItems(limit) {
  if (!fileExists(LLMS_TXT_PATH)) {
    throw new Error('Brak pliku llms.txt');
  }
  const llmsTxt = fs.readFileSync(LLMS_TXT_PATH, 'utf8');
  const urls = parseLlmsArticleUrls(llmsTxt).slice(0, limit);
  const items = [];

  for (const url of urls) {
    const slug = toSlug(url);
    const filePath = path.join(ROOT_DIR, slug);
    if (!fileExists(filePath)) continue;
    const html = fs.readFileSync(filePath, 'utf8');
    const articleHtml = extractArticleHtml(html);
    if (!articleHtml) continue;
    items.push({
      url,
      slug,
      title: extractTitle(html),
      description: extractDescription(html),
      content: articleToMarkdown(articleHtml),
    });
  }
  return items;
}

function writeOutput(filePath, content) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const items = loadItems(args.limit);
  const content = buildDocument(items);
  writeOutput(DEFAULT_OUTPUT, content);

  if (args.output) {
    const outPath = path.isAbsolute(args.output)
      ? args.output
      : path.join(ROOT_DIR, args.output);
    writeOutput(outPath, content);
  }

  console.log(`[PASS] llms-full generated: ${items.length} articles`);
  console.log(`- source: ${path.relative(ROOT_DIR, DEFAULT_OUTPUT)}`);
  if (args.output) {
    const outPath = path.isAbsolute(args.output) ? args.output : path.join(ROOT_DIR, args.output);
    console.log(`- export: ${path.relative(ROOT_DIR, outPath)}`);
  }
}

main();
