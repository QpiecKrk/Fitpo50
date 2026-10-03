const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { prepareDeploymentMarker } = require('../scripts/prepare-deployment-marker');
const { verifyDeployment } = require('../scripts/lib/deployment-live-verifier');
const { isPublicRootHtmlPath } = require('../scripts/deployment-live-verify');

const ROOT = path.resolve(__dirname, '..');
function run(command, args, cwd, env = {}) { return spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }); }
function git(cwd, ...args) {
  const result = run('git', args, cwd);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return String(result.stdout || '').trim();
}

test('Hostinger scripts contain no destructive reset or clean command', () => {
  for (const file of ['scripts/hostinger-clean-repo.sh', 'scripts/hostinger-deploy-recovery.sh']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /git\s+reset\s+--hard/);
    assert.doesNotMatch(source, /git\s+clean\s+-fd/);
  }
});

test('retired clean command blocks without changing user files', () => {
  const sentinel = path.join(ROOT, '.deployment-safety-sentinel');
  fs.writeFileSync(sentinel, 'keep');
  try {
    const result = run('bash', ['scripts/hostinger-clean-repo.sh'], ROOT);
    assert.equal(result.status, 2);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep');
  } finally { fs.rmSync(sentinel); }
});

test('deployment marker is identical in source and export', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-marker-'));
  fs.mkdirSync(path.join(root, '_site'));
  for (const file of ['index.html', 'porady.html', 'sitemap.xml', 'llms.txt', 'ads.txt']) fs.writeFileSync(path.join(root, '_site', file), file);
  const marker = prepareDeploymentMarker(root, { releaseId: 'release-test', preparedAt: '2026-10-01T10:00:00.000Z' });
  assert.equal(marker.release_id, 'release-test');
  assert.equal(fs.readFileSync(path.join(root, 'deployment.json'), 'utf8'), fs.readFileSync(path.join(root, '_site', 'deployment.json'), 'utf8'));
});

test('live verifier only returns final status after remote, marker and all checks pass', () => {
  const baseUrl = 'https://fitpo50.pl';
  const marker = { version: 1, release_id: 'abc', prepared_at: '2026-10-01T10:00:00.000Z', public_fingerprint_sha256: 'f'.repeat(64) };
  const responses = new Map([
    [`${baseUrl}/deployment.json`, { status: 200, body: `${JSON.stringify(marker, null, 2)}\n` }],
    [`${baseUrl}/`, { status: 200, body: '<link rel="canonical" href="https://fitpo50.pl/">' }],
    [`${baseUrl}/porady.html`, { status: 200, body: '<link rel="canonical" href="https://fitpo50.pl/porady.html">' }],
    [`${baseUrl}/sitemap.xml`, { status: 200, body: '<urlset></urlset>' }],
    [`${baseUrl}/llms.txt`, { status: 200, body: 'ok' }],
    [`${baseUrl}/ads.txt`, { status: 200, body: 'ok' }],
  ]);
  const baseFiles = [...responses.entries()].filter(([url]) => url !== `${baseUrl}/deployment.json`).map(([url, response]) => ({ url, sha256: require('../scripts/lib/deployment-live-verifier').sha256(response.body) }));
  const pass = verifyDeployment({ expectedCommit: '1'.repeat(40), remoteCommit: '1'.repeat(40), marker, responses, baseUrl, baseFiles });
  assert.equal(pass.status, 'LIVE_DEPLOYED_AND_VALIDATED');
  const stale = verifyDeployment({ expectedCommit: '1'.repeat(40), remoteCommit: '2'.repeat(40), marker, responses, baseUrl, baseFiles });
  assert.equal(stale.status, 'NOT_PUSHED');
  responses.delete(`${baseUrl}/ads.txt`);
  const incomplete = verifyDeployment({ expectedCommit: '1'.repeat(40), remoteCommit: '1'.repeat(40), marker, responses, baseUrl, baseFiles });
  assert.equal(incomplete.status, 'DEPLOYED');
});

