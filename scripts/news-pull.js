#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const { createManagedTempDir, disposeTempWorkspace } = require('./lib/temp-workspace');
const { warsawIso } = require('./lib/time');

const EXIT = Object.freeze({ OK: 0, DATA: 20, ENVIRONMENT: 30 });
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SECRETS_FILE = path.join(os.homedir(), '.config', 'fitpo50', 'news-pull.env');
const FTPS = Object.freeze({
  host: 'ftp.fitpo50.pl',
  port: 21,
  // Hostinger presents a valid *.hstgr.io certificate for ftp.fitpo50.pl.
  // We require TLS and pin the certificate public key instead of disabling identity checks blindly.
  pinnedPublicKey: 'sha256//BUI7x6sidmqoGBG2e99anTr7ngx3LqcbmtP1Riv2OB8=',
  dataUser: 'u542460614.GpiecFTP',
  assetsUser: 'u542460614.newsassets',
});
const LIMITS = Object.freeze({
  jsonBytes: 20 * 1024 * 1024,
  imageBytes: 25 * 1024 * 1024,
  totalBytes: 1024 * 1024 * 1024,
});
const IMAGE_NAME = /^news_[a-z0-9][a-z0-9_-]{0,119}\.(?:jpg|webp|avif)$/i;
const IMAGE_BASE = /^news_[a-z0-9][a-z0-9_-]{0,119}$/i;
const GENERATED_IMAGE_BASE = /^news_20\d{6}_\d{6}_[a-f0-9]{8}$/i;
const BACKUP_NAME = /^news-live-\d{8}_\d{6}\.json$/;
const REQUIRED_LIVE_FIELDS = [
  'id', 'title', 'content_html', 'status', 'sort_order', 'image_base', 'image_alt',
  'image_hashes', 'sources', 'created_at', 'updated_at', 'published_at',
];
const REQUIRED_FALLBACK_FIELDS = [
  'id', 'title', 'content_html', 'sort_order', 'image', 'sources',
  'updated_at', 'published_at', 'excerpt',
];

class NewsPullError extends Error {
  constructor(message, exitCode, details = []) {
    super(message);
    this.name = 'NewsPullError';
    this.exitCode = exitCode;
    this.details = details;
  }
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sha1File(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

function inspectImageFile(file) {
  const result = spawnSync('identify', ['-format', '%m %w %h', file], { encoding: 'utf8', timeout: 15_000 });
  if (result.error || result.signal || result.status !== 0) {
    throw new NewsPullError(`Nie można technicznie sprawdzić obrazu ${path.basename(file)}: ${result.error?.message || result.signal || String(result.stderr || '').trim()}`, EXIT.ENVIRONMENT);
  }
  const match = String(result.stdout || '').trim().match(/^(\S+)\s+(\d+)\s+(\d+)$/);
  if (!match) throw new NewsPullError(`Nieczytelny wynik kontroli obrazu ${path.basename(file)}.`, EXIT.ENVIRONMENT);
  return { format: match[1].toUpperCase(), width: Number(match[2]), height: Number(match[3]) };
}

function safeName(name, label) {
  const value = String(name || '').trim();
  if (!value || value === '.' || value === '..') return null;
  if (value.includes('\0') || value.includes('/') || value.includes('\\') || value.includes('..') || path.isAbsolute(value)) {
    throw new NewsPullError(`Niebezpieczna nazwa z serwera (${label}): ${JSON.stringify(value)}`, EXIT.DATA);
  }
  return value;
}

function parseArgs(argv) {
  const args = { backupOnly: false, dryRun: false, secretsFile: DEFAULT_SECRETS_FILE };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run') args.dryRun = true;
    else if (token === '--backup-only') args.backupOnly = true;
    else if (token === '--secrets-file') {
      args.secretsFile = path.resolve(String(argv[index + 1] || ''));
      index += 1;
    } else if (token === '--help' || token === '-h') args.help = true;
    else throw new NewsPullError(`Nieznany argument: ${token}`, EXIT.DATA);
  }
  if (args.dryRun && args.backupOnly) {
    throw new NewsPullError('Opcji --dry-run i --backup-only nie można łączyć.', EXIT.DATA);
  }
  return args;
}

function readCredentials(file = DEFAULT_SECRETS_FILE, env = process.env) {
  if (env.FITPO50_NEWS_DATA_PASSWORD && env.FITPO50_NEWS_ASSETS_PASSWORD) {
    return {
      data: env.FITPO50_NEWS_DATA_PASSWORD,
      assets: env.FITPO50_NEWS_ASSETS_PASSWORD,
    };
  }
  if (!fs.existsSync(file)) {
    throw new NewsPullError(`Brak danych logowania: ${file}. Uruchom lokalną konfigurację haseł.`, EXIT.ENVIRONMENT);
  }
  const mode = fs.statSync(file).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    throw new NewsPullError(`Plik danych logowania ma zbyt szerokie uprawnienia (${mode.toString(8)}). Wymagane: 600.`, EXIT.ENVIRONMENT);
  }
  const shell = spawnSync('/bin/zsh', [
    '-c',
    'source "$1"; printf "%s\\0%s\\0" "$FITPO50_NEWS_DATA_PASSWORD" "$FITPO50_NEWS_ASSETS_PASSWORD"',
    'news-pull-credentials',
    file,
  ], { encoding: null, timeout: 10_000 });
  if (shell.error || shell.status !== 0) {
    throw new NewsPullError('Nie udało się bezpiecznie odczytać lokalnego pliku danych logowania.', EXIT.ENVIRONMENT);
  }
  const values = shell.stdout.toString('utf8').split('\0');
  if (!values[0] || !values[1]) {
    throw new NewsPullError('Lokalny plik nie zawiera obu wymaganych haseł.', EXIT.ENVIRONMENT);
  }
  return { data: values[0], assets: values[1] };
}

