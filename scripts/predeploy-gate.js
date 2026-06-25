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
const { validators, POLICY, utils } = require('./lib/article-policy');
const { categoryPageFromImportCategory } = require('./lib/categories');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = { assets: [], allowDistDrift: false, enforceDistFreshness: false };
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
    if (t === '--allow-dist-drift') {
      out.allowDistDrift = true;
      continue;
    }
    if (t === '--enforce-dist-freshness') {
      out.enforceDistFreshness = true;
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

function collectPhpFiles(relDir) {
  const dir = path.join(ROOT, relDir);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (rel.startsWith('admin/uploads')) continue;
        stack.push(abs);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.php') && rel !== 'admin/config.php') {
        out.push(rel);
      }
    }
  }
  return out.sort();
}

function validateAdminBootstrapGuard(errors) {
  if (!exists('admin/bootstrap.php')) {
    errors.push('Brak admin/bootstrap.php — panel nie ma ochrony przed białym ekranem przy braku config.php.');
    return;
  }

  const directConfigRequires = collectPhpFiles('admin')
    .filter((file) => !['admin/bootstrap.php', 'admin/config.example.php'].includes(file))
    .filter((file) => /require(?:_once)?\s+__DIR__\s*\.\s*['"](?:\/|\.\.\/)config\.php['"]/.test(readUtf8(file)));

  if (directConfigRequires.length) {
    errors.push(`Admin omija bootstrap i ładuje config.php bezpośrednio: ${directConfigRequires.join(', ')}`);
  }
}

function isRuntimeNewsThumb(imageBase) {
  return /^news_20/i.test(String(imageBase || '').trim());
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
  return extractReadingFallbackCards(indexHtml).map((item) => item.url);
}

function extractReadingFallbackCards(indexHtml) {
  const start = indexHtml.indexOf('function renderReadingFallback()');
  if (start === -1) return [];
  const end = indexHtml.indexOf('readingRoomGrid.innerHTML', start);
  if (end === -1) return [];
  const body = indexHtml.slice(start, end);
  const arrayMatch = body.match(/const fallback = \[([\s\S]*?)\]\s*;/i);
  if (!arrayMatch) return [];
  const block = arrayMatch[1];

  const cards = [];
  const rx = /\{\s*category:\s*'((?:\\'|[^'])*)',\s*title:\s*'((?:\\'|[^'])*)',\s*excerpt:\s*'((?:\\'|[^'])*)',\s*image:\s*'((?:\\'|[^'])*)',\s*url:\s*'((?:\\'|[^'])*)'\s*\}/gms;
  for (const m of block.matchAll(rx)) {
    cards.push({
      category: m[1].replace(/\\'/g, "'"),
      title: m[2].replace(/\\'/g, "'"),
      excerpt: m[3].replace(/\\'/g, "'"),
      image: m[4].replace(/\\'/g, "'"),
      url: m[5].replace(/\\'/g, "'"),
    });
  }
  return cards;
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

function normalizeArticleHref(href) {
  return String(href || '')
    .trim()
    .replace(/^\.\//, '')
    .replace(/[?#].*$/, '');
}

function readImportJsonBySlug(slug) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;
  const importDir = path.join(ROOT, 'data', 'import');
  if (!fs.existsSync(importDir)) return null;
  const files = fs.readdirSync(importDir).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(importDir, file), 'utf8'));
      if (String(parsed?.slug || '').trim() === normalizedSlug) return parsed;
    } catch (_) {
      continue;
    }
  }
  return null;
}

function inferHomepageCategoryFromListings(href) {
  const normalizedHref = normalizeArticleHref(href);
  if (!normalizedHref) return '';

  const categoryPages = [
    { file: 'zdrowie.html', label: 'Zdrowie' },
    { file: 'jedzenie.html', label: 'Jedzenie' },
    { file: 'rusz-sie.html', label: 'Ruch' },
    { file: 'ciekawe.html', label: 'Ciekawe' },
    { file: 'mity.html', label: 'Mity' },
  ];

  for (const page of categoryPages) {
    if (!exists(page.file)) continue;
    const html = readUtf8(page.file);
    const rx = new RegExp(`href=["'](?:\\.\\/)?${normalizedHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
    if (rx.test(html)) return page.label;
  }

  return '';
}

function normalizeImageBase(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutQuery = raw.replace(/[?#].*$/, '');
  const file = path.basename(withoutQuery);
  return file.replace(/\.(avif|webp|png|jpe?g)$/i, '');
}

function extractLatestArticleImage(indexHtml) {
  const match = indexHtml.match(/<img class="latest-article__bg" id="latestArticleImage"[^>]*src="([^"]+)"/i);
  return match ? String(match[1] || '').trim() : '';
}

function validateReadingFallbackCategories(indexHtml, errors, warnings) {
  const cards = extractReadingFallbackCards(indexHtml);
  cards.forEach((card, idx) => {
    const expected = inferHomepageCategoryFromListings(card.url);
    if (!expected) {
      warnings.push(`index.html: nie udało się ustalić kategorii dla kafelka Czytelni #${idx + 1} (${card.url}).`);
      return;
    }
    if (String(card.category || '').trim() !== expected) {
      errors.push(`index.html: kafelek Czytelni #${idx + 1} ma kategorię "${card.category}", ale ${card.url} należy do "${expected}".`);
    }
  });
}

function validateReadingFallbackImages(indexHtml, errors, warnings) {
  const cards = extractReadingFallbackCards(indexHtml);
  cards.forEach((card, idx) => {
    const normalizedHref = normalizeArticleHref(card.url);
    if (!normalizedHref || !exists(normalizedHref)) return;
    const articleHtml = readUtf8(normalizedHref);
    const articleHeroBase = normalizeImageBase(articleHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] || '');
    const cardImageBase = normalizeImageBase(card.image);
    if (!articleHeroBase) {
      warnings.push(`index.html: nie udało się ustalić hero artykułu dla kafelka Czytelni #${idx + 1} (${card.url}).`);
      return;
    }
    if (!cardImageBase) {
      errors.push(`index.html: kafelek Czytelni #${idx + 1} (${card.url}) nie ma poprawnego image.`);
      return;
    }
    if (articleHeroBase !== cardImageBase) {
      errors.push(`index.html: kafelek Czytelni #${idx + 1} ma obraz "${cardImageBase}", ale artykuł ${card.url} ma hero "${articleHeroBase}".`);
    }
  });
}

function validateArticleHeroConsistency(relPath, errors, warnings) {
  if (!exists(relPath)) return;
  const html = readUtf8(relPath);

  const preloadMatch = html.match(/<link\s+rel="preload"[^>]*as="image"[^>]*href="([^"]+)"/i);
  const heroBlockMatch = html.match(/<div class="article-hero[^"]*"[\s\S]*?<picture>([\s\S]*?)<\/picture>/i);
  const avifMatch = heroBlockMatch ? heroBlockMatch[1].match(/<source[^>]*srcset="([^"]+\.avif[^"]*)"/i) : null;
  const webpMatch = heroBlockMatch ? heroBlockMatch[1].match(/<source[^>]*srcset="([^"]+\.webp[^"]*)"/i) : null;
  const imgMatch = heroBlockMatch ? heroBlockMatch[1].match(/<img[^>]*src="([^"]+)"/i) : null;
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  const twitterMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
  const schemaMatch = html.match(/"image"\s*:\s*"([^"]+)"/i);

  const bases = [
    { label: 'preload hero', value: normalizeImageBase(preloadMatch ? preloadMatch[1] : '') },
    { label: 'hero source avif', value: normalizeImageBase(avifMatch ? avifMatch[1] : '') },
    { label: 'hero source webp', value: normalizeImageBase(webpMatch ? webpMatch[1] : '') },
    { label: 'hero img jpg', value: normalizeImageBase(imgMatch ? imgMatch[1] : '') },
    { label: 'og:image', value: normalizeImageBase(ogMatch ? ogMatch[1] : '') },
    { label: 'twitter:image', value: normalizeImageBase(twitterMatch ? twitterMatch[1] : '') },
    { label: 'BlogPosting.image', value: normalizeImageBase(schemaMatch ? schemaMatch[1] : '') },
  ];

  const missing = bases.filter((item) => !item.value);
  missing.forEach((item) => {
    errors.push(`${relPath}: brak pola hero w kontrakcie "${item.label}".`);
  });
  if (missing.length) return;

  const uniqueBases = Array.from(new Set(bases.map((item) => item.value)));
  if (uniqueBases.length > 1) {
    errors.push(`${relPath}: niespójny hero image między preload/source/img/social/schema (${bases.map((item) => `${item.label}=${item.value}`).join(', ')}).`);
  }

  if (!heroBlockMatch) {
    warnings.push(`${relPath}: nie znaleziono bloku .article-hero do kontroli spójności hero.`);
  }
}

function validateLatestArticleImage(indexHtml, latestHref, errors, warnings) {
  const normalizedHref = normalizeArticleHref(latestHref);
  if (!normalizedHref || !exists(normalizedHref)) return;
  const articleHtml = readUtf8(normalizedHref);
  const articleHeroBase = normalizeImageBase(articleHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] || '');
  const latestImageBase = normalizeImageBase(extractLatestArticleImage(indexHtml));
  if (!articleHeroBase) {
    warnings.push(`index.html: nie udało się ustalić hero artykułu dla latestArticle (${latestHref}).`);
    return;
  }
  if (!latestImageBase) {
    errors.push(`index.html: latestArticleImage nie ma poprawnego src dla ${latestHref}.`);
    return;
  }
  if (articleHeroBase !== latestImageBase) {
    errors.push(`index.html: latestArticleImage używa "${latestImageBase}", ale artykuł ${latestHref} ma hero "${articleHeroBase}".`);
  }
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

function assertDistFreshness(relPath, errors) {
  const mirror = `_site/${relPath}`;
  const srcAbs = path.join(ROOT, relPath);
  const mirrorAbs = path.join(ROOT, mirror);
  if (!fs.existsSync(srcAbs)) {
    errors.push(`Brak pliku source: ${relPath}`);
    return;
  }
  if (!fs.existsSync(mirrorAbs)) {
    errors.push(`Brak pliku mirror: ${mirror}`);
    return;
  }
  const srcMtime = fs.statSync(srcAbs).mtimeMs;
  const mirrorMtime = fs.statSync(mirrorAbs).mtimeMs;
  if (mirrorMtime + 1 < srcMtime) {
    errors.push(`Stary bundle w _site: ${mirror} jest starszy niz ${relPath} (uruchom export_site.sh).`);
  }
}

function validateReadingTimeLabels(errors) {
  const targets = [];
  for (const dir of ['.', '_site']) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const file of fs.readdirSync(absDir)) {
      if (!file.endsWith('.html')) continue;
      targets.push(path.join(absDir, file));
    }
  }

  for (const filePath of targets) {
    const rel = path.relative(ROOT, filePath);
    if (path.basename(rel) === 'article-template-bento.html') continue;
    const raw = fs.readFileSync(filePath, 'utf8');

    for (const match of raw.matchAll(/<span class="article-index-card__meta">([^<]+)<\/span>/g)) {
      const label = String(match[1] || '').replace(/\s+/g, ' ').trim();
      const res = validators.validateReadTimeLabel(label);
      if (!res.ok) {
        errors.push(`${rel}: ${res.error} (na karcie listingu)`);
      }
    }

    for (const match of raw.matchAll(/data-read-time="([^"]+)"/g)) {
      const label = String(match[1] || '').replace(/\s+/g, ' ').trim();
      const res = validators.validateReadTimeLabel(label);
      if (!res.ok) {
        errors.push(`${rel}: ${res.error} (w data-read-time)`);
      }
    }

    for (const match of raw.matchAll(/<p class="article-kicker-card__meta">[\s\S]*?<span class="article-kicker-card__category-pill">[\s\S]*?<\/span><span>([^<]+)<\/span><\/p>/g)) {
      const label = String(match[1] || '').replace(/\s+/g, ' ').trim();
      const res = validators.validateReadTimeLabel(label);
      if (!res.ok) {
        errors.push(`${rel}: ${res.error} (w hero meta)`);
      }
    }
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
      const hasSourceVariant = ['jpg', 'webp', 'avif'].every((ext) => exists(`${sourceDir}/${imageBase}.${ext}`));
      const hasSiteVariant = ['jpg', 'webp', 'avif'].every((ext) => exists(`${siteDir}/${imageBase}.${ext}`));

      const title = String(item.title || item.id || '(bez tytułu)');
      if (rel.startsWith('_site/')) {
        if (!hasSiteVariant && !hasSourceVariant) {
          errors.push(`${rel}: BLOKER NEWS: opublikowany news "${title}" ma image_base="${imageBase}", ale brak miniatur w ${siteDir}/ oraz ${sourceDir}/.`);
        } else if (!hasSiteVariant && hasSourceVariant) {
          warnings.push(`${rel}: WARN NEWS: opublikowany news "${title}" ma miniatury tylko w ${sourceDir}/ (brak mirroru w ${siteDir}/, akceptowane w CI/gitignore).`);
        }
        continue;
      }

      if (!hasSourceVariant) {
        errors.push(`${rel}: BLOKER NEWS: opublikowany news "${title}" ma image_base="${imageBase}", ale brak miniatur w ${sourceDir}/.`);
      }
    }
  }
}

function extractPublishedDateFromLdJson(raw) {
  const scripts = [...String(raw || '').matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
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
      const datePublished = String(node.datePublished || '').trim();
      if (datePublished) return datePublished;
    }
  }
  return '';
}

function isLegacyByPublishedAt(raw) {
  const cutoffRaw = String(POLICY.QUICK_ANSWER?.LEGACY_CUTOFF || '').trim();
  const cutoff = cutoffRaw ? new Date(`${cutoffRaw}T00:00:00+02:00`) : null;
  if (!cutoff || Number.isNaN(cutoff.getTime())) return false;
  const publishedMeta = raw.match(/<meta\s+property="article:published_time"\s+content="([^"]+)"/i)?.[1] || '';
  const publishedSchema = extractPublishedDateFromLdJson(raw);
  const publishedRaw = String(publishedMeta || publishedSchema || '').trim();
  if (!publishedRaw) return false;
  const publishedAt = new Date(publishedRaw);
  if (Number.isNaN(publishedAt.getTime())) return false;
  return publishedAt < cutoff;
}

