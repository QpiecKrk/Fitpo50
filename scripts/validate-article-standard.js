#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { validateArticleHeadContract } = require('./lib/article-head-contract');
const { utils, validators, POLICY } = require('./lib/article-policy');

function getHtmlFiles() {
  return fs.readdirSync(process.cwd())
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html');
}

function isArticleHtml(content) {
  return /<body[^>]*class="[^"]*article-template[^"]*"/i.test(content);
}

// Narzędzia stripTags, countWords i normalizeText przeniesione do scripts/lib/article-policy.js

// Funkcja normalizeTextForCompare zastąpiona przez utils.fuzzyNormalize

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

  let checked = 0;
  for (let i = 0; i < h2s.length; i += 1) {
    const current = h2s[i];
    const next = h2s[i + 1];
    if (validators.isSkippedH2Title(current[1])) continue;

    const sectionStart = current.index + current[0].length;
    const sectionEnd = next ? next.index : raw.length;
    const sectionHtml = raw.slice(sectionStart, sectionEnd);
    const pMatch = sectionHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!pMatch) {
      errors.push(`Sekcja "${utils.stripTags(current[1])}" nie zawiera akapitu otwierającego <p>.`);
      continue;
    }
    checked += 1;
    const res = validators.validateIntroParagraph(pMatch[1]);
    if (!res.ok) {
      errors.push(`Sekcja "${utils.stripTags(current[1])}": ${res.error}`);
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
  const wc = utils.countWords(utils.stripTags(paragraphMatch[1]));
  if (wc < POLICY.WORDS.QUICK_ANSWER_MIN || wc > POLICY.WORDS.QUICK_ANSWER_MAX) {
    errors.push(`Szybka odpowiedź: wymagane ${POLICY.WORDS.QUICK_ANSWER_MIN}-${POLICY.WORDS.QUICK_ANSWER_MAX} słów (jest ${wc}).`);
  }

  const leadMatch = articleContentHtml.match(/<p class="drop-cap">([\s\S]*?)<\/p>/i);
  if (leadMatch) {
    const leadNorm = utils.fuzzyNormalize(utils.stripTags(leadMatch[1]));
    const quickNorm = utils.fuzzyNormalize(utils.stripTags(paragraphMatch[1]));
    if (leadNorm && quickNorm && leadNorm === quickNorm) {
      errors.push('Szybka odpowiedź nie może być kopią 1:1 pierwszego akapitu.');
    }
  }

  const quickNorm = utils.fuzzyNormalize(utils.stripTags(paragraphMatch[1]));
  for (const phrase of POLICY.GENERIC_QUICK_ANSWER_PATTERNS || []) {
    const needle = utils.fuzzyNormalize(phrase);
    if (needle && quickNorm.includes(needle)) {
      errors.push(`Szybka odpowiedź jest zbyt generyczna (fraza: "${phrase}").`);
      break;
    }
  }
}

function validateFaqQuestionsQuality(raw, errors) {
  const faqMatch = raw.match(/<section\s+class="faq-list\b[\s\S]*?<\/section>/i);
  if (!faqMatch) return;

  const questions = [...faqMatch[0].matchAll(/<article\s+class="faq-item"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi)]
    .map((m) => utils.stripTags(m[1]))
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!questions.length) return;

  const seen = new Map();
  for (const q of questions) {
    const norm = utils.fuzzyNormalize(q);
    if (!norm) continue;
    seen.set(norm, (seen.get(norm) || 0) + 1);
  }

  for (const [norm, count] of seen.entries()) {
    if (count > 1) {
      errors.push(`FAQ: wykryto powtarzalne pytanie (${count}x): "${norm.slice(0, 80)}".`);
      break;
    }
  }

  for (const q of questions) {
    const norm = utils.fuzzyNormalize(q);
    for (const generic of POLICY.GENERIC_FAQ_QUESTIONS || []) {
      if (norm === utils.fuzzyNormalize(generic)) {
        errors.push(`FAQ: generyczny nagłówek pytania "${q}" jest niedozwolony.`);
        return;
      }
    }
  }
}

