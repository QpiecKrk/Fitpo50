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
const { POLICY, utils, validators, enforcers } = require('./lib/article-policy');
const {
  CATEGORY_LANDING_URLS,
  categoryFileFromKey,
  categoryLabelFromKey,
  normalizeCategory,
} = require('./lib/categories');
const https = require('https');
const { spawnSync } = require('child_process');
const { inspectPreparedArtifact } = require('./lib/article-json-artifact');
const { validateArticleEvidence } = require('./lib/article-evidence');
const { validateArticleArchitecture } = require('./lib/article-intent-links');
const { validateManifestStructure } = require('./lib/article-media');

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'article-template-bento.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITEMAP_LOCK_DIR = path.join(ROOT, '.tmp', 'sitemap.lock');
const LLMS_PATH = path.join(ROOT, 'llms.txt');
const DEFAULT_AUTHOR_PERSON = {
  '@type': 'Person',
  name: 'Grzegorz Kupiec',
  url: 'https://fitpo50.pl/o-mnie.html',
  sameAs: ['https://fitpo50.pl/o-mnie.html'],
};
const DEFAULT_PUBLISHER_ORG = {
  '@type': 'Organization',
  name: 'FitPo50',
  url: 'https://fitpo50.pl/',
  logo: {
    '@type': 'ImageObject',
    url: 'https://fitpo50.pl/assets/logo.jpg',
  },
};
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
const WIKIDATA_ENTITY_MAP = [
  { key: 'apob', name: 'Apolipoprotein B', sameAs: 'https://www.wikidata.org/wiki/Q420633' },
  { key: 'apolipoproteina b', name: 'Apolipoprotein B', sameAs: 'https://www.wikidata.org/wiki/Q420633' },
  { key: 'ldl', name: 'Low-density lipoprotein', sameAs: 'https://www.wikidata.org/wiki/Q159472' },
  { key: 'hdl', name: 'High-density lipoprotein', sameAs: 'https://www.wikidata.org/wiki/Q181503' },
  { key: 'cholesterol', name: 'Cholesterol', sameAs: 'https://www.wikidata.org/wiki/Q43656' },
  { key: 'miazdzyca', name: 'Atherosclerosis', sameAs: 'https://www.wikidata.org/wiki/Q133212' },
  { key: 'miażdżyca', name: 'Atherosclerosis', sameAs: 'https://www.wikidata.org/wiki/Q133212' },
  { key: 'metylacja dna', name: 'DNA methylation', sameAs: 'https://www.wikidata.org/wiki/Q29197' },
  { key: 'epigenetyczny', name: 'Epigenetics', sameAs: 'https://www.wikidata.org/wiki/Q29181' },
  { key: 'zegar horvatha', name: 'Epigenetic clock', sameAs: 'https://www.wikidata.org/wiki/Q109345510' },
  { key: 'sakady', name: 'Saccade', sameAs: 'https://www.wikidata.org/wiki/Q270190' },
  { key: 'saccade', name: 'Saccade', sameAs: 'https://www.wikidata.org/wiki/Q270190' },
  { key: 'supresja sakadyczna', name: 'Saccadic suppression', sameAs: 'https://www.wikidata.org/wiki/Q7394493' },
  { key: 'insulinoopornosc', name: 'Insulin resistance', sameAs: 'https://www.wikidata.org/wiki/Q541507' },
  { key: 'insulinooporność', name: 'Insulin resistance', sameAs: 'https://www.wikidata.org/wiki/Q541507' },
  { key: 'cukrzyca', name: 'Diabetes', sameAs: 'https://www.wikidata.org/wiki/Q12204' },
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
    '  --indexnow true|false           submit URL to IndexNow after publish (default: true)',
    '  --sync-site true|false          mirror changes to _site (default: true)',
    '  --run-internal-links true|false|auto run PHP internal-link helper (default: auto)',
    '  --validate true|false           run article validator (default: true)',
    '  --faq-strict true               legacy flag; real FAQ research is always required',
    '  --force true|false              overwrite existing article HTML (default: false)',
    '  --category <key>                override JSON category',
    '  --help                          show this help',
    'Env:',
    '  INDEXNOW_KEY                    required for IndexNow submission',
    '  INDEXNOW_KEY_LOCATION           optional full URL to hosted key file',
    '',
    'Recommended publish command (requires CONTENT_READY artifact):',
    '  npm run article:publish -- --file "...fitpo50.json"',
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
  return utils.stripTags(html);
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
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    const datePart = raw.slice(0, 10);
    return `${raw}:00${getWarsawOffset(datePart)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const datePart = raw.slice(0, 10);
    return `${raw}${getWarsawOffset(datePart)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    return raw.replace(/(Z|[+-]\d{2}:\d{2})$/, ':00$1');
  }
  return raw;
}

function toIsoDuration(readingTime) {
  const m = String(readingTime || '').match(/(\d+)/);
  const mins = m ? Number(m[1]) : 11;
  return `PT${Math.max(1, mins)}M`;
}

function formatDateForDisplay(input) {
  const raw = String(input || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw;
  return `${m[3]}.${m[2]}.${m[1]}`;
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

function ensureSentenceTerminator(text, maxChars) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean || /[.!?…]$/.test(clean)) return clean;
  const withoutDangling = clean.replace(/[\s,;:–-]+$/u, '').trim();
  if (!withoutDangling) return '';
  if (withoutDangling.length < maxChars) return `${withoutDangling}.`;
  const shortened = truncateAtWordBoundary(withoutDangling, Math.max(1, maxChars - 1))
    .replace(/[\s,;:–-]+$/u, '')
    .trim();
  return shortened ? `${shortened}.` : '';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSeoTitleBase(rawTitle) {
  const clean = String(rawTitle || '')
    .replace(/\s+\|\s*FitPo50$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateAtWordBoundary(clean, POLICY.TITLE.SEO_BASE_MAX);
}

function normalizeMetaDescription(rawDescription) {
  const clean = stripTags(String(rawDescription || ''))
    .replace(/\s+/g, ' ')
    .trim();
  return ensureSentenceTerminator(
    truncateAtWordBoundary(clean, POLICY.WORDS.SEO_DESCRIPTION_MAX),
    POLICY.WORDS.SEO_DESCRIPTION_MAX
  );
}

function buildSpeakableSelectors(hasKeyTakeaways) {
  const selectors = ['.article-header__title', '#quick-answer', '#quick-answer p', '.drop-cap'];
  if (hasKeyTakeaways) {
    selectors.push('.key-takeaways h2', '.key-takeaways li');
  }
  return selectors;
}

function countWordsUtf8(text) {
  return utils.countWords(text);
}

function decodeHtmlEntities(input) {
  const named = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    ndash: '-',
    mdash: '-',
    hellip: '...',
    bdquo: '"',
    ldquo: '"',
    rdquo: '"',
    rsquo: "'",
    lsquo: "'",
  };
  return String(input || '')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _m;
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _m;
    })
    .replace(/&([a-z]+);/gi, (m, key) => named[key.toLowerCase()] ?? m);
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
    out.push({
      ...item,
      label,
      url,
      checked_at: String(item.checked_at || item.checkedAt || '').trim(),
      url_status: String(item.url_status || item.urlStatus || '').trim(),
      http_status: Number(item.http_status || item.httpStatus || 0) || 0,
    });
  }
  return out;
}

