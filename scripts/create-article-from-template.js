#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizeCategory } = require('./lib/categories');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function nowDate() {
  return new Date().toISOString().slice(0, 10);
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

function toIsoDateTimeWithTimezone(input, fallbackTime = '08:00:00') {
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

function truncateAtWordBoundary(text, maxChars) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= maxChars) return value;
  const slice = value.slice(0, maxChars + 1);
  const cut = slice.lastIndexOf(' ');
  if (cut >= Math.floor(maxChars * 0.6)) {
    return slice.slice(0, cut).trim();
  }
  return value.slice(0, maxChars).trim();
}

function toIsoDuration(readingTime) {
  const m = String(readingTime || '').match(/(\d+)/);
  const mins = m ? Number(m[1]) : 10;
  return `PT${mins}M`;
}

function replaceAll(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(`{{${key}}}`).join(String(value));
  }
  return html;
}

const args = parseArgs(process.argv.slice(2));
const slug = (args.slug || '').trim();
const title = (args.title || '').trim();
const description = truncateAtWordBoundary((args.description || '').trim(), 160);
const categoryRaw = (args.category || '').trim();

if (!slug || !title || !description || !categoryRaw) {
  console.error('Użycie: node scripts/create-article-from-template.js --slug <slug> --title "<tytuł>" --category <ruch|jedzenie|zdrowie|ciekawe> --description "<opis>" [--date-published YYYY-MM-DD lub pełny ISO] [--date-modified YYYY-MM-DD lub pełny ISO] [--reading-time "11 min czytania"] [--hero-image nazwa] [--force true] [--sync-site true]');
  process.exit(1);
}

const category = normalizeCategory(categoryRaw);
if (!category.inputMatched) {
  console.error(`Nieznana kategoria: ${categoryRaw}`);
  process.exit(1);
}

const templatePath = path.resolve(process.cwd(), 'article-template-bento.html');
if (!fs.existsSync(templatePath)) {
  console.error('Brak pliku article-template-bento.html');
  process.exit(1);
}

const outPath = path.resolve(process.cwd(), `${slug}.html`);
const force = args.force === 'true';
if (fs.existsSync(outPath) && !force) {
  console.error(`Plik już istnieje: ${path.basename(outPath)} (użyj --force true, jeśli chcesz nadpisać)`);
  process.exit(1);
}

const datePublishedRaw = (args['date-published'] || nowDate()).trim();
const dateModifiedRaw = (args['date-modified'] || datePublishedRaw).trim();
const datePublished = toIsoDateTimeWithTimezone(datePublishedRaw, '08:00:00');
const dateModified = toIsoDateTimeWithTimezone(dateModifiedRaw, '09:30:00');
const readingTime = (args['reading-time'] || '11 min czytania').trim();
const heroImage = (args['hero-image'] || slug).trim();
const heroAlt = (args['hero-alt'] || title).trim();
const heroMotto = (args['hero-motto'] || 'Tu wpisz krótkie hasło hero dla artykułu.').trim();

const replacements = {
  SLUG: slug,
  TITLE: title,
  META_DESCRIPTION: description,
  DATE_PUBLISHED: datePublished,
  DATE_MODIFIED: dateModified,
  READING_TIME: readingTime,
  TIME_REQUIRED_ISO: toIsoDuration(readingTime),
  CATEGORY_LABEL: category.label,
  CATEGORY_BODY_CLASS: `article--${category.key}`,
  CATEGORY_CARD_CLASS: `article-kicker-card--${category.key}`,
  HERO_IMAGE: heroImage,
  HERO_ALT: heroAlt,
  HERO_MOTTO: heroMotto,
  LEAD_PARAGRAPH: 'Tu wpisz lead artykułu (pierwszy akapit).',
  H2_1: 'Pierwszy nagłówek H2',
  P_1: 'Tu wpisz pierwszy blok treści.',
  H2_2: 'Drugi nagłówek H2',
  P_2: 'Tu wpisz drugi blok treści.',
  SOURCE_URL_1: 'https://example.com',
  SOURCE_URL_2: 'https://example.com',
  SOURCE_1: 'Źródło 1',
  SOURCE_2: 'Źródło 2',
  RELATED_URL_1: 'porady.html',
  RELATED_URL_2: 'porady.html',
  RELATED_URL_3: 'porady.html',
  RELATED_IMG_1: heroImage,
  RELATED_IMG_2: heroImage,
  RELATED_IMG_3: heroImage,
  RELATED_ALT_1: 'Powiązany artykuł 1',
  RELATED_ALT_2: 'Powiązany artykuł 2',
  RELATED_ALT_3: 'Powiązany artykuł 3',
  RELATED_CATEGORY_1: category.label,
  RELATED_CATEGORY_2: category.label,
  RELATED_CATEGORY_3: category.label,
  RELATED_CATEGORY_1_KEY: category.key,
  RELATED_CATEGORY_2_KEY: category.key,
  RELATED_CATEGORY_3_KEY: category.key,
  RELATED_TIME_1: readingTime.replace(' czytania', ''),
  RELATED_TIME_2: readingTime.replace(' czytania', ''),
  RELATED_TIME_3: readingTime.replace(' czytania', ''),
  RELATED_TITLE_1: 'Powiązany artykuł 1',
  RELATED_TITLE_2: 'Powiązany artykuł 2',
  RELATED_TITLE_3: 'Powiązany artykuł 3',
  RELATED_DESC_1: 'Krótki opis powiązanego artykułu 1.',
  RELATED_DESC_2: 'Krótki opis powiązanego artykułu 2.',
  RELATED_DESC_3: 'Krótki opis powiązanego artykułu 3.'
};

const template = fs.readFileSync(templatePath, 'utf8');
const output = replaceAll(template, replacements);
fs.writeFileSync(outPath, output, 'utf8');
console.log(`Utworzono: ${path.basename(outPath)}`);

if (args['sync-site'] === 'true') {
  const outSite = path.resolve(process.cwd(), '_site', `${slug}.html`);
  fs.mkdirSync(path.dirname(outSite), { recursive: true });
  fs.writeFileSync(outSite, output, 'utf8');
  console.log(`Zsynchronizowano: _site/${slug}.html`);
}
