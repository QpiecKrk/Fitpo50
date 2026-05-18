/**
 * FitPo50 Article Policy Engine v1.2
 * 
 * Centralized source of truth for SEO, AEO, and Editorial rules.
 * v1.2: Aligned with AGENTS.md (30-70 words), improved path regex.
 */

const POLICY = {
  // Word count limits (strict editorial contract from AGENTS.md)
  WORDS: {
    H2_INTRO_MIN: 30,
    H2_INTRO_MAX: 70,
    QUICK_ANSWER_MIN: 40,
    QUICK_ANSWER_MAX: 60,
    SEO_DESCRIPTION_MIN: 145,
    SEO_DESCRIPTION_MAX: 160,
    INTERNAL_LINKS_MIN: 4,
    FAQ_MIN_ITEMS: 4,
    CITATION_MIN_URLS: 4
  },

  TITLE: {
    MAX: 65
  },

  REPEATED_SENTENCES: {
    MIN_WORDS: 8,
    MIN_CHARS: 45,
    MIN_REPEATS: 3
  },

  AUTO_LINK: {
    MIN_WORDS: 40,
    MIN_LINKS: 4,
    MAX_LINKS: 6
  },

  // Required patterns
  PATTERNS: {
    H2_QUESTION: /\?$/,
    ISO_DATE_TZ: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/,
    // Catch "./file.html", "file.html" and "subdir/file.html" (supports Unicode)
    INTERNAL_REL_LINK: /^(\.\/)?([\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+\.html$/u,
    // Standard label for reading time
    READ_TIME_LABEL: /^\d+\s+min\s+czytania$/i
  },

  // Metadata keys that must be identical 1:1
  SEO_DESCRIPTION_CONTRACT: [
    'meta_description',
    'og_description',
    'twitter_description',
    'schema_blogposting_description'
  ],

  // Excluded H2 titles from question/intro validation
  SKIPPED_H2_TITLES: [
    'kluczowe wnioski',
    'najczęściej zadawane pytania',
    'zrodla',
    'źródła',
    'szybka odpowiedź',
    'szybka odpowiedz'
  ]
};

/**
 * Universal Utilities
 */
const utils = {
  /**
   * Spójne liczenie słów (obsługa UTF-8 / znaki narodowe)
   */
  countWords: (text) => {
    const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
    return m ? m.length : 0;
  },

  /**
   * Usuwanie tagów HTML z zachowaniem spacji
   */
  stripTags: (html) => {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Normalizacja ścisła (do porównań 1:1 kontraktu SEO)
   */
  strictNormalize: (text) => {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Normalizacja rozmyta (do wykrywania duplikatów zdań)
   */
  fuzzyNormalize: (text) => {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  normalizeInternalHtmlHref: (href) => {
    const raw = String(href || '').trim();
    if (!raw) return '';
    if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(raw)) return '';
    const clean = raw.split('#')[0].split('?')[0].trim();
    if (!clean || !/\.html$/i.test(clean)) return '';
    return clean.replace(/^\.\//, '').replace(/^\/+/, '');
  },

  countInternalHtmlLinks: (htmlChunks, options = {}) => {
    const exclude = new Set(
      (options.exclude || ['porady.html']).map((item) => String(item || '').toLowerCase())
    );
    const unique = new Set();
    const rx = /<a\b[^>]*href="([^"]+)"/gi;

    const items = Array.isArray(htmlChunks) ? htmlChunks : [htmlChunks];
    for (const chunk of items) {
      const html = String(chunk || '');
      for (const match of html.matchAll(rx)) {
        const href = String(match[1] || '').trim();
        if (!href) continue;
        const isAbsInternal = /^https?:\/\/(www\.)?fitpo50\.pl\/[^"\s]+\.html(?:[?#].*)?$/i.test(href);
        const isRelInternal = !/^(https?:|mailto:|tel:|javascript:|#)/i.test(href) && /\.html(?:[?#].*)?$/i.test(href);
        if (!isAbsInternal && !isRelInternal) continue;

        const normalized = utils.normalizeInternalHtmlHref(
          href.replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, '')
        ).toLowerCase();

        if (!normalized) continue;

        if (exclude.has(normalized)) continue;
        unique.add(normalized);
      }
    }
    return unique.size;
  },

  collectRepeatedLongSentences: (chunks) => {
    const source = (Array.isArray(chunks) ? chunks : [chunks]).map((item) => String(item || '')).join(' ');
    const plain = utils.stripTags(source);
    const sentences = plain
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const map = new Map();

    for (const sentence of sentences) {
      const norm = utils.fuzzyNormalize(sentence);
      if (!norm) continue;
      if (utils.countWords(norm) < POLICY.REPEATED_SENTENCES.MIN_WORDS) continue;
      if (norm.length < POLICY.REPEATED_SENTENCES.MIN_CHARS) continue;
      map.set(norm, (map.get(norm) || 0) + 1);
    }

    return [...map.entries()]
      .filter(([, count]) => count >= POLICY.REPEATED_SENTENCES.MIN_REPEATS)
      .map(([sentence, count]) => ({ sentence, count }));
  }
};

/**
 * Validators (Logic for Quality Gates)
 */
const validators = {
  isSkippedH2Title: (title) => {
    const clean = utils.stripTags(title).trim().toLowerCase();
    return POLICY.SKIPPED_H2_TITLES.includes(clean);
  },

  validateH2Title: (title) => {
    const clean = utils.stripTags(title).trim();
    if (validators.isSkippedH2Title(clean)) return { ok: true };
    const ok = POLICY.PATTERNS.H2_QUESTION.test(clean);
    return { ok, error: ok ? null : `H2 "${clean}" musi kończyć się znakiem zapytania.` };
  },

  validateIntroParagraph: (text) => {
    const count = utils.countWords(text);
    const ok = count >= POLICY.WORDS.H2_INTRO_MIN && count <= POLICY.WORDS.H2_INTRO_MAX;
    return { 
      ok, 
      count,
      error: ok ? null : `Akapit ma ${count} słów (wymagane ${POLICY.WORDS.H2_INTRO_MIN}-${POLICY.WORDS.H2_INTRO_MAX}).` 
    };
  },

  validateSeoDescriptionLength: (desc) => {
    const clean = utils.stripTags(desc).trim();
    const len = clean.length;
    const ok = len >= POLICY.WORDS.SEO_DESCRIPTION_MIN && len <= POLICY.WORDS.SEO_DESCRIPTION_MAX;
    const endsWithPeriod = /[.!?]$/.test(clean);
    
    if (!ok) return { ok: false, error: `Opis ma ${len} znaków (wymagane ${POLICY.WORDS.SEO_DESCRIPTION_MIN}-${POLICY.WORDS.SEO_DESCRIPTION_MAX}).` };
    if (!endsWithPeriod) return { ok: false, error: 'Opis musi kończyć się znakiem interpunkcyjnym (kropka, wykrzyknik, pytajnik).' };
    return { ok: true };
  },

  validateReadTimeLabel: (label) => {
    const clean = String(label || '').trim();
    const ok = POLICY.PATTERNS.READ_TIME_LABEL.test(clean);
    return { ok, error: ok ? null : `Niepoprawny label czasu czytania: "${clean}" (oczekiwane: "X min czytania").` };
  }
};

/**
 * Enforcers (Logic for Importers / Fixers)
 */
const enforcers = {
  forceQuestion: (title) => {
    const clean = utils.stripTags(title).trim();
    if (POLICY.SKIPPED_H2_TITLES.includes(clean.toLowerCase())) return title;
    return clean.endsWith('?') ? clean : `${clean}?`;
  },

  stabilizeParagraph: (html, maxWords) => {
    const plain = utils.stripTags(html);
    const words = plain.match(/[\p{L}\p{N}'’-]+/gu) || [];
    if (words.length <= maxWords) return html;
    
    const clipped = words.slice(0, maxWords).join(' ').replace(/[,:;.\s]+$/g, '').trim();
    return `<p>${clipped}.</p>`;
  }
};

module.exports = {
  POLICY,
  utils,
  validators,
  enforcers
};