function validateHeroShareContract(raw, errors) {
  if (!/class="hero-motto"/i.test(raw)) {
    errors.push('Brak .hero-motto pod hero.');
  }

  const actionsWrapMatch = raw.match(/<div[^>]*class="[^"]*\barticle-primary-actions\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!actionsWrapMatch) {
    errors.push('Brak wrappera .article-primary-actions pod hero.');
  } else {
    const actionsHtml = actionsWrapMatch[1];
    const hasPdfInsideActions = /<a[^>]*class="[^"]*\bpdf-hero-download\b[^"]*"[^>]*href="\.\/assets\/pdf\/[^"]+\.pdf"[^>]*>/i.test(actionsHtml)
      || /<a[^>]*href="\.\/assets\/pdf\/[^"]+\.pdf"[^>]*class="[^"]*\bpdf-hero-download\b[^"]*"[^>]*>/i.test(actionsHtml);
    if (!hasPdfInsideActions) {
      errors.push('Brak przycisku PDF wewnątrz .article-primary-actions.');
    }

    const hasShareInsideActions = /<button[^>]*id="share-article-top"[^>]*class="[^"]*\bpdf-hero-download--share\b[^"]*"[^>]*>/i.test(actionsHtml)
      || /<button[^>]*class="[^"]*\bpdf-hero-download--share\b[^"]*"[^>]*id="share-article-top"[^>]*>/i.test(actionsHtml);
    if (!hasShareInsideActions) {
      errors.push('Brak przycisku share wewnątrz .article-primary-actions.');
    }
  }

  const hasShareTopButton = /<button[^>]*id="share-article-top"[^>]*class="[^"]*\bpdf-hero-download--share\b[^"]*"[^>]*>/i.test(raw)
    || /<button[^>]*class="[^"]*\bpdf-hero-download--share\b[^"]*"[^>]*id="share-article-top"[^>]*>/i.test(raw);
  if (!hasShareTopButton) {
    errors.push('Brak przycisku "Udostępnij" pod hero (#share-article-top).');
  }

  if (!/class="[^"]*\bpdf-hero-download__badge--share\b[^"]*"/i.test(raw)) {
    errors.push('Brak badge SHARE w przycisku udostępniania pod hero.');
  }

  const shareSectionMatch = raw.match(/<section[^>]*class="[^"]*\bshare-article-section\b[^"]*"[\s\S]*?<\/section>/i);
  if (!shareSectionMatch) {
    errors.push('Brak sekcji .share-article-section przed Źródłami.');
    return;
  }

  if (!/<h[23][^>]*>\s*Udostępnij artykuł\s*<\/h[23]>/i.test(shareSectionMatch[0])) {
    errors.push('Sekcja share musi zawierać nagłówek "Udostępnij artykuł".');
  }

  const requiredNetworks = ['facebook', 'linkedin', 'whatsapp', 'mail', 'copy'];
  for (const network of requiredNetworks) {
    const networkRx = new RegExp(`data-share-network="${network}"`, 'i');
    if (!networkRx.test(shareSectionMatch[0])) {
      errors.push(`Sekcja share: brak kanału ${network}.`);
    }
  }

  const shareIndex = raw.search(/<section[^>]*class="[^"]*\bshare-article-section\b[^"]*"/i);
  const sourcesIndex = raw.search(/<(h2|h3)\s+id="zrodla">/i);
  if (shareIndex !== -1 && sourcesIndex !== -1 && shareIndex > sourcesIndex) {
    errors.push('Sekcja "Udostępnij artykuł" musi być przed sekcją Źródła.');
  }
}

function validateQuestionHeadings(articleContentHtml, errors) {
  const h2Rx = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  for (const m of articleContentHtml.matchAll(h2Rx)) {
    const titleRaw = utils.stripTags(m[1]);
    const res = validators.validateH2Title(titleRaw);
    if (!res.ok) {
      errors.push(res.error);
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
    .map((m) => utils.fuzzyNormalize(utils.stripTags(m[1])))
    .filter(Boolean);
  const h2Set = new Set(h2Titles);

  const asides = [...articleContentHtml.matchAll(/<aside\b[^>]*class="[^"]*\bhighlight-box\b[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
  for (const a of asides) {
    let title = utils.fuzzyNormalize(utils.stripTags(a[1]));
    title = title.replace(/^wazne:\s*/i, '');
    if (!title) continue;
    if (h2Set.has(title)) {
      errors.push(`Boks aside dubluje nagłówek H2: "${utils.stripTags(a[1]).trim()}".`);
      break;
    }
  }
}

function validateRepeatedLongSentences(articleContentHtml, errors) {
  const repeated = utils.collectRepeatedLongSentences(articleContentHtml);
  if (repeated.length) {
    errors.push(`Wykryto zdanie powtórzone ${repeated[0].count}x: "${repeated[0].sentence.slice(0, 90)}..."`);
  }
}

function validateBannedEditorialPhrases(articleContentHtml, errors) {
  const normalized = utils.fuzzyNormalize(utils.stripTags(articleContentHtml));
  for (const phrase of POLICY.BANNED_EDITORIAL_PHRASES || []) {
    const needle = utils.fuzzyNormalize(phrase);
    if (needle && normalized.includes(needle)) {
      errors.push(`Wykryto niedozwoloną frazę szablonową: "${phrase}".`);
      break;
    }
  }
}


function validateCitationsInBlogPosting(raw, errors) {
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
      const arr = Array.isArray(node.citation) ? node.citation : [];
      const valid = arr.filter((url) => /^https?:\/\//i.test(String(url || '').trim()));
      if (valid.length < POLICY.WORDS.CITATION_MIN_URLS) {
        errors.push(`BlogPosting.citation: wymagane minimum ${POLICY.WORDS.CITATION_MIN_URLS} poprawne URL-e (jest ${valid.length}).`);
      }
      return;
    }
  }
  errors.push('Brak schema BlogPosting do walidacji citation.');
}

function validateSpeakableTargetsQuickAnswer(raw, errors) {
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

      const speakable = node.speakable && typeof node.speakable === 'object' ? node.speakable : {};
      const selectors = Array.isArray(speakable.cssSelector)
        ? speakable.cssSelector.map((x) => String(x || '').trim())
        : [];
      const hasQuickAnswerSelector = selectors.includes('#quick-answer')
        || selectors.includes('#quick-answer p')
        || selectors.includes('.quick-answer');
      if (!hasQuickAnswerSelector) {
        errors.push('BlogPosting.speakable musi wskazywać sekcję quick-answer (#quick-answer lub #quick-answer p).');
      }
      return;
    }
  }
  errors.push('Brak schema BlogPosting do walidacji speakable.');
}

function validateBlogPostingAuthorIsPerson(raw, errors) {
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

      const author = node.author;
      if (!author || typeof author !== 'object' || Array.isArray(author)) {
        errors.push('BlogPosting.author musi być obiektem Person.');
        return;
      }
      const authorType = String(author['@type'] || '').trim();
      const authorName = String(author.name || '').trim();
      if (authorType !== 'Person') {
        errors.push(`BlogPosting.author ma niedozwolony typ "${authorType}" (wymagane Person).`);
      }
      if (!authorName || /fitpo50/i.test(authorName)) {
        errors.push('BlogPosting.author musi wskazywać realnego autora (Person), nie nazwę serwisu.');
      }
      return;
    }
  }
  errors.push('Brak schema BlogPosting do walidacji autora.');
}


