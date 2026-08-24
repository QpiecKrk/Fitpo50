#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validateArticleEvidence } = require('./lib/article-evidence');

function parseArgs(argv) {
  const out = { write: false, timeout: 8000 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    const next = argv[i + 1];
    if (token === '--file') out.file = String(next || '').trim(), i += 1;
    else if (token === '--write') out.write = String(next || 'true').toLowerCase() !== 'false', i += 1;
    else if (token === '--timeout') out.timeout = Math.max(1000, Number(next || 8000)), i += 1;
  }
  return out;
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
    return { url_status: 'broken', http_status: 0, final_url: url, error: err.message || String(err) };
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
  const entries = [...urlToItems.entries()];
  const results = await Promise.all(entries.map(async ([url, items]) => {
    const result = await requestUrl(url, args.timeout);
    items.forEach((item) => {
      item.checked_at = today;
      item.url_status = result.url_status;
      item.http_status = result.http_status;
      item.final_url = result.final_url;
      if (result.error) item.url_error = result.error;
      else delete item.url_error;
    });
    return { url, ...result };
  }));
  if (args.write) fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  results.forEach((result) => console.log(`[EVIDENCE-URL] ${result.url_status} ${result.http_status || '-'} ${result.url}`));
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

module.exports = { classifyHttpStatus, parseArgs, requestUrl };