function validateQuickAnswerPolicyForSlug(slugFile, errors, warnings) {
  if (!exists(slugFile)) return;
  const raw = readUtf8(slugFile);
  const articleHtml = raw.match(/<article\s+class="article-content">([\s\S]*?)<\/article>/i)?.[1] || '';
  const qaText = articleHtml.match(/<section\s+class="quick-answer[^"]*"[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
  if (!qaText) {
    errors.push(`${slugFile}: brak treści .quick-answer <p>.`);
    return;
  }
  const mode = isLegacyByPublishedAt(raw) ? 'legacy' : 'strict';
  const qaCheck = validators.validateQuickAnswer(utils.stripTags(qaText), { mode });
  qaCheck.errors.forEach((msg) => errors.push(`${slugFile}: ${msg}`));
  qaCheck.warnings.forEach((msg) => warnings.push(`${slugFile}: [LEGACY-BACKLOG] ${msg}`));
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
  validateReadingFallbackCategories(indexHtml, errors, warnings);
  validateReadingFallbackImages(indexHtml, errors, warnings);
  if (latestHref) {
    validateLatestArticleImage(indexHtml, latestHref, errors, warnings);
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
  assertFileMirror('mity.html', errors);
  assertFileMirror('sitemap.xml', errors);
  assertFileMirror('llms.txt', errors);
  if (!args.allowDistDrift && args.enforceDistFreshness) {
    assertDistFreshness('dist/app.js', errors);
    assertDistFreshness('dist/cmp.js', errors);
    assertDistFreshness('dist/footer.js', errors);
  }

  const slug = normalizeSlug(args.slug);
  if (slug) {
    const slugFile = `${slug}.html`;
    const slugMirror = `_site/${slug}.html`;
    if (!exists(slugFile)) errors.push(`Brak pliku artykulu: ${slugFile}`);
    if (!exists(slugMirror)) errors.push(`Brak pliku artykulu w _site: ${slugMirror}`);

    const slugNeedle = `${slug}.html`;
    const importJson = readImportJsonBySlug(slug);
    const categoryPage = categoryPageFromImportCategory(importJson?.category);
    if (!indexHtml.includes(slugNeedle)) warnings.push(`index.html nie zawiera "${slugNeedle}"`);
    if (!poradyHtml.includes(slugNeedle)) errors.push(`porady.html nie zawiera "${slugNeedle}"`);
    if (categoryPage) {
      if (!exists(categoryPage)) {
        errors.push(`Brak strony kategorii dla artykułu: ${categoryPage}`);
      } else if (!readUtf8(categoryPage).includes(slugNeedle)) {
        errors.push(`${categoryPage} nie zawiera "${slugNeedle}"`);
      }
      const categoryMirror = categoryPage ? `_site/${categoryPage}` : '';
      if (categoryMirror && !exists(categoryMirror)) {
        errors.push(`Brak mirroru strony kategorii: ${categoryMirror}`);
      } else if (categoryMirror && !readUtf8(categoryMirror).includes(slugNeedle)) {
        errors.push(`${categoryMirror} nie zawiera "${slugNeedle}"`);
      }
    } else {
      warnings.push(`Nie udało się ustalić strony kategorii dla sluga "${slug}" z data/import.`);
    }
    if (!hasInSitemap(sitemapXml, slugNeedle)) errors.push(`sitemap.xml nie zawiera "${slugNeedle}"`);
    if (!llmsTxt.includes(`https://fitpo50.pl/${slugNeedle}`)) warnings.push(`llms.txt nie zawiera "${slugNeedle}"`);

    if (exists(slugFile)) {
      const contract = validateArticleHeadFile(path.join(ROOT, slugFile));
      contract.errors.forEach((e) => errors.push(`${slugFile}: ${e}`));
      contract.warnings.forEach((w) => warnings.push(`${slugFile}: ${w}`));
      validateArticleHeroConsistency(slugFile, errors, warnings);
      validateQuickAnswerPolicyForSlug(slugFile, errors, warnings);
    }
  }

  for (const rel of args.assets) {
    if (rel && !exists(rel)) errors.push(`Brak assetu: ${rel}`);
  }

  validatePublishedNewsImages(errors, warnings);
  validateReadingTimeLabels(errors);
  validateAdminBootstrapGuard(errors);
  printAndExit(errors, warnings);
}

main();
