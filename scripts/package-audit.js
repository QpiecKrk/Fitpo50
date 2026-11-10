#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectArticlePackage, requiredPlacements } = require('./article-package-intake');
const { validateArticleEvidence } = require('./lib/article-evidence');
const { inspectImage } = require('./lib/article-media');
const { packageIdentity } = require('./lib/package-identity');
const { warsawIso } = require('./lib/time');
const { isSupportedCategory } = require('./lib/categories');
const { SECTION_ROLES } = require('./lib/article-section-contract');
const { validationIdentity } = require('./lib/article-json-artifact');

const ROOT = path.resolve(__dirname, '..');
const OWNERS = Object.freeze({ WRITER: 'PISARZ', ILLUSTRATOR: 'ILUSTRATOR', CODEX: 'CODEX' });
const EXIT = Object.freeze({ READY: 0, CONTENT: 20, ENVIRONMENT: 30 });
const TOP_LEVEL_FIELDS = new Set([
  'answer_blocks', 'category', 'editorial_notes', 'evidence_claims', 'faq_research', 'hero_motto_html',
  'image_prompts_v4', 'key_takeaways', 'lead', 'listing_desc', 'listing_title', 'logic_links',
  'meta_description', 'og_description', 'og_title', 'primary_keyword', 'quick_answer', 'reading_time',
  'schema_blogposting_description', 'search_intent', 'sections', 'seo_title', 'slug', 'sources', 'status',
  'supporting_keywords', 'title', 'twitter_description', 'twitter_title', 'myth_claim',
]);
const REQUIRED_TEXT_FIELDS = [
  'title', 'seo_title', 'og_title', 'twitter_title', 'slug', 'category', 'meta_description',
  'og_description', 'twitter_description', 'schema_blogposting_description', 'listing_title',
  'listing_desc', 'lead', 'quick_answer', 'reading_time', 'hero_motto_html', 'search_intent', 'primary_keyword',
];
const ARRAY_FIELD_CONTRACTS = Object.freeze({
  sections: new Set(['title', 'section_role', 'paragraphs_html']),
  sources: new Set(['id', 'label', 'url', 'evidence_level', 'fallback_url', 'evidence_scope', 'publication_date', 'publication_year', 'checked_via', 'recheck_after', 'checked_at', 'url_status', 'http_status', 'doi_or_pmid']),
  evidence_claims: new Set(['claim', 'location', 'claim_type', 'source_urls']),
  answer_blocks: new Set(['question', 'answer_html']),
  faq_research: new Set(['question', 'source_type', 'source_label', 'source_url', 'research_note', 'checked_at', 'url_status', 'http_status']),
  image_prompts_v4: new Set(['section_ref', 'filename_base', 'source_file', 'topic', 'technique', 'composition', 'purpose', 'season_and_time', 'mood', 'aspect_ratio', 'prompt_en', 'overlay_text_pl', 'evidence_source_urls', 'requires_exact_data_render', 'negative_prompt', 'alt_pl', 'caption_pl', 'visual_review', 'overlay_claims']),
});
const NESTED_TEXT_FIELDS = Object.freeze({
  sections: ['title'],
  sources: ['id', 'label', 'url'],
  evidence_claims: ['claim', 'location', 'claim_type'],
  answer_blocks: ['question', 'answer_html'],
  faq_research: ['question', 'source_type', 'source_label', 'source_url'],
  image_prompts_v4: ['section_ref', 'filename_base', 'source_file', 'topic', 'technique', 'composition', 'purpose', 'aspect_ratio', 'prompt_en', 'alt_pl', 'caption_pl'],
});
const TECHNICAL_TEXT_FIELDS = REQUIRED_TEXT_FIELDS.filter((field) => !['search_intent', 'primary_keyword'].includes(field));
const TECHNICAL_ONLY_EXCLUSIONS = ['CONTENT_REVIEW', 'EVIDENCE_REVIEW', 'SOURCE_VERIFICATION', 'FAQ_RESEARCH', 'SEO_INTENT', 'VISUAL_REVIEW'];
const IMAGE_BASE_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9]\d*$/;

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (!token.startsWith('--')) continue;
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[token.slice(2)] = true;
    else { out[token.slice(2)] = next; index += 1; }
  }
  return out;
}

function jsonPathFromMessage(message) {
  const match = String(message).match(/\b(sources|evidence_claims|answer_blocks|faq_research|image_prompts_v4|sections)\[(\d+)\](?:\.([a-zA-Z0-9_]+))?/);
  if (match) return `/${match[1]}/${match[2]}${match[3] ? `/${match[3]}` : ''}`;
  const field = String(message).match(new RegExp(`\\b(${[...TOP_LEVEL_FIELDS].join('|')})\\b`));
  return field ? `/${field[1]}` : '/';
}

function issue(owner, check, code, message, options = {}) {
  return {
    owner,
    check,
    code,
    status: 'ERROR',
    path: options.path || jsonPathFromMessage(message),
    message: String(message),
    fix: options.fix || (owner === OWNERS.CODEX ? 'Codex wykonuje deterministyczną poprawkę techniczną.' : 'Uzupełnij wskazane pole zgodnie z komunikatem.'),
    ...(options.proposedChange ? { proposed_change: options.proposedChange } : {}),
    ...(options.prompt ? { illustrator_prompt: options.prompt } : {}),
  };
}

