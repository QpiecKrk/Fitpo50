#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DEFAULT_REPORT_DIR = process.env.FITPO50_GROWTH_REPORT_DIR
  ? path.resolve(process.env.FITPO50_GROWTH_REPORT_DIR)
  : path.join(os.homedir(), 'Downloads', 'fitpo50-growth-reports');

function unquoteEnvValue(value) {
  const raw = String(value || '').trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) process.env[key] = unquoteEnvValue(value);
  }
}

loadEnvFile(path.join(os.homedir(), '.fitpo50-ga.env'));
loadEnvFile(path.join(os.homedir(), '.fitpo50-gsc.env'));

function parseArgs(argv) {
  const out = {
    outputDir: DEFAULT_REPORT_DIR,
    outputJson: '',
    outputMd: '',
    csv: String(process.env.GA4_PAGES_CSV || '').trim(),
    days: 28,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    const value = String(argv[i + 1] || '').trim();
    if (token === '--output-dir' && value) {
      out.outputDir = path.resolve(ROOT, value.replace(/^~(?=$|\/)/, os.homedir()));
      i += 1;
    } else if (token === '--output-json' && value) {
      out.outputJson = path.resolve(ROOT, value.replace(/^~(?=$|\/)/, os.homedir()));
      i += 1;
    } else if (token === '--output-md' && value) {
      out.outputMd = path.resolve(ROOT, value.replace(/^~(?=$|\/)/, os.homedir()));
      i += 1;
    } else if (token === '--csv' && value) {
      out.csv = path.resolve(ROOT, value.replace(/^~(?=$|\/)/, os.homedir()));
      i += 1;
    } else if (token === '--days' && value) {
      out.days = Math.max(1, Number(value) || 28);
      i += 1;
    }
  }
  if (!out.outputJson) out.outputJson = path.join(out.outputDir, 'ga-report.json');
  if (!out.outputMd) out.outputMd = path.join(out.outputDir, 'ga-report.md');
  if (!out.csv) out.csv = path.join(ROOT, 'data', 'ga4', 'pages.csv');
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, payload) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeText(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${String(content || '').trimEnd()}\n`, 'utf8');
}

function dateIso(dayOffset) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

function currentRange(days) {
  return { start: dateIso(-days), end: dateIso(-1) };
}

function nowIso() {
  return new Date().toISOString();
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseServiceAccountFromEnv() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON || process.env.GSC_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.GA4_SERVICE_ACCOUNT_JSON_B64 || process.env.GSC_SERVICE_ACCOUNT_JSON_B64;
  if (!raw && !b64) return null;
  const json = raw
    ? JSON.parse(raw)
    : JSON.parse(Buffer.from(String(b64), 'base64').toString('utf8'));
  if (!json.client_email || !json.private_key) {
    throw new Error('Brak client_email/private_key w service account JSON.');
  }
  return json;
}

function parseOauthRefreshFromEnv() {
  const clientId = String(process.env.GA4_OAUTH_CLIENT_ID || process.env.GSC_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GA4_OAUTH_CLIENT_SECRET || process.env.GSC_OAUTH_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GA4_OAUTH_REFRESH_TOKEN || process.env.GSC_OAUTH_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

function signedJwt(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: GA4_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64url(signer.sign(privateKey))}`;
}

async function getAccessToken(sa) {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedJwt(sa.client_email, sa.private_key),
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || JSON.stringify(json));
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
    throw new Error(json.error_description || json.error || JSON.stringify(json));
  }
  return json.access_token;
}

async function gaRunReport(accessToken, propertyId, requestBody) {
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || JSON.stringify(json));
  return json;
}

function metricValue(row, index) {
  return Number(row.metricValues?.[index]?.value || 0) || 0;
}

function dimensionValue(row, index) {
  return String(row.dimensionValues?.[index]?.value || '').trim();
}

function normalizePath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '(not set)') return '';
  try {
    const parsed = new URL(raw);
    return parsed.pathname.replace(/^\/+/, '') || 'index.html';
  } catch (_) {
    return raw.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '') || 'index.html';
  }
}

function aggregateChannelRows(rows) {
  const byPage = new Map();
  for (const row of rows || []) {
    const file = normalizePath(row.path);
    if (!file) continue;
    const current = byPage.get(file) || { organic: 0, direct: 0, social: 0, referral: 0, other: 0, channels: [] };
    const channel = String(row.channel || '').toLowerCase();
    const views = Number(row.views || 0);
    if (channel.includes('organic')) current.organic += views;
    else if (channel.includes('direct')) current.direct += views;
    else if (channel.includes('social')) current.social += views;
    else if (channel.includes('referral')) current.referral += views;
    else current.other += views;
    current.channels.push({ channel: row.channel || '(not set)', views });
    byPage.set(file, current);
  }
  return byPage;
}

