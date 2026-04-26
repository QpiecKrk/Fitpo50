#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

function normalizeCategory(input) {
  const v = (input || '').toLowerCase().trim();
  if (['ruch', 'rusz-sie', 'rusz_sie'].includes(v)) return { key: 'ruch', label: 'Ruch' };
  if (['jedzenie', 'dieta'].includes(v)) return { key: 'jedzenie', label: 'Jedzenie' };
  if (['zdrowie', 'zdrowie-po-50'].includes(v)) return { key: 'zdrowie', label: 'Zdrowie' };
  if (['ciekawe', 'lifestyle'].includes(v)) return { key: 'ciekawe', label: 'Ciekawe' };
  return null;
}

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDateTimeWithTimezone(input, fallbackTime = '08:00:00') {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T${fallbackTime}+02:00`;
  }
  return raw;
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
const description = (args.description || '').trim();
const categoryRaw = (args.category || '').trim();

if (!slug || !title || !description || !categoryRaw) {
  console.error('Użycie: node scripts/create-article-from-template.js --slug <slug> --title "<tytuł>" --category <ruch|jedzenie|zdrowie|ciekawe> --description "<opis>" [--date-published YYYY-MM-DD lub pełny ISO] [--date-modified YYYY-MM-DD lub pełny ISO] [--reading-time "11 min czytania"] [--hero-image nazwa] [--force true] [--sync-site true]');
  process.exit(1);
}

const category = normalizeCategory(categoryRaw);
if (!category) {
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
