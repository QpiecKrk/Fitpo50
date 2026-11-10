#!/usr/bin/env node

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');
const { assertReleaseFiles, assertResolvedScope, classifyChangedFiles, filesFromPushRefs, selectedFiles } = require('./lib/change-scope');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const { isProcessAlive } = require('./lib/temp-workspace');
const { recoverInterruptedTransactions } = require('./lib/article-staging');
const { packageIdentity } = require('./lib/package-identity');
const { heroAssetPaths } = require('./lib/deployment-live-verifier');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_LOCAL_PATH = 'docs/fitpo50-modernization-master-plan.md';
const ARTICLE_CHECK_INTERVAL_MS = 15000;
const ARTICLE_CHECK_TIMEOUT_MS = 180000;
const DEPLOYMENT_MARKERS = ['deployment.json', '_site/deployment.json'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || ROOT, stdio: options.capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(' ')} zakończyło się kodem ${result.status}.`);
    error.exitCode = result.status ?? 30;
    throw error;
  }
  return result;
}

function statusEntries(output) {
  const nul = String(output || '').includes('\0');
  const lines = String(output || '').split(nul ? '\0' : '\n').filter(Boolean);
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const code = line.slice(0, 2);
    const rawPath = nul ? line.slice(3) : line.slice(3).trim();
    const file = !nul && rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath;
    if (nul && /[RC]/.test(code)) {
      const original = lines[++index];
      if (code.includes('R')) entries.push({ code: 'D', file: original });
      entries.push({ code: 'A', file });
    } else entries.push({ code, file });
  }
  return entries;
}

function gitPaths(output) { return String(output || '').split(String(output || '').includes('\0') ? '\0' : '\n').filter(Boolean); }

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
  return normalized !== IGNORED_LOCAL_PATH && !sensitivePath(normalized) && !classifyChangedFiles([normalized]).blocked;
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

function preparedArticleTask(slug, root = ROOT, entries = [], source = '') {
  if (!fs.existsSync(publicationManifestPath(slug, root))) return false;
  const manifest = JSON.parse(fs.readFileSync(publicationManifestPath(slug, root), 'utf8'));
  const shared = new Set(['sitemap.xml', 'llms-full.txt', 'assets/data/search-index.json']);
  const ownedFiles = Array.isArray(manifest.files) ? manifest.files.filter((entry) => !shared.has(String(entry?.path || '').replace(/^_site\//, ''))) : [];
  const artifactsReady = manifest.slug === slug && manifest.status === 'PUBLISHED' && ownedFiles.length > 0
    && ownedFiles.every((entry) => fs.existsSync(path.join(root, entry.path)) && entry.after_sha256 === crypto.createHash('sha256').update(fs.readFileSync(path.join(root, entry.path))).digest('hex'));
  let sourcePackageHash = manifest.source_package_sha256;
  // Starsze zakończone transakcje zachowują tożsamość paczki w raporcie przygotowania.
  if (source && !sourcePackageHash) {
    try {
      const { statusPath } = require('./lib/article-pipeline-status');
      const { reportPathForJson } = require('./lib/article-json-artifact');
      const status = JSON.parse(fs.readFileSync(statusPath(root, slug), 'utf8'));
      const report = JSON.parse(fs.readFileSync(reportPathForJson(status.input_cleanup.path), 'utf8'));
      if (status.status === 'SUCCESS' && status.transaction_id === manifest.transaction_id && path.resolve(report.source_file) === path.resolve(source)) sourcePackageHash = report.source_package_sha256;
    } catch (_error) { /* Brak dowodu tożsamości nie oznacza gotowości. */ }
  }
  if (source && artifactsReady && !sourcePackageHash) throw new Error('Artykuł jest już dodany lokalnie, ale brakuje zapisu tożsamości jego paczki. Nie powtarzam importu; wznów publikuj bez katalogu.');
  if (source && sourcePackageHash !== packageIdentity(source, path.dirname(source), JSON.parse(fs.readFileSync(source, 'utf8'))).hash) return false;
  return artifactsReady;
}

function taskSlugFromEntries(entries) {
  const slugs = [...new Set(entries
    .map((entry) => String(entry.file || '').match(/^data\/reports\/article-publications\/([^/]+)\.json$/)?.[1])
    .filter(Boolean))];
  if (slugs.length > 1) throw new Error(`Wykryto więcej niż jeden aktywny artykuł: ${slugs.join(', ')}.`);
  return slugs[0] || '';
}

function taskCommitFiles(entries, expected = [], related = []) {
  const wanted = selectedFiles(['--files-json', JSON.stringify([...expected, ...related])], {});
  if (wanted.includes(IGNORED_LOCAL_PATH)) throw new Error('Plik modernizacji jest poza zakresem publikacji.');
  assertSafeChanges(entries.filter((entry) => wanted.includes(entry.file)));
  const actual = entries.map((entry) => entry.file);
  const missing = wanted.filter((file) => !actual.includes(file));
  if (missing.length) throw new Error(`Braki zatwierdzonego zakresu zadania: ${missing.join(', ')}.`);
  assertResolvedScope(classifyChangedFiles(wanted));
  return wanted;
}

function assertExactCommitFiles(entries, expected) {
  assertSafeChanges(entries);
  const actual = entries.map((entry) => entry.file).sort();
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
  return heroAssetPaths(fs.readFileSync(file, 'utf8'));
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

function publicationPaths(root) {
  const directory = path.join(root, 'data/reports/local');
  return { state: path.join(directory, 'publikuj-state.json'), lock: path.join(directory, 'publikuj.lock'), log: path.join(directory, 'publikuj-push.log') };
}

function readPublicationState(root) {
  const file = publicationPaths(root).state;
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.version !== 1 || state.root !== fs.realpathSync(root)) throw new Error('Nieprawidłowy stan wznowienia publikuj. Niczego nie wysłano.');
  return state;
}

function savePublicationState(root, state, patch = {}) {
  Object.assign(state, patch, { version: 1, root: fs.realpathSync(root), updated_at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(publicationPaths(root).state), { recursive: true });
  atomicWriteFileSync(publicationPaths(root).state, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return state;
}

function localHashes(root, files) {
  return Object.fromEntries(files.map((file) => [file, fs.existsSync(path.join(root, file)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') : null]));
}

function acquirePublicationLock(root, alive = isProcessAlive) {
  const file = publicationPaths(root).lock;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const owner = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (owner.type !== 'publikuj' || owner.root !== root) throw new Error('Nierozpoznany lock publikacji; nie usuwam go.');
    if (alive(owner.pid)) return false;
    fs.rmSync(file);
  }
  fs.writeFileSync(file, JSON.stringify({ type: 'publikuj', root, pid: process.pid }), { flag: 'wx' });
  return true;
}

function releasePublicationLock(root) {
  const file = publicationPaths(root).lock;
  if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).pid === process.pid) fs.rmSync(file);
}

function pushWorker(stateFile) {
  const initial = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const root = fs.realpathSync(initial.root);
  if (fs.realpathSync(stateFile) !== fs.realpathSync(publicationPaths(root).state) || !initial.approved || !initial.commit || initial.status !== 'PUSH_STARTING') throw new Error('Brak zatwierdzonego wydania dla procesu push.');
  const state = savePublicationState(root, initial, { status: 'PUSH_RUNNING', push: { ...initial.push, pid: process.pid, exit_code: null } });
  let code = 30;
  try {
    const head = run('git', ['rev-parse', 'HEAD'], { cwd: root, capture: true }).stdout.trim();
    if (head !== state.commit) throw new Error('HEAD zmienił się przed rozpoczęciem pusha.');
    const result = spawnSync('git', ['push', 'origin', 'main'], { cwd: root, stdio: 'inherit' });
    code = Number.isInteger(result.status) ? result.status : 30;
    if (result.error) console.error(result.error.message);
  } catch (error) { console.error(error.message); }
  savePublicationState(root, state, { status: code === 0 ? 'PUSH_SENT' : 'PUSH_FAILED', push: { ...state.push, exit_code: code } });
  process.exitCode = code;
}

async function observePush(root, options = {}) {
  const alive = options.isProcessAlive || isProcessAlive;
  const wait = options.wait || ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
  let lastNotice = 0;
  while (true) {
    const state = readPublicationState(root);
    if (Number.isInteger(state?.push?.exit_code)) return state;
    const pid = state?.push?.pid || options.startedPid;
    if (!pid || !alive(pid)) return state;
    if (Date.now() - lastNotice > 15000) {
      console.log(`[PUBLIKUJ] Odbieram trwający push/hook (PID ${pid}). Log: ${publicationPaths(root).log}`);
      lastNotice = Date.now();
    }
    await wait(500);
  }
}

async function sendRelease(root, state, options, runCommand) {
  if (state.status === 'PUSH_STARTING' && !state.push?.pid) throw new Error('Niepotwierdzony start poprzedniego pusha. Nie uruchamiam drugiego; sprawdź zapisany log i stan origin/main.');
  if (state.push?.pid && (options.isProcessAlive || isProcessAlive)(state.push.pid)) return observePush(root, options);
  savePublicationState(root, state, { status: 'PUSH_STARTING', push: { attempt: crypto.randomUUID(), pid: null, exit_code: null } });
  if (options.run) {
    // Ta sama ścieżka komend z kontrolowanym wykonawcą w testach.
    try { runCommand('git', ['push', 'origin', 'main']); savePublicationState(root, state, { status: 'PUSH_SENT', push: { ...state.push, exit_code: 0 } }); }
    catch (error) { savePublicationState(root, state, { status: 'PUSH_FAILED', push: { ...state.push, exit_code: error.exitCode || 1 }, last_error: error.message }); throw error; }
    return state;
  }
  const log = fs.openSync(publicationPaths(root).log, 'a');
  let child;
  try {
    child = spawn(process.execPath, [__filename, '--push-worker', publicationPaths(root).state], { cwd: root, detached: true, stdio: ['ignore', log, log] });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
  } catch (error) {
    savePublicationState(root, state, { status: 'PUSH_FAILED', push: { ...state.push, exit_code: 30 } });
    throw error;
  } finally { fs.closeSync(log); }
  return observePush(root, { ...options, startedPid: child.pid });
}

function gscUrlsForRelease(root, marker) {
  if (!(marker.articles || []).length) return [];
  const urls = new Set(marker.articles.map((article) => article.url).filter(Boolean));
  const { canonicalFromHtml } = require('./lib/deployment-live-verifier');
  for (const target of marker.verification_targets || []) {
    if (!/^[^/]+\.html$/.test(target.path)) continue;
    const file = path.join(root, '_site', target.path);
    if (fs.existsSync(file)) urls.add(canonicalFromHtml(fs.readFileSync(file, 'utf8')) || `https://fitpo50.pl/${target.path}`);
  }
  return [...urls].sort();
}

