'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CONTRACT, imageInventoryHash, validateVisualReview } = require('./article-visual-review');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ''));
}

function isInsideRoot(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function safeRelative(root, relative) {
  const value = String(relative || '').replace(/^\.\//, '');
  const absolute = path.resolve(root, value);
  if (!value || path.isAbsolute(value) || !isInsideRoot(root, absolute)) {
    throw new Error(`Niedozwolona ścieżka w raporcie podglądu: ${relative}`);
  }
  return absolute;
}

function validateCurrentFile(root, label, artifact, errors) {
  if (!artifact || typeof artifact !== 'object') {
    errors.push(`${label}: brak opisu artefaktu.`);
    return;
  }
  if (!isSha256(artifact.sha256)) errors.push(`${label}: brak poprawnego SHA-256.`);
  let file;
  try {
    file = safeRelative(root, artifact.file);
  } catch (error) {
    errors.push(error.message);
    return;
  }
  if (!fs.existsSync(file)) errors.push(`${label}: brak pliku ${artifact.file}.`);
  else if (isSha256(artifact.sha256) && sha256File(file) !== artifact.sha256) errors.push(`${label}: plik zmienił się po kontroli.`);
}

function validateLegacyReport(root, slug, report, errors) {
  if (![1, 2].includes(report.version)) errors.push(`Nieobsługiwana wersja raportu legacy: ${report.version}.`);
  if (report.status !== 'PREVIEW_READY') errors.push(`Raport legacy nie ma statusu PREVIEW_READY (${report.status || 'brak'}).`);
  const mappings = [
    ['HTML source', `${slug}.html`, report.html_sha256],
    ['HTML _site', `_site/${slug}.html`, report.site_html_sha256],
    ['PDF source', `assets/pdf/${slug}.pdf`, report.pdf_sha256],
    ['PDF _site', `_site/assets/pdf/${slug}.pdf`, report.site_pdf_sha256],
  ];
  for (const [label, relative, expected] of mappings) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) errors.push(`${label}: brak pliku.`);
    else if (!isSha256(expected) || sha256File(file) !== expected) errors.push(`${label}: raport legacy jest nieaktualny.`);
  }
}

