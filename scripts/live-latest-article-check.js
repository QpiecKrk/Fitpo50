#!/usr/bin/env node
/* eslint-disable no-console */

const DEFAULT_BASE_URL = 'https://fitpo50.pl';
const ALLOW_NET_FAILURES = String(process.env.ALLOW_NET_FAILURES || '1') === '1';

function parseArgs(argv) {
  const out = {
    baseUrl: DEFAULT_BASE_URL,
    retries: 4,
    delayMs: 2000,
    timeoutMs: 30000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = String(argv[i] || '').trim();
    const v = String(argv[i + 1] || '').trim();
    if (t === '--base-url' && v) {
      out.baseUrl = v;
      i += 1;
      continue;
    }
    if (t === '--retries' && v) {
      out.retries = Math.max(0, Number(v) || 0);
      i += 1;
      continue;
    }
    if (t === '--delay-ms' && v) {
      out.delayMs = Math.max(0, Number(v) || 0);
      i += 1;
      continue;
    }
    if (t === '--timeout-ms' && v) {
      out.timeoutMs = Math.max(1000, Number(v) || 30000);
      i += 1;
    }
  }
  out.baseUrl = String(out.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextWithRetry(url, cfg) {
  let lastErr = null;
  for (let i = 0; i <= cfg.retries; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'fitpo50-live-check/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (i < cfg.retries) await sleep(cfg.delayMs);
    }
  }
  throw lastErr || new Error(`Fetch failed: ${url}`);
}

function isLikelyNetworkError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  const name = String((err && err.name) || '').toLowerCase();
  return (
    name === 'aborterror' ||
    msg.includes('fetch failed') ||
    msg.includes('timed out') ||
    msg.includes('eai_again') ||
    msg.includes('enotfound') ||
    msg.includes('getaddrinfo') ||
    msg.includes('networkerror')
  );
}

function firstArticleHrefFromPorady(html) {
  const anchors = String(html || '').match(/<a\b[^>]*>/gi) || [];
  for (const tag of anchors) {
    if (!/\bdata-article-item\b/i.test(tag)) continue;
    const hrefMatch = tag.match(/\bhref=(['"])([^'"]+\.html)\1/i);
    if (hrefMatch) return String(hrefMatch[2] || '').trim();
  }
  return '';
}

function normalizeAbsolute(baseUrl, href) {
  if (!href) return '';
  try {
    return new URL(String(href).trim(), `${String(baseUrl).replace(/\/+$/, '')}/`).toString();
  } catch (_err) {
    if (/^https?:\/\//i.test(href)) return href;
    return `${baseUrl}/${String(href).replace(/^\/+/, '')}`;
  }
}

function ensureCanonical(articleHtml, expectedUrl) {
  const m = articleHtml.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  if (!m) {
    throw new Error('Brak <link rel="canonical"> na stronie artykułu.');
  }
  const canonical = String(m[1] || '').trim();
  if (canonical !== expectedUrl) {
    throw new Error(`Canonical mismatch. expected=${expectedUrl}, got=${canonical}`);
  }
}

function ensureIndexableRobots(articleHtml) {
  const robotsMeta = articleHtml.match(/<meta\s+name="robots"\s+content="([^"]+)"/i);
  if (!robotsMeta) return;
  const content = String(robotsMeta[1] || '').toLowerCase();
  if (/\bnoindex\b/.test(content)) {
    throw new Error(`Meta robots zawiera noindex: ${content}`);
  }
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const poradyUrl = `${cfg.baseUrl}/porady.html`;
  console.log(`[LIVE-CHECK] base=${cfg.baseUrl}`);
  console.log(`[LIVE-CHECK] fetch: ${poradyUrl}`);
  const porady = await fetchTextWithRetry(poradyUrl, cfg);
  if (!porady.ok) {
    throw new Error(`porady.html HTTP ${porady.status}`);
  }
  const href = firstArticleHrefFromPorady(porady.text);
  if (!href) {
    throw new Error('Nie znaleziono first data-article-item href w porady.html');
  }
  const articleUrl = normalizeAbsolute(cfg.baseUrl, href);
  console.log(`[LIVE-CHECK] latest article: ${articleUrl}`);
  const article = await fetchTextWithRetry(articleUrl, cfg);
  if (!article.ok) {
    throw new Error(`latest article HTTP ${article.status}`);
  }
  ensureCanonical(article.text, articleUrl);
  ensureIndexableRobots(article.text);
  console.log('[PASS] live-latest-article-check OK');
}

main().catch((err) => {
  if (ALLOW_NET_FAILURES && isLikelyNetworkError(err)) {
    console.log(`[WARN] live-latest-article-check soft-pass (network): ${err.message || err}`);
    process.exit(0);
  }
  console.error(`[FAIL] ${err.message || err}`);
  process.exit(1);
});
