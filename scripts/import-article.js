#!/usr/bin/env node

/**
 * FitPo50 JSON Article Importer (.fitpo50.json)
 *
 * Purpose:
 * - Build full Bento article HTML from JSON input
 * - Keep article flow fast and safe
 * - NEVER modify Bento News data or thumbnails
 *
 * Usage examples:
 *   node scripts/import-article.js --file "/path/to/article.fitpo50.json" --publish true
 *   node scripts/import-article.js --file "/path/to/article.fitpo50.json" --dry-run true
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'article-template-bento.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const LLMS_PATH = path.join(ROOT, 'llms.txt');
const READING_ROOM_FALLBACKS = [
  {
    url: 'ukryty-cukier-po-50-pulapki-zdrowego-jedzenia.html',
    image: 'ukryty-cukier-nazwy-etykiety-infografika',
    alt: 'Ukryty cukier na etykietach produktów',
    category: 'jedzenie',
    time: '12 min',
    title: 'Ukryty cukier po 50: pułapki zdrowego jedzenia',
    description: 'Poznaj najczęstsze nazwy cukru na etykietach i naucz się wyłapywać marketingowe triki.',
  },
  {
    url: 'jak-zaczac-na-silowni-po-50.html',
    image: 'poczatek-hero',
    alt: 'Jak zacząć trening siłowy po 50 roku życia',
    category: 'ruch',
    time: '10 min',
    title: 'Jak zacząć na siłowni po 50 i nie zrezygnować po 3 tygodniach',
    description: 'Prosty plan startu krok po kroku: bez chaosu, bez kontuzji i bez presji na szybkie efekty.',
  },
  {
    url: 'dieta-po-50.html',
    image: 'dieta-hero',
    alt: 'Podstawy diety po 50 bez skrajnych zasad',
    category: 'jedzenie',
    time: '11 min',
    title: 'Dieta po 50: prosty system, który da się utrzymać na co dzień',
    description: 'Najważniejsze zasady odżywiania po 50-tce: co jeść, jak planować i czego nie komplikować.',
  },
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = 'true';
      } else {
        out[key] = next;
        i += 1;
      }
      continue;
    }

    if (!out.file) {
      out.file = token;
    }
  }
  return out;
}

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/import-article.js --file "/path/to/article.fitpo50.json" [options]',
    '',
    'Options:',
    '  --precheck true|false           only validate input (default: false)',
    '  --dry-run true|false            do not write files (default: false)',
    '  --publish true|false            update listings/sitemap/llms (default: true)',
    '  --sync-site true|false          mirror changes to _site (default: true)',
    '  --run-internal-links true|false run PHP internal-link helper (default: false)',
    '  --validate true|false           run article validator (default: true)',
    '  --force true|false              overwrite existing article HTML (default: false)',
    '  --category <key>                override JSON category',
    '  --help                          show this help',
    '',
    'Recommended publish command:',
    '  node scripts/import-article.js --file "...fitpo50.json" --publish true --run-internal-links false --validate true',
  ].join('\n'));
}

function boolOpt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureParagraphHtml(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^<p[\s>]/i.test(raw)) return raw;
  if (/<[a-z][\s\S]*>/i.test(raw)) return `<p>${raw}</p>`;
  return `<p>${escapeHtml(raw)}</p>`;
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWarsawOffset(dateStr) {
  try {
    const probeUtc = new Date(`${dateStr}T12:00:00Z`);
    const tzValue = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Warsaw',
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(probeUtc).find((p) => p.type === 'timeZoneName')?.value || 'GMT+2';

    const m = tzValue.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
    if (!m) return '+02:00';
    const sign = m[1];
    const hh = String(m[2]).padStart(2, '0');
    const mm = String(m[3] || '00').padStart(2, '0');
    return `${sign}${hh}:${mm}`;
  } catch (_err) {
    return '+02:00';
  }
}

function toIsoDateTimeWithTimezone(input, fallbackTime) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T${fallbackTime}${getWarsawOffset(raw)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const datePart = raw.slice(0, 10);
    return `${raw}${getWarsawOffset(datePart)}`;
  }
  return raw;
}

function toIsoDuration(readingTime) {
  const m = String(readingTime || '').match(/(\d+)/);
  const mins = m ? Number(m[1]) : 11;
  return `PT${Math.max(1, mins)}M`;
}

function truncateAtWordBoundary(text, maxChars) {
  const value = String(text || '').trim();
  if (!value) return '';
  if (value.length <= maxChars) return value;
  const slice = value.slice(0, maxChars + 1);
  const cut = slice.lastIndexOf(' ');
  if (cut >= Math.floor(maxChars * 0.6)) {
    return slice.slice(0, cut).trim();
  }
  return value.slice(0, maxChars).trim();
}

function normalizeSeoTitleBase(rawTitle) {
  const clean = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  return truncateAtWordBoundary(clean, 53);
}

function buildSpeakableSelectors(hasKeyTakeaways) {
  const selectors = ['.article-header__title', '.drop-cap'];
  if (hasKeyTakeaways) {
    selectors.push('.key-takeaways h2', '.key-takeaways li');
  }
  return selectors;
}

function countWordsUtf8(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function normalizeCategory(input) {
  const v = String(input || '').toLowerCase().trim();
  if (['ruch', 'rusz-sie', 'rusz_sie'].includes(v)) return { key: 'ruch', label: 'Ruch' };
  if (['jedzenie', 'dieta'].includes(v)) return { key: 'jedzenie', label: 'Jedzenie' };
  if (['zdrowie', 'zdrowie-po-50'].includes(v)) return { key: 'zdrowie', label: 'Zdrowie' };
  if (['ciekawe', 'lifestyle'].includes(v)) return { key: 'ciekawe', label: 'Ciekawe' };
  return { key: 'ciekawe', label: 'Ciekawe' };
}

function parseJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Plik JSON nie zawiera obiektu na poziomie głównym.');
  }
  return parsed;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeSources(rawSources) {
  const out = [];
  for (const item of normalizeArray(rawSources)) {
    if (typeof item === 'string') {
      const url = String(item).trim();
      if (/^https?:\/\//i.test(url)) {
        out.push({ label: '', url });
      }
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const label = String(item.label || item.name || '').trim();
    const url = String(item.url || item.href || '').trim();
    if (!label || !url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({ label, url });
  }
  return out;
}

function isGenericSourceLabel(label) {
  const value = String(label || '').trim().toLowerCase();
  if (!value) return true;
  return /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value);
}

function normalizeFaq(raw) {
  const out = [];
  for (const item of normalizeArray(raw)) {
    if (!item || typeof item !== 'object') continue;
    const question = String(item.question || item.q || item.title || '').trim();
    const answerHtml = String(item.answer_html || item.answerHtml || item.answer || '').trim();
    if (!question || !answerHtml) continue;
    out.push({ question, answerHtml });
  }
  return out;
}

function normalizeKeyTakeaways(raw) {
  const out = [];
  for (const item of normalizeArray(raw)) {
    const value = String(item || '').trim();
    if (value) out.push(value);
  }
  return out;
}

function normalizeSections(rawSections) {
  const sections = [];
  for (const entry of normalizeArray(rawSections)) {
    if (!entry || typeof entry !== 'object') continue;

    const title = String(entry.title || entry.heading || '').trim();
    const blocks = [];

    if (entry.content_html) {
      blocks.push({ type: 'html', html: String(entry.content_html) });
    }

    for (const paragraph of normalizeArray(entry.paragraphs_html || entry.paragraphs || [])) {
      blocks.push({ type: 'paragraph', html: ensureParagraphHtml(paragraph) });
    }

    if (Array.isArray(entry.list_items) && entry.list_items.length) {
      const listItems = entry.list_items
        .map((li) => String(li || '').trim())
        .filter(Boolean)
        .map((li) => `<li>${escapeHtml(li)}</li>`)
        .join('');
      blocks.push({ type: 'html', html: `<ul>${listItems}</ul>` });
    }

    if (entry.info_box && typeof entry.info_box === 'object') {
      const style = String(entry.info_box.style || 'primary').toLowerCase() === 'accent'
        ? 'highlight-box highlight-box--accent'
        : 'highlight-box';
      const boxTitle = String(entry.info_box.title || '').trim();
      const boxHtml = String(entry.info_box.content_html || entry.info_box.html || entry.info_box.content || '').trim();
      if (boxTitle || boxHtml) {
        blocks.push({
          type: 'html',
          html: `<aside class="${style}">${boxTitle ? `<h3>${escapeHtml(boxTitle)}</h3>` : ''}${boxHtml ? ensureParagraphHtml(boxHtml) : ''}</aside>`,
        });
      }
    }

    if (entry.image && typeof entry.image === 'object') {
      const imgSrc = String(entry.image.src || entry.image.path || '').trim();
      const imgAlt = String(entry.image.alt || title || 'Grafika artykułu').trim();
      const imgCaption = String(entry.image.caption || '').trim();
      if (imgSrc) {
        const safeSrc = escapeHtml(imgSrc);
        blocks.push({
          type: 'html',
          html: `<figure class="inline-figure"><img src="${safeSrc}" alt="${escapeHtml(imgAlt)}" loading="lazy">${imgCaption ? `<figcaption>${escapeHtml(imgCaption)}</figcaption>` : ''}</figure>`,
        });
      }
    }

    sections.push({ title, blocks });
  }
  return sections;
}

function countInternalHtmlLinks(htmlChunks) {
  const unique = new Set();
  const rx = /<a\b[^>]*href="([^"]+)"/gi;
  for (const chunk of normalizeArray(htmlChunks)) {
    const html = String(chunk || '');
    for (const m of html.matchAll(rx)) {
      const href = String(m[1] || '').trim();
      if (!href) continue;
      if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
      if (!/\.html(?:[?#].*)?$/i.test(href)) continue;
      if (/^\.?\/?porady\.html(?:[?#].*)?$/i.test(href)) continue;
      unique.add(href.replace(/^\.\//, ''));
    }
  }
  return unique.size;
}

function validateInput(data) {
  const errors = [];
  const title = String(data.title || '').trim();
  if (!title) errors.push('Brak pola title.');

  const lead = String(data.lead || data.lead_paragraph || '').trim();
  if (!lead) errors.push('Brak pola lead / lead_paragraph.');

  const sections = normalizeSections(data.sections || []);
  if (!sections.length) errors.push('Brak sekcji: sections[].');
  if (sections.length > 0) {
    const sectionParagraphErrors = [];
    for (const section of sections) {
      const firstParagraph = section.blocks.find((b) => b.type === 'paragraph' && String(b.html || '').trim());
      if (!firstParagraph) {
        sectionParagraphErrors.push(`Sekcja "${section.title || '(bez tytułu)'}" nie ma akapitu otwierającego.`);
        continue;
      }
      const words = countWordsUtf8(stripTags(firstParagraph.html));
      if (words < 35 || words > 80) {
        sectionParagraphErrors.push(
          `Sekcja "${section.title || '(bez tytułu)'}": pierwszy akapit powinien mieć 35-80 słów (ma ${words}).`
        );
      }
    }
    errors.push(...sectionParagraphErrors);

    const linkSource = [];
    for (const section of sections) {
      for (const block of section.blocks) {
        if (block.type === 'paragraph' || block.type === 'html') {
          linkSource.push(block.html || '');
        }
      }
    }
    const internalLinks = countInternalHtmlLinks(linkSource);
    if (internalLinks < 4) {
      errors.push(`AEO/GEO: dodaj minimum 4 linki wewnętrzne w treści sekcji (obecnie: ${internalLinks}).`);
    }
  }
  const keyTakeaways = normalizeKeyTakeaways(data.key_takeaways || data.takeaways || []);
  if (keyTakeaways.length < 3) {
    errors.push('AEO: dodaj minimum 3 elementy w key_takeaways[] (sekcja "Kluczowe wnioski").');
  }

  const rawSources = normalizeArray(data.sources || []);
  const sources = normalizeSources(rawSources);
  if (!sources.length) errors.push('Brak poprawnych źródeł: sources[].');
  for (let i = 0; i < rawSources.length; i += 1) {
    const item = rawSources[i];
    const idx = i + 1;
    if (typeof item === 'string') {
      errors.push(`Źródło #${idx}: podaj obiekt { "label", "url" } zamiast samego URL.`);
      continue;
    }
    if (!item || typeof item !== 'object') {
      errors.push(`Źródło #${idx}: niepoprawny format (wymagany obiekt).`);
      continue;
    }
    const label = String(item.label || item.name || '').trim();
    const url = String(item.url || item.href || '').trim();
    if (!label) errors.push(`Źródło #${idx}: brak label (nazwa źródła).`);
    if (!url) errors.push(`Źródło #${idx}: brak url.`);
    if (url && !/^https?:\/\//i.test(url)) errors.push(`Źródło #${idx}: url musi zaczynać się od http:// lub https://.`);
    if (label && isGenericSourceLabel(label)) {
      errors.push(`Źródło #${idx}: label "${label}" jest zbyt ogólny. Podaj pełną nazwę źródła.`);
    }
  }

  return { errors, sections, sources };
}

function collectMissingHeroAssets(heroImageBase, syncSite) {
  const base = String(heroImageBase || '').trim();
  if (!base) {
    return ['hero_image (puste)'];
  }

  const requiredExt = ['avif', 'webp', 'jpg'];
  const missing = [];

  for (const ext of requiredExt) {
    const mainPath = path.join(ROOT, 'assets', `${base}.${ext}`);
    if (!fs.existsSync(mainPath)) {
      missing.push(path.relative(ROOT, mainPath));
    }

    if (syncSite) {
      const siteAssetsDir = path.join(ROOT, '_site', 'assets');
      if (fs.existsSync(siteAssetsDir)) {
        const sitePath = path.join(siteAssetsDir, `${base}.${ext}`);
        if (!fs.existsSync(sitePath)) {
          missing.push(path.relative(ROOT, sitePath));
        }
      }
    }
  }

  return missing;
}

function ensureHeroAssetsExist(heroImageBase, syncSite) {
  const base = String(heroImageBase || '').trim();
  const missing = collectMissingHeroAssets(base, syncSite);
  if (missing.length > 0) {
    throw new Error(
      `Brakuje plików hero dla "${base}": ${missing.join(', ')}. ` +
      'Uzupełnij te grafiki albo ustaw poprawne hero_image w JSON.'
    );
  }
}

function buildPrecheckReport({ inputPath, json, payload, validation, syncSite }) {
  const autoFixes = [];
  const blockers = [];

  if (!String(json.slug || '').trim() && payload.slug) {
    autoFixes.push(`Brak slug w JSON -> uzupełnię automatycznie: "${payload.slug}"`);
  }
  if (!String(json.meta_description || json.description || '').trim()) {
    autoFixes.push('Brak meta_description -> uzupełnię automatycznie z lead/excerpt');
  }
  if (!String(json.reading_time || json.readingTime || '').trim()) {
    autoFixes.push(`Brak reading_time -> użyję domyślnego: "${payload.readingTime}"`);
  }
  if (!String(json.hero_image || json.heroImage || '').trim()) {
    autoFixes.push(`Brak hero_image -> użyję fallback: "${payload.heroImage}"`);
  }
  const rawSeoBase = String(json.seo_title || json.title || '').replace(/\s+/g, ' ').trim();
  if (rawSeoBase && rawSeoBase !== payload.seoTitleBase) {
    autoFixes.push(`Skrócę seo_title do bezpiecznej długości (<=53 znaki): "${payload.seoTitleBase}"`);
  }

  for (const err of validation.errors) {
    blockers.push(err);
  }

  if (!payload.slug) {
    blockers.push('Nie udało się wyznaczyć slug (title/slug puste).');
  }

  const heroMissing = collectMissingHeroAssets(payload.heroImage, syncSite);
  if (heroMissing.length > 0) {
    blockers.push(`Brak plików hero_image (${payload.heroImage}): ${heroMissing.join(', ')}`);
  }

  const canImport = blockers.length === 0;
  const declaration = canImport
    ? 'TAK - mogę poprawić pola automatyczne i zaimportować artykuł tym importerem.'
    : 'NIE - najpierw trzeba poprawić błędy blokujące (lista poniżej).';

  return {
    inputPath,
    slug: payload.slug || '(brak)',
    heroImage: payload.heroImage || '(brak)',
    sectionCount: payload.sections.length,
    sourceCount: payload.sources.length,
    faqCount: payload.faqItems.length,
    photosOk: heroMissing.length === 0,
    heroMissing,
    autoFixes,
    blockers,
    canImport,
    declaration,
  };
}

function printPrecheckReport(report) {
  console.log('\n=== Precheck JSON (.fitpo50.json) ===');
  console.log(`Plik: ${report.inputPath}`);
  console.log(`Slug: ${report.slug}`);
  console.log(`Hero image: ${report.heroImage}`);
  console.log(`Sekcje: ${report.sectionCount} | Źródła: ${report.sourceCount} | FAQ: ${report.faqCount}`);
  console.log(`Zdjęcia hero OK: ${report.photosOk ? 'TAK' : 'NIE'}`);

  if (report.heroMissing.length) {
    console.log(`Braki hero: ${report.heroMissing.join(', ')}`);
  }

  if (report.autoFixes.length) {
    console.log('Auto-poprawki, które wykonam:');
    for (const item of report.autoFixes) {
      console.log(`- ${item}`);
    }
  } else {
    console.log('Auto-poprawki, które wykonam: brak (JSON już jest kompletny).');
  }

  if (report.blockers.length) {
    console.log('Błędy blokujące import:');
    for (const err of report.blockers) {
      console.log(`- ${err}`);
    }
  } else {
    console.log('Błędy blokujące import: brak.');
  }

  console.log(`Oświadczenie: ${report.declaration}`);
  console.log(`Czy mogę użyć importera teraz: ${report.canImport ? 'TAK' : 'NIE'}`);
}

function replaceAllPlaceholders(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(`{{${key}}}`).join(String(value));
  }
  return html;
}

function renderKeyTakeawaysBlock(items) {
  if (!items.length) return '';
  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');
  return [
    '<section class="key-takeaways reveal" data-ai-summary="auto" aria-label="Kluczowe wnioski">',
    '  <h2>Kluczowe wnioski</h2>',
    `  <ul>${list}</ul>`,
    '</section>',
  ].join('\n');
}

function renderSectionsHtml(sections) {
  const chunks = [];

  for (const section of sections) {
    if (section.title) {
      chunks.push(`<h2>${escapeHtml(section.title)}</h2>`);
    }

    for (const block of section.blocks) {
      if (block.type === 'paragraph') {
        if (block.html) chunks.push(block.html);
        continue;
      }
      if (block.type === 'html') {
        if (block.html) chunks.push(block.html);
      }
    }
  }

  return chunks.join('\n\n');
}

function renderFaqList(faqItems) {
  if (!faqItems.length) return '';
  const items = faqItems.map((faq, idx) => {
    const id = `faq-${idx + 1}`;
    return [
      `<article class="faq-item" id="${id}">`,
      `  <h3>${escapeHtml(faq.question)}</h3>`,
      `  ${ensureParagraphHtml(faq.answerHtml)}`,
      '</article>',
    ].join('\n');
  }).join('\n\n');

  return [
    '<section class="faq-list reveal" aria-label="Najczęściej zadawane pytania">',
    '  <h2>Najczęściej zadawane pytania</h2>',
    items,
    '</section>',
  ].join('\n\n');
}

function renderSourcesList(sources) {
  return sources
    .map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`)
    .join('\n        ');
}

function upsertContentBlock(html, renderedMain) {
  const rx = /(<p class="drop-cap">[\s\S]*?<\/p>)([\s\S]*?)(\s*<h2 id="zrodla">Źródła<\/h2>)/i;
  if (!rx.test(html)) {
    throw new Error('Nie znaleziono bloku treści pomiędzy leadem i sekcją Źródła w szablonie.');
  }
  return html.replace(rx, `$1\n\n${renderedMain}\n\n$3`);
}

function upsertSources(html, sourcesHtml) {
  const rx = /(<ol class="sources-list">)([\s\S]*?)(<\/ol>)/i;
  if (!rx.test(html)) {
    throw new Error('Nie znaleziono <ol class="sources-list"> w szablonie.');
  }
  return html.replace(rx, `$1\n        ${sourcesHtml}\n      $3`);
}

function upsertFaqSchema(html, faqItems) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripTags(item.answerHtml),
      },
    })),
  };

  const script = `<script type="application/ld+json" id="faqpage-schema-auto">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`;

  if (/<script[^>]*id="faqpage-schema-auto"[^>]*>[\s\S]*?<\/script>/i.test(html)) {
    return html.replace(/<script[^>]*id="faqpage-schema-auto"[^>]*>[\s\S]*?<\/script>/i, script);
  }

  return html.replace('</head>', `${script}\n\n</head>`);
}

function upsertSpeakableSchema(html, hasKeyTakeaways) {
  const cssSelector = buildSpeakableSelectors(hasKeyTakeaways);
  const speakable = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector,
    },
  };

  const script = `<script type="application/ld+json" id="speakable-schema-auto">\n${JSON.stringify(speakable, null, 2)}\n</script>`;

  if (/<script[^>]*id="speakable-schema-auto"[^>]*>[\s\S]*?<\/script>/i.test(html)) {
    return html.replace(/<script[^>]*id="speakable-schema-auto"[^>]*>[\s\S]*?<\/script>/i, script);
  }

  return html.replace('</head>', `${script}\n\n</head>`);
}

function upsertBlogPostingSchema(html, opts) {
  const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) return html;

  let changed = false;
  let output = html;

  for (const match of scripts) {
    const full = match[0];
    const body = match[1].trim();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (_err) {
      continue;
    }

    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    let touched = false;

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isBlogPosting = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
      if (!isBlogPosting) continue;

      node.wordCount = opts.wordCount;
      node.timeRequired = opts.timeRequired;
      const cssSelector = buildSpeakableSelectors(opts.hasKeyTakeaways);
      node.speakable = {
        '@type': 'SpeakableSpecification',
        cssSelector,
      };

      if (opts.about.length) {
        node.about = opts.about.map((name) => ({ '@type': 'Thing', name }));
      }

      if (opts.mentions.length) {
        node.mentions = opts.mentions.map((name) => ({ '@type': 'Thing', name }));
      }

      touched = true;
    }

    if (touched) {
      const nextJson = JSON.stringify(parsed, null, 2);
      output = output.replace(full, `<script type="application/ld+json">\n${nextJson}\n</script>`);
      changed = true;
      break;
    }
  }

  return changed ? output : html;
}

function updateSitemap(slug, dateIso, dryRun) {
  if (!fs.existsSync(SITEMAP_PATH)) return { changed: false, file: 'sitemap.xml (brak)' };

  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const url = `https://fitpo50.pl/${slug}.html`;
  if (xml.includes(`<loc>${url}</loc>`)) {
    return { changed: false, file: 'sitemap.xml' };
  }

  const date = String(dateIso || '').split('T')[0] || new Date().toISOString().slice(0, 10);
  const entry = [
    '  <url>',
    `    <loc>${url}</loc>`,
    `    <lastmod>${date}</lastmod>`,
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
    '',
  ].join('\n');

  xml = xml.replace('</urlset>', `${entry}</urlset>`);

  if (!dryRun) {
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
    const siteMirror = path.join(ROOT, '_site', 'sitemap.xml');
    if (fs.existsSync(path.dirname(siteMirror))) {
      fs.writeFileSync(siteMirror, xml, 'utf8');
    }
  }

  return { changed: true, file: 'sitemap.xml' };
}

function updateLlms(slug, title, section, summary, dryRun) {
  if (!fs.existsSync(LLMS_PATH)) return { changed: false, file: 'llms.txt (brak)' };

  let content = fs.readFileSync(LLMS_PATH, 'utf8');
  const articleUrl = `https://fitpo50.pl/${slug}.html`;

  if (content.includes(`- url: ${articleUrl}`)) {
    return { changed: false, file: 'llms.txt' };
  }

  const safeTitle = String(title || '').replace(/"/g, '\\"');
  const safeSummary = String(summary || '').replace(/"/g, '\\"');
  const block = [
    '',
    `- url: ${articleUrl}`,
    `  title: "${safeTitle}"`,
    `  section: "${section}"`,
    `  summary: "${safeSummary}"`,
    '',
  ].join('\n');

  content = `${content.trimEnd()}${block}`;

  if (!dryRun) {
    fs.writeFileSync(LLMS_PATH, `${content}\n`, 'utf8');
    const siteMirror = path.join(ROOT, '_site', 'llms.txt');
    if (fs.existsSync(path.dirname(siteMirror))) {
      fs.writeFileSync(siteMirror, `${content}\n`, 'utf8');
    }
  }

  return { changed: true, file: 'llms.txt' };
}

function escapeHtmlAttr(value) {
  return escapeHtml(String(value || '').replace(/\s+/g, ' ').trim());
}

function shortText(value, max = 170) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function searchTextFromPayload(payload) {
  const base = [
    payload.title,
    stripTags(payload.metaDescription),
    ...payload.keyTakeaways.slice(0, 3),
  ].join(' ');
  return shortText(base.toLowerCase(), 180);
}

function buildListingContext(payload) {
  const readTime = String(payload.readingTime || '11 min czytania').trim();
  const readTimeShort = readTime.replace(/\s*czytania/i, '').trim();
  const title = shortText(payload.title, 120);
  const excerpt = shortText(stripTags(payload.metaDescription || payload.leadRaw), 185);
  return {
    slug: payload.slug,
    href: `${payload.slug}.html`,
    title,
    excerpt,
    categoryKey: payload.category.key,
    categoryLabel: payload.category.label,
    readTime,
    readTimeShort,
    heroImageWebp: `./assets/${payload.heroImage}.webp`,
    searchText: searchTextFromPayload(payload),
  };
}

function countMatches(text, rx) {
  const m = text.match(rx);
  return m ? m.length : 0;
}

function replaceFirstOrThrow(text, rx, replacer, label) {
  if (!rx.test(text)) {
    throw new Error(`Nie znaleziono sekcji do aktualizacji: ${label}`);
  }
  return text.replace(rx, replacer);
}

function upsertPoradyListing(html, ctx) {
  let out = html;
  const hrefNeedle = `href="${ctx.href}"`;
  const hasCard = out.includes(`${hrefNeedle} class="article-index-card reveal"`) || out.includes(`${hrefNeedle}" class="article-index-card reveal"`);

  const allOrders = [...out.matchAll(/data-order="(\d+)"/g)].map((m) => Number(m[1])).filter(Number.isFinite);
  const nextOrder = allOrders.length ? Math.max(...allOrders) + 1 : 1;

  if (!hasCard) {
    const card = [
      `          <a href="${ctx.href}" class="article-index-card reveal" data-article-item data-category="${ctx.categoryKey}" data-order="${nextOrder}" data-article-title="${escapeHtmlAttr(ctx.title)}" data-read-time="${escapeHtmlAttr(ctx.readTimeShort)}" data-search-text="${escapeHtmlAttr(ctx.searchText)}">`,
      '            <div class="article-index-card__top">',
      `              <span class="article-index-card__label">${escapeHtml(ctx.categoryLabel)}</span>`,
      `              <span class="article-index-card__meta">${escapeHtml(ctx.readTime)}</span>`,
      '            </div>',
      `            <h3 class="article-index-card__title">${escapeHtml(ctx.title)}</h3>`,
      `            <p class="article-index-card__desc">${escapeHtml(ctx.excerpt)}</p>`,
      '            <div class="article-index-card__cta">Otwórz -&gt;</div>',
      '          </a>',
      '',
    ].join('\n');

    const insertMarker = '<div class="articles-grid-preview carousel-track" data-article-results>';
    const markerIdx = out.indexOf(insertMarker);
    if (markerIdx === -1) {
      throw new Error('Nie znaleziono kontenera kart na porady.html');
    }
    const firstCardIdx = out.indexOf('<a href="', markerIdx);
    if (firstCardIdx === -1) {
      throw new Error('Nie znaleziono pierwszej karty na porady.html');
    }
    out = `${out.slice(0, firstCardIdx)}${card}${out.slice(firstCardIdx)}`;
  }

  const articleCount = countMatches(out, /data-article-item\b/g);
  out = out.replace(/(<span class="count-badge" data-article-count>)\d+(<\/span>)/, `$1${articleCount}$2`);
  out = out.replace(/(<strong data-catalog-summary>)\d+ artykułów(<\/strong>)/, `$1${articleCount} artykułów$2`);
  out = out.replace(/(<h2 class="catalog-header__title" data-catalog-summary[^>]*>)\d+ artykułów we wszystkich kategoriach(<\/h2>)/, `$1${articleCount} artykułów we wszystkich kategoriach$2`);
  out = out.replace(/("numberOfItems"\s*:\s*)\d+/, `$1${articleCount}`);

  return out;
}

function categoryFileFromKey(categoryKey) {
  if (categoryKey === 'ruch') return 'rusz-sie.html';
  if (categoryKey === 'jedzenie') return 'jedzenie.html';
  if (categoryKey === 'zdrowie') return 'zdrowie.html';
  return 'ciekawe.html';
}

function upsertCategoryListing(html, ctx) {
  let out = html;
  const hrefNeedle = `href="${ctx.href}"`;
  const hasCard = out.includes(`${hrefNeedle} class="article-index-card reveal"`) || out.includes(`${hrefNeedle}" class="article-index-card reveal"`);

  const allOrders = [...out.matchAll(/data-order="(\d+)"/g)].map((m) => Number(m[1])).filter(Number.isFinite);
  const nextOrder = allOrders.length ? Math.max(...allOrders) + 1 : 1;

  if (!hasCard) {
    const card = [
      `          <a href="${ctx.href}" class="article-index-card reveal" data-category="${ctx.categoryKey}" data-order="${nextOrder}">`,
      '            <div class="article-index-card__top">',
      `              <span class="article-index-card__label">${escapeHtml(ctx.categoryLabel)}</span>`,
      `              <span class="article-index-card__meta">${escapeHtml(ctx.readTime)}</span>`,
      '            </div>',
      `            <h3 class="article-index-card__title">${escapeHtml(ctx.title)}</h3>`,
      `            <p class="article-index-card__desc">${escapeHtml(ctx.excerpt)}</p>`,
      '            <div class="article-index-card__cta">Otwórz -&gt;</div>',
      '          </a>',
      '',
    ].join('\n');

    const insertMarker = '<div class="articles-grid-preview carousel-track">';
    const markerIdx = out.indexOf(insertMarker);
    if (markerIdx === -1) {
      throw new Error('Nie znaleziono kontenera kart na stronie kategorii.');
    }
    const firstCardIdx = out.indexOf('<a href="', markerIdx);
    if (firstCardIdx === -1) {
      throw new Error('Nie znaleziono pierwszej karty na stronie kategorii.');
    }
    out = `${out.slice(0, firstCardIdx)}${card}${out.slice(firstCardIdx)}`;
  }

  const cardCount = countMatches(out, /class="article-index-card reveal"/g);
  out = out.replace(/("numberOfItems"\s*:\s*)\d+/, `$1${cardCount}`);
  return out;
}

function unescapeJsSingleQuoted(value) {
  return String(value || '')
    .replace(/\\\\/g, '\\')
    .replace(/\\'/g, "'");
}

function extractCurrentLatestFromIndex(html) {
  const imageMatch = html.match(/<img class="latest-article__bg" id="latestArticleImage"[^>]*src="([^"]+)"/i);
  const titleMatch = html.match(/<h4 class="latest-article__title" id="latestArticleTitle">([\s\S]*?)<\/h4>/i);
  const excerptMatch = html.match(/<p class="latest-article__excerpt" id="latestArticleExcerpt">([\s\S]*?)<\/p>/i);
  const linkMatch = html.match(/<a class="latest-article__cta" id="latestArticleLink" href="([^"]+)"/i);

  const url = linkMatch ? String(linkMatch[1] || '').trim() : '';
  if (!url) return null;

  return {
    category: 'Ciekawe',
    title: stripTags(titleMatch ? titleMatch[1] : '').trim(),
    excerpt: stripTags(excerptMatch ? excerptMatch[1] : '').trim(),
    image: imageMatch ? String(imageMatch[1] || '').trim() : '',
    url,
  };
}

function extractReadingFallbackCardsFromIndex(html) {
  const out = [];
  const blockMatch = html.match(/function renderReadingFallback\(\)\s*\{[\s\S]*?const fallback = \[([\s\S]*?)\]\s*;/i);
  if (!blockMatch) return out;
  const block = blockMatch[1];

  const cardRx = /\{\s*category:\s*'((?:\\'|[^'])*)',\s*title:\s*'((?:\\'|[^'])*)',\s*excerpt:\s*'((?:\\'|[^'])*)',\s*image:\s*'((?:\\'|[^'])*)',\s*url:\s*'((?:\\'|[^'])*)'\s*\}/gms;
  for (const m of block.matchAll(cardRx)) {
    out.push({
      category: unescapeJsSingleQuoted(m[1]),
      title: unescapeJsSingleQuoted(m[2]),
      excerpt: unescapeJsSingleQuoted(m[3]),
      image: unescapeJsSingleQuoted(m[4]),
      url: unescapeJsSingleQuoted(m[5]),
    });
  }
  return out;
}

function escJsSingle(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function upsertIndexListing(html, ctx) {
  let out = html;
  const previousLatest = extractCurrentLatestFromIndex(out);
  const previousFallback = extractReadingFallbackCardsFromIndex(out);

  out = replaceFirstOrThrow(out, /(<img class="latest-article__bg" id="latestArticleImage"[^>]*src=")[^"]+(")/, `$1${ctx.heroImageWebp}$2`, 'latestArticleImage.src');
  out = replaceFirstOrThrow(out, /(<h4 class="latest-article__title" id="latestArticleTitle">)([\s\S]*?)(<\/h4>)/, `$1${escapeHtml(ctx.title)}$3`, 'latestArticleTitle');
  out = replaceFirstOrThrow(out, /(<p class="latest-article__excerpt" id="latestArticleExcerpt">)([\s\S]*?)(<\/p>)/, `$1${escapeHtml(ctx.excerpt)}$3`, 'latestArticleExcerpt');
  out = replaceFirstOrThrow(out, /(<a class="latest-article__cta" id="latestArticleLink" href=")[^"]+(">([\s\S]*?)<\/a>)/, `$1${ctx.href}$2`, 'latestArticleLink');

  const fallbackBlock = [
    'const fallback = {',
    `        title: '${escJsSingle(ctx.title)}',`,
    `        excerpt: '${escJsSingle(ctx.excerpt)}',`,
    `        image: '${ctx.heroImageWebp}',`,
    `        url: '${ctx.href}'`,
    '      };',
  ].join('\n');
  out = replaceFirstOrThrow(out, /const fallback = \{[\s\S]*?\n\s*\};/, fallbackBlock, 'loadLatestArticle.fallback');

  const composed = [
    {
      category: ctx.categoryLabel,
      title: ctx.title,
      excerpt: ctx.excerpt,
      image: ctx.heroImageWebp,
      url: ctx.href,
    },
  ];

  if (previousLatest && previousLatest.url !== ctx.href) {
    composed.push(previousLatest);
  }

  for (const item of previousFallback) {
    if (composed.find((x) => x.url === item.url)) continue;
    composed.push(item);
    if (composed.length >= 3) break;
  }

  while (composed.length < 3) {
    composed.push({
      category: 'Ciekawe',
      title: 'AI w szpitalu: czy sztuczna inteligencja faktycznie pomaga pacjentom?',
      excerpt: 'AI już działa w gabinetach i szpitalach. Sprawdzamy, co mówią badania o realnym wpływie na zdrowie pacjentów.',
      image: './assets/ai-medycyna-lekarz-monitor-rtg-hero.webp',
      url: 'ai-w-medycynie-czy-naprawde-pomaga-pacjentom-fakty-badania.html',
    });
  }

  const cards = composed.slice(0, 3).map((item) => [
    '        {',
    `          category: '${escJsSingle(item.category)}',`,
    `          title: '${escJsSingle(item.title)}',`,
    `          excerpt: '${escJsSingle(item.excerpt)}',`,
    `          image: '${escJsSingle(item.image)}',`,
    `          url: '${escJsSingle(item.url)}'`,
    '        }',
  ].join('\n'));

  const readingBlock = [
    'const fallback = [',
    `${cards[0]},`,
    `${cards[1]},`,
    `${cards[2]}`,
    '      ];',
  ].join('\n');
  out = replaceFirstOrThrow(out, /const fallback = \[[\s\S]*?\n\s*\];/, readingBlock, 'renderReadingFallback');
  return out;
}

function updateSingleFileWithMirror(relPath, updater, dryRun, syncSite) {
  const updatedFiles = [];
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return updatedFiles;

  const original = fs.readFileSync(filePath, 'utf8');
  const next = updater(original);
  if (next !== original) {
    if (!dryRun) fs.writeFileSync(filePath, next, 'utf8');
    updatedFiles.push(relPath);
  }

  if (!syncSite) return updatedFiles;

  const mirrorPath = path.join(ROOT, '_site', relPath);
  if (!fs.existsSync(path.dirname(mirrorPath))) return updatedFiles;
  if (!fs.existsSync(mirrorPath)) return updatedFiles;

  const mirrorOriginal = fs.readFileSync(mirrorPath, 'utf8');
  const mirrorNext = updater(mirrorOriginal);
  if (mirrorNext !== mirrorOriginal) {
    if (!dryRun) fs.writeFileSync(mirrorPath, mirrorNext, 'utf8');
    updatedFiles.push(`_site/${relPath}`);
  }

  return updatedFiles;
}

function updateListings(payload, dryRun, syncSite) {
  const ctx = buildListingContext(payload);
  const changed = [];

  changed.push(...updateSingleFileWithMirror('porady.html', (html) => upsertPoradyListing(html, ctx), dryRun, syncSite));
  changed.push(...updateSingleFileWithMirror(categoryFileFromKey(ctx.categoryKey), (html) => upsertCategoryListing(html, ctx), dryRun, syncSite));
  changed.push(...updateSingleFileWithMirror('index.html', (html) => upsertIndexListing(html, ctx), dryRun, syncSite));

  return changed;
}

function runCommand(label, command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    ...opts,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = [stderr, stdout].filter(Boolean).join('\n');
    throw new Error(`${label} nie powiodło się. ${details}`.trim());
  }

  return result;
}

function stripXmlProcessingInstruction(html) {
  return String(html || '').replace(/^\s*<\?xml[^>]*>\s*/i, '');
}

