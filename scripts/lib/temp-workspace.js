'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MANIFEST_NAME = '.fitpo50-workspace.json';
const LOCK_NAME = '.fitpo50-workspace.lock';
const WORKSPACE_STATUSES = new Set(['ACTIVE', 'COMPLETED', 'FAILED']);

function atomicWriteJson(filePath, payload) {
  const temporary = `${filePath}.writing-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

function safeLabel(value, fallback) {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function resolveWorkspaceProjectRoot(startDirectory = process.cwd()) {
  const start = path.resolve(startDirectory);
  const manifest = readJsonIfValid(path.join(start, MANIFEST_NAME));
  if (manifest?.project_root) return path.resolve(manifest.project_root);
  return start;
}

function createManagedTempDir(options = {}) {
  const prefix = safeLabel(options.prefix, 'fitpo50-workspace-');
  if (prefix.includes('/') || prefix.includes('\\') || prefix.includes('..')) throw new Error(`Niebezpieczny prefiks workspace: ${prefix}`);
  const tempRoot = path.resolve(options.tempRoot || os.tmpdir());
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  fs.mkdirSync(tempRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(tempRoot, prefix));
  try {
    const now = options.createdAt ? new Date(options.createdAt) : new Date();
    if (!Number.isFinite(now.getTime())) throw new Error('Nieprawidłowy czas utworzenia workspace.');
    const pid = Number.isInteger(options.pid) && options.pid > 0 ? options.pid : process.pid;
    const manifest = {
      version: 1,
      workspace_type: safeLabel(options.type, 'temporary-workspace'),
      pid,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      project_root: projectRoot,
      slug: String(options.slug || '').trim(),
      status: 'ACTIVE',
    };
    atomicWriteJson(path.join(directory, MANIFEST_NAME), manifest);
    atomicWriteJson(path.join(directory, LOCK_NAME), {
      version: 1,
      pid,
      created_at: manifest.created_at,
      project_root: projectRoot,
      workspace_type: manifest.workspace_type,
    });
    return directory;
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function readJsonIfValid(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function readWorkspaceManifest(directory) {
  return readJsonIfValid(path.join(directory, MANIFEST_NAME));
}

function isProcessAlive(pid) {
  const normalized = Number(pid);
  if (!Number.isInteger(normalized) || normalized <= 0) return false;
  try {
    process.kill(normalized, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function markTempWorkspace(directory, status, extra = {}) {
  if (!WORKSPACE_STATUSES.has(status)) throw new Error(`Nieprawidłowy status workspace: ${status}`);
  const manifestPath = path.join(directory, MANIFEST_NAME);
  const manifest = readWorkspaceManifest(directory);
  if (!manifest) throw new Error(`Brak prawidłowego manifestu workspace: ${directory}`);
  const now = new Date().toISOString();
  const next = { ...manifest, ...extra, status, updated_at: now };
  if (status !== 'ACTIVE') next.completed_at = next.completed_at || now;
  atomicWriteJson(manifestPath, next);
  if (status !== 'ACTIVE') fs.rmSync(path.join(directory, LOCK_NAME), { force: true });
  return next;
}

function disposeTempWorkspace(directory, options = {}) {
  if (!directory || !fs.existsSync(directory)) return;
  const status = options.status === 'FAILED' ? 'FAILED' : 'COMPLETED';
  try {
    markTempWorkspace(directory, status, options.error ? { error: String(options.error) } : {});
  } finally {
    if (options.remove !== false) fs.rmSync(directory, { recursive: true, force: true });
  }
}

function inspectTempWorkspace(directory, options = {}) {
  const nowMs = options.nowMs === undefined ? Date.now() : Number(options.nowMs);
  const minAgeMs = Number(options.minAgeMs || 0);
  const expectedProjectRoot = options.projectRoot ? path.resolve(options.projectRoot) : '';
  const manifestPath = path.join(directory, MANIFEST_NAME);
  const lockPath = path.join(directory, LOCK_NAME);
  if (!fs.existsSync(manifestPath)) return { eligible: false, reason: 'UNMANAGED', directory };
  const manifest = readJsonIfValid(manifestPath);
  if (!manifest || manifest.version !== 1 || !WORKSPACE_STATUSES.has(manifest.status)) return { eligible: false, reason: 'INVALID_MANIFEST', directory };
  const createdMs = Date.parse(String(manifest.created_at || ''));
  if (!Number.isFinite(createdMs)) return { eligible: false, reason: 'INVALID_MANIFEST', directory };
  if (!manifest.project_root || (expectedProjectRoot && path.resolve(manifest.project_root) !== expectedProjectRoot)) {
    return { eligible: false, reason: 'FOREIGN_PROJECT', directory, manifest };
  }
  const ageMs = Math.max(0, nowMs - createdMs);
  if (ageMs < minAgeMs) return { eligible: false, reason: 'FRESH', directory, manifest, ageMs };
  const lock = fs.existsSync(lockPath) ? readJsonIfValid(lockPath) : null;
  if (fs.existsSync(lockPath) && !lock) return { eligible: false, reason: 'INVALID_LOCK', directory, manifest, ageMs };
  const activePid = Boolean((lock && isProcessAlive(lock.pid)) || (manifest.status === 'ACTIVE' && isProcessAlive(manifest.pid)));
  if (activePid) return { eligible: false, reason: 'ACTIVE_PROCESS', directory, manifest, ageMs };
  return { eligible: true, reason: manifest.status === 'ACTIVE' ? 'ORPHANED' : manifest.status, directory, manifest, ageMs };
}

module.exports = {
  LOCK_NAME,
  MANIFEST_NAME,
  WORKSPACE_STATUSES,
  createManagedTempDir,
  disposeTempWorkspace,
  inspectTempWorkspace,
  isProcessAlive,
  markTempWorkspace,
  readWorkspaceManifest,
  resolveWorkspaceProjectRoot,
};
