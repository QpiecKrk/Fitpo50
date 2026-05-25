const fs = require('fs');
const { POLICY, utils } = require('./article-policy');

function firstMatch(raw, regex) {
  const m = String(raw || '').match(regex);
  return m ? String(m[1] || '').trim() : '';
}

function validateArticleHeadContract(raw, opts = {}) {
  const errors = [];
  const warnings = [];
  const limits = {
    titleMax: POLICY.TITLE.MAX,
    descriptionMin: POLICY.WORDS.SEO_DESCRIPTION_MIN,
    descriptionMax: POLICY.WORDS.SEO_DESCRIPTION_MAX,
    ...opts,
  };

  const title = firstMatch(raw, /<title>([^<]+)<\/title>/i);
  const ogTitle = firstMatch(raw, /<meta\s+property="og:title"\s+content="([^"]*)"/i);
  const twitterTitle = firstMatch(raw, /<meta\s+name="twitter:title"\s+content="([^"]*)"/i);
  const ogImage = firstMatch(raw, /<meta\s+property="og:image"\s+content="([^"]*)"/i);
  const twitterImage = firstMatch(raw, /<meta\s+name="twitter:image"\s+content="([^"]*)"/i);
  if (!title) {
    errors.push('Brak tagu <title>.');
  } else {
    if (title.length > limits.titleMax) {
      errors.push(`<title> przekracza ${limits.titleMax} znaków (jest ${title.length}).`);
    }
    if (/\s[–-]\s*\|\s*fitpo50\s*$/i.test(title)) {
      errors.push('<title> ma podwójny separator przed "| FitPo50" (np. "– |").');
    }
  }

  if (ogTitle && /przewodnik\s*[–-]\s*praktyczny\s+przewodnik/i.test(ogTitle)) {
    warnings.push('Duplikacja frazy w tytule (np. "przewodnik – praktyczny przewodnik").');
  }
  if (twitterTitle && /przewodnik\s*[–-]\s*praktyczny\s+przewodnik/i.test(twitterTitle)) {
    warnings.push('Duplikacja frazy w twitter:title (np. "przewodnik – praktyczny przewodnik").');
  }

  const titleBase = title.replace(/\s*\|\s*FitPo50\s*$/i, '').trim();
  if (titleBase && ogTitle && titleBase !== ogTitle) {
    warnings.push('Niespójny tytuł: <title> (bez "| FitPo50") != og:title.');
  }
  if (titleBase && twitterTitle && titleBase !== twitterTitle) {
    warnings.push('Niespójny tytuł: <title> (bez "| FitPo50") != twitter:title.');
  }

  if (ogImage && !/\.jpg(?:\?|#|$)/i.test(ogImage)) {
    warnings.push('og:image powinno wskazywać plik .jpg (kompatybilność social scraperów).');
  }
  if (twitterImage && !/\.jpg(?:\?|#|$)/i.test(twitterImage)) {
    warnings.push('twitter:image powinno wskazywać plik .jpg (kompatybilność social scraperów).');
  }

  const metaDescription = firstMatch(raw, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const ogDescription = firstMatch(raw, /<meta\s+property="og:description"\s+content="([^"]*)"/i);
  const twitterDescription = firstMatch(raw, /<meta\s+name="twitter:description"\s+content="([^"]*)"/i);

  let schemaDescription = '';
  let blogPostingNode = null;
  let hasBreadcrumbList = false;
  const scripts = [...String(raw || '').matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const scriptMatch of scripts) {
    try {
      const parsed = JSON.parse(String(scriptMatch[1] || '').trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const type = node['@type'];
        const isBreadcrumb = type === 'BreadcrumbList' || (Array.isArray(type) && type.includes('BreadcrumbList'));
        if (isBreadcrumb) hasBreadcrumbList = true;
        const isBlogPosting = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
        if (!isBlogPosting) continue;
        if (!blogPostingNode) blogPostingNode = node;
        if (!schemaDescription) schemaDescription = String(node.description || '').trim();
      }
    } catch (_err) {
      // ignore invalid json-ld here; other validators handle it
    }
  }

  if (!metaDescription) {
    errors.push('Brak <meta name="description">.');
  } else {
    if (metaDescription.length < limits.descriptionMin || metaDescription.length > limits.descriptionMax) {
      errors.push(`meta description poza zakresem ${limits.descriptionMin}-${limits.descriptionMax} znaków (jest ${metaDescription.length}).`);
    }
    if (!/[.!?]$/.test(metaDescription)) {
      errors.push('meta description wygląda na urwany: powinien kończyć się ".", "!" lub "?".');
    }
  }

  if (!ogDescription) warnings.push('Brak og:description.');
  if (!twitterDescription) warnings.push('Brak twitter:description.');
  if (!schemaDescription) warnings.push('Brak BlogPosting.description w schema JSON-LD.');

  const articlePublishedTime = firstMatch(raw, /<meta\s+property="article:published_time"\s+content="([^"]*)"/i);
  const articleModifiedTime = firstMatch(raw, /<meta\s+property="article:modified_time"\s+content="([^"]*)"/i);
  if (!articlePublishedTime || !POLICY.PATTERNS.ISO_DATE_TZ.test(articlePublishedTime)) {
    errors.push('Brak lub niepoprawne article:published_time (wymagane pełne ISO 8601 z TZ).');
  }
  if (!articleModifiedTime || !POLICY.PATTERNS.ISO_DATE_TZ.test(articleModifiedTime)) {
    errors.push('Brak lub niepoprawne article:modified_time (wymagane pełne ISO 8601 z TZ).');
  }

  if (!blogPostingNode) {
    errors.push('Brak schema BlogPosting.');
  } else {
    const datePublished = String(blogPostingNode.datePublished || '').trim();
    const dateModified = String(blogPostingNode.dateModified || '').trim();
    if (!datePublished || !POLICY.PATTERNS.ISO_DATE_TZ.test(datePublished)) {
      errors.push('Brak lub niepoprawne BlogPosting.datePublished (wymagane pełne ISO 8601 z TZ).');
    }
    if (!dateModified || !POLICY.PATTERNS.ISO_DATE_TZ.test(dateModified)) {
      errors.push('Brak lub niepoprawne BlogPosting.dateModified (wymagane pełne ISO 8601 z TZ).');
    }
    const speakable = blogPostingNode.speakable && typeof blogPostingNode.speakable === 'object'
      ? blogPostingNode.speakable
      : null;
    const selectors = speakable
      ? (Array.isArray(speakable.cssSelector) ? speakable.cssSelector : [speakable.cssSelector]).filter(Boolean).map((s) => String(s).trim())
      : [];
    if (!selectors.length) {
      errors.push('Brak BlogPosting.speakable.cssSelector.');
    } else {
      const hasQuickAnswer = selectors.includes('#quick-answer') || selectors.includes('#quick-answer p');
      if (!hasQuickAnswer) errors.push('BlogPosting.speakable musi wskazywać #quick-answer lub #quick-answer p.');
    }
  }

  if (!hasBreadcrumbList) {
    errors.push('Brak schema BreadcrumbList.');
  }

  const normMeta = utils.strictNormalize(metaDescription);
  const normOg = utils.strictNormalize(ogDescription);
  const normTwitter = utils.strictNormalize(twitterDescription);
  const normSchema = utils.strictNormalize(schemaDescription);

  if (normMeta && normOg && normMeta !== normOg) {
    errors.push('Niespójny opis: meta description != og:description.');
  }
  if (normMeta && normTwitter && normMeta !== normTwitter) {
    errors.push('Niespójny opis: meta description != twitter:description.');
  }
  if (normMeta && normSchema && normMeta !== normSchema) {
    errors.push('Niespójny opis: meta description != BlogPosting.description.');
  }

  return { errors, warnings };
}

function validateArticleHeadFile(filePath, opts = {}) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return validateArticleHeadContract(raw, opts);
}

module.exports = {
  firstMatch,
  validateArticleHeadContract,
  validateArticleHeadFile,
};
