#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function getHtmlFiles() {
  return fs.readdirSync(process.cwd())
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html');
}

function isArticleHtml(content) {
  return /<body[^>]*class="[^"]*article-template[^"]*"/i.test(content);
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function countInternalContextLinks(articleContentHtml) {
  const rx = /<a\b[^>]*href="([^"]+)"/gi;
  const unique = new Set();
  for (const m of articleContentHtml.matchAll(rx)) {
    const href = String(m[1] || '').trim();
    if (!href) continue;
    if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
    if (!/\.html(?:[?#].*)?$/i.test(href)) continue;
    if (/^\.?\/?porady\.html(?:[?#].*)?$/i.test(href)) continue;
    unique.add(href.replace(/^\.\//, ''));
  }
  return unique.size;
}

function extractArticleContentHtml(raw) {
  const startMatch = raw.match(/<article\s+class="article-content">/i);
  if (!startMatch || startMatch.index === undefined) return '';
  const start = startMatch.index + startMatch[0].length;
  const endBySources = raw.search(/<h2\s+id="zrodla">/i);
  const endByMain = raw.search(/<\/main>/i);
  let end = -1;
  if (endBySources > start) end = endBySources;
  if (end === -1 && endByMain > start) end = endByMain;
  if (end === -1) end = raw.length;
  return raw.slice(start, end);
}

function validateAnswerFirstParagraphs(raw, errors) {
  const h2Rx = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2s = [...raw.matchAll(h2Rx)];
  const skippedTitles = new Set([
    'kluczowe wnioski',
    'najczęściej zadawane pytania',
    'zrodla',
    'źródła',
  ]);

  let checked = 0;
  for (let i = 0; i < h2s.length; i += 1) {
    const current = h2s[i];
    const next = h2s[i + 1];
    const title = stripTags(current[1]).toLowerCase();
    if (skippedTitles.has(title)) continue;
    if (title.includes('źródła') || title.includes('zrodla')) continue;

    const sectionStart = current.index + current[0].length;
    const sectionEnd = next ? next.index : raw.length;
    const sectionHtml = raw.slice(sectionStart, sectionEnd);
    const pMatch = sectionHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!pMatch) {
      errors.push(`Sekcja "${stripTags(current[1])}" nie zawiera akapitu otwierającego <p>.`);
      continue;
    }
    checked += 1;
    const words = countWords(stripTags(pMatch[1]));
    if (words < 35 || words > 80) {
      errors.push(`Sekcja "${stripTags(current[1])}": pierwszy akapit powinien mieć 35-80 słów (ma ${words}).`);
    }
  }

  if (checked === 0) {
    errors.push('Nie znaleziono sekcji H2 do walidacji answer-first.');
  }
}

function validateFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const isoDateTimeWithTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

  const requiredPatterns = [
    { label: 'body.article-template', regex: /<body[^>]*class="[^"]*article-template[^"]*"/i },
    { label: 'body.article--kategoria', regex: /<body[^>]*class="[^"]*article--(ruch|jedzenie|zdrowie|ciekawe)[^"]*"/i },
    { label: '.shell', regex: /class="shell"/i },
    { label: 'header.topbar', regex: /<header\s+class="topbar"/i },
    { label: 'article-intro-grid', regex: /class="[^"]*article-intro-grid[^"]*"/i },
    { label: 'article-content', regex: /class="article-content"/i },
    { label: 'Czytelnia index-style section', regex: /<section\s+class="reading-room porady-preview section-padding"\s+id="porady-preview">/i },
    { label: 'Czytelnia head', regex: /class="reading-room__head\s+reveal"/i },
    { label: 'Czytelnia icon wrapper', regex: /class="title-with-icon"/i },
    { label: 'bottom-nav', regex: /<nav\s+class="bottom-nav"/i },
    { label: 'site-footer-bento', regex: /<footer\s+class="site-footer-bento"/i },
    { label: 'style.css include', regex: /href="\.\/style\.css(\?v=[^"]+)?"/i },
    { label: 'article.css include', regex: /href="\.\/article\.css(\?v=[^"]+)?"/i }
  ];

  for (const rule of requiredPatterns) {
    if (!rule.regex.test(raw)) errors.push(`Brak: ${rule.label}`);
  }

  if (/\sstyle\s*=\s*['"]/i.test(raw)) {
    errors.push('Wykryto inline CSS (style="...")');
  }

  if (/<style[\s>]/i.test(raw)) {
    errors.push('Wykryto lokalny blok <style>');
  }

  const bodyOpen = raw.search(/<body[^>]*>/i);
  const bodyClose = raw.search(/<\/body>/i);
  const footerOpen = raw.search(/<footer\s+class="site-footer-bento"/i);
  if (bodyOpen === -1 || bodyClose === -1 || footerOpen === -1) {
    errors.push('Brak body/footer do walidacji położenia');
  } else if (!(footerOpen > bodyOpen && footerOpen < bodyClose)) {
    errors.push('Footer jest poza <body>');
  }

  const bodyClassMatch = raw.match(/<body[^>]*class="([^"]+)"/i);
  const categoryMatch = bodyClassMatch ? bodyClassMatch[1].match(/article--(ruch|jedzenie|zdrowie|ciekawe)/i) : null;
  if (categoryMatch) {
    const key = categoryMatch[1].toLowerCase();
    const kickerRegex = new RegExp(`article-kicker-card--${key}`, 'i');
    if (!kickerRegex.test(raw)) {
      errors.push(`Kategoria body (${key}) nie zgadza się z article-kicker-card--${key}`);
    }
  }

  const localPaths = [];
  for (const m of raw.matchAll(/<img[^>]*\ssrc="([^"]+)"/gi)) {
    localPaths.push(m[1]);
  }
  for (const m of raw.matchAll(/<source[^>]*\ssrcset="([^"]+)"/gi)) {
    const first = m[1].split(',')[0].trim().split(/\s+/)[0];
    if (first) localPaths.push(first);
  }
  for (const m of raw.matchAll(/<link[^>]*\shref="([^"]+)"/gi)) {
    localPaths.push(m[1]);
  }
  for (const m of raw.matchAll(/<script[^>]*\ssrc="([^"]+)"/gi)) {
    localPaths.push(m[1]);
  }
  for (const m of raw.matchAll(/<a[^>]*\shref="([^"]+)"/gi)) {
    localPaths.push(m[1]);
  }

  const checked = new Set();
  for (const p of localPaths) {
    if (!p) continue;
    if (/^(https?:)?\/\//i.test(p)) continue;
    if (p.startsWith('#') || p.startsWith('mailto:') || p.startsWith('tel:') || p.startsWith('javascript:')) continue;

    const clean = p.split('#')[0].split('?')[0].trim();
    if (!clean || clean === '/') continue;
    const normalized = clean.replace(/^\.\//, '').replace(/^\//, '');
    if (!normalized) continue;
    if (checked.has(normalized)) continue;
    checked.add(normalized);

    const abs = path.resolve(process.cwd(), normalized);
    if (!fs.existsSync(abs)) {
      errors.push(`Brak lokalnego pliku referencji: ${clean}`);
    }
  }

  const sourcesListMatch = raw.match(/<ol\s+class="sources-list"[\s\S]*?<\/ol>/i);
  if (sourcesListMatch) {
    const liItems = sourcesListMatch[0].match(/<li[\s\S]*?<\/li>/gi) || [];
    const withoutLinks = liItems.filter((li) => !/<a\s+[^>]*href="https?:\/\/[^"]+"/i.test(li));
    if (withoutLinks.length) {
      errors.push(`Źródła: ${withoutLinks.length} pozycji bez klikalnego linku URL`);
    }
  }

  const metaPublished = raw.match(/<meta\s+property="article:published_time"\s+content="([^"]+)"/i);
  if (metaPublished && !isoDateTimeWithTimezone.test(metaPublished[1])) {
    errors.push('article:published_time musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T08:00:00+02:00)');
  }
  const metaModified = raw.match(/<meta\s+property="article:modified_time"\s+content="([^"]+)"/i);
  if (metaModified && !isoDateTimeWithTimezone.test(metaModified[1])) {
    errors.push('article:modified_time musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T09:30:00+02:00)');
  }

  for (const m of raw.matchAll(/"datePublished"\s*:\s*"([^"]+)"/g)) {
    if (!isoDateTimeWithTimezone.test(m[1])) {
      errors.push('BlogPosting.datePublished musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T08:00:00+02:00)');
      break;
    }
  }
  for (const m of raw.matchAll(/"dateModified"\s*:\s*"([^"]+)"/g)) {
    if (!isoDateTimeWithTimezone.test(m[1])) {
      errors.push('BlogPosting.dateModified musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T09:30:00+02:00)');
      break;
    }
  }

  const articleContentHtml = extractArticleContentHtml(raw);
  if (!articleContentHtml) {
    errors.push('Brak <article class="article-content"> do walidacji AEO/GEO.');
  } else {
    const internalLinks = countInternalContextLinks(articleContentHtml);
    if (internalLinks < 4) {
      errors.push(`Za mało linków kontekstowych w treści: ${internalLinks}/4.`);
    }
    validateAnswerFirstParagraphs(articleContentHtml, errors);
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const explicitMode = args.length > 0;
  let files = explicitMode ? args : getHtmlFiles();
  files = files.filter((f) => fs.existsSync(path.resolve(process.cwd(), f)));

  const articleFiles = files.filter((f) => {
    if (explicitMode) return true;
    const c = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
    return isArticleHtml(c);
  });

  if (!articleFiles.length) {
    console.log('Brak plików artykułów do walidacji.');
    return;
  }

  let hasErrors = false;
  for (const f of articleFiles) {
    const errs = validateFile(path.resolve(process.cwd(), f));
    if (errs.length) {
      hasErrors = true;
      console.log(`\n✖ ${f}`);
      errs.forEach((e) => console.log(`  - ${e}`));
    } else {
      console.log(`✔ ${f}`);
    }
  }

  if (hasErrors) process.exit(1);
}

main();
