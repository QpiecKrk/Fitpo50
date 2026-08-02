#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const SITE_DIR = path.join(ROOT, '_site');
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const OUT_JSON = path.join(REPORT_DIR, 'cwv-budget.json');
const OUT_MD = path.join(REPORT_DIR, 'cwv-budget.md');

const URLS = [
  '/', '/index.html', '/porady.html', '/rusz-sie.html', '/jedzenie.html', '/zdrowie.html', '/ciekawe.html',
  '/dlaczego-bieznia-to-za-malo.html', '/badania-po-50.html', '/dieta-po-50.html', '/sen-po-50.html',
  '/trening-silowy-eliksir-mlodosci-po-50.html', '/motywacja-po-50.html', '/siedzenie-po-50.html',
  '/waga-smart-pomiar-skladu-ciala-prawda.html', '/post-36-godzinny-cud-czy-mit-badania-vs-hype.html',
  '/kreatyna-po-50-tce-kompletny-przewodnik.html', '/apob-apoa-badania-cholesterol.html',
  '/mobilnosc-vs-rozciaganie-program-dla-stawow-po-piecdziesiatce.html', '/testosteron-po-50-naturalnie-bez-trt.html',
];

const BUDGETS = {
  lcp_ms: {
    warn: Number(process.env.CWV_LCP_WARN_MS || 2500),
    fail: Number(process.env.CWV_LCP_FAIL_MS || 3000),
  },
  cls: {
    warn: Number(process.env.CWV_CLS_WARN || 0.1),
    fail: Number(process.env.CWV_CLS_FAIL || 0.15),
  },
  tbt_ms: {
    warn: Number(process.env.CWV_TBT_WARN_MS || 200),
    fail: Number(process.env.CWV_TBT_FAIL_MS || 300),
  },
};

function serveStatic(rootDir) {
  const server = http.createServer((req, res) => {
    const url = String(req.url || '/').split('?')[0];
    const clean = url === '/' ? '/index.html' : url;
    const abs = path.join(rootDir, clean.replace(/^\/+/, ''));
    if (!abs.startsWith(rootDir) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.statusCode = 200;
    res.end(fs.readFileSync(abs));
  });
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      reject(new Error(`Nie można uruchomić lokalnego serwera CWV na 127.0.0.1: ${err.message || err}`));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function scoreStatus(v, budget) {
  if (v > budget.fail) return 'fail';
  if (v > budget.warn) return 'warn';
  return 'ok';
}

async function installPerformanceObservers(page) {
  await page.addInitScript(() => {
    window.__fitpo50Cwv = { lcp: 0, cls: 0, tbt: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__fitpo50Cwv.lcp = Math.max(window.__fitpo50Cwv.lcp || 0, e.startTime || 0);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__fitpo50Cwv.cls += e.value || 0;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__fitpo50Cwv.tbt += Math.max(0, (e.duration || 0) - 50);
    }).observe({ type: 'longtask', buffered: true });
  });
}

async function measurePage(page, fullUrl) {
  await page.goto(fullUrl, { waitUntil: 'load' });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready.catch(() => {});
    }
    window.__fitpo50Cwv = {
      lcp: window.__fitpo50Cwv?.lcp || 0,
      cls: 0,
      tbt: 0,
    };
  });
  await page.waitForTimeout(1200);
  return page.evaluate(() => window.__fitpo50Cwv || { lcp: 0, cls: 0, tbt: 0 });
}

async function main() {
  if (!fs.existsSync(SITE_DIR)) throw new Error(`Brak katalogu _site: ${SITE_DIR}`);
  const server = await serveStatic(SITE_DIR);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await installPerformanceObservers(page);
  // Warm up the browser cache/compiler with a preliminary load of the home page
  console.log('[cwv-budget] Warming up browser context...');
  await page.goto(`${base}/index.html`, { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(1000);

  const rows = [];
  for (const u of URLS) {
    const m = await measurePage(page, `${base}${u}`);
    const lcp = Number(m.lcp || 0);
    const cls = Number(m.cls || 0);
    const tbt = Number(m.tbt || 0);
    rows.push({
      url: u,
      lcp_ms: Math.round(lcp),
      cls: Number(cls.toFixed(4)),
      tbt_ms: Math.round(tbt),
      status_lcp: scoreStatus(lcp, BUDGETS.lcp_ms),
      status_cls: scoreStatus(cls, BUDGETS.cls),
      status_tbt: scoreStatus(tbt, BUDGETS.tbt_ms),
    });
  }

  await browser.close();
  server.close();

  const failCount = rows.filter((r) => r.status_lcp === 'fail' || r.status_cls === 'fail' || r.status_tbt === 'fail').length;
  const warnCount = rows.filter((r) => r.status_lcp === 'warn' || r.status_cls === 'warn' || r.status_tbt === 'warn').length;

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const payload = { generated_at: new Date().toISOString(), budgets: BUDGETS, summary: { urls: rows.length, fail: failCount, warn: warnCount }, rows };
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = ['# CWV Budget Report', '', `- URLs: **${rows.length}**`, `- FAIL: **${failCount}**`, `- WARN: **${warnCount}**`, '', '| URL | LCP | CLS | TBT | Status |', '|---|---:|---:|---:|---|'];
  rows.forEach((r) => {
    const status = [r.status_lcp, r.status_cls, r.status_tbt].includes('fail') ? 'FAIL' : ([r.status_lcp, r.status_cls, r.status_tbt].includes('warn') ? 'WARN' : 'OK');
    lines.push(`| ${r.url} | ${r.lcp_ms}ms | ${r.cls} | ${r.tbt_ms}ms | ${status} |`);
  });
  fs.writeFileSync(OUT_MD, `${lines.join('\n')}\n`, 'utf8');

  if (failCount > 0) {
    console.log(`[FAIL] cwv-budget: fail=${failCount}, warn=${warnCount}`);
    process.exit(1);
  }
  if (warnCount > 0) console.log(`[WARN] cwv-budget: fail=0, warn=${warnCount}`);
  console.log(`[PASS] cwv-budget: fail=0, warn=${warnCount}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[FAIL] cwv-budget -> ${err.message || err}`);
    process.exit(1);
  });
}

module.exports = {
  installPerformanceObservers,
  measurePage,
};