function assertNoReadingRoomPlaceholders(html) {
  const checks = [
    { rx: /Powiązany artykuł\s*[123]/i, msg: 'Wykryto placeholder "Powiązany artykuł X" w sekcji Czytelnia.' },
    { rx: /Krótki opis powiązanego artykułu\./i, msg: 'Wykryto placeholder opisu w sekcji Czytelnia.' },
    { rx: /\{\{RELATED_[^}]+\}\}/, msg: 'Wykryto nierozwiązany placeholder {{RELATED_*}} w HTML.' },
  ];

  for (const check of checks) {
    if (check.rx.test(html)) {
      throw new Error(`${check.msg} Uzupełnij related_articles w JSON albo popraw fallback importera.`);
    }
  }
}

function sanitizeHtmlFileAfterPhpRewrite(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const original = fs.readFileSync(filePath, 'utf8');
  const sanitized = stripXmlProcessingInstruction(original);
  if (sanitized === original) return false;
  fs.writeFileSync(filePath, sanitized, 'utf8');
  return true;
}

function runInternalLinks(slug, dryRun) {
  if (dryRun) return { skipped: true };

  const phpCode = [
    'require "admin/config.php";',
    'require "admin/helpers/internal-links.php";',
    '$file = $argv[1];',
    '$html = file_get_contents($file);',
    'if ($html === false) { fwrite(STDERR, "Nie udało się odczytać HTML."); exit(2); }',
    '$result = autoLinkInternalArticlesInHtml($html, [',
    '  "min_words" => 80,',
    '  "min_links" => 2,',
    '  "max_links" => 2,',
    '  "current_href" => basename($file),',
    ']);',
    'file_put_contents($file, $result["html"]);',
    'echo json_encode(["added" => (int)$result["added"], "skipped_short" => (bool)$result["skipped_short"]], JSON_UNESCAPED_UNICODE);',
  ].join(' ');

  const htmlPath = path.join(ROOT, `${slug}.html`);
  const res = runCommand('Internal linking', 'php', ['-r', phpCode, htmlPath]);

  const parsed = JSON.parse((res.stdout || '').trim() || '{}');
  const removedXmlPi = sanitizeHtmlFileAfterPhpRewrite(htmlPath);

  const sitePath = path.join(ROOT, '_site', `${slug}.html`);
  if (fs.existsSync(sitePath)) {
    fs.copyFileSync(htmlPath, sitePath);
  }

  return {
    ...parsed,
    removedXmlPi,
  };
}