function curlConfigUser(user, password) {
  const raw = `${user}:${password}`;
  if (/[\r\n\0]/.test(raw)) {
    throw new NewsPullError('Dane logowania zawierają niedozwolony znak sterujący.', EXIT.ENVIRONMENT);
  }
  return `user = "${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n`;
}

class FtpsTransport {
  constructor(options = {}) {
    this.host = options.host || FTPS.host;
    this.pin = options.pin || FTPS.pinnedPublicKey;
    this.credentials = options.credentials;
  }

  credentialsFor(account) {
    const password = account === 'data' ? this.credentials.data : this.credentials.assets;
    const user = account === 'data' ? FTPS.dataUser : FTPS.assetsUser;
    return { password, user };
  }

  url(remotePath) {
    const encodedPath = remotePath.split('/').map((part) => encodeURIComponent(part)).join('/');
    return `ftp://${this.host}:${FTPS.port}/${encodedPath.replace(/^\/+/, '')}`;
  }

  commonArgs() {
    return [
      '--silent', '--show-error', '--fail', '--ssl-reqd', '--ftp-ssl-control',
      '--insecure', '--pinnedpubkey', this.pin, '--connect-timeout', '15', '--max-time', '90',
      '--retry', '2', '--retry-delay', '1', '--retry-all-errors',
    ];
  }

  run(account, remotePath, extraArgs = []) {
    const { password, user } = this.credentialsFor(account);
    const args = [
      '--config', '-', ...this.commonArgs(), ...extraArgs, this.url(remotePath),
    ];
    const result = spawnSync('curl', args, {
      input: curlConfigUser(user, password),
      encoding: 'utf8',
      timeout: 210_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    if (result.error || result.signal || result.status !== 0) {
      const reason = result.error?.message || result.signal || String(result.stderr || '').trim() || `curl exit ${result.status}`;
      throw new NewsPullError(`Błąd połączenia FTPS podczas odczytu ${remotePath}: ${reason}`, EXIT.ENVIRONMENT);
    }
    return result;
  }

  list(account, remoteDir) {
    const result = this.run(account, remoteDir.endsWith('/') ? remoteDir : `${remoteDir}/`, ['--list-only']);
    return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  download(account, remotePath, target, maxBytes) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const result = this.run(account, remotePath, ['--max-filesize', String(maxBytes), '--output', target]);
    if (!fs.existsSync(target)) {
      throw new NewsPullError(`Serwer nie zwrócił pliku: ${remotePath}`, EXIT.ENVIRONMENT);
    }
    const size = fs.statSync(target).size;
    if (size <= 0 || size > maxBytes) {
      throw new NewsPullError(`Nieprawidłowy rozmiar ${remotePath}: ${size} B`, EXIT.DATA);
    }
    return result;
  }

  downloadBatch(account, files, maxBytes) {
    if (!files.length) return;
    const { password, user } = this.credentialsFor(account);
    const transferArgs = [];
    for (const file of files) {
      fs.mkdirSync(path.dirname(file.staged), { recursive: true });
      transferArgs.push('--output', file.staged, this.url(file.remote));
    }
    const result = spawnSync('curl', [
      '--config', '-', ...this.commonArgs(), '--parallel', '--parallel-max', '6',
      '--max-filesize', String(maxBytes), ...transferArgs,
    ], {
      input: curlConfigUser(user, password),
      encoding: 'utf8',
      timeout: Math.max(210_000, files.length * 10_000),
      maxBuffer: 50 * 1024 * 1024,
    });
    if (result.error || result.signal || result.status !== 0) {
      const reason = result.error?.message || result.signal || String(result.stderr || '').trim() || `curl exit ${result.status}`;
      throw new NewsPullError(`Błąd połączenia FTPS podczas zbiorczego odczytu: ${reason}`, EXIT.ENVIRONMENT);
    }
    for (const file of files) {
      if (!fs.existsSync(file.staged)) throw new NewsPullError(`Serwer nie zwrócił pliku: ${file.remote}`, EXIT.ENVIRONMENT);
      const size = fs.statSync(file.staged).size;
      if (size <= 0 || size > maxBytes) throw new NewsPullError(`Nieprawidłowy rozmiar ${file.remote}: ${size} B`, EXIT.DATA);
    }
  }
}

function parseJsonFile(file, label) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('korzeń nie jest obiektem');
    return value;
  } catch (error) {
    throw new NewsPullError(`${label}: uszkodzony JSON (${error.message}).`, EXIT.DATA);
  }
}