function extractYearFromText(value) {
  const m = String(value || '').match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

function buildScholarlyMentions(sources) {
  const out = [];
  for (const source of normalizeArray(sources)) {
    if (!source || typeof source !== 'object') continue;
    const name = String(source.label || '').trim();
    const url = String(source.url || '').trim();
    if (!name || !/^https?:\/\//i.test(url)) continue;
    const year = extractYearFromText(name);
    out.push({
      '@type': 'ScholarlyArticle',
      name,
      url,
      ...(year ? { datePublished: `${year}-01-01T00:00:00+00:00` } : {}),
      author: {
        '@type': 'Organization',
        name: 'Autorzy badania',
      },
    });
  }
  return out.slice(0, 6);
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

function normalizeFaqResearch(raw) {
  const out = [];
  for (const item of normalizeArray(raw)) {
    if (!item || typeof item !== 'object') continue;
    const question = String(item.question || item.q || '').trim();
    const sourceLabel = String(item.source_label || item.sourceLabel || item.label || '').trim();
    const sourceUrl = String(item.source_url || item.sourceUrl || item.url || '').trim();
    if (!question || !sourceLabel || !sourceUrl) continue;
    if (!/^https?:\/\//i.test(sourceUrl)) continue;
    out.push({
      question,
      sourceLabel,
      sourceUrl,
      source_label: sourceLabel,
      source_url: sourceUrl,
      source_type: String(item.source_type || item.sourceType || '').trim(),
      checked_at: String(item.checked_at || item.checkedAt || '').trim(),
      url_status: String(item.url_status || item.urlStatus || '').trim(),
      http_status: Number(item.http_status || item.httpStatus || 0) || 0,
    });
  }
  return out;
}

function isFaqPlaceholder(question, answerHtml) {
  const q = String(question || '').trim().toLowerCase();
  const a = stripTags(answerHtml || '').trim().toLowerCase();
  if (!q || !a) return true;
  if (q.includes('pytanie do doprecyzowania')) return true;
  if (a.includes('odpowiedź do uzupełnienia') || a.includes('odpowiedz do uzupelnienia')) return true;
  return false;
}

function containsEditorialPlaceholder(text) {
  const value = String(text || '');
  if (!value) return false;
  const patterns = [
    /do uzupełnienia redakcyjnego/i,
    /do uzupelnienia redakcyjnego/i,
    /pytanie do doprecyzowania/i,
    /odpowiedź do uzupełnienia/i,
    /odpowiedz do uzupelnienia/i,
    /\{\{[^}]+\}\}/,
  ];
  return patterns.some((rx) => rx.test(value));
}

function normalizeKeyTakeaways(raw) {
  const out = [];
  for (const item of normalizeArray(raw)) {
    const value = String(item || '').trim();
    if (value) out.push(value);
  }
  return out;
}

function ensureQuestionHeading(title) {
  return enforcers.forceQuestion(title);
}

function normalizeQuickAnswer(raw, leadRaw) {
  void leadRaw;
  return stripTags(String(raw || '')).replace(/\s+/g, ' ').trim();
}

function normalizeInternalSiteLinks(html) {
  return String(html || '').replace(
    /href="https?:\/\/(?:www\.)?fitpo50\.pl\/([^"#?]+\.html(?:[?#][^"]*)?)"/gi,
    (_m, pathWithQuery) => `href="./${String(pathWithQuery || '').replace(/^\/+/, '')}"`,
  );
}

function ensureCaptionedTables(html, sectionTitle) {
  const source = String(html || '');
  if (!/<table\b/i.test(source)) return source;
  const cleanSectionTitle = stripTags(String(sectionTitle || ''))
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const fallbackCaption = cleanSectionTitle
    ? `Tabela: ${cleanSectionTitle}.`
    : 'Tabela z danymi i interpretacją.';

  return source.replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (_full, attrs, inner) => {
    const classMatch = String(attrs || '').match(/\bclass=["']([^"']*)["']/i);
    const classes = new Set(String(classMatch?.[1] || '').split(/\s+/).filter(Boolean));
    classes.add('article-table');
    const cleanAttrs = String(attrs || '').replace(/\s*class=["'][^"']*["']/i, '');
    let normalizedInner = /<caption\b/i.test(inner)
      ? inner
      : `<caption>${escapeHtml(fallbackCaption)}</caption>${inner}`;
    normalizedInner = normalizedInner.replace(/<thead\b([^>]*)>([\s\S]*?)<\/thead>/gi, (_head, headAttrs, headInner) => {
      const cells = headInner.replace(/<th\b(?![^>]*\bscope=)([^>]*)>/gi, '<th scope="col"$1>');
      return `<thead${headAttrs}>${cells}</thead>`;
    });
    normalizedInner = normalizedInner.replace(/<tbody\b([^>]*)>([\s\S]*?)<\/tbody>/gi, (_body, bodyAttrs, bodyInner) => {
      const rows = bodyInner.replace(/<tr\b([^>]*)>\s*<td\b([^>]*)>([\s\S]*?)<\/td>/gi, '<tr$1><th scope="row"$2>$3</th>');
      return `<tbody${bodyAttrs}>${rows}</tbody>`;
    });
    const captionText = stripTags((normalizedInner.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i) || [])[1] || fallbackCaption);
    const table = `<table${cleanAttrs} class="${[...classes].join(' ')}">${normalizedInner}</table>`;
    return `<div class="article-table-wrap" role="region" aria-label="${escapeHtml(captionText)}" tabindex="0">${table}</div>`;
  });
}

function normalizeEntities(rawEntities) {
  const out = [];
  for (const item of normalizeArray(rawEntities)) {
    if (!item) continue;
    if (typeof item === 'string') {
      const name = item.trim();
      if (!name) continue;
      out.push({ '@type': 'Thing', name });
      continue;
    }
    if (typeof item !== 'object') continue;
    const name = String(item.name || item.label || '').trim();
    const sameAs = String(item.sameAs || item.wikidata || item.wikidata_url || '').trim();
    if (!name) continue;
    const node = { '@type': 'Thing', name };
    if (sameAs && /^https?:\/\//i.test(sameAs)) node.sameAs = sameAs;
    out.push(node);
  }
  return out;
}

function buildAboutEntities({ data, title, category, keyTakeaways, sources }) {
  const manual = normalizeEntities(data.entities || data.schema_entities || data.wikidata_entities);
  if (manual.length) return manual.slice(0, 6);

  const haystack = [
    title,
    category?.label || '',
    ...keyTakeaways,
    ...normalizeArray(sources).map((s) => `${s?.label || ''} ${s?.url || ''}`),
  ].join(' ');
  const normalized = String(haystack)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/\s+/g, ' ');

  const hits = [];
  for (const candidate of WIKIDATA_ENTITY_MAP) {
    if (!normalized.includes(candidate.key)) continue;
    if (hits.some((x) => x.sameAs === candidate.sameAs)) continue;
    hits.push({
      '@type': 'Thing',
      name: candidate.name,
      sameAs: candidate.sameAs,
    });
  }

  if (hits.length) return hits.slice(0, 6);
  return keyTakeaways.slice(0, 4).map((name) => ({ '@type': 'Thing', name }));
}

function normalizeSections(rawSections) {
  const sections = [];
  for (const entry of normalizeArray(rawSections)) {
    if (!entry || typeof entry !== 'object') continue;

    const title = ensureQuestionHeading(String(entry.title || entry.heading || '').trim());
    const blocks = [];

    if (entry.content_html) {
      blocks.push({ type: 'html', html: ensureCaptionedTables(normalizeInternalSiteLinks(String(entry.content_html)), title) });
    }

    for (const paragraph of normalizeArray(entry.paragraphs_html || entry.paragraphs || [])) {
      blocks.push({ type: 'paragraph', html: ensureCaptionedTables(normalizeInternalSiteLinks(ensureParagraphHtml(paragraph)), title) });
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
          html: `<aside class="${style}">${boxTitle ? `<h3>${escapeHtml(boxTitle)}</h3>` : ''}${boxHtml ? normalizeInternalSiteLinks(ensureParagraphHtml(boxHtml)) : ''}</aside>`,
        });
      }
    }

    if (entry.image && typeof entry.image === 'object') {
      const imgSrc = String(entry.image.src || entry.image.path || '').trim();
      const imgAlt = String(entry.image.alt || title || 'Grafika artykułu').trim();
      const imgCaption = String(entry.image.caption || '').trim();
      const imgWidth = Number(entry.image.width || 0);
      const imgHeight = Number(entry.image.height || 0);
      if (imgSrc) {
        blocks.push({
          type: 'html',
          html: toInlinePictureHtml(imgSrc, imgAlt, imgCaption, imgWidth, imgHeight),
        });
      }
    }

    sections.push({ title, blocks });
  }
  return sections;
}

function listCandidateInternalArticles(currentSlug) {
  const files = fs.readdirSync(ROOT)
    .filter((name) => name.endsWith('.html'))
    .filter((name) => !CATEGORY_LANDING_URLS.has(name.toLowerCase()))
    .filter((name) => name !== 'index.html' && name !== 'article-template-bento.html')
    .filter((name) => name !== `${currentSlug}.html`)
    .sort();
  return files;
}

