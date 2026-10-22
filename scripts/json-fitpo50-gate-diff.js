#!/usr/bin/env node

const fs = require('fs');
const { spawnSync } = require('child_process');
const { POLICY, utils, validators } = require('./lib/article-policy');
const { MEDICAL_EVIDENCE_LEVELS, countsTowardSourceMinimum, isStrongMedicalSource, validateArticleEvidence, withEvidenceVerification } = require('./lib/article-evidence');
const { validateArticleArchitecture } = require('./lib/article-intent-links');
const { sectionRequiresPrimaryImage, validateManifestStructure } = require('./lib/article-media');
const { normalizeInternalHref } = require('./lib/article-normalization');
const { validateSectionSchema } = require('./lib/article-section-contract');

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
  const out = { files: [], json: false, phase: 'final' };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--json') out.json = true;
    else if (token === '--phase') {
      out.phase = String(argv[i + 1] || 'final');
      i += 1;
    }
    else if (token === '--file') {
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

function sectionRequiresQuestionHeading(section) {
  return sectionRequiresPrimaryImage(section);
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
  return normalizeInternalHref(href);
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

  if (ctx.quickAnswerSentences >= 1 && ctx.quickAnswerSentences <= 3 && ctx.quickAnswerWords <= POLICY.WORDS.QUICK_ANSWER_MAX) {
    quickAnswer += 15;
  } else if (ctx.quickAnswerWords > 0 && ctx.quickAnswerWords <= 80) {
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
  if (ctx.faqQuestions.length) {
    if (faqCoverage >= 0.75) faqIntent += 20;
    else if (faqCoverage >= 0.5) faqIntent += 10;
    else notes.push('FAQ: słabe pokrycie intencji pytań użytkowników.');
    if (ctx.faqAnswerWordCounts.every((n) => n > 0)) faqIntent += 5;
    else notes.push('FAQ: co najmniej jedna odpowiedź jest pusta.');
  } else {
    notes.push('FAQ: brak sekcji, ponieważ nie dostarczono udokumentowanych pytań użytkowników.');
  }

  const strongDomains = /(doi\.org|pubmed|nih\.gov|cancer\.gov|who\.int|cdc\.gov|ema\.europa\.eu|ncbi\.nlm\.nih\.gov|frontiersin\.org|nature\.com|gov\.pl|ptkardio|esmo|escardio|aafp|nhs\.uk|cochrane)/i;
  const validUrls = ctx.sourceUrls.filter((u) => /^https?:\/\//i.test(u));
  const strongCount = validUrls.filter((u) => strongDomains.test(u)).length;
  const strongRatio = validUrls.length ? strongCount / validUrls.length : 0;
  if (validUrls.length >= POLICY.WORDS.CITATION_MIN_URLS) sources += 10;
  if (strongRatio >= 0.8) sources += 15;
  else if (strongRatio >= 0.5) sources += 8;
  else notes.push('Źródła: niski udział domen medyczno-naukowych.');

  if (ctx.internalLinkCount >= POLICY.WORDS.INTERNAL_LINKS_WARN_BELOW) links += 15;
  else if (ctx.internalLinkCount === 1) links += 8;
  const genericAnchors = ctx.internalAnchorTexts.filter((a) => isGenericAnchor(a)).length;
  if (ctx.internalAnchorTexts.length && genericAnchors === 0) links += 10;
  else if (genericAnchors > 0) notes.push(`Linki: wykryto generyczne anchory (${genericAnchors}).`);

  const total = quickAnswer + faqIntent + sources + links;
  return {
    total,
    availableMax: ctx.faqQuestions.length ? 100 : 75,
    breakdown: { quickAnswer, faqIntent, sources, links },
    notes,
  };
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

function validateFile(file, options = {}) {
  const draftPhase = options.phase === 'draft';
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
  const quickAnswerValidation = validators.validateQuickAnswer(quickAnswer, { mode: 'strict' });
  quickAnswerValidation.errors.forEach((error) => errors.push(`${file}: ${error}`));
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
  if (sections.length === 0) errors.push(`${file}: sections musi zawierać co najmniej jeden merytoryczny blok wynikający z intencji artykułu.`);
  validateSectionSchema(sections).errors.forEach((error) => errors.push(`${file}: ${error}`));
  const sectionChunksForLinks = [];
  const sectionChunksForCode = [];
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i] || {};
    const requiresPrimaryContent = sectionRequiresPrimaryImage(s);
    if (sectionRequiresQuestionHeading(s) && !isQuestionHeading(String(s.title || s.heading || '').trim())) {
      errors.push(`${file}: sections[${i}].title musi być pytaniem zakończonym "?".`);
    }
    const paragraphs = Array.isArray(s.paragraphs_html) ? s.paragraphs_html : [];
    if (paragraphs.length < 2) {
      errors.push(`${file}: sections[${i}] ma mniej niż 2 akapity.`);
      continue;
    }
    const introRes = validators.validateAnswerFirstParagraph(String(paragraphs[0] || ''), { label: `${file}: sections[${i}] pierwszy akapit` });
    if (!introRes.ok) errors.push(...introRes.errors);

    if (requiresPrimaryContent && !draftPhase) {
      if (!s.image || typeof s.image !== 'object') {
        errors.push(`${file}: sections[${i}] brak image.`);
      } else {
        if (!String(s.image.src || '').trim()) errors.push(`${file}: sections[${i}].image.src puste.`);
        if (!String(s.image.alt || '').trim()) errors.push(`${file}: sections[${i}].image.alt puste.`);
        if (!String(s.image.caption || '').trim()) errors.push(`${file}: sections[${i}].image.caption puste.`);
      }
    }
    const additionalImages = Array.isArray(s.images) ? s.images : [];
    for (let imageIndex = 0; imageIndex < additionalImages.length; imageIndex += 1) {
      const image = additionalImages[imageIndex] || {};
      const label = `${file}: sections[${i}].images[${imageIndex}]`;
      if (!String(image.src || '').trim()) errors.push(`${label}.src puste.`);
      if (!String(image.alt || '').trim()) errors.push(`${label}.alt puste.`);
      if (!String(image.caption || '').trim()) errors.push(`${label}.caption puste.`);
      if (!new RegExp(`^sekcja-${i + 1}-obraz-[2-9]\\d*$`).test(String(image.placement || '').trim())) {
        errors.push(`${label}.placement musi mieć format sekcja-${i + 1}-obraz-N, gdzie N >= 2.`);
      }
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
  if (internalLinkCount < POLICY.WORDS.INTERNAL_LINKS_WARN_BELOW) {
    warnings.push(`${file}: LOW_CONTEXTUAL_LINK_COUNT: wykryto ${internalLinkCount} naturalnych linków; to ostrzeżenie, nie bloker.`);
  }

  const faq = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  const faqResearch = Array.isArray(json.faq_research) ? json.faq_research : [];
  if (faq.length !== faqResearch.length) errors.push(`${file}: answer_blocks i faq_research muszą odpowiadać sobie 1:1.`);
  const normalizeQuestion = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const faqResearchSet = new Set(faqResearch.map((item) => normalizeQuestion(item && item.question)));
  const faqSeen = new Set();
  for (let i = 0; i < faq.length; i += 1) {
    const q = normalizeQuestion(faq[i] && faq[i].question);
    if (q && q !== normalizeQuestion(faqResearch[i]?.question)) {
      errors.push(`${file}: FAQ #${i + 1} nie odpowiada kolejnością lub brzmieniem faq_research #${i + 1} 1:1.`);
    }
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
    if (answerWords === 0) errors.push(`${file}: FAQ #${i + 1} nie ma odpowiedzi.`);
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

  const imagePrompts = Array.isArray(json.image_prompts_v4) ? json.image_prompts_v4 : [];
  const knownSourceUrls = new Set((Array.isArray(json.sources) ? json.sources : []).map((source) => String(source?.url || '').trim()).filter(Boolean));
  imagePrompts.forEach((prompt, promptIndex) => {
    if (prompt?.requires_exact_data_render !== true) return;
    const overlayClaims = Array.isArray(prompt.overlay_claims) ? prompt.overlay_claims : [];
    if (!overlayClaims.length) errors.push(`${file}: image_prompts_v4[${promptIndex}].overlay_claims jest wymagane dla requires_exact_data_render=true.`);
    overlayClaims.forEach((claim, claimIndex) => {
      const claimText = String(claim?.claim || '').trim();
      const sourceUrl = String(claim?.source_url || '').trim();
      if (!claimText || !utils.fuzzyNormalize(prompt.overlay_text_pl || '').includes(utils.fuzzyNormalize(claimText))) {
        errors.push(`${file}: image_prompts_v4[${promptIndex}].overlay_claims[${claimIndex}].claim musi występować w overlay_text_pl.`);
      }
      if (!knownSourceUrls.has(sourceUrl)) errors.push(`${file}: image_prompts_v4[${promptIndex}].overlay_claims[${claimIndex}].source_url musi występować w sources[].`);
    });
  });

  const sources = Array.isArray(json.sources) ? json.sources : [];
  const countableSources = draftPhase
    ? sources.filter((source) => source?.evidence_scope !== 'device_instructions_only')
    : sources.filter((source) => source?.evidence_scope !== 'device_instructions_only' && countsTowardSourceMinimum(withEvidenceVerification(json, source)));
  if (countableSources.length < POLICY.WORDS.CITATION_MIN_URLS) {
    errors.push(`${file}: sources musi mieć minimum ${POLICY.WORDS.CITATION_MIN_URLS} dostępne albo kwalifikowane źródła (jest ${countableSources.length}).`);
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
    quickAnswerSentences: utils.countCompleteSentences(quickAnswerPlain),
    quickAnswerPlain,
    faqQuestions,
    faqAnswerWordCounts,
    sourceUrls,
    internalLinkCount,
    internalAnchorTexts,
  });
  const threshold = Math.ceil(aeo.availableMax * 0.7);
  warnings.push(`${file}: AEO score ${aeo.total}/${aeo.availableMax} (quick_answer=${aeo.breakdown.quickAnswer}, faq_intent=${aeo.breakdown.faqIntent}, sources=${aeo.breakdown.sources}, links=${aeo.breakdown.links}).`);
  for (const note of aeo.notes) warnings.push(`${file}: AEO note: ${note}`);
  if (aeo.total < threshold) {
    errors.push(`${file}: AEO score poniżej progu ${threshold}/${aeo.availableMax} (jest ${aeo.total}) - popraw quick_answer/źródła/linki oraz tylko udokumentowane FAQ.`);
  }
  if (!hasClearQuickAnswerForm(quickAnswerPlain)) {
    errors.push(`${file}: quick_answer musi być jednym, klarownym zdaniem lub zwięzłym akapitem zakończonym interpunkcją.`);
  }
  const strongCount = sources.filter((source) => {
    const level = String(source?.evidence_level || source?.evidenceLevel || '').trim().toLowerCase();
    return isStrongMedicalSource(source?.url) && MEDICAL_EVIDENCE_LEVELS.has(level);
  }).length;
  const strongRatio = sourceUrls.length ? strongCount / sourceUrls.length : 0;
  if (sourceUrls.length && strongRatio < 0.5) {
    errors.push(`${file}: udział silnych źródeł medycznych jest zbyt niski (${Math.round(strongRatio * 100)}%, wymagane min 50%).`);
  }
  const evidence = validateArticleEvidence(json, { allowPendingAutocomplete: draftPhase, allowPendingVerification: draftPhase });
  evidence.errors.forEach((error) => errors.push(`${file}: ${error}`));
  evidence.warnings.forEach((warning) => warnings.push(`${file}: Evidence: ${warning}`));
  if (!draftPhase) {
    const architecture = validateArticleArchitecture(json, { root: process.cwd() });
    architecture.errors.forEach((error) => errors.push(`${file}: Architecture: ${error}`));
    architecture.warnings.forEach((warning) => warnings.push(`${file}: Architecture: ${warning}`));
    const media = validateManifestStructure(json);
    media.errors.forEach((error) => errors.push(`${file}: Media: ${error}`));
  }
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
    if (args.json) console.log(JSON.stringify({ version: 1, status: 'PASS', diagnostics: [], summary: { files: 0, errors: 0, warnings: 0 } }));
    else console.log('[PASS] json:gate:diff - brak zmienionych plików *.fitpo50.json');
    return;
  }

  const normalized = [...new Set(targets.map((f) => String(f || '').trim()).filter(Boolean))];
  for (const file of normalized) {
    if (!fs.existsSync(file)) {
      errors.push(`${file}: plik nie istnieje.`);
      continue;
    }
    validateFile(file, { phase: args.phase });
  }

  const diagnostics = [
    ...errors.map((message) => ({ path: '/', type: 'REQUIRES_WRITER', rule: 'RULE_JSON_GATE', severity: 'ERROR', message, suggestion: 'Popraw wskazane pole w drafcie i uruchom kontrolę ponownie.' })),
    ...warnings.map((message) => ({ path: '/', type: 'FIXABLE_LOCAL', rule: 'RULE_JSON_GATE_WARNING', severity: 'WARNING', message, suggestion: 'Sprawdź raport; ostrzeżenie nie blokuje dalszej pracy.' })),
  ];
  if (args.json) {
    console.log(JSON.stringify({
      version: 1,
      status: errors.length ? 'BLOCKED' : 'PASS',
      diagnostics,
      summary: { files: normalized.length, errors: errors.length, warnings: warnings.length },
    }));
    if (errors.length) process.exitCode = 20;
    return;
  }

  if (warnings.length) {
    console.log('\n[WARN]');
    for (const w of warnings) console.log(`- [/] [FIXABLE_LOCAL] [RULE_JSON_GATE_WARNING] ${w} -> Sprawdź raport.`);
  }

  if (errors.length) {
    console.log('\n[FAIL] json:gate:diff');
    for (const e of errors) console.log(`- [/] [REQUIRES_WRITER] [RULE_JSON_GATE] ${e} -> Popraw draft.`);
    process.exitCode = 20;
    return;
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

module.exports = { calculateAeoScore, hasClearQuickAnswerForm, normalizeQuickAnswerForSentenceGate, parseArgs, sectionRequiresQuestionHeading, validateFile };