async function confirmRelease(root, state, options, runCommand) {
  const marker = state.marker;
  if (!(marker.verification_targets || []).length && !(marker.articles || []).length && !(marker.change_scope || []).includes('full')) {
    return savePublicationState(root, state, { status: 'PUSHED_NO_PUBLIC_CHANGES', gsc_urls: [], gsc_ready: false });
  }
  let result;
  if (options.verify) result = await options.verify(state);
  else {
    const file = path.join(root, 'data/reports/local/deployment-live-status.json');
    const previous = fs.existsSync(file) ? fs.statSync(file) : null;
    let commandError;
    try { runCommand('node', ['scripts/deployment-live-verify.js', '--commit', state.commit, '--retries', '0']); } catch (error) { commandError = error; }
    const current = fs.existsSync(file) ? fs.statSync(file) : null;
    if (commandError && (!current || (previous && current.ino === previous.ino && current.mtimeMs === previous.mtimeMs))) throw commandError;
    result = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    if (!result || result.expected_commit !== state.commit || result.release_id !== marker.release_id) throw commandError || new Error('Brak raportu live bieżącego wydania.');
    if (result.status === 'LIVE_DEPLOYED_AND_VALIDATED') {
      if (commandError) throw commandError;
      runCommand('node', ['scripts/security-exposure-check.js', 'https://fitpo50.pl']);
      const security = JSON.parse(fs.readFileSync(path.join(root, 'data/reports/local/security-exposure-status.json'), 'utf8'));
      if (security.release_id !== marker.release_id) throw new Error('Raport bezpieczeństwa dotyczy innego wydania.');
      result.security_status = security.status;
    }
  }
  if (result.status !== 'LIVE_DEPLOYED_AND_VALIDATED') {
    console.log(`[PUBLIKUJ] ${result.status}: wydanie jest wysłane, czeka na potwierdzenie live. Wznowienie nie powtórzy commita ani pusha.`);
    return savePublicationState(root, state, { status: result.status === 'CDN_REFRESH_PENDING' ? result.status : 'AWAITING_LIVE_CONFIRMATION', live_status: result.status, gsc_ready: false, gsc_urls: [], last_error: (result.errors || []).join('; ') });
  }
  if (result.security_status !== 'SECURITY_EXPOSURE_PASS') throw new Error('Brak SECURITY_EXPOSURE_PASS bieżącej kontroli.');
  const urls = gscUrlsForRelease(root, marker);
  savePublicationState(root, state, { status: 'LIVE_DEPLOYED_AND_VALIDATED', security_status: result.security_status, gsc_ready: urls.length > 0, gsc_urls: urls, last_error: '' });
  if (urls.length) console.log(`[GSC] Gotowe do ręcznego zgłoszenia po potwierdzeniu wszystkich zmian live:\n${urls.join('\n')}\nPrzypomnienie: zgłoś te URL-e ręcznie w GSC. Niczego nie zgłoszono automatycznie.`);
  return state;
}

