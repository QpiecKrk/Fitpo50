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
    QUICK_ANSWER_MIN: 45,
    QUICK_ANSWER_MAX: 70,
    SEO_DESCRIPTION_MIN: 145,
    SEO_DESCRIPTION_MAX: 160,
    INTERNAL_LINKS_MIN: 4,
    FAQ_MIN_ITEMS: 4,
    CITATION_MIN_URLS: 4
  },

  TITLE: {
    MAX: 65,
    MIN: 35,
    JSON_MIN: 55,
    BRAND_SUFFIX: ' | FitPo50',
    SEO_BASE_MAX: 55,
    STRICT_CUTOFF: '2026-06-06'
  },

  BROKEN_TITLE_PATTERNS: [
    /\s[–-]\s*praktyczny\s*$/iu,
    /\s[–-]\s*praktyczny\s+przewodnik\s*$/iu,
    /\s[–-]\s*praktyczny\s+przewodnik\s+dla\s*$/iu,
    /\s[–-]\s*praktyczny\s+przewodnik\s+dla\s+osób\s*$/iu,
    /\s[–-]\s*praktyczny\s+przewodnik\s+dla\s+os[oó]b\s+po\s*$/iu,
    /\s[–-]\s*praktyczny\s+przewodnik\s+dla\s+os[oó]b\s+po\s+50\.?\s*$/iu,
    /\s[–-]\s*praktyczny\s+przewodnik\s+dla\s+os[oó]b\s+po\s+50\.?\s+roku\s*$/iu
  ],

  REPEATED_SENTENCES: {
    MIN_WORDS: 8,
    MIN_CHARS: 45,
    MIN_REPEATS: 4
  },

  BANNED_EDITORIAL_PHRASES: [
    'warto rozłożyć na praktyczne kroki i odnieść do codziennych decyzji',
    'po 50-tce najwięcej daje spokojne tempo, zrozumienie mechanizmu i regularne obserwowanie reakcji organizmu',
    'to właśnie ten szczegół często decyduje o tym, czy plan będzie bezpieczny i możliwy do utrzymania',
    'to właśnie ten element często rozstrzyga, czy cały plan okaże się rozsądny i wykonalny',
    'w praktyce właśnie tutaj najłatwiej oddzielić modne hasła od wskazówek, które naprawdę działają',
    'tutaj najlepiej widać, które porady są tylko głośne, a które realnie pomagają',
    'dzięki temu łatwiej przełożyć teorię na praktykę i uniknąć chaosu już na starcie',
    'właśnie to pomaga szybciej zamienić wiedzę w działanie i nie pogubić się od pierwszych dni',
    'najwięcej zyskujesz wtedy, gdy działasz spokojnie, rozumiesz proces i uważnie patrzysz na reakcje organizmu',
    'po pięćdziesiątce najlepiej działa cierpliwe tempo, dobra obserwacja ciała i rozumienie, po co robisz kolejne kroki',
    'taki układ ułatwia spokojne wdrożenie zmian i ogranicza chaos na początku drogi'
  ],

  GENERIC_QUICK_ANSWER_PATTERNS: [
    'po 50-tce warto patrzeć na zdrowie szerzej',
    'po 50-tce nawet złożone tematy warto rozbierać na proste elementy',
    'po 50-tce najlepsze efekty daje prosty plan',
    'po 50-tce najwięcej daje spokojny start',
    'ten artykuł porządkuje najważniejsze fakty',
    'warto patrzeć szerzej',
    'najważniejsze to regularność',
    'kluczowe jest indywidualne podejście',
    'to zależy od wielu czynników',
    'warto pamiętać o całościowym podejściu',
    'istotne jest zrównoważone podejście',
    'należy zawsze dostosować'
  ],

  QUICK_ANSWER: {
    LEGACY_CUTOFF: '2026-06-01',
    CONDITION_PATTERNS: [
      /\bjeśli\b/i,
      /\bgdy\b/i,
      /\bkiedy\b/i,
      /\bu osób po 50\b/i,
      /\bprzy wyniku\b/i
    ],
    NUMBER_PATTERN: /\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\b/
  },

  GENERIC_FAQ_QUESTIONS: [
    'najważniejsze z tej sekcji',
    'co to znaczy w praktyce',
    'co to oznacza w praktyce',
    'najważniejsza różnica',
    'praktyczny cel',
    'wskaźnik który warto znać',
    'jak wdrożyć to praktycznie'
  ],

  LOGIC_COHERENCE: {
    VAGUE_REFERENCE_OPENERS: [
      /^(ta|taka|ten|to|tego|tej)\s+(reklama|obietnica|obietnice|przekaz|has[lł]o|zdanie|wniosek)\b/iu,
      /^haczyk\s+jest\s+prosty\b/iu
    ],
    VAGUE_REFERENCE_CONTEXT: [
      /\b(chodzi\s+o|mowa\s+o|konkretnie|czyli)\b/iu,
      /[„"][^”"]{12,}[”"]/u,
      /\bobietnic[aeę]\s*:/iu,
      /\bmit\s*:/iu,
      /\bje[sś]li\s+kto[sś]\s+obiecuje\b/iu
    ],
    VAGUE_REFERENCE_ANYWHERE: /\b(ta\s+obietnica|ta\s+reklama|taki\s+przekaz|to\s+zdanie|ten\s+wniosek|ten\s+haczyk)\b/iu,
    METAPHOR_PATTERNS: [
      /\bkorek\s+w\s+zlewie\b/iu,
      /\bodetka[cć]\b/iu,
      /\bwyp[lł]ynie\b/iu,
      /\bworek\b/iu,
      /\bsilnik(?:iem|a|u)?\s+metabolizmu\b/iu,
      /\bhamul(?:ec|cem|ca)\s+metabolizmu\b/iu,
      /\breset\s+organizmu\b/iu,
      /\btarcza\s+ochronna\b/iu,
      /\bpaliwo\s+dla\s+(mi[eę][sś]ni|m[oó]zgu|organizmu)\b/iu
    ],
    METAPHOR_MECHANISM: [
      /\blimfa\b/iu,
      /\bt[lł]uszcz\b/iu,
      /\benergia\b/iu,
      /\bdeficyt\b/iu,
      /\bspala\b/iu,
      /\bmagazyn\b/iu,
      /\bglukoz\b/iu,
      /\binsulin\b/iu,
      /\bmitochondri\b/iu,
      /\bbia[lł]k\b/iu,
      /\bsyntez\b/iu,
      /\bhormon\b/iu,
      /\breceptor\b/iu
    ],
    ABSTRACT_PROOF_PHRASES: [
      /im\s+bardziej\s+obietnica\s+usuwa\s+wysi[lł]ek\s+i\s+czas/iu,
      /tym\s+mniej\s+zwykle\s+ma\s+za\s+sob[aą]\s+dowod[oó]w/iu
    ]
  },

  TITLE_INTENT_TOKENS: [
    'jak', 'czy', 'co', 'ile', 'kiedy', 'dlaczego', 'norma', 'wynik', 'objawy', 'bezpiecz', 'cena'
  ],
  FAQ_INTENT_TOKENS: [
    'jak', 'czy', 'co', 'ile', 'kiedy', 'dlaczego', 'objawy', 'norma', 'wynik', 'bezpiecz', 'dawka', 'koszt'
  ],

  BANNED_CTR_TITLE_PATTERNS: [
    'kompletny przewodnik',
    'praktyczny przewodnik',
    'wszystko co musisz wiedzieć'
  ],

  BANNED_CTR_META_PATTERNS: [
    'ten artykuł porządkuje najważniejsze fakty',
    'po 50-tce warto patrzeć na zdrowie szerzej',
    'po 50-tce najlepsze efekty daje prosty plan'
  ],

  BANNED_FAQ_RESEARCH_SOURCE_URL_PATTERNS: [
    'google.com/search',
    'example.com',
    'localhost'
  ],

  FAQ_RESEARCH_SOURCE_LABEL_MIN_CHARS: 8,

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

function normalizeLogicChunk(text) {
  return utils.stripTags(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

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
  },

  validateTitleText: (title, options = {}) => {
    const label = String(options.label || 'title');
    const min = Number(options.min || POLICY.TITLE.MIN);
    const max = Number(options.max || POLICY.TITLE.MAX);
    const clean = utils.stripTags(title).replace(/\s+/g, ' ').trim();
    const errors = [];

    if (!clean) {
      errors.push(`${label}: brak tekstu.`);
      return { ok: false, errors, length: 0 };
    }
    if (clean.length < min) {
      errors.push(`${label}: jest zbyt krótki (min ${min}, jest ${clean.length}).`);
    }
    if (clean.length > max) {
      errors.push(`${label}: przekracza ${max} znaków (jest ${clean.length}).`);
    }
    for (const rx of POLICY.BROKEN_TITLE_PATTERNS) {
      if (rx.test(clean)) {
        errors.push(`${label}: wygląda na urwany przez automatyczne skrócenie ("${clean}").`);
        break;
      }
    }

    return { ok: errors.length === 0, errors, length: clean.length };
  },

  containsBannedPhrase: (text, bannedList = POLICY.GENERIC_QUICK_ANSWER_PATTERNS) => {
    const normalized = utils.fuzzyNormalize(text);
    for (const phrase of bannedList) {
      const needle = utils.fuzzyNormalize(phrase);
      if (needle && normalized.includes(needle)) {
        return { found: true, phrase };
      }
    }
    return { found: false, phrase: '' };
  },

  hasNumberOrCondition: (text) => {
    const clean = String(text || '').trim();
    if (!clean) return false;
    if (POLICY.QUICK_ANSWER.NUMBER_PATTERN.test(clean)) return true;
    return POLICY.QUICK_ANSWER.CONDITION_PATTERNS.some((rx) => rx.test(clean));
  },

  validateQuickAnswer: (text, options = {}) => {
    const mode = String(options.mode || 'strict').toLowerCase();
    const errors = [];
    const warnings = [];
    const clean = utils.stripTags(text).replace(/\s+/g, ' ').trim();
    const words = utils.countWords(clean);
    const push = mode === 'legacy' ? warnings : errors;

    if (!clean) {
      push.push('Brak treści "Szybka odpowiedź".');
      return { valid: false, errors, warnings, words };
    }
    if (words < POLICY.WORDS.QUICK_ANSWER_MIN || words > POLICY.WORDS.QUICK_ANSWER_MAX) {
      push.push(`Szybka odpowiedź poza zakresem ${POLICY.WORDS.QUICK_ANSWER_MIN}-${POLICY.WORDS.QUICK_ANSWER_MAX} słów (jest ${words}).`);
    }
    const banned = validators.containsBannedPhrase(clean);
    if (banned.found) {
      push.push(`Szybka odpowiedź jest zbyt generyczna (fraza: "${banned.phrase}").`);
    }
    if (!validators.hasNumberOrCondition(clean)) {
      push.push('Szybka odpowiedź musi zawierać liczbę albo warunek (np. jeśli/gdy/kiedy/u osób po 50/przy wyniku).');
    }

    return { valid: errors.length === 0, errors, warnings, words };
  },

  validateLogicalCoherence: (items) => {
    const errors = [];
    const list = Array.isArray(items) ? items : [items];

    list.forEach((item, index) => {
      const label = typeof item === 'object' && item ? String(item.label || `fragment #${index + 1}`) : `fragment #${index + 1}`;
      const text = normalizeLogicChunk(typeof item === 'object' && item ? item.text : item);
      if (!text) return;

      const firstSentence = (text.split(/(?<=[.!?])\s+/)[0] || text).trim();
      const startsWithVagueReference = POLICY.LOGIC_COHERENCE.VAGUE_REFERENCE_OPENERS.some((rx) => rx.test(firstSentence));
      const containsVagueReference = POLICY.LOGIC_COHERENCE.VAGUE_REFERENCE_ANYWHERE.test(text);
      if (startsWithVagueReference || containsVagueReference) {
        const hasLocalContext = POLICY.LOGIC_COHERENCE.VAGUE_REFERENCE_CONTEXT.some((rx) => rx.test(text));
        if (!hasLocalContext) {
          errors.push(`${label}: skrót logiczny bez lokalnego kontekstu. Akapit zaczyna od ogólnego odniesienia ("${firstSentence.slice(0, 90)}..."), ale nie nazywa w tym samym fragmencie konkretnej obietnicy, mitu, reklamy albo twierdzenia.`);
        }
      }

      const usesMetaphor = POLICY.LOGIC_COHERENCE.METAPHOR_PATTERNS.some((rx) => rx.test(text));
      if (usesMetaphor) {
        const mechanismHits = POLICY.LOGIC_COHERENCE.METAPHOR_MECHANISM.filter((rx) => rx.test(text)).length;
        if (mechanismHits < 2) {
          errors.push(`${label}: metafora bez domknięcia mechanizmem. Jeśli używasz obrazu typu "korek w zlewie", ten sam fragment musi dopowiedzieć, co naprawdę robi limfa/tłuszcz/energia/deficyt.`);
        }
      }

      const hasAbstractProofPhrase = POLICY.LOGIC_COHERENCE.ABSTRACT_PROOF_PHRASES.some((rx) => rx.test(text));
      if (hasAbstractProofPhrase && !/\b(bez\s+deficytu|bez\s+treningu|w\s+kilka\s+minut|badanie|metod[ayą]|kto\s+j[aą]\s+zmierzy[lł])\b/iu.test(text)) {
        errors.push(`${label}: ogólna ocena dowodów bez konkretu. Wyjaśnij dokładnie, jaka obietnica wymaga dowodu i jaki dowód byłby potrzebny.`);
      }
    });

    return { ok: errors.length === 0, errors };
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
