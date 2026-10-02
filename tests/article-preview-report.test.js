const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sha256File, validatePreviewReport } = require('../scripts/lib/article-preview-report');
const {
  CONTRACT,
  applyVisualReview,
  createReviewTemplate,
  imageInventoryHash,
  validateVisualReview,
} = require('../scripts/lib/article-visual-review');
const SHARED_CASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'article-visual-review-v3-cases.json'), 'utf8'));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-preview-v3-'));
  const slug = 'kontrolny-artykul';
  const contents = {
    [`${slug}.html`]: '<meta name="description" content="wersja a"><article class="article-content"><h2>Jedna sekcja?</h2><p>Treść.</p></article>',
    [`_site/${slug}.html`]: '<meta name="description" content="wersja a"><article class="article-content"><h2>Jedna sekcja?</h2><p>Treść.</p></article>',
    [`assets/pdf/${slug}.pdf`]: '%PDF-fixture',
    [`_site/assets/pdf/${slug}.pdf`]: '%PDF-fixture',
    'assets/hero.avif': 'avif', 'assets/hero.webp': 'webp', 'assets/hero.jpg': 'jpg',
    '.tmp/article-preview/kontrolny-artykul/desktop.png': 'desktop',
    '.tmp/article-preview/kontrolny-artykul/mobile.png': 'mobile',
    '.tmp/article-preview/kontrolny-artykul/pdf-pages/page-1.png': 'page-1',
    '.tmp/article-preview/kontrolny-artykul/pdf-pages/page-2.png': 'page-2',
  };
  for (const [relative, content] of Object.entries(contents)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  const artifact = (file) => ({ file, sha256: sha256File(path.join(root, file)), bytes: fs.statSync(path.join(root, file)).size });
  const image = {
    placement: 'hero', role: 'hero', heading: '', context: 'Temat artykułu',
    alt: 'Konkretny hero artykułu', caption: '', technical_status: 'PASS', errors: [],
    variants: { avif: artifact('assets/hero.avif'), webp: artifact('assets/hero.webp'), jpg: artifact('assets/hero.jpg') },
  };
  image.inventory_sha256 = imageInventoryHash(image);
  const report = {
    version: 3, status: 'VISUAL_REVIEW_PENDING', slug,
    generated_at: '2026-10-01T08:00:00.000Z', reviewed_at: null,
    technical_review: { status: 'TECHNICAL_PASS', completed_at: '2026-10-01T08:00:00.000Z', errors: [] },
    artifacts: {
      html_source: artifact(`${slug}.html`), html_site: artifact(`_site/${slug}.html`),
      pdf_source: artifact(`assets/pdf/${slug}.pdf`), pdf_site: artifact(`_site/assets/pdf/${slug}.pdf`),
    },
    views: {
      desktop: { technical_status: 'PASS', viewport: { width: 1440, height: 1000 }, screenshot_file: '.tmp/article-preview/kontrolny-artykul/desktop.png', screenshot_sha256: artifact('.tmp/article-preview/kontrolny-artykul/desktop.png').sha256 },
      mobile: { technical_status: 'PASS', viewport: { width: 390, height: 844 }, screenshot_file: '.tmp/article-preview/kontrolny-artykul/mobile.png', screenshot_sha256: artifact('.tmp/article-preview/kontrolny-artykul/mobile.png').sha256 },
    },
    images: [image],
    pdf: {
      pages: 2,
      page_reviews: [1, 2].map((page) => ({ page, ...artifact(`.tmp/article-preview/kontrolny-artykul/pdf-pages/page-${page}.png`), technical_status: 'PASS' })),
    },
    visual_review: { status: 'VISUAL_REVIEW_PENDING', views: {}, images: [], pdf_pages: [], errors: [] },
    timing: { technical_ms: 100, review_wait_ms: null }, errors: [],
  };
  const reportPath = path.join(root, 'data/reports/article-preview', `${slug}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report));
  return { root, slug, report, reportPath };
}

function verifiedReview(report) {
  const review = createReviewTemplate(report);
  review.reviewed_by = 'Tester wizualny';
  review.reviewed_at = '2026-10-01T08:05:00.000Z';
  review.review_method = 'obejrzenie pełnych renderów';
  for (const view of Object.values(review.views)) {
    view.status = 'VERIFIED';
    view.note = 'Obejrzano pełny render; układ jest czytelny i nie zawiera uciętych elementów.';
  }
  review.images.forEach((image) => Object.assign(image, {
    ...SHARED_CASES.valid_watermark,
  }));
  review.pdf_pages.forEach((page) => Object.assign(page, {
    status: 'VERIFIED', note: 'Obejrzano całą stronę PDF; tekst i grafiki są kompletne oraz czytelne.',
  }));
  return review;
}

function saveReviewed(value, review = verifiedReview(value.report)) {
  value.report = applyVisualReview(value.report, review);
  fs.writeFileSync(value.reportPath, JSON.stringify(value.report));
  return review;
}

test('TECHNICAL_PASS bez rzeczywistego review nie daje PREVIEW_READY', () => {
  const value = fixture();
  const technical = validatePreviewReport(value.root, value.slug, { requireReady: false, requireRenderFiles: true });
  assert.equal(technical.ok, true, technical.errors.join('\n'));
  const ready = validatePreviewReport(value.root, value.slug);
  assert.equal(ready.ok, false);
  assert.ok(ready.errors.some((error) => /PREVIEW_READY/.test(error)));
});

test('kompletne review desktopu, mobile, każdego obrazu i strony PDF daje PREVIEW_READY', () => {
  const value = fixture();
  saveReviewed(value);
  const result = validatePreviewReport(value.root, value.slug, { requireRenderFiles: true });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.report.visual_review.status, CONTRACT.verified_status);
});

test('brak jednego obrazu albo jednej strony PDF w review blokuje', () => {
  const image = fixture();
  const imageReview = verifiedReview(image.report);
  imageReview.images = [];
  saveReviewed(image, imageReview);
  assert.ok(validatePreviewReport(image.root, image.slug).errors.some((error) => /0\/1 obrazów/.test(error)));

  const pdf = fixture();
  const pdfReview = verifiedReview(pdf.report);
  pdfReview.pdf_pages.pop();
  saveReviewed(pdf, pdfReview);
  assert.ok(validatePreviewReport(pdf.root, pdf.slug).errors.some((error) => /1\/2 stron PDF/.test(error)));
});

test('zmiana kontrolowanego pliku po review blokuje', () => {
  const value = fixture();
  saveReviewed(value);
  fs.appendFileSync(path.join(value.root, 'assets/hero.webp'), 'zmiana');
  assert.ok(validatePreviewReport(value.root, value.slug).errors.some((error) => /hero \/ webp: plik zmienił się/.test(error)));
});

test('późniejsza zmiana samej meta zachowuje wcześniejszy review niezmienionego obrazu', () => {
  const value = fixture();
  saveReviewed(value);
  const previousReport = value.report;
  const html = path.join(value.root, `${value.slug}.html`);
  const siteHtml = path.join(value.root, `_site/${value.slug}.html`);
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('wersja a', 'wersja b'));
  fs.copyFileSync(html, siteHtml);
  const laterReport = {
    ...previousReport,
    status: CONTRACT.pending_status,
    generated_at: '2026-10-01T09:00:00.000Z',
    reviewed_at: null,
    artifacts: {
      ...previousReport.artifacts,
      html_source: { ...previousReport.artifacts.html_source, sha256: sha256File(html) },
      html_site: { ...previousReport.artifacts.html_site, sha256: sha256File(siteHtml) },
    },
    technical_review: { status: CONTRACT.technical_status, completed_at: '2026-10-01T09:00:00.000Z', errors: [] },
    visual_review: { status: CONTRACT.pending_status, views: {}, images: [], pdf_pages: [], errors: [] },
    errors: [],
  };
  const review = createReviewTemplate(laterReport, previousReport);
  assert.equal(review.images[0].status, 'VERIFIED');
  assert.equal(review.images[0].reviewed_at, '2026-10-01T08:05:00.000Z');
  review.reviewed_by = 'Tester kolejnego preview';
  review.reviewed_at = '2026-10-01T09:05:00.000Z';
  review.review_method = 'nowy desktop, mobile i PDF; reuse obrazu po identycznym inventory';
  for (const view of Object.values(review.views)) {
    view.status = 'VERIFIED';
    view.note = 'Obejrzano nowy pełny render po zmianie meta; układ pozostał czytelny i kompletny.';
  }
  review.pdf_pages.forEach((page) => {
    page.status = 'VERIFIED';
    page.note = 'Obejrzano ponownie całą stronę PDF; treść oraz układ pozostają kompletne.';
  });
  const reapplied = applyVisualReview(laterReport, review);
  assert.equal(reapplied.status, CONTRACT.ready_status);
  assert.equal(reapplied.visual_review.images[0].reviewed_at, '2026-10-01T08:05:00.000Z');
});

test('zmiana kontekstu obrazu unieważnia jego review', () => {
  const value = fixture();
  const review = verifiedReview(value.report);
  value.report.images[0].context = 'Inny kontekst sekcji';
  value.report.images[0].inventory_sha256 = imageInventoryHash(value.report.images[0]);
  assert.ok(validateVisualReview(value.report, review).errors.some((error) => /inventory zmieniło się/.test(error)));
});

test('zmiana kontekstu nie przenosi wcześniejszego review obrazu do nowego szablonu', () => {
  const value = fixture();
  saveReviewed(value);
  const previousReport = value.report;
  const laterReport = JSON.parse(JSON.stringify(previousReport));
  laterReport.status = CONTRACT.pending_status;
  laterReport.generated_at = '2026-10-01T09:00:00.000Z';
  laterReport.technical_review.completed_at = laterReport.generated_at;
  laterReport.visual_review = { status: CONTRACT.pending_status, views: {}, images: [], pdf_pages: [], errors: [] };
  laterReport.images[0].context = 'Zmieniony kontekst sekcji';
  laterReport.images[0].inventory_sha256 = imageInventoryHash(laterReport.images[0]);
  const review = createReviewTemplate(laterReport, previousReport);
  assert.equal(review.images[0].status, 'PENDING');
});

test('PREVIEW_READY blokuje błędy techniczne i różne pary source oraz _site', () => {
  const withErrors = fixture();
  const review = verifiedReview(withErrors.report);
  withErrors.report.technical_review.errors = ['Błąd techniczny fixture.'];
  withErrors.report.errors = ['Błąd techniczny fixture.'];
  const applied = applyVisualReview(withErrors.report, review);
  assert.equal(applied.status, CONTRACT.pending_status);
  fs.writeFileSync(withErrors.reportPath, JSON.stringify({ ...applied, status: CONTRACT.ready_status }));
  assert.match(validatePreviewReport(withErrors.root, withErrors.slug).errors.join('\n'), /błędów technicznych|czystego dowodu/);

  const mismatched = fixture();
  saveReviewed(mismatched);
  const siteHtml = path.join(mismatched.root, `_site/${mismatched.slug}.html`);
  fs.appendFileSync(siteHtml, '<!-- różnica -->');
  mismatched.report.artifacts.html_site.sha256 = sha256File(siteHtml);
  fs.writeFileSync(mismatched.reportPath, JSON.stringify(mismatched.report));
  assert.match(validatePreviewReport(mismatched.root, mismatched.slug).errors.join('\n'), /HTML source i _site nie są identyczne/);
});

test('watermark przechodzi, a claim bez dowodu i błędna anatomia blokują', () => {
  const value = fixture();
  const watermark = verifiedReview(value.report);
  assert.equal(validateVisualReview(value.report, watermark).ok, true);

  const bad = verifiedReview(value.report);
  Object.assign(bad.images[0], SHARED_CASES.invalid_claim_without_evidence, { anatomy_and_equipment_plausible: false });
  const errors = validateVisualReview(value.report, bad).errors.join('\n');
  assert.match(errors, /anatomy_and_equipment_plausible/);
  assert.match(errors, /URL-u dowodu/);
});

test('ścieżka raportu poza zarządzanym rootem jest blokowana', () => {
  const value = fixture();
  const result = validatePreviewReport(value.root, value.slug, { reportPath: path.join(os.tmpdir(), 'obcy-raport.json') });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /poza zarządzanym rootem/);
});
