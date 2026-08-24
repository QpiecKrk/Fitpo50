#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

function validatePdfStructure(pdf, expectedText, expectedImages, renderDir, errors) {
  for (const binary of ['pdfinfo', 'pdftotext', 'pdftoppm', 'pdffonts', 'pdfimages', 'magick', 'identify']) {
    if (spawnSync('which', [binary], { stdio: 'ignore' }).status !== 0) errors.push(`Brak narzędzia PDF: ${binary}.`);
  }
  if (errors.length) return { pages: 0, coverage: 0, renders: [] };
  const info = command('pdfinfo', [pdf]);
  const pages = Number((info.match(/^Pages:\s+(\d+)/m) || [])[1] || 0);
  if (!pages) errors.push('PDF nie ma żadnej strony.');
  if (!/^Page size:\s+595(?:\.\d+)? x 841(?:\.\d+)? pts \(A4\)/m.test(info)) errors.push('PDF nie ma formatu A4.');

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
  renders.forEach((name) => {
    const file = path.join(renderDir, name);
    const dimensions = command('identify', ['-format', '%w %h', file]).trim().split(/\s+/).map(Number);
    const geometry = command('magick', [file, '-alpha', 'off', '-fuzz', '4%', '-trim', '-format', '%w %h %X %Y', 'info:']).trim();
    const match = geometry.match(/^(\d+)\s+(\d+)\s+\+(\d+)\s+\+(\d+)$/);
    if (!match || Number(match[1]) < 50 || Number(match[2]) < 50) {
      errors.push(`${name}: strona PDF jest pusta albo nie można ustalić obszaru treści.`);
      return;
    }
    const [, contentWidth, contentHeight, x, y] = match.map(Number);
    const right = dimensions[0] - x - contentWidth;
    const bottom = dimensions[1] - y - contentHeight;
    if (Math.min(x, y, right, bottom) < 4) errors.push(`${name}: treść lub ilustracja dotyka krawędzi i może być ucięta.`);
  });
  return { pages, coverage, renders };
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
    const tinyText = [...document.querySelectorAll('article *')].filter(visible).filter((element) => {
      if (!element.childNodes.length || ![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) return false;
      return Number.parseFloat(getComputedStyle(element).fontSize) < 10;
    }).slice(0, 12).map((element) => `${element.tagName.toLowerCase()}:${getComputedStyle(element).fontSize}`);
    const brokenImages = [...document.images].filter(visible).filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0).map((image) => image.src);
    const badDeclaredRatios = [...document.querySelectorAll('article img[width][height]')].filter(visible).filter((image) => {
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
  const html = path.join(root, `${slug}.html`);
  const siteHtml = path.join(root, '_site', `${slug}.html`);
  const pdf = path.join(root, 'assets', 'pdf', `${slug}.pdf`);
  const sitePdf = path.join(root, '_site', 'assets', 'pdf', `${slug}.pdf`);
  const errors = [];
  for (const file of [html, siteHtml, pdf, sitePdf]) if (!fs.existsSync(file)) errors.push(`Brak stagingowego artefaktu: ${file}.`);
  if (errors.length) throw new Error(errors.join('\n'));
  if (sha256(html) !== sha256(siteHtml)) errors.push('HTML źródłowy i _site nie są identyczne 1:1.');
  if (sha256(pdf) !== sha256(sitePdf)) errors.push('PDF źródłowy i _site nie są identyczne 1:1.');

  const playwright = require('playwright');
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route(/^https?:\/\//, (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const previewDir = path.join(root, '.tmp', 'article-preview', slug);
  fs.mkdirSync(previewDir, { recursive: true });
  const pageUrl = `file://${html}`;
  const desktop = await inspectHtml(page, pageUrl, { width: 1440, height: 1000 }, path.join(previewDir, 'desktop.png'), errors);
  const mobile = await inspectHtml(page, pageUrl, { width: 390, height: 844 }, path.join(previewDir, 'mobile.png'), errors);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const semantic = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('article table')];
    const tableErrors = [];
    tables.forEach((table, index) => {
      if (!table.closest('.article-table-wrap')) tableErrors.push(`tabela ${index + 1}: brak .article-table-wrap`);
      if (!table.querySelector(':scope > caption')) tableErrors.push(`tabela ${index + 1}: brak caption`);
      if (!table.querySelector(':scope > thead')) tableErrors.push(`tabela ${index + 1}: brak thead`);
      if (!table.querySelector(':scope > tbody')) tableErrors.push(`tabela ${index + 1}: brak tbody`);
      if (!table.querySelector('th')) tableErrors.push(`tabela ${index + 1}: brak nagłówków th`);
      table.querySelectorAll('thead th').forEach((th) => { if (th.getAttribute('scope') !== 'col') tableErrors.push(`tabela ${index + 1}: th w thead bez scope=col`); });
      table.querySelectorAll('tbody th').forEach((th) => { if (th.getAttribute('scope') !== 'row') tableErrors.push(`tabela ${index + 1}: th w tbody bez scope=row`); });
    });
    const article = document.querySelector('article.article-content')?.cloneNode(true);
    article?.querySelectorAll('.share-article-section, script, style, button').forEach((node) => node.remove());
    const title = document.querySelector('h1.article-header__title')?.textContent || '';
    const textChunks = article ? [...article.querySelectorAll('h1, h2, h3, h4, p, li, caption, th, td, figcaption')].map((node) => node.textContent || '') : [];
    const expectedImages = (document.querySelector('section.article-intro-grid .article-hero img') ? 1 : 0) + document.querySelectorAll('article.article-content figure img').length;
    return { tables: tables.length, tableErrors, text: `${title} ${textChunks.join(' ')}`, expectedImages };
  });
  semantic.tableErrors.forEach((error) => errors.push(error));
  await browser.close();

  const pdfResult = validatePdfStructure(pdf, semantic.text, semantic.expectedImages, path.join(previewDir, 'pdf-pages'), errors);
  const generatedAt = new Date().toISOString();
  const report = {
    version: 1,
    status: errors.length ? 'BLOCKED' : 'PREVIEW_READY',
    generated_at: generatedAt,
    slug,
    html_sha256: sha256(html),
    site_html_sha256: sha256(siteHtml),
    pdf_sha256: sha256(pdf),
    site_pdf_sha256: sha256(sitePdf),
    html: { desktop, mobile, semantic_tables: semantic.tables },
    pdf: { pages: pdfResult.pages, text_coverage: Number(pdfResult.coverage.toFixed(4)), rendered_pages: pdfResult.renders.length },
    errors,
  };
  const reportDir = path.join(root, 'data', 'reports', 'article-preview');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `${slug}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const markdown = [
    '# FitPo50 — staging HTML i PDF', '',
    `- Status: **${report.status}**`,
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
  console.log(`[PREVIEW_READY] ${slug}: HTML desktop/mobile + ${pdfResult.pages} stron PDF przeszły kontrolę.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[FAIL] article-preview-gate: ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = { inspectHtml, multisetComparison, multisetCoverage, normalizeWords, parseArgs, validatePdfStructure };
