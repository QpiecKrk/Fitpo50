#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validateArticleEvidence } = require('./lib/article-evidence');

function parseArgs(argv) {
  const out = { write: false, timeout: 8000, refresh: false, 'cache-ttl-days': 7 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    const next = argv[i + 1];
    if (token === '--file') out.file = String(next || '').trim(), i += 1;
    else if (token === '--write') out.write = String(next || 'true').toLowerCase() !== 'false', i += 1;
    else if (token === '--timeout') out.timeout = Math.max(1000, Number(next || 8000)), i += 1;
    else if (token === '--cache-file') out['cache-file'] = String(next || '').trim(), i += 1;
    else if (token === '--cache-ttl-days') out['cache-ttl-days'] = Math.max(1, Number(next || 7)), i += 1;
    else if (token === '--refresh') out.refresh = String(next || 'true').toLowerCase() !== 'false', i += 1;
  }
  return out;
}

function readCache(cacheFile) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    return parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object'
      ? parsed
      : { version: 1, entries: {} };
  } catch (_error) {
    return { version: 1, entries: {} };
  }
}

function cachedResult(cache, url, nowMs, ttlDays) {
  const entry = cache?.entries?.[url];
  const verifiedAt = Date.parse(String(entry?.verified_at || ''));
  const fresh = Number.isFinite(verifiedAt) && nowMs - verifiedAt <= ttlDays * 86400000;
  if (!fresh || entry.url_status !== 'reachable' || Number(entry.http_status || 0) < 1) return null;
  return {
    url_status: entry.url_status,
    http_status: Number(entry.http_status),
    final_url: String(entry.final_url || url),
    error: '',
    cached: true,
  };
}

function writeCache(cacheFile, cache) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function classifyHttpStatus(status) {
  const code = Number(status || 0);
  if ((code >= 200 && code < 400) || [401, 403, 429].includes(code)) return 'reachable';
  return 'broken';
}

async function requestUrl(url, timeout) {
  const headers = { 'user-agent': 'FitPo50-Evidence-Checker/1.0', accept: 'text/html,application/json;q=0.9,*/*;q=0.8' };
  const tryMethod = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { method, redirect: 'follow', headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let response = await tryMethod('HEAD');
    if ([400, 405, 501].includes(response.status)) response = await tryMethod('GET');
    return {
      url_status: classifyHttpStatus(response.status),
      http_status: response.status,
      final_url: response.url || url,
      error: '',
    };
  } catch (err) {
    return {
      url_status: 'verification_failed',
      http_status: 0,
      final_url: url,
      error: err.message || String(err),
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Użycie: node scripts/verify-article-evidence.js --file <article.fitpo50.json> [--write true] [--timeout 8000]');
    process.exit(1);
  }
  const file = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(file)) throw new Error(`Brak pliku: ${file}`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const collections = [
    ...(Array.isArray(json.sources) ? json.sources : []),
    ...(Array.isArray(json.faq_research) ? json.faq_research : []),
  ];
  const urlToItems = new Map();
  collections.forEach((item) => {
    const url = String(item?.url || item?.source_url || item?.sourceUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    if (!urlToItems.has(url)) urlToItems.set(url, []);
    urlToItems.get(url).push(item);
  });
  const today = new Date().toISOString().slice(0, 10);
  const cacheFile = path.resolve(process.cwd(), args['cache-file'] || path.join('.cache', 'article-evidence-urls.json'));
  const cache = readCache(cacheFile);
  const nowMs = Date.now();
  const entries = [...urlToItems.entries()];
  const results = await Promise.all(entries.map(async ([url, items]) => {
    const result = (!args.refresh && cachedResult(cache, url, nowMs, args['cache-ttl-days']))
      || await requestUrl(url, args.timeout);
    items.forEach((item) => {
      item.checked_at = today;
      item.url_status = result.url_status;
      item.http_status = result.http_status;
      item.final_url = result.final_url;
      if (result.error) item.url_error = result.error;
      else delete item.url_error;
    });
    if (result.url_status === 'reachable' && !result.cached) {
      cache.entries[url] = {
        verified_at: new Date(nowMs).toISOString(),
        url_status: result.url_status,
        http_status: result.http_status,
        final_url: result.final_url,
      };
    }
    return { url, ...result };
  }));
  writeCache(cacheFile, cache);
  if (args.write) fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  results.forEach((result) => console.log(`[EVIDENCE-URL] ${result.cached ? 'cache ' : ''}${result.url_status} ${result.http_status || '-'} ${result.url}`));
  const validation = validateArticleEvidence(json, { today });
  if (!validation.ok) {
    console.error('\n[FAIL] Evidence gate');
    validation.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(`[PASS] Evidence gate: urls=${results.length} medical=${validation.medicalArticle ? 'true' : 'false'}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[FAIL] verify-article-evidence -> ${err.message || err}`);
    process.exit(1);
  });
}

module.exports = { cachedResult, classifyHttpStatus, parseArgs, readCache, requestUrl };
