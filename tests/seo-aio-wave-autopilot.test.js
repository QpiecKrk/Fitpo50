const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function runNpm(script, args = []) {
  return spawnSync('npm', ['run', script, '--', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function contentWorktreeState() {
  const result = spawnSync(
    'git',
    ['status', '--short', '--untracked-files=all', '--', '*.html', '_site'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function writeCommandCenterFixture(file) {
  const report = {
    waves: {
      wave_1_fast_page_one: [
        {
          type: 'P0_PUSH_TO_PAGE_ONE',
          score: { total: 90, seo: 70, aeo: 80, geo: 90, aio: 85 },
          url: 'https://fitpo50.pl/target.html',
          file: 'target.html',
          title: 'Target',
          gsc: { impressions: 120, clicks: 0, ctr: 0, position: 8 },
          keyword_plan: { primary: 'target fraza' },
          tasks: ['Dodaj linki kontekstowe.', 'Popraw CTR.'],
          internal_link_sources: [
            { from: 'source-a.html', anchor: 'target anchor', placement: 'Sugerowane źródło.' },
            { from: 'source-b.html', anchor: 'target anchor 2', placement: 'Sugerowane źródło.' },
          ],
          promotion_urls: ['https://fitpo50.pl/target.html', 'https://fitpo50.pl/source-a.html'],
          validation_commands: ['node scripts/validate-article-standard.js target.html'],
          measurement: { rule: '7/14/28 dni' },
          performance_delta: { conclusion: 'NEW_VISIBILITY' },
        },
      ],
    },
  };
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

test('wave autopilot proposal waits for approval and does not publish a premature GSC queue', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-wave-'));
  const input = path.join(dir, 'seo-aio-command-center.json');
  writeCommandCenterFixture(input);

  const result = spawnSync(
    'node',
    ['scripts/seo-aio-wave-autopilot.js', '--input', input, '--output-dir', dir, '--no-mirror', '--wave', '1'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const proposal = JSON.parse(fs.readFileSync(path.join(dir, 'seo-aio-wave-proposal.json'), 'utf8'));
  assert.equal(proposal.status, 'AWAITING_USER_APPROVAL');
  assert.equal(proposal.selected_cards.length, 1);
  assert.equal(proposal.proposed_changes.link_operations.length, 2);
  assert.deepEqual(proposal.gsc_submit_queue, []);
  assert.ok(proposal.planned_gsc_submit_queue.includes('https://fitpo50.pl/source-a.html'));
  assert.match(fs.readFileSync(path.join(dir, 'seo-aio-wave-proposal.md'), 'utf8'), /Bramka Zatwierdzenia/);
});

test('wave autopilot blocks the retired generic apply mode', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-wave-block-'));
  const input = path.join(dir, 'seo-aio-command-center.json');
  writeCommandCenterFixture(input);

  const result = spawnSync(
    'node',
    ['scripts/seo-aio-wave-autopilot.js', '--input', input, '--output-dir', dir, '--no-mirror', '--wave', '1', '--apply', 'true', '--mode', 'safe-links', '--confirm', 'APPLY_WAVE'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /APPLY_BLOCKED/);
});

test('public npm proposal command is proposal-only and leaves articles and _site unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-wave-npm-'));
  const input = path.join(dir, 'seo-aio-command-center.json');
  writeCommandCenterFixture(input);
  const before = contentWorktreeState();

  const result = runNpm('seo:aio:wave:proposal', [
    '--input', input,
    '--output-dir', dir,
    '--no-mirror',
    '--wave', '1',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /status=AWAITING_USER_APPROVAL/);
  const proposal = JSON.parse(fs.readFileSync(path.join(dir, 'seo-aio-wave-proposal.json'), 'utf8'));
  assert.equal(proposal.status, 'AWAITING_USER_APPROVAL');
  assert.deepEqual(proposal.gsc_submit_queue, []);
  assert.deepEqual(proposal.planned_gsc_submit_queue, [
    'https://fitpo50.pl/target.html',
    'https://fitpo50.pl/source-a.html',
  ]);
  assert.equal(fs.readFileSync(path.join(dir, 'seo-aio-wave-gsc-submit.txt'), 'utf8'), '\n');
  assert.equal(contentWorktreeState(), before);
});

test('public npm proposal command blocks every --apply attempt before writing output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-wave-npm-apply-'));
  const input = path.join(dir, 'seo-aio-command-center.json');
  writeCommandCenterFixture(input);

  const result = runNpm('seo:aio:wave:proposal', [
    '--input', input,
    '--output-dir', dir,
    '--no-mirror',
    '--apply',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /APPLY_BLOCKED/);
  assert.equal(fs.existsSync(path.join(dir, 'seo-aio-wave-proposal.json')), false);
  assert.equal(fs.existsSync(path.join(dir, 'seo-aio-wave-gsc-submit.txt')), false);
});

test('retired npm command refuses execution and points to proposal command', () => {
  const result = runNpm('seo:aio:apply-wave');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /RETIRED/);
  assert.match(result.stderr || result.stdout, /seo:aio:wave:proposal/);
});