function uniqueIssues(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.owner}|${item.path}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contractIssues(article) {
  const out = [];
  for (const key of Object.keys(article || {})) {
    if (!TOP_LEVEL_FIELDS.has(key)) out.push(issue(OWNERS.WRITER, 'CONTRACT_V2', 'FIELD_OUTSIDE_CONTRACT', `Pole ${key} jest poza kontraktem draftu v2.`, { path: `/${key}`, fix: `Usuń pole ${key}; lokalne pola tworzy pipeline.` }));
  }
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (article?.[field] === null) out.push(issue(OWNERS.CODEX, 'CONTRACT_V2', 'NULL_TEXT_FIELD', `${field} ma null zamiast tekstu.`, {
      path: `/${field}`,
      fix: `Codex może znormalizować null do pustego tekstu; brak właściwej treści nadal osobno wraca do Pisarza.`,
      proposedChange: { operation: 'replace', path: `/${field}`, before: null, after: '' },
    }));
  }
  for (const [collection, allowed] of Object.entries(ARRAY_FIELD_CONTRACTS)) {
    (Array.isArray(article?.[collection]) ? article[collection] : []).forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      for (const key of Object.keys(entry)) {
        if (collection === 'evidence_claims' && key === 'text' && !('claim' in entry)) continue;
        if (!allowed.has(key)) out.push(issue(OWNERS.WRITER, 'CONTRACT_V2', 'FIELD_OUTSIDE_CONTRACT', `${collection}[${index}].${key} jest poza kontraktem draftu v2.`, { path: `/${collection}/${index}/${key}`, fix: `Usuń pole ${key} z ${collection}[${index}].` }));
      }
      for (const key of NESTED_TEXT_FIELDS[collection] || []) {
        if (entry[key] === null) out.push(issue(OWNERS.CODEX, 'CONTRACT_V2', 'NULL_TEXT_FIELD', `${collection}[${index}].${key} ma null zamiast tekstu.`, {
          path: `/${collection}/${index}/${key}`,
          fix: 'Codex może znormalizować null do pustego tekstu; brak właściwej treści nadal osobno wraca do Pisarza.',
          proposedChange: { operation: 'replace', path: `/${collection}/${index}/${key}`, before: null, after: '' },
        }));
      }
    });
  }
  (Array.isArray(article?.evidence_claims) ? article.evidence_claims : []).forEach((claim, index) => {
    if (claim && typeof claim === 'object' && 'text' in claim && !('claim' in claim)) {
      out.push(issue(OWNERS.CODEX, 'CONTRACT_V2', 'TEXT_INSTEAD_OF_CLAIM', `evidence_claims[${index}] używa text zamiast claim.`, {
        path: `/evidence_claims/${index}/text`,
        fix: 'Codex może bez zmiany treści przemianować klucz text na claim.',
        proposedChange: { operation: 'rename_key', from: `/evidence_claims/${index}/text`, to: `/evidence_claims/${index}/claim`, value: claim.text },
      }));
    }
  });
  return out;
}

function unitIssues(article) {
  const pattern = /(?:(?<![\p{L}\p{N}])oz(?![\p{L}\p{N}])|\b(?:ounce|ounces|lb|lbs|pound|pounds|inch|inches|mile|miles)\b|\buncj(?:a|e|i|ę|ą)?\b|\bfunt(?:a|y|ów)?\b|\bcal(?:a|e|i)?\b|\bmil(?:a|e|i)?\b|°\s*F\b)/giu;
  const out = [];
  function walk(value, pointer) {
    if (typeof value === 'string') {
      const matches = [...value.matchAll(pattern)].map((match) => match[0]);
      if (matches.length) out.push(issue(OWNERS.CODEX, 'EU_UNITS', 'NON_EU_UNIT', `${pointer}: wykryto niedozwolone jednostki: ${[...new Set(matches)].join(', ')}.`, {
        path: pointer,
        fix: 'Codex przygotowuje deterministyczne przeliczenie na jednostki metryczne; propozycja wymaga akceptacji przed zapisem.',
        proposedChange: { operation: 'convert_to_metric', path: pointer, before: value, after: metricProposal(value) },
      }));
    } else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${pointer}/${index}`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${pointer}/${key}`));
  }
  walk(article, '');
  return out;
}

function metricProposal(value) {
  const rounded = (number) => Number(number.toFixed(1)).toLocaleString('pl-PL');
  return String(value)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:lbs|lb|pounds|pound|funt(?:a|y|ów)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 0.45359237)} kg`)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:ounces|ounce|oz|uncj(?:a|e|i|ę|ą)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 28.349523125)} g`)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:inches|inch|cal(?:a|e|i)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 2.54)} cm`)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:miles|mile|mil(?:a|e|i)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 1.609344)} km`)
    .replace(/(\d+(?:[.,]\d+)?)\s*°\s*F\b/giu, (_all, amount) => `${rounded((Number(String(amount).replace(',', '.')) - 32) * 5 / 9)} °C`);
}

