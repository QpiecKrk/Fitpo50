const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { changedRootArticles, prepareDeploymentMarker } = require('../scripts/prepare-deployment-marker');
const { verifyDeployment } = require('../scripts/lib/deployment-live-verifier');
const { cacheBustUrl, isPublicRootHtmlPath } = require('../scripts/deployment-live-verify');
const { ADMIN_SENSITIVE_PATHS, SENSITIVE_PATHS, classifyExposureResponse } = require('../scripts/security-exposure-check');

const ROOT = path.resolve(__dirname, '..');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');
function run(command, args, cwd, env = {}) { return spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }); }
function git(cwd, ...args) {
  const result = run('git', args, cwd);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return String(result.stdout || '').trim();
}

function requestDeniedByHtaccess(source, pathname) {
  const lines = String(source).split(/\r?\n/);
  let requestConditions = [];
  for (const line of lines) {
    const condition = line.match(/^\s*RewriteCond\s+%\{REQUEST_URI\}\s+(\S+)\s*(?:\[([^\]]+)\])?/i);
    if (condition) {
      requestConditions.push({ pattern: condition[1], flags: condition[2] || '' });
      continue;
    }
    const rule = line.match(/^\s*RewriteRule\s+(\S+)\s+\S+\s*(?:\[([^\]]+)\])?/i);
    if (!rule) continue;
    const flags = rule[2] || '';
    const ruleFlags = flags.includes('NC') ? 'i' : '';
    const conditionsPass = requestConditions.every(({ pattern, flags: conditionFlags }) => {
      const negated = pattern.startsWith('!');
      const source = negated ? pattern.slice(1) : pattern;
      const matched = new RegExp(source, conditionFlags.includes('NC') ? 'i' : '').test(pathname);
      return negated ? !matched : matched;
    });
    const pathWithoutLeadingSlash = pathname.replace(/^\//, '');
    const denied = conditionsPass && new RegExp(rule[1], ruleFlags).test(pathWithoutLeadingSlash) && flags.split(',').includes('F');
    requestConditions = [];
    if (denied) return true;
  }
  return false;
}

test('Hostinger scripts contain no destructive reset or clean command', () => {
  for (const file of ['scripts/hostinger-clean-repo.sh', 'scripts/hostinger-deploy-recovery.sh']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /git\s+reset\s+--hard/);
    assert.doesNotMatch(source, /git\s+clean\s+-fd/);
  }
});

test('mutable public documents bypass stale Hostinger CDN cache', () => {
  const source = fs.readFileSync(path.join(ROOT, '.htaccess'), 'utf8');
  const exported = fs.readFileSync(path.join(ROOT, '_site', '.htaccess'), 'utf8');
  assert.equal(exported, source);
  assert.match(source, /ExpiresByType application\/pdf "access plus 0 seconds"/);
  assert.match(source, /<FilesMatch "\\\.\(html\?\|pdf\|json\|xml\|txt\)\$">/);
  assert.match(source, /Header set Cache-Control "no-cache, max-age=0, s-maxage=0, must-revalidate"/);
  assert.doesNotMatch(source, /text\/html "access plus 10 minutes"/);
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
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'commit', '--allow-empty', '-m', 'initial');
  fs.mkdirSync(path.join(root, '_site'));
  for (const file of ['index.html', 'porady.html', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'ads.txt']) fs.writeFileSync(path.join(root, '_site', file), file);
  fs.mkdirSync(path.join(root, '_site', 'assets', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, '_site', 'assets', 'data', 'search-index.json'), '[]');
  const marker = prepareDeploymentMarker(root, { releaseId: 'release-test', preparedAt: '2026-10-01T10:00:00.000Z' });
  assert.equal(marker.release_id, 'release-test');
  assert.equal(fs.readFileSync(path.join(root, 'deployment.json'), 'utf8'), fs.readFileSync(path.join(root, '_site', 'deployment.json'), 'utf8'));
});

