#!/usr/bin/env node

/**
 * Pre-deploy gate for FitPo50 static publishing.
 *
 * Usage:
 *   node scripts/predeploy-gate.js
 *   node scripts/predeploy-gate.js --slug post-przyklad
 *   node scripts/predeploy-gate.js --slug post-przyklad --asset assets/foo.jpg --asset _site/assets/foo.jpg
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = {
    assets: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--slug') {
      out.slug = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (t === '--asset') {
      out.assets.push(String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
  }
  return out;
}

function readUtf8(relPath) {
  const abs = path.join(ROOT, relPath);
  return fs.readFileSync(abs, 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readJson(relPath) {
  return JSON.parse(readUtf8(relPath));
}

function normalizeSlug(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  return s.endsWith('.html') ? s.slice(0, -5) : s;
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

function validateAnswerFirstParagraphs(articleContentHtml, strictErrors, softWarnings, relPath, strictMode) {
  const h2Rx = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2s = [...articleContentHtml.matchAll(h2Rx)];
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
    const sectionEnd = next ? next.index : articleContentHtml.length;
    const sectionHtml = articleContentHtml.slice(sectionStart, sectionEnd);
    const pMatch = sectionHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!pMatch) {
      const msg = `${relPath}: sekcja "${stripTags(current[1])}" nie ma akapitu otwierającego.`;
      if (strictMode) strictErrors.push(msg); else softWarnings.push(msg);
      continue;
    }
    checked += 1;
    const words = countWords(stripTags(pMatch[1]));
    if (words < 35 || words > 80) {
      const msg = `${relPath}: sekcja "${stripTags(current[1])}" ma pierwszy akapit poza zakresem 35-80 słów (${words}).`;
      if (strictMode) strictErrors.push(msg); else softWarnings.push(msg);
    }
  }

  if (checked === 0) {
    const msg = `${relPath}: brak sekcji H2 do walidacji answer-first.`;
    if (strictMode) strictErrors.push(msg); else softWarnings.push(msg);
  }
}

function validateArticleAeoGeo(relPath, errors, warnings, strictMode = false) {
  if (!exists(relPath)) {
    errors.push(`Brak pliku artykułu do walidacji AEO/GEO: ${relPath}`);
    return;
  }
  const html = readUtf8(relPath);
  const articleContentHtml = extractArticleContentHtml(html);
  if (!articleContentHtml) {
    errors.push(`${relPath}: brak <article class="article-content">.`);
    return;
  }
  const links = countInternalContextLinks(articleContentHtml);
  if (links < 4) {
    const msg = `${relPath}: za mało linków kontekstowych w treści (${links}/4).`;
    if (strictMode) errors.push(msg); else warnings.push(msg);
  }
  validateAnswerFirstParagraphs(articleContentHtml, errors, warnings, relPath, strictMode);

  const faqCount = (articleContentHtml.match(/<article\s+class="faq-item"/gi) || []).length;
  if (faqCount > 0 && faqCount < 4) {
    warnings.push(`${relPath}: sekcja FAQ ma mniej niż 4 odpowiedzi (${faqCount}).`);
  }
}

function extractLatestLink(indexHtml) {
  const m = indexHtml.match(/id="latestArticleLink"\s+href="([^"]+)"/i);
  return m ? m[1].trim() : '';
}

function extractReadingFallbackUrls(indexHtml) {
  const start = indexHtml.indexOf('function renderReadingFallback()');
  if (start === -1) return [];
  const end = indexHtml.indexOf('readingRoomGrid.innerHTML', start);
  if (end === -1) return [];
  const body = indexHtml.slice(start, end);
  const arrayMatch = body.match(/const fallback = \[([\s\S]*?)\]\s*;/i);
  if (!arrayMatch) return [];
  const block = arrayMatch[1];
  const urls = [];
  const rx = /url:\s*'((?:\\'|[^'])*)'/g;
  for (const m of block.matchAll(rx)) {
    urls.push(m[1].replace(/\\'/g, "'"));
  }
  return urls;
}

function extractPoradyCardCount(poradyHtml) {
  return (poradyHtml.match(/data-article-item\b/g) || []).length;
}

function extractPoradyBadgeCount(poradyHtml) {
  const m = poradyHtml.match(/data-article-count>(\d+)</i);
  return m ? Number(m[1]) : NaN;
}

function extractPoradySummaryCount(poradyHtml) {
  const m = poradyHtml.match(/data-catalog-summary>\s*(\d+)\s+artykuł/i);
  return m ? Number(m[1]) : NaN;
}

function hasInSitemap(sitemapXml, hrefOrUrl) {
  const localHref = String(hrefOrUrl || '').trim();
  if (!localHref) return false;
  if (/^https?:\/\//i.test(localHref)) return sitemapXml.includes(localHref);
  return sitemapXml.includes(`https://fitpo50.pl/${localHref}`);
}

function assertFileMirror(relPath, errors) {
  const source = relPath;
  const mirror = `_site/${relPath}`;
  if (!exists(source)) {
    errors.push(`Brak pliku source: ${source}`);
    return;
  }
  if (!exists(mirror)) {
    errors.push(`Brak pliku mirror: ${mirror}`);
    return;
  }
  const a = readUtf8(source);
  const b = readUtf8(mirror);
  if (a !== b) {
    errors.push(`Niespójnosc source vs _site: ${source} != ${mirror}`);
  }
}

function validatePublishedNewsImages(errors, warnings) {
  const candidates = ['data/news-live.json', '_site/data/news-live.json'];

  for (const rel of candidates) {
    if (!exists(rel)) {
      warnings.push(`Brak ${rel} — pomijam kontrolę miniatur NEWS.`);
      continue;
    }

    let parsed;
    try {
      parsed = readJson(rel);
    } catch (err) {
      errors.push(`${rel}: niepoprawny JSON (${err.message})`);
      continue;
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    for (const item of items) {
      if (!item || item.status !== 'published') continue;
      const imageBase = String(item.image_base || '').trim();
      if (!imageBase) continue;
      const sourceDir = 'assets/news';
      const siteDir = '_site/assets/news';
      const hasSourceVariant = ['jpg', 'webp', 'avif']
        .some((ext) => exists(`${sourceDir}/${imageBase}.${ext}`));
      const hasSiteVariant = ['jpg', 'webp', 'avif']
        .some((ext) => exists(`${siteDir}/${imageBase}.${ext}`));

      if (rel.startsWith('_site/')) {
        if (!hasSiteVariant && !hasSourceVariant) {
          const title = String(item.title || item.id || '(bez tytułu)');
          errors.push(`${rel}: opublikowany news "${title}" ma image_base="${imageBase}", ale brak plików miniatur w ${siteDir}/ oraz ${sourceDir}/`);
        } else if (!hasSiteVariant && hasSourceVariant) {
          const title = String(item.title || item.id || '(bez tytułu)');
          warnings.push(`${rel}: opublikowany news "${title}" ma miniatury tylko w ${sourceDir}/ (brak mirroru w ${siteDir}/).`);
        }
        continue;
      }

      if (!hasSourceVariant) {
        const title = String(item.title || item.id || '(bez tytułu)');
        errors.push(`${rel}: opublikowany news "${title}" ma image_base="${imageBase}", ale brak plików miniatur w ${sourceDir}/`);
      }
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const errors = [];
  const warnings = [];

  const requiredFiles = [
    'index.html',
    'porady.html',
    'sitemap.xml',
    'llms.txt',
    '_site/index.html',
    '_site/porady.html',
    '_site/sitemap.xml',
    '_site/llms.txt',
  ];
  for (const rel of requiredFiles) {
    if (!exists(rel)) errors.push(`Brak pliku: ${rel}`);
  }
  if (errors.length) {
    printAndExit(errors, warnings);
    return;
  }

  const indexHtml = readUtf8('index.html');
  const poradyHtml = readUtf8('porady.html');
  const sitemapXml = readUtf8('sitemap.xml');
  const llmsTxt = readUtf8('llms.txt');

  // 1) index latest + reading fallback (3 cards)
  const latestHref = extractLatestLink(indexHtml);
  if (!latestHref) {
    errors.push('Nie znaleziono latestArticleLink w index.html');
  }
  const fallbackUrls = extractReadingFallbackUrls(indexHtml);
  if (fallbackUrls.length !== 3) {
    errors.push(`renderReadingFallback na index.html ma ${fallbackUrls.length} URL-i (oczekiwane: 3).`);
  } else {
    const unique = new Set(fallbackUrls);
    if (unique.size !== 3) {
      errors.push('renderReadingFallback na index.html zawiera zduplikowane URL-e.');
    }
    if (latestHref && fallbackUrls[0] !== latestHref) {
      errors.push('Pierwszy kafelek fallbacku na index.html nie zgadza sie z latestArticleLink.');
    }
  }

  // 2) porady counters
  const cardCount = extractPoradyCardCount(poradyHtml);
  const badgeCount = extractPoradyBadgeCount(poradyHtml);
  const summaryCount = extractPoradySummaryCount(poradyHtml);
  if (!Number.isFinite(badgeCount)) {
    errors.push('Nie znaleziono data-article-count na porady.html');
  } else if (badgeCount !== cardCount) {
    errors.push(`Niespójnosc porady.html: data-article-count=${badgeCount}, kart data-article-item=${cardCount}.`);
  }
  if (!Number.isFinite(summaryCount)) {
    warnings.push('Nie znaleziono liczby w data-catalog-summary na porady.html');
  } else if (summaryCount !== cardCount) {
    errors.push(`Niespójnosc porady.html: data-catalog-summary=${summaryCount}, kart data-article-item=${cardCount}.`);
  }

  // 3) sitemap should include latest
  if (latestHref && !hasInSitemap(sitemapXml, latestHref)) {
    errors.push(`sitemap.xml nie zawiera latestArticleLink (${latestHref}).`);
  }

  // 4) llms should include latest URL
  if (latestHref && !llmsTxt.includes(`https://fitpo50.pl/${latestHref}`)) {
    warnings.push(`llms.txt nie zawiera latestArticleLink (${latestHref}).`);
  }

  // 5) source <-> _site mirror for critical files
  assertFileMirror('index.html', errors);
  assertFileMirror('porady.html', errors);
  assertFileMirror('sitemap.xml', errors);
  assertFileMirror('llms.txt', errors);

  // 6) AEO/GEO quality on latest article
  if (latestHref) {
    validateArticleAeoGeo(latestHref, errors, warnings, false);
    validateArticleAeoGeo(`_site/${latestHref}`, errors, warnings, false);
  }

  // 7) optional slug checks
  const slug = normalizeSlug(args.slug);
  if (slug) {
    const slugFile = `${slug}.html`;
    const slugMirror = `_site/${slug}.html`;
    if (!exists(slugFile)) errors.push(`Brak pliku artykulu: ${slugFile}`);
    if (!exists(slugMirror)) errors.push(`Brak pliku artykulu w _site: ${slugMirror}`);

    const slugNeedle = `${slug}.html`;
    if (!indexHtml.includes(slugNeedle)) warnings.push(`index.html nie zawiera "${slugNeedle}"`);
    if (!poradyHtml.includes(slugNeedle)) errors.push(`porady.html nie zawiera "${slugNeedle}"`);
    if (!hasInSitemap(sitemapXml, slugNeedle)) errors.push(`sitemap.xml nie zawiera "${slugNeedle}"`);
    if (!llmsTxt.includes(`https://fitpo50.pl/${slugNeedle}`)) warnings.push(`llms.txt nie zawiera "${slugNeedle}"`);
    validateArticleAeoGeo(slugFile, errors, warnings, true);
    validateArticleAeoGeo(slugMirror, errors, warnings, true);
  }

  // 8) optional asset existence checks
  for (const rel of args.assets) {
    if (!rel) continue;
    if (!exists(rel)) errors.push(`Brak assetu: ${rel}`);
  }

  // 9) published NEWS must have existing thumbnail files
  validatePublishedNewsImages(errors, warnings);

  printAndExit(errors, warnings);
}

function printAndExit(errors, warnings) {
  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL]');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }
  console.log('\n[PASS] Pre-deploy gate OK.');
}

main();
