#!/usr/bin/env node

const { spawnSync } = require('child_process');

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function changedFiles() {
  const diff = run('git', ['diff', '--name-only', 'origin/main...HEAD']);
  if (diff.status !== 0) {
    const msg = String(diff.stderr || diff.stdout || '').trim();
    throw new Error(`Nie udało się odczytać diff origin/main...HEAD: ${msg}`);
  }
  return String(diff.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isArticleHtml(file) {
  const normalized = String(file || '').trim();
  if (!normalized.endsWith('.html')) return false;
  if (normalized.startsWith('_site/')) return false;
  const blocked = new Set([
    'article-template-bento.html',
    'index.html',
    'porady.html',
    'jedzenie.html',
    'zdrowie.html',
    'rusz-sie.html',
    'ciekawe.html',
    'o-mnie.html',
    'kontakt.html',
    'narzedzia.html',
  ]);
  return !blocked.has(normalized);
}

function getFileAtRef(ref, file) {
  const res = run('git', ['show', `${ref}:${file}`]);
  if (res.status !== 0) return '';
  return String(res.stdout || '');
}

function normalizeContent(text) {
  return String(text || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArticleBody(raw) {
  const article = String(raw || '').match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  return article ? article[1] : '';
}

function extractMetaModified(raw) {
  const m = String(raw || '').match(/<meta\s+property="article:modified_time"\s+content="([^"]+)"/i);
  return m ? String(m[1] || '').trim() : '';
}

function extractSchemaModified(raw) {
  for (const m of String(raw || '').matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(String(m[1] || '').trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const type = node['@type'];
        const isBlog = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
        if (!isBlog) continue;
        return String(node.dateModified || '').trim();
      }
    } catch (_err) {
      continue;
    }
  }
  return '';
}

function hasSubstantiveChange(prevRaw, nextRaw) {
  const prevBody = normalizeContent(extractArticleBody(prevRaw));
  const nextBody = normalizeContent(extractArticleBody(nextRaw));
  return prevBody !== nextBody;
}

function main() {
  const files = changedFiles().filter(isArticleHtml);
  if (!files.length) {
    console.log('[PASS] date-modified-guard - brak zmian w stronach artykułów.');
    return;
  }

  const errors = [];
  for (const file of files) {
    const prevRaw = getFileAtRef('origin/main', file);
    const nextRaw = getFileAtRef('HEAD', file);
    if (!prevRaw || !nextRaw) continue;
    if (!hasSubstantiveChange(prevRaw, nextRaw)) continue;

    const prevMeta = extractMetaModified(prevRaw);
    const nextMeta = extractMetaModified(nextRaw);
    const prevSchema = extractSchemaModified(prevRaw);
    const nextSchema = extractSchemaModified(nextRaw);

    if (prevMeta === nextMeta) {
      errors.push(`${file}: zmieniono treść artykułu, ale article:modified_time nie został zaktualizowany.`);
    }
    if (prevSchema === nextSchema) {
      errors.push(`${file}: zmieniono treść artykułu, ale BlogPosting.dateModified nie został zaktualizowany.`);
    }
  }

  if (errors.length) {
    console.log('\n[FAIL] date-modified-guard');
    for (const err of errors) console.log(`- ${err}`);
    process.exit(1);
  }

  console.log(`[PASS] date-modified-guard - sprawdzono pliki: ${files.length}`);
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] date-modified-guard -> ${err.message || err}`);
  process.exit(1);
}
