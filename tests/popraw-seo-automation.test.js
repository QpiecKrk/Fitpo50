const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  buildDeploymentManifest,
  buildPatchedFiles,
  sha256,
  validatePatchManifest,
} = require('../scripts/lib/popraw-seo-approved-patches');
const { verifyLiveResponses } = require('../scripts/lib/popraw-seo-live-verifier');

function articleHtml(dateModified = '2026-08-01T08:00:00+02:00') {
  return `<html><head><meta property="article:modified_time" content="${dateModified}"><link rel="canonical" href="https://fitpo50.pl/a.html"><script type="application/ld+json">{"@type":"BlogPosting","dateModified":"${dateModified}"}</script></head><body><article class="article-content"><p>Stary konkretny akapit.</p></article></body></html>`;
}

function validManifest(root) {
  const original = articleHtml();
  fs.writeFileSync(path.join(root, 'a.html'), original);
  return {
    version: 1,
    status: 'AWAITING_USER_APPROVAL',
    report_generated_at: '2026-08-25T10:00:00+02:00',
    source_hashes: { 'a.html': sha256(Buffer.from(original)) },
    items: [{
      id: 'BOOST 1',
      file: 'a.html',
      operations: [{
        type: 'replace_exact',
        before: '<p>Stary konkretny akapit.</p>',
        after: '<p>Nowy akapit odpowiada dokładnie na frazę „marsz japoński efekty” i podaje warunek bezpieczeństwa.</p>',
        reason: 'Dopasowanie odpowiedzi do ujawnionej intencji GSC.',
        basis: [{ type: 'GSC_QUERY', value: 'marsz japoński efekty: 120 wyświetleń, pozycja 11' }],
      }],
    }],
  };
}

test('approved patch manifest rejects generic copy and stale source hashes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-patch-'));
  const manifest = validManifest(root);
  manifest.items[0].operations[0].after = '<p>W tym samym kontekście warto też sprawdzić ten temat.</p>';
  manifest.source_hashes['a.html'] = '0'.repeat(64);
  const result = validatePatchManifest(manifest, root, ['BOOST 1']);
  assert.ok(result.errors.some((error) => /generyczny/.test(error)));
  assert.ok(result.errors.some((error) => /SHA-256 mismatch/.test(error)));
});

test('approved patch is exact, content-specific and updates both modified dates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-patch-'));
  const manifest = validManifest(root);
  const validation = validatePatchManifest(manifest, root, ['BOOST 1']);
  assert.deepEqual(validation.errors, []);
  const patched = buildPatchedFiles(manifest, validation.items, root, '2026-08-25T12:00:00+02:00');
  const html = patched.contents.get('a.html');
  assert.match(html, /marsz japoński efekty/);
  assert.equal((html.match(/2026-08-25T12:00:00\+02:00/g) || []).length, 2);
});

test('dry-run accepts BOOST-1 alias and never writes the article', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-patch-'));
  const manifest = validManifest(root);
  const manifestPath = path.join(root, 'patches.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const before = fs.readFileSync(path.join(root, 'a.html'), 'utf8');
  const script = path.resolve(__dirname, '../scripts/popraw-seo-apply.js');
  const result = spawnSync('node', [script, '--manifest', manifestPath, '--ids', 'BOOST-1', '--dry-run'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(path.join(root, 'a.html'), 'utf8'), before);
  assert.match(result.stdout, /DRY-RUN PASS/);
});

test('a source article receiving a link also gets dateModified and PDF/live obligations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-patch-'));
  const manifest = validManifest(root);
  const source = articleHtml().replaceAll('a.html', 'source.html').replace('Stary konkretny akapit.', 'Akapit strony źródłowej.');
  fs.writeFileSync(path.join(root, 'source.html'), source);
  manifest.source_hashes['source.html'] = sha256(Buffer.from(source));
  manifest.items[0].operations.push({
    type: 'replace_exact',
    file: 'source.html',
    before: '<p>Akapit strony źródłowej.</p>',
    after: '<p>Akapit strony źródłowej prowadzi do <a href="a.html">konkretnego planu marszu interwałowego</a>.</p>',
    reason: 'Naturalne wsparcie głównego URL-a dla tej samej intencji.',
    basis: [{ type: 'INTERNAL_LINK_MAP', value: 'source.html wspiera właściciela intencji a.html' }],
  });
  const validation = validatePatchManifest(manifest, root, ['BOOST 1']);
  assert.deepEqual(validation.errors, []);
  const iso = '2026-08-25T12:00:00+02:00';
  const patched = buildPatchedFiles(manifest, validation.items, root, iso);
  assert.deepEqual(new Set(patched.articleFiles), new Set(['a.html', 'source.html']));
  assert.match(patched.contents.get('source.html'), /2026-08-25T12:00:00\+02:00/);
  const deployment = buildDeploymentManifest({ manifest, items: validation.items, contents: patched.contents, targetFiles: patched.targetFiles, iso });
  assert.equal(deployment.targets[0].source_pages[0].pdf_url, 'https://fitpo50.pl/assets/pdf/source.pdf');
});

test('GSC list remains empty until live HTML, canonical, sitemap and PDF all match', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-seo-patch-'));
  const manifest = validManifest(root);
  const validation = validatePatchManifest(manifest, root, ['BOOST 1']);
  const iso = '2026-08-25T12:00:00+02:00';
  const patched = buildPatchedFiles(manifest, validation.items, root, iso);
  const deployment = buildDeploymentManifest({ manifest, items: validation.items, contents: patched.contents, targetFiles: patched.targetFiles, iso });
  const incomplete = verifyLiveResponses(deployment, new Map());
  assert.equal(incomplete.status, 'LIVE_DEPLOYMENT_INCOMPLETE');
  assert.deepEqual(incomplete.gsc_url_inspection, []);

  const html = patched.contents.get('a.html');
  const responses = new Map([
    ['https://fitpo50.pl/a.html', { status: 200, body: Buffer.from(html) }],
    ['https://fitpo50.pl/assets/pdf/a.pdf', { status: 200, body: Buffer.from('%PDF-1.7 test') }],
    ['https://fitpo50.pl/sitemap.xml', { status: 200, body: Buffer.from('<urlset><url><loc>https://fitpo50.pl/a.html</loc><lastmod>2026-08-25</lastmod></url></urlset>') }],
  ]);
  const ready = verifyLiveResponses(deployment, responses);
  assert.equal(ready.status, 'LIVE_DEPLOYED_AND_VALIDATED');
  assert.deepEqual(ready.gsc_url_inspection, ['https://fitpo50.pl/a.html']);
  assert.deepEqual(ready.errors, []);
});
