#!/usr/bin/env node

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_LOCAL_PATH = 'docs/fitpo50-modernization-master-plan.md';
const ARTICLE_CHECK_INTERVAL_MS = 15000;
const ARTICLE_CHECK_TIMEOUT_MS = 180000;
const DEPLOYMENT_MARKERS = ['deployment.json', '_site/deployment.json'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: options.capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} zakończyło się kodem ${result.status}.`);
  return result;
}

function statusEntries(output) {
  return String(output || '').split('\n').filter(Boolean).map((line) => {
    const code = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    const file = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath;
    return { code, file };
  });
}

function protectedNewsPath(file) {
  const normalized = String(file || '').replace(/\\/g, '/').replace(/^_site\//, '');
  return normalized === 'data/news-live.json'
    || normalized.startsWith('data/news-backups/')
    || normalized.startsWith('assets/news/');
}

function sensitivePath(file) {
  const normalized = String(file || '').replace(/\\/g, '/').toLowerCase();
  const base = path.posix.basename(normalized);
  return normalized === 'admin/config.php'
    || /^\.env(?:\.|$)/.test(base)
    || /\.(?:pem|key|p12|pfx)$/.test(base);
}

function assertSafeChanges(entries) {
  for (const entry of entries) {
    if (entry.file === IGNORED_LOCAL_PATH && entry.code === '??') continue;
    if (sensitivePath(entry.file)) throw new Error(`Odmowa: plik wrażliwy nie może trafić do publikacji: ${entry.file}`);
    if (protectedNewsPath(entry.file) && entry.code.includes('D')) {
      throw new Error(`Odmowa: publikacja nie może usuwać ani odpinać pliku NEWS: ${entry.file}`);
    }
  }
}

function articleAddArgs(source, slug, root = ROOT) {
  const args = ['run', 'article:add', '--', '--file', source, '--assets-dir', path.dirname(source)];
  if (fs.existsSync(path.join(root, `${slug}.html`))) args.push('--force', 'true');
  return args;
}

function publicationManifestPath(slug, root = ROOT) {
  return path.join(root, 'data', 'reports', 'article-publications', `${slug}.json`);
}

function expectedCommitFiles(slug, root = ROOT) {
  const manifestFile = publicationManifestPath(slug, root);
  if (!fs.existsSync(manifestFile)) throw new Error(`Brak manifestu publikacji artykułu: ${manifestFile}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.slug !== slug || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error(`Nieprawidłowy manifest publikacji artykułu: ${manifestFile}`);
  }
  const manifestRelative = path.relative(root, manifestFile).replace(/\\/g, '/');
  const files = manifest.files.map((entry) => String(entry?.path || '').replace(/\\/g, '/')).filter(Boolean);
  return [...new Set([...files, manifestRelative, ...DEPLOYMENT_MARKERS])].sort();
}

function assertExactCommitFiles(entries, expected) {
  assertSafeChanges(entries);
  const actual = entries.filter((entry) => entry.file !== IGNORED_LOCAL_PATH).map((entry) => entry.file).sort();
  const wanted = [...new Set(expected)].sort();
  const unexpected = actual.filter((file) => !wanted.includes(file));
  const missing = wanted.filter((file) => !actual.includes(file));
  if (unexpected.length || missing.length) {
    throw new Error(`Zakres commita nie odpowiada manifestowi artykułu. Nadmiar: ${unexpected.join(', ') || 'brak'}. Braki: ${missing.join(', ') || 'brak'}.`);
  }
  return wanted;
}