function validateSourceArray(value, location, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${location}: sources musi być tablicą.`);
    return;
  }
  value.forEach((source, index) => {
    if (!source || typeof source !== 'object' || !String(source.label || '').trim() || !/^https?:\/\//i.test(String(source.url || ''))) {
      errors.push(`${location}.sources[${index}]: wymagane label i URL http/https.`);
    }
  });
}

function validatePackage(live, fallback, availableImages) {
  const errors = [];
  if (live.version !== 1 || !Array.isArray(live.items)) errors.push('data/news-live.json: wymagane version=1 i items[].');
  if (fallback.version !== 1 || !Array.isArray(fallback.items)) errors.push('assets/data/news-fallback.json: wymagane version=1 i items[].');
  const liveItems = Array.isArray(live.items) ? live.items : [];
  const fallbackItems = Array.isArray(fallback.items) ? fallback.items : [];
  const ids = new Set();
  const requiredImages = new Set();
  const publishedIds = [];

  liveItems.forEach((item, index) => {
    const at = `data/news-live.json.items[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${at}: wpis musi być obiektem.`);
      return;
    }
    for (const field of REQUIRED_LIVE_FIELDS) if (!(field in item)) errors.push(`${at}.${field}: brak pola.`);
    const id = String(item.id || '').trim();
    if (!/^news_[a-zA-Z0-9_\-]+$/.test(id)) errors.push(`${at}.id: nieprawidłowy identyfikator.`);
    if (ids.has(id)) errors.push(`${at}.id: duplikat ${id}.`);
    ids.add(id);
    if (!String(item.title || '').trim()) errors.push(`${at}.title: pole jest puste.`);
    if (!String(item.content_html || '').trim()) errors.push(`${at}.content_html: pole jest puste.`);
    if (!['draft', 'published'].includes(item.status)) errors.push(`${at}.status: dozwolone draft/published.`);
    if (!Number.isInteger(item.sort_order)) errors.push(`${at}.sort_order: wymagana liczba całkowita.`);
    validateSourceArray(item.sources, at, errors);
    const base = String(item.image_base || '').trim();
    if (item.status === 'published' && !IMAGE_BASE.test(base)) {
      errors.push(`${at}.image_base: nieprawidłowa lub brakująca nazwa obrazu.`);
    } else if (item.status === 'published') {
      for (const ext of ['jpg', 'webp', 'avif']) {
        const name = `${base}.${ext}`;
        requiredImages.add(name);
        if (!availableImages.has(name)) errors.push(`${at}.image_base: brak ${name} na serwerze.`);
      }
    }
    if (item.status === 'published') publishedIds.push(id);
  });

  const fallbackIds = [];
  const publishedById = new Map(liveItems
    .filter((item) => item?.status === 'published')
    .map((item) => [String(item.id || ''), item]));
  fallbackItems.forEach((item, index) => {
    const at = `assets/data/news-fallback.json.items[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${at}: wpis musi być obiektem.`);
      return;
    }
    for (const field of REQUIRED_FALLBACK_FIELDS) if (!(field in item)) errors.push(`${at}.${field}: brak pola.`);
    const id = String(item.id || '').trim();
    fallbackIds.push(id);
    validateSourceArray(item.sources, at, errors);
    const image = item.image;
    if (!image || typeof image !== 'object') errors.push(`${at}.image: wymagany obiekt obrazu.`);
    else for (const ext of ['jpg', 'webp', 'avif']) {
      const imagePath = String(image[ext] || '');
      const expectedBase = String(publishedById.get(id)?.image_base || '');
      const expectedPath = `./assets/news/${expectedBase}.${ext}`;
      if (imagePath.includes('..') || !new RegExp(`^\\./assets/news/${IMAGE_BASE.source.slice(1, -1)}\\.${ext}$`, 'i').test(imagePath)) {
        errors.push(`${at}.image.${ext}: ścieżka wychodzi poza allowlistę lub ma złą nazwę.`);
      } else if (expectedBase && imagePath !== expectedPath) {
        errors.push(`${at}.image.${ext}: oczekiwano ${expectedPath}.`);
      }
    }
  });
  if (JSON.stringify(publishedIds) !== JSON.stringify(fallbackIds)) {
    errors.push('Fallback nie odpowiada dokładnie liście opublikowanych newsów w news-live.json.');
  }
  if (errors.length) throw new NewsPullError('Paczka NEWS nie przeszła walidacji danych.', EXIT.DATA, errors);
  return { requiredImages, liveItems, fallbackItems };
}

function verifyImages(liveItems, stagedByRelative, inspector = inspectImageFile) {
  const errors = [];
  const legacyWithoutHashes = [];
  const legacyDimensions = [];
  for (let index = 0; index < liveItems.length; index += 1) {
    const item = liveItems[index];
    if (item.status !== 'published') continue;
    const base = String(item.image_base || '').trim();
    if (!IMAGE_BASE.test(base)) continue;
    const expectedHashes = ['jpg', 'webp', 'avif'].map((ext) => String(item.image_hashes?.[ext] || '').trim().toLowerCase());
    const filledHashes = expectedHashes.filter(Boolean).length;
    if (filledHashes === 0) legacyWithoutHashes.push(base);
    else if (filledHashes !== 3) errors.push(`data/news-live.json.items[${index}].image_hashes: niepełny zestaw hashy obrazu.`);
    for (const ext of ['jpg', 'webp', 'avif']) {
      const expected = String(item.image_hashes?.[ext] || '').trim().toLowerCase();
      const relative = `assets/news/${base}.${ext}`;
      const staged = stagedByRelative.get(relative);
      if (filledHashes > 0 && !/^[a-f0-9]{40}$/.test(expected)) {
        errors.push(`data/news-live.json.items[${index}].image_hashes.${ext}: brak prawidłowego SHA-1 z panelu.`);
      } else if (filledHashes > 0 && (!staged || sha1File(staged) !== expected)) {
        errors.push(`${relative}: plik nie zgadza się z hashem zapisanym przez panel.`);
      }
      if (staged) {
        const info = inspector(staged);
        const expectedFormat = ext === 'jpg' ? 'JPEG' : ext.toUpperCase();
        if (info.format !== expectedFormat) errors.push(`${relative}: format ${info.format}, oczekiwano ${expectedFormat}.`);
        if (GENERATED_IMAGE_BASE.test(base)) {
          if (info.width !== 640 || info.height !== 480) errors.push(`${relative}: wymiary ${info.width}x${info.height}, oczekiwano 640x480.`);
        } else {
          const ratio = info.height > 0 ? info.width / info.height : 0;
          if (info.width < 640 || info.height < 480 || info.width > 4096 || info.height > 4096 || ratio < 1 || ratio > 2.5) {
            errors.push(`${relative}: nierozsądne wymiary obrazu legacy ${info.width}x${info.height}.`);
          } else if (info.width !== 640 || info.height !== 480) {
            legacyDimensions.push(`${relative} (${info.width}x${info.height})`);
          }
        }
      }
    }
  }
  if (errors.length) throw new NewsPullError('Obrazy NEWS nie zgadzają się z metadanymi panelu.', EXIT.DATA, errors);
  return { legacyWithoutHashes, legacyDimensions };
}

function localNews(root) {
  const file = path.join(root, 'data', 'news-live.json');
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (_) {
    return [];
  }
}

function isGitTracked(root, relative) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', relative], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
  return result.status === 0;
}

function buildRemotePlan(transport) {
  const ignored = [];
  const cleanList = (account, dir, label) => transport.list(account, dir)
    .map((name) => safeName(name, label)).filter(Boolean);
  const dataRoot = cleanList('data', '/', 'data:/');
  const backups = cleanList('data', '/news-backups/', 'data:/news-backups');
  const assetsRoot = cleanList('assets', '/', 'assets:/');
  const assetsData = cleanList('assets', '/data/', 'assets:/data');
  const images = cleanList('assets', '/news/', 'assets:/news');

  for (const name of dataRoot) if (!['news-live.json', 'news-backups'].includes(name)) ignored.push(`data:/${name}`);
  for (const name of assetsRoot) if (!['data', 'news'].includes(name)) ignored.push(`assets:/${name}`);
  for (const name of assetsData) if (name !== 'news-fallback.json') ignored.push(`assets:/data/${name}`);

  const backupNames = [];
  for (const name of backups) {
    if (BACKUP_NAME.test(name)) backupNames.push(name);
    else ignored.push(`data:/news-backups/${name}`);
  }
  const imageNames = new Set();
  for (const name of images) {
    if (IMAGE_NAME.test(name)) imageNames.add(name);
    else ignored.push(`assets:/news/${name}`);
  }
  if (!dataRoot.includes('news-live.json')) throw new NewsPullError('Brak data/news-live.json na serwerze.', EXIT.DATA);
  if (!assetsData.includes('news-fallback.json')) throw new NewsPullError('Brak assets/data/news-fallback.json na serwerze.', EXIT.DATA);
  return { backupNames: backupNames.sort(), imageNames, ignored };
}

function atomicPromote(stagedFiles, root, backupDir, mirrorRunner) {
  const rollback = new Map();
  const changedTargets = stagedFiles.map(({ relative }) => path.join(root, relative));
  const mirrorTargets = stagedFiles.flatMap(({ relative }) => {
    if (relative === 'data/news-live.json') return [path.join(root, '_site', relative)];
    if (relative === 'assets/data/news-fallback.json') return [path.join(root, '_site', relative)];
    return [];
  });
  for (const target of new Set([...changedTargets, ...mirrorTargets])) {
    rollback.set(target, fs.existsSync(target) ? fs.readFileSync(target) : null);
    if (fs.existsSync(target)) {
      const relative = path.relative(root, target);
      const backup = path.join(backupDir, relative);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(target, backup);
    }
  }
  try {
    for (const item of stagedFiles) {
      const target = path.join(root, item.relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      atomicWriteFileSync(target, fs.readFileSync(item.staged));
    }
    mirrorRunner();
    for (const item of stagedFiles) {
      const target = path.join(root, item.relative);
      if (!fs.existsSync(target) || sha256File(target) !== sha256File(item.staged)) {
        throw new Error(`hash lokalnego pliku nie zgadza się po promocji: ${item.relative}`);
      }
    }
  } catch (error) {
    for (const [target, content] of rollback.entries()) {
      if (content === null) fs.rmSync(target, { force: true });
      else atomicWriteFileSync(target, content);
    }
    throw new NewsPullError(`Lokalna promocja nie powiodła się; przywrócono poprzedni stan (${error.message}).`, EXIT.ENVIRONMENT);
  }
}

function defaultMirrorRunner(root) {
  const result = spawnSync('npm', ['run', 'assets:mirror:sync'], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(result.error?.message || result.signal || result.stderr || 'assets:mirror:sync zakończył się błędem');
  }
  return result.stdout;
}

function backupStamp(date) {
  return warsawIso(date).replace(/[:.]/g, '-');
}

function listFilesRecursive(root, relative = '') {
  const directory = path.join(root, relative);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? path.posix.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...listFilesRecursive(root, child));
    else if (entry.isFile()) files.push(child);
    else throw new NewsPullError(`Kopia zawiera niedozwolony typ pliku: ${child}`, EXIT.ENVIRONMENT);
  }
  return files.sort();
}

function verifyBackupManifest(backupDir) {
  const manifestPath = path.join(backupDir, 'manifest.json');
  const manifest = parseJsonFile(manifestPath, 'manifest.json');
  if (manifest.version !== 1 || manifest.mode !== 'NEWS_BACKUP_ONLY' || !Array.isArray(manifest.files)) {
    throw new NewsPullError('Manifest kopii NEWS ma nieprawidłowy kontrakt.', EXIT.ENVIRONMENT);
  }
  const expected = [];
  for (const item of manifest.files) {
    const relative = String(item?.path || '');
    if (!relative || relative.includes('..') || path.isAbsolute(relative) || relative.includes('\\')) {
      throw new NewsPullError(`Manifest kopii zawiera niebezpieczną ścieżkę: ${JSON.stringify(relative)}`, EXIT.ENVIRONMENT);
    }
    const file = path.join(backupDir, relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new NewsPullError(`Manifest kopii wskazuje brakujący plik: ${relative}`, EXIT.ENVIRONMENT);
    }
    const bytes = fs.statSync(file).size;
    const hash = sha256File(file);
    if (bytes !== item.bytes || hash !== item.sha256) {
      throw new NewsPullError(`Weryfikacja kopii nie powiodła się dla ${relative}.`, EXIT.ENVIRONMENT);
    }
    expected.push(relative);
  }
  const actual = listFilesRecursive(backupDir).filter((relative) => relative !== 'manifest.json');
  if (JSON.stringify(expected.sort()) !== JSON.stringify(actual)) {
    throw new NewsPullError('Manifest kopii nie obejmuje dokładnie całego zestawu plików.', EXIT.ENVIRONMENT);
  }
  return manifest;
}

function createBackupOnly(stagedFiles, options = {}) {
  const now = options.now || (() => new Date());
  const backupRoot = options.backupRoot || path.join(os.homedir(), 'fitpo50-backups');
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const stamp = backupStamp(now());
  const finalDir = path.join(backupRoot, `news-${stamp}`);
  if (fs.existsSync(finalDir)) {
    throw new NewsPullError(`Docelowa kopia już istnieje: ${finalDir}`, EXIT.ENVIRONMENT);
  }
  const tempDir = fs.mkdtempSync(path.join(backupRoot, `.news-${stamp}.tmp-`));
  fs.chmodSync(tempDir, 0o700);
  try {
    const files = [];
    for (const item of stagedFiles) {
      const relative = String(item.relative || '');
      if (!relative || relative.includes('..') || path.isAbsolute(relative) || relative.includes('\\')) {
        throw new NewsPullError(`Niebezpieczna ścieżka kopii: ${JSON.stringify(relative)}`, EXIT.ENVIRONMENT);
      }
      const target = path.join(tempDir, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.copyFileSync(item.staged, target);
      fs.chmodSync(target, 0o600);
      files.push({ path: relative, bytes: fs.statSync(target).size, sha256: sha256File(target) });
    }
    const manifest = {
      version: 1,
      mode: 'NEWS_BACKUP_ONLY',
      created_at: warsawIso(now()),
      files: files.sort((left, right) => left.path.localeCompare(right.path)),
    };
    const manifestPath = path.join(tempDir, 'manifest.json');
    atomicWriteFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.chmodSync(manifestPath, 0o600);
    verifyBackupManifest(tempDir);
    for (const directory of [tempDir, ...listFilesRecursive(tempDir)
      .map((relative) => path.dirname(path.join(tempDir, relative)))]) {
      if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) fs.chmodSync(directory, 0o700);
    }
    fs.renameSync(tempDir, finalDir);
    return { backupDir: finalDir, files: manifest.files };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (error instanceof NewsPullError) throw error;
    throw new NewsPullError(`Nie udało się utworzyć kompletnej kopii NEWS: ${error.message || error}`, EXIT.ENVIRONMENT);
  }
}

function pullNews(options = {}) {
  const root = options.root || ROOT;
  const transport = options.transport;
  const dryRun = Boolean(options.dryRun);
  const backupOnly = Boolean(options.backupOnly);
  if (dryRun && backupOnly) {
    throw new NewsPullError('Opcji --dry-run i --backup-only nie można łączyć.', EXIT.DATA);
  }
  const now = options.now || (() => new Date());
  const mirrorRunner = options.mirrorRunner || (() => defaultMirrorRunner(root));
  const staging = createManagedTempDir({
    prefix: 'fitpo50-news-pull-stage-',
    projectRoot: root,
    type: 'news-pull-staging',
  });
  let keepBackup = null;
  let completed = false;
  try {
    const plan = buildRemotePlan(transport);
    const stagedLive = path.join(staging, 'data/news-live.json');
    const stagedFallback = path.join(staging, 'assets/data/news-fallback.json');
    const stagedSiteLive = path.join(staging, '_site/data/news-live.json');
    const stagedSiteFallback = path.join(staging, '_site/assets/data/news-fallback.json');
    transport.download('data', '/news-live.json', stagedLive, LIMITS.jsonBytes);
    transport.download('assets', '/data/news-fallback.json', stagedFallback, LIMITS.jsonBytes);
    // The public_html/data mirror is still managed by Git in the current
    // Hostinger layout. It must remain byte-identical to the panel's
    // news-live.json; it is not another copy of the public fallback format.
    if (!backupOnly) {
      transport.download('data', '/news-live.json', stagedSiteLive, LIMITS.jsonBytes);
      transport.download('assets', '/data/news-fallback.json', stagedSiteFallback, LIMITS.jsonBytes);
    }
    const live = parseJsonFile(stagedLive, 'data/news-live.json');
    const fallback = parseJsonFile(stagedFallback, 'assets/data/news-fallback.json');
    const validated = validatePackage(live, fallback, plan.imageNames);
    const draftCount = validated.liveItems.filter((item) => item?.status !== 'published').length;
    const privateStoreTracked = options.privateStoreTracked === undefined
      ? isGitTracked(root, 'data/news-live.json')
      : Boolean(options.privateStoreTracked);
    const protectedDraftMode = draftCount > 0 && privateStoreTracked;
    const publicFiles = [
      { account: 'data', remote: '/news-live.json', relative: 'data/news-live.json', staged: stagedLive, limit: LIMITS.jsonBytes },
      { account: 'assets', remote: '/data/news-fallback.json', relative: 'assets/data/news-fallback.json', staged: stagedFallback, limit: LIMITS.jsonBytes },
      { account: 'data', remote: '/news-live.json', relative: '_site/data/news-live.json', staged: stagedSiteLive, limit: LIMITS.jsonBytes },
      { account: 'assets', remote: '/data/news-fallback.json', relative: '_site/assets/data/news-fallback.json', staged: stagedSiteFallback, limit: LIMITS.jsonBytes },
    ];
    const backupFiles = plan.backupNames.map((name) => ({
      account: 'data', remote: `/news-backups/${name}`, relative: `data/news-backups/${name}`,
      staged: path.join(staging, 'data/news-backups', name), limit: LIMITS.jsonBytes,
    }));
    const imageFiles = [...validated.requiredImages].sort().map((name) => ({
      account: 'assets', remote: `/news/${name}`, relative: `assets/news/${name}`,
      staged: path.join(staging, 'assets/news', name), limit: LIMITS.imageBytes,
    }));
    const archiveFiles = [...publicFiles.slice(0, 2), ...backupFiles, ...imageFiles];
    const promotionImages = protectedDraftMode
      ? imageFiles.filter((file) => GENERATED_IMAGE_BASE.test(path.parse(file.relative).name))
      : imageFiles;
    const promotionFiles = protectedDraftMode
      ? [...publicFiles.filter((file) => file.relative.includes('news-fallback.json')), ...promotionImages]
      : [...publicFiles, ...promotionImages];
    const downloadedFiles = backupOnly
      ? archiveFiles
      : [...publicFiles, ...backupFiles, ...imageFiles];
    const remainingFiles = downloadedFiles.filter((file) => !publicFiles.includes(file));
    if (typeof transport.downloadBatch === 'function') {
      for (const account of ['data', 'assets']) {
        for (const limit of [LIMITS.jsonBytes, LIMITS.imageBytes]) {
          const group = remainingFiles.filter((file) => file.account === account && file.limit === limit);
          transport.downloadBatch(account, group, limit);
        }
      }
    } else {
      for (const file of remainingFiles) transport.download(file.account, file.remote, file.staged, file.limit);
    }

    const imageVerification = verifyImages(
      validated.liveItems,
      new Map(downloadedFiles.map((file) => [file.relative, file.staged])),
      options.imageInspector || inspectImageFile,
    );

    let totalBytes = 0;
    for (const file of downloadedFiles) {
      totalBytes += fs.statSync(file.staged).size;
      if (file.relative.endsWith('.json')) parseJsonFile(file.staged, file.relative);
    }
    if (totalBytes > LIMITS.totalBytes) throw new NewsPullError(`Paczka przekracza limit ${LIMITS.totalBytes} B.`, EXIT.DATA);

    if (backupOnly) {
      const backup = createBackupOnly(archiveFiles, { now, backupRoot: options.backupRoot });
      const report = {
        status: 'OK', backup_only: true, dry_run: false,
        news_count: validated.liveItems.length,
        published_count: validated.fallbackItems.length,
        ignored_count: plan.ignored.length,
        ignored: plan.ignored,
        hashes_verified: true,
        backup_dir: backup.backupDir,
        backup_files: backup.files,
        legacy_images_without_panel_hash: imageVerification.legacyWithoutHashes,
        legacy_images_nonstandard_dimensions: imageVerification.legacyDimensions,
      };
      completed = true;
      return report;
    }

    const previous = localNews(root);
    const previousById = new Map(previous.map((item) => [String(item.id || ''), item]));
    const newItems = validated.liveItems.filter((item) => !previousById.has(String(item.id || '')));
    const changedItems = validated.liveItems.filter((item) => {
      const old = previousById.get(String(item.id || ''));
      return old && JSON.stringify(old) !== JSON.stringify(item);
    });
    const changedFiles = promotionFiles.filter((file) => {
      const local = path.join(root, file.relative);
      return !fs.existsSync(local) || sha256File(local) !== sha256File(file.staged);
    });
    const newImages = changedFiles.filter((file) => file.relative.startsWith('assets/news/') && !fs.existsSync(path.join(root, file.relative)));
    const hashReport = changedFiles.map((file) => ({ path: file.relative, sha256: sha256File(file.staged) }));

    let serverBackup = null;
    if (!dryRun) {
      try {
        serverBackup = createBackupOnly(archiveFiles, { now, backupRoot: options.backupRoot });
      } catch (error) {
        if (error instanceof NewsPullError && error.exitCode === EXIT.ENVIRONMENT) throw error;
        throw new NewsPullError(`Nie udało się zabezpieczyć kopii NEWS przed promocją: ${error.message || error}`, EXIT.ENVIRONMENT);
      }
    }

    if (!dryRun && changedFiles.length) {
      const stamp = now().toISOString().replace(/[:.]/g, '-');
      keepBackup = path.join(os.tmpdir(), `fitpo50-news-pull-backup-${stamp}`);
      fs.mkdirSync(keepBackup, { recursive: true });
      atomicPromote(changedFiles, root, keepBackup, protectedDraftMode ? () => {} : mirrorRunner);
    } else if (!dryRun && !protectedDraftMode) {
      mirrorRunner();
    }

    const report = {
      status: 'OK', dry_run: dryRun, news_count: validated.liveItems.length,
      published_count: validated.fallbackItems.length,
      new_news: newItems.map((item) => item.title),
      changed_news: changedItems.map((item) => item.title),
      new_images: newImages.map((item) => item.relative),
      changed_files: changedFiles.map((item) => item.relative),
      ignored_count: plan.ignored.length,
      ignored: plan.ignored,
      hashes: hashReport,
      hashes_verified: true,
      legacy_images_without_panel_hash: imageVerification.legacyWithoutHashes,
      legacy_images_nonstandard_dimensions: imageVerification.legacyDimensions,
      backup_dir: keepBackup,
      server_backup_dir: serverBackup?.backupDir || null,
      server_backup_files: serverBackup?.files || [],
      private_live_backup_dir: protectedDraftMode ? serverBackup?.backupDir || null : null,
      private_live_sha256: protectedDraftMode ? sha256File(stagedLive) : null,
      privacy_warning: protectedDraftMode
        ? `Na serwerze są wpisy nieopublikowane (${draftCount}). Zaktualizowano wyłącznie publiczny fallback i miniatury news_20*. Pełny plik live zapisano tylko w prywatnej kopii poza repo; szkice nie trafiły do repo.`
        : '',
    };
    completed = true;
    return report;
  } finally {
    disposeTempWorkspace(staging, { status: completed ? 'COMPLETED' : 'FAILED' });
  }
}

function printReport(report) {
  console.log(`\n[NEWS:PULL][${report.backup_only ? 'BACKUP-ONLY' : (report.dry_run ? 'DRY-RUN' : 'OK')}]`);
  console.log(`Newsy na serwerze: ${report.news_count}, opublikowane: ${report.published_count}.`);
  if (report.backup_only) {
    console.log(`Kompletna kopia: ${report.backup_dir}`);
    console.log(`Pliki w manifeście: ${report.backup_files.length}. SHA-256: zgodne.`);
    console.log(`Pominięte ścieżki poza allowlistą: ${report.ignored_count}.`);
    return;
  }
  console.log(`Nowe newsy (${report.new_news.length}): ${report.new_news.join(' | ') || 'brak'}`);
  console.log(`Zmienione newsy (${report.changed_news.length}): ${report.changed_news.join(' | ') || 'brak'}`);
  console.log(`Nowe obrazy: ${report.new_images.length}. Zmienione pliki łącznie: ${report.changed_files.length}.`);
  console.log(`Pominięte ścieżki poza allowlistą: ${report.ignored_count}.`);
  if (report.ignored.length) console.log(`Przykłady pominiętych: ${report.ignored.slice(0, 12).join(', ')}${report.ignored.length > 12 ? '…' : ''}`);
  console.log(`SHA-256: ${report.hashes_verified ? 'zgodne' : 'NIEZGODNE'}.`);
  if (report.legacy_images_without_panel_hash.length) {
    console.log(`Starsze obrazy bez hasha w panelu: ${report.legacy_images_without_panel_hash.length} (format i wymiary sprawdzone).`);
  }
  if (report.legacy_images_nonstandard_dimensions.length) {
    console.log(`Starsze obrazy o zachowanych wymiarach legacy: ${report.legacy_images_nonstandard_dimensions.length}.`);
  }
  if (report.privacy_warning) console.log(`PRYWATNOŚĆ: ${report.privacy_warning}`);
  if (report.private_live_backup_dir) {
    console.log(`Prywatna kopia pełnego live: ${report.private_live_backup_dir} (SHA-256: ${report.private_live_sha256}).`);
  }
  if (report.server_backup_dir) {
    console.log(`Zweryfikowana kopia serwerowa poza repo: ${report.server_backup_dir} (${report.server_backup_files.length} plików).`);
  }
  if (report.backup_dir) console.log(`Kopia poprzednich plików: ${report.backup_dir}`);
  if (report.dry_run) console.log('Dry-run: nie zmieniono lokalnych plików i nie uruchomiono mirroru.');
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Użycie: npm run news:pull -- [--dry-run | --backup-only] [--secrets-file /ścieżka/news-pull.env]');
      return;
    }
    const credentials = readCredentials(args.secretsFile);
    const report = pullNews({
      backupOnly: args.backupOnly,
      dryRun: args.dryRun,
      transport: new FtpsTransport({ credentials }),
    });
    printReport(report);
  } catch (error) {
    const exitCode = error instanceof NewsPullError ? error.exitCode : EXIT.ENVIRONMENT;
    console.error(`\n[NEWS:PULL][FAIL][${exitCode}] ${error.message || error}`);
    if (Array.isArray(error.details)) error.details.forEach((detail) => console.error(`- ${detail}`));
    process.exitCode = exitCode;
  }
}

if (require.main === module) main();

module.exports = {
  EXIT,
  FTPS,
  LIMITS,
  NewsPullError,
  FtpsTransport,
  safeName,
  isGitTracked,
  readCredentials,
  validatePackage,
  verifyImages,
  inspectImageFile,
  buildRemotePlan,
  createBackupOnly,
  verifyBackupManifest,
  parseArgs,
  atomicPromote,
  pullNews,
};
