#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pageKind } = require('./lib/publication-page-kind');
const { prepareCenterPrint } = require('./lib/topic-center-print');
const { withChromium } = require('./lib/playwright-lifecycle');
const { isInsideRoot, validatePreviewReport } = require('./lib/article-preview-report');
const {
  CONTRACT,
  applyVisualReview,
  createReviewTemplate,
  imageInventoryHash,
} = require('./lib/article-visual-review');

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[key] = 'true';
    else { out[key] = next; index += 1; }
  }
  return out;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function relativeFile(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function fileArtifact(root, file) {
  return { file: relativeFile(root, file), sha256: sha256(file), bytes: fs.statSync(file).size };
}

function imageArtifacts(root, images, errors) {
  return (Array.isArray(images) ? images : []).map((image, index) => {
    const variants = {};
    const itemErrors = [];
    for (const extension of ['avif', 'webp', 'jpg']) {
      const raw = String(image?.variants?.[extension] || '').trim().split(/\s+/)[0].replace(/^\.\//, '');
      const file = path.resolve(root, raw);
      if (!raw || !file.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(file)) {
        itemErrors.push(`brak wariantu ${extension}`);
        variants[extension] = { file: raw, status: 'FAIL' };
      } else {
        variants[extension] = { ...fileArtifact(root, file), status: 'PASS' };
      }
    }
    const placement = String(image?.placement || `image:${index + 1}`);
    itemErrors.forEach((error) => errors.push(`${placement}: ${error}.`));
    return {
      placement,
      role: String(image?.role || 'content'),
      heading: String(image?.heading || ''),
      context: String(image?.context || ''),
      alt: String(image?.alt || ''),
      caption: String(image?.caption || ''),
      technical_status: itemErrors.length ? 'FAIL' : 'PASS',
      variants,
      errors: itemErrors,
    };
  }).map((image) => ({ ...image, inventory_sha256: imageInventoryHash(image) }));
}

function collectDomInventory(isCenter) {
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const slugify = (value) => normalize(value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const root = isCenter ? document.querySelector('main') : document.querySelector('article.article-content');
  const tables = [...(root?.querySelectorAll('table') || [])];
  const tableErrors = tables.filter((table) => !table.closest('.article-table-wrap')).map((_table, index) => `tabela ${index + 1}: brak .article-table-wrap`);
  const roots = [];
  const hero = document.querySelector('section.article-intro-grid .article-hero picture');
  if (hero) roots.push({ picture: hero, role: 'hero' });
  if (isCenter) {
    [...(root?.querySelectorAll('picture') || [])].forEach((picture) => { if (picture !== hero) roots.push({ picture, role: 'center' }); });
  } else {
    const quick = document.querySelector('#quick-answer');
    if (quick && !quick.closest('article.article-content')) [...quick.querySelectorAll('picture')].forEach((picture) => roots.push({ picture, role: 'quick-answer' }));
    [...(root?.querySelectorAll('picture') || [])]
      .filter((picture) => !picture.closest('.share-article-section, .reading-room, .porady-preview'))
      .forEach((picture) => roots.push({ picture, role: picture.closest('.faq-item') ? 'faq' : 'content' }));
  }
  const unique = [];
  const seenNodes = new Set();
  roots.forEach((item) => { if (!seenNodes.has(item.picture)) { seenNodes.add(item.picture); unique.push(item); } });
  const headings = [...(root?.querySelectorAll('h2') || [])];
  const images = unique.map(({ picture, role }, index) => {
    const img = picture.querySelector('img');
    const sources = [...picture.querySelectorAll('source')];
    let heading = '';
    const sectionHeading = picture.closest('section')?.querySelector(':scope > h2, :scope > header h2');
    if (sectionHeading) heading = normalize(sectionHeading.textContent);
    if (!heading) {
      for (const candidate of headings) {
        if (candidate.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING) heading = normalize(candidate.textContent);
      }
    }
    const explicitPlacement = picture.getAttribute('data-preview-placement') || picture.closest('[data-preview-placement]')?.getAttribute('data-preview-placement');
    const placement = explicitPlacement || (role === 'hero' ? 'hero' : `${role}:${index + 1}${heading ? `:${slugify(heading).slice(0, 48)}` : ''}`);
    const figure = picture.closest('figure');
    const contextRoot = picture.closest('section, .faq-item, aside, article') || figure || picture.parentElement;
    return {
      placement,
      role,
      heading,
      context: normalize(contextRoot?.innerText || '').slice(0, 800),
      alt: normalize(img?.getAttribute('alt')),
      caption: normalize(figure?.querySelector('figcaption')?.textContent),
      variants: {
        jpg: img?.getAttribute('src') || '',
        avif: sources.find((source) => source.type === 'image/avif')?.getAttribute('srcset') || '',
        webp: sources.find((source) => source.type === 'image/webp')?.getAttribute('srcset') || '',
      },
    };
  });
  const quickAnswer = document.querySelector('#quick-answer');
  const externalQuickAnswer = quickAnswer && !quickAnswer.closest('article.article-content') ? quickAnswer : null;
  const textRoots = isCenter ? [root] : [externalQuickAnswer, root];
  const text = textRoots.filter(Boolean).map((item) => normalize(item.innerText)).join(' ');
  return {
    tables: tables.length,
    tableErrors,
    tableMarkup: tables.map((table) => table.outerHTML).join('\n'),
    text,
    expectedImages: images.length,
    images,
  };
}

function command(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${command}: ${String(result.stderr || result.stdout || 'błąd').trim()}`);
  return String(result.stdout || '');
}

function normalizeWords(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

function multisetCoverage(expected, actual) {
  return multisetComparison(expected, actual).coverage;
}

function multisetComparison(expected, actual) {
  const available = new Map();
  actual.forEach((word) => available.set(word, (available.get(word) || 0) + 1));
  let matched = 0;
  const missing = [];
  expected.forEach((word) => {
    const count = available.get(word) || 0;
    if (count > 0) { matched += 1; available.set(word, count - 1); }
    else missing.push(word);
  });
  return { coverage: expected.length ? matched / expected.length : 0, missing };
}

function validateSemanticTableMarkup(html) {
  const errors = [];
  const tables = [...String(html || '').matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  tables.forEach((table, index) => {
    const label = `tabela ${index + 1}`;
    if (!/<caption\b[^>]*>/i.test(table)) errors.push(`${label}: brak caption`);
    if (!/<thead\b[^>]*>/i.test(table)) errors.push(`${label}: brak thead`);
    if (!/<tbody\b[^>]*>/i.test(table)) errors.push(`${label}: brak tbody`);
    if (!/<th\b[^>]*>/i.test(table)) errors.push(`${label}: brak nagłówków th`);
    const thead = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '';
    if (/<th\b(?![^>]*\bscope=["']col["'])[^>]*>/i.test(thead)) errors.push(`${label}: th w thead bez scope=col`);
    const tbody = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || '';
    if (/<th\b(?![^>]*\bscope=["']row["'])[^>]*>/i.test(tbody)) errors.push(`${label}: th w tbody bez scope=row`);
  });
  return errors;
}

function isPdfFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size < 8) return false;
  return fs.readFileSync(filePath).subarray(0, 5).toString('ascii') === '%PDF-';
}

function isA4Page(info) {
  const match = String(info).match(/^Page size:\s+([\d.]+) x ([\d.]+) pts\b/m);
  // PDF coordinates are rounded differently by Chromium and ReportLab.
  return Boolean(match && Math.abs(Number(match[1]) - 595.276) < 0.5
    && Math.abs(Number(match[2]) - 841.89) < 0.5);
}

function validatePdfStructure(pdf, expectedText, expectedImages, renderDir, errors) {
  if (!isPdfFile(pdf)) {
    errors.push('Plik PDF jest pusty, uszkodzony albo nie ma nagłówka %PDF-.');
    return { pages: 0, coverage: 0, renders: [] };
  }
  const toolErrorStart = errors.length;
  for (const binary of ['pdfinfo', 'pdftotext', 'pdftoppm', 'pdffonts', 'pdfimages', 'magick', 'identify']) {
    if (spawnSync('which', [binary], { stdio: 'ignore' }).status !== 0) errors.push(`Brak narzędzia PDF: ${binary}.`);
  }
  if (errors.length > toolErrorStart) return { pages: 0, coverage: 0, renders: [] };
  const info = command('pdfinfo', [pdf]);
  const pages = Number((info.match(/^Pages:\s+(\d+)/m) || [])[1] || 0);
  if (!pages) errors.push('PDF nie ma żadnej strony.');
  if (!isA4Page(info)) errors.push('PDF nie ma formatu A4.');

  const fonts = command('pdffonts', [pdf]).split('\n').slice(2).filter((line) => line.trim());
  if (!fonts.length) errors.push('PDF nie zawiera rozpoznawalnych fontów.');
  fonts.forEach((line) => {
    if (!/\syes\s+yes\s+yes\s+\d+/i.test(line)) errors.push(`PDF: font nie jest osadzony lub nie ma mapy Unicode: ${line.trim()}`);
  });

  const pdfText = command('pdftotext', [pdf, '-']);
  const comparison = multisetComparison(normalizeWords(expectedText), normalizeWords(pdfText));
  const coverage = comparison.coverage;
  if (coverage < 0.98) errors.push(`Zgodność tekstu HTML→PDF jest zbyt niska: ${(coverage * 100).toFixed(2)}% (minimum 98%). Brakujące słowa: ${comparison.missing.slice(0, 24).join(', ')}.`);

  const bbox = command('pdftotext', ['-bbox', pdf, '-']);
  for (const pageMatch of bbox.matchAll(/<page\s+width="([\d.]+)"\s+height="([\d.]+)">([\s\S]*?)<\/page>/g)) {
    const width = Number(pageMatch[1]);
    const height = Number(pageMatch[2]);
    for (const word of pageMatch[3].matchAll(/<word\s+xMin="([\d.-]+)"\s+yMin="([\d.-]+)"\s+xMax="([\d.-]+)"\s+yMax="([\d.-]+)"/g)) {
      const [xMin, yMin, xMax, yMax] = word.slice(1).map(Number);
      if (xMin < 0 || yMin < 0 || xMax > width || yMax > height) errors.push('PDF zawiera tekst wychodzący poza obszar strony.');
    }
  }

  const imageRows = command('pdfimages', ['-list', pdf]).split('\n').filter((line) => /^\s*\d+\s+\d+\s+/.test(line));
  if (imageRows.length < expectedImages) errors.push(`PDF utracił ilustracje: znaleziono ${imageRows.length}, oczekiwano co najmniej ${expectedImages}.`);

  fs.rmSync(renderDir, { recursive: true, force: true });
  fs.mkdirSync(renderDir, { recursive: true });
  command('pdftoppm', ['-png', '-r', '144', pdf, path.join(renderDir, 'page')]);
  const renders = fs.readdirSync(renderDir).filter((name) => /^page-\d+\.png$/.test(name)).sort();
  if (renders.length !== pages) errors.push(`Nie wyrenderowano wszystkich stron PDF: ${renders.length}/${pages}.`);
  const pageReviews = [];
  renders.forEach((name, index) => {
    const file = path.join(renderDir, name);
    const pageErrors = [];
    const dimensions = command('identify', ['-format', '%w %h', file]).trim().split(/\s+/).map(Number);
    const geometry = command('magick', [file, '-alpha', 'off', '-fuzz', '4%', '-trim', '-format', '%w %h %X %Y', 'info:']).trim();
    const match = geometry.match(/^(\d+)\s+(\d+)\s+\+(\d+)\s+\+(\d+)$/);
    if (!match || Number(match[1]) < 50 || Number(match[2]) < 50) {
      pageErrors.push('strona PDF jest pusta albo nie można ustalić obszaru treści');
      errors.push(`${name}: ${pageErrors[0]}.`);
      pageReviews.push({ page: index + 1, ...fileArtifact(process.cwd(), file), technical_status: 'FAIL', errors: pageErrors });
      return;
    }
    const [, contentWidth, contentHeight, x, y] = match.map(Number);
    const right = dimensions[0] - x - contentWidth;
    const bottom = dimensions[1] - y - contentHeight;
    if (Math.min(x, y, right, bottom) < 4) {
      pageErrors.push('treść lub ilustracja dotyka krawędzi i może być ucięta');
      errors.push(`${name}: ${pageErrors[0]}.`);
    }
    pageReviews.push({
      page: index + 1,
      ...fileArtifact(process.cwd(), file),
      width: dimensions[0],
      height: dimensions[1],
      content_bounds: { x, y, width: contentWidth, height: contentHeight },
      technical_status: pageErrors.length ? 'FAIL' : 'PASS',
      errors: pageErrors,
    });
  });
  return { pages, coverage, renders, pageReviews };
}

async function inspectHtml(page, url, viewport, screenshot, errors) {
  const consoleErrors = [];
  const listener = (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); };
  page.on('console', listener);
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((image) => { image.loading = 'eager'; });
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
  });
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))]));
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(window.innerHeight * 0.8, 500)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    await new Promise((resolve) => setTimeout(resolve, 250));
    window.scrollTo(0, 0);
  });
  const result = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const insideHorizontalScroller = (element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const overflow = [...document.querySelectorAll('body *')].filter(visible).filter((element) => {
      const rect = element.getBoundingClientRect();
      return !insideHorizontalScroller(element) && (rect.left < -1 || rect.right > window.innerWidth + 1);
    }).slice(0, 12).map((element) => `${element.tagName.toLowerCase()}.${String(element.className || '').split(/\s+/).slice(0, 2).join('.')}`);
    const tinyText = [...document.querySelectorAll('main *, article *')].filter(visible).filter((element) => {
      if (!element.childNodes.length || ![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) return false;
      return Number.parseFloat(getComputedStyle(element).fontSize) < 10;
    }).slice(0, 12).map((element) => `${element.tagName.toLowerCase()}:${getComputedStyle(element).fontSize}`);
    const brokenImages = [...document.images].filter(visible).filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0).map((image) => image.src);
    const badDeclaredRatios = [...document.querySelectorAll('main img[width][height], article img[width][height]')].filter(visible).filter((image) => {
      const declared = Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
      const natural = image.naturalWidth / image.naturalHeight;
      return !Number.isFinite(declared) || Math.abs(declared - natural) > 0.04;
    }).map((image) => image.src);
    return {
      bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      overflow,
      tinyText,
      brokenImages,
      badDeclaredRatios,
      fontStatus: document.fonts.status,
    };
  });
  await page.screenshot({ path: screenshot, fullPage: true });
  page.off('console', listener);
  if (result.bodyOverflow || result.overflow.length) errors.push(`${viewport.width}px: przepełnienie poziome (${result.overflow.join(', ') || 'documentElement'}).`);
  if (result.tinyText.length) errors.push(`${viewport.width}px: tekst mniejszy niż 10 px (${result.tinyText.join(', ')}).`);
  if (result.brokenImages.length) errors.push(`${viewport.width}px: uszkodzone ilustracje (${result.brokenImages.join(', ')}).`);
  if (result.badDeclaredRatios.length) errors.push(`${viewport.width}px: błędne proporcje width/height (${result.badDeclaredRatios.join(', ')}).`);
  if (result.fontStatus !== 'loaded') errors.push(`${viewport.width}px: fonty nie zakończyły ładowania.`);
  const relevantConsoleErrors = consoleErrors.filter((message) => !/net::ERR_FAILED/.test(message));
  if (relevantConsoleErrors.length) errors.push(`${viewport.width}px: błędy konsoli (${relevantConsoleErrors.join(' | ')}).`);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = String(args.slug || '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Podaj poprawny --slug.');
  const root = process.cwd();
  const reportDir = path.join(root, 'data', 'reports', 'article-preview');
  const reportPath = path.join(reportDir, `${slug}.json`);
  const markdownPath = path.join(reportDir, `${slug}.md`);
  if (args['review-file']) {
    const reviewPath = path.resolve(root, String(args['review-file']));
    if (!isInsideRoot(root, reviewPath)) throw new Error('Plik review musi należeć do zarządzanego stagingu albo repozytorium.');
    const technical = validatePreviewReport(root, slug, { requireReady: false, requireRenderFiles: true });
    if (!technical.ok) throw new Error(`Raport techniczny nie pozwala zastosować review:\n- ${technical.errors.join('\n- ')}`);
    const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
    const reviewed = applyVisualReview(technical.report, review);
    fs.writeFileSync(reportPath, `${JSON.stringify(reviewed, null, 2)}\n`, 'utf8');
    const finalValidation = validatePreviewReport(root, slug, { requireRenderFiles: true });
    if (!finalValidation.ok) {
      fs.writeFileSync(reportPath, `${JSON.stringify({ ...reviewed, status: CONTRACT.pending_status }, null, 2)}\n`, 'utf8');
      throw new Error(`Visual review nie przeszedł:\n- ${finalValidation.errors.join('\n- ')}`);
    }
    fs.writeFileSync(markdownPath, `${[
      '# FitPo50 — staging HTML, obrazy i PDF', '',
      `- Status: **${CONTRACT.ready_status}**`,
      `- Technical: **${CONTRACT.technical_status}**`,
      `- Visual: **${CONTRACT.verified_status}**`,
      `- Slug: ${slug}`,
      `- Reviewed by: ${reviewed.visual_review.reviewed_by}`,
      `- Review method: ${reviewed.visual_review.review_method}`,
      `- Obrazy: ${reviewed.images.length}`,
      `- PDF: ${reviewed.pdf.pages} stron`,
    ].join('\n')}\n`, 'utf8');
    console.log(`[PREVIEW_READY] ${slug}: TECHNICAL_PASS + VISUAL_REVIEW_VERIFIED.`);
    return;
  }

  let previousReport = null;
  if (fs.existsSync(reportPath)) {
    try {
      previousReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (_error) {
      previousReport = null;
    }
  }

  const startedAt = Date.now();
  const html = path.join(root, `${slug}.html`);
  const siteHtml = path.join(root, '_site', `${slug}.html`);
  const pdf = path.join(root, 'assets', 'pdf', `${slug}.pdf`);
  const sitePdf = path.join(root, '_site', 'assets', 'pdf', `${slug}.pdf`);
  const errors = [];
  for (const file of [html, siteHtml, pdf, sitePdf]) if (!fs.existsSync(file)) errors.push(`Brak stagingowego artefaktu: ${file}.`);
  if (errors.length) throw new Error(errors.join('\n'));
  if (sha256(html) !== sha256(siteHtml)) errors.push('HTML źródłowy i _site nie są identyczne 1:1.');
  if (sha256(pdf) !== sha256(sitePdf)) errors.push('PDF źródłowy i _site nie są identyczne 1:1.');

  const previewDir = path.join(root, '.tmp', 'article-preview', slug);
  fs.mkdirSync(previewDir, { recursive: true });
  const pageUrl = `file://${html}`;
  const center = pageKind(fs.readFileSync(html, 'utf8')) === 'topic_center';
  const playwright = require('playwright');
  const { desktop, mobile, semantic } = await withChromium(playwright.chromium, async (browser) => {
    const context = await browser.newContext();
    await context.route(/^https?:\/\//, (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const desktopErrors = [];
    const mobileErrors = [];
    const desktopResult = await inspectHtml(page, pageUrl, { width: 1440, height: 1000 }, path.join(previewDir, 'desktop.png'), desktopErrors);
    const mobileResult = await inspectHtml(page, pageUrl, { width: 390, height: 844 }, path.join(previewDir, 'mobile.png'), mobileErrors);
    errors.push(...desktopErrors, ...mobileErrors);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (center) await prepareCenterPrint(page);
    const semanticResult = await page.evaluate(collectDomInventory, center);
    return {
      desktop: { ...desktopResult, technical_status: desktopErrors.length ? 'FAIL' : 'PASS', errors: desktopErrors },
      mobile: { ...mobileResult, technical_status: mobileErrors.length ? 'FAIL' : 'PASS', errors: mobileErrors },
      semantic: semanticResult,
    };
  }, { timeoutMs: 120000, label: `Podgląd artykułu ${slug}` });
  semantic.tableErrors.forEach((error) => errors.push(error));
  validateSemanticTableMarkup(semantic.tableMarkup).forEach((error) => errors.push(error));

  const pdfResult = validatePdfStructure(pdf, semantic.text, semantic.expectedImages, path.join(previewDir, 'pdf-pages'), errors);
  const images = imageArtifacts(root, semantic.images, errors);
  const generatedAt = new Date().toISOString();
  const desktopScreenshot = path.join(previewDir, 'desktop.png');
  const mobileScreenshot = path.join(previewDir, 'mobile.png');
  const report = {
    version: CONTRACT.version,
    status: errors.length ? 'BLOCKED' : CONTRACT.pending_status,
    generated_at: generatedAt,
    reviewed_at: null,
    slug,
    html_sha256: sha256(html),
    site_html_sha256: sha256(siteHtml),
    pdf_sha256: sha256(pdf),
    site_pdf_sha256: sha256(sitePdf),
    technical_review: {
      status: errors.length ? 'TECHNICAL_BLOCKED' : CONTRACT.technical_status,
      completed_at: generatedAt,
      errors: [...errors],
    },
    html: { semantic_tables: semantic.tables },
    artifacts: {
      html_source: fileArtifact(root, html),
      html_site: fileArtifact(root, siteHtml),
      pdf_source: fileArtifact(root, pdf),
      pdf_site: fileArtifact(root, sitePdf),
    },
    views: {
      desktop: { technical_status: desktop.technical_status, viewport: { width: 1440, height: 1000 }, screenshot_file: relativeFile(root, desktopScreenshot), screenshot_sha256: sha256(desktopScreenshot), errors: desktop.errors },
      mobile: { technical_status: mobile.technical_status, viewport: { width: 390, height: 844 }, screenshot_file: relativeFile(root, mobileScreenshot), screenshot_sha256: sha256(mobileScreenshot), errors: mobile.errors },
    },
    images,
    pdf: { pages: pdfResult.pages, text_coverage: Number(pdfResult.coverage.toFixed(4)), rendered_pages: pdfResult.renders.length, page_reviews: pdfResult.pageReviews || [] },
    visual_review: {
      status: CONTRACT.pending_status,
      reviewed_by: null,
      reviewed_at: null,
      review_method: null,
      views: {},
      images: [],
      pdf_pages: [],
      errors: [],
    },
    timing: { technical_ms: Date.now() - startedAt, review_wait_ms: null },
    errors,
  };
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `${slug}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!errors.length) {
    const validation = validatePreviewReport(root, slug, { requireReady: false, requireRenderFiles: true });
    if (!validation.ok) errors.push(...validation.errors);
    report.status = errors.length ? 'BLOCKED' : CONTRACT.pending_status;
    report.technical_review.status = errors.length ? 'TECHNICAL_BLOCKED' : CONTRACT.technical_status;
    report.technical_review.errors = [...errors];
    report.errors = errors;
    fs.writeFileSync(path.join(reportDir, `${slug}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  const templatePath = path.join(previewDir, 'visual-review-template.json');
  fs.writeFileSync(templatePath, `${JSON.stringify(createReviewTemplate(report, previousReport), null, 2)}\n`, 'utf8');
  const markdown = [
    '# FitPo50 — staging HTML i PDF', '',
    `- Status: **${report.status}**`,
    `- Technical: **${report.technical_review.status}**`,
    `- Visual: **${report.visual_review.status}**`,
    `- Slug: ${slug}`,
    `- Render HTML: desktop 1440 px + mobile 390 px`,
    `- Tabele semantyczne: ${semantic.tables}`,
    `- PDF: ${pdfResult.pages} stron, wyrenderowano ${pdfResult.renders.length}`,
    `- Zgodność tekstu HTML→PDF: ${(pdfResult.coverage * 100).toFixed(2)}%`,
    `- HTML source/_site: ${report.html_sha256 === report.site_html_sha256 ? '1:1' : 'FAIL'}`,
    `- PDF source/_site: ${report.pdf_sha256 === report.site_pdf_sha256 ? '1:1' : 'FAIL'}`,
    ...(errors.length ? ['', '## Blokery', ...errors.map((error) => `- ${error}`)] : []),
  ];
  fs.writeFileSync(path.join(reportDir, `${slug}.md`), `${markdown.join('\n')}\n`, 'utf8');
  if (errors.length) {
    errors.forEach((error) => console.error(`[FAIL] ${error}`));
    process.exitCode = 2;
    return;
  }
  console.log(`[${CONTRACT.pending_status}] ${slug}: ${CONTRACT.technical_status}; wymagany rzeczywisty review.`);
  console.log(`[REVIEW_TEMPLATE] ${templatePath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[FAIL] article-preview-gate: ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = {
  collectDomInventory,
  isA4Page,
  inspectHtml,
  isPdfFile,
  multisetComparison,
  multisetCoverage,
  normalizeWords,
  parseArgs,
  validatePdfStructure,
  validateSemanticTableMarkup,
};
