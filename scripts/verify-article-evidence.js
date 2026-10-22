#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validateArticleEvidence } = require('./lib/article-evidence');
const { normalizePolishText } = require('./lib/article-normalization');

function parseArgs(argv) {
  const out = { write: false, timeout: 8000, refresh: false, 'cache-ttl-days': 7 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    const next = argv[i + 1];
    if (token === '--file') out.file = String(next || '').trim(), i += 1;
    else if (token === '--write') out.write = String(next || 'true').toLowerCase() !== 'false', i += 1;
    else if (token === '--timeout') out.timeout = Math.max(1000, Number(next || 8000)), i += 1;
    else if (token === '--cache-file') out['cache-file'] = String(next || '').trim(), i += 1;
    else if (token === '--http-fixture') out['http-fixture'] = String(next || '').trim(), i += 1;
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

function normalizeSuggestion(value) {
  return normalizePolishText(value);
}

async function decodeAutocompleteBody(response) {
  const bytes = await response.arrayBuffer();
  const contentType = String(response?.headers?.get?.('content-type') || '');
  const declared = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]?.toLowerCase();
  const aliases = { 'iso-8859-2': 'iso-8859-2', latin2: 'iso-8859-2', 'windows-1250': 'windows-1250', cp1250: 'windows-1250', 'utf-8': 'utf-8', utf8: 'utf-8' };
  if (declared && aliases[declared]) return new TextDecoder(aliases[declared]).decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (_error) {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

function parseAutocompleteSuggestions(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed?.[1])
      ? parsed[1].map((item) => String(item || '').trim()).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
}

function findExactAutocompleteSuggestion(question, suggestions) {
  const expected = normalizeSuggestion(question);
  return (Array.isArray(suggestions) ? suggestions : [])
    .find((suggestion) => normalizeSuggestion(suggestion) === expected) || '';
}

function cachedResult(cache, url, nowMs, ttlDays, requireSuggestions = false) {
  const entry = cache?.entries?.[url];
  const verifiedAt = Date.parse(String(entry?.verified_at || ''));
  const fresh = Number.isFinite(verifiedAt) && nowMs - verifiedAt <= ttlDays * 86400000;
  if (!fresh || entry.url_status !== 'reachable' || Number(entry.http_status || 0) < 1) return null;
  if (requireSuggestions && !Array.isArray(entry.suggestions)) return null;
  return {
    url_status: entry.url_status,
    http_status: Number(entry.http_status),
    final_url: String(entry.final_url || url),
    suggestions: Array.isArray(entry.suggestions) ? entry.suggestions : [],
    error: '',
    cached: true,
  };
}

function writeCache(cacheFile, cache) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  const temporary = `${cacheFile}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, cacheFile);
}

function classifyHttpStatus(status) {
  const code = Number(status || 0);
  if (code >= 200 && code < 400) return 'reachable';
  if ([401, 403, 405].includes(code)) return 'blocked_by_publisher';
  if (code === 429 || code >= 500) return 'temporarily_unavailable';
  if ([404, 410].includes(code)) return 'broken';
  return 'broken';
}

function isEnvironmentVerificationFailure(result) {
  return ['verification_failed', 'temporarily_unavailable'].includes(String(result?.url_status || ''));
}

async function requestUrl(url, timeout, options = {}) {
  const captureAutocomplete = options.captureAutocomplete === true;
  const headers = {
    'user-agent': 'Mozilla/5.0 (compatible; FitPo50EvidenceChecker/1.0; +https://fitpo50.pl/)',
    accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'accept-language': 'pl-PL,pl;q=0.9,en;q=0.7',
  };
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
    let response = await tryMethod(captureAutocomplete ? 'GET' : 'HEAD');
    if (!captureAutocomplete && [400, 403, 405, 501].includes(response.status)) response = await tryMethod('GET');
    const suggestions = captureAutocomplete && response.status >= 200 && response.status < 300
      ? parseAutocompleteSuggestions(await decodeAutocompleteBody(response))
      : [];
    return {
      url_status: classifyHttpStatus(response.status),
      http_status: response.status,
      final_url: response.url || url,
      suggestions,
      error: '',
    };
  } catch (err) {
    return {
      url_status: 'verification_failed',
      http_status: 0,
      final_url: url,
      suggestions: [],
      error: err.message || String(err),
    };
  }
}

async function requestSourceUrl(url, items, timeout, options = {}) {
  const requester = options.request || requestUrl;
  const requestOptions = { ...options };
  delete requestOptions.request;
  const primary = await requester(url, timeout, requestOptions);
  if (primary.url_status !== 'blocked_by_publisher' || ![403, 405].includes(Number(primary.http_status))) return { ...primary, checked_via: 'primary_url' };
  const fallbackUrl = String((Array.isArray(items) ? items : []).find((item) => /^https:\/\//i.test(String(item?.fallback_url || '')))?.fallback_url || '').trim();
  if (!fallbackUrl) return { ...primary, checked_via: 'primary_url' };
  const fallback = await requester(fallbackUrl, timeout, requestOptions);
  return {
    ...fallback,
    checked_via: 'fallback_url',
    fallback_url: fallbackUrl,
    publisher_http_status: primary.http_status,
    publisher_url_status: primary.url_status,
  };
}

function fixtureRequester(file) {
  const fixture = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  return async (url) => {
    const record = fixture?.responses?.[url];
    if (!record) return { url_status: 'verification_failed', http_status: 0, final_url: url, suggestions: [], error: `Brak atrapy URL: ${url}` };
    if (record.error) return { url_status: 'verification_failed', http_status: 0, final_url: url, suggestions: [], error: record.error };
    const status = Number(record.GET || record.HEAD || 0);
    return { url_status: classifyHttpStatus(status), http_status: status, final_url: url, suggestions: Array.isArray(record.suggestions) ? record.suggestions : [], error: '' };
  };
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
  const request = args['http-fixture'] ? fixtureRequester(args['http-fixture']) : requestUrl;
  const results = await Promise.all(entries.map(async ([url, items]) => {
    const captureAutocomplete = items.some((item) => String(item?.source_type || item?.sourceType || '').toLowerCase() === 'autocomplete');
    const result = (!args.refresh && cachedResult(cache, url, nowMs, args['cache-ttl-days'], captureAutocomplete))
      || await requestSourceUrl(url, items, args.timeout, { captureAutocomplete, request });
    const autocompleteItem = items.find((item) => String(item?.source_type || item?.sourceType || '').toLowerCase() === 'autocomplete');
    const suggestion = autocompleteItem ? findExactAutocompleteSuggestion(autocompleteItem.question, result.suggestions) : '';
    const verification = {
      checked_at: today,
      url_status: result.url_status,
      http_status: result.http_status,
      final_url: result.final_url,
      checked_via: result.checked_via || 'primary_url',
      ...(result.fallback_url ? { fallback_url: result.fallback_url } : {}),
      ...(result.publisher_http_status ? { publisher_http_status: result.publisher_http_status, publisher_url_status: result.publisher_url_status } : {}),
      ...(result.error ? { url_error: result.error } : {}),
      ...(autocompleteItem ? {
        intent_verified: Boolean(suggestion),
        intent_checked_at: today,
        ...(suggestion
          ? { verified_suggestion: suggestion }
          : { intent_verification_error: result.url_status === 'reachable' ? 'Odpowiedź Google Suggest nie zawiera pytania FAQ 1:1.' : 'Nie udało się pobrać odpowiedzi Google Suggest.' }),
      } : {}),
    };
    if (result.url_status === 'reachable' && result.http_status >= 200 && result.http_status < 300 && !result.cached) {
      cache.entries[url] = {
        verified_at: new Date(nowMs).toISOString(),
        url_status: result.url_status,
        http_status: result.http_status,
        final_url: result.final_url,
        suggestions: captureAutocomplete ? result.suggestions : undefined,
      };
    }
    return { url, ...result, verification, autocomplete_verified: captureAutocomplete ? Boolean(suggestion) : null };
  }));
  writeCache(cacheFile, cache);
  results.forEach((result) => console.log(`[EVIDENCE-URL] ${result.cached ? 'cache ' : ''}${result.url_status} ${result.http_status || '-'} ${result.url}${result.autocomplete_verified === null ? '' : ` autocomplete=${result.autocomplete_verified ? 'verified' : 'missing-question'}`}`));
  const environmentFailures = results.filter(isEnvironmentVerificationFailure);
  if (environmentFailures.length) {
    console.error(`\n[ENVIRONMENT_FAILURE] Nie udało się wiarygodnie sprawdzić ${environmentFailures.length} URL-i z powodu sieci, limitu albo chwilowej niedostępności. JSON nie jest oznaczany jako błędny; ponów weryfikację.`);
    process.exitCode = 30;
    return;
  }
  json.evidence_verification = {
    version: 1,
    checked_at: today,
    entries: Object.fromEntries(results.map((result) => [result.url, result.verification])),
  };
  if (args.write) fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
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

module.exports = {
  cachedResult,
  classifyHttpStatus,
  decodeAutocompleteBody,
  findExactAutocompleteSuggestion,
  fixtureRequester,
  isEnvironmentVerificationFailure,
  normalizeSuggestion,
  parseArgs,
  parseAutocompleteSuggestions,
  readCache,
  requestUrl,
  requestSourceUrl,
};