for (const pushFirst of [true, false]) {
  test(`release order: ${pushFirst ? 'push then marker is blocked' : 'marker and content in one commit and push'}`, () => {
    const workspace = createManagedTempDir({ prefix: 'fitpo50-release-test-', projectRoot: ROOT, type: 'test' });
    try {
      const remote = path.join(workspace, 'remote.git');
      const root = path.join(workspace, 'work');
      git(workspace, 'init', '--bare', remote);
      git(workspace, 'clone', remote, root);
      git(root, 'config', 'user.email', 'test@example.com');
      git(root, 'config', 'user.name', 'Test');
      git(root, 'checkout', '-b', 'main');
      fs.mkdirSync(path.join(root, '_site/assets/data'), { recursive: true });
      for (const f of ['index.html', 'porady.html', 'ciekawe.html', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'ads.txt', 'assets/data/search-index.json']) {
        fs.writeFileSync(path.join(root, '_site', f), 'test.html');
      }
      fs.writeFileSync(path.join(root, 'deployment.json'), '{"version":2,"articles":[]}\n');
      git(root, 'add', '.');
      git(root, 'commit', '-m', 'previous release');
      git(root, 'push', '-u', 'origin', 'main');
      const html = '<link rel="canonical" href="https://fitpo50.pl/test.html"><script>{"@type":"BlogPosting","dateModified":"2026-10-01T10:00:00+02:00"}</script>';
      fs.writeFileSync(path.join(root, 'test.html'), html);
      fs.writeFileSync(path.join(root, '_site/test.html'), html);
      fs.mkdirSync(path.join(root, '_site/assets/pdf'), { recursive: true });
      fs.writeFileSync(path.join(root, '_site/assets/pdf/test.pdf'), '%PDF-test');
      if (pushFirst) {
        git(root, 'add', '.');
        git(root, 'commit', '-m', 'content without marker');
        git(root, 'push', 'origin', 'main');
        assert.deepEqual(changedRootArticles(root), []);
        const before = fs.readFileSync(path.join(root, 'deployment.json'), 'utf8');
        assert.throws(() => prepareDeploymentMarker(root), /DEPLOYMENT_ARTICLES_INCOMPLETE.*test.html/);
        assert.equal(fs.readFileSync(path.join(root, 'deployment.json'), 'utf8'), before);
        assert.equal(fs.existsSync(path.join(root, '_site/deployment.json')), false);
      } else {
        const marker = prepareDeploymentMarker(root);
        assert.deepEqual(marker.articles.map((a) => a.file), ['test.html']);
        git(root, 'add', '.');
        git(root, 'commit', '-m', 'content and marker');
        git(root, 'push', 'origin', 'main');
        assert.equal(git(root, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'origin/main'));
        assert.equal(JSON.parse(git(root, 'show', 'origin/main:deployment.json')).articles[0].html_sha256, marker.articles[0].html_sha256);
        assert.equal(git(root, 'status', '--porcelain'), '');
      }
    } finally { disposeTempWorkspace(workspace, { status: 'COMPLETED' }); }
  });
}

test('retired push_one exits without running release commands', () => {
  const before = git(ROOT, 'status', '--porcelain');
  const result = run('bash', ['scripts/push_one.sh'], ROOT);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /RETIRED/);
  assert.equal(git(ROOT, 'status', '--porcelain'), before);
});

test('admin config remains ignored and untracked', () => {
  assert.equal(run('git', ['check-ignore', '--no-index', 'admin/config.php'], ROOT).status, 0);
  assert.equal(git(ROOT, 'ls-files', 'admin/config.php'), '');
});

