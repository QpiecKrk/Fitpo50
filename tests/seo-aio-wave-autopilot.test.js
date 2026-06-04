const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

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

test('wave autopilot proposal waits for user approval and writes queues', () => {
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
  assert.ok(proposal.gsc_submit_queue.includes('https://fitpo50.pl/source-a.html'));
  assert.match(fs.readFileSync(path.join(dir, 'seo-aio-wave-proposal.md'), 'utf8'), /Bramka Zatwierdzenia/);
});

test('wave autopilot blocks apply without explicit confirmation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-wave-block-'));
  const input = path.join(dir, 'seo-aio-command-center.json');
  writeCommandCenterFixture(input);

  const result = spawnSync(
    'node',
    ['scripts/seo-aio-wave-autopilot.js', '--input', input, '--output-dir', dir, '--no-mirror', '--wave', '1', '--apply', 'true', '--mode', 'safe-links'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr || result.stdout, /APPLY_BLOCKED/);
});