function runValidator(slug, dryRun) {
  if (dryRun) return { skipped: true };
  runCommand('Walidacja standardu artykułu', 'node', ['scripts/validate-article-standard.js', `${slug}.html`]);
  return { ok: true };
}

function runPdfSync(slug, dryRun) {
  if (dryRun) return { skipped: true };
  runCommand('Generowanie PDF + synchronizacja przycisku', 'python3', ['scripts/sync_article_pdfs_and_buttons.py', '--slug', slug]);

  const htmlPath = path.join(ROOT, `${slug}.html`);
  const sitePath = path.join(ROOT, '_site', `${slug}.html`);
  if (fs.existsSync(sitePath)) {
    fs.copyFileSync(htmlPath, sitePath);
  }

  return { ok: true };
}

function writeArticleFiles(slug, html, syncSite, dryRun, force) {
  const outPath = path.join(ROOT, `${slug}.html`);
  if (fs.existsSync(outPath) && !force) {
    throw new Error(`Plik już istnieje: ${slug}.html (użyj --force true, aby nadpisać).`);
  }

  if (!dryRun) {
    fs.writeFileSync(outPath, html, 'utf8');
    if (syncSite && fs.existsSync(path.join(ROOT, '_site'))) {
      fs.writeFileSync(path.join(ROOT, '_site', `${slug}.html`), html, 'utf8');
    }
  }

  return {
    outPath,
    sitePath: syncSite ? path.join(ROOT, '_site', `${slug}.html`) : null,
  };
}