async function publishTask(options = {}) {
  const root = options.root;
  const runCommand = options.run || ((command, args, settings = {}) => run(command, args, { ...settings, cwd: root }));
  const git = (...args) => String(runCommand('git', args, { capture: true }).stdout || '').trim();
  const remoteHead = () => {
    const sha = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
    if (!/^[a-f0-9]{40,64}$/i.test(sha || '')) throw new Error('Nie można potwierdzić aktualnego origin/main.');
    return sha;
  };
  const hashAtCommit = (commit, file) => {
    const result = spawnSync('git', ['show', `${commit}:${file}`], { cwd: root, encoding: null, maxBuffer: 100 * 1024 * 1024 });
    return result.status === 0 ? crypto.createHash('sha256').update(result.stdout).digest('hex') : null;
  };
  (options.recover || recoverInterruptedTransactions)(root);
  let state = readPublicationState(root);
  const initial = statusEntries(runCommand('git', ['status', '--short', '-z', '--untracked-files=all'], { capture: true }).stdout);
  const argv = options.argv || process.argv.slice(2);
  const directory = argv[0] && !argv[0].startsWith('--') ? argv[0] : '';
  // Listę powiązanego kodu ustala agent; położenie w scripts/tests/docs nie jest zgodą.
  const taskIndex = argv.indexOf('--task-files-json');
  const related = taskIndex >= 0 ? selectedFiles(['--files-json', argv[taskIndex + 1]], {}) : [];
  let source = directory ? findArticleJson(directory) : '';
  const sourceHash = source ? packageIdentity(source, path.dirname(source), JSON.parse(fs.readFileSync(source, 'utf8'))).hash : '';
  let slug = source ? String(JSON.parse(fs.readFileSync(source, 'utf8')).slug || path.basename(source, '.fitpo50.json')).trim()
    : taskSlugFromEntries(taskIndex >= 0 ? initial.filter((entry) => related.includes(entry.file)) : initial);
  if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Nieprawidłowy slug: ${slug}`);
  const head = git('rev-parse', 'HEAD');
  if (git('branch', '--show-current') !== 'main') throw new Error('Publikuj wymaga gałęzi main. Nie zmieniam gałęzi automatycznie.');
  const requestedTaskDiffers = state && (
    related.some((file) => !(state.task_files || []).includes(file))
    || (source && (
      !state.source
      || path.resolve(state.source) !== path.resolve(source)
      || sourceHash !== state.source_package_sha256
    ))
  );
  const completed = state && ['LIVE_DEPLOYED_AND_VALIDATED', 'PUSHED_NO_PUBLIC_CHANGES', 'NO_CHANGES'].includes(state.status);
  const committedToMain = requestedTaskDiffers && !completed && state?.commit && remoteHead() === state.commit;
  if (requestedTaskDiffers && (completed || committedToMain)) state = null;
  if (completed && state) {
    const changed = initial.some((entry) => (state.task_files || []).includes(entry.file));
    if (!changed && (!source || (source === state.source && sourceHash === state.source_package_sha256)) && related.every((file) => (state.task_files || []).includes(file))) {
      console.log(`[PUBLIKUJ] Wydanie jest zakończone: ${state.status}; commit ${state.commit || 'brak nowych zmian'}.`);
      return state;
    }
    state = null;
  }
  if (!state && Number(git('rev-list', '--count', 'origin/main..HEAD')) > 0) {
    const marker = JSON.parse(git('show', `${head}:deployment.json`));
    if (source && !(marker.articles || []).some((article) => article.slug === slug)) throw new Error('Istniejący commit oczekuje na domknięcie i nie obejmuje wskazanego artykułu. Najpierw wznów publikuj bez nowego katalogu.');
    const remote = remoteHead();
    const base = remote === head ? git('rev-parse', 'origin/main') : remote;
    const files = filesFromPushRefs(`refs/heads/main ${head} refs/heads/main ${base}`, root);
    assertReleaseFiles(marker, files, (file) => hashAtCommit(head, file));
    state = savePublicationState(root, {}, { status: 'COMMITTED', commit: head, marker, files, task_files: files.filter((file) => !DEPLOYMENT_MARKERS.includes(file)), approved: false, source, slug });
  }
  if (state?.commit && state.commit !== head) throw new Error('HEAD nie odpowiada zapisanemu wydaniu. Zachowuję istniejący commit; nie tworzę następnego.');
  if (state && state.source && source && path.resolve(state.source) !== path.resolve(source)) throw new Error('Inne wydanie pozostaje niedokończone. Najpierw wznów je poleceniem publikuj bez nowego katalogu.');
  if (state?.commit && sourceHash && state.source_package_sha256 && sourceHash !== state.source_package_sha256) throw new Error('Paczka zmieniła się po commicie. Zachowuję poprzedni commit do domknięcia; nie podmieniam jego treści.');
  if (state && related.some((file) => !(state.task_files || []).includes(file))) {
    throw new Error(`Poprzednie wydanie (${state.status || 'nieznany status'}) jest niedokończone. Wznów poprzednie wydanie poleceniem publikuj bez katalogu.`);
  }
  source = source || state?.source || '';
  slug = slug || state?.slug || '';
  if (state && !state.commit && sourceHash) savePublicationState(root, state, { source_package_sha256: sourceHash });
  if (state && !state.commit && state.head_before_commit && state.head_before_commit !== head) {
    const marker = JSON.parse(git('show', `${head}:deployment.json`));
    if (!state.marker || marker.release_id !== state.marker.release_id) throw new Error('HEAD zmienił się poza bieżącym wydaniem. Nie tworzę kolejnego commita.');
    assertReleaseFiles(marker, state.files, (file) => hashAtCommit(head, file));
    savePublicationState(root, state, { commit: head, status: 'COMMITTED', marker });
  }
  const prepared = !state?.commit && slug && preparedArticleTask(slug, root, initial, source);
  if (!state?.commit && !source && !slug && !related.length && !(state?.task_files || []).length) throw new Error('Agent musi ustalić dokładny zakres zadania przez --task-files-json.');
  if (!state) state = savePublicationState(root, {}, { status: 'LOCAL_PREPARATION', source, source_package_sha256: sourceHash, slug, task_files: related, approved: false, head_before_commit: head });
  if (!state.commit && !prepared && source) {
    const addArgs = articleAddArgs(source, slug, root);
    console.log(`[PUBLIKUJ] Tryb ${addArgs.includes('--force') ? 'UPDATE' : 'CREATE'} dla ${slug}.`);
    runCommand('npm', addArgs);
  } else if (!state.commit && prepared) {
    console.log(`[PUBLIKUJ] Wznowienie gotowego artykułu ${slug}; pomijam ponowny import.`);
  }
  if (!state.commit) {
    const beforeApproval = statusEntries(runCommand('git', ['status', '--short', '-z', '--untracked-files=all'], { capture: true }).stdout);
    const changed = new Set(beforeApproval.map((entry) => entry.file));
    const initialExpected = slug ? expectedCommitFiles(slug, root).filter((file) => !DEPLOYMENT_MARKERS.includes(file) && changed.has(file)) : [];
    const taskFiles = taskCommitFiles(beforeApproval, initialExpected, (related.length ? related : state.task_files || []).filter((file) => changed.has(file)));
    if (!taskFiles.length) return savePublicationState(root, state, { status: 'NO_CHANGES', approved: false });
    const hashes = localHashes(root, taskFiles);
    if (state.approved && JSON.stringify(state.approved_hashes) !== JSON.stringify(hashes)) state.approved = false;
    savePublicationState(root, state, { source, slug, task_files: taskFiles, approved_hashes: hashes });
    console.log(`[PUBLIKUJ] Zakres zadania: ${taskFiles.length} plików; ${classifyChangedFiles(taskFiles).scopes.join('+')}.`);
    const stagedBefore = gitPaths(runCommand('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], { capture: true }).stdout);
    if (stagedBefore.some((file) => ![...taskFiles, ...DEPLOYMENT_MARKERS].includes(file))) throw new Error('Indeks zawiera niezwiązane pliki; publikacja ich nie odstage’uje ani nie dołączy.');

    if (!state.approved && !await (options.ask || askToPublish)()) {
      console.log('[PUBLIKUJ] Zatrzymano przed commit/push. Zmiany lokalne pozostają bezpiecznie w repozytorium.');
      return savePublicationState(root, state, { status: 'LOCAL_READY', approved: false });
    }
    if (JSON.stringify(localHashes(root, taskFiles)) !== JSON.stringify(hashes)) {
      savePublicationState(root, state, { approved: false });
      throw new Error('Pliki zmieniły się podczas oczekiwania na zgodę. Ponów publikuj dla aktualnej zawartości.');
    }
    const files = [...new Set([...taskFiles, ...DEPLOYMENT_MARKERS])].sort();
    savePublicationState(root, state, { approved: true, status: 'APPROVED', files });
    let marker;
    try {
      marker = JSON.parse(fs.readFileSync(path.join(root, 'deployment.json'), 'utf8'));
      if (marker.prepared_from_head !== head) throw new Error('Stary marker.');
      assertReleaseFiles(marker, files, (file) => localHashes(root, [file])[file]);
    } catch (_error) {
      runCommand('npm', ['run', 'deployment:prepare', '--', '--files-json', JSON.stringify(files)]);
      marker = JSON.parse(fs.readFileSync(path.join(root, 'deployment.json'), 'utf8'));
      assertReleaseFiles(marker, files, (file) => localHashes(root, [file])[file]);
    }
    savePublicationState(root, state, { marker, status: 'MARKER_PREPARED' });
    const entries = statusEntries(runCommand('git', ['status', '--short', '-z', '--untracked-files=all'], { capture: true }).stdout);
    taskCommitFiles(entries, files);
    runCommand('git', ['add', '--', ...files]);
    const staged = gitPaths(runCommand('git', ['diff', '--cached', '--name-only', '--no-renames', '-z'], { capture: true }).stdout);
    assertExactCommitFiles(staged.map((file) => ({ code: 'M', file })), files);
    savePublicationState(root, state, { status: 'COMMITTING', head_before_commit: head });
    runCommand('git', ['commit', '-m', slug ? `feat(article): add ${slug}` : 'chore(release): publish current task']);
    savePublicationState(root, state, { commit: git('rev-parse', 'HEAD'), status: 'COMMITTED' });
  }
  if (!state.approved) {
    if (!await (options.ask || askToPublish)()) return state;
    savePublicationState(root, state, { approved: true });
  }
  const currentHashes = localHashes(root, state.task_files);
  assertReleaseFiles(state.marker, state.files, (file) => currentHashes[file]);
  if (state.push?.pid && (options.isProcessAlive || isProcessAlive)(state.push.pid)) state = await observePush(root, options);
  if (remoteHead() !== state.commit) {
    state = await sendRelease(root, state, options, runCommand);
    if (remoteHead() !== state.commit) {
      const log = publicationPaths(root).log;
      if (fs.existsSync(log)) console.error(fs.readFileSync(log, 'utf8'));
      throw new Error(`Push nie jest potwierdzony na origin/main; kod ${state.push?.exit_code ?? 'nieznany'}. Log: ${log}`);
    }
  }
  savePublicationState(root, state, { status: 'PUSHED' });
  const result = await confirmRelease(root, state, options, runCommand);
  console.log(`[PUBLIKUJ] ${result.status}: commit ${result.commit}.`);
  return result;
}

async function main(options = {}) {
  if (options.run && !options.root) throw new Error('Kontrolowany wykonawca publikuj wymaga własnego root.');
  const root = fs.realpathSync(options.root || ROOT);
  if (!acquirePublicationLock(root, options.isProcessAlive || isProcessAlive)) {
    const state = readPublicationState(root);
    console.log(`[PUBLIKUJ] Poprzedni przebieg nadal działa: ${state?.status || 'STARTING'}. Nie uruchamiam drugiego. Log: ${publicationPaths(root).log}`);
    return state || { status: 'ACTIVE_PUBLICATION' };
  }
  try { return await publishTask({ ...options, root }); }
  catch (error) {
    const state = readPublicationState(root);
    if (state) savePublicationState(root, state, { last_error: error.message });
    throw error;
  } finally { releasePublicationLock(root); }
}

if (require.main === module) {
  const operation = process.argv[2] === '--push-worker' ? Promise.resolve().then(() => pushWorker(process.argv[3])) : main();
  operation.catch((error) => {
    console.error(`[PUBLIKUJ][STOP] ${error.message || error}`);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  publicationPaths,
  readPublicationState,
  savePublicationState,
  observePush,
  pushWorker,
  confirmRelease,
  gscUrlsForRelease,
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
