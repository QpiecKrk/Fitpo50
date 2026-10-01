const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  assertPipelineCapability,
  issuePipelineCapability,
} = require('../scripts/lib/pipeline-capability');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');
const { reportPathForJson, sha256File } = require('../scripts/lib/article-json-artifact');

const REPO = path.resolve(__dirname, '..');

const roots = [];

function fixture() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-cap-project-'));
  roots.push(projectRoot);
  const stageRoot = createManagedTempDir({
    prefix: 'fitpo50-preview-',
    type: 'article-publication-staging',
    projectRoot,
    slug: 'capability-test',
  });
  return { projectRoot, stageRoot };
}

test.after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

test('jednorazowa capability jest związana ze stagingiem i dozwoloną operacją', () => {
  const { stageRoot } = fixture();
  const issued = issuePipelineCapability(stageRoot, {
    operations: ['article-pipeline:staging', 'article-import:write'],
    ttlMs: 60_000,
  });
  const result = assertPipelineCapability({
    cwd: stageRoot,
    operation: 'article-pipeline:staging',
    token: issued.token,
    capabilityPath: issued.capabilityPath,
  });
  assert.equal(result.stage_root, fs.realpathSync(stageRoot));
  assert.throws(() => assertPipelineCapability({
    cwd: stageRoot,
    operation: 'article-promotion:write',
    token: issued.token,
    capabilityPath: issued.capabilityPath,
  }), /operacj/i);
  disposeTempWorkspace(stageRoot);
});

test('sama zmienna stagingowa nie zastępuje tokenu kontrolera', () => {
  const { stageRoot } = fixture();
  const issued = issuePipelineCapability(stageRoot, { operations: ['article-import:write'] });
  assert.throws(() => assertPipelineCapability({
    cwd: stageRoot,
    operation: 'article-import:write',
    token: 'podrobiony-token',
    capabilityPath: issued.capabilityPath,
  }), /token/i);
  assert.throws(() => assertPipelineCapability({
    cwd: path.dirname(stageRoot),
    operation: 'article-import:write',
    token: issued.token,
    capabilityPath: issued.capabilityPath,
  }), /staging|katalog/i);
  disposeTempWorkspace(stageRoot);
});

test('wygasła capability blokuje zapis', () => {
  const { stageRoot } = fixture();
  const issued = issuePipelineCapability(stageRoot, {
    operations: ['article-import:write'],
    now: 1_000,
    ttlMs: 1_000,
  });
  assert.throws(() => assertPipelineCapability({
    cwd: stageRoot,
    operation: 'article-import:write',
    token: issued.token,
    capabilityPath: issued.capabilityPath,
    now: 2_001,
  }), /wygas/i);
  disposeTempWorkspace(stageRoot);
});

test('bezpośredni importer nie zapisuje nawet z podrobioną flagą stagingu i poprawnym statusem CONTENT_READY', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-direct-import-'));
  roots.push(directory);
  const input = path.join(directory, 'direct-import.fitpo50.json');
  fs.writeFileSync(input, `${JSON.stringify({ slug: 'direct-import', title: 'Test bezpośredniego importu' })}\n`);
  fs.writeFileSync(reportPathForJson(input), `${JSON.stringify({
    status: 'CONTENT_READY',
    output_file: input,
    output_sha256: sha256File(input),
  })}\n`);
  const result = spawnSync('node', ['scripts/import-article.js', '--file', input, '--publish', 'true'], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, FITPO50_STAGING_INTERNAL: '1' },
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /token|capability|staging/i);
  assert.equal(fs.existsSync(path.join(REPO, 'direct-import.html')), false);
});
