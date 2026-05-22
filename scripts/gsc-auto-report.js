#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const https = require('https');

const ROOT = process.cwd();
const DEFAULT_DOWNLOADS_DIR = process.env.GSC_DOWNLOADS_DIR || path.join(os.homedir(), 'Downloads');
const DEFAULT_WORK_DIR = process.env.GSC_WORK_DIR || path.join(DEFAULT_DOWNLOADS_DIR, 'gsc-auto-input');

function parseArgs(argv) {
  const out = {
    repo: process.env.GSC_GH_REPO || 'QpiecKrk/Fitpo50',
    artifact: process.env.GSC_GH_ARTIFACT_NAME || 'gsc-csv',
    downloadsDir: DEFAULT_DOWNLOADS_DIR,
    workDir: DEFAULT_WORK_DIR,
    preferGithub: true,
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
      byType[type].push({ file, mtimeMs: st.mtimeMs });
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
  }
  return copied;
}

function haveAllThree(byType) {
  return Boolean(byType.queries?.length && byType.pages?.length && byType.query_pages?.length);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDir = path.resolve(args.workDir);
  ensureDir(inputDir);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-auto-'));

  const localCsv = collectCsvByType(walkFiles(inputDir));
  if (haveAllThree(localCsv)) {
    console.log(`[GSC-AUTO] Używam CSV już obecnych w ${inputDir}.`);
    runWeeklyReport(inputDir, inputDir);
    return;
  }

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
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
