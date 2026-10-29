const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const READINESS = path.join(REPO, 'scripts', 'adsense-readiness-check.js');
const SMOKE = path.join(REPO, 'scripts', 'static-smoke-check.js');
const ADS_LINE = 'google.com, pub-4993821807276758, DIRECT, f08c47fec0942fa0';
const ADS_MARKUP = [
  '<meta name="google-adsense-account" content="ca-pub-4993821807276758">',
  '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4993821807276758"></script>',
].join('\n');

function makeReadinessFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-adsense-policy-'));
  fs.mkdirSync(path.join(root, '_site'));
  for (const page of ['index.html', 'porady.html', 'rusz-sie.html', 'jedzenie.html', 'zdrowie.html', 'ciekawe.html']) {
    const html = page === 'index.html' ? '<!doctype html><title>Home</title>' : `<!doctype html>${ADS_MARKUP}`;
    fs.writeFileSync(path.join(root, page), html);
    fs.writeFileSync(path.join(root, '_site', page), html);
  }
  fs.writeFileSync(path.join(root, 'ads.txt'), `${ADS_LINE}\n`);
  fs.writeFileSync(path.join(root, '_site', 'ads.txt'), `${ADS_LINE}\n`);
  return root;
}

function runReadiness(root) {
  return spawnSync(process.execPath, [READINESS], { cwd: root, encoding: 'utf8' });
}

test('AdSense readiness allows the homepage without AdSense but keeps article and ads.txt requirements', (t) => {
  const root = makeReadinessFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  let result = runReadiness(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const article = path.join(root, 'porady.html');
  fs.writeFileSync(article, '<!doctype html><title>Porady</title>');
  fs.writeFileSync(path.join(root, '_site', 'porady.html'), '<!doctype html><title>Porady</title>');
  result = runReadiness(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /porady\.html: brak (meta google-adsense-account|skryptu adsbygoogle)/);

  fs.writeFileSync(article, `<!doctype html>${ADS_MARKUP}`);
  fs.writeFileSync(path.join(root, '_site', 'porady.html'), `<!doctype html>${ADS_MARKUP}`);
  fs.rmSync(path.join(root, 'ads.txt'));
  result = runReadiness(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Brak ads\.txt/);
});

test('static smoke allows an AdSense-free homepage and still requires ads.txt', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-static-smoke-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Home</title>');
  fs.writeFileSync(path.join(root, 'porady.html'), '<div data-article-count="1"></div>');
  fs.writeFileSync(path.join(root, 'zdrowie.html'), '<meta name="robots" content="index,follow">');
  fs.writeFileSync(path.join(root, 'sitemap.xml'), '<loc>https://fitpo50.pl/</loc>');
  fs.writeFileSync(path.join(root, 'llms.txt'), 'https://fitpo50.pl/');
  fs.writeFileSync(path.join(root, 'ads.txt'), `${ADS_LINE}\n`);

  let result = spawnSync(process.execPath, [SMOKE, root], { cwd: REPO, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  fs.rmSync(path.join(root, 'ads.txt'));
  result = spawnSync(process.execPath, [SMOKE, root], { cwd: REPO, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Brak pliku: .*ads\.txt/);
});
