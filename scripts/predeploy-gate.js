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

  // 6) optional slug checks
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
  }

  // 7) optional asset existence checks
  for (const rel of args.assets) {
    if (!rel) continue;
    if (!exists(rel)) errors.push(`Brak assetu: ${rel}`);
  }

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
