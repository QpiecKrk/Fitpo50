const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { exitCodeForReport, runDryRun, validateInput } = require('../scripts/article-dry-run');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/article-packages/zmiana-czasu-original-invalid.fitpo50.json');
const CORRECTED_FIXTURE = path.join(ROOT, 'tests/fixtures/article-packages/zmiana-czasu-corrected.fitpo50.json');

test('dry-run exit contract keeps 10 for review and 0 only for ready', () => {
  assert.equal(exitCodeForReport({ status: 'AWAITING_REVIEW' }), 10);
  assert.equal(exitCodeForReport({ status: 'PASS' }), 0);
  assert.equal(exitCodeForReport({ status: 'READY' }), 0);
  assert.equal(exitCodeForReport({ status: 'BLOCKED' }), 20);
  assert.equal(exitCodeForReport({ status: 'ENVIRONMENT_FAILURE' }), 30);
});

test('both faithful change-time fixtures are present: original invalid and corrected', () => {
  assert.equal(fs.existsSync(FIXTURE), true);
  assert.equal(fs.existsSync(CORRECTED_FIXTURE), true);
  const original = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const corrected = JSON.parse(fs.readFileSync(CORRECTED_FIXTURE, 'utf8'));
  assert.equal(original.slug, corrected.slug);
  assert.notDeepEqual(original, corrected);
  assert.ok(corrected.sources.every((source) => ['fallback_url', 'evidence_scope', 'publication_date', 'checked_via', 'recheck_after'].every((key) => Object.hasOwn(source, key))));
});

test('real change-time fixture reports all known intake problems in one dry-run', () => {
  const before = fs.readFileSync(FIXTURE, 'utf8');
  assert.equal(crypto.createHash('sha256').update(before).digest('hex'), '88b63fe54767bd7952ac59886549973c9fba2f1fbcbd69b2edaefc47e2ad9a5f');
  const packageJson = JSON.parse(before);
  for (const prompt of packageJson.image_prompts_v4) {
    for (const extension of ['jpg', 'webp', 'avif']) {
      assert.equal(fs.existsSync(path.join(ROOT, 'assets', `${prompt.filename_base}.${extension}`)), true, `${prompt.filename_base}.${extension}`);
    }
  }
  const diagnostics = validateInput(FIXTURE, path.join(ROOT, 'assets'));
  const messages = diagnostics.map((item) => item.message).join('\n');
  assert.match(messages, /evidence_source_urls/);
  assert.match(messages, /logic_links\[3\]/);
  assert.match(messages, /twierdzenie wymagające dowodu/);
  assert.match(messages, /LOW_CONTEXTUAL_LINK_COUNT/);
  assert.ok(diagnostics.length >= 4);
  assert.ok(diagnostics.every((item) => ['FIXABLE_LOCAL', 'REQUIRES_WRITER'].includes(item.class)));
  assert.ok(diagnostics.every((item) => String(item.path).startsWith('/')));
  assert.ok(diagnostics.every((item) => item.error_code));
  assert.equal(fs.readFileSync(FIXTURE, 'utf8'), before);
});

test('article:add --dry-run returns every fixture problem as structured JSON with exit 20', () => {
  const result = spawnSync(process.execPath, [
    'scripts/article-add.js', '--dry-run', '--json', '--file', FIXTURE, '--assets-dir', path.join(ROOT, 'assets'),
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 20, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.summary.errors >= 4);
  assert.ok(report.diagnostics.every((item) => item.path && item.class && item.error_code));
});

test('dry-run valid flow reaches desktop, mobile and PDF review without repository promotion', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-dry-run-test-'));
  const input = path.join(temp, 'valid.fitpo50.json');
  const prepared = path.join(temp, 'ready', 'valid.fitpo50.json');
  const stage = path.join(temp, 'stage');
  fs.mkdirSync(path.dirname(prepared), { recursive: true });
  fs.writeFileSync(input, '{"slug":"valid"}\n');
  fs.writeFileSync(prepared, '{"slug":"valid"}\n');
  const calls = [];
  const report = runDryRun({ file: input, 'assets-dir': temp }, {
    validateInput: () => [],
    createWorkspace: () => temp,
    disposeWorkspace: () => {},
    spawnSync(command, args) {
      calls.push(args);
      if (args.some((item) => item.endsWith('article-json-workbench.js'))) return { status: 0, stdout: `[ARTICLE-JSON] JSON: ${prepared}\n`, stderr: '' };
      return { status: 10, stdout: `[AWAITING_VISUAL_REVIEW] ${stage}\n`, stderr: '' };
    },
  });
  assert.equal(report.status, 'AWAITING_REVIEW');
  assert.match(report.artifacts.desktop, /desktop\.png$/);
  assert.match(report.artifacts.mobile, /mobile\.png$/);
  assert.match(report.artifacts.pdf_pages, /pdf-pages$/);
  assert.ok(calls.some((args) => args.includes('--dry-run')));
  fs.rmSync(temp, { recursive: true, force: true });
});
