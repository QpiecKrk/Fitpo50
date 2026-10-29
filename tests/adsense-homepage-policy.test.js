const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const ABSENCE = path.join(REPO, 'scripts', 'adsense-absence-check.js');
const SMOKE = path.join(REPO, 'scripts', 'static-smoke-check.js');
const ADS_MARKUP = [
  '<meta name="google-adsense-account" content="ca-pub-4993821807276758">',
  '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4993821807276758"></script>',
].join('\n');

function makeAbsenceFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-adsense-absence-'));
  fs.mkdirSync(path.join(root, '_site'));
  for (const rel of ['index.html', 'porady.html']) {
    const html = `<!doctype html><title>${rel}</title>`;
    fs.writeFileSync(path.join(root, rel), html);
    fs.writeFileSync(path.join(root, '_site', rel), html);
  }
  return root;
}

function runAbsence(root) {
  return spawnSync(process.execPath, [ABSENCE], { cwd: root, encoding: 'utf8' });
}

test('AdSense absence gate rejects a published ads.txt declaration', (t) => {
  const root = makeAbsenceFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'ads.txt'), 'google.com, pub-4993821807276758, DIRECT, f08c47fec0942fa0\n');
  fs.writeFileSync(path.join(root, '_site', 'ads.txt'), 'google.com, pub-4993821807276758, DIRECT, f08c47fec0942fa0\n');

  const result = runAbsence(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /ads\.txt: plik deklarujący sprzedawcę AdSense/);
});

test('AdSense absence gate accepts clean source and export without ads.txt', (t) => {
  const root = makeAbsenceFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = runAbsence(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('AdSense absence gate rejects AdSense markup in source and export', (t) => {
  const root = makeAbsenceFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'outside-policy.html'), `<!doctype html>${ADS_MARKUP}`);
  fs.writeFileSync(path.join(root, '_site', 'outside-policy.html'), `<!doctype html>${ADS_MARKUP}`);

  const result = runAbsence(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /outside-policy\.html: wykryto zabroniony kod AdSense/);
  assert.match(result.stdout, /_site\/outside-policy\.html: wykryto zabroniony kod AdSense/);
});

test('article template and archived standardizer cannot reintroduce AdSense', () => {
  const forbidden = /adsbygoogle|google-adsense-account|pagead2|googlesyndication/i;
  assert.doesNotMatch(fs.readFileSync(path.join(REPO, 'article-template-bento.html'), 'utf8'), forbidden);
  assert.doesNotMatch(fs.readFileSync(path.join(REPO, 'scripts', 'archive', 'standardize-articles.js'), 'utf8'), forbidden);
});

test('static smoke passes without ads.txt', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-static-smoke-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Home</title>');
  fs.writeFileSync(path.join(root, 'porady.html'), '<div data-article-count="1"></div>');
  fs.writeFileSync(path.join(root, 'zdrowie.html'), '<meta name="robots" content="index,follow">');
  fs.writeFileSync(path.join(root, 'sitemap.xml'), '<loc>https://fitpo50.pl/</loc>');
  fs.writeFileSync(path.join(root, 'llms.txt'), 'https://fitpo50.pl/');

  const result = spawnSync(process.execPath, [SMOKE, root], { cwd: REPO, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
