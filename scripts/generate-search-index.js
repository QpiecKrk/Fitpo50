#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(ROOT_DIR, 'assets', 'data', 'search-index.json');

function parseArgs(argv) {
  const args = { output: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--output') {
      args.output = argv[i + 1] || null;
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

function stripTags(input) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeSpace(input) {
  return input.replace(/\s+/g, ' ').trim();
}

function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function extractFirst(html, regex) {
  const match = html.match(regex);
  return match ? normalizeSpace(decodeHtmlEntities(stripTags(match[1] || ''))) : '';
}

function extractAll(html, regex) {
  const output = [];
  let match = regex.exec(html);
  while (match) {
    const value = normalizeSpace(decodeHtmlEntities(stripTags(match[1] || '')));
    if (value) output.push(value);
    match = regex.exec(html);
  }
  return output;
}

function deriveCategory(bodyClass, sectionMeta, articlePath) {
  const normalizedBodyClass = (bodyClass || '').toLowerCase();
  const normalizedSection = (sectionMeta || '').toLowerCase();
  const source = `${normalizedBodyClass} ${normalizedSection} ${articlePath.toLowerCase()}`;

  if (source.includes('ruch')) return 'Ruch';
  if (source.includes('jedzenie')) return 'Jedzenie';
  if (source.includes('zdrowie')) return 'Zdrowie';
  if (source.includes('ciekawe')) return 'Ciekawe';
  return 'Porady';
}

function isArticleHtml(html) {
  return /<body[^>]*class="[^"]*article-template[^"]*"/i.test(html) && /<article[^>]*class="[^"]*article-content[^"]*"/i.test(html);
}

function buildEntry(fileName, html) {
  const title = extractFirst(html, /<title>([\s\S]*?)<\/title>/i).replace(/\|\s*FitPo50\s*$/i, '').trim();
  const description = extractFirst(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const bodyClass = extractFirst(html, /<body[^>]*class="([^"]+)"/i);
  const sectionMeta = extractFirst(html, /<meta\s+property="article:section"\s+content="([^"]*)"/i);
  const readTime = extractFirst(html, /<span[^>]*>\s*(\d+\s*min\s*czytania)\s*<\/span>/i);

  const articleMatch = html.match(/<article[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i);
  const articleHtml = articleMatch ? articleMatch[1] : '';

  const headings = extractAll(articleHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  const content = normalizeSpace(decodeHtmlEntities(stripTags(articleHtml)));

  if (!title || !content) {
    return null;
  }

  return {
    slug: fileName,
    url: fileName,
    title,
    category: deriveCategory(bodyClass, sectionMeta, fileName),
    readTime: readTime || '',
    description,
    headings,
    content
  };
}

function generateIndex() {
  const files = fs.readdirSync(ROOT_DIR)
    .filter((name) => name.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b, 'pl'));

  const index = [];

  for (const fileName of files) {
    const filePath = path.join(ROOT_DIR, fileName);
    const html = readFileIfExists(filePath);
    if (!html || !isArticleHtml(html)) continue;

    const entry = buildEntry(fileName, html);
    if (entry) index.push(entry);
  }

  return index;
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const index = generateIndex();

  writeJson(DEFAULT_OUTPUT, index);

  if (args.output) {
    const outputPath = path.isAbsolute(args.output) ? args.output : path.join(ROOT_DIR, args.output);
    writeJson(outputPath, index);
  }

  console.log(`[PASS] search-index generated: ${index.length} entries`);
  console.log(`- source: ${path.relative(ROOT_DIR, DEFAULT_OUTPUT)}`);
  if (args.output) {
    console.log(`- export: ${path.relative(ROOT_DIR, path.isAbsolute(args.output) ? args.output : path.join(ROOT_DIR, args.output))}`);
  }
}

main();