function findArticleJson(directory) {
  const root = path.resolve(directory);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Brak katalogu artykułu: ${root}`);
  const matches = fs.readdirSync(root).filter((name) => name.endsWith('.fitpo50.json'));
  if (matches.length !== 1) throw new Error(`Katalog musi zawierać dokładnie jeden plik .fitpo50.json (znaleziono: ${matches.length}).`);
  return path.join(root, matches[0]);
}

function askToPublish(input = process.stdin, output = process.stdout) {
  const prompt = readline.createInterface({ input, output });
  return new Promise((resolve) => prompt.question('Publikujemy? tak/nie: ', (answer) => {
    prompt.close();
    resolve(String(answer || '').trim().toLowerCase() === 'tak');
  }));
}

function requestArticleStatus(url) {
  return new Promise((resolve) => {
    const request = https.get(url, { headers: { 'User-Agent': 'FitPo50-Publish-Check/1.0' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(15000, () => request.destroy());
    request.on('error', () => resolve({ status: 0, body: Buffer.alloc(0) }));
  });
}

async function checkArticle200(slug, options = {}) {
  const url = `https://fitpo50.pl/${slug}.html`;
  const intervalMs = options.intervalMs ?? ARTICLE_CHECK_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? ARTICLE_CHECK_TIMEOUT_MS;
  const requestStatus = options.requestStatus ?? requestArticleStatus;
  const wait = options.wait ?? ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
  const expectedFile = options.expectedFile ?? path.join(ROOT, '_site', `${slug}.html`);
  const expectedSha256 = options.expectedSha256
    ?? crypto.createHash('sha256').update(fs.readFileSync(expectedFile)).digest('hex');
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastSha256 = '';

  do {
    const response = await requestStatus(url);
    lastStatus = typeof response === 'number' ? response : Number(response?.status || 0);
    const body = Buffer.isBuffer(response?.body) ? response.body : Buffer.from(String(response?.body || ''));
    lastSha256 = body.length ? crypto.createHash('sha256').update(body).digest('hex') : '';
    if (lastStatus === 200 && lastSha256 === expectedSha256) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeoutMs) break;
    await wait(Math.min(intervalMs, timeoutMs - elapsed));
  } while (Date.now() - startedAt < timeoutMs);

  const statusLabel = lastStatus || 'brak odpowiedzi HTTP';
  const hashLabel = lastSha256 || 'brak';
  throw new Error(`Strona ${url} nie zwróciła w ciągu 3 minut aktualnej wersji HTML. Ostatni status: ${statusLabel}; SHA-256: ${hashLabel}.`);
}

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error('Użycie: npm run publikuj -- <katalog-artykulu>');
  const source = findArticleJson(directory);
  const article = JSON.parse(fs.readFileSync(source, 'utf8'));
  const slug = String(article.slug || path.basename(source, '.fitpo50.json')).trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Nieprawidłowy slug: ${slug}`);

  const initial = statusEntries(run('git', ['status', '--short'], { capture: true }).stdout);
  const unexpected = initial.filter((entry) => !(entry.code === '??' && entry.file === IGNORED_LOCAL_PATH));
  if (unexpected.length) throw new Error(`Przed publikacją repozytorium musi być czyste. Zmiany: ${unexpected.map((entry) => entry.file).join(', ')}`);

  const addArgs = articleAddArgs(source, slug);
  console.log(`[PUBLIKUJ] Tryb ${addArgs.includes('--force') ? 'UPDATE' : 'CREATE'} dla ${slug}.`);
  run('npm', addArgs);
  run('npm', ['run', 'deployment:prepare']);

  const entries = statusEntries(run('git', ['status', '--short'], { capture: true }).stdout);
  const files = assertExactCommitFiles(entries, expectedCommitFiles(slug));

  if (!await askToPublish()) {
    console.log('[PUBLIKUJ] Zatrzymano przed commit/push. Zmiany lokalne pozostają bezpiecznie w repozytorium.');
    return;
  }

  run('git', ['add', '--', ...files]);
  assertSafeChanges(statusEntries(run('git', ['diff', '--cached', '--name-status'], { capture: true }).stdout
    .split('\n').filter(Boolean).map((line) => ({ code: line.split(/\s+/)[0], file: line.split(/\s+/).pop() }))));
  run('git', ['commit', '-m', `feat(article): add ${slug}`]);
  run('git', ['push', 'origin', 'main']);
  await checkArticle200(slug);
  console.log(`[PUBLIKUJ] PASS: https://fitpo50.pl/${slug}.html zwraca HTTP 200.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[PUBLIKUJ][STOP] ${error.message || error}`);
    process.exitCode = 1;
  });
}

module.exports = {
  articleAddArgs,
  assertExactCommitFiles,
  assertSafeChanges,
  checkArticle200,
  expectedCommitFiles,
  findArticleJson,
  protectedNewsPath,
  sensitivePath,
  statusEntries,
};
