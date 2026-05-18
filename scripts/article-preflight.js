#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { POLICY, utils, validators } = require('./lib/article-policy');

const SOURCE_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'avif'];
const PLACEHOLDER_RX = /(do doprecyzowania|do uzupelnienia|placeholder|\{\{.+?\}\})/i;
const REPEATED_SENTENCE_MIN_WORDS = 8;
const REPEATED_SENTENCE_MIN_CHARS = 45;
const REPEATED_SENTENCE_MIN_REPEATS = 3;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const key = t.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function collectRepeatedLongSentences(chunks) {
  const source = chunks.map((x) => String(x || '')).join(' ');
  const plain = utils.stripTags(source);
  const sentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const map = new Map();
  for (const sentence of sentences) {
    const norm = utils.fuzzyNormalize(sentence);
    if (!norm) continue;
    if (utils.countWords(norm) < REPEATED_SENTENCE_MIN_WORDS) continue;
    if (norm.length < REPEATED_SENTENCE_MIN_CHARS) continue;
    map.set(norm, (map.get(norm) || 0) + 1);
  }
  return [...map.entries()].filter(([, c]) => c >= REPEATED_SENTENCE_MIN_REPEATS);
}

function findSourceImage(baseName, assetsDir) {
  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) return null;
  const cleanBase = String(baseName || '')
    .trim()
    .normalize('NFKC')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const files = fs.readdirSync(assetsDir);
  const exact = files.find((name) => {
    const lower = name.toLowerCase().normalize('NFKC').replace(/[\u00A0\u2007\u202F]/g, ' ');
    return SOURCE_IMAGE_EXT.some((ext) => lower === `${cleanBase}.${ext}`);
  });
  if (exact) return path.join(assetsDir, exact);

  // fallback fuzzy: compare base names ignoring spaces/diacritics
  const norm = (x) => x
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();
  const baseNorm = norm(cleanBase);
  for (const name of files) {
    const ext = path.extname(name).slice(1).toLowerCase();
    if (!SOURCE_IMAGE_EXT.includes(ext)) continue;
    const fileBase = name.slice(0, -(ext.length + 1));
    if (norm(fileBase) === baseNorm) return path.join(assetsDir, name);
  }
  const tokenize = (x) => x
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
  const targetTokens = tokenize(cleanBase);
  let best = null;
  let bestScore = 0;
  for (const name of files) {
    const ext = path.extname(name).slice(1).toLowerCase();
    if (!SOURCE_IMAGE_EXT.includes(ext)) continue;
    const fileBase = name.slice(0, -(ext.length + 1));
    const fileTokens = new Set(tokenize(fileBase));
    let score = 0;
    for (const t of targetTokens) {
      if (fileTokens.has(t)) score += 1;
      if (t === 'staircase' && (fileTokens.has('schody') || fileTokens.has('stairs'))) score += 1;
      if (t === 'hero' && (fileTokens.has('lead') || fileTokens.has('hero'))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  if (best && bestScore > 0) return path.join(assetsDir, best);
  return null;
}

function countInternalLinksInSections(sections) {
  const unique = new Set();
  const rx = /<a\b[^>]*href="([^"]+)"/gi;
  for (const section of sections) {
    const arr = Array.isArray(section.paragraphs_html) ? section.paragraphs_html : [];
    for (const p of arr) {
      for (const m of String(p || '').matchAll(rx)) {
        const href = String(m[1] || '').trim();
        if (!href) continue;
        const isAbsInternal = /^https?:\/\/(www\.)?fitpo50\.pl\/[^"\s]+\.html(?:[?#].*)?$/i.test(href);
        const isRelInternal = !/^(https?:|mailto:|tel:|javascript:|#)/i.test(href) && /\.html(?:[?#].*)?$/i.test(href);
        if (!isAbsInternal && !isRelInternal) continue;
        const normalized = href
          .replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, '')
          .replace(/^\.\//, '');
        if (/^porady\.html(?:[?#].*)?$/i.test(normalized)) continue;
        unique.add(normalized);
      }
    }
  }
  return unique.size;
}

function collectInternalLinksFromHtml(html) {
  const out = [];
  const rx = /<a\b[^>]*href="([^"]+)"/gi;
  for (const m of String(html || '').matchAll(rx)) {
    const href = String(m[1] || '').trim();
    if (!href) continue;
    const isAbsInternal = /^https?:\/\/(www\.)?fitpo50\.pl\/[^"\s]+\.html(?:[?#].*)?$/i.test(href);
    const isRelInternal = !/^(https?:|mailto:|tel:|javascript:|#)/i.test(href) && /\.html(?:[?#].*)?$/i.test(href);
    if (!isAbsInternal && !isRelInternal) continue;
    out.push(href);
  }
  return out;
}

function normalizeLocalHrefToPath(href) {
  const raw = String(href || '').trim();
  if (/^https?:\/\/(www\.)?fitpo50\.pl\//i.test(raw)) {
    return raw
      .replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, '')
      .replace(/^[./]+/, '')
      .replace(/[?#].*$/, '');
  }
  return raw.replace(/^[./]+/, '').replace(/[?#].*$/, '');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file ? path.resolve(args.file) : '';
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node scripts/article-preflight.js --file <path.fitpo50.json> [--assets-dir <dir>]');
    process.exit(1);
  }
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(file));
  const raw = fs.readFileSync(file, 'utf8');
  const json = JSON.parse(raw);
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    errors.push(`Nie znaleziono katalogu assets-dir: ${assetsDir}`);
  }

  if (PLACEHOLDER_RX.test(raw)) {
    errors.push('Wykryto placeholder redakcyjny w JSON (np. "do doprecyzowania" / "{{...}}").');
  }

  if (!Array.isArray(json.sources) || json.sources.length < 6) {
    errors.push(`sources: wymagane >=6, jest ${Array.isArray(json.sources) ? json.sources.length : 0}.`);
  } else {
    json.sources.forEach((s, i) => {
      if (!s || typeof s !== 'object' || !String(s.label || '').trim() || !/^https:\/\//i.test(String(s.url || ''))) {
        errors.push(`sources[${i}] musi mieć format {label,url:https}.`);
      }
    });
  }

  const sections = Array.isArray(json.sections) ? json.sections : [];
  const quickAnswer = utils.stripTags(String(json.quick_answer || json.quickAnswer || '')).replace(/\s+/g, ' ').trim();
  const quickAnswerWords = utils.countWords(quickAnswer);
  if (!quickAnswer) {
    errors.push(`Brak quick_answer (wymagane ${POLICY.WORDS.QUICK_ANSWER_MIN}-${POLICY.WORDS.QUICK_ANSWER_MAX} słów).`);
  } else if (quickAnswerWords < POLICY.WORDS.QUICK_ANSWER_MIN || quickAnswerWords > POLICY.WORDS.QUICK_ANSWER_MAX) {
    errors.push(`quick_answer poza zakresem ${POLICY.WORDS.QUICK_ANSWER_MIN}-${POLICY.WORDS.QUICK_ANSWER_MAX} słów (jest ${quickAnswerWords}).`);
  }
  sections.forEach((section, idx) => {
    const headingRes = validators.validateH2Title(String(section.title || section.heading || '').trim());
    if (!headingRes.ok) {
      errors.push(`sections[${idx + 1}].title: ${headingRes.error}`);
    }
    const p = Array.isArray(section.paragraphs_html) ? section.paragraphs_html[0] || '' : '';
    const introRes = validators.validateIntroParagraph(utils.stripTags(p));
    if (!introRes.ok) {
      errors.push(`sections[${idx + 1}] pierwszy akapit: ${introRes.error}`);
    }
  });

  const internalLinks = countInternalLinksInSections(sections);
  if (internalLinks < POLICY.WORDS.INTERNAL_LINKS_MIN) {
    errors.push(`Za mało linków kontekstowych w sekcjach JSON: ${internalLinks}/${POLICY.WORDS.INTERNAL_LINKS_MIN} (wymagane minimum ${POLICY.WORDS.INTERNAL_LINKS_MIN}).`);
  }

  if (!Array.isArray(json.answer_blocks) || json.answer_blocks.length < POLICY.WORDS.FAQ_MIN_ITEMS) {
    errors.push(`FAQ answer_blocks: wymagane >=${POLICY.WORDS.FAQ_MIN_ITEMS}, jest ${Array.isArray(json.answer_blocks) ? json.answer_blocks.length : 0}.`);
  }
  const faqResearch = Array.isArray(json.faq_research) ? json.faq_research : [];
  if (faqResearch.length < POLICY.WORDS.FAQ_MIN_ITEMS) {
    errors.push(`faq_research: wymagane >=${POLICY.WORDS.FAQ_MIN_ITEMS}, jest ${faqResearch.length}.`);
  }
  const normalizeQuestion = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const answerBlocks = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  const faqResearchSet = new Set(faqResearch.map((item) => normalizeQuestion(item && item.question)));
  answerBlocks.forEach((item, idx) => {
    const q = normalizeQuestion(item && item.question);
    if (q && !faqResearchSet.has(q)) {
      errors.push(`FAQ #${idx + 1}: pytanie nie ma dopasowania 1:1 w faq_research.question.`);
    }
  });

  const htmlChunks = [];
  sections.forEach((section) => {
    const arr = Array.isArray(section.paragraphs_html) ? section.paragraphs_html : [];
    htmlChunks.push(...arr);
    if (section.info_box && typeof section.info_box === 'object') {
      htmlChunks.push(String(section.info_box.content_html || ''));
    }
  });
  answerBlocks.forEach((item) => htmlChunks.push(String(item?.answer_html || '')));

  const missingLinks = [];
  htmlChunks.forEach((chunk) => {
    for (const href of collectInternalLinksFromHtml(chunk)) {
      const localPath = normalizeLocalHrefToPath(href);
      if (!localPath) continue;
      if (!fs.existsSync(localPath)) {
        missingLinks.push(href);
      }
    }
  });
  if (missingLinks.length) {
    errors.push(`Wykryto nieistniejące linki wewnętrzne: ${[...new Set(missingLinks)].slice(0, 6).join(', ')}`);
  }

  for (const chunk of htmlChunks) {
    for (const codeMatch of String(chunk || '').matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gi)) {
      const code = String(codeMatch[1] || '');
      const bad = [...code].filter((ch) => ch.charCodeAt(0) > 127);
      if (bad.length) {
        errors.push(`W <code> wykryto znaki spoza ASCII ("${[...new Set(bad)].join('')}"), co blokuje generator PDF.`);
        break;
      }
    }
  }
  const repeatedSentences = collectRepeatedLongSentences([
    json.lead || '',
    json.quick_answer || json.quickAnswer || '',
    ...sections.flatMap((s) => Array.isArray(s.paragraphs_html) ? s.paragraphs_html : []),
  ]);
  if (repeatedSentences.length) {
    errors.push(`Wykryto powtarzalne zdania w JSON (${repeatedSentences[0][1]}x): "${repeatedSentences[0][0].slice(0, 90)}..."`);
  }

  const hero = String(json.hero_image || '').trim();
  if (!hero) errors.push('Brak hero_image.');
  else if (!findSourceImage(hero, assetsDir)) {
    errors.push(`Brak źródłowego pliku hero_image w ${assetsDir} dla: ${hero}.{png|jpg|jpeg|webp|avif}`);
  }

  // section source images by image_prompts_v4 filename_base
  const promptsV4 = Array.isArray(json.image_prompts_v4) ? json.image_prompts_v4 : [];
  const promptsLegacy = Array.isArray(json.image_prompts) ? json.image_prompts : [];
  const prompts = promptsV4.length ? promptsV4 : promptsLegacy;
  const sectionPrompts = prompts.filter((p) => {
    const t = String(p.type || '');
    const r = String(p.section_ref || '');
    return /^section_/i.test(t) || /^sekcja-\d+/i.test(r);
  });
  if (!sectionPrompts.length) warnings.push('Brak image_prompts_v4 section_* - mapowanie assetów sekcji może wymagać ręcznej kontroli.');
  sectionPrompts.forEach((p, i) => {
    const base = String(p.filename_base || '').trim();
    if (!base) {
      errors.push(`image_prompts_v4 section #${i + 1}: brak filename_base.`);
      return;
    }
    if (!findSourceImage(base, assetsDir)) {
      errors.push(`Brak źródłowego obrazu sekcji: ${base}.{png|jpg|jpeg|webp|avif} w ${assetsDir}`);
    }
  });

  if (warnings.length) {
    console.log('[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }

  if (errors.length) {
    console.error('\n[FAIL] article-preflight');
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  console.log('[PASS] article-preflight OK');
}

main();
