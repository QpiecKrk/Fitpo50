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
    const isAbsInternal = /^https?:\/\/(www\.)?fitpo50\.pl\/[^"\s]+\.html(?:[?#].*)?$/i.test(href);
    const isRelInternal = !/^(https?:|mailto:|tel:|javascript:|#)/i.test(href) && /\.html(?:[?#].*)?$/i.test(href);
    if (!isAbsInternal && !isRelInternal) continue;
    const normalized = href
      .replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, '')
      .replace(/^\.\//, '');
    if (/^porady\.html(?:[?#].*)?$/i.test(normalized)) continue;
    unique.add(normalized);
  }
  return unique.size;
}

function normalizeTextForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFaqBlock(articleContentHtml) {
  return String(articleContentHtml || '').split(/<section\s+class="faq-list\b/i)[0];
}

function extractArticleContentHtml(raw) {
  const startMatch = raw.match(/<article\s+class="article-content">/i);
  if (!startMatch || startMatch.index === undefined) return '';
  const start = startMatch.index + startMatch[0].length;
  const endBySources = raw.search(/<h2\s+id="zrodla">/i);
  const endByFaq = raw.search(/<section\s+class="faq-list\b/i);
  const endByMain = raw.search(/<\/main>/i);
  let end = -1;
  if (endByFaq > start) end = endByFaq;
  if (endBySources > start) end = endBySources;
  if (endByFaq > start && endBySources > start) end = Math.min(endByFaq, endBySources);
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

function validateQuickAnswerBlock(articleContentHtml, errors) {
  const blockMatch = articleContentHtml.match(/<section\s+class="quick-answer[^"]*"[\s\S]*?<\/section>/i);
  if (!blockMatch) {
    errors.push('Brak sekcji .quick-answer (Szybka odpowiedź).');
    return;
  }
  const paragraphMatch = blockMatch[0].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!paragraphMatch) {
    errors.push('Sekcja .quick-answer nie zawiera akapitu <p>.');
    return;
  }
  const wc = countWords(stripTags(paragraphMatch[1]));
  if (wc < 40 || wc > 60) {
    errors.push(`Szybka odpowiedź: wymagane 40-60 słów (jest ${wc}).`);
  }

  const leadMatch = articleContentHtml.match(/<p class="drop-cap">([\s\S]*?)<\/p>/i);
  if (leadMatch) {
    const leadNorm = normalizeTextForCompare(stripTags(leadMatch[1]));
    const quickNorm = normalizeTextForCompare(stripTags(paragraphMatch[1]));
    if (leadNorm && quickNorm && leadNorm === quickNorm) {
      errors.push('Szybka odpowiedź nie może być kopią 1:1 pierwszego akapitu.');
    }
  }
}

function validateQuestionHeadings(articleContentHtml, errors) {
  const h2Rx = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const skippedTitles = new Set([
    'kluczowe wnioski',
    'najczęściej zadawane pytania',
    'zrodla',
    'źródła',
    'szybka odpowiedź',
    'szybka odpowiedz',
  ]);
  for (const m of articleContentHtml.matchAll(h2Rx)) {
    const titleRaw = stripTags(m[1]);
    const title = titleRaw.toLowerCase().trim();
    if (skippedTitles.has(title)) continue;
    if (title.includes('źródła') || title.includes('zrodla')) continue;
    if (!titleRaw.trim().endsWith('?')) {
      errors.push(`H2 "${titleRaw.trim()}" powinien być pytaniem zakończonym "?".`);
    }
  }
}

function validateInlineFiguresUsePicture(articleContentHtml, errors) {
  const figureRx = /<figure\b[^>]*class="[^"]*\binline-figure\b[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi;
  let idx = 0;
  for (const m of articleContentHtml.matchAll(figureRx)) {
    idx += 1;
    const figureHtml = String(m[1] || '');
    if (!/<picture\b/i.test(figureHtml)) {
      errors.push(`Inline figure #${idx}: brak tagu <picture> (wymagane AVIF/WebP + fallback).`);
      continue;
    }
    if (!/<source\b[^>]*type="image\/avif"/i.test(figureHtml)) {
      errors.push(`Inline figure #${idx}: brak source dla AVIF.`);
    }
    if (!/<source\b[^>]*type="image\/webp"/i.test(figureHtml)) {
      errors.push(`Inline figure #${idx}: brak source dla WebP.`);
    }
    if (!/<img\b/i.test(figureHtml)) {
      errors.push(`Inline figure #${idx}: brak fallback <img>.`);
    }
  }
}

function validateNoAbsoluteInternalLinksInNarrative(articleContentHtml, errors) {
  const narrative = stripFaqBlock(articleContentHtml);
  const absInternalLinks = [...narrative.matchAll(/<a\b[^>]*href="https?:\/\/(?:www\.)?fitpo50\.pl\/([^"]+\.html(?:[?#][^"]*)?)"/gi)];
  if (absInternalLinks.length) {
    errors.push(`Wykryto linki absolutne do fitpo50.pl w treści (${absInternalLinks.length}). Użyj ścieżek względnych ./...`);
  }
}

function validateBrokenSentenceArtifacts(articleContentHtml, errors) {
  if (/,\s*czyli\.\s*(<\/p>|$)/i.test(articleContentHtml)) {
    errors.push('Wykryto urwane zdanie (wzorzec ", czyli.").');
  }
}

function validateNoXmlProlog(raw, errors) {
  if (/^\s*<\?xml\b/i.test(raw)) {
    errors.push('Wykryto deklarację XML na początku pliku HTML5 (<?xml ...?>). Usuń ją.');
  }
}

function validateNoInvalidSourceClosingTags(raw, errors) {
  const bad = raw.match(/<\/source>/gi);
  if (bad && bad.length) {
    errors.push(`Wykryto niedozwolone zamknięcia </source> (${bad.length}x).`);
  }
}

function validateAsideTitlesNotDuplicated(articleContentHtml, errors) {
  const h2Titles = [...articleContentHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => normalizeTextForCompare(stripTags(m[1])))
    .filter(Boolean);
  const h2Set = new Set(h2Titles);

  const asides = [...articleContentHtml.matchAll(/<aside\b[^>]*class="[^"]*\bhighlight-box\b[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
  for (const a of asides) {
    let title = normalizeTextForCompare(stripTags(a[1]));
    title = title.replace(/^wazne:\s*/i, '');
    if (!title) continue;
    if (h2Set.has(title)) {
      errors.push(`Boks aside dubluje nagłówek H2: "${stripTags(a[1]).trim()}".`);
      break;
    }
  }
}

function validateRepeatedLongSentences(articleContentHtml, errors) {
  const plain = stripTags(articleContentHtml);
  const sentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const map = new Map();
  for (const sentence of sentences) {
    const norm = normalizeTextForCompare(sentence);
    if (!norm) continue;
    if (countWords(norm) < 8) continue;
    if (norm.length < 45) continue;
    map.set(norm, (map.get(norm) || 0) + 1);
  }
  for (const [sentence, count] of map.entries()) {
    if (count >= 3) {
      errors.push(`Wykryto zdanie powtórzone ${count}x: "${sentence.slice(0, 90)}..."`);
      break;
    }
  }
}

function validateFaqResearchInBlogPosting(raw, errors) {
  const scripts = [...raw.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const scriptMatch of scripts) {
    const body = String(scriptMatch[1] || '').trim();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (_err) {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isBlogPosting = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
      if (!isBlogPosting) continue;
      const arr = Array.isArray(node.faq_research) ? node.faq_research : [];
      if (arr.length < 4) {
        errors.push(`BlogPosting.faq_research: wymagane minimum 4 wpisy (jest ${arr.length}).`);
      }
      return;
    }
  }
  errors.push('Brak schema BlogPosting do walidacji faq_research.');
}

function firstMatch(raw, regex) {
  const m = String(raw || '').match(regex);
  return m ? String(m[1] || '').trim() : '';
}

function validateHeadSeoConsistency(raw, errors) {
  const title = firstMatch(raw, /<title>([^<]+)<\/title>/i);
  if (!title) {
    errors.push('Brak tagu <title>.');
  } else {
    if (title.length > 65) {
      errors.push(`<title> przekracza 65 znaków (jest ${title.length}).`);
    }
    if (/\s[–-]\s*\|\s*fitpo50\s*$/i.test(title)) {
      errors.push('<title> ma podwójny separator przed "| FitPo50" (np. "– |").');
    }
  }

  const metaDescription = firstMatch(raw, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const ogDescription = firstMatch(raw, /<meta\s+property="og:description"\s+content="([^"]*)"/i);
  const twitterDescription = firstMatch(raw, /<meta\s+name="twitter:description"\s+content="([^"]*)"/i);
  const schemaDescription = firstMatch(raw, /"description"\s*:\s*"([^"]+)"/i);

  if (!metaDescription) {
    errors.push('Brak <meta name="description">.');
  } else {
    if (metaDescription.length < 145 || metaDescription.length > 160) {
      errors.push(`meta description poza zakresem 145-160 znaków (jest ${metaDescription.length}).`);
    }
    if (!/[.!?]$/.test(metaDescription)) {
      errors.push('meta description wygląda na urwany: powinien kończyć się ".", "!" lub "?".');
    }
  }

  if (metaDescription && ogDescription && metaDescription !== ogDescription) {
    errors.push('Niespójny opis: meta description != og:description.');
  }
  if (metaDescription && twitterDescription && metaDescription !== twitterDescription) {
    errors.push('Niespójny opis: meta description != twitter:description.');
  }
  if (metaDescription && schemaDescription && metaDescription !== schemaDescription) {
    errors.push('Niespójny opis: meta description != BlogPosting.description.');
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

  validateNoXmlProlog(raw, errors);
  validateNoInvalidSourceClosingTags(raw, errors);
  validateHeadSeoConsistency(raw, errors);

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

  const categoryLandingUrls = new Set([
    'index.html',
    'porady.html',
    'rusz-sie.html',
    'jedzenie.html',
    'zdrowie.html',
    'ciekawe.html',
    'dziennik.html',
    'o-mnie.html',
  ]);
  const readingRoomCardRx = /<a\s+href="([^"]+)"\s+class="article-promo-card reveal">/gi;
  for (const m of raw.matchAll(readingRoomCardRx)) {
    const href = String(m[1] || '').trim();
    const normalized = href.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\/+/, '');
    if (categoryLandingUrls.has(normalized.toLowerCase())) {
      errors.push(`Czytelnia: link "${href}" wskazuje stronę kategorii. Ustaw konkretny artykuł *.html.`);
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
    validateQuickAnswerBlock(articleContentHtml, errors);
    validateQuestionHeadings(articleContentHtml, errors);
    validateInlineFiguresUsePicture(articleContentHtml, errors);
    validateNoAbsoluteInternalLinksInNarrative(articleContentHtml, errors);
    validateBrokenSentenceArtifacts(articleContentHtml, errors);
    validateAsideTitlesNotDuplicated(articleContentHtml, errors);
    validateRepeatedLongSentences(articleContentHtml, errors);
    const internalLinks = countInternalContextLinks(stripFaqBlock(articleContentHtml));
    if (internalLinks < 4) {
      errors.push(`Za mało linków kontekstowych w treści: ${internalLinks}/4.`);
    }
    validateAnswerFirstParagraphs(articleContentHtml, errors);
  }
  validateFaqResearchInBlogPosting(raw, errors);

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
