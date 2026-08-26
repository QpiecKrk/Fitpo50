#!/usr/bin/env node

const fs = require('fs');
const { spawnSync } = require('child_process');
const { POLICY, utils } = require('./lib/article-policy');
const { MEDICAL_EVIDENCE_LEVELS, isStrongMedicalSource, validateArticleEvidence } = require('./lib/article-evidence');
const { validateArticleArchitecture } = require('./lib/article-intent-links');
const { validateManifestStructure } = require('./lib/article-media');

const errors = [];
const warnings = [];

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' });
}

function readChangedFiles() {
  const diff = run('git', ['diff', '--name-only', 'origin/main...HEAD']);
  if (diff.status !== 0) {
    const msg = String(diff.stderr || diff.stdout || '').trim();
    throw new Error(`Nie udało się odczytać diff origin/main...HEAD: ${msg}`);
  }
  return String(diff.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const out = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--file') {
      const next = argv[i + 1];
      if (next && !String(next).startsWith('--')) {
        out.files.push(String(next));
        i += 1;
      }
    }
  }
  return out;
}

function isFitpoJson(file) {
  return /\.fitpo50\.json$/i.test(file) || /fitpo50\.json$/i.test(file);
}

function isArchivedImport(file) {
  return String(file || '').replace(/\\/g, '/').startsWith('data/import/archive/');
}

function isIntentionalInvalidFixture(file) {
  return String(file || '').replace(/\\/g, '/').startsWith('tests/fixtures/pipeline-invalid/');
}

function countWords(text) {
  return utils.countWords(text);
}

function normalizeTextForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuickAnswerForSentenceGate(text) {
  return String(text || '')
    .replace(/\b(\d+)\.(?=\s*(?:roku|lat|r\.ż\.|rż|r\.|życia|tce|tką|tkę|i|oraz|a|ale|bo|,))/giu, '$1')
    .replace(/\b([A-ZĄĆĘŁŃÓŚŹŻ])\.(?=\s+[A-ZĄĆĘŁŃÓŚŹŻ])/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasClearQuickAnswerForm(text) {
  const normalized = normalizeQuickAnswerForSentenceGate(text);
  if (!/^[A-ZĄĆĘŁŃÓŚŹŻ]/u.test(normalized) || !/[.?!]$/u.test(normalized) || normalized.length < 16) return false;
  const endings = normalized.match(/[?!]|\.(?=\s+[A-ZĄĆĘŁŃÓŚŹŻ]|$)/gu) || [];
  return endings.length >= 1 && endings.length <= 3;
}

function collectRepeatedLongSentences(chunks) {
  const repeated = utils.collectRepeatedLongSentences(chunks);
  return repeated.map((item) => [item.sentence, item.count]);
}

function isQuestionHeading(text) {
  return String(text || '').trim().endsWith('?');
}

function normalizeLocalHtmlHref(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  if (/^https?:\/\/(www\.)?fitpo50\.pl\//i.test(raw)) {
    return raw
      .replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, '')
      .replace(/^[./]+/, '')
      .replace(/[?#].*$/, '');
  }
  return raw.replace(/^[./]+/, '').replace(/[?#].*$/, '');
}

function checkInternalHtmlLinks(value, label) {
  const rx = /href\s*=\s*"([^"]+)"/gi;
  const text = String(value || '');
  for (const m of text.matchAll(rx)) {
    const href = String(m[1] || '').trim();
    if (!href) continue;
    const isAbsInternal = /^https?:\/\/(www\.)?fitpo50\.pl\/[^"\s]+\.html(?:[?#].*)?$/i.test(href);
    const isRelInternal = !/^(https?:|mailto:|tel:|#|javascript:)/i.test(href) && /\.html(?:[?#].*)?$/i.test(href);
    if (!isAbsInternal && !isRelInternal) continue;
    const local = normalizeLocalHtmlHref(href);
    const target = local ? local : href;
    if (!fs.existsSync(target)) {
      errors.push(`${label}: link wewnętrzny wskazuje na nieistniejący plik (${href}).`);
    }
  }
}

function countInternalHtmlLinks(chunks) {
  return utils.countInternalHtmlLinks(chunks);
}

function isGenericAnchor(text) {
  const clean = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!clean) return false;
  const generic = new Set([
    'tutaj', 'tu', 'kliknij tutaj', 'kliknij', 'sprawdź tutaj', 'sprawdz tutaj',
    'zobacz', 'czytaj więcej', 'czytaj wiecej', 'więcej', 'wiecej'
  ]);
  return generic.has(clean);
}

function calculateAeoScore(ctx) {
  let quickAnswer = 0;
  let faqIntent = 0;
  let sources = 0;
  let links = 0;
  const notes = [];

  if (ctx.quickAnswerWords >= POLICY.WORDS.QUICK_ANSWER_MIN && ctx.quickAnswerWords <= POLICY.WORDS.QUICK_ANSWER_MAX) {
    quickAnswer += 15;
  } else if (ctx.quickAnswerWords >= 30 && ctx.quickAnswerWords <= 80) {
    quickAnswer += 8;
    notes.push('quick_answer: poza limitem polityki, ale nadal czytelny.');
  } else {
    notes.push('quick_answer: zbyt krótki lub zbyt długi.');
  }
  if (hasClearQuickAnswerForm(ctx.quickAnswerPlain)) quickAnswer += 10;
  else notes.push('quick_answer: słaba forma odpowiedzi bez klarownego domknięcia zdania.');

  const intentPattern = /\b(jak|czy|ile|kiedy|dlaczego|objawy|norma|wynik|warto|bezpiecz|dawk|skutek)\b/iu;
  const matchedFaq = ctx.faqQuestions.filter((q) => intentPattern.test(q)).length;
  const faqCoverage = ctx.faqQuestions.length ? matchedFaq / ctx.faqQuestions.length : 0;
  if (ctx.faqQuestions.length >= POLICY.WORDS.FAQ_MIN_ITEMS) faqIntent += 10;
  if (faqCoverage >= 0.75) faqIntent += 10;
  else if (faqCoverage >= 0.5) faqIntent += 5;
  else notes.push('FAQ: słabe pokrycie intencji pytań użytkowników.');
  if (ctx.faqAnswerWordCounts.every((n) => n >= 30 && n <= 60)) faqIntent += 5;
  else notes.push('FAQ: część odpowiedzi wypada poza 30-60 słów.');

  const strongDomains = /(doi\.org|pubmed|nih\.gov|cancer\.gov|who\.int|cdc\.gov|ema\.europa\.eu|ncbi\.nlm\.nih\.gov|frontiersin\.org|nature\.com|gov\.pl|ptkardio|esmo|escardio|aafp|nhs\.uk|cochrane)/i;
  const validUrls = ctx.sourceUrls.filter((u) => /^https?:\/\//i.test(u));
  const strongCount = validUrls.filter((u) => strongDomains.test(u)).length;
  const strongRatio = validUrls.length ? strongCount / validUrls.length : 0;
  if (validUrls.length >= POLICY.WORDS.CITATION_MIN_URLS) sources += 10;
  if (strongRatio >= 0.8) sources += 15;
  else if (strongRatio >= 0.5) sources += 8;
  else notes.push('Źródła: niski udział domen medyczno-naukowych.');

  if (ctx.internalLinkCount >= POLICY.WORDS.INTERNAL_LINKS_MIN) links += 15;
  const genericAnchors = ctx.internalAnchorTexts.filter((a) => isGenericAnchor(a)).length;
  if (ctx.internalAnchorTexts.length && genericAnchors === 0) links += 10;
  else if (genericAnchors > 0) notes.push(`Linki: wykryto generyczne anchory (${genericAnchors}).`);

  const total = quickAnswer + faqIntent + sources + links;
  return { total, breakdown: { quickAnswer, faqIntent, sources, links }, notes };
}

function hasIntentToken(text) {
  const normalized = normalizeTextForCompare(text);
  return (POLICY.FAQ_INTENT_TOKENS || []).some((token) => normalized.includes(normalizeTextForCompare(token)));
}

function collectCodeNonAscii(chunks) {
  const offending = [];
  for (const chunk of chunks) {
    const html = String(chunk || '');
    for (const codeMatch of html.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gi)) {
      const code = String(codeMatch[1] || '');
      const bad = [...code].filter((ch) => ch.charCodeAt(0) > 127);
      if (bad.length) {
        offending.push([...new Set(bad)].join(''));
      }
    }
  }
  return offending;
}

function validateFile(file) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(`${file}: JSON parse error -> ${err.message}`);
    return;
  }

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    errors.push(`${file}: wymagany jest pojedynczy obiekt JSON.`);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(json, 'related_articles') || Object.prototype.hasOwnProperty.call(json, 'related')) {
    errors.push(`${file}: niedozwolone pola related_articles/related.`);
  }

  const title = String(json.title || '').trim();
  if (!title) errors.push(`${file}: brak title.`);

  const metaDescription = String(json.meta_description || '').trim();
  if (!metaDescription) errors.push(`${file}: brak meta_description.`);
  if (metaDescription && (metaDescription.length < 145 || metaDescription.length > 160)) {
    errors.push(`${file}: meta_description poza limitem 145-160 (jest ${metaDescription.length}).`);
  }
  if (metaDescription && !/[.!?]$/.test(metaDescription)) {
    errors.push(`${file}: meta_description musi kończyć się ".", "!" lub "?".`);
  }
  const metaNorm = normalizeTextForCompare(metaDescription);
  for (const phrase of POLICY.BANNED_CTR_META_PATTERNS || []) {
    if (metaNorm.includes(normalizeTextForCompare(phrase))) {
      errors.push(`${file}: meta_description zawiera mało-klikalny szablon ("${phrase}").`);
      break;
    }
  }

  const keyTakeaways = Array.isArray(json.key_takeaways) ? json.key_takeaways.filter(Boolean) : [];
  if (keyTakeaways.length !== 4) {
    errors.push(`${file}: key_takeaways musi mieć dokładnie 4 elementy (jest ${keyTakeaways.length}).`);
  }

  const quickAnswer = String(json.quick_answer || json.quickAnswer || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const quickAnswerWords = countWords(quickAnswer);
  if (!quickAnswer) {
    errors.push(`${file}: brak quick_answer (wymagane 40-60 słów).`);
  } else if (quickAnswerWords < 40 || quickAnswerWords > 60) {
    errors.push(`${file}: quick_answer poza limitem 40-60 słów (jest ${quickAnswerWords}).`);
  }
  const quickNorm = normalizeTextForCompare(quickAnswer);
  for (const phrase of POLICY.GENERIC_QUICK_ANSWER_PATTERNS || []) {
    const needle = normalizeTextForCompare(phrase);
    if (needle && quickNorm.includes(needle)) {
      errors.push(`${file}: quick_answer jest zbyt generyczny (fraza: "${phrase}").`);
      break;
    }
  }

  const seoTitle = String(json.seo_title || json.meta_title || json.title || '').trim();
  if (!seoTitle) {
    errors.push(`${file}: brak seo_title/meta_title/title.`);
  } else if (seoTitle.length < POLICY.TITLE.MIN) {
    errors.push(`${file}: seo_title jest zbyt krótki (min ${POLICY.TITLE.MIN}, jest ${seoTitle.length}).`);
  } else if (seoTitle.length > POLICY.TITLE.SEO_BASE_MAX) {
    errors.push(`${file}: seo_title przekracza ${POLICY.TITLE.SEO_BASE_MAX} znaków przed dopiskiem „${POLICY.TITLE.BRAND_SUFFIX.trim()}” (jest ${seoTitle.length}).`);
  }
  const titleNorm = normalizeTextForCompare(title);
  const seoNorm = normalizeTextForCompare(seoTitle);
  if (titleNorm && seoNorm && titleNorm !== seoNorm && !String(json.seo_title || '').trim()) {
    errors.push(`${file}: gdy title != seo_title, podaj jawnie seo_title.`);
  }
  const ogTitle = String(json.og_title || json.ogTitle || '').trim();
  const twitterTitle = String(json.twitter_title || json.twitterTitle || '').trim();
  if (ogTitle && normalizeTextForCompare(ogTitle) !== seoNorm) {
    errors.push(`${file}: og_title musi być spójny 1:1 z seo_title.`);
  }
  if (twitterTitle && normalizeTextForCompare(twitterTitle) !== seoNorm) {
    errors.push(`${file}: twitter_title musi być spójny 1:1 z seo_title.`);
  }
  const hasTitleIntentToken = (POLICY.TITLE_INTENT_TOKENS || []).some((token) => seoNorm.includes(normalizeTextForCompare(token)));
  if (!hasTitleIntentToken) {
    warnings.push(`${file}: seo_title może mieć niską klikalność (brak tokenów intencji typu "jak/czy/co/norma/wynik").`);
  }
  for (const phrase of POLICY.BANNED_CTR_TITLE_PATTERNS || []) {
    if (seoNorm.includes(normalizeTextForCompare(phrase))) {
      errors.push(`${file}: seo_title zawiera mało-klikalny szablon ("${phrase}").`);
      break;
    }
  }

  const sections = Array.isArray(json.sections) ? json.sections : [];
  if (sections.length < 6) errors.push(`${file}: sections musi mieć minimum 6 elementów (jest ${sections.length}).`);
  const sectionChunksForLinks = [];
  const sectionChunksForCode = [];
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i] || {};
    if (!isQuestionHeading(String(s.title || s.heading || '').trim())) {
      errors.push(`${file}: sections[${i}].title musi być pytaniem zakończonym "?".`);
    }
    const paragraphs = Array.isArray(s.paragraphs_html) ? s.paragraphs_html : [];
    if (paragraphs.length < 2) {
      errors.push(`${file}: sections[${i}] ma mniej niż 2 akapity.`);
      continue;
    }
    const first = String(paragraphs[0] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wc = countWords(first);
    if (wc < POLICY.WORDS.H2_INTRO_MIN || wc > POLICY.WORDS.H2_INTRO_MAX) {
      errors.push(`${file}: sections[${i}] pierwszy akapit poza limitem ${POLICY.WORDS.H2_INTRO_MIN}-${POLICY.WORDS.H2_INTRO_MAX} słów (jest ${wc}).`);
    }

    if (!s.image || typeof s.image !== 'object') {
      errors.push(`${file}: sections[${i}] brak image.`);
    } else {
      if (!String(s.image.src || '').trim()) errors.push(`${file}: sections[${i}].image.src puste.`);
      if (!String(s.image.alt || '').trim()) errors.push(`${file}: sections[${i}].image.alt puste.`);
      if (!String(s.image.caption || '').trim()) errors.push(`${file}: sections[${i}].image.caption puste.`);
    }

    for (const p of paragraphs) {
      checkInternalHtmlLinks(p, `${file}: sections[${i}].paragraphs_html`);
      sectionChunksForLinks.push(p);
      sectionChunksForCode.push(p);
    }
    if (s.info_box && typeof s.info_box === 'object') {
      const infoContent = String(s.info_box.content_html || '');
      checkInternalHtmlLinks(infoContent, `${file}: sections[${i}].info_box.content_html`);
      sectionChunksForCode.push(infoContent);
    }
  }
  const internalLinkCount = countInternalHtmlLinks(sectionChunksForLinks);
  if (internalLinkCount < 4) {
    errors.push(`${file}: za mało linków kontekstowych w sekcjach (${internalLinkCount}/4).`);
  }

  const faq = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  if (faq.length < 4) {
    errors.push(`${file}: answer_blocks < 4 (jest ${faq.length}).`);
  }
  const faqResearch = Array.isArray(json.faq_research) ? json.faq_research : [];
  if (faqResearch.length < 4) {
    errors.push(`${file}: faq_research musi mieć minimum 4 wpisy (jest ${faqResearch.length}).`);
  }
  const normalizeQuestion = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const faqResearchSet = new Set(faqResearch.map((item) => normalizeQuestion(item && item.question)));
  const faqSeen = new Set();
  for (let i = 0; i < faq.length; i += 1) {
    const q = normalizeQuestion(faq[i] && faq[i].question);
    if (q) {
      if (faqSeen.has(q)) {
        errors.push(`${file}: FAQ #${i + 1} duplikuje wcześniejsze pytanie.`);
      }
      faqSeen.add(q);
      if ((POLICY.GENERIC_FAQ_QUESTIONS || []).some((generic) => q === normalizeQuestion(generic))) {
        errors.push(`${file}: FAQ #${i + 1} ma generyczne pytanie ("${String(faq[i]?.question || '').trim()}").`);
      }
    }
    if (q && !faqResearchSet.has(q)) {
      errors.push(`${file}: FAQ #${i + 1} nie ma dopasowania 1:1 w faq_research.question.`);
    }
  }
  for (let i = 0; i < faqResearch.length; i += 1) {
    const item = faqResearch[i] || {};
    const label = String(item.source_label || item.label || '').trim();
    const sourceUrl = String(item.source_url || item.url || '').trim();
    if (!label || label.length < POLICY.FAQ_RESEARCH_SOURCE_LABEL_MIN_CHARS) {
      errors.push(`${file}: faq_research #${i + 1} ma zbyt ogólny source_label.`);
    }
    if (!/^https?:\/\//i.test(sourceUrl)) {
      errors.push(`${file}: faq_research #${i + 1} musi mieć source_url z http/https.`);
    }
    const sourceNorm = normalizeTextForCompare(sourceUrl);
    if ((POLICY.BANNED_FAQ_RESEARCH_SOURCE_URL_PATTERNS || []).some((bad) => sourceNorm.includes(normalizeTextForCompare(bad)))) {
      errors.push(`${file}: faq_research #${i + 1} ma niedozwolony source_url (placeholder lub wyszukiwarka bezpośrednia).`);
    }
  }
  const faqAnswerWordCounts = [];
  const faqQuestions = [];
  for (let i = 0; i < faq.length; i += 1) {
    const question = String(faq[i]?.question || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (question) faqQuestions.push(question);
    const answerHtml = faq[i]?.answer_html || '';
    const answerWords = countWords(String(answerHtml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    faqAnswerWordCounts.push(answerWords);
    checkInternalHtmlLinks(answerHtml, `${file}: answer_blocks[${i}].answer_html`);
    sectionChunksForCode.push(answerHtml);
  }
  const weakFaqIntentCount = faqQuestions.filter((q) => !hasIntentToken(q)).length;
  if (faqQuestions.length && weakFaqIntentCount > Math.max(1, faqQuestions.length - 2)) {
    errors.push(`${file}: FAQ ma zbyt mało pytań intencyjnych użytkownika (jak/czy/kiedy/ile/objawy/norma/wynik).`);
  }

  const codeOffending = collectCodeNonAscii(sectionChunksForCode);
  if (codeOffending.length) {
    errors.push(`${file}: w <code> wykryto znaki spoza ASCII (np. "${codeOffending[0]}"), co może wywalić generator PDF.`);
  }

  const sources = Array.isArray(json.sources) ? json.sources : [];
  if (sources.length < 4) {
    errors.push(`${file}: sources musi mieć minimum 4 pozycje (jest ${sources.length}).`);
  }
  const sourceUrls = sources
    .map((s) => String((s && (s.url || s.href)) || '').trim())
    .filter(Boolean);

  const repeated = collectRepeatedLongSentences([
    json.lead || '',
    json.quick_answer || json.quickAnswer || '',
    ...sections.flatMap((s) => Array.isArray(s.paragraphs_html) ? s.paragraphs_html : []),
  ]);
  if (repeated.length) {
    errors.push(`${file}: wykryto powtarzalne zdania (${repeated[0][1]}x): "${repeated[0][0].slice(0, 90)}..."`);
  }

  const quickAnswerPlain = String(json.quick_answer || json.quickAnswer || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const internalAnchorTexts = [];
  for (const chunk of sectionChunksForLinks) {
    const rx = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of String(chunk || '').matchAll(rx)) {
      internalAnchorTexts.push(String(match[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
  }
  const aeo = calculateAeoScore({
    quickAnswerWords,
    quickAnswerPlain,
    faqQuestions,
    faqAnswerWordCounts,
    sourceUrls,
    internalLinkCount,
    internalAnchorTexts,
  });
  const threshold = 70;
  warnings.push(`${file}: AEO score ${aeo.total}/100 (quick_answer=${aeo.breakdown.quickAnswer}, faq_intent=${aeo.breakdown.faqIntent}, sources=${aeo.breakdown.sources}, links=${aeo.breakdown.links}).`);
  for (const note of aeo.notes) warnings.push(`${file}: AEO note: ${note}`);
  if (aeo.total < threshold) {
    errors.push(`${file}: AEO score poniżej progu ${threshold}/100 (jest ${aeo.total}) - popraw quick_answer/FAQ/źródła/linki przed publikacją.`);
  }
  if (!hasClearQuickAnswerForm(quickAnswerPlain)) {
    errors.push(`${file}: quick_answer musi być jednym, klarownym zdaniem lub zwięzłym akapitem zakończonym interpunkcją.`);
  }
  const faqOutOfRange = faqAnswerWordCounts.filter((n) => n < 30 || n > 60).length;
  if (faqOutOfRange > 0) {
    errors.push(`${file}: ${faqOutOfRange} odpowiedzi FAQ wypada poza zakres 30-60 słów.`);
  }
  const strongCount = sources.filter((source) => {
    const level = String(source?.evidence_level || source?.evidenceLevel || '').trim().toLowerCase();
    return isStrongMedicalSource(source?.url) && MEDICAL_EVIDENCE_LEVELS.has(level);
  }).length;
  const strongRatio = sourceUrls.length ? strongCount / sourceUrls.length : 0;
  if (sourceUrls.length && strongRatio < 0.5) {
    errors.push(`${file}: udział silnych źródeł medycznych jest zbyt niski (${Math.round(strongRatio * 100)}%, wymagane min 50%).`);
  }
  const evidence = validateArticleEvidence(json);
  evidence.errors.forEach((error) => errors.push(`${file}: ${error}`));
  const architecture = validateArticleArchitecture(json, { root: process.cwd() });
  architecture.errors.forEach((error) => errors.push(`${file}: Architecture: ${error}`));
  architecture.warnings.forEach((warning) => warnings.push(`${file}: Architecture: ${warning}`));
  const media = validateManifestStructure(json);
  media.errors.forEach((error) => errors.push(`${file}: Media: ${error}`));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let targets = [];
  if (args.files.length) {
    targets = args.files;
  } else {
    const changed = readChangedFiles();
    targets = changed.filter((file) => isFitpoJson(file) && !isArchivedImport(file) && !isIntentionalInvalidFixture(file));
  }
  if (!targets.length) {
    console.log('[PASS] json:gate:diff - brak zmienionych plików *.fitpo50.json');
    return;
  }

  const normalized = [...new Set(targets.map((f) => String(f || '').trim()).filter(Boolean))];
  for (const file of normalized) {
    if (!fs.existsSync(file)) {
      errors.push(`${file}: plik nie istnieje.`);
      continue;
    }
    validateFile(file);
  }

  if (warnings.length) {
    console.log('\n[WARN]');
    for (const w of warnings) console.log(`- ${w}`);
  }

  if (errors.length) {
    console.log('\n[FAIL] json:gate:diff');
    for (const e of errors) console.log(`- ${e}`);
    process.exit(1);
  }

  console.log(`[PASS] json:gate:diff - sprawdzono pliki: ${normalized.length}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[FAIL] json:gate:diff -> ${err.message || err}`);
    process.exit(1);
  }
}

module.exports = { hasClearQuickAnswerForm, normalizeQuickAnswerForSentenceGate };