function imageIssues(article, assetsDir, dependencies = {}) {
  const out = [];
  const articleSlug = String(article?.slug || '').trim();
  const intake = inspectArticlePackage(article, assetsDir);
  intake.issues.WRITER_FIX_REQUIRED.forEach((message) => {
    const technical = /filename_base|source_file|powtórzony filename_base/iu.test(message);
    out.push(issue(technical ? OWNERS.CODEX : OWNERS.WRITER, 'IMAGE_CONTRACT', technical ? 'IMAGE_FILENAME_CONTRACT' : 'IMAGE_DRAFT_CONTRACT', message, technical ? {
      fix: 'Codex przygotowuje dokładne przemianowanie pól i plików bez zmiany obrazu; propozycja wymaga akceptacji.',
      proposedChange: { operation: 'normalize_image_filename', message },
    } : {}));
  });
  (Array.isArray(article?.image_prompts_v4) ? article.image_prompts_v4 : []).forEach((prompt, index) => {
    const base = String(prompt?.filename_base || '').trim();
    if (articleSlug && base && base !== articleSlug && !base.startsWith(`${articleSlug}-`)) {
      const suggestedBase = `${articleSlug}-${base}`;
      out.push(issue(OWNERS.CODEX, 'IMAGE_CONTRACT', 'IMAGE_FILENAME_OUTSIDE_SLUG', `${base}: filename_base nie należy do sluga ${articleSlug}.`, {
        path: `/image_prompts_v4/${index}/filename_base`,
        fix: 'Codex może przemianować bazę, source_file i istniejące warianty bez zmiany zawartości obrazów.',
        proposedChange: { operation: 'rename_image_set', from: base, to: suggestedBase },
      }));
    }
  });
  intake.issues.ILLUSTRATOR_FIX_REQUIRED.forEach((message) => {
    const prompt = (article.image_prompts_v4 || []).find((item) => message.includes(String(item?.filename_base || '')));
    const base = String(prompt?.filename_base || '').trim();
    const missingName = String(message).match(/brak\s+([^\s]+\.(?:jpg|webp|avif))/iu)?.[1] || '';
    const available = ['jpg', 'webp', 'avif'].map((extension) => `${base}.${extension}`)
      .filter((name) => base && fs.existsSync(path.join(assetsDir, name)));
    const convertible = Boolean(missingName && available.length);
    out.push(issue(convertible ? OWNERS.CODEX : OWNERS.ILLUSTRATOR, 'IMAGE_FILES', convertible ? 'IMAGE_FORMAT_MISSING' : 'IMAGE_FILE_MISSING', message, convertible ? {
      fix: `Codex może utworzyć ${missingName} z istniejącego zatwierdzonego wariantu ${available[0]} bez zmiany kadru lub treści.`,
      proposedChange: { operation: 'convert_image', from: available[0], to: missingName },
    } : {
      fix: 'Ilustrator dostarcza brakujący obraz źródłowy i komplet wariantów bez zmiany zatwierdzonych danych.',
      prompt: prompt?.prompt_en || `Create the missing exact-format variant for ${prompt?.filename_base || 'the declared article image'}; preserve composition, factual overlay and aspect ratio.`,
    }));
  });
  return [...out, ...imageDimensionIssues(article, assetsDir, dependencies)];
}