function normalizePayload(data, cliCategory) {
  const now = new Date();
  const fallbackDate = now.toISOString().slice(0, 10);

  const title = String(data.title || '').trim();
  const seoTitleBase = normalizeSeoTitleBase(String(data.seo_title || title).trim() || title);
  const slug = String(data.slug || '').trim() || slugify(title);
  const category = normalizeCategory(cliCategory || data.category || data.section || 'ciekawe');

  const leadRaw = String(data.lead || data.lead_paragraph || data.excerpt || '').trim();
  const metaDescription = String(data.meta_description || data.description || data.excerpt || stripTags(leadRaw)).trim();

  const datePublished = toIsoDateTimeWithTimezone(data.date_published || data.published_at || fallbackDate, '08:00:00');
  const dateModified = toIsoDateTimeWithTimezone(data.date_modified || data.updated_at || datePublished, '09:30:00');

  const readingTime = String(data.reading_time || data.readingTime || '11 min czytania').trim();

  const heroImage = String(data.hero_image || data.heroImage || slug).trim();
  const heroAlt = String(data.hero_alt || data.heroAlt || title).trim();
  const heroMotto = String(data.hero_motto_html || data.hero_motto || data.heroMotto || '').trim();

  const keyTakeaways = normalizeKeyTakeaways(data.key_takeaways || data.takeaways || []);
  const sections = normalizeSections(data.sections || []);
  const faqItems = normalizeFaq(data.answer_blocks || data.faq || data.faq_items || []);
  const sources = normalizeSources(data.sources || []);

  const related = normalizeArray(data.related_articles || data.related || []).slice(0, 3);

  const relatedDefaults = [0, 1, 2].map((idx) => {
    const fallback = READING_ROOM_FALLBACKS[idx];
    const item = related[idx] || {};
    const rCat = normalizeCategory(item.category || fallback.category || category.label);
    const imageBase = String(item.image || item.image_base || fallback.image || heroImage).trim();
    return {
      url: String(item.url || fallback.url || 'porady.html').trim() || 'porady.html',
      image: imageBase,
      alt: String(item.alt || item.title || fallback.alt || title).trim(),
      categoryLabel: rCat.label,
      categoryKey: rCat.key,
      time: String(item.time || item.reading_time || fallback.time || readingTime.replace(/\s*czytania/i, '')).trim(),
      title: String(item.title || fallback.title || title).trim(),
      description: String(item.description || fallback.description || metaDescription).trim(),
    };
  });

  const plainForWordCount = [
    stripTags(leadRaw),
    ...keyTakeaways,
    ...sections.map((s) => stripTags(`${s.title} ${s.blocks.map((b) => b.html || '').join(' ')}`)),
    ...faqItems.map((f) => `${f.question} ${stripTags(f.answerHtml)}`),
  ].join(' ');

  const about = keyTakeaways.slice(0, 4);
  const mentions = sources.map((s) => s.label).slice(0, 6);

  return {
    slug,
    title,
    seoTitleBase,
    category,
    leadRaw,
    metaDescription,
    datePublished,
    dateModified,
    readingTime,
    timeRequiredIso: toIsoDuration(readingTime),
    heroImage,
    heroAlt,
    heroMotto,
    keyTakeaways,
    sections,
    faqItems,
    sources,
    relatedDefaults,
    wordCount: countWordsUtf8(plainForWordCount),
    about,
    mentions,
  };
}

