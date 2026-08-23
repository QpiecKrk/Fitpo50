#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const https = require('https');

const ROOT = process.cwd();
const DEFAULT_DOWNLOADS_DIR = process.env.GSC_DOWNLOADS_DIR || path.join(os.homedir(), 'Downloads');
const DEFAULT_WORK_DIR = process.env.GSC_WORK_DIR || path.join(DEFAULT_DOWNLOADS_DIR, 'gsc-auto-input');

function loadLocalEnvFromHome() {
  const envFile = path.join(os.homedir(), '.fitpo50-gsc.env');
  if (!fs.existsSync(envFile)) return false;
  const raw = fs.readFileSync(envFile, 'utf8');
  const lines = String(raw || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = String(match[1] || '').trim();
    let value = String(match[2] || '').trim();
    if (!key) continue;
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  return true;
}

function parseArgs(argv) {
  const out = {
    repo: process.env.GSC_GH_REPO || 'QpiecKrk/Fitpo50',
    artifact: process.env.GSC_GH_ARTIFACT_NAME || 'gsc-csv',
    downloadsDir: DEFAULT_DOWNLOADS_DIR,
    workDir: DEFAULT_WORK_DIR,
    preferGithub: true,
    cleanupRepoArtifacts: String(process.env.GSC_CLEAN_REPO_ARTIFACTS || '').toLowerCase() === 'true',
    skipPoprawSeo: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = String(argv[i] || '').trim();
    if (t === '--repo') {
      out.repo = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (t === '--artifact') {
      out.artifact = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (t === '--downloads-dir') {
      out.downloadsDir = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (t === '--work-dir') {
      out.workDir = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (t === '--no-github') {
      out.preferGithub = false;
    }
    if (t === '--cleanup-repo-artifacts') {
      out.cleanupRepoArtifacts = true;
    }
    if (t === '--skip-popraw-seo') {
      out.skipPoprawSeo = true;
    }
  }
  return out;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function httpGetJson(url, headers = {}, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const status = Number(res.statusCode || 0);
      const location = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location && redirectsLeft > 0) {
        res.resume();
        httpGetJson(location, headers, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`JSON parse failed: ${err.message}`));
        }
      });
    });
    req.on('error', reject);
  });
}

function httpDownloadFile(url, outFile, headers = {}, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const status = Number(res.statusCode || 0);
      const location = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location && redirectsLeft > 0) {
        res.resume();
        httpDownloadFile(location, outFile, headers, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }
      if (status < 200 || status >= 300) {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => reject(new Error(`HTTP ${status}: ${Buffer.concat(chunks).toString('utf8').slice(0, 300)}`)));
        return;
      }
      const ws = fs.createWriteStream(outFile);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve()));
      ws.on('error', reject);
    });
    req.on('error', reject);
  });
}

function normalizeKey(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsvQuick(text) {
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = src.split('\n')[0] || '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const score = firstLine.split(d).length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  const headers = firstLine.split(best).map((x) => x.replace(/^"|"$/g, '').trim());
  return headers;
}

function detectTypeFromHeaders(headers) {
  const keys = headers.map(normalizeKey);
  const hasQuery = keys.some((k) => /(^| )query( |$)|(^| )zapytan/.test(k));
  const hasPage = keys.some((k) => /(^| )page( |$)|(^| )stron/.test(k));
  if (hasQuery && hasPage) return 'query_pages';
  if (hasQuery) return 'queries';
  if (hasPage) return 'pages';
  return 'unknown';
}

function walkFiles(dir, collector = []) {
  if (!fs.existsSync(dir)) return collector;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      walkFiles(abs, collector);
    } else {
      collector.push(abs);
    }
  }
  return collector;
}

