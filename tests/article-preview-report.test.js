const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sha256File, validatePreviewReport } = require('../scripts/lib/article-preview-report');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-preview-report-'));
  const slug = 'kontrolny-artykul';
  const files = {
    html: `${slug}.html`, siteHtml: `_site/${slug}.html`,
    pdf: `assets/pdf/${slug}.pdf`, sitePdf: `_site/assets/pdf/${slug}.pdf`,
  };
  const html = '<section class="article-intro-grid"><figure class="article-hero"><picture><img src="./assets/hero.jpg"></picture></figure></section><article><h2>Jedna potrzebna sekcja?</h2><p>Kompletna odpowiedź.</p></article>';
  for (const [relative, content] of [
    [files.html, html], [files.siteHtml, html],
    [files.pdf, '%PDF-fixture'], [files.sitePdf, '%PDF-fixture'],
    ['assets/hero.avif', 'avif'], ['assets/hero.webp', 'webp'], ['assets/hero.jpg', 'jpg'],
  ]) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  const artifact = (file) => ({ file, sha256: sha256File(path.join(root, file)) });
  const report = {
    version: 2,
    status: 'PREVIEW_READY',
    generated_at: '2026-10-01T08:00:00.000Z',
    reviewed_at: '2026-10-01T08:00:00.000Z',
    slug,
    artifacts: {
      html_source: artifact(files.html), html_site: artifact(files.siteHtml),
      pdf_source: artifact(files.pdf), pdf_site: artifact(files.sitePdf),
    },
    views: {
      desktop: { status: 'PASS', viewport: { width: 1440, height: 1000 }, screenshot_sha256: 'a'.repeat(64) },
      mobile: { status: 'PASS', viewport: { width: 390, height: 844 }, screenshot_sha256: 'b'.repeat(64) },
    },
    images: [{
      placement: 'hero', status: 'PASS', variants: {
        avif: artifact('assets/hero.avif'), webp: artifact('assets/hero.webp'), jpg: artifact('assets/hero.jpg'),
      },
    }],
    pdf: {
      pages: 2,
      page_reviews: [
        { page: 1, status: 'PASS', sha256: 'c'.repeat(64) },
        { page: 2, status: 'PASS', sha256: 'd'.repeat(64) },
      ],
    },
  };
  const reportPath = path.join(root, 'data/reports/article-preview', `${slug}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report));
  return { root, slug, report, reportPath };
}

test('hash-bound visual report passes with desktop 1440, mobile 390, all images and PDF pages', () => {
  const value = fixture();
  assert.deepEqual(validatePreviewReport(value.root, value.slug).errors, []);
});

test('old visual report fails after HTML or image change', () => {
  const htmlChanged = fixture();
  fs.appendFileSync(path.join(htmlChanged.root, `${htmlChanged.slug}.html`), '<p>zmiana</p>');
  assert.ok(validatePreviewReport(htmlChanged.root, htmlChanged.slug).errors.some((error) => /HTML source: plik zmienił się/.test(error)));

  const imageChanged = fixture();
  fs.appendFileSync(path.join(imageChanged.root, 'assets/hero.webp'), 'zmiana');
  assert.ok(validatePreviewReport(imageChanged.root, imageChanged.slug).errors.some((error) => /Obraz hero \/ webp: plik zmienił się/.test(error)));
});

test('missing one PDF page review blocks publication', () => {
  const value = fixture();
  value.report.pdf.page_reviews.pop();
  fs.writeFileSync(value.reportPath, JSON.stringify(value.report));
  const result = validatePreviewReport(value.root, value.slug);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /obejmuje 1\/2 stron/.test(error)));
});

test('missing one section image review blocks publication even with a current HTML hash', () => {
  const value = fixture();
  const htmlPath = path.join(value.root, `${value.slug}.html`);
  fs.appendFileSync(htmlPath, '<article class="article-content"><figure><picture><img src="./assets/hero.jpg"></picture></figure></article>');
  value.report.artifacts.html_source.sha256 = sha256File(htmlPath);
  fs.writeFileSync(value.reportPath, JSON.stringify(value.report));
  const result = validatePreviewReport(value.root, value.slug);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /obejmuje 1\/2 obrazów/.test(error)));
});

test('article completeness is independent of an arbitrary six-section minimum', () => {
  const value = fixture();
  assert.match(fs.readFileSync(path.join(value.root, `${value.slug}.html`), 'utf8'), /<h2>Jedna potrzebna sekcja\?/);
  assert.equal(validatePreviewReport(value.root, value.slug).ok, true);
});