function buildHtmlFromTemplate(template, payload) {
  const replacements = {
    SLUG: payload.slug,
    TITLE: payload.title,
    SEO_TITLE: payload.seoTitleBase,
    META_DESCRIPTION: payload.metaDescription,
    DATE_PUBLISHED: payload.datePublished,
    DATE_MODIFIED: payload.dateModified,
    READING_TIME: payload.readingTime,
    TIME_REQUIRED_ISO: payload.timeRequiredIso,
    CATEGORY_LABEL: payload.category.label,
    CATEGORY_BODY_CLASS: `article--${payload.category.key}`,
    CATEGORY_CARD_CLASS: `article-kicker-card--${payload.category.key}`,
    HERO_IMAGE: payload.heroImage,
    HERO_ALT: payload.heroAlt,
    HERO_MOTTO: payload.heroMotto,
    LEAD_PARAGRAPH: stripTags(payload.leadRaw),
    H2_1: 'Sekcja artykułu',
    P_1: 'Treść sekcji artykułu.',
    H2_2: 'Sekcja artykułu',
    P_2: 'Treść sekcji artykułu.',
    SOURCE_URL_1: payload.sources[0] ? payload.sources[0].url : 'https://example.com',
    SOURCE_1: payload.sources[0] ? payload.sources[0].label : 'Źródło 1',
    SOURCE_URL_2: payload.sources[1] ? payload.sources[1].url : 'https://example.com',
    SOURCE_2: payload.sources[1] ? payload.sources[1].label : 'Źródło 2',
    RELATED_URL_1: payload.relatedDefaults[0].url,
    RELATED_URL_2: payload.relatedDefaults[1].url,
    RELATED_URL_3: payload.relatedDefaults[2].url,
    RELATED_IMG_1: payload.relatedDefaults[0].image,
    RELATED_IMG_2: payload.relatedDefaults[1].image,
    RELATED_IMG_3: payload.relatedDefaults[2].image,
    RELATED_ALT_1: payload.relatedDefaults[0].alt,
    RELATED_ALT_2: payload.relatedDefaults[1].alt,
    RELATED_ALT_3: payload.relatedDefaults[2].alt,
    RELATED_CATEGORY_1: payload.relatedDefaults[0].categoryLabel,
    RELATED_CATEGORY_2: payload.relatedDefaults[1].categoryLabel,
    RELATED_CATEGORY_3: payload.relatedDefaults[2].categoryLabel,
    RELATED_CATEGORY_1_KEY: payload.relatedDefaults[0].categoryKey,
    RELATED_CATEGORY_2_KEY: payload.relatedDefaults[1].categoryKey,
    RELATED_CATEGORY_3_KEY: payload.relatedDefaults[2].categoryKey,
    RELATED_TIME_1: payload.relatedDefaults[0].time,
    RELATED_TIME_2: payload.relatedDefaults[1].time,
    RELATED_TIME_3: payload.relatedDefaults[2].time,
    RELATED_TITLE_1: payload.relatedDefaults[0].title,
    RELATED_TITLE_2: payload.relatedDefaults[1].title,
    RELATED_TITLE_3: payload.relatedDefaults[2].title,
    RELATED_DESC_1: payload.relatedDefaults[0].description,
    RELATED_DESC_2: payload.relatedDefaults[1].description,
    RELATED_DESC_3: payload.relatedDefaults[2].description,
  };

  let html = replaceAllPlaceholders(template, replacements);

  const leadReplacement = `<p class="drop-cap">${payload.leadRaw}</p>`;
  html = html.replace(/<p class="drop-cap">[\s\S]*?<\/p>/i, leadReplacement);

  const dynamicContent = [
    renderKeyTakeawaysBlock(payload.keyTakeaways),
    renderSectionsHtml(payload.sections),
    renderFaqList(payload.faqItems),
  ].filter(Boolean).join('\n\n');

  html = upsertContentBlock(html, dynamicContent);

  const sourcesHtml = renderSourcesList(payload.sources);
  html = upsertSources(html, sourcesHtml);

  html = upsertBlogPostingSchema(html, {
    wordCount: payload.wordCount,
    timeRequired: payload.timeRequiredIso,
    about: payload.about,
    mentions: payload.mentions,
    hasKeyTakeaways: payload.keyTakeaways.length > 0,
  });

  if (payload.faqItems.length) {
    html = upsertFaqSchema(html, payload.faqItems);
  }

  html = upsertSpeakableSchema(html, payload.keyTakeaways.length > 0);

  assertNoReadingRoomPlaceholders(html);

  return html;
}