function validateHeadSeoConsistency(raw, errors) {
  const res = validateArticleHeadContract(raw);
  errors.push(...res.errors);
}

function validateFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const errors = [];
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
  if (metaPublished && !POLICY.PATTERNS.ISO_DATE_TZ.test(metaPublished[1])) {
    errors.push('article:published_time musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T08:00:00+02:00)');
  }
  const metaModified = raw.match(/<meta\s+property="article:modified_time"\s+content="([^"]+)"/i);
  if (metaModified && !POLICY.PATTERNS.ISO_DATE_TZ.test(metaModified[1])) {
    errors.push('article:modified_time musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T09:30:00+02:00)');
  }

  for (const m of raw.matchAll(/"datePublished"\s*:\s*"([^"]+)"/g)) {
    if (!POLICY.PATTERNS.ISO_DATE_TZ.test(m[1])) {
      errors.push('BlogPosting.datePublished musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T08:00:00+02:00)');
      break;
    }
  }
  for (const m of raw.matchAll(/"dateModified"\s*:\s*"([^"]+)"/g)) {
    if (!POLICY.PATTERNS.ISO_DATE_TZ.test(m[1])) {
      errors.push('BlogPosting.dateModified musi być w ISO 8601 z godziną i strefą (np. 2026-04-24T09:30:00+02:00)');
      break;
    }
  }

  const articleContentHtml = extractArticleContentHtml(raw);
  if (!articleContentHtml) {
    errors.push('Brak <article class="article-content"> do walidacji AEO/GEO.');
  } else {
    validateQuickAnswerBlock(articleContentHtml, errors);
    validateFaqQuestionsQuality(raw, errors);
    validateQuestionHeadings(articleContentHtml, errors);
    validateInlineFiguresUsePicture(articleContentHtml, errors);
    validateNoAbsoluteInternalLinksInNarrative(articleContentHtml, errors);
    validateBrokenSentenceArtifacts(articleContentHtml, errors);
    validateAsideTitlesNotDuplicated(articleContentHtml, errors);
    validateRepeatedLongSentences(articleContentHtml, errors);
    validateBannedEditorialPhrases(articleContentHtml, errors);
    const internalLinks = utils.countInternalHtmlLinks(stripFaqBlock(articleContentHtml));
    if (internalLinks < POLICY.WORDS.INTERNAL_LINKS_MIN) {
      errors.push(`Za mało linków kontekstowych w treści: ${internalLinks}/${POLICY.WORDS.INTERNAL_LINKS_MIN}.`);
    }
    validateAnswerFirstParagraphs(articleContentHtml, errors);
  }
  validateHeroShareContract(raw, errors);
  validateCitationsInBlogPosting(raw, errors);
  validateSpeakableTargetsQuickAnswer(raw, errors);
  validateBlogPostingAuthorIsPerson(raw, errors);

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