test('deployment marker inventory includes articles from every commit ahead of origin/main', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-marker-multicommit-'));
  try {
    git(root, 'init');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test');
    fs.mkdirSync(path.join(root, '_site'));
    for (const file of ['one.html', 'two.html']) {
      fs.writeFileSync(path.join(root, file), '<html>base</html>');
      fs.writeFileSync(path.join(root, '_site', file), '<script type="application/ld+json">{"@type":"BlogPosting"}</script>');
    }
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'base');
    const base = git(root, 'rev-parse', 'HEAD');
    git(root, 'update-ref', 'refs/remotes/origin/main', base);
    fs.writeFileSync(path.join(root, 'one.html'), '<html>one</html>');
    git(root, 'add', 'one.html');
    git(root, 'commit', '-m', 'one');
    fs.writeFileSync(path.join(root, 'two.html'), '<html>two</html>');
    git(root, 'add', 'two.html');
    git(root, 'commit', '-m', 'two');
    assert.deepEqual(changedRootArticles(root), ['one.html', 'two.html']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
    [`${baseUrl}/llms-full.txt`, { status: 200, body: 'full' }],
    [`${baseUrl}/ads.txt`, { status: 200, body: 'ok' }],
    [`${baseUrl}/assets/data/search-index.json`, { status: 200, body: '[]' }],
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
    [`${baseUrl}/llms-full.txt`, { status: 200, body: 'full' }],
    [`${baseUrl}/ads.txt`, { status: 200, body: 'ok' }],
    [`${baseUrl}/assets/data/search-index.json`, { status: 200, body: '[]' }],
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

test('live verifier creates a release-bound cache-buster without changing the public path', () => {
  const result = new URL(cacheBustUrl('https://fitpo50.pl/porady.html', 'release-123'));
  assert.equal(result.pathname, '/porady.html');
  assert.equal(result.searchParams.get('__fitpo50_release'), 'release-123');
});

test('security exposure gate accepts only protected or missing sensitive paths', () => {
  assert.equal(classifyExposureResponse(403), 'PROTECTED');
  assert.equal(classifyExposureResponse(404), 'PROTECTED');
  assert.equal(classifyExposureResponse(200), 'EXPOSED');
  assert.equal(classifyExposureResponse(302), 'EXPOSED');
  assert.equal(classifyExposureResponse(500), 'INCONCLUSIVE');
});

test('htaccess blocks repository internals and preserves public site paths', () => {
  const source = fs.readFileSync(path.join(ROOT, '.htaccess'), 'utf8');
  const blocked = [
    '/_site/index.html', '/requirements-dev.txt', '/requirements-pdf.txt', '/.gitignore',
    '/README.md', '/package.json', '/package-lock.json', '/tool.py', '/.venv/bin/python',
    '/__pycache__/module.pyc', '/tests/deployment-safety.test.js', '/scripts/export_site.sh',
    '/docs/command-registry.md', '/admin/CHANGELOG.md', '/.cursorrules', '/.editorconfig',
    '/.github/workflows/assets-hygiene.yml', '/.githooks/pre-push', '/article-template-bento.html',
    '/admin/init-db.php', '/admin/init-hash.php',
  ];
  const allowed = [
    '/index.html', '/porady.html', '/assets/main.css', '/assets/example.webp',
    '/sitemap.xml', '/robots.txt', '/llms.txt', '/llms-full.txt',
    '/.well-known/acme-challenge/token',
  ];
  for (const pathname of blocked) {
    assert.equal(requestDeniedByHtaccess(source, pathname), true, `oczekiwano 403 dla ${pathname}`);
  }
  for (const pathname of allowed) {
    assert.equal(requestDeniedByHtaccess(source, pathname), false, `ścieżka publiczna nie może dostać 403: ${pathname}`);
  }
  for (const pathname of blocked) {
    assert.ok(SENSITIVE_PATHS.includes(pathname), `brak kontroli ekspozycji ${pathname}`);
  }
});

test('admin htaccess blocks markdown, dotfiles and retired init endpoints but preserves well-known', () => {
  const source = fs.readFileSync(path.join(ROOT, 'admin', '.htaccess'), 'utf8');
  const blocked = ['/CHANGELOG.md', '/deploy-notes.md', '/.cursorrules', '/.editorconfig', '/.github/workflows/test.yml', '/.githooks/pre-push', '/init-db.php', '/init-hash.php'];
  for (const pathname of blocked) assert.equal(requestDeniedByHtaccess(source, pathname), true, `oczekiwano 403 dla admin${pathname}`);
  assert.equal(requestDeniedByHtaccess(source, '/.well-known/acme-challenge/token'), false);
  for (const pathname of ['/CHANGELOG.md', '/deploy-notes.md', '/init-db.php', '/init-hash.php']) {
    assert.ok(ADMIN_SENSITIVE_PATHS.includes(pathname), `brak kontroli admin.fitpo50.pl${pathname}`);
  }
});

test('admin setup is CLI-only and public init scripts do not exist', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'admin', 'init-db.php')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'admin', 'init-hash.php')), false);
  const guide = fs.readFileSync(path.join(ROOT, 'docs', 'admin-cli-setup.md'), 'utf8');
  const schema = fs.readFileSync(path.join(ROOT, 'docs', 'admin-schema.sql'), 'utf8');
  assert.match(guide, /php -r/);
  assert.match(guide, /mysql --host=/);
  assert.doesNotMatch(guide, /https?:\/\/admin\.fitpo50\.pl\/init-/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS entries/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS media/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS failed_logins/);
});

test('admin Git sync is disabled unless explicitly enabled', () => {
  const source = fs.readFileSync(path.join(ROOT, 'admin', 'helpers', 'git-sync.php'), 'utf8');
  assert.match(source, /if \(\$raw === false \|\| trim\(\(string\)\$raw\) === ''\) \{\s*return false;/);
  assert.match(source, /return in_array\(\$value, \['1', 'true', 'on', 'yes'\], true\);/);
  assert.match(source, /FITPO50_AUTO_GIT_SYNC=1/);
  assert.match(source, /\['git', 'push', \$remote, \$branch\]/);
  assert.match(source, /\['git', 'pull', '--rebase', \$remote, \$branch\]/);
});

test('post-push validation never submits IndexNow automatically', () => {
  const finalize = fs.readFileSync(path.join(ROOT, 'scripts', 'deployment-finalize.js'), 'utf8');
  const push = fs.readFileSync(path.join(ROOT, 'scripts', 'push_one.sh'), 'utf8');
  assert.doesNotMatch(finalize, /run\([^\n]*indexnow-release/);
  assert.doesNotMatch(push, /^\s*npm run indexnow:release\s*$/m);
  assert.match(finalize, /security-exposure-check/);
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
