#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { POLICY, utils, validators } = require('./lib/article-policy');
const { validateArticleEvidence } = require('./lib/article-evidence');
const { validateArticleArchitecture } = require('./lib/article-intent-links');
const { isSupportedCategory } = require('./lib/categories');

const SOURCE_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'avif'];
const PLACEHOLDER_RX = /(do doprecyzowania|do uzupelnienia|placeholder|\{\{.+?\}\})/i;
const READ_TIME_RX = /^\d+\s+min\s+czytania$/i;

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
  return null;
}

function suggestSourceImageLocation(baseName, assetsDir) {
  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) return '';
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = findSourceImage(baseName, path.join(assetsDir, entry.name));
    if (nested) return nested;
  }
  return '';
}

function countInternalLinksInSections(sections) {
  const chunks = [];
  for (const section of sections) {
    const arr = Array.isArray(section.paragraphs_html) ? section.paragraphs_html : [];
    chunks.push(...arr);
  }
  return utils.countInternalHtmlLinks(chunks);
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
  return utils.normalizeInternalHtmlHref(raw);
}

function normalizeForSearch(value) {
  return utils.stripTags(String(value || ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasKnownImageExtension(value) {
  return /\.(png|jpe?g|webp|avif)$/i.test(String(value || '').trim());
}

function hashFile(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
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

  const categoryRaw = String(json.category || json.section || '').trim().toLowerCase();
  if (!categoryRaw) {
    errors.push('Brak category w JSON. Artykuł musi mieć kategorię: zdrowie, jedzenie, ruch/rusz-sie, ciekawe albo mity.');
  } else if (!isSupportedCategory(categoryRaw)) {
    errors.push(`Nieobsługiwana category: "${json.category || json.section}". Dozwolone: zdrowie, jedzenie, ruch/rusz-sie, ciekawe, mity.`);
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
  if (sections.length < 6) {
    errors.push(`sections: wymagane >=6, jest ${sections.length}.`);
  }

  const readingTime = String(json.reading_time || json.readTime || '').replace(/\s+/g, ' ').trim();
  if (!READ_TIME_RX.test(readingTime)) {
    errors.push(`reading_time: niepoprawny format "${readingTime || '(brak)'}" (oczekiwane: "X min czytania").`);
  }

  const quickAnswer = utils.stripTags(String(json.quick_answer || json.quickAnswer || '')).replace(/\s+/g, ' ').trim();
  const rawTitle = String(json.title || '').replace(/\s+/g, ' ').trim();
  const rawSeoTitle = String(json.seo_title || '').replace(/\s+/g, ' ').trim();
  const listingTitle = String(json.listing_title || '').replace(/\s+/g, ' ').trim();
  const listingDesc = String(json.listing_desc || '').replace(/\s+/g, ' ').trim();
  const titleValidation = validators.validateTitleText(rawTitle, {
    label: 'title',
    min: POLICY.TITLE.JSON_MIN,
    max: POLICY.TITLE.MAX
  });
  titleValidation.errors.forEach((msg) => errors.push(msg));
  if (rawSeoTitle) {
    const seoTitleValidation = validators.validateTitleText(rawSeoTitle, {
      label: 'seo_title',
      min: POLICY.TITLE.MIN,
      max: POLICY.TITLE.MAX
    });
    seoTitleValidation.errors.forEach((msg) => errors.push(msg));
  }
  if (listingTitle) {
    const listingTitleValidation = validators.validateTitleText(listingTitle, {
      label: 'listing_title',
      min: POLICY.TITLE.JSON_MIN,
      max: 90
    });
    listingTitleValidation.errors.forEach((msg) => errors.push(msg));
  }
  if (/\|\s*fitpo50\s*$/i.test(rawSeoTitle)) {
    warnings.push('seo_title zawiera już suffix "| FitPo50" — importer go znormalizuje, ale lepiej traktować seo_title jako bazę bez suffixu.');
  }
  if (!rawSeoTitle) {
    warnings.push('Brak seo_title — importer użyje title, ale dla kontroli snippetów lepiej podać seo_title jawnie.');
  }
  if (!listingTitle) {
    warnings.push('Brak listing_title — importer użyje title, ale homepage i listingi lepiej kontrolować osobnym listing_title.');
  }
  if (!listingDesc) {
    warnings.push('Brak listing_desc — importer użyje fallback tekstowy, ale listingi lepiej kontrolować osobnym listing_desc.');
  }
  const quickValidation = validators.validateQuickAnswer(quickAnswer, { mode: 'strict' });
  quickValidation.errors.forEach((msg) => errors.push(msg));

  const claim = String(json.quick_answer_claim || '').trim();
  const limit = String(json.quick_answer_limit || '').trim();
  const noGeneric = json.quick_answer_no_generic;
  if (claim && claim.length < 10) {
    warnings.push('quick_answer_claim jest bardzo krótki — zalecane min. 10 znaków.');
  }
  if (limit && limit.length < 4) {
    warnings.push('quick_answer_limit wygląda na zbyt krótki — doprecyzuj warunek/liczbę.');
  }
  if (noGeneric !== undefined && noGeneric !== true) {
    warnings.push('quick_answer_no_generic ustaw na true (pole opcjonalne checklisty redakcyjnej).');
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

  if (isSupportedCategory(categoryRaw) && /^(mity|mit|obnazamy-mity|obnażamy-mity|sciema-czy-fakt|ściema-czy-fakt)$/i.test(categoryRaw)) {
    const sectionText = normalizeForSearch(sections.map((section) => [
      section.title || section.heading || '',
      ...(Array.isArray(section.paragraphs_html) ? section.paragraphs_html : []),
    ].join(' ')).join(' '));
    const faqText = normalizeForSearch(answerBlocks.map((item) => `${item?.question || ''} ${item?.answer_html || ''}`).join(' '));
    const hasMythSignal = /\bmit\b|\bmity\b|myth_claim/i.test(sectionText) || String(json.myth_claim || '').trim().length >= 12;
    const hasVerdictSignal = /werdykt|fitpo50_verdict|polprawda|polfakt|brak dobrych dowodow|mocne dowody|umiarkowane dowody|slabe dowody/i.test(sectionText)
      || String(json.fitpo50_verdict || '').trim().length >= 3;
    const hasPracticalAlternative = /co (naprawde )?dziala|zamiast tego|co robic zamiast|praktyczn/i.test(sectionText);
    const hasMythFactTable = /<table\b/i.test(raw) && /\bmit\b/i.test(sectionText) && /\b(fakt|fakty|prawda|dowod|dowody)\b/i.test(sectionText);
    const hasMechanismFaq = /(mechanizm|fizjolog|dlaczego|jak to dziala|co mowi)/i.test(faqText);
    if (!hasMythSignal) {
      errors.push('Mity: JSON musi jasno nazwać obalany mit (np. myth_claim albo sekcja/akapit z frazą MIT).');
    }
    if (!hasVerdictSignal) {
      errors.push('Mity: brak jasnego werdyktu FitPo50 albo oceny siły dowodów.');
    }
    if (!hasPracticalAlternative) {
      errors.push('Mity: brak praktycznego domknięcia typu "co naprawdę działa" / "co robić zamiast".');
    }
    if (!hasMythFactTable) {
      errors.push('Mity: wymagana jest tabela HTML porównująca MIT z faktem/prawdą/dowodami.');
    }
    if (!hasMechanismFaq) {
      errors.push('Mity: answer_blocks powinny zawierać pytanie/odpowiedź o mechanizmie mitu, a nie tylko ogólne FAQ tematu.');
    }
  }

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
  const repeatedSentences = utils.collectRepeatedLongSentences([
    json.lead || '',
    json.quick_answer || json.quickAnswer || '',
    ...sections.flatMap((s) => Array.isArray(s.paragraphs_html) ? s.paragraphs_html : []),
  ]);
  if (repeatedSentences.length) {
    errors.push(`Wykryto powtarzalne zdania w JSON (${repeatedSentences[0].count}x): "${repeatedSentences[0].sentence.slice(0, 90)}..."`);
  }

  const logicItems = [];
  if (json.lead) logicItems.push({ label: 'lead', text: json.lead });
  if (json.quick_answer || json.quickAnswer) logicItems.push({ label: 'quick_answer', text: json.quick_answer || json.quickAnswer });
  sections.forEach((section, sectionIndex) => {
    const sectionLabel = `sections[${sectionIndex + 1}]`;
    if (Array.isArray(section.paragraphs_html)) {
      section.paragraphs_html.forEach((paragraph, paragraphIndex) => {
        logicItems.push({
          label: `${sectionLabel}.paragraphs_html[${paragraphIndex + 1}]`,
          text: paragraph
        });
      });
    }
    if (section.info_box && typeof section.info_box === 'object') {
      logicItems.push({
        label: `${sectionLabel}.info_box`,
        text: `${section.info_box.title || ''} ${section.info_box.content_html || ''}`
      });
    }
  });
  answerBlocks.forEach((item, idx) => {
    logicItems.push({
      label: `answer_blocks[${idx + 1}]`,
      text: `${item?.question || ''} ${item?.answer_html || ''}`
    });
  });
  const logicValidation = validators.validateLogicalCoherence(logicItems);
  logicValidation.errors.forEach((msg) => errors.push(msg));
  const evidenceValidation = validateArticleEvidence(json);
  evidenceValidation.errors.forEach((msg) => errors.push(`Evidence: ${msg}`));
  const architectureValidation = validateArticleArchitecture(json, { root: process.cwd() });
  architectureValidation.errors.forEach((msg) => errors.push(`Architecture: ${msg}`));
  architectureValidation.warnings.forEach((msg) => warnings.push(`Architecture: ${msg}`));

  const hero = String(json.hero_image || '').trim();
  let heroSourceImage = '';
  if (!hero) errors.push('Brak hero_image.');
  else if (hasKnownImageExtension(hero)) {
    warnings.push('hero_image zawiera rozszerzenie pliku. Standard źródłowy to sama baza nazwy, np. "apob-hero", bez .png/.jpg.');
  }
  else {
    heroSourceImage = findSourceImage(hero, assetsDir) || '';
    if (!heroSourceImage) {
      const suggestion = suggestSourceImageLocation(hero, assetsDir);
      const suffix = suggestion ? ` (podpowiedź: znaleziono w ${path.dirname(suggestion)} — użyj tego folderu jako --assets-dir)` : '';
      errors.push(`Brak źródłowego pliku hero_image w ${assetsDir} dla: ${hero}.{png|jpg|jpeg|webp|avif}${suffix}`);
    }
  }

  // section source images by image_prompts_v4 filename_base
  const promptsV4 = Array.isArray(json.image_prompts_v4) ? json.image_prompts_v4 : [];
  const promptsLegacy = Array.isArray(json.image_prompts) ? json.image_prompts : [];
  const prompts = promptsV4.length ? promptsV4 : promptsLegacy;
  if (prompts.length < 7) {
    errors.push(`image_prompts: wymagane >=7, jest ${prompts.length}.`);
  }
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
    const sourceImage = findSourceImage(base, assetsDir);
    if (!sourceImage) {
      const suggestion = suggestSourceImageLocation(base, assetsDir);
      const suffix = suggestion ? ` (podpowiedź: znaleziono w ${path.dirname(suggestion)} — użyj tego folderu jako --assets-dir)` : '';
      errors.push(`Brak źródłowego obrazu sekcji: ${base}.{png|jpg|jpeg|webp|avif} w ${assetsDir}${suffix}`);
    } else if (heroSourceImage && base !== hero) {
      const sectionHash = hashFile(sourceImage);
      const heroHash = hashFile(heroSourceImage);
      if (sectionHash === heroHash) {
        errors.push(`Obraz sekcji "${base}" jest identyczny z hero "${hero}". To wygląda na ukryty fallback zamiast właściwej grafiki.`);
      }
    }
  });

  sections.forEach((section, idx) => {
    const src = String(section?.image?.src || section?.image?.path || '').trim();
    if (!src) return;
    const m = src.match(/(?:^|\/)([^/]+)\.(?:png|jpe?g|webp|avif)(?:[?#].*)?$/i);
    if (!m) return;
    const base = m[1];
    if (!findSourceImage(base, assetsDir)) {
      const suggestion = suggestSourceImageLocation(base, assetsDir);
      const suffix = suggestion ? ` (podpowiedź: znaleziono w ${path.dirname(suggestion)} — użyj tego folderu jako --assets-dir)` : '';
      errors.push(`sections[${idx + 1}].image.src wskazuje "${base}", ale brak źródłowego obrazu ${base}.{png|jpg|jpeg|webp|avif} w ${assetsDir}${suffix}`);
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
