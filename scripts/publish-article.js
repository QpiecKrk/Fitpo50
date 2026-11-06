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
const RELEASE_SAFE_PREFIXES = ['scripts/', 'tests/', 'docs/'];
const RELEASE_SAFE_FILES = new Set(['package.json', 'AGENTS.md', 'PROJECT_MEMORY.md']);

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

function isReleaseSafeTaskFile(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  if (normalized === IGNORED_LOCAL_PATH) return true;
  return RELEASE_SAFE_FILES.has(normalized) || RELEASE_SAFE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
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

function preparedArticleTask(slug, root = ROOT, entries = []) {
  const expected = expectedCommitFiles(slug, root).filter((file) => !DEPLOYMENT_MARKERS.includes(file));
  const actual = new Set(entries.map((entry) => entry.file));
  return expected.every((file) => actual.has(file));
}

function taskSlugFromEntries(entries) {
  const slugs = [...new Set(entries
    .map((entry) => String(entry.file || '').match(/^data\/reports\/article-publications\/([^/]+)\.json$/)?.[1])
    .filter(Boolean))];
  if (slugs.length > 1) throw new Error(`Wykryto więcej niż jeden aktywny artykuł: ${slugs.join(', ')}.`);
  return slugs[0] || '';
}

function taskCommitFiles(entries, expected = []) {
  assertSafeChanges(entries);
  const actual = entries.filter((entry) => entry.file !== IGNORED_LOCAL_PATH).map((entry) => entry.file).sort();
  const wanted = [...new Set(expected)].sort();
  const unexpected = actual.filter((file) => !wanted.includes(file));
  const missing = wanted.filter((file) => !actual.includes(file));
  const unsafe = unexpected.filter((file) => !isReleaseSafeTaskFile(file));
  if (unsafe.length || missing.length) {
    throw new Error(`Zakres bieżącego zadania jest niejednoznaczny. Niezwiązane: ${unsafe.join(', ') || 'brak'}. Braki: ${missing.join(', ') || 'brak'}.`);
  }
  return [...new Set([...wanted, ...unexpected])].sort();
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

function articleHeroAssets(slug, root = ROOT) {
  const file = path.join(root, '_site', `${slug}.html`);
  if (!fs.existsSync(file)) throw new Error(`Brak lokalnego HTML-a artykułu: ${file}`);
  const html = fs.readFileSync(file, 'utf8');
  const hero = html.match(/<div class="article-hero[\s\S]*?<\/div>/i)?.[0] || '';
  const paths = [...hero.matchAll(/<(?:source|img)\b[^>]*\bsrc(?:set)?="([^"]+)"/gi)]
    .map((match) => match[1].split(',')[0].trim().split(/\s+/)[0].replace(/^\.\//, ''))
    .filter((value) => value.startsWith('assets/'));
  const unique = [...new Set(paths)];
  const expected = ['avif', 'webp', 'jpg'].map((extension) => unique.find((value) => value.endsWith(`.${extension}`)));
  if (expected.some((value) => !value)) throw new Error(`Hero artykułu ${slug} nie ma kompletu AVIF/WebP/JPG.`);
  return expected;
}

async function checkPublicAssets(paths, options = {}) {
  const requestStatus = options.requestStatus ?? requestArticleStatus;
  const wait = options.wait ?? ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
  const intervalMs = options.intervalMs ?? ARTICLE_CHECK_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? ARTICLE_CHECK_TIMEOUT_MS;
  const root = options.root ?? ROOT;
  for (const relative of paths) {
    const local = path.join(root, '_site', relative);
    const expectedSha256 = crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex');
    const startedAt = Date.now();
    let lastStatus = 0;
    let lastSha256 = '';
    do {
      const response = await requestStatus(`https://fitpo50.pl/${relative}`);
      lastStatus = Number(response?.status || 0);
      const body = Buffer.isBuffer(response?.body) ? response.body : Buffer.from(String(response?.body || ''));
      lastSha256 = body.length ? crypto.createHash('sha256').update(body).digest('hex') : '';
      if (lastStatus === 200 && lastSha256 === expectedSha256) break;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= timeoutMs) throw new Error(`Asset ${relative} nie jest aktualny. Ostatni status: ${lastStatus || 'brak odpowiedzi HTTP'}.`);
      await wait(Math.min(intervalMs, timeoutMs - elapsed));
    } while (Date.now() - startedAt < timeoutMs);
  }
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
  const initial = statusEntries(run('git', ['status', '--short'], { capture: true }).stdout);
  const directory = process.argv[2] || '';
  let source = directory ? findArticleJson(directory) : '';
  let slug = source ? String(JSON.parse(fs.readFileSync(source, 'utf8')).slug || path.basename(source, '.fitpo50.json')).trim() : taskSlugFromEntries(initial);
  const initialTaskFiles = initial.filter((entry) => entry.file !== IGNORED_LOCAL_PATH);
  if (!source && !slug && !initialTaskFiles.length) throw new Error('Brak aktywnego zadania publikacji.');
  if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Nieprawidłowy slug: ${slug}`);
  const prepared = slug && preparedArticleTask(slug, ROOT, initial);
  if (!prepared && initial.some((entry) => entry.file !== IGNORED_LOCAL_PATH)) {
    if (!source) throw new Error('Repozytorium ma zmiany, ale nie ma jednoznacznego aktywnego zadania publikacji.');
    const unsupported = initial.filter((entry) => entry.file !== IGNORED_LOCAL_PATH && !isReleaseSafeTaskFile(entry.file));
    if (unsupported.length) throw new Error(`Repozytorium ma niezwiązane zmiany: ${unsupported.map((entry) => entry.file).join(', ')}`);
  }
  if (!prepared && source) {
    const addArgs = articleAddArgs(source, slug);
    console.log(`[PUBLIKUJ] Tryb ${addArgs.includes('--force') ? 'UPDATE' : 'CREATE'} dla ${slug}.`);
    run('npm', addArgs);
  } else if (prepared) {
    console.log(`[PUBLIKUJ] Wznowienie gotowego artykułu ${slug}; pomijam ponowny import.`);
  }
  const beforeApproval = statusEntries(run('git', ['status', '--short'], { capture: true }).stdout);
  const initialExpected = slug ? expectedCommitFiles(slug).filter((file) => !DEPLOYMENT_MARKERS.includes(file)) : [];
  taskCommitFiles(beforeApproval, initialExpected);

  if (!await askToPublish()) {
    console.log('[PUBLIKUJ] Zatrzymano przed commit/push. Zmiany lokalne pozostają bezpiecznie w repozytorium.');
    return;
  }

  run('npm', ['run', 'deployment:prepare']);
  const entries = statusEntries(run('git', ['status', '--short'], { capture: true }).stdout);
  const files = taskCommitFiles(entries, slug ? expectedCommitFiles(slug) : DEPLOYMENT_MARKERS);
  run('git', ['add', '--', ...files]);
  assertSafeChanges(statusEntries(run('git', ['diff', '--cached', '--name-status'], { capture: true }).stdout
    .split('\n').filter(Boolean).map((line) => ({ code: line.split(/\s+/)[0], file: line.split(/\s+/).pop() }))));
  run('git', ['commit', '-m', slug ? `feat(article): add ${slug}` : 'chore(release): publish current task']);
  run('git', ['push', 'origin', 'main']);
  if (slug) {
    await checkArticle200(slug);
    await checkPublicAssets(articleHeroAssets(slug));
    console.log(`[PUBLIKUJ] PASS: strona i hero AVIF/WebP/JPG dla ${slug} są aktualne.`);
  } else console.log('[PUBLIKUJ] PASS: push przyjęty; zadanie nie zawiera artykułu.');
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
  articleHeroAssets,
  checkArticle200,
  checkPublicAssets,
  expectedCommitFiles,
  findArticleJson,
  isReleaseSafeTaskFile,
  preparedArticleTask,
  protectedNewsPath,
  sensitivePath,
  statusEntries,
  taskCommitFiles,
  taskSlugFromEntries,
};
