#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const INSPECT_ENDPOINT = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

function parseArgs(argv) {
  const out = {
    reportJson: path.join(ROOT, 'data', 'reports', 'gsc-indexing-watchdog.json'),
    reportMd: path.join(ROOT, 'data', 'reports', 'gsc-indexing-watchdog.md'),
    logFile: path.join(ROOT, 'data', 'reports', 'published-articles-log.json'),
    thresholdHours: 72,
    maxAgeDays: 30,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = String(argv[i] || '').trim();
    const v = String(argv[i + 1] || '').trim();
    if (t === '--report-json' && v) {
      out.reportJson = path.resolve(ROOT, v);
      i += 1;
      continue;
    }
    if (t === '--report-md' && v) {
      out.reportMd = path.resolve(ROOT, v);
      i += 1;
      continue;
    }
    if (t === '--log-file' && v) {
      out.logFile = path.resolve(ROOT, v);
      i += 1;
      continue;
    }
    if (t === '--threshold-hours' && v) {
      out.thresholdHours = Math.max(1, Number(v) || 72);
      i += 1;
      continue;
    }
    if (t === '--max-age-days' && v) {
      out.maxAgeDays = Math.max(1, Number(v) || 30);
      i += 1;
    }
  }
  return out;
}

function normalizeSiteUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (s.startsWith('sc-domain:')) return s;
  if (/^https?:\/\//i.test(s)) return s.endsWith('/') ? s : `${s}/`;
  return `https://${s.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
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
    const json = raw ? JSON.parse(raw) : JSON.parse(Buffer.from(String(b64), 'base64').toString('utf8'));
    if (!json.client_email || !json.private_key) throw new Error('Brak client_email/private_key.');
    return json;
  } catch (err) {
    throw new Error(`Niepoprawny service account JSON: ${err.message || err}`);
  }
}

function parseOauthRefreshFromEnv() {
  const clientId = String(process.env.GSC_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GSC_OAUTH_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GSC_OAUTH_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
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

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeMd(filePath, lines) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function safeDateMs(input) {
  const t = Date.parse(String(input || ''));
  return Number.isFinite(t) ? t : NaN;
}

function loadLog(logFile) {
  if (!fs.existsSync(logFile)) {
    return { version: 1, updated_at: new Date().toISOString(), items: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    return {
      version: 1,
      updated_at: String(parsed.updated_at || '').trim() || new Date().toISOString(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (_err) {
    return { version: 1, updated_at: new Date().toISOString(), items: [] };
  }
}

async function inspectUrl(accessToken, siteUrl, inspectionUrl) {
  const res = await fetch(INSPECT_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl,
      languageCode: 'pl-PL',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json);
    throw new Error(msg);
  }
  const r = json.inspectionResult || json.urlInspectionResult || {};
  const idx = r.indexStatusResult || {};
  return {
    verdict: String(r.verdict || '').trim(),
    coverageState: String(idx.coverageState || '').trim(),
    robotsTxtState: String(idx.robotsTxtState || '').trim(),
    indexingState: String(idx.indexingState || '').trim(),
    lastCrawlTime: String(idx.lastCrawlTime || '').trim(),
    pageFetchState: String(idx.pageFetchState || '').trim(),
    googleCanonical: String(idx.googleCanonical || '').trim(),
    userCanonical: String(idx.userCanonical || '').trim(),
    referrerUrls: Array.isArray(idx.referringUrls) ? idx.referringUrls : [],
  };
}

function buildReportSkeleton(siteUrl, logFile, args) {
  return {
    generated_at: new Date().toISOString(),
    status: 'ok',
    property: siteUrl,
    log_file: path.relative(ROOT, logFile),
    threshold_hours: args.thresholdHours,
    max_age_days: args.maxAgeDays,
    scanned: 0,
    pending_older_72h: 0,
    alerts: [],
    checked: [],
    auth_mode: '',
    error: '',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteUrl = normalizeSiteUrl(process.env.GSC_SITE_URL || 'https://fitpo50.pl/');
  const report = buildReportSkeleton(siteUrl, args.logFile, args);
  const log = loadLog(args.logFile);
  const now = Date.now();
  const thresholdMs = args.thresholdHours * 60 * 60 * 1000;
  const maxAgeMs = args.maxAgeDays * 24 * 60 * 60 * 1000;

  const candidates = (Array.isArray(log.items) ? log.items : [])
    .filter((it) => String(it.status || 'pending') !== 'crawled')
    .filter((it) => /^https?:\/\//i.test(String(it.url || '')))
    .filter((it) => {
      const t = safeDateMs(it.last_published_at || it.first_published_at);
      if (!Number.isFinite(t)) return false;
      const age = now - t;
      return age >= thresholdMs && age <= maxAgeMs;
    });

  if (!siteUrl) {
    report.status = 'missing_site_url';
    report.error = 'Brak GSC_SITE_URL.';
    writeJson(args.reportJson, report);
    writeMd(args.reportMd, [
      '# GSC Indexing Watchdog',
      '',
      `Wygenerowano: ${report.generated_at}`,
      'Status: missing_site_url',
      '',
      '- Brak `GSC_SITE_URL`.',
    ]);
    return;
  }

  let sa = null;
  const authErrors = [];
  try {
    sa = parseServiceAccountFromEnv();
  } catch (err) {
    authErrors.push(`service_account_parse: ${err.message || err}`);
  }
  const oauth = parseOauthRefreshFromEnv();
  if (!sa && !oauth) {
    report.status = 'missing_api_config';
    report.error = 'Brak konfiguracji API (service account lub OAuth refresh token).';
    writeJson(args.reportJson, report);
    writeMd(args.reportMd, [
      '# GSC Indexing Watchdog',
      '',
      `Wygenerowano: ${report.generated_at}`,
      'Status: missing_api_config',
      '',
      '- Ustaw sekrety GSC (service account albo OAuth).',
    ]);
    return;
  }

  let token = '';
  if (sa) {
    try {
      token = await getAccessToken(sa);
      report.auth_mode = 'service_account';
    } catch (err) {
      authErrors.push(`service_account: ${err.message || err}`);
    }
  }
  if (!token && oauth) {
    try {
      token = await getAccessTokenByRefreshToken(oauth);
      report.auth_mode = 'oauth_refresh_token';
    } catch (err) {
      authErrors.push(`oauth_refresh_token: ${err.message || err}`);
    }
  }
  if (!token) {
    report.status = 'auth_failed';
    report.error = authErrors.join(' | ');
    writeJson(args.reportJson, report);
    writeMd(args.reportMd, [
      '# GSC Indexing Watchdog',
      '',
      `Wygenerowano: ${report.generated_at}`,
      'Status: auth_failed',
      '',
      `- ${report.error || 'Nieznany błąd autoryzacji.'}`,
    ]);
    return;
  }

  const bySlug = new Map();
  for (const item of Array.isArray(log.items) ? log.items : []) {
    const slug = String(item.slug || '').trim();
    if (slug) bySlug.set(slug, item);
  }

  for (const item of candidates) {
    const slug = String(item.slug || '').trim();
    const url = String(item.url || '').trim();
    const publishedAt = String(item.last_published_at || item.first_published_at || '').trim();
    report.scanned += 1;
    try {
      const inspection = await inspectUrl(token, siteUrl, url);
      const crawlMs = safeDateMs(inspection.lastCrawlTime);
      const publishedMs = safeDateMs(publishedAt);
      const crawledAfterPublish = Number.isFinite(crawlMs) && Number.isFinite(publishedMs) && crawlMs >= (publishedMs - 6 * 60 * 60 * 1000);
      const update = bySlug.get(slug) || item;
      update.last_checked_at = new Date().toISOString();
      update.last_crawl_time = inspection.lastCrawlTime || '';
      update.notes = inspection.coverageState || inspection.indexingState || '';
      if (crawledAfterPublish) {
        update.status = 'crawled';
      } else {
        update.status = 'pending';
        report.pending_older_72h += 1;
        report.alerts.push({
          slug,
          url,
          published_at: publishedAt,
          last_crawl_time: inspection.lastCrawlTime || '(brak)',
          coverage_state: inspection.coverageState || '(brak)',
          indexing_state: inspection.indexingState || '(brak)',
          verdict: inspection.verdict || '(brak)',
        });
      }
      report.checked.push({
        slug,
        url,
        published_at: publishedAt,
        last_crawl_time: inspection.lastCrawlTime || '',
        crawled_after_publish: crawledAfterPublish,
      });
    } catch (err) {
      report.pending_older_72h += 1;
      report.alerts.push({
        slug,
        url,
        published_at: publishedAt,
        error: String(err.message || err),
      });
      const update = bySlug.get(slug) || item;
      update.last_checked_at = new Date().toISOString();
      update.status = 'pending';
      update.notes = `inspection_error: ${String(err.message || err)}`;
    }
  }

  log.items = [...bySlug.values()].sort((a, b) => String(b.last_published_at || '').localeCompare(String(a.last_published_at || '')));
  log.updated_at = new Date().toISOString();
  writeJson(args.logFile, log);
  writeJson(args.reportJson, report);

  const lines = [
    '# GSC Indexing Watchdog',
    '',
    `Wygenerowano: ${report.generated_at}`,
    `Status: ${report.status}`,
    `Property: ${report.property}`,
    `Auth mode: ${report.auth_mode || '(brak)'}`,
    `Próg alertu: ${report.threshold_hours}h`,
    `Sprawdzone URL: ${report.scanned}`,
    `Alerty >72h: ${report.pending_older_72h}`,
    '',
  ];
  if (!report.scanned) {
    lines.push('- Brak kandydatów do sprawdzenia (pending >=72h).');
  } else if (!report.alerts.length) {
    lines.push('- Wszystkie sprawdzone URL mają crawl po publikacji.');
  } else {
    lines.push('## URL wymagające reakcji');
    for (const it of report.alerts) {
      lines.push(`- ${it.url} (publikacja: ${it.published_at || 'brak'}, last crawl: ${it.last_crawl_time || 'brak'})`);
      if (it.error) lines.push(`  - błąd API: ${it.error}`);
      else lines.push(`  - verdict: ${it.verdict}, coverage: ${it.coverage_state}, indexing: ${it.indexing_state}`);
    }
  }
  writeMd(args.reportMd, lines);
  console.log('[PASS] gsc-indexing-watchdog report generated.');
  console.log(`- JSON: ${path.relative(ROOT, args.reportJson)}`);
  console.log(`- MD: ${path.relative(ROOT, args.reportMd)}`);
}

main().catch((err) => {
  console.error(`[FAIL] ${err.message || err}`);
  process.exit(1);
});

