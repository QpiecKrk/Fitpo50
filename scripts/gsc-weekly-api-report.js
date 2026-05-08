#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

function parseArgs(argv) {
  const out = {
    outputJson: path.join(ROOT, 'data', 'reports', 'gsc-weekly-report.json'),
    outputMd: path.join(ROOT, 'data', 'reports', 'gsc-weekly-report.md'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = String(argv[i] || '').trim();
    if (t === '--output-json') {
      out.outputJson = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (t === '--output-md') {
      out.outputMd = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
    }
  }
  return out;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseServiceAccountFromEnv() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.GSC_SERVICE_ACCOUNT_JSON_B64;
  if (!raw && !b64) return null;
  try {
    const json = raw
      ? JSON.parse(raw)
      : JSON.parse(Buffer.from(String(b64), 'base64').toString('utf8'));
    if (!json.client_email || !json.private_key) {
      throw new Error('Brak client_email/private_key w service account JSON.');
    }
    return json;
  } catch (err) {
    throw new Error(`Niepoprawny service account JSON w env: ${err.message || err}`);
  }
}

function parseOauthRefreshFromEnv() {
  const clientId = String(process.env.GSC_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GSC_OAUTH_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GSC_OAUTH_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

function dateIso(dayOffset) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

function currentAndPreviousRanges() {
  const endCurrent = dateIso(-1);
  const startCurrent = dateIso(-28);
  const endPrev = dateIso(-29);
  const startPrev = dateIso(-56);
  return {
    current: { start: startCurrent, end: endCurrent },
    previous: { start: startPrev, end: endPrev },
  };
}

function normalizeSiteUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (s.startsWith('sc-domain:')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

function signedJwt(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: GSC_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

async function getAccessToken(sa) {
  const assertion = signedJwt(sa.client_email, sa.private_key);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    const msg = json.error_description || json.error || JSON.stringify(json);
    throw new Error(`OAuth token error: ${msg}`);
  }
  return json.access_token;
}

async function getAccessTokenByRefreshToken(oauth) {
  const body = new URLSearchParams({
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    refresh_token: oauth.refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    const msg = json.error_description || json.error || JSON.stringify(json);
    throw new Error(`OAuth refresh token error: ${msg}`);
  }
  return json.access_token;
}

async function gscQuery(accessToken, siteUrl, requestBody) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json);
    throw new Error(`GSC query error: ${msg}`);
  }
  return json;
}

async function gscQueryAllRows(accessToken, siteUrl, baseBody) {
  const rowLimit = 25000;
  let startRow = 0;
  const all = [];
  while (true) {
    const body = { ...baseBody, rowLimit, startRow };
    const response = await gscQuery(accessToken, siteUrl, body);
    const rows = Array.isArray(response.rows) ? response.rows : [];
    all.push(...rows);
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
    if (startRow > 200000) break;
  }
  return all;
}

function metricFromRow(row) {
  return {
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0) * 100,
    position: Number(row.position || 0),
  };
}

function median(values) {
  const arr = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2) return arr[mid];
  return (arr[mid - 1] + arr[mid]) / 2;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeReport(report, outputJson, outputMd) {
  ensureDir(outputJson);
  ensureDir(outputMd);
  fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# GSC Weekly Report (API)');
  lines.push('');
  lines.push(`Wygenerowano: ${report.generated_at}`);
  lines.push(`Status: ${report.status}`);
  lines.push('');

  if (report.status !== 'ok') {
    lines.push('## Brak konfiguracji API');
    lines.push('- Ustaw `GSC_SITE_URL` (np. `sc-domain:fitpo50.pl` lub `https://fitpo50.pl/`).');
    lines.push('- Tryb 1 (service account): `GSC_SERVICE_ACCOUNT_JSON_B64`.');
    lines.push('- Tryb 2 (OAuth refresh token): `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_OAUTH_REFRESH_TOKEN`.');
    lines.push('- Wymagane uprawnienie w GSC: konto użyte do odczytu musi mieć minimum Read.');
  } else {
    lines.push('## Zakres dat');
    lines.push(`- Bieżący: ${report.ranges.current.start} -> ${report.ranges.current.end}`);
    lines.push(`- Poprzedni: ${report.ranges.previous.start} -> ${report.ranges.previous.end}`);
    lines.push('');
    lines.push('## KPI');
    lines.push(`- Kliknięcia: **${Math.round(report.summary.current.total_clicks)}** (prev: ${Math.round(report.summary.previous.total_clicks)})`);
    lines.push(`- Wyświetlenia: **${Math.round(report.summary.current.total_impressions)}** (prev: ${Math.round(report.summary.previous.total_impressions)})`);
    lines.push(`- CTR: **${report.summary.current.avg_ctr.toFixed(2)}%** (prev: ${report.summary.previous.avg_ctr.toFixed(2)}%)`);
    lines.push(`- Pozycja: **${report.summary.current.avg_position.toFixed(2)}** (prev: ${report.summary.previous.avg_position.toFixed(2)})`);
    lines.push('');
    lines.push('## Priorytet A: P1-3 i 0 klików');
    if (!report.opportunities.top3_zero_click.length) {
      lines.push('- Brak kandydatów.');
    } else {
      report.opportunities.top3_zero_click.slice(0, 10).forEach((r, idx) => {
        lines.push(`${idx + 1}. \`${r.query}\` — impr ${Math.round(r.impressions)}, pos ${r.position.toFixed(1)}, CTR ${r.ctr.toFixed(2)}%`);
      });
    }
    lines.push('');
    lines.push('## Priorytet B: CTR problemy (pozycja <=10)');
    if (!report.opportunities.ctr_problems.length) {
      lines.push('- Brak kandydatów.');
    } else {
      report.opportunities.ctr_problems.slice(0, 10).forEach((r, idx) => {
        lines.push(`${idx + 1}. \`${r.query}\` — impr ${Math.round(r.impressions)}, pos ${r.position.toFixed(1)}, CTR ${r.ctr.toFixed(2)}%`);
      });
    }
    lines.push('');
    lines.push('## Priorytet C: Kanibalizacja');
    if (!report.opportunities.cannibalization.length) {
      lines.push('- Brak kandydatów.');
    } else {
      report.opportunities.cannibalization.slice(0, 10).forEach((r, idx) => {
        lines.push(`${idx + 1}. \`${r.query}\` — URL: ${r.pages.length}, impr ${Math.round(r.total_impressions)}`);
      });
    }
    lines.push('');
    lines.push('## Plan tygodnia (auto)');
    report.weekly_plan.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
  }

  lines.push('');
  lines.push(`Property: ${report.property || '(brak)'}`);
  fs.writeFileSync(outputMd, `${lines.join('\n')}\n`, 'utf8');
}

function emptyReport(property) {
  return {
    generated_at: new Date().toISOString(),
    status: 'missing_api_config',
    property,
    ranges: {},
    summary: {
      current: { total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0 },
      previous: { total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0 },
    },
    opportunities: {
      top3_zero_click: [],
      ctr_problems: [],
      cannibalization: [],
      page_opportunities: [],
    },
    weekly_plan: [
      'Skonfiguruj GSC API secrets (service account albo OAuth refresh token) i uruchom workflow ponownie.',
      'Po konfiguracji raport sam wygeneruje priorytety tygodnia.',
    ],
  };
}

function aggregateSummary(rows) {
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const posWeighted = rows.reduce((s, r) => s + (r.position * r.impressions), 0);
  const avgPosition = totalImpressions > 0 ? posWeighted / totalImpressions : 0;
  return { total_clicks: totalClicks, total_impressions: totalImpressions, avg_ctr: avgCtr, avg_position: avgPosition };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const property = normalizeSiteUrl(process.env.GSC_SITE_URL || 'https://fitpo50.pl/');
  const sa = parseServiceAccountFromEnv();
  const oauth = parseOauthRefreshFromEnv();

  if ((!sa && !oauth) || !property) {
    const report = emptyReport(property);
    writeReport(report, args.outputJson, args.outputMd);
    console.log('[WARN] GSC API config missing. Generated reminder report.');
    console.log(`- JSON: ${path.relative(ROOT, args.outputJson)}`);
    console.log(`- MD: ${path.relative(ROOT, args.outputMd)}`);
    return;
  }

  const ranges = currentAndPreviousRanges();
  const token = sa
    ? await getAccessToken(sa)
    : await getAccessTokenByRefreshToken(oauth);

  const makeBody = (range, dimensions) => ({
    startDate: range.start,
    endDate: range.end,
    dimensions,
    type: 'web',
    aggregationType: dimensions.includes('page') ? 'byPage' : 'auto',
  });

  const [qCurrentRaw, qPrevRaw, pCurrentRaw, qpCurrentRaw] = await Promise.all([
    gscQueryAllRows(token, property, makeBody(ranges.current, ['query'])),
    gscQueryAllRows(token, property, makeBody(ranges.previous, ['query'])),
    gscQueryAllRows(token, property, makeBody(ranges.current, ['page'])),
    gscQueryAllRows(token, property, makeBody(ranges.current, ['query', 'page'])),
  ]);

  const queriesCurrent = qCurrentRaw.map((r) => ({
    query: String((r.keys || [])[0] || '').trim(),
    ...metricFromRow(r),
  })).filter((r) => r.query);
  const queriesPrev = qPrevRaw.map((r) => ({
    query: String((r.keys || [])[0] || '').trim(),
    ...metricFromRow(r),
  })).filter((r) => r.query);
  const pagesCurrent = pCurrentRaw.map((r) => ({
    page: String((r.keys || [])[0] || '').trim(),
    ...metricFromRow(r),
  })).filter((r) => r.page);
  const qpCurrent = qpCurrentRaw.map((r) => ({
    query: String((r.keys || [])[0] || '').trim(),
    page: String((r.keys || [])[1] || '').trim(),
    ...metricFromRow(r),
  })).filter((r) => r.query && r.page);

  const summaryCurrent = aggregateSummary(queriesCurrent);
  const summaryPrevious = aggregateSummary(queriesPrev);

  const top3Zero = queriesCurrent
    .filter((r) => r.clicks === 0 && r.position > 0 && r.position <= 3 && r.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  const pool = queriesCurrent.filter((r) => r.position > 0 && r.position <= 10 && r.impressions >= 80);
  const ctrMedian = median(pool.map((r) => r.ctr));
  const ctrProblems = pool
    .filter((r) => r.ctr <= Math.max(1.0, ctrMedian * 0.6))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30);

  const byQueryPage = new Map();
  for (const row of qpCurrent) {
    const key = row.query.toLowerCase();
    if (!byQueryPage.has(key)) byQueryPage.set(key, []);
    byQueryPage.get(key).push(row);
  }
  const cannibalization = [];
  for (const [query, rows] of byQueryPage.entries()) {
    const pagesMap = new Map();
    for (const r of rows) {
      const p = pagesMap.get(r.page) || { page: r.page, clicks: 0, impressions: 0, posWeighted: 0 };
      p.clicks += r.clicks;
      p.impressions += r.impressions;
      p.posWeighted += r.position * r.impressions;
      pagesMap.set(r.page, p);
    }
    if (pagesMap.size < 2) continue;
    const pages = [...pagesMap.values()].map((p) => ({
      page: p.page,
      clicks: p.clicks,
      impressions: p.impressions,
      position: p.impressions > 0 ? p.posWeighted / p.impressions : 0,
      ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
    }));
    const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
    if (totalImpressions < 30) continue;
    cannibalization.push({
      query,
      total_impressions: totalImpressions,
      pages: pages.sort((a, b) => b.impressions - a.impressions).slice(0, 4),
    });
  }
  cannibalization.sort((a, b) => b.total_impressions - a.total_impressions);

  const pageOpportunities = pagesCurrent
    .filter((r) => r.position > 0 && r.position <= 20 && r.impressions >= 80)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  const topA = top3Zero[0];
  const topB = ctrProblems[0];
  const topC = cannibalization[0];
  const topP = pageOpportunities[0];

  const report = {
    generated_at: new Date().toISOString(),
    status: 'ok',
    property,
    ranges,
    summary: {
      current: summaryCurrent,
      previous: summaryPrevious,
    },
    opportunities: {
      top3_zero_click: top3Zero,
      ctr_problems: ctrProblems,
      cannibalization: cannibalization.slice(0, 20),
      page_opportunities: pageOpportunities,
    },
    weekly_plan: [
      topA
        ? `Zoptymalizuj URL pod "${topA.query}" (P1-3 i 0 klików).`
        : 'Brak P1-3 i 0 klików: skup się na CTR w top10.',
      topB
        ? `Popraw title/meta + quick-answer dla "${topB.query}" (niski CTR).`
        : 'Brak krytycznych CTR problemów: wzmacniaj top strony po impresjach.',
      topC
        ? `Rozwiąż kanibalizację dla "${topC.query}" (1 intencja = 1 główny URL).`
        : 'Brak silnej kanibalizacji: utrzymuj mapowanie intencji.',
      topP
        ? `Dołóż 2-3 linki wewnętrzne do ${topP.page}.`
        : 'Dołóż linki do niedolinkowanych artykułów.',
      'Po wdrożeniu: request indexing + pomiar po 7 dniach.',
    ],
  };

  writeReport(report, args.outputJson, args.outputMd);
  console.log('[PASS] GSC API weekly report generated.');
  console.log(`- JSON: ${path.relative(ROOT, args.outputJson)}`);
  console.log(`- MD: ${path.relative(ROOT, args.outputMd)}`);
  console.log(`- opportunities: top3_zero=${top3Zero.length}, ctr=${ctrProblems.length}, cannibalization=${cannibalization.length}`);
}

main().catch((err) => {
  console.error(`[FAIL] gsc-weekly-api-report: ${err.message || err}`);
  process.exit(1);
});
