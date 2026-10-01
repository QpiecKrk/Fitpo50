'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { readWorkspaceManifest } = require('./temp-workspace');

const CAPABILITY_RELATIVE_PATH = path.join('.tmp', 'pipeline-capability.json');
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function atomicWriteJson(filePath, payload) {
  const temporary = `${filePath}.writing-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filePath);
  fs.chmodSync(filePath, 0o600);
}

function real(directory) {
  return fs.realpathSync(path.resolve(directory));
}

function issuePipelineCapability(stageRoot, options = {}) {
  const resolvedStage = real(stageRoot);
  const workspace = readWorkspaceManifest(resolvedStage);
  if (!workspace || workspace.status !== 'ACTIVE' || workspace.workspace_type !== 'article-publication-staging') {
    throw new Error('Capability można wystawić wyłącznie dla aktywnego stagingu publikacji artykułu.');
  }
  const operations = [...new Set((options.operations || []).map((item) => String(item || '').trim()).filter(Boolean))];
  if (!operations.length) throw new Error('Capability wymaga co najmniej jednej dozwolonej operacji.');
  const now = Number(options.now === undefined ? Date.now() : options.now);
  const ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
  if (!Number.isFinite(now) || !Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('Nieprawidłowy czas ważności capability.');
  const token = crypto.randomBytes(32).toString('hex');
  const capabilityPath = path.join(resolvedStage, CAPABILITY_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(capabilityPath), { recursive: true });
  atomicWriteJson(capabilityPath, {
    version: 1,
    stage_root: resolvedStage,
    project_root: path.resolve(workspace.project_root),
    workspace_type: workspace.workspace_type,
    controller_pid: process.pid,
    issued_at_ms: now,
    expires_at_ms: now + ttlMs,
    token_sha256: sha256(token),
    operations,
    consumed_operations: [],
  });
  return { capabilityPath, token };
}

function readCapability(capabilityPath) {
  try {
    return JSON.parse(fs.readFileSync(capabilityPath, 'utf8'));
  } catch (_error) {
    throw new Error('Brak lub uszkodzony plik capability kontrolera pipeline.');
  }
}

function assertPipelineCapability(options = {}) {
  const cwd = real(options.cwd || process.cwd());
  const operation = String(options.operation || '').trim();
  const token = String(options.token || '').trim();
  const suppliedPath = String(options.capabilityPath || '').trim();
  if (!operation) throw new Error('Nie podano operacji capability.');
  if (!token) throw new Error('Brak jednorazowego tokenu kontrolera pipeline.');
  if (!suppliedPath) throw new Error('Brak ścieżki capability kontrolera pipeline.');
  const expectedPath = path.join(cwd, CAPABILITY_RELATIVE_PATH);
  if (path.resolve(suppliedPath) !== path.resolve(expectedPath)) {
    throw new Error('Capability nie należy do bieżącego katalogu stagingu.');
  }
  const workspace = readWorkspaceManifest(cwd);
  if (!workspace || workspace.status !== 'ACTIVE' || workspace.workspace_type !== 'article-publication-staging') {
    throw new Error('Zapis jest dozwolony wyłącznie w aktywnym stagingu publikacji artykułu.');
  }
  const payload = readCapability(expectedPath);
  const now = Number(options.now === undefined ? Date.now() : options.now);
  if (payload.version !== 1 || real(payload.stage_root) !== cwd) throw new Error('Capability wskazuje inny katalog stagingu.');
  if (path.resolve(payload.project_root || '') !== path.resolve(workspace.project_root || '')) {
    throw new Error('Capability wskazuje inny projekt niż manifest stagingu.');
  }
  if (!Number.isFinite(payload.expires_at_ms) || now > payload.expires_at_ms) throw new Error('Capability wygasła.');
  const actual = Buffer.from(sha256(token), 'hex');
  const expected = Buffer.from(String(payload.token_sha256 || ''), 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Nieprawidłowy token capability.');
  if (!Array.isArray(payload.operations) || !payload.operations.includes(operation)) {
    throw new Error(`Capability nie zezwala na operację: ${operation}.`);
  }
  if (Array.isArray(payload.consumed_operations) && payload.consumed_operations.includes(operation)) {
    throw new Error(`Capability dla operacji ${operation} została już zużyta.`);
  }
  return payload;
}

function consumePipelineCapability(options = {}) {
  const payload = assertPipelineCapability(options);
  const operation = String(options.operation || '').trim();
  const capabilityPath = path.resolve(options.capabilityPath);
  payload.consumed_operations = [...new Set([...(payload.consumed_operations || []), operation])];
  payload.last_consumed_at = new Date(options.now === undefined ? Date.now() : Number(options.now)).toISOString();
  atomicWriteJson(capabilityPath, payload);
  return payload;
}

function capabilityFromEnvironment(operation, cwd = process.cwd()) {
  return consumePipelineCapability({
    cwd,
    operation,
    token: process.env.FITPO50_PIPELINE_CAPABILITY_TOKEN,
    capabilityPath: process.env.FITPO50_PIPELINE_CAPABILITY_FILE,
  });
}

module.exports = {
  CAPABILITY_RELATIVE_PATH,
  assertPipelineCapability,
  capabilityFromEnvironment,
  consumePipelineCapability,
  issuePipelineCapability,
};
