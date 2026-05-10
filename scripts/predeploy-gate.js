#!/usr/bin/env node

/**
 * Pre-deploy gate for FitPo50 static publishing (infrastructure only).
 *
 * Usage:
 *   node scripts/predeploy-gate.js
 *   node scripts/predeploy-gate.js --slug post-przyklad
 *   node scripts/predeploy-gate.js --slug post-przyklad --asset assets/foo.jpg --asset _site/assets/foo.jpg
 */

const fs = require('fs');
const path = require('path');
const { validateArticleHeadFile } = require('./lib/article-head-contract');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = { assets: [] };
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
    }
  }
  return out;
}

function readUtf8(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
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
  return m ? Number(m[1]) : Number.NaN;
}

function extractPoradySummaryCount(poradyHtml) {
  const m = poradyHtml.match(/data-catalog-summary>\s*(\d+)\s+artykuł/i);
  return m ? Number(m[1]) : Number.NaN;
}

function hasInSitemap(sitemapXml, hrefOrUrl) {
  const localHref = String(hrefOrUrl || '').trim();
  if (!localHref) return false;
  if (/^https?:\/\//i.test(localHref)) return sitemapXml.includes(localHref);
  return sitemapXml.includes(`https://fitpo50.pl/${localHref}`);
}

function assertFileMirror(relPath, errors) {
  const mirror = `_site/${relPath}`;
  if (!exists(relPath)) {
    errors.push(`Brak pliku source: ${relPath}`);
    return;
  }
  if (!exists(mirror)) {
    errors.push(`Brak pliku mirror: ${mirror}`);
    return;
  }
  if (readUtf8(relPath) !== readUtf8(mirror)) {
    errors.push(`Niespójnosc source vs _site: ${relPath} != ${mirror}`);
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
      const hasSourceVariant = ['jpg', 'webp', 'avif'].some((ext) => exists(`${sourceDir}/${imageBase}.${ext}`));
      const hasSiteVariant = ['jpg', 'webp', 'avif'].some((ext) => exists(`${siteDir}/${imageBase}.${ext}`));

      if (rel.startsWith('_site/')) {
        if (!hasSiteVariant && !hasSourceVariant) {
          const title = String(item.title || item.id || '(bez tytułu)');
          errors.push(`${rel}: opublikowany news "${title}" ma image_base="${imageBase}", ale brak miniatur w ${siteDir}/ oraz ${sourceDir}/`);
        } else if (!hasSiteVariant && hasSourceVariant) {
          const title = String(item.title || item.id || '(bez tytułu)');
          warnings.push(`${rel}: opublikowany news "${title}" ma miniatury tylko w ${sourceDir}/ (brak mirroru w ${siteDir}/).`);
        }
        continue;
      }

      if (!hasSourceVariant) {
        const title = String(item.title || item.id || '(bez tytułu)');
        errors.push(`${rel}: opublikowany news "${title}" ma image_base="${imageBase}", ale brak miniatur w ${sourceDir}/`);
      }
    }
  }
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

  const latestHref = extractLatestLink(indexHtml);
  if (!latestHref) {
    warnings.push('Nie znaleziono latestArticleLink w index.html (pomijam kontrolę "latest").');
  }

  const fallbackUrls = extractReadingFallbackUrls(indexHtml);
  if (fallbackUrls.length !== 3) {
    errors.push(`renderReadingFallback na index.html ma ${fallbackUrls.length} URL-i (oczekiwane: 3).`);
  } else {
    if (new Set(fallbackUrls).size !== 3) {
      errors.push('renderReadingFallback na index.html zawiera zduplikowane URL-e.');
    }
    if (latestHref && fallbackUrls[0] !== latestHref) {
      errors.push('Pierwszy kafelek fallbacku na index.html nie zgadza się z latestArticleLink.');
    }
  }

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

  if (latestHref && !hasInSitemap(sitemapXml, latestHref)) {
    errors.push(`sitemap.xml nie zawiera latestArticleLink (${latestHref}).`);
  }
  if (latestHref && !llmsTxt.includes(`https://fitpo50.pl/${latestHref}`)) {
    warnings.push(`llms.txt nie zawiera latestArticleLink (${latestHref}).`);
  }

  assertFileMirror('index.html', errors);
  assertFileMirror('porady.html', errors);
  assertFileMirror('sitemap.xml', errors);
  assertFileMirror('llms.txt', errors);

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

    if (exists(slugFile)) {
      const contract = validateArticleHeadFile(path.join(ROOT, slugFile));
      contract.errors.forEach((e) => errors.push(`${slugFile}: ${e}`));
      contract.warnings.forEach((w) => warnings.push(`${slugFile}: ${w}`));
    }
  }

  for (const rel of args.assets) {
    if (rel && !exists(rel)) errors.push(`Brak assetu: ${rel}`);
  }

  validatePublishedNewsImages(errors, warnings);
  printAndExit(errors, warnings);
}

main();