test('old article HTML, missing PDF and missing image block final live status', () => {
  const { sha256 } = require('../scripts/lib/deployment-live-verifier');
  const baseUrl = 'https://fitpo50.pl';
  const marker = { version: 1, release_id: 'article-release', prepared_at: '2026-10-01T10:00:00.000Z', public_fingerprint_sha256: 'a'.repeat(64) };
  const baseResponses = [
    [`${baseUrl}/deployment.json`, { status: 200, body: `${JSON.stringify(marker, null, 2)}\n` }],
    [`${baseUrl}/`, { status: 200, body: '<link rel="canonical" href="https://fitpo50.pl/">' }],
    [`${baseUrl}/porady.html`, { status: 200, body: '<link rel="canonical" href="https://fitpo50.pl/porady.html">' }],
    [`${baseUrl}/sitemap.xml`, { status: 200, body: '<urlset><url><loc>https://fitpo50.pl/test.html</loc><lastmod>2026-10-01</lastmod></url></urlset>' }],
    [`${baseUrl}/llms.txt`, { status: 200, body: 'ok' }],
    [`${baseUrl}/ads.txt`, { status: 200, body: 'ok' }],
  ];
  const responses = new Map(baseResponses);
  responses.set(`${baseUrl}/test.html`, { status: 200, body: '<link rel="canonical" href="https://fitpo50.pl/test.html"><meta property="article:modified_time" content="2026-10-01T10:00:00+02:00"><script>{"dateModified":"2026-10-01T10:00:00+02:00"}</script><p>stara treść</p>' });
  const baseFiles = baseResponses.slice(1).map(([url, response]) => ({ url, sha256: sha256(response.body) }));
  const result = verifyDeployment({
    expectedCommit: '1'.repeat(40), remoteCommit: '1'.repeat(40), marker, responses, baseUrl, baseFiles,
    articles: [{
      url: `${baseUrl}/test.html`, dateModified: '2026-10-01T10:00:00+02:00',
      pdfUrl: `${baseUrl}/assets/pdf/test.pdf`, imageUrls: [`${baseUrl}/assets/test.webp`],
      expectedHtmlSha256: sha256('<p>nowa treść</p>'), expectedPdfSha256: sha256('%PDF-new'),
    }],
  });
  assert.equal(result.status, 'DEPLOYED');
  assert.ok(result.errors.some((error) => /stary lub zmieniony HTML/.test(error)));
  assert.ok(result.errors.some((error) => /brak prawidłowego PDF/.test(error)));
  assert.ok(result.errors.some((error) => /brak wymaganego obrazu/.test(error)));
});

test('live verifier selects public root HTML and ignores source templates', () => {
  assert.equal(isPublicRootHtmlPath('centrum-nadcisnienia-po-50.html'), true);
  assert.equal(isPublicRootHtmlPath('_site/centrum-nadcisnienia-po-50.html'), false);
  assert.equal(isPublicRootHtmlPath('templates/topic-centers/centrum-nadcisnienia-po-50.html'), false);
  assert.equal(isPublicRootHtmlPath('docs/example.html'), false);
});

test('recovery dry-run and blocked apply preserve dirty and untracked files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-recovery-'));
  const remote = path.join(root, 'QpiecKrk', 'Fitpo50.git');
  const work = path.join(root, 'work');
  fs.mkdirSync(path.dirname(remote), { recursive: true });
  git(root, 'init', '--bare', remote);
  git(root, 'clone', remote, work);
  git(work, 'config', 'user.email', 'test@example.com');
  git(work, 'config', 'user.name', 'Test');
  fs.mkdirSync(path.join(work, 'scripts'));
  fs.copyFileSync(path.join(ROOT, 'scripts/hostinger-deploy-recovery.sh'), path.join(work, 'scripts/hostinger-deploy-recovery.sh'));
  fs.writeFileSync(path.join(work, 'tracked.txt'), 'original\n');
  git(work, 'add', '.');
  git(work, 'commit', '-m', 'initial');
  git(work, 'branch', '-M', 'main');
  git(work, 'push', '-u', 'origin', 'main');
  const wrongDirectory = run('bash', ['scripts/hostinger-deploy-recovery.sh'], work);
  assert.equal(wrongDirectory.status, 2);
  fs.writeFileSync(path.join(work, '.fitpo50-hostinger-deploy'), 'fitpo50.pl\n');
  fs.writeFileSync(path.join(work, 'tracked.txt'), 'dirty\n');
  fs.writeFileSync(path.join(work, 'untracked.txt'), 'keep\n');
  const dry = run('bash', ['scripts/hostinger-deploy-recovery.sh'], work);
  assert.equal(dry.status, 0, dry.stderr || dry.stdout);
  assert.equal(fs.readFileSync(path.join(work, 'tracked.txt'), 'utf8'), 'dirty\n');
  assert.equal(fs.readFileSync(path.join(work, 'untracked.txt'), 'utf8'), 'keep\n');
  const apply = run('bash', ['scripts/hostinger-deploy-recovery.sh', '--apply'], work, { FITPO50_HOSTINGER_RECOVERY: 'APPLY_APPROVED' });
  assert.equal(apply.status, 2);
  assert.equal(fs.readFileSync(path.join(work, 'tracked.txt'), 'utf8'), 'dirty\n');
  assert.equal(fs.readFileSync(path.join(work, 'untracked.txt'), 'utf8'), 'keep\n');
});