function mergePageAndChannelRows(pageRows, channelRows) {
  const channels = aggregateChannelRows(channelRows);
  return pageRows.map((row) => {
    const file = normalizePath(row.path);
    const channel = channels.get(file) || { organic: 0, direct: 0, social: 0, referral: 0, other: 0, channels: [] };
    const activeUsers = Number(row.activeUsers || 0);
    const engagementSeconds = Number(row.userEngagementDuration || 0);
    return {
      file,
      path: row.path,
      title: row.title,
      views: Math.round(Number(row.views || 0)),
      active_users: Math.round(activeUsers),
      sessions: Math.round(Number(row.sessions || 0)),
      engagement_seconds: Math.round(engagementSeconds),
      avg_engagement_seconds_per_active_user: activeUsers > 0 ? Number((engagementSeconds / activeUsers).toFixed(2)) : 0,
      channels: {
        organic: Math.round(channel.organic),
        direct: Math.round(channel.direct),
        social: Math.round(channel.social),
        referral: Math.round(channel.referral),
        other: Math.round(channel.other),
      },
      channel_rows: channel.channels.sort((a, b) => b.views - a.views).slice(0, 8),
    };
  }).filter((row) => row.file && row.file.endsWith('.html'));
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsvRows(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function parseNumber(value) {
  return Number(String(value || '0').replace(/\s/g, '').replace(',', '.')) || 0;
}

function findColumn(row, patterns) {
  const entries = Object.entries(row || {});
  const found = entries.find(([key]) => patterns.some((rx) => rx.test(String(key || ''))));
  return found ? found[1] : '';
}

function findEntry(row, patterns) {
  const entries = Object.entries(row || {});
  return entries.find(([key]) => patterns.some((rx) => rx.test(String(key || '')))) || ['', ''];
}

function csvReport(args, reason) {
  const rows = parseCsvRows(args.csv);
  const pages = rows.map((row) => {
    const pathValue = findColumn(row, [/path/i, /ścieżka/i, /strona/i, /page/i, /screen/i]);
    const views = findColumn(row, [/views/i, /wyświetlenia/i, /screenPageViews/i]);
    const activeUsers = findColumn(row, [/active.*users/i, /aktywni/i]);
    const engagementEntry = findEntry(row, [/engagement/i, /zaangaż/i, /czas/i]);
    const engagement = engagementEntry[1];
    const engagementHeader = String(engagementEntry[0] || '');
    const sessions = findColumn(row, [/sessions/i, /sesje/i]);
    const file = normalizePath(pathValue);
    const activeUsersNumber = parseNumber(activeUsers);
    const engagementNumber = parseNumber(engagement);
    const isAverageEngagement = /avg|average|średni|sredni/i.test(engagementHeader);
    const engagementSeconds = isAverageEngagement ? engagementNumber * Math.max(1, activeUsersNumber) : engagementNumber;
    return {
      file,
      path: pathValue,
      title: findColumn(row, [/title/i, /tytuł/i]),
      views: Math.round(parseNumber(views)),
      active_users: Math.round(activeUsersNumber),
      sessions: Math.round(parseNumber(sessions)),
      engagement_seconds: Math.round(engagementSeconds),
      avg_engagement_seconds_per_active_user: activeUsersNumber > 0
        ? Number((engagementSeconds / activeUsersNumber).toFixed(2))
        : 0,
      channels: { organic: 0, direct: 0, social: 0, referral: 0, other: 0 },
      channel_rows: [],
    };
  }).filter((row) => row.file && row.file.endsWith('.html'));

  return makeReport({
    status: pages.length ? 'ok_csv' : 'CONFIG_MISSING',
    authMode: pages.length ? 'csv' : 'none',
    property: String(process.env.GA4_PROPERTY_ID || '').trim(),
    range: currentRange(args.days),
    pages,
    warnings: pages.length
      ? [`Użyto CSV: ${args.csv}`, reason].filter(Boolean)
      : [
        reason || 'Brak konfiguracji GA4 API.',
        'Ustaw GA4_PROPERTY_ID oraz GA4_SERVICE_ACCOUNT_JSON_B64 albo GA4_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN.',
        `Alternatywnie wyeksportuj CSV z GA4 Pages and screens do: ${args.csv}`,
      ],
  });
}

function summarizePages(pages) {
  return {
    pages: pages.length,
    views: pages.reduce((sum, row) => sum + Number(row.views || 0), 0),
    active_users: pages.reduce((sum, row) => sum + Number(row.active_users || 0), 0),
    sessions: pages.reduce((sum, row) => sum + Number(row.sessions || 0), 0),
    engagement_seconds: pages.reduce((sum, row) => sum + Number(row.engagement_seconds || 0), 0),
  };
}

function makeReport({ status, authMode, property, range, pages, warnings }) {
  const sorted = [...pages].sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  return {
    generated_at: nowIso(),
    status,
    auth_mode: authMode,
    property,
    range,
    summary: summarizePages(sorted),
    pages: sorted,
    warnings: warnings || [],
  };
}

async function apiReport(args, propertyId, accessToken, authMode) {
  const range = currentRange(args.days);
  const dateRanges = [{ startDate: range.start, endDate: range.end }];
  const pageResponse = await gaRunReport(accessToken, propertyId, {
    dateRanges,
    dimensions: [{ name: 'unifiedPagePathScreen' }, { name: 'pageTitle' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'userEngagementDuration' },
    ],
    limit: 250,
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  });
  const channelResponse = await gaRunReport(accessToken, propertyId, {
    dateRanges,
    dimensions: [{ name: 'unifiedPagePathScreen' }, { name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'screenPageViews' }],
    limit: 1000,
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  });
  const pageRows = (pageResponse.rows || []).map((row) => ({
    path: dimensionValue(row, 0),
    title: dimensionValue(row, 1),
    views: metricValue(row, 0),
    activeUsers: metricValue(row, 1),
    sessions: metricValue(row, 2),
    userEngagementDuration: metricValue(row, 3),
  }));
  const channelRows = (channelResponse.rows || []).map((row) => ({
    path: dimensionValue(row, 0),
    channel: dimensionValue(row, 1),
    views: metricValue(row, 0),
  }));
  return makeReport({
    status: 'ok',
    authMode,
    property: propertyId,
    range,
    pages: mergePageAndChannelRows(pageRows, channelRows),
    warnings: [],
  });
}

function writeMarkdown(report, file) {
  const lines = ['# GA4 Report', '', `Wygenerowano: ${report.generated_at}`, '', `Status: ${report.status}`, ''];
  lines.push('## Zakres');
  lines.push(`- property: ${report.property || '(brak)'}`);
  lines.push(`- auth: ${report.auth_mode || '(brak)'}`);
  lines.push(`- daty: ${report.range?.start || '?'} – ${report.range?.end || '?'}`);
  lines.push('');
  lines.push('## Podsumowanie');
  lines.push(`- strony: ${report.summary.pages}`);
  lines.push(`- wyświetlenia: ${report.summary.views}`);
  lines.push(`- aktywni użytkownicy: ${report.summary.active_users}`);
  lines.push(`- sesje: ${report.summary.sessions}`);
  lines.push(`- engagement seconds: ${report.summary.engagement_seconds}`);
  if (report.warnings?.length) {
    lines.push('');
    lines.push('## Uwagi');
    report.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }
  lines.push('');
  lines.push('## Top strony');
  report.pages.slice(0, 40).forEach((row, index) => {
    lines.push(`${index + 1}. ${row.file}`);
    lines.push(`   - views ${row.views}, active_users ${row.active_users}, sessions ${row.sessions}, avg_engagement ${row.avg_engagement_seconds_per_active_user}s`);
    lines.push(`   - channels: organic ${row.channels.organic}, direct ${row.channels.direct}, social ${row.channels.social}, referral ${row.channels.referral}, other ${row.channels.other}`);
  });
  writeText(file, lines.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const propertyId = String(process.env.GA4_PROPERTY_ID || process.env.GA_PROPERTY_ID || '').trim().replace(/^properties\//, '');
  let report = null;
  const errors = [];
  let sa = null;
  try {
    sa = parseServiceAccountFromEnv();
  } catch (err) {
    errors.push(`service_account_parse: ${err.message || err}`);
  }
  const oauth = parseOauthRefreshFromEnv();

  if (propertyId && sa) {
    try {
      const token = await getAccessToken(sa);
      report = await apiReport(args, propertyId, token, 'service_account');
    } catch (err) {
      errors.push(`service_account: ${err.message || err}`);
    }
  }
  if (!report && propertyId && oauth) {
    try {
      const token = await getAccessTokenByRefreshToken(oauth);
      report = await apiReport(args, propertyId, token, 'oauth_refresh_token');
    } catch (err) {
      errors.push(`oauth_refresh_token: ${err.message || err}`);
    }
  }
  if (!report) {
    report = csvReport(args, errors.join(' | ') || (!propertyId ? 'Brak GA4_PROPERTY_ID.' : 'Brak działającej konfiguracji GA4 API.'));
  }

  writeJson(args.outputJson, report);
  writeMarkdown(report, args.outputMd);
  console.log(`[GA4] ${report.status} -> ${args.outputMd}`);
  if (report.warnings?.length) report.warnings.slice(0, 3).forEach((warning) => console.log(`[GA4][WARN] ${warning}`));
}

main().catch((err) => {
  const args = parseArgs(process.argv.slice(2));
  const report = csvReport(args, err.message || String(err));
  writeJson(args.outputJson, report);
  writeMarkdown(report, args.outputMd);
  console.error(`[GA4][WARN] ${err.message || err}`);
  process.exit(0);
});