function validateV3Report(root, report, options, errors) {
  if (report.technical_review?.status !== CONTRACT.technical_status) errors.push(`Kontrola techniczna nie ma statusu ${CONTRACT.technical_status}.`);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(report.generated_at || ''))) errors.push('Raport nie ma poprawnego generated_at.');

  validateCurrentFile(root, 'HTML source', report.artifacts?.html_source, errors);
  validateCurrentFile(root, 'HTML _site', report.artifacts?.html_site, errors);
  validateCurrentFile(root, 'PDF source', report.artifacts?.pdf_source, errors);
  validateCurrentFile(root, 'PDF _site', report.artifacts?.pdf_site, errors);

  for (const [name, width] of [['desktop', 1440], ['mobile', 390]]) {
    const view = report.views?.[name];
    if (!view || view.technical_status !== 'PASS') errors.push(`${name}: kontrola techniczna widoku nie ma statusu PASS.`);
    if (Number(view?.viewport?.width) !== width) errors.push(`${name}: wymagany viewport ${width}px.`);
    if (!isSha256(view?.screenshot_sha256)) errors.push(`${name}: brak hasha pełnego zrzutu.`);
    if (options.requireRenderFiles === true) validateCurrentFile(root, `${name}: pełny zrzut`, { file: view?.screenshot_file, sha256: view?.screenshot_sha256 }, errors);
  }

  const images = Array.isArray(report.images) ? report.images : [];
  if (!images.length) errors.push('Raport nie zawiera kanonicznego inventory obrazów.');
  const placements = new Set();
  const variantFiles = new Map();
  for (const image of images) {
    const label = `Obraz ${image?.placement || 'UNKNOWN'}`;
    if (!image?.placement || placements.has(image.placement)) errors.push(`${label}: placement jest pusty albo powtórzony.`);
    placements.add(image?.placement);
    if (image?.technical_status !== 'PASS') errors.push(`${label}: kontrola techniczna nie ma statusu PASS.`);
    if (!isSha256(image?.inventory_sha256) || image.inventory_sha256 !== imageInventoryHash(image)) errors.push(`${label}: inventory_sha256 nie odpowiada plikom i kontekstowi obrazu.`);
    for (const extension of CONTRACT.required_variants) {
      const variant = image?.variants?.[extension];
      validateCurrentFile(root, `${label} / ${extension}`, variant, errors);
      const key = `${extension}:${variant?.file || ''}`;
      if (variant?.file && variantFiles.has(key)) errors.push(`${label}: ten sam wariant jest użyty ponownie w ${variantFiles.get(key)}.`);
      else if (variant?.file) variantFiles.set(key, image.placement);
    }
  }

  const pdf = report.pdf;
  const pages = Array.isArray(pdf?.page_reviews) ? pdf.page_reviews : [];
  if (!Number.isInteger(pdf?.pages) || pdf.pages < 1) errors.push('PDF: brak poprawnej liczby stron.');
  if (pages.length !== pdf?.pages) errors.push(`PDF: raport obejmuje ${pages.length}/${pdf?.pages || 0} stron.`);
  pages.forEach((page, index) => {
    if (page.page !== index + 1) errors.push(`PDF: brak ciągłej kontroli strony ${index + 1}.`);
    if (page.technical_status !== 'PASS') errors.push(`PDF strona ${index + 1}: kontrola techniczna nie ma statusu PASS.`);
    if (!isSha256(page.sha256)) errors.push(`PDF strona ${index + 1}: brak hasha renderu.`);
    if (options.requireRenderFiles === true) validateCurrentFile(root, `PDF strona ${index + 1}`, page, errors);
  });

  if (options.requireReady !== false) {
    if (report.status !== CONTRACT.ready_status) errors.push(`Raport nie ma statusu ${CONTRACT.ready_status} (${report.status || 'brak'}).`);
    if (report.visual_review?.status !== CONTRACT.verified_status) errors.push(`Raport nie ma statusu ${CONTRACT.verified_status}.`);
    const review = {
      version: report.version,
      slug: report.slug,
      reviewed_by: report.visual_review?.reviewed_by,
      reviewed_at: report.visual_review?.reviewed_at,
      review_method: report.visual_review?.review_method,
      views: report.visual_review?.views,
      images: report.visual_review?.images,
      pdf_pages: report.visual_review?.pdf_pages,
    };
    errors.push(...validateVisualReview(report, review).errors);
  } else if (![CONTRACT.pending_status, CONTRACT.ready_status].includes(report.status)) {
    errors.push(`Raport techniczny ma niepoprawny status ${report.status || 'brak'}.`);
  }
}

function validatePreviewReport(root, slug, options = {}) {
  const errors = [];
  const reportPath = options.reportPath ? path.resolve(options.reportPath) : path.join(root, 'data', 'reports', 'article-preview', `${slug}.json`);
  if (!isInsideRoot(root, reportPath)) return { ok: false, errors: [`Raport podglądu jest poza zarządzanym rootem: ${reportPath}.`] };
  if (!fs.existsSync(reportPath)) return { ok: false, errors: [`Brak raportu preview: ${reportPath}.`] };
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`Nie można odczytać raportu preview: ${error.message || error}.`] };
  }
  if (report.slug !== slug) errors.push('Slug raportu podglądu nie zgadza się z artykułem.');
  if (report.version === CONTRACT.version) validateV3Report(root, report, options, errors);
  else if (options.allowLegacy === true && [1, 2].includes(report.version)) validateLegacyReport(root, slug, report, errors);
  else errors.push(`Raport podglądu musi mieć version=${CONTRACT.version}; wersje 1/2 są wyłącznie zamrożonym legacy.`);
  return { ok: errors.length === 0, errors, report, reportPath };
}

module.exports = { isInsideRoot, isSha256, safeRelative, sha256File, validatePreviewReport };