function printSummary(report) {
  console.log('\n=== Importer report ===');
  console.log(`Slug: ${report.slug}`);
  console.log(`Plik JSON: ${report.input}`);
  console.log(`Tryb dry-run: ${report.dryRun ? 'TAK' : 'NIE'}`);
  console.log(`Artykuł HTML: ${report.articlePath}`);
  if (report.sitePath) {
    console.log(`Mirror _site: ${report.sitePath}`);
  }
  console.log(`Sekcje: ${report.sections}`);
  console.log(`FAQ: ${report.faq}`);
  console.log(`Źródła: ${report.sources}`);
  if (report.internalLinks) {
    console.log(`Internal links dodane: ${report.internalLinks.added || 0}`);
    console.log(`Internal links pominięte przez min_words: ${report.internalLinks.skipped_short ? 'tak' : 'nie'}`);
  }
  if (report.updatedFiles.length) {
    console.log(`Zaktualizowane pliki: ${report.updatedFiles.join(', ')}`);
  }
  console.log(`Publikacja w listingach: ${report.listingsUpdated ? 'TAK' : 'NIE'}`);
  console.log('PDF + przycisk pobierania: wymagane i wykonane.');
  console.log('Brak modyfikacji Newsów/miniatur: potwierdzone przez projekt importera.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (boolOpt(args.help, false) || boolOpt(args.h, false)) {
    printUsage();
    return;
  }

  const inputFile = args.file;
  if (!inputFile) {
    printUsage();
    throw new Error('Podaj plik JSON: --file /sciezka/do/artykul.fitpo50.json');
  }

  const dryRun = boolOpt(args['dry-run'], false);
  const publish = boolOpt(args.publish, true);
  const syncSite = boolOpt(args['sync-site'], true);
  const runInternal = boolOpt(args['run-internal-links'], false);
  const runValidate = boolOpt(args.validate, true);
  const precheckOnly = boolOpt(args.precheck, false) || boolOpt(args['check-only'], false);
  const force = boolOpt(args.force, false);

  const resolvedInput = path.resolve(ROOT, inputFile);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Nie znaleziono pliku: ${resolvedInput}`);
  }
  if (!resolvedInput.endsWith('.json')) {
    throw new Error('Plik wejściowy musi być JSON (.json / .fitpo50.json).');
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('Brak pliku article-template-bento.html');
  }

  const json = parseJsonFile(resolvedInput);
  const payload = normalizePayload(json, args.category);
  const check = validateInput(json);
  const precheck = buildPrecheckReport({
    inputPath: resolvedInput,
    json,
    payload,
    validation: check,
    syncSite,
  });
  printPrecheckReport(precheck);

  if (precheckOnly) {
    return;
  }

  if (!precheck.canImport) {
    throw new Error('Precheck nie przeszedł. Popraw błędy blokujące i uruchom import ponownie.');
  }

  if (!payload.slug) {
    throw new Error('Nie udało się wyznaczyć slug (title/slug są puste).');
  }
  ensureHeroAssetsExist(payload.heroImage, syncSite);

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const html = buildHtmlFromTemplate(template, payload);

  const written = writeArticleFiles(payload.slug, html, syncSite, dryRun, force);

  const updatedFiles = [];
  if (publish) {
    const listingFiles = updateListings(payload, dryRun, syncSite);
    if (listingFiles.length) updatedFiles.push(...listingFiles);

    const sitemapResult = updateSitemap(payload.slug, payload.datePublished, dryRun);
    if (sitemapResult.changed) updatedFiles.push(sitemapResult.file);

    const llmsResult = updateLlms(
      payload.slug,
      `${payload.title} | FitPo50`,
      payload.category.label,
      payload.metaDescription,
      dryRun,
    );
    if (llmsResult.changed) updatedFiles.push(llmsResult.file);
  }

  let internalLinksResult = null;
  if (runInternal) {
    console.warn('\nUwaga: --run-internal-links=true jest trybem podwyższonego ryzyka (helper może przebudować HTML).');
    internalLinksResult = runInternalLinks(payload.slug, dryRun);
  }

  if (runValidate) {
    runValidator(payload.slug, dryRun);
  }

  runPdfSync(payload.slug, dryRun);
  updatedFiles.push('assets/pdf/<slug>.pdf + przycisk PDF + schema encoding');

  printSummary({
    slug: payload.slug,
    input: resolvedInput,
    dryRun,
    articlePath: written.outPath,
    sitePath: written.sitePath,
    sections: payload.sections.length,
    faq: payload.faqItems.length,
    sources: payload.sources.length,
    internalLinks: internalLinksResult,
    updatedFiles,
    listingsUpdated: updatedFiles.some((file) => file.includes('porady.html') || file.includes('index.html') || file.endsWith('.html')),
  });
}

try {
  main();
} catch (err) {
  console.error(`\nBłąd importera: ${err.message || err}`);
  process.exit(1);
}
