'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ''));
}

function safeRelative(root, relative) {
  const value = String(relative || '').replace(/^\.\//, '');
  const absolute = path.resolve(root, value);
  const base = `${path.resolve(root)}${path.sep}`;
  if (!absolute.startsWith(base)) throw new Error(`Niedozwolona ścieżka w raporcie podglądu: ${relative}`);
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
  else if (isSha256(artifact.sha256) && sha256File(file) !== artifact.sha256) errors.push(`${label}: plik zmienił się po kontroli wizualnej.`);
}

function expectedArticleImageCount(html) {
  const source = String(html || '');
  const hero = /<section\b[^>]*class=["'][^"']*article-intro-grid[^"']*["'][\s\S]*?<[a-z][^>]*class=["'][^"']*article-hero[^"']*["'][^>]*>[\s\S]*?<picture\b/i.test(source) ? 1 : 0;
  const articleMatch = source.match(/<article\b[^>]*class=["'][^"']*article-content[^"']*["'][^>]*>([\s\S]*?)<\/article>/i);
  const sectionPictures = articleMatch ? (articleMatch[1].match(/<figure\b[^>]*>[\s\S]*?<picture\b/gi) || []).length : 0;
  return hero + sectionPictures;
}

function validatePreviewReport(root, slug, options = {}) {
  const errors = [];
  const reportPath = options.reportPath
    ? path.resolve(options.reportPath)
    : path.join(root, 'data', 'reports', 'article-preview', `${slug}.json`);
  if (!fs.existsSync(reportPath)) return { ok: false, errors: [`Brak raportu PREVIEW_READY: ${reportPath}.`] };
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`Nie można odczytać raportu PREVIEW_READY: ${error.message || error}.`] };
  }
  if (report.version !== 2) errors.push('Raport podglądu musi mieć version=2 i dokładne hashe wszystkich artefaktów.');
  if (report.status !== 'PREVIEW_READY') errors.push(`Raport podglądu nie ma statusu PREVIEW_READY (${report.status || 'brak'}).`);
  if (report.slug !== slug) errors.push('Slug raportu podglądu nie zgadza się z artykułem.');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(report.reviewed_at || ''))) errors.push('Raport podglądu nie ma poprawnego czasu kontroli reviewed_at.');

  validateCurrentFile(root, 'HTML source', report.artifacts?.html_source, errors);
  validateCurrentFile(root, 'HTML _site', report.artifacts?.html_site, errors);
  validateCurrentFile(root, 'PDF source', report.artifacts?.pdf_source, errors);
  validateCurrentFile(root, 'PDF _site', report.artifacts?.pdf_site, errors);

  for (const [name, width] of [['desktop', 1440], ['mobile', 390]]) {
    const view = report.views?.[name];
    if (!view || view.status !== 'PASS') errors.push(`${name}: kontrola widoku nie ma statusu PASS.`);
    if (Number(view?.viewport?.width) !== width) errors.push(`${name}: wymagany viewport ${width}px.`);
    if (!isSha256(view?.screenshot_sha256)) errors.push(`${name}: brak hasha pełnego zrzutu.`);
  }

  const images = Array.isArray(report.images) ? report.images : [];
  if (!images.length) errors.push('Raport nie zawiera kontroli obrazu hero i obrazów sekcyjnych.');
  const sourceHtmlPath = path.join(root, `${slug}.html`);
  if (fs.existsSync(sourceHtmlPath)) {
    const expectedImages = expectedArticleImageCount(fs.readFileSync(sourceHtmlPath, 'utf8'));
    if (images.length !== expectedImages) errors.push(`Raport obejmuje ${images.length}/${expectedImages} obrazów hero i sekcyjnych.`);
  }
  const placements = new Set();
  for (const image of images) {
    const label = `Obraz ${image?.placement || 'UNKNOWN'}`;
    if (!image?.placement || placements.has(image.placement)) errors.push(`${label}: placement jest pusty albo powtórzony.`);
    placements.add(image?.placement);
    if (image?.status !== 'PASS') errors.push(`${label}: kontrola nie ma statusu PASS.`);
    for (const extension of ['avif', 'webp', 'jpg']) {
      validateCurrentFile(root, `${label} / ${extension}`, image?.variants?.[extension], errors);
    }
  }

  const pdf = report.pdf;
  const pages = Array.isArray(pdf?.page_reviews) ? pdf.page_reviews : [];
  if (!Number.isInteger(pdf?.pages) || pdf.pages < 1) errors.push('PDF: brak poprawnej liczby stron.');
  if (pages.length !== pdf?.pages) errors.push(`PDF: raport obejmuje ${pages.length}/${pdf?.pages || 0} stron.`);
  pages.forEach((page, index) => {
    if (page.page !== index + 1) errors.push(`PDF: brak ciągłej kontroli strony ${index + 1}.`);
    if (page.status !== 'PASS') errors.push(`PDF strona ${index + 1}: kontrola nie ma statusu PASS.`);
    if (!isSha256(page.sha256)) errors.push(`PDF strona ${index + 1}: brak hasha renderu.`);
    if (options.requireRenderFiles === true) validateCurrentFile(root, `PDF strona ${index + 1}`, page, errors);
  });

  return { ok: errors.length === 0, errors, report, reportPath };
}

module.exports = { expectedArticleImageCount, isSha256, sha256File, validatePreviewReport };