function collectCsvByType(files) {
  const byType = { queries: [], pages: [], query_pages: [] };
  for (const file of files) {
    if (!file.toLowerCase().endsWith('.csv')) continue;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const headers = parseCsvQuick(raw);
      const type = detectTypeFromHeaders(headers);
      if (!byType[type]) continue;
      const st = fs.statSync(file);
      const lines = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const nonEmpty = lines.filter((line) => line.trim() !== '').length;
      const dataRows = Math.max(0, nonEmpty - 1);
      byType[type].push({ file, mtimeMs: st.mtimeMs, dataRows });
    } catch (_) {
      // ignore unreadable
    }
  }
  for (const type of Object.keys(byType)) {
    byType[type].sort((a, b) => b.mtimeMs - a.mtimeMs);
  }
  return byType;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanupRepoGscArtifacts() {
  const targets = [
    path.join(ROOT, '.tmp-gsc-auto-input'),
    path.join(ROOT, '_site', '.tmp-gsc-auto-input'),
    path.join(ROOT, 'data', 'gsc', 'pages.csv'),
    path.join(ROOT, 'data', 'gsc', 'queries.csv'),
    path.join(ROOT, 'data', 'gsc', 'query-pages.csv'),
    path.join(ROOT, 'data', 'gsc', 'query_pages.csv'),
  ];
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyTypedCsvToInput(byType, inputDir) {
  ensureDir(inputDir);
  const mapping = {
    queries: 'queries.csv',
    pages: 'pages.csv',
    query_pages: 'query-pages.csv',
  };
  const copied = {};
  for (const [type, filename] of Object.entries(mapping)) {
    if (!byType[type] || !byType[type][0]) continue;
    const src = byType[type][0].file;
    const dst = path.join(inputDir, filename);
    fs.copyFileSync(src, dst);
    copied[type] = dst;
    // Keep both naming variants to avoid future pipeline breaks.
    if (type === 'query_pages') {
      const aliasDst = path.join(inputDir, 'query_pages.csv');
      fs.copyFileSync(src, aliasDst);
      copied.query_pages_alias = aliasDst;
    }
  }
  return copied;
}

function haveAllThree(byType) {
  const hasQueries = Boolean(byType.queries?.some((entry) => Number(entry.dataRows || 0) > 0));
  const hasPages = Boolean(byType.pages?.some((entry) => Number(entry.dataRows || 0) > 0));
  const hasQueryPages = Boolean(byType.query_pages?.some((entry) => Number(entry.dataRows || 0) > 0));
  return hasQueries && hasPages && hasQueryPages;
}

function buildRefreshTokenInstructions() {
  return [
    'TOKEN_EXPIRED: token OAuth jest niewazny/wygasl.',
    '',
    'Jak odswiezyc GSC_OAUTH_REFRESH_TOKEN:',
    '1) Otworz Google OAuth Playground: https://developers.google.com/oauthplayground',
    '2) Kliknij ikone kola zebatego i wlacz "Use your own OAuth credentials".',
    '3) Wklej GSC_OAUTH_CLIENT_ID oraz GSC_OAUTH_CLIENT_SECRET z lokalnego pliku ~/.fitpo50-gsc.env.',
    '4) W polu zakresu wpisz: https://www.googleapis.com/auth/webmasters.readonly',
    '5) Kliknij "Authorize APIs", zaloguj sie na konto z dostepem do Search Console i zaakceptuj zgode.',
    '6) Kliknij "Exchange authorization code for tokens".',
    '7) Skopiuj nowy refresh_token.',
    '8) Otworz ~/.fitpo50-gsc.env i podmien tylko linie GSC_OAUTH_REFRESH_TOKEN na nowa wartosc.',
    '9) Uruchom ponownie: npm run gsc:auto',
    '',
    'Uwaga: nie wklejaj tokenu w rozmowie z agentem. Trzymaj go tylko lokalnie w ~/.fitpo50-gsc.env.',
    'Jesli OAuth Playground odrzuci klienta, w Google Cloud Console dodaj redirect URI: https://developers.google.com/oauthplayground',
  ].join('\n');
}

function tryGenerateCsvFromApi(workDir) {
  const outputJson = path.join(workDir, 'gsc-weekly-report-api.json');
  const outputMd = path.join(workDir, 'gsc-weekly-report-api.md');
  const res = run(
    'node',
    [
      'scripts/gsc-weekly-api-report.js',
      '--output-json',
      outputJson,
      '--output-md',
      outputMd,
      '--output-csv-dir',
      workDir,
    ],
    { cwd: ROOT },
  );
  if (res.status !== 0) {
    return { ok: false, reason: 'gsc-weekly-api-report exited with non-zero status.' };
  }

  let apiReport = null;
  if (fs.existsSync(outputJson)) {
    try {
      apiReport = JSON.parse(fs.readFileSync(outputJson, 'utf8'));
    } catch (_) {
      apiReport = null;
    }
  }

  if (apiReport && apiReport.status !== 'ok') {
    if (apiReport.status === 'auth_failed') {
      const err = String(apiReport.error || '').toLowerCase();
      if (err.includes('invalid_grant') || err.includes('token has been expired') || err.includes('token has been expired or revoked')) {
        return { ok: false, reason: buildRefreshTokenInstructions() };
      }
      return { ok: false, reason: `AUTH_FAILED: brak autoryzacji GSC API (${String(apiReport.error || 'brak szczegolow')}).` };
    }
    if (apiReport.status === 'missing_api_config') {
      return { ok: false, reason: 'MISSING_API_CONFIG: brak konfiguracji OAuth (GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET / GSC_OAUTH_REFRESH_TOKEN / GSC_SITE_URL).' };
    }
    return { ok: false, reason: `GSC API status=${apiReport.status}; stare CSV nie zostały uznane za świeży wynik.` };
  }

  const typed = collectCsvByType(walkFiles(workDir));
  if (!haveAllThree(typed)) {
    if (apiReport && apiReport.status === 'auth_failed') {
      const err = String(apiReport.error || '').toLowerCase();
      if (err.includes('invalid_grant') || err.includes('token has been expired') || err.includes('token has been expired or revoked')) {
        return {
          ok: false,
          reason: buildRefreshTokenInstructions(),
        };
      }
      return {
        ok: false,
        reason: `AUTH_FAILED: brak autoryzacji GSC API (${String(apiReport.error || 'brak szczegolow')}).`,
      };
    }
    if (apiReport && apiReport.status === 'missing_api_config') {
      return {
        ok: false,
        reason: 'MISSING_API_CONFIG: brak konfiguracji OAuth (GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET / GSC_OAUTH_REFRESH_TOKEN / GSC_SITE_URL).',
      };
    }
    return { ok: false, reason: 'GSC API nie dostarczylo kompletu niepustych CSV.' };
  }
  return { ok: true };
}

function tryGithubArtifact(repo, artifactName, tempDir) {
  const ghCheck = run('gh', ['--version']);
  if (ghCheck.status !== 0) {
    return { ok: false, reason: 'Brak gh CLI.' };
  }

  const list = run('gh', ['run', 'list', '-R', repo, '-L', '30', '--json', 'databaseId,status,conclusion,headBranch,createdAt']);
  if (list.status !== 0) {
    return { ok: false, reason: `gh run list failed: ${list.stderr || list.stdout}` };
  }

  let runs = [];
  try {
    runs = JSON.parse(list.stdout || '[]');
  } catch {
    runs = [];
  }
  const candidates = runs.filter((r) => r && r.status === 'completed' && r.conclusion === 'success');
  for (const runItem of candidates) {
    const runId = String(runItem.databaseId || '').trim();
    if (!runId) continue;
    const dl = run('gh', ['run', 'download', runId, '-R', repo, '-n', artifactName, '--dir', tempDir]);
    if (dl.status === 0) {
      return { ok: true, runId };
    }
  }
  return { ok: false, reason: `Nie znaleziono artefaktu "${artifactName}" w ostatnich sukcesach.` };
}

async function tryGithubArtifactViaApi(repo, artifactName, tempDir) {
  const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
  const headers = {
    'User-Agent': 'fitpo50-gsc-auto',
    'Accept': 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const runsUrl = `https://api.github.com/repos/${repo}/actions/runs?status=success&per_page=30`;
  const runsPayload = await httpGetJson(runsUrl, headers);
  const runs = Array.isArray(runsPayload?.workflow_runs) ? runsPayload.workflow_runs : [];
  if (!runs.length) {
    return { ok: false, reason: 'Brak udanych workflow runs w API.' };
  }

  for (const runItem of runs) {
    const runId = Number(runItem?.id || 0);
    if (!runId) continue;
    const artifactsUrl = `https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`;
    let artifactsPayload;
    try {
      artifactsPayload = await httpGetJson(artifactsUrl, headers);
    } catch (_err) {
      continue;
    }
    const artifacts = Array.isArray(artifactsPayload?.artifacts) ? artifactsPayload.artifacts : [];
    const artifact = artifacts.find((a) => String(a?.name || '') === artifactName && !a?.expired);
    if (!artifact || !artifact.archive_download_url) continue;

    const zipPath = path.join(tempDir, `artifact-${runId}.zip`);
    try {
      await httpDownloadFile(String(artifact.archive_download_url), zipPath, headers);
    } catch (_err) {
      continue;
    }
    const unzip = run('unzip', ['-o', zipPath, '-d', tempDir]);
    if (unzip.status !== 0) continue;
    return { ok: true, runId: String(runId), via: 'api' };
  }

  return { ok: false, reason: `Nie znaleziono artefaktu "${artifactName}" przez API.` };
}

function tryExtractZipFromDownloads(downloadsDir, tempDir) {
  if (!fs.existsSync(downloadsDir)) return { ok: false, reason: 'Brak katalogu Downloads.' };
  const zips = fs.readdirSync(downloadsDir)
    .filter((n) => n.toLowerCase().endsWith('.zip') && /(search|console|gsc|skutecznosc|performance|fitpo50)/i.test(n))
    .map((name) => {
      const abs = path.join(downloadsDir, name);
      const st = fs.statSync(abs);
      return { abs, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!zips.length) return { ok: false, reason: 'Brak pasującego ZIP w Downloads.' };
  const latest = zips[0].abs;
  const unzip = run('unzip', ['-o', latest, '-d', tempDir]);
  if (unzip.status !== 0) {
    return { ok: false, reason: `unzip failed: ${unzip.stderr || unzip.stdout}` };
  }
  return { ok: true, zip: latest };
}

function runWeeklyReport(inputDir, workDir) {
  const outputJson = path.join(workDir, 'gsc-weekly-report.json');
  const outputMd = path.join(workDir, 'gsc-weekly-report.md');
  const res = run(
    'node',
    ['scripts/gsc-weekly-csv-report.js', '--input-dir', inputDir, '--output-json', outputJson, '--output-md', outputMd],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) {
    throw new Error('gsc-weekly-csv-report failed.');
  }
}

function runPriorityMap(inputDir, workDir) {
  const res = run(
    'node',
    ['scripts/gsc-priority-map.js', '--input-dir', inputDir, '--output-dir', workDir],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) {
    throw new Error('gsc-priority-map failed.');
  }
}

function runSeoAioMachine(inputDir, workDir) {
  const res = run(
    'node',
    ['scripts/seo-aio-command-center.js', '--input-dir', inputDir, '--output-dir', workDir],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) {
    throw new Error('seo-aio-command-center failed.');
  }
}

function runSeoAioWaveProposal(workDir) {
  const res = run(
    'node',
    [
      'scripts/seo-aio-wave-autopilot.js',
      '--input',
      path.join(workDir, 'seo-aio-command-center.json'),
      '--output-dir',
      workDir,
      '--wave',
      '1',
      '--limit',
      '5',
    ],
    { stdio: 'inherit' },
  );
  if (res.status !== 0) {
    throw new Error('seo-aio-wave-autopilot failed.');
  }
}

function runPoprawSeo(workDir, downloadsDir) {
  const reportDir = process.env.FITPO50_GROWTH_REPORT_DIR || path.join(downloadsDir, 'fitpo50-growth-reports');
  const res = run('node', ['scripts/growth-tool.js', 'popraw-seo'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      GSC_WORK_DIR: workDir,
      FITPO50_GROWTH_REPORT_DIR: reportDir,
    },
  });
  if (res.status !== 0) throw new Error('popraw-seo failed.');
  console.log(`[GSC-AUTO] Wspólny raport popraw-seo: ${reportDir}`);
}

async function main() {
  loadLocalEnvFromHome();
  const args = parseArgs(process.argv.slice(2));
  try {
    const inputDir = path.resolve(args.workDir);
    ensureDir(inputDir);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-auto-'));

    const apiRes = tryGenerateCsvFromApi(inputDir);
    if (apiRes.ok) {
      console.log('[GSC-AUTO] Źródło: GSC API -> ~/Downloads/gsc-auto-input');
      runWeeklyReport(inputDir, inputDir);
      runPriorityMap(inputDir, inputDir);
      runSeoAioMachine(inputDir, inputDir);
      runSeoAioWaveProposal(inputDir);
      if (!args.skipPoprawSeo) runPoprawSeo(inputDir, args.downloadsDir);
      return;
    }
    console.log(`[GSC-AUTO] GSC API pominięte: ${apiRes.reason}`);

    let sourceLabel = '';
    if (args.preferGithub) {
      const ghRes = tryGithubArtifact(args.repo, args.artifact, tmp);
      if (ghRes.ok) {
        sourceLabel = `github-artifact:${args.repo}:${args.artifact}`;
      } else {
        console.log(`[GSC-AUTO] GitHub artifact (gh CLI) pominięty: ${ghRes.reason}`);
        try {
          const apiRes = await tryGithubArtifactViaApi(args.repo, args.artifact, tmp);
          if (apiRes.ok) {
            sourceLabel = `github-artifact-api:${args.repo}:${args.artifact}:run-${apiRes.runId}`;
          } else {
            console.log(`[GSC-AUTO] GitHub artifact (API) pominięty: ${apiRes.reason}`);
          }
        } catch (err) {
          console.log(`[GSC-AUTO] GitHub artifact (API) błąd: ${err.message || err}`);
        }
      }
    }

    let typed = collectCsvByType(walkFiles(tmp));
    if (!haveAllThree(typed)) {
      const zipRes = tryExtractZipFromDownloads(args.downloadsDir, tmp);
      if (zipRes.ok) {
        sourceLabel = sourceLabel || `downloads-zip:${zipRes.zip}`;
        typed = collectCsvByType(walkFiles(tmp));
      } else {
        console.log(`[GSC-AUTO] Downloads ZIP pominięty: ${zipRes.reason}`);
      }
    }

    if (!haveAllThree(typed)) {
      throw new Error('Brak kompletu CSV (queries/pages/query_pages). Dostarcz eksport GSC lub działający artifact GitHub.');
    }

    const copied = copyTypedCsvToInput(typed, inputDir);
    console.log(`[GSC-AUTO] Skopiowano CSV do ${inputDir}:`, copied);
    if (sourceLabel) {
      console.log(`[GSC-AUTO] Źródło: ${sourceLabel}`);
    }

    runWeeklyReport(inputDir, inputDir);
    runPriorityMap(inputDir, inputDir);
    runSeoAioMachine(inputDir, inputDir);
    runSeoAioWaveProposal(inputDir);
    if (!args.skipPoprawSeo) runPoprawSeo(inputDir, args.downloadsDir);
    return;
  } catch (freshErr) {
    const inputDir = path.resolve(args.workDir);
    ensureDir(inputDir);
    const manualMsg = [
      'AUTO_FETCH_FAILED: nie udalo sie automatycznie pobrac swiezych danych GSC.',
      `Zapisz recznie 3 pliki CSV w katalogu: ${inputDir}`,
      '- queries.csv',
      '- pages.csv',
      '- query-pages.csv (lub query_pages.csv)',
      'Nastepnie uruchom ponownie: npm run gsc:auto',
      `Szczegoly bledu auto-fetch: ${freshErr && freshErr.message ? freshErr.message : String(freshErr)}`,
    ].join('\n');
    throw new Error(manualMsg);
  } finally {
    // Optional only: default GSC mode is read-only report generation outside repo.
    if (args.cleanupRepoArtifacts) {
      cleanupRepoGscArtifacts();
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