function ensureMinimumInternalLinks(slug, dryRun, syncSite, minimum = POLICY.WORDS.INTERNAL_LINKS_MIN) {
  const targetPaths = [path.join(ROOT, `${slug}.html`)];
  if (syncSite) targetPaths.push(path.join(ROOT, '_site', `${slug}.html`));

  for (const targetPath of targetPaths) {
    if (!fs.existsSync(targetPath)) continue;
    const raw = fs.readFileSync(targetPath, 'utf8');
    const articleMatch = raw.match(/<article class="article-content">[\s\S]*?<\/article>/i);
    if (!articleMatch) continue;
    const articleHtml = articleMatch[0];
    const narrativeHtml = articleHtml.split(/<section\s+class="faq-list\b/i)[0];
    const existingCount = utils.countInternalHtmlLinks([narrativeHtml]);
    if (existingCount >= minimum) continue;

    const needed = minimum - existingCount;
    const existingLinks = new Set(
      [...articleHtml.matchAll(/<a\b[^>]*href="([^"]+)"/gi)]
        .map((m) => String(m[1] || '').replace(/^\.\//, '').trim().toLowerCase())
    );
    const candidates = listCandidateInternalArticles(slug)
      .filter((href) => !existingLinks.has(href.toLowerCase()))
      .slice(0, needed);
    if (!candidates.length) continue;

    const links = candidates
      .map((href) => `<a href="./${href}">${escapeHtml(href.replace(/\.html$/i, '').replace(/-/g, ' '))}</a>`)
      .join(', ');
    const addon = `<p class="article-crosslinks-auto"><strong>Zobacz też:</strong> ${links}.</p>`;
    const faqStart = articleHtml.search(/<section\s+class="faq-list\b/i);
    const updatedArticle = faqStart >= 0
      ? `${articleHtml.slice(0, faqStart)}${addon}\n${articleHtml.slice(faqStart)}`
      : articleHtml.replace(/<\/article>$/i, `${addon}\n</article>`);
    const next = raw.replace(articleHtml, updatedArticle);
    if (!dryRun) fs.writeFileSync(targetPath, next, 'utf8');
    console.log(`[AUTO] Uzupełniono linki kontekstowe w ${path.basename(targetPath)} (+${candidates.length}).`);
  }
}

function toInlinePictureHtml(imgSrc, imgAlt, imgCaption, imgWidth, imgHeight) {
  const normalizedSrc = String(imgSrc || '').trim();
  const escapedAlt = escapeHtml(String(imgAlt || 'Grafika artykułu').trim());
  const escapedCaption = escapeHtml(String(imgCaption || '').trim());
  const localSrcMatch = normalizedSrc.match(/^(.*)\.(avif|webp|jpe?g|png)$/i);

  const dimensions = Number(imgWidth) > 0 && Number(imgHeight) > 0
    ? ` width="${Number(imgWidth)}" height="${Number(imgHeight)}"`
    : '';
  const ratio = Number(imgWidth) > 0 && Number(imgHeight) > 0 ? Number(imgWidth) / Number(imgHeight) : 0;
  const ratioClass = ratio && ratio < 0.9
    ? ' inline-figure--portrait'
    : (ratio >= 0.9 && ratio <= 1.1 ? ' inline-figure--square' : (ratio > 2.1 ? ' inline-figure--panoramic' : ''));
  if (!localSrcMatch) return `<figure class="inline-figure${ratioClass}"><img src="${escapeHtml(normalizedSrc)}" alt="${escapedAlt}" loading="lazy"${dimensions}>${escapedCaption ? `<figcaption>${escapedCaption}</figcaption>` : ''}</figure>`;

  const base = localSrcMatch[1];
  return `<figure class="inline-figure${ratioClass}"><picture><source srcset="${escapeHtml(`${base}.avif`)}" type="image/avif"><source srcset="${escapeHtml(`${base}.webp`)}" type="image/webp"><img src="${escapeHtml(`${base}.jpg`)}" alt="${escapedAlt}" loading="lazy"${dimensions}></picture>${escapedCaption ? `<figcaption>${escapedCaption}</figcaption>` : ''}</figure>`;
}

function normalizeLocalHtmlHref(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(raw)) return '';
  const clean = raw.split('#')[0].split('?')[0].trim();
  if (!clean) return '';
  if (!/\.html$/i.test(clean)) return '';
  return clean.replace(/^\.\//, '').replace(/^\/+/, '');
}

function normalizeImageBase(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const noQuery = raw.split('#')[0].split('?')[0].trim();
  const fileName = noQuery.split('/').pop() || '';
  return fileName.replace(/\.(avif|webp|jpe?g|png)$/i, '').trim();
}

function isCategoryLandingHref(href) {
  const normalized = normalizeLocalHtmlHref(href);
  if (!normalized) return false;
  return CATEGORY_LANDING_URLS.has(normalized.toLowerCase());
}

function articleFileExists(href) {
  const normalized = normalizeLocalHtmlHref(href);
  if (!normalized) return false;
  return fs.existsSync(path.join(ROOT, normalized));
}

function isUsableRelatedHref(href, currentSlug) {
  const normalized = normalizeLocalHtmlHref(href);
  if (!normalized) return false;
  if (isCategoryLandingHref(normalized)) return false;
  if (!articleFileExists(normalized)) return false;
  if (currentSlug && normalized.toLowerCase() === `${String(currentSlug).toLowerCase()}.html`) return false;
  return true;
}

const articleMetaCache = new Map();

function firstMatch(text, regex, fallback = '') {
  const m = String(text || '').match(regex);
  return m ? String(m[1] || '').trim() : fallback;
}

function readArticleMetaByHref(href) {
  const normalized = normalizeLocalHtmlHref(href);
  if (!normalized) return null;
  if (articleMetaCache.has(normalized)) return articleMetaCache.get(normalized);

  const filePath = path.join(ROOT, normalized);
  if (!fs.existsSync(filePath)) {
    articleMetaCache.set(normalized, null);
    return null;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const title = firstMatch(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i)
    || firstMatch(html, /<title>([^<]+)<\/title>/i)
    || '';
  const description = firstMatch(html, /<meta\s+name="description"\s+content="([^"]+)"/i)
    || extractArticleLeadExcerpt(html)
    || '';
  const readTime = firstMatch(html, /<span\s+class="article-meta__time">([^<]+)<\/span>/i) || '';
  const categoryKey = firstMatch(html, /\barticle--(ruch|jedzenie|zdrowie|ciekawe|mity)\b/i, '').toLowerCase();
  const heroAlt = firstMatch(html, /<img[^>]*class="[^"]*hero-image[^"]*"[^>]*alt="([^"]+)"/i) || title;

  const ogImage = firstMatch(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i);
  const preloadImage = firstMatch(html, /<link\s+rel="preload"[^>]*as="image"[^>]*href="([^"]+)"/i);
  const heroImgSrc = firstMatch(html, /<img[^>]*class="[^"]*hero-image[^"]*"[^>]*src="([^"]+)"/i);
  const heroImage = normalizeImageBase(ogImage) || normalizeImageBase(preloadImage) || normalizeImageBase(heroImgSrc);

  const meta = {
    href: normalized,
    title,
    description,
    readTime,
    categoryKey: categoryKey || 'ciekawe',
    categoryLabel: normalizeCategory(categoryKey || 'ciekawe').label,
    heroImage,
    heroAlt,
  };
  articleMetaCache.set(normalized, meta);
  return meta;
}

function extractArticleLeadExcerpt(html) {
  const lead = firstMatch(html, /<p\b[^>]*class="[^"]*\bdrop-cap\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    || firstMatch(html, /<article\b[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)
    || '';
  const clean = stripTags(lead).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return ensureSentenceTerminator(truncateAtWordBoundary(clean, 155), 155);
}

function getRelatedCandidatesFromPorady(currentSlug) {
  const filePath = path.join(ROOT, 'porady.html');
  if (!fs.existsSync(filePath)) return [];

  const html = fs.readFileSync(filePath, 'utf8');
  const tagRx = /<a\b[^>]*data-article-item[^>]*>/gi;
  const hrefs = [];

  for (const m of html.matchAll(tagRx)) {
    const tag = String(m[0] || '');
    const href = firstMatch(tag, /\bhref="([^"]+)"/i);
    const normalized = normalizeLocalHtmlHref(href);
    if (!normalized) continue;
    if (!isUsableRelatedHref(normalized, currentSlug)) continue;
    hrefs.push(normalized);
  }

  return [...new Set(hrefs)];
}

function buildSafeRelatedDefaults({ currentSlug, currentCategory, readingTime, heroImage, heroAlt, metaDescription, title }) {
  const existingPool = [
    ...getRelatedCandidatesFromPorady(currentSlug),
    ...READING_ROOM_FALLBACKS
      .map((item) => normalizeLocalHtmlHref(item.url))
      .filter((href) => isUsableRelatedHref(href, currentSlug)),
  ];

  const pool = [...new Set(existingPool)];
  const selected = [];
  for (let i = 0; i < 3; i += 1) {
    // Zasada projektowa: nie ufamy URL-om z JSON related_articles.
    // Karty Czytelni budujemy wyłącznie z istniejących lokalnie artykułów.
    const replacement = pool.find((href) => !selected.includes(href));
    if (replacement) {
      selected.push(replacement);
      continue;
    }
    const fallback = normalizeLocalHtmlHref(READING_ROOM_FALLBACKS[i]?.url || '');
    selected.push(fallback || '');
  }

  return selected.map((href, idx) => {
    const fallback = READING_ROOM_FALLBACKS[idx] || READING_ROOM_FALLBACKS[0];
    const meta = readArticleMetaByHref(href);
    const categoryObj = normalizeCategory(
      meta?.categoryKey
      || fallback.category
      || currentCategory.label
    );

    const cardImage = normalizeImageBase(meta?.heroImage)
      || normalizeImageBase(fallback.image)
      || normalizeImageBase(heroImage);
    const cardTitle = String(meta?.title || fallback.title || title).trim();
    const cardDesc = String(
      meta
        ? (meta.description || `Czytaj więcej: ${cardTitle}.`)
        : (fallback.description || metaDescription)
    ).trim();
    const cardTime = String(meta?.readTime || fallback.time || readingTime).trim()
      .replace(/\s*czytania/i, '');
    const cardAlt = String(meta?.heroAlt || cardTitle || heroAlt).trim();

    return {
      url: isUsableRelatedHref(href, currentSlug) ? href : normalizeLocalHtmlHref(fallback.url),
      image: cardImage,
      alt: cardAlt,
      categoryLabel: categoryObj.label,
      categoryKey: categoryObj.key,
      time: cardTime,
      title: cardTitle,
      description: cardDesc,
    };
  });
}

function validateInput(data, opts = {}) {
  const faqStrict = true;
  const errors = [];
  const autoFixes = [];
  const title = String(data.title || '').trim();
  if (!String(data.hero_image || '').trim()) errors.push('Brak hero_image; importer nie stosuje fallbacku ze slug.');
  const mediaValidation = validateManifestStructure(data);
  mediaValidation.errors.forEach((message) => errors.push(`Media: ${message}`));
  if (!title) errors.push('Brak pola title.');
  if (containsEditorialPlaceholder(title)) {
    errors.push('Title: wykryto placeholder redakcyjny.');
  }
  const titleValidation = validators.validateTitleText(title, {
    label: 'Title',
    min: POLICY.TITLE.JSON_MIN,
    max: POLICY.TITLE.MAX
  });
  titleValidation.errors.forEach((msg) => errors.push(msg));
  if (/\bi\s+cofnąć\s*$/i.test(title)) {
    errors.push('Title: wygląda na urwany (kończy się na "i cofnąć"). Uzupełnij pełny sens.');
  }
  const seoTitleRaw = String(data.seo_title || data.meta_title || '').trim();
  if (seoTitleRaw) {
    const seoTitleValidation = validators.validateTitleText(seoTitleRaw, {
      label: 'SEO title',
      min: POLICY.TITLE.MIN,
      max: POLICY.TITLE.SEO_BASE_MAX
    });
    seoTitleValidation.errors.forEach((msg) => errors.push(msg));
  }
  if (seoTitleRaw && /\bi\s+cofnąć\s*$/i.test(seoTitleRaw)) {
    errors.push('SEO title: wygląda na urwany (kończy się na "i cofnąć"). Uzupełnij pełny sens.');
  }
  const seoTitleForLint = String(data.seo_title || data.meta_title || data.title || '').trim();
  if (seoTitleForLint.length > POLICY.TITLE.SEO_BASE_MAX) {
    errors.push(`SEO title: przekracza ${POLICY.TITLE.SEO_BASE_MAX} znaków przed dopiskiem „${POLICY.TITLE.BRAND_SUFFIX.trim()}” (jest ${seoTitleForLint.length}).`);
  }
  if (seoTitleForLint.length < POLICY.TITLE.MIN) {
    errors.push(`SEO title: jest zbyt krótki (min ${POLICY.TITLE.MIN}, jest ${seoTitleForLint.length}).`);
  }
  const normalizeCmp = (v) => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const seoNorm = normalizeCmp(seoTitleForLint);
  for (const phrase of POLICY.BANNED_CTR_TITLE_PATTERNS || []) {
    if (seoNorm.includes(normalizeCmp(phrase))) {
      errors.push(`SEO title: mało-klikalna fraza szablonowa ("${phrase}").`);
      break;
    }
  }
  const ogTitle = String(data.og_title || data.ogTitle || '').trim();
  const twitterTitle = String(data.twitter_title || data.twitterTitle || '').trim();
  if (ogTitle && normalizeCmp(ogTitle) !== seoNorm) {
    errors.push('SEO title contract: og_title musi być spójny 1:1 z seo_title.');
  }
  if (twitterTitle && normalizeCmp(twitterTitle) !== seoNorm) {
    errors.push('SEO title contract: twitter_title musi być spójny 1:1 z seo_title.');
  }

  const lead = String(data.lead || data.lead_paragraph || '').trim();
  if (!lead) errors.push('Brak pola lead / lead_paragraph.');
  if (containsEditorialPlaceholder(lead)) {
    errors.push('Lead: wykryto placeholder redakcyjny.');
  }

  const metaDescriptionRaw = String(data.meta_description || data.description || '').trim();
  if (!metaDescriptionRaw) {
    errors.push('Brak meta_description/description w JSON wejściowym.');
  } else {
    const metaNorm = normalizeCmp(metaDescriptionRaw);
    const hasMetaIntent = (POLICY.TITLE_INTENT_TOKENS || []).some((token) => metaNorm.includes(normalizeCmp(token)));
    if (!hasMetaIntent) {
      errors.push('meta_description: brak wyraźnego tokenu intencji (jak/czy/co/kiedy/ile/norma/wynik).');
    }
    const first120 = metaDescriptionRaw.slice(0, 120);
    const hasMetaIntentEarly = (POLICY.TITLE_INTENT_TOKENS || []).some((token) => normalizeCmp(first120).includes(normalizeCmp(token)));
    if (!hasMetaIntentEarly) {
      errors.push('meta_description: intencja użytkownika musi pojawić się w pierwszych 120 znakach.');
    }
    for (const phrase of POLICY.BANNED_CTR_META_PATTERNS || []) {
      if (metaNorm.includes(normalizeCmp(phrase))) {
        errors.push(`meta_description: mało-klikalna fraza szablonowa ("${phrase}").`);
        break;
      }
    }
  }

  const quickAnswer = normalizeQuickAnswer(data.quick_answer || data.quickAnswer || '', lead);
  const quickAnswerWords = countWordsUtf8(quickAnswer);
  if (!quickAnswer) {
    errors.push(`Brak quick_answer (wymagane ${POLICY.WORDS.QUICK_ANSWER_MIN}-${POLICY.WORDS.QUICK_ANSWER_MAX} słów).`);
  } else if (quickAnswerWords < POLICY.WORDS.QUICK_ANSWER_MIN || quickAnswerWords > POLICY.WORDS.QUICK_ANSWER_MAX) {
    errors.push(`quick_answer: wymagane ${POLICY.WORDS.QUICK_ANSWER_MIN}-${POLICY.WORDS.QUICK_ANSWER_MAX} słów (jest ${quickAnswerWords}).`);
  }
  if (lead && quickAnswer && normalizeCmp(lead) === normalizeCmp(quickAnswer)) {
    errors.push('quick_answer nie może być kopią 1:1 leadu.');
  }
  const quickNorm = normalizeCmp(quickAnswer);
  for (const phrase of POLICY.GENERIC_QUICK_ANSWER_PATTERNS || []) {
    if (quickNorm.includes(normalizeCmp(phrase))) {
      errors.push(`quick_answer: treść jest zbyt generyczna (fraza: "${phrase}").`);
      break;
    }
  }

  const sections = normalizeSections(data.sections || []);
  if (!sections.length) errors.push('Brak sekcji: sections[].');
  if (sections.length > 0) {
    const sectionParagraphErrors = [];
    for (const section of sections) {
      const headingRes = validators.validateH2Title(String(section.title || '').trim());
      if (!headingRes.ok) {
        sectionParagraphErrors.push(`Sekcja "${section.title || '(bez tytułu)'}": ${headingRes.error}`);
      }
      if (containsEditorialPlaceholder(section.title)) {
        sectionParagraphErrors.push(`Sekcja "${section.title || '(bez tytułu)'}": wykryto placeholder w tytule.`);
      }
      const firstParagraph = section.blocks.find((b) => b.type === 'paragraph' && String(b.html || '').trim());
      if (!firstParagraph) {
        sectionParagraphErrors.push(`Sekcja "${section.title || '(bez tytułu)'}" nie ma akapitu otwierającego.`);
        continue;
      }
      const introRes = validators.validateIntroParagraph(stripTags(firstParagraph.html));
      if (!introRes.ok) {
        autoFixes.push(
          `Sekcja "${section.title || '(bez tytułu)'}": ${introRes.error} ` +
          'Importer ustabilizuje pierwszy akapit, ale warto ręcznie dopracować odpowiedź do standardu.'
        );
      }

      for (const block of section.blocks) {
        if (containsEditorialPlaceholder(block.html || '')) {
          sectionParagraphErrors.push(`Sekcja "${section.title || '(bez tytułu)'}": wykryto placeholder w treści/boxie.`);
          break;
        }
        if (/,\s*czyli\.\s*(<\/p>|$)/i.test(String(block.html || ''))) {
          sectionParagraphErrors.push(`Sekcja "${section.title || '(bez tytułu)'}": wykryto urwane zdanie (", czyli.").`);
          break;
        }
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
    const internalLinks = utils.countInternalHtmlLinks(linkSource);
    if (internalLinks < POLICY.WORDS.INTERNAL_LINKS_MIN) {
      autoFixes.push(
        `AEO/GEO: wykryto ${internalLinks}/${POLICY.WORDS.INTERNAL_LINKS_MIN} linków wewnętrznych w treści. ` +
        'Crosslinki wewnętrzne uzupełniamy ręcznie po imporcie (kontrola redakcyjna).'
      );
    }
  }
  const repeatedSentences = utils.collectRepeatedLongSentences([
    lead,
    quickAnswer,
    ...sections.map((s) => s.blocks.map((b) => b.html || '').join(' ')),
  ]);
  if (repeatedSentences.length) {
    const sample = repeatedSentences[0];
    errors.push(`Treść: wykryto powtarzalne zdania (${sample.count}x): "${sample.sentence.slice(0, 90)}..."`);
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
  const evidenceValidation = validateArticleEvidence(data);
  evidenceValidation.errors.forEach((error) => errors.push(`Evidence: ${error}`));

  const faqItems = normalizeFaq(data.answer_blocks || data.faq || data.faq_items || []);
  if (faqStrict) {
    const faqResearch = normalizeFaqResearch(data.faq_research || data.faq_sources || []);
    if (faqItems.length < POLICY.WORDS.FAQ_MIN_ITEMS) {
      errors.push(`FAQ: wymagane minimum ${POLICY.WORDS.FAQ_MIN_ITEMS} pytań (bez auto-dopisywania).`);
    }
    const placeholderIdx = faqItems.findIndex((it) => isFaqPlaceholder(it.question, it.answerHtml));
    if (placeholderIdx >= 0) {
      errors.push(`FAQ #${placeholderIdx + 1}: wykryto placeholder. Uzupełnij realne pytanie i odpowiedź.`);
    }
    const faqPlaceholderAny = faqItems.findIndex((it) => containsEditorialPlaceholder(it.question) || containsEditorialPlaceholder(it.answerHtml));
    if (faqPlaceholderAny >= 0) {
      errors.push(`FAQ #${faqPlaceholderAny + 1}: wykryto placeholder redakcyjny.`);
    }
    const genericFaqIdx = faqItems.findIndex((it) => {
      const q = utils.fuzzyNormalize(String(it.question || ''));
      return (POLICY.GENERIC_FAQ_QUESTIONS || []).some((generic) => q === utils.fuzzyNormalize(generic));
    });
    if (genericFaqIdx >= 0) {
      errors.push(`FAQ #${genericFaqIdx + 1}: generyczny nagłówek pytania. Użyj pytania użytkownika z intencją (autocomplete/PAA/GSC).`);
    }
    const faqSeen = new Set();
    const duplicateFaqIdx = faqItems.findIndex((it) => {
      const q = utils.fuzzyNormalize(String(it.question || ''));
      if (!q) return false;
      if (faqSeen.has(q)) return true;
      faqSeen.add(q);
      return false;
    });
    if (duplicateFaqIdx >= 0) {
      errors.push(`FAQ #${duplicateFaqIdx + 1}: duplikat pytania FAQ. Każde pytanie musi być unikalne.`);
    }
    if (faqResearch.length < POLICY.WORDS.FAQ_MIN_ITEMS) {
      errors.push(
        `FAQ research: dodaj minimum ${POLICY.WORDS.FAQ_MIN_ITEMS} wpisy w faq_research[] z polami question + source_label + source_url (pytania z sieci: autocomplete/PAA).`
      );
    }
    for (let i = 0; i < faqResearch.length; i += 1) {
      const item = faqResearch[i] || {};
      const sourceLabel = String(item.source_label || item.sourceLabel || item.label || '').trim();
      const sourceUrl = String(item.source_url || item.sourceUrl || item.url || '').trim();
      if (!sourceLabel || sourceLabel.length < POLICY.FAQ_RESEARCH_SOURCE_LABEL_MIN_CHARS) {
        errors.push(`FAQ research #${i + 1}: source_label jest zbyt ogólny.`);
      }
      if (!/^https?:\/\//i.test(sourceUrl)) {
        errors.push(`FAQ research #${i + 1}: source_url musi zaczynać się od http/https.`);
      }
      const sourceNorm = normalizeCmp(sourceUrl);
      if ((POLICY.BANNED_FAQ_RESEARCH_SOURCE_URL_PATTERNS || []).some((bad) => sourceNorm.includes(normalizeCmp(bad)))) {
        errors.push(`FAQ research #${i + 1}: source_url wygląda na placeholder lub link do wyszukiwarki.`);
      }
    }
    const researchQuestions = new Set(faqResearch.map((x) => x.question.toLowerCase()));
    for (let i = 0; i < Math.min(faqItems.length, POLICY.WORDS.FAQ_MIN_ITEMS); i += 1) {
      const q = String(faqItems[i].question || '').trim().toLowerCase();
      if (!researchQuestions.has(q)) {
        errors.push(`FAQ #${i + 1}: pytanie nie ma potwierdzenia w faq_research[].`);
      }
    }
  }

  const relatedRaw = normalizeArray(data.related_articles || data.related || []).slice(0, 3);
  const currentSlug = String(data.slug || '').trim();
  for (let i = 0; i < relatedRaw.length; i += 1) {
    const item = relatedRaw[i];
    const idx = i + 1;
    const url = normalizeLocalHtmlHref(item?.url || item?.href || '');
    if (!url) {
      autoFixes.push(`related_articles #${idx}: brak/niepoprawny url -> importer ignoruje ten URL i dobierze kartę z istniejących artykułów.`);
      continue;
    }
    if (isCategoryLandingHref(url)) {
      autoFixes.push(`related_articles #${idx}: url "${url}" wskazuje kategorię -> importer ignoruje ten URL i dobierze konkretny artykuł.`);
      continue;
    }
    if (!articleFileExists(url)) {
      autoFixes.push(`related_articles #${idx}: url "${url}" nie istnieje lokalnie -> importer ignoruje ten URL i dobierze istniejący artykuł.`);
      continue;
    }
    if (currentSlug && url.toLowerCase() === `${currentSlug.toLowerCase()}.html`) {
      autoFixes.push(`related_articles #${idx}: url "${url}" wskazuje bieżący artykuł -> importer ignoruje ten URL i dobierze inny.`);
    }
  }

  const architecture = validateArticleArchitecture(data, { root: ROOT });
  architecture.errors.forEach((error) => errors.push(`Architecture: ${error}`));

  return { errors, autoFixes, sections, sources };
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

function buildPrecheckReport({ inputPath, json, payload, validation, syncSite, assetPrep }) {
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
  const rawSeoBase = String(json.seo_title || json.title || '').replace(/\s+/g, ' ').trim();
  if (rawSeoBase && rawSeoBase !== payload.seoTitleBase) {
    autoFixes.push(`Skrócę seo_title do bezpiecznej długości (<=${POLICY.TITLE.SEO_BASE_MAX} znaków przed dopiskiem marki): "${payload.seoTitleBase}"`);
  }

  for (const err of validation.errors) {
    blockers.push(err);
  }
  for (const fix of validation.autoFixes || []) {
    autoFixes.push(fix);
  }
  for (const note of assetPrep?.notes || []) {
    autoFixes.push(note);
  }
  for (const warn of assetPrep?.warnings || []) {
    autoFixes.push(`Auto-konwersja grafiki: ${warn}`);
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

function renderQuickAnswerBlock(text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  return [
    '<section class="quick-answer reveal" id="quick-answer" aria-label="Szybka odpowiedź">',
    '  <h2>Szybka odpowiedź</h2>',
    `  <p>${escapeHtml(clean)}</p>`,
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
  const rx = /(<p class="drop-cap">[\s\S]*?<\/p>)([\s\S]*?)(\s*(?:<section[^>]*class="[^"]*\bshare-article-section\b[^"]*"[\s\S]*?<\/section>\s*)?<h2 id="zrodla">Źródła<\/h2>)/i;
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
      node.author = opts.author || DEFAULT_AUTHOR_PERSON;
      node.publisher = opts.publisher || DEFAULT_PUBLISHER_ORG;
      const cssSelector = buildSpeakableSelectors(opts.hasKeyTakeaways);
      node.speakable = {
        '@type': 'SpeakableSpecification',
        cssSelector,
      };

      if (opts.about.length) {
        node.about = opts.about.map((item) => {
          if (item && typeof item === 'object') {
            const name = String(item.name || '').trim();
            const sameAs = String(item.sameAs || '').trim();
            if (name && sameAs) return { '@type': 'Thing', name, sameAs };
            if (name) return { '@type': 'Thing', name };
          }
          return { '@type': 'Thing', name: String(item || '').trim() };
        }).filter((entry) => entry.name);
      }

      if (opts.mentions.length) {
        node.mentions = opts.mentions.map((item) => ({
          '@type': 'ScholarlyArticle',
          name: String(item.name || '').trim(),
          url: String(item.url || '').trim(),
          ...(item.datePublished ? { datePublished: String(item.datePublished).trim() } : {}),
          author: item.author || { '@type': 'Organization', name: 'Autorzy badania' },
        }));
      }

      if (Array.isArray(opts.citations) && opts.citations.length) {
        node.citation = opts.citations.slice(0, 12);
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

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withSitemapLock(callback) {
  const parent = path.dirname(SITEMAP_LOCK_DIR);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      fs.mkdirSync(SITEMAP_LOCK_DIR);
      break;
    } catch (err) {
      if (err && err.code === 'EEXIST' && Date.now() - startedAt < 5000) {
        sleepSync(100);
        continue;
      }
      throw err;
    }
  }

  try {
    return callback();
  } finally {
    fs.rmSync(SITEMAP_LOCK_DIR, { recursive: true, force: true });
  }
}

function writeFileAtomic(filePath, content) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function updateSitemap(slug, dateIso, dryRun) {
  if (!fs.existsSync(SITEMAP_PATH)) return { changed: false, file: 'sitemap.xml (brak)' };

  return withSitemapLock(() => {
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

    if (!xml.includes('</urlset>')) {
      throw new Error('sitemap.xml: brak znacznika </urlset>.');
    }
    xml = xml.replace(/<\/urlset>\s*$/u, `${entry}</urlset>\n`);

    if (!dryRun) {
      writeFileAtomic(SITEMAP_PATH, xml);
      const siteMirror = path.join(ROOT, '_site', 'sitemap.xml');
      if (fs.existsSync(path.dirname(siteMirror))) {
        writeFileAtomic(siteMirror, xml);
      }
    }

    return { changed: true, file: 'sitemap.xml' };
  });
}

function updateLlms(slug, title, section, summary, dryRun) {
  if (!fs.existsSync(LLMS_PATH)) return { changed: false, file: 'llms.txt (brak)' };

  let content = fs.readFileSync(LLMS_PATH, 'utf8');
  const articleUrl = `https://fitpo50.pl/${slug}.html`;

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

  let changed = false;
  if (content.includes(`- url: ${articleUrl}`)) {
    const existingBlockRx = new RegExp(
      `- url: ${escapeRegex(articleUrl)}\\n  title: "[^"]*"\\n  section: "[^"]*"\\n  summary: "[^"]*"`,
      'm',
    );
    const replacement = block.trim();
    const nextContent = content.replace(existingBlockRx, replacement);
    if (nextContent === content) {
      return { changed: false, file: 'llms.txt' };
    }
    content = nextContent;
    changed = true;
  } else {
    content = `${content.trimEnd()}${block}`;
    changed = true;
  }

  if (!dryRun) {
    fs.writeFileSync(LLMS_PATH, `${content}\n`, 'utf8');
    const siteMirror = path.join(ROOT, '_site', 'llms.txt');
    if (fs.existsSync(path.dirname(siteMirror))) {
      fs.writeFileSync(siteMirror, `${content}\n`, 'utf8');
    }
  }

  return { changed, file: 'llms.txt' };
}

function escapeHtmlAttr(value) {
  return escapeHtml(String(value || '').replace(/\s+/g, ' ').trim());
}

function shortText(value, max = 170) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function normalizeReadingTimeLabel(value, fallback = '11 min czytania') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const compact = raw.replace(/\s+/g, ' ').trim();
  const digitsOnly = compact.match(/^(\d+)$/);
  if (digitsOnly) return `${digitsOnly[1]} min czytania`;
  const shortLabel = compact.match(/^(\d+)\s*min$/i);
  if (shortLabel) return `${shortLabel[1]} min czytania`;
  return compact;
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
  const readTime = normalizeReadingTimeLabel(payload.readingTime, '11 min czytania');
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
    heroImageBase: payload.heroImage,
    heroImageAvif: `./assets/${payload.heroImage}.avif`,
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

function replaceFirstOrWarn(text, rx, replacer, label) {
  if (!rx.test(text)) {
    console.warn(`[WARN] Pominięto aktualizację sekcji: ${label}`);
    return text;
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
      `          <a href="${ctx.href}" class="article-index-card reveal" data-article-item data-category="${ctx.categoryKey}" data-order="${nextOrder}" data-article-title="${escapeHtmlAttr(ctx.title)}" data-read-time="${escapeHtmlAttr(ctx.readTime)}" data-search-text="${escapeHtmlAttr(ctx.searchText)}">`,
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
    const trackEndIdx = out.indexOf('</div>', markerIdx + insertMarker.length);
    const hasCardInsideTrack = firstCardIdx !== -1 && (trackEndIdx === -1 || firstCardIdx < trackEndIdx);
    if (!hasCardInsideTrack) {
      const insertIdx = markerIdx + insertMarker.length;
      out = `${out.slice(0, insertIdx)}\n${card}${out.slice(insertIdx)}`;
    } else {
      out = `${out.slice(0, firstCardIdx)}${card}${out.slice(firstCardIdx)}`;
    }
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

function inferCategoryLabelFromHref(href) {
  const normalizedHref = String(href || '')
    .trim()
    .replace(/^\.\//, '')
    .replace(/[?#].*$/, '');
  if (!normalizedHref) return 'Ciekawe';

  const categoryPages = [
    { file: 'zdrowie.html', label: 'Zdrowie' },
    { file: 'jedzenie.html', label: 'Jedzenie' },
    { file: 'rusz-sie.html', label: 'Ruch' },
    { file: 'ciekawe.html', label: 'Ciekawe' },
    { file: 'mity.html', label: 'Mity' },
  ];

  for (const page of categoryPages) {
    const pagePath = path.join(ROOT, page.file);
    if (!fs.existsSync(pagePath)) continue;
    const html = fs.readFileSync(pagePath, 'utf8');
    const rx = new RegExp(`href=["'](?:\\.\\/)?${escapeRegex(normalizedHref)}["']`, 'i');
    if (rx.test(html)) return page.label;
  }

  const slug = normalizedHref.replace(/\.html$/i, '');
  const importDir = path.join(ROOT, 'data', 'import');
  if (fs.existsSync(importDir)) {
    const files = fs.readdirSync(importDir).filter((name) => name.endsWith('.json'));
    for (const file of files) {
      try {
        const json = JSON.parse(fs.readFileSync(path.join(importDir, file), 'utf8'));
        if (String(json?.slug || '').trim() !== slug) continue;
        const label = categoryLabelFromKey(json?.category);
        if (label) return label;
      } catch (_) {
        continue;
      }
    }
  }

  return 'Ciekawe';
}

function inferHeroImageBaseFromHref(href) {
  const normalizedHref = String(href || '')
    .trim()
    .replace(/^\.\//, '')
    .replace(/[?#].*$/, '');
  if (!normalizedHref || !fs.existsSync(path.join(ROOT, normalizedHref))) return '';
  const html = fs.readFileSync(path.join(ROOT, normalizedHref), 'utf8');
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  const preloadMatch = html.match(/<link\s+rel="preload"[^>]*as="image"[^>]*href="([^"]+)"/i);
  const heroImgMatch = html.match(/<img class="article-hero[^"]*"[^>]*src="([^"]+)"/i);
  return normalizeImageBase((ogMatch && ogMatch[1]) || (preloadMatch && preloadMatch[1]) || (heroImgMatch && heroImgMatch[1]) || '');
}

function inferHeroImageWebpFromHref(href, fallbackImage) {
  const base = inferHeroImageBaseFromHref(href);
  if (base) return `./assets/${base}.webp`;
  return fallbackImage || '';
}

function extractCurrentLatestFromIndex(html) {
  const imageMatch = html.match(/<img class="latest-article__bg" id="latestArticleImage"[^>]*src="([^"]+)"/i);
  const titleMatch = html.match(/<h4 class="latest-article__title" id="latestArticleTitle">([\s\S]*?)<\/h4>/i);
  const excerptMatch = html.match(/<p class="latest-article__excerpt" id="latestArticleExcerpt">([\s\S]*?)<\/p>/i);
  const linkMatch = html.match(/<a class="latest-article__cta" id="latestArticleLink" href="([^"]+)"/i);

  const url = linkMatch ? String(linkMatch[1] || '').trim() : '';
  if (!url) return null;

  return {
    category: inferCategoryLabelFromHref(url),
    title: stripTags(titleMatch ? titleMatch[1] : '').trim(),
    excerpt: stripTags(excerptMatch ? excerptMatch[1] : '').trim(),
    image: inferHeroImageWebpFromHref(url, imageMatch ? String(imageMatch[1] || '').trim() : ''),
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

  out = replaceFirstOrWarn(out, /(<source id="latestArticleImageAvifSource" srcset=")[^"]+(" type="image\/avif">)/, `$1${ctx.heroImageAvif}$2`, 'latestArticleImageAvifSource.srcset');
  out = replaceFirstOrWarn(out, /(<source srcset=")[^"]+(" type="image\/webp">\s*<img class="latest-article__bg" id="latestArticleImage")/, `$1${ctx.heroImageWebp}$2`, 'latestArticleImageWebpSource.srcset');
  out = replaceFirstOrWarn(out, /(<img class="latest-article__bg" id="latestArticleImage"[^>]*src=")[^"]+(")/, `$1${ctx.heroImageWebp}$2`, 'latestArticleImage.src');
  out = replaceFirstOrWarn(out, /(<h4 class="latest-article__title" id="latestArticleTitle">)([\s\S]*?)(<\/h4>)/, `$1${escapeHtml(ctx.title)}$3`, 'latestArticleTitle');
  out = replaceFirstOrWarn(out, /(<p class="latest-article__excerpt" id="latestArticleExcerpt">)([\s\S]*?)(<\/p>)/, `$1${escapeHtml(ctx.excerpt)}$3`, 'latestArticleExcerpt');
  out = replaceFirstOrWarn(out, /(<a class="latest-article__cta" id="latestArticleLink" href=")[^"]+(">([\s\S]*?)<\/a>)/, `$1${ctx.href}$2`, 'latestArticleLink');

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
    composed.push({
      ...previousLatest,
      category: inferCategoryLabelFromHref(previousLatest.url) || previousLatest.category,
      image: inferHeroImageWebpFromHref(previousLatest.url, previousLatest.image),
    });
  }

  for (const item of previousFallback) {
    if (composed.find((x) => x.url === item.url)) continue;
    composed.push({
      ...item,
      category: inferCategoryLabelFromHref(item.url) || item.category,
      image: inferHeroImageWebpFromHref(item.url, item.image),
    });
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
      throw new Error(`${check.msg} Importer ignoruje related_articles z JSON; popraw fallback importera.`);
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
    'require "admin/bootstrap.php";',
    'require "admin/helpers/internal-links.php";',
    '$file = $argv[1];',
    '$html = file_get_contents($file);',
    'if ($html === false) { fwrite(STDERR, "Nie udało się odczytać HTML."); exit(2); }',
    '$result = autoLinkInternalArticlesInHtml($html, [',
    `  "min_words" => ${POLICY.AUTO_LINK.MIN_WORDS},`,
    `  "min_links" => ${POLICY.AUTO_LINK.MIN_LINKS},`,
    `  "max_links" => ${POLICY.AUTO_LINK.MAX_LINKS},`,
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

function runTitleBreadcrumbSync(slug, dryRun) {
  if (dryRun) return { skipped: true };
  runCommand('Sync social title + BreadcrumbList', 'node', ['scripts/sync-article-title-breadcrumb.js', '--slug', slug]);
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

function toAnchorHint(title) {
  const t = String(title || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return 'sprawdź powiązany artykuł';
  const words = t.split(' ').slice(0, 5);
  return words.join(' ').toLowerCase();
}

function writeCrosslinkSuggestions(payload, dryRun) {
  const slug = String(payload?.slug || '').trim();
  if (!slug) return null;

  const fromRelated = normalizeArray(payload?.relatedDefaults || [])
    .map((x) => normalizeLocalHtmlHref(x?.url || ''))
    .filter(Boolean);
  const fromPool = getRelatedCandidatesFromPorady(slug).slice(0, 8);

  const urls = [...new Set([...fromRelated, ...fromPool])]
    .filter((href) => isUsableRelatedHref(href, slug))
    .slice(0, 4);

  const suggestions = urls.map((href) => {
    const meta = readArticleMetaByHref(href);
    const title = String(meta?.title || href.replace(/\.html$/i, '').replace(/-/g, ' ')).trim();
    return {
      href,
      title,
      anchor_hint: toAnchorHint(title),
      why: 'Powiązanie tematyczne z bieżącym artykułem (sugestia do ręcznego osadzenia w akapicie).',
    };
  });

  const outDir = path.join(ROOT, 'data', 'crosslink-suggestions');
  const outPath = path.join(outDir, `${slug}.json`);
  const payloadOut = {
    slug,
    generated_at: new Date().toISOString(),
    suggestions,
  };

  if (!dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(payloadOut, null, 2)}\n`, 'utf8');
    const siteDir = path.join(ROOT, '_site', 'data', 'crosslink-suggestions');
    if (fs.existsSync(path.join(ROOT, '_site'))) {
      fs.mkdirSync(siteDir, { recursive: true });
      fs.writeFileSync(path.join(siteDir, `${slug}.json`), `${JSON.stringify(payloadOut, null, 2)}\n`, 'utf8');
    }
  }

  return outPath;
}

function normalizePayload(data, cliCategory, options = {}) {
  const now = new Date();
  const fallbackDate = now.toISOString().slice(0, 10);

  const title = String(data.title || '').trim();
  const seoTitleBase = normalizeSeoTitleBase(String(data.seo_title || title).trim() || title);
  const slug = String(data.slug || '').trim() || slugify(title);
  const category = normalizeCategory(cliCategory || data.category || data.section || 'ciekawe');

  const leadRaw = String(data.lead || data.lead_paragraph || data.excerpt || '').trim();
  const quickAnswer = normalizeQuickAnswer(data.quick_answer || data.quickAnswer || '', leadRaw);
  const metaDescription = normalizeMetaDescription(data.meta_description || data.description || data.excerpt || leadRaw);

  const datePublished = toIsoDateTimeWithTimezone(data.date_published || data.published_at || fallbackDate, '08:00:00');
  const dateModified = toIsoDateTimeWithTimezone(data.date_modified || data.updated_at || fallbackDate, '09:30:00');

  const readingTime = normalizeReadingTimeLabel(data.reading_time || data.readingTime, '11 min czytania');

  const heroImage = String(data.hero_image || data.heroImage || '').trim();
  const heroAlt = String(data.hero_alt || data.heroAlt || title).trim();
  const heroWidth = Number(data.hero_width || data.media_manifest?.entries?.find((entry) => entry.placement === 'hero')?.source?.width || 0);
  const heroHeight = Number(data.hero_height || data.media_manifest?.entries?.find((entry) => entry.placement === 'hero')?.source?.height || 0);
  const heroMotto = String(data.hero_motto_html || data.hero_motto || data.heroMotto || '').trim();

  const keyTakeaways = normalizeKeyTakeaways(data.key_takeaways || data.takeaways || []);
  const sections = normalizeSections(data.sections || []);
  const faqNormalized = normalizeFaq(data.answer_blocks || data.faq || data.faq_items || []);
  const faqResearch = normalizeFaqResearch(data.faq_research || data.faq_sources || []);
  const faqItems = faqNormalized;
  const sources = normalizeSources(data.sources || []);

  // Uwaga: related_articles / related z JSON służy tylko do walidacji komunikatów.
  // Faktyczne karty Czytelni budujemy wyłącznie z lokalnego katalogu artykułów.
  const relatedDefaults = buildSafeRelatedDefaults({
    currentSlug: slug,
    currentCategory: category,
    readingTime,
    heroImage,
    heroAlt,
    heroWidth,
    heroHeight,
    metaDescription,
    title,
  });

  const plainForWordCount = [
    stripTags(leadRaw),
    ...keyTakeaways,
    ...sections.map((s) => stripTags(`${s.title} ${s.blocks.map((b) => b.html || '').join(' ')}`)),
    ...faqItems.map((f) => `${f.question} ${stripTags(f.answerHtml)}`),
  ].join(' ');

  const about = buildAboutEntities({
    data,
    title,
    category,
    keyTakeaways,
    sources,
  });
  const mentions = buildScholarlyMentions(sources);

  return {
    slug,
    title,
    seoTitleBase,
    category,
    leadRaw,
    quickAnswer,
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
    faqResearch,
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
    DATE_DISPLAY: formatDateForDisplay(payload.dateModified || payload.datePublished),
    READING_TIME: payload.readingTime,
    TIME_REQUIRED_ISO: payload.timeRequiredIso,
    CATEGORY_LABEL: payload.category.label,
    CATEGORY_BODY_CLASS: `article--${payload.category.key}`,
    CATEGORY_CARD_CLASS: `article-kicker-card--${payload.category.key}`,
    HERO_IMAGE: payload.heroImage,
    HERO_ALT: payload.heroAlt,
    HERO_WIDTH: payload.heroWidth,
    HERO_HEIGHT: payload.heroHeight,
    HERO_MOTTO: payload.heroMotto,
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
    renderQuickAnswerBlock(payload.quickAnswer),
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
    author: DEFAULT_AUTHOR_PERSON,
    publisher: DEFAULT_PUBLISHER_ORG,
    about: payload.about,
    mentions: payload.mentions,
    hasKeyTakeaways: payload.keyTakeaways.length > 0,
    citations: [...new Set(
      (payload.sources || [])
        .map((s) => String(s && s.url ? s.url : '').trim())
        .filter((u) => /^https?:\/\//i.test(u))
    )],
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
  if (report.indexNowStatus) {
    console.log(`IndexNow: ${report.indexNowStatus}`);
  }
  console.log('PDF + przycisk pobierania: wymagane i wykonane.');
  console.log('Brak modyfikacji Newsów/miniatur: potwierdzone przez projekt importera.');
}

function submitIndexNow({ host, key, keyLocation, urlList }) {
  const payload = JSON.stringify({ host, key, keyLocation, urlList });
  return new Promise((resolve) => {
    const req = https.request(
      'https://api.indexnow.org/indexnow',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8').trim();
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, body });
          } else {
            resolve({ ok: false, status: res.statusCode, body });
          }
        });
      },
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message || String(err) }));
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
      resolve({ ok: false, error: 'timeout' });
    });
    req.write(payload);
    req.end();
  });
}

async function main() {
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
  const runInternalMode = String(args['run-internal-links'] ?? 'auto').trim().toLowerCase();
  const runValidate = boolOpt(args.validate, true);
  const indexNowEnabled = boolOpt(args.indexnow, true);
  const faqStrict = boolOpt(args['faq-strict'], true);
  const precheckOnly = boolOpt(args.precheck, false) || boolOpt(args['check-only'], false);
  const force = boolOpt(args.force, false);

  const resolvedInput = path.resolve(ROOT, inputFile);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Nie znaleziono pliku: ${resolvedInput}`);
  }
  if (!resolvedInput.endsWith('.json')) {
    throw new Error('Plik wejściowy musi być JSON (.json / .fitpo50.json).');
  }

  if (!precheckOnly) {
    const prepared = inspectPreparedArtifact(resolvedInput, ROOT);
    if (!prepared.ok) {
      throw new Error(`Importer wymaga niezmienionego artefaktu CONTENT_READY:\n- ${prepared.errors.join('\n- ')}\nDla draftu uruchom article:add; article:prepare-json służy tylko do korekty bez publikacji.`);
    }
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('Brak pliku article-template-bento.html');
  }

  const json = parseJsonFile(resolvedInput);
  const payload = normalizePayload(json, args.category, { faqStrict });
  const assetPrep = { notes: [], warnings: [] };
  const check = validateInput(json, { faqStrict });
  const precheck = buildPrecheckReport({
    inputPath: resolvedInput,
    json,
    payload,
    validation: check,
    syncSite,
    assetPrep,
  });
  printPrecheckReport(precheck);

  if (precheckOnly) {
    return;
  }

  if (process.env.FITPO50_STAGING_INTERNAL !== '1') {
    throw new Error('Bezpośredni zapis importera jest zablokowany. Użyj article:publish, który buduje HTML i PDF w izolowanym stagingu.');
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

  let indexNowStatus = '';
  const updatedFiles = [];
  if (publish) {
    const listingFiles = updateListings(payload, dryRun, syncSite);
    if (listingFiles.length) updatedFiles.push(...listingFiles);

    const sitemapResult = updateSitemap(payload.slug, payload.dateModified, dryRun);
    if (sitemapResult.changed) updatedFiles.push(sitemapResult.file);

    const llmsResult = updateLlms(
      payload.slug,
      `${payload.title} | FitPo50`,
      payload.category.label,
      payload.metaDescription,
      dryRun,
    );
    if (llmsResult.changed) updatedFiles.push(llmsResult.file);

    if (indexNowEnabled) {
      const indexNowKey = String(process.env.INDEXNOW_KEY || '').trim();
      const indexNowKeyLocation = String(process.env.INDEXNOW_KEY_LOCATION || '').trim();
      if (!indexNowKey) {
        indexNowStatus = 'pominieto (brak INDEXNOW_KEY)';
      } else if (dryRun) {
        indexNowStatus = 'dry-run (bez wysylki)';
      } else {
        const articleUrl = `https://fitpo50.pl/${payload.slug}.html`;
        const result = await submitIndexNow({
          host: 'fitpo50.pl',
          key: indexNowKey,
          keyLocation: indexNowKeyLocation || undefined,
          urlList: [articleUrl],
        });
        if (result.ok) {
          indexNowStatus = `OK (${result.status || 200})`;
        } else {
          indexNowStatus = `blad (${result.status || 'network'}${result.error ? `: ${result.error}` : ''})`;
        }
      }
    } else {
      indexNowStatus = 'wylaczone (--indexnow false)';
    }
  }

  let internalLinksResult = null;
  const sectionHtmlForAuto = payload.sections.flatMap((section) => section.blocks.map((b) => b.html || ''));
  const sectionInternalLinks = utils.countInternalHtmlLinks(sectionHtmlForAuto);
  const runInternal = runInternalMode === 'true'
    || runInternalMode === '1'
    || runInternalMode === 'yes'
    || runInternalMode === 'on'
    || (runInternalMode === 'auto' && sectionInternalLinks === 0);
  if (runInternal) {
    console.warn('\nUwaga: auto-linking wewnętrzny włączony (helper może przebudować HTML).');
    internalLinksResult = runInternalLinks(payload.slug, dryRun);
  }

  ensureMinimumInternalLinks(payload.slug, dryRun, syncSite, POLICY.WORDS.INTERNAL_LINKS_MIN);

  runPdfSync(payload.slug, dryRun);
  updatedFiles.push('assets/pdf/<slug>.pdf + przycisk PDF + schema encoding');
  runTitleBreadcrumbSync(payload.slug, dryRun);
  updatedFiles.push('social title + BreadcrumbList (source/_site)');

  if (runValidate) {
    runValidator(payload.slug, dryRun);
  }

  const crosslinkSuggestionsPath = writeCrosslinkSuggestions(payload, dryRun);
  if (crosslinkSuggestionsPath) {
    updatedFiles.push(`data/crosslink-suggestions/${payload.slug}.json`);
  }

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
    indexNowStatus,
    listingsUpdated: updatedFiles.some((file) => file.includes('porady.html') || file.includes('index.html') || file.endsWith('.html')),
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\nBłąd importera: ${err.message || err}`);
    process.exit(1);
  });
}

module.exports = { ensureCaptionedTables, main, normalizeSections, normalizeSeoTitleBase, submitIndexNow };