function imageDimensionIssues(article, assetsDir, dependencies = {}) {
  const out = [];
  const inspect = dependencies.inspectImage || ((file) => inspectImage(file, { technicalOnly: dependencies.technicalOnly === true }));
  for (let index = 0; index < (article.image_prompts_v4 || []).length; index += 1) {
    const prompt = article.image_prompts_v4[index] || {};
    const base = String(prompt.filename_base || '');
    if (dependencies.technicalOnly && !IMAGE_BASE_RX.test(base)) continue;
    const metadata = [];
    for (const extension of ['jpg', 'webp', 'avif']) {
      const file = path.join(assetsDir, `${base}.${extension}`);
      if (!base || !fs.existsSync(file) || (dependencies.technicalOnly && !fs.statSync(file).isFile())) continue;
      try { metadata.push({ extension, ...inspect(file) }); }
      catch (error) {
        out.push(issue(OWNERS.CODEX, 'IMAGE_DIMENSIONS', error.code === 'IMAGE_INSPECT_ENVIRONMENT_FAILURE' ? error.code : 'IMAGE_UNREADABLE', `${base}.${extension}: ${error.message || error}`, {
          path: `/image_prompts_v4/${index}`,
          fix: 'Codex może ponownie zakodować wariant z istniejącego zatwierdzonego mastera; jeśli master także jest uszkodzony, zadanie wraca do Ilustratora.',
          proposedChange: { operation: 'reencode_image', file: `${base}.${extension}` },
        }));
      }
    }
    if (!metadata.length) continue;
    const reference = metadata[0];
    const minWidth = prompt.section_ref === 'hero' ? 1024 : 800;
    const minHeight = prompt.section_ref === 'hero' ? 560 : 450;
    if (reference.width < minWidth || reference.height < minHeight) {
      out.push(issue(OWNERS.ILLUSTRATOR, 'IMAGE_DIMENSIONS', 'IMAGE_TOO_SMALL', `${base}: ${reference.width}x${reference.height}; minimum ${minWidth}x${minHeight}.`, { path: `/image_prompts_v4/${index}`, prompt: `${prompt.prompt_en || `Regenerate ${base}.`} Output at least ${minWidth}x${minHeight}px; preserve the declared aspect ratio and exact overlay text.` }));
    }
    const ratioMatch = String(prompt.aspect_ratio || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    const declared = ratioMatch ? Number(ratioMatch[1]) / Number(ratioMatch[2]) : 0;
    if (!declared || Math.abs(reference.aspect_ratio - declared) > 0.04 || reference.aspect_ratio < 1.2 || reference.aspect_ratio > 2.1) {
      out.push(issue(OWNERS.ILLUSTRATOR, 'IMAGE_DIMENSIONS', 'IMAGE_BAD_RATIO', `${base}: proporcja ${reference.aspect_ratio} nie zgadza się z ${prompt.aspect_ratio || 'brak deklaracji'} albo layoutem 1.2–2.1.`, { path: `/image_prompts_v4/${index}/aspect_ratio`, prompt: `${prompt.prompt_en || `Regenerate ${base}.`} Use exactly the declared landscape aspect ratio ${prompt.aspect_ratio || '16:9'} without cropping away factual content.` }));
    }
    metadata.slice(1).forEach((item) => {
      if (item.width !== reference.width || item.height !== reference.height) out.push(issue(OWNERS.CODEX, 'IMAGE_DIMENSIONS', 'IMAGE_VARIANT_SIZE_MISMATCH', `${base}: wariant ${item.extension} ma ${item.width}x${item.height}, a ${reference.extension} ${reference.width}x${reference.height}.`, {
        path: `/image_prompts_v4/${index}`,
        fix: `Codex może ponownie wyeksportować ${base}.${item.extension} z zatwierdzonego mastera ${reference.extension} w ${reference.width}x${reference.height}px.`,
        proposedChange: { operation: 'reexport_image_variant', from: `${base}.${reference.extension}`, to: `${base}.${item.extension}`, width: reference.width, height: reference.height },
      }));
    });
  }
  return out;
}

function technicalIssues(article, assetsDir, args, dependencies = {}) {
  const issues = [];
  const blocked = [];
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const add = (pointer, code, message, owner = OWNERS.WRITER) => issues.push(issue(owner, 'TECHNICAL_CONTRACT', code, message, {
    path: pointer, fix: `Popraw ${pointer}: ${message}`,
  }));
  const textField = (entry, key, pointer, required = false) => {
    if (entry[key] === undefined && !required) return;
    if (typeof entry[key] !== 'string' || (required && !entry[key].trim())) {
      add(`${pointer}/${key}`, 'TEXT_FIELD_INVALID', `${key} musi być ${required ? 'niepustym ' : ''}tekstem.`);
    }
  };
  const textList = (value, pointer) => {
    if (!Array.isArray(value)) { add(pointer, 'ARRAY_FIELD_INVALID', 'Wymagana jest lista tekstów.'); return; }
    value.forEach((item, index) => {
      if (typeof item !== 'string') add(`${pointer}/${index}`, 'TEXT_FIELD_INVALID', 'Element musi być tekstem.');
    });
  };
  if (!object(article)) {
    add('/', 'JSON_ROOT_INVALID', 'Główny element JSON-u musi być obiektem.');
    return { issues, blocked: [{ check: 'PACKAGE_STRUCTURE_AND_FILES', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_ROOT_INVALID' }] };
  }
  issues.push(...contractIssues(article).filter((item) => item.code === 'FIELD_OUTSIDE_CONTRACT'));
  TECHNICAL_TEXT_FIELDS.forEach((key) => textField(article, key, '', true));
  ['search_intent', 'primary_keyword', 'myth_claim', 'status'].forEach((key) => textField(article, key, ''));
  for (const field of ['key_takeaways', 'supporting_keywords']) {
    if (article[field] !== undefined) textList(article[field], `/${field}`);
  }
  for (const [field, required] of [['sections', true], ['sources', true], ['image_prompts_v4', true], ['answer_blocks', false], ['evidence_claims', false], ['faq_research', false], ['logic_links', false]]) {
    if (article[field] === undefined && !required) continue;
    if (!Array.isArray(article[field])) {
      add(`/${field}`, 'ARRAY_FIELD_INVALID', `${field} musi być listą.`);
      blocked.push({ check: `${field}:items`, status: 'BLOCKED_DEPENDENCY', dependency: `/${field}` });
      continue;
    }
    if (['sections', 'image_prompts_v4'].includes(field) && !article[field].length) add(`/${field}`, 'ARRAY_EMPTY', `${field} nie może być puste.`);
    article[field].forEach((entry, index) => {
      const pointer = `/${field}/${index}`;
      if (!object(entry)) { add(pointer, 'OBJECT_FIELD_INVALID', 'Element musi być obiektem.'); return; }
      const requiredFields = {
        sections: ['title'], sources: ['label', 'url'], answer_blocks: ['question', 'answer_html'],
        image_prompts_v4: ['section_ref', 'filename_base', 'source_file', 'aspect_ratio', 'alt_pl', 'caption_pl'],
      }[field] || [];
      for (const key of new Set([...(NESTED_TEXT_FIELDS[field] || []), ...requiredFields])) textField(entry, key, pointer, requiredFields.includes(key));
      if (field === 'sections') {
        if (!SECTION_ROLES.has(entry.section_role || 'main')) add(`${pointer}/section_role`, 'SECTION_ROLE_INVALID', 'section_role musi mieć wartość main albo utility.');
        textList(entry.paragraphs_html, `${pointer}/paragraphs_html`);
        if (Array.isArray(entry.paragraphs_html) && !entry.paragraphs_html.length) add(`${pointer}/paragraphs_html`, 'ARRAY_EMPTY', 'Brak bloku treści sekcji.');
      }
      if (field === 'sources' && typeof entry.url === 'string') {
        try { if (!['http:', 'https:'].includes(new URL(entry.url).protocol)) throw new Error(); }
        catch (_error) { add(`${pointer}/url`, 'URL_INVALID', 'Adres musi być poprawnym URL-em HTTP/HTTPS.'); }
      }
      for (const key of ['source_urls', 'evidence_source_urls', 'premise_locations']) {
        if (entry[key] !== undefined) textList(entry[key], `${pointer}/${key}`);
      }
    });
  }
  const slugValid = typeof article.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug);
  if (!slugValid) add('/slug', 'SLUG_INVALID', 'Slug musi być nazwą kebab-case bez ścieżki i rozszerzenia.');
  else if (fs.existsSync(path.join(dependencies.root || ROOT, `${article.slug}.html`)) && !['true', '1', 'yes'].includes(String(args.force).toLowerCase())) {
    add('/slug', 'SLUG_EXISTS', 'Artykuł już istnieje; aktualizacja wymaga jawnego --force true.');
  }
  if (!isSupportedCategory(article.category)) add('/category', 'CATEGORY_INVALID', 'Nieobsługiwana kategoria artykułu.');

  // Tylko jednoznaczne błędy konstrukcji fragmentów; poprawność renderowania sprawdza staging.
  const html = (value, pointer) => {
    if (typeof value !== 'string') return;
    if (/<\?xml\b|<\/?(?:html|head|body)\b|<\/(?:img|br|hr|source)\s*>/i.test(value)
      || /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<(?:table|div|figure|aside|ul|ol|blockquote|pre)\b/i.test(value)) {
      add(pointer, 'HTML_FRAGMENT_INVALID', 'Fragment zawiera znaczniki dokumentu, zamknięcie pustego elementu lub blok wewnątrz <p>.');
    }
  };
  ['lead', 'quick_answer', 'hero_motto_html'].forEach((key) => html(article[key], `/${key}`));
  (Array.isArray(article.sections) ? article.sections : []).forEach((section, index) => {
    (Array.isArray(section?.paragraphs_html) ? section.paragraphs_html : []).forEach((value, paragraph) => html(value, `/sections/${index}/paragraphs_html/${paragraph}`));
  });
  (Array.isArray(article.answer_blocks) ? article.answer_blocks : []).forEach((entry, index) => html(entry?.answer_html, `/answer_blocks/${index}/answer_html`));

  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    add('/assets-dir', 'ASSETS_DIRECTORY_MISSING', `Brak katalogu paczki: ${assetsDir}`, OWNERS.CODEX);
    blocked.push({ check: 'IMAGE_FILES', status: 'BLOCKED_DEPENDENCY', dependency: '/assets-dir' });
    return { issues: uniqueIssues(issues), blocked };
  }
  const prompts = Array.isArray(article.image_prompts_v4) ? article.image_prompts_v4.filter(object) : [];
  const bases = new Set();
  const placements = new Set();
  const validSections = Array.isArray(article.sections);
  if (Array.isArray(article.image_prompts_v4)) {
    for (const placement of requiredPlacements(article)) {
      if (!validSections && placement !== 'hero') continue;
      if (prompts.filter((prompt) => prompt.section_ref === placement).length !== 1) add('/image_prompts_v4', 'IMAGE_PLACEMENT_MISSING', `Wymagany jest dokładnie jeden wpis ${placement}.`);
    }
  }
  prompts.forEach((prompt) => {
    const index = article.image_prompts_v4.indexOf(prompt);
    const pointer = `/image_prompts_v4/${index}`;
    const base = prompt.filename_base;
    const placement = prompt.section_ref;
    const section = typeof placement === 'string' ? placement.match(/^sekcja-([1-9]\d*)(?:-obraz-([1-9]\d*))?$/) : null;
    if (placement !== 'hero' && (!section || (section[2] && Number(section[2]) < 2) || (validSections && Number(section[1]) > article.sections.length))) add(`${pointer}/section_ref`, 'IMAGE_PLACEMENT_INVALID', 'Nieprawidłowe odwołanie do sekcji.');
    if (placements.has(placement)) add(`${pointer}/section_ref`, 'IMAGE_PLACEMENT_DUPLICATE', 'Powtórzone miejsce obrazu.');
    placements.add(placement);
    if (typeof base !== 'string' || !IMAGE_BASE_RX.test(base)) {
      add(`${pointer}/filename_base`, 'IMAGE_FILENAME_INVALID', 'Nazwa musi być kebab-case, bez ścieżki, zakończona -vN.');
      blocked.push({ check: `${pointer}:files`, status: 'BLOCKED_DEPENDENCY', dependency: `${pointer}/filename_base` });
      return;
    }
    if (slugValid && !base.startsWith(`${article.slug}-`)) add(`${pointer}/filename_base`, 'IMAGE_FILENAME_OUTSIDE_SLUG', `Nazwa musi zaczynać się od ${article.slug}-.`);
    if (bases.has(base)) add(`${pointer}/filename_base`, 'IMAGE_FILENAME_DUPLICATE', 'Powtórzona nazwa obrazu.');
    bases.add(base);
    if (prompt.source_file !== `${base}.jpg`) add(`${pointer}/source_file`, 'IMAGE_SOURCE_INVALID', `source_file musi wskazywać ${base}.jpg.`);
    for (const extension of ['jpg', 'webp', 'avif']) {
      const name = `${base}.${extension}`;
      const file = path.join(assetsDir, name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) add(`${pointer}/${extension}`, 'IMAGE_FILE_MISSING', `Brak pliku ${name}.`, OWNERS.ILLUSTRATOR);
    }
  });
  const dimensionPrompts = (Array.isArray(article.image_prompts_v4) ? article.image_prompts_v4 : []).map((entry) => object(entry) ? entry : {});
  const dimensions = imageDimensionIssues({ image_prompts_v4: dimensionPrompts }, assetsDir, { ...dependencies, technicalOnly: true });
  issues.push(...dimensions.map((item) => issue(
    item.code.endsWith('ENVIRONMENT_FAILURE') ? OWNERS.CODEX : OWNERS.ILLUSTRATOR,
    item.check, item.code, item.message,
    { path: item.path, fix: item.code.endsWith('ENVIRONMENT_FAILURE') ? 'Przywróć narzędzie odczytu obrazów i ponów audyt.' : 'Dostarcz poprawny wariant obrazu o wymaganych wymiarach; audyt nie zmienia obrazów.' },
  )));
  return { issues: uniqueIssues(issues), blocked };
}

function overlayIssues(article) {
  const out = [];
  const claims = Array.isArray(article.evidence_claims) ? article.evidence_claims : [];
  const numbers = (value) => [...String(value || '').matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(',', '.'));
  (article.image_prompts_v4 || []).forEach((prompt, promptIndex) => {
    if (prompt?.requires_exact_data_render !== true) return;
    (Array.isArray(prompt.overlay_claims) ? prompt.overlay_claims : []).forEach((overlay, claimIndex) => {
      const expected = numbers(overlay?.claim);
      if (!expected.length) return;
      const supporting = claims.some((claim) => (claim?.source_urls || []).includes(overlay?.source_url)
        && expected.every((number) => numbers(claim?.claim).includes(number)));
      if (!supporting) out.push(issue(OWNERS.WRITER, 'OVERLAY_CLAIMS', 'OVERLAY_NUMBER_UNMAPPED', `image_prompts_v4[${promptIndex}].overlay_claims[${claimIndex}]: liczby ${expected.join(', ')} nie mają zgodnego evidence_claim z tym samym źródłem.`, { path: `/image_prompts_v4/${promptIndex}/overlay_claims/${claimIndex}`, fix: 'Uzgodnij liczby na grafice z twierdzeniem w artykule i przypisz ten sam source_url; nie wymyślaj nowych danych.' }));
    });
  });
  return out;
}

function subprocessIssues(file, dependencies = {}) {
  const spawn = dependencies.spawnSync || spawnSync;
  const out = [];
  const python = spawn('python3', ['docs/skills/fitpo50-article-draft/scripts/validate_fitpo50_draft.py', '--allow-verified-review', file], { cwd: ROOT, encoding: 'utf8' });
  if (python.error || python.signal || python.status === null || python.status === undefined) {
    out.push(issue(OWNERS.CODEX, 'DRAFT_VALIDATOR', 'PYTHON_ENVIRONMENT_FAILURE', `Walidator Pythona nie uruchomił się${python.signal ? ` (sygnał ${python.signal})` : ''}: ${python.error?.message || 'brak kodu wyjścia'}.`, { fix: 'Codex naprawia środowisko Pythona; treść nie wraca do Pisarza.' }));
  } else {
    String(`${python.stdout || ''}\n${python.stderr || ''}`).split('\n')
      .filter((line) => line.startsWith('[FAIL] ') && !/errors=\d+/.test(line))
      .forEach((line) => out.push(issue(OWNERS.WRITER, 'DRAFT_VALIDATOR', 'DRAFT_CONTRACT', line.slice(7))));
    if (python.status !== 0 && !out.some((item) => item.check === 'DRAFT_VALIDATOR')) {
      out.push(issue(OWNERS.CODEX, 'DRAFT_VALIDATOR', 'PYTHON_ENVIRONMENT_FAILURE', `Walidator Pythona zakończył się kodem ${python.status} bez diagnostyki kontraktu.`, { fix: 'Codex diagnozuje interpreter lub zależności; nie zmieniaj treści.' }));
    }
  }
  return out;
}

function technicalAuditIdentity(article, packageHash, args, dependencies) {
  return validationIdentity(ROOT, {
    code: ['scripts/package-audit.js'], inputs: ['package.json', 'package-lock.json', 'scripts/config'],
    parameters: { profile: 'technical', file: path.resolve(args.file), assetsDir: path.resolve(args['assets-dir'] || path.dirname(args.file)), packageHash, force: ['true', '1', 'yes'].includes(String(args.force).toLowerCase()), collision: fs.existsSync(path.join(dependencies.root || ROOT, `${article?.slug || ''}.html`)) },
  });
}

function auditPackage(args, dependencies = {}) {
  if (!args.file) throw new Error('Użycie: npm run package:audit -- --file <draft.fitpo50.json> [--assets-dir <katalog>] [--profile technical|editorial] [--force true]');
  const profile = args.profile || 'editorial';
  if (!['technical', 'editorial'].includes(profile)) throw new Error(`Nieobsługiwany profil audytu: ${profile}. Dozwolone: technical, editorial.`);
  args = { ...args, profile };
  const file = path.resolve(args.file);
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(file));
  let article;
  try { article = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (profile === 'technical') {
      const syntax = error instanceof SyntaxError;
      return finishReport(file, assetsDir, null, [issue(
        syntax ? OWNERS.WRITER : OWNERS.CODEX, 'JSON_PARSE', syntax ? 'JSON_PARSE_ERROR' : 'JSON_READ_ENVIRONMENT_FAILURE',
        error.message || error, { path: '/', fix: syntax ? 'Popraw składnię JSON-u.' : 'Przywróć dostęp do wskazanego pliku JSON.' },
      )], [{ check: 'PACKAGE_STRUCTURE_AND_FILES', status: 'BLOCKED_DEPENDENCY', dependency: syntax ? 'JSON_PARSE' : 'JSON_READ' }], args, dependencies);
    }
    const parseIssue = issue(OWNERS.WRITER, 'JSON_PARSE', 'JSON_PARSE_ERROR', error.message || error, { fix: 'Pisarz eksportuje poprawny składniowo JSON.' });
    return finishReport(file, assetsDir, null, [parseIssue], [
      { check: 'CONTRACT_V2', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
      { check: 'SOURCES_AND_COVERAGE', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
      { check: 'FAQ', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
      { check: 'IMAGE_FILES', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
    ], args, dependencies);
  }
  if (profile === 'technical') {
    if (Object.keys(dependencies).every((key) => key === 'root')) {
      try {
        const identity = packageIdentity(file, assetsDir, article);
        const reportFile = path.join(path.resolve(args['report-dir'] || process.env.FITPO50_PACKAGE_AUDIT_DIR || path.join(ROOT, 'data/reports/local/package-audit')), `${identity.hash}.technical.json`);
        const previous = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        if (previous.profile === 'technical' && previous.exit_code === 0 && previous.validation_identity === technicalAuditIdentity(article, identity.hash, args, dependencies)) {
          return { ...previous, report_file: reportFile, reused: true };
        }
      } catch (_error) { /* Brak aktualnego wyniku: wykonaj audyt. */ }
    }
    const result = technicalIssues(article, assetsDir, args, dependencies);
    return finishReport(file, assetsDir, article, result.issues, result.blocked, args, dependencies);
  }
  let issues = [...contractIssues(article), ...unitIssues(article), ...imageIssues(article, assetsDir, dependencies), ...overlayIssues(article)];
  const evidence = validateArticleEvidence(article, { allowPendingAutocomplete: true, allowPendingVerification: true });
  evidence.errors.forEach((message) => issues.push(issue(OWNERS.WRITER, /faq/iu.test(message) ? 'FAQ' : 'SOURCES_AND_COVERAGE', 'EVIDENCE_CONTRACT', message)));
  issues.push(...subprocessIssues(file, dependencies));
  return finishReport(file, assetsDir, article, uniqueIssues(issues), [], args, dependencies);
}

function finishReport(file, assetsDir, article, issues, blocked, args, dependencies = {}) {
  const technical = args.profile === 'technical';
  let identity = { hash: 'unparseable', entries: [{ path: path.basename(file), sha256: null }] };
  try { if (article !== undefined && article !== null) identity = packageIdentity(file, assetsDir, article); }
  catch (error) {
    if (!technical) throw error;
    issues.push(issue(OWNERS.CODEX, 'PACKAGE_FILES', 'PACKAGE_READ_ENVIRONMENT_FAILURE', error.message || error, { fix: 'Przywróć dostęp do plików paczki i ponów audyt.' }));
  }
  const reportDir = path.resolve(args['report-dir'] || process.env.FITPO50_PACKAGE_AUDIT_DIR || path.join(ROOT, 'data', 'reports', 'local', 'package-audit'));
  const grouped = Object.fromEntries(Object.values(OWNERS).map((owner) => [owner, issues.filter((item) => item.owner === owner)]));
  const environmentFailure = grouped.CODEX.some((item) => item.code.endsWith('ENVIRONMENT_FAILURE'));
  const warnings = (identity.ignored_files || []).map((fileName) => ({
    code: 'IGNORED_FOREIGN_FILE',
    path: fileName,
    message: `Plik nie należy do jawnej paczki artykułu i nie wpływa na SHA-256: ${fileName}`,
  }));
  const proposedChanges = grouped.CODEX.flatMap((item) => item.proposed_change ? [{ path: item.path, code: item.code, ...item.proposed_change }] : []);
  const report = {
    version: 1,
    profile: args.profile || 'editorial',
    ...(technical && Object.keys(dependencies).every((key) => key === 'root') ? { validation_identity: technicalAuditIdentity(article, identity.hash, args, dependencies) } : {}),
    generated_at: warsawIso(),
    package_sha256: identity.hash,
    package_files: identity.entries,
    input_file: file,
    assets_dir: assetsDir,
    status: environmentFailure ? 'ENVIRONMENT_FAILURE' : (technical ? (issues.length ? 'TECHNICAL_BLOCKED' : 'TECHNICAL_READY') : (issues.length ? 'BLOCKED' : 'READY_FOR_VISUAL_REVIEW')),
    exit_code: environmentFailure ? EXIT.ENVIRONMENT : (issues.length ? EXIT.CONTENT : EXIT.READY),
    blocked_dependencies: blocked,
    mandatory_visual_review: technical
      ? { status: 'NOT_IN_SCOPE', scope: 'Obrazy i wygląd zatwierdza Grzegorz; ten audyt sprawdza wyłącznie pliki techniczne.' }
      : { status: 'PENDING', scope: 'Wszystkie obrazy we wszystkich formatach AVIF/WebP/JPG, osobny etap tej samej rundy.' },
    ...(technical ? {
      not_in_scope: TECHNICAL_ONLY_EXCLUSIONS,
      next_step: environmentFailure ? 'FIX_ENVIRONMENT_AND_REPEAT_AUDIT' : (issues.length ? 'FIX_PACKAGE_AND_REPEAT_AUDIT' : 'BUILD_AND_VALIDATE_ARTICLE_IN_STAGING'),
    } : {}),
    by_owner: grouped,
    warnings,
    proposed_changes: proposedChanges,
    summary: { errors: issues.length, warnings: warnings.length, writer: grouped.PISARZ.length, illustrator: grouped.ILUSTRATOR.length, codex: grouped.CODEX.length, blocked_dependency: blocked.length, proposed_changes: proposedChanges.length },
  };
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `${identity.hash}${technical ? '.technical' : ''}.json`);
  (dependencies.writeFileSync || atomicWriteFileSync)(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { ...report, report_file: reportFile };
}

function printReport(report) {
  console.log(`[PACKAGE_AUDIT]${report.reused ? '[REUSED]' : ''}[${report.status}] sha256=${report.package_sha256}`);
  for (const owner of Object.values(OWNERS)) {
    console.log(`\n[${owner}] ${report.by_owner[owner].length}`);
    report.by_owner[owner].forEach((item) => {
      console.log(`- ${item.path} [${item.code}] ${item.message}`);
      console.log(`  POPRAWKA: ${item.fix}`);
      if (item.illustrator_prompt) console.log(`  PROMPT: ${item.illustrator_prompt}`);
    });
  }
  report.blocked_dependencies.forEach((item) => console.log(`[BLOCKED_DEPENDENCY] ${item.check} <- ${item.dependency}`));
  report.warnings.forEach((item) => console.warn(`[WARNING][${item.code}] ${item.message}`));
  if (report.proposed_changes.length) {
    console.log(`\n[PROPOSED_CHANGES][AWAITING_APPROVAL] ${report.proposed_changes.length}`);
    report.proposed_changes.forEach((item) => console.log(`- ${item.path} [${item.code}] ${JSON.stringify(item)}`));
  }
  console.log(`\n[VISUAL_REVIEW][${report.mandatory_visual_review.status}] ${report.mandatory_visual_review.scope}`);
  console.log(`[REPORT] ${report.report_file}`);
}

function main() {
  const report = auditPackage(parseArgs(process.argv.slice(2)));
  printReport(report);
  process.exitCode = report.exit_code;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`[PACKAGE_AUDIT][FAIL] ${error.message || error}`); process.exitCode = EXIT.ENVIRONMENT; }
}

module.exports = { EXIT, OWNERS, auditPackage, contractIssues, imageIssues, metricProposal, overlayIssues, parseArgs, printReport, technicalIssues, unitIssues };
