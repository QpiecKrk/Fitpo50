const fs = require('fs');
const os = require('os');
const path = require('path');
const { TOPIC_CENTERS } = require('./topic-centers');

const INTENTS = new Set([
  'how-to', 'czy-warto', 'objawy', 'normy', 'bezpieczenstwo', 'definicja',
  'porownanie', 'informacyjna', 'plan', 'koszt', 'dawkowanie',
]);

const STOP_WORDS = new Set([
  'a', 'aby', 'albo', 'ale', 'bez', 'bo', 'co', 'czy', 'dla', 'do', 'i', 'ich',
  'jak', 'jest', 'kiedy', 'ktore', 'ktory', 'na', 'nie', 'o', 'od', 'oraz', 'po',
  'pod', 'przy', 'roku', 'sie', 'to', 'w', 'we', 'z', 'za', 'ze', 'zycia',
  'fitpo50', 'tce', 'lat',
]);

const GENERIC_ANCHORS = new Set([
  'czytaj wiecej', 'dowiedz sie wiecej', 'kliknij tutaj', 'sprawdz', 'sprawdz tutaj',
  'ten artykul', 'tutaj', 'wiecej', 'zobacz',
]);

const CENTER_PROFILES = Object.freeze({
  strength: ['trening silowy', 'silownia', 'maszyny', 'progresja', 'sila chwytu', 'oporowy'],
  protein: ['bialko', 'wpc', 'wpi', 'kreatyna', 'sarkopenia', 'porcja bialka'],
  sleep: ['sen', 'bezdech', 'melatonina', 'pobudki nocne', 'rytmu dobowego', 'regeneracja'],
  pressure: ['nadcisnienie', 'cisnienie tetnicze', 'dash', 'pomiar cisnienia', 'naczynia'],
  cholesterol: ['cholesterol', 'apob', 'apoa1', 'ldl', 'lipidogram', 'lipoproteina'],
  metabolism: ['metabolizm', 'oponka', 'tluszcz trzewny', 'kortyzol', 'cukier', 'obwod pasa'],
});

function stripTags(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  return stripTags(value)
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value, { keepStopWords = false } = {}) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 2 && (keepStopWords || !STOP_WORDS.has(token)));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function firstMatch(html, rx) {
  const match = String(html || '').match(rx);
  return match ? stripTags(match[1]) : '';
}

function isArticleHtml(file, html) {
  if (!file.endsWith('.html') || file === 'article-template-bento.html') return false;
  return /["']@type["']\s*:\s*["']BlogPosting["']/i.test(html);
}

function normalizeHref(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/(?:www\.)?fitpo50\.pl\//i, '')
    .replace(/^[./]+/, '')
    .replace(/[?#].*$/, '');
}

function extractInternalLinks(html) {
  const links = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = normalizeHref(match[1]);
    if (href.endsWith('.html')) links.push(href);
  }
  return unique(links);
}

function buildArticleInventory(root = process.cwd()) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => {
      const file = entry.name;
      const html = fs.readFileSync(path.join(root, file), 'utf8');
      if (!isArticleHtml(file, html)) return null;
      const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s*\|\s*FitPo50\s*$/i, '');
      const h1 = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || title;
      const description = firstMatch(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((match) => stripTags(match[1]));
      const articleText = firstMatch(html, /<article\b[^>]*>([\s\S]*?)<\/article>/i);
      const semanticText = [title, h1, description, ...headings, articleText.slice(0, 1800)].join(' ');
      return {
        file,
        content_role: file.startsWith('centrum-') ? 'topic_center' : 'editorial_article',
        title,
        h1,
        description,
        semantic_text: semanticText,
        semantic_tokens: unique(tokens(semanticText)),
        links: extractInternalLinks(html),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.file.localeCompare(b.file, 'pl'));
}

function collectParagraphs(article) {
  const result = [];
  const sections = Array.isArray(article.sections) ? article.sections : [];
  sections.forEach((section, sectionIndex) => {
    const paragraphs = Array.isArray(section?.paragraphs_html) ? section.paragraphs_html : [];
    paragraphs.forEach((html, paragraphIndex) => {
      result.push({
        location: `sections[${sectionIndex}].paragraphs_html[${paragraphIndex}]`,
        sectionIndex,
        paragraphIndex,
        html: String(html || ''),
        plain: stripTags(html),
      });
    });
  });
  return result;
}

function scoreCandidate(articleTokens, candidate) {
  const candidateTokens = candidate.semantic_tokens || [];
  const source = new Set(articleTokens);
  const overlap = candidateTokens.filter((token) => source.has(token));
  const titleTokens = unique(tokens(`${candidate.title} ${candidate.h1}`));
  const titleOverlap = titleTokens.filter((token) => source.has(token));
  return (titleOverlap.length * 5) + Math.min(overlap.length, 12);
}

function candidatePhrases(candidate) {
  const rawTokens = tokens(`${candidate.h1} ${candidate.title}`, { keepStopWords: true });
  const phrases = [];
  for (let size = Math.min(5, rawTokens.length); size >= 2; size -= 1) {
    for (let index = 0; index <= rawTokens.length - size; index += 1) {
      const part = rawTokens.slice(index, index + size);
      if (STOP_WORDS.has(part[0]) || STOP_WORDS.has(part[part.length - 1])) continue;
      if (part.filter((token) => !STOP_WORDS.has(token)).length < 2) continue;
      phrases.push(part.join(' '));
    }
  }
  rawTokens.forEach((token) => {
    if (!STOP_WORDS.has(token) && (token.length >= 7 || /^[a-z]+\d+$/i.test(token))) phrases.push(token);
  });
  return unique(phrases).sort((a, b) => b.length - a.length);
}

function findActualPhrase(text, normalizedPhrase) {
  const words = normalizedPhrase.split(' ').filter(Boolean);
  if (!words.length) return '';
  const pattern = words.map((word) => word.split('').map((char) => {
    const variants = {
      a: '[aą]', c: '[cć]', e: '[eę]', l: '[lł]', n: '[nń]', o: '[oó]', s: '[sś]', z: '[zźż]',
    };
    return variants[char] || char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('')).join('\\s+');
  const match = String(text || '').match(new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'iu'));
  return match ? match[2] : '';
}

function isNaturalAnchor(anchor) {
  const clean = normalize(anchor);
  if (!clean || GENERIC_ANCHORS.has(clean) || /\b(tutaj|kliknij|czytaj wiecej|dowiedz sie wiecej)\b/.test(clean)) return false;
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length >= 2 && parts.length <= 7) return true;
  return parts.length === 1 && (parts[0].length >= 7 || /[a-z]+\d+/i.test(parts[0]));
}

function findAnchorForCandidate(candidate, paragraphs, usedLocations) {
  for (const phrase of candidatePhrases(candidate)) {
    for (const paragraph of paragraphs) {
      if (usedLocations.has(paragraph.location) || /<a\b/i.test(paragraph.html)) continue;
      const actual = findActualPhrase(paragraph.plain, phrase);
      if (actual && isNaturalAnchor(actual)) return { paragraph, anchor: actual };
    }
  }
  return null;
}

function linkPhraseOutsideTags(html, anchor, href) {
  const chunks = String(html || '').split(/(<[^>]+>)/g);
  let insideAnchor = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (/^<a\b/i.test(chunk)) insideAnchor += 1;
    if (/^<\/a\b/i.test(chunk)) insideAnchor = Math.max(insideAnchor - 1, 0);
    if (chunk.startsWith('<') || insideAnchor > 0) continue;
    const position = chunk.toLocaleLowerCase('pl').indexOf(anchor.toLocaleLowerCase('pl'));
    if (position < 0) continue;
    const actual = chunk.slice(position, position + anchor.length);
    chunks[index] = `${chunk.slice(0, position)}<a href="${href}">${actual}</a>${chunk.slice(position + anchor.length)}`;
    return { html: chunks.join(''), applied: true, actual };
  }
  return { html: String(html || ''), applied: false, actual: '' };
}

function readIntentOwners(root) {
  const candidates = [
    process.env.FITPO50_SEO_STATE_DIR && path.join(process.env.FITPO50_SEO_STATE_DIR, 'popraw-seo-kanibalizacja.json'),
    path.join(os.homedir(), 'Downloads', 'fitpo50-seo-state', 'popraw-seo-kanibalizacja.json'),
    path.join(root, 'data', 'reports', 'growth', 'popraw-seo-kanibalizacja.json'),
  ].filter(Boolean);
  for (const file of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed.intent_owners)) return parsed.intent_owners;
    } catch (_err) {
      // Następny kandydat jest bezpiecznym fallbackiem lokalnym.
    }
  }
  return [];
}

function detectCannibalization(article, inventory, root) {
  const primary = normalize(article.primary_keyword);
  const primaryTokens = unique(tokens(primary));
  const ownFile = `${article.slug}.html`;
  const candidates = inventory.filter((item) => item.file !== ownFile).map((item) => {
    const titleTokens = unique(tokens(`${item.title} ${item.h1}`));
    const intersection = primaryTokens.filter((token) => titleTokens.includes(token));
    const coverage = primaryTokens.length ? intersection.length / primaryTokens.length : 0;
    const exactPhrase = normalize(`${item.title} ${item.h1}`).includes(primary);
    return { file: item.file, title: item.title, coverage, exact_phrase: exactPhrase };
  }).filter((item) => item.exact_phrase || (primaryTokens.length >= 2 && item.coverage >= 0.75));

  const durableOwners = readIntentOwners(root)
    .filter((item) => normalize(item.intent_key || item.intent) === primary)
    .map((item) => ({
      file: String(item.main_file || ''),
      title: String(item.intent || article.primary_keyword || ''),
      coverage: 1,
      exact_phrase: true,
      durable_owner: true,
      owner_status: item.owner_status || '',
    }))
    .filter((item) => item.file && item.file !== `${article.slug}.html`);
  return [...new Map([...durableOwners, ...candidates].map((item) => [item.file, item])).values()]
    .sort((a, b) => Number(b.durable_owner) - Number(a.durable_owner) || b.coverage - a.coverage)
    .slice(0, 8);
}

function assessCenter(article) {
  const haystack = normalize([
    article.primary_keyword,
    ...(Array.isArray(article.supporting_keywords) ? article.supporting_keywords : []),
    article.title,
    article.lead,
  ].join(' '));
  const scored = TOPIC_CENTERS.map((center) => {
    const profile = CENTER_PROFILES[center.className] || [];
    const matches = profile.filter((phrase) => haystack.includes(normalize(phrase)));
    return { center, matches, score: matches.length };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  const strong = Boolean(best && best.score >= 2 && best.score >= (second?.score || 0) + 1);
  if (!strong) {
    return { fit: best?.score ? 'MEDIUM' : 'WEAK', proposed: false, status: 'NO_PROPOSAL' };
  }
  return {
    fit: 'STRONG',
    proposed: true,
    status: 'AWAITING_USER_APPROVAL',
    center_id: best.center.className,
    center_name: best.center.title,
    center_url: best.center.url,
    matched_signals: best.matches,
    suggested_role: 'artykuł uzupełniający',
  };
}

function validateStrategy(article, errors) {
  const intent = normalize(article.search_intent).replace(/\s+/g, '-');
  if (!INTENTS.has(intent)) {
    errors.push(`search_intent: wymagany jeden z: ${[...INTENTS].join(', ')}.`);
  }
  const primary = String(article.primary_keyword || '').trim();
  const primaryWords = tokens(primary, { keepStopWords: true });
  if (primaryWords.length < 2 || primaryWords.length > 8) {
    errors.push('primary_keyword: wymagana konkretna fraza główna długości 2-8 słów.');
  }
  const supporting = Array.isArray(article.supporting_keywords)
    ? unique(article.supporting_keywords.map((value) => String(value || '').trim()))
    : [];
  if (supporting.length < 3 || supporting.length > 8) {
    errors.push(`supporting_keywords: wymagane 3-8 unikalnych fraz (jest ${supporting.length}).`);
  }
  const titleLead = normalize(`${article.title || ''} ${article.seo_title || ''} ${article.lead || ''} ${article.quick_answer || ''}`);
  if (primary && !titleLead.includes(normalize(primary))) {
    errors.push('primary_keyword nie występuje naturalnie w title/seo_title/lead/quick_answer. Nie wolno ustalać title i H1 bez głównej intencji.');
  }
  return { intent, primary, supporting };
}

function validateExistingLinks(article, inventory, errors) {
  const validTargets = new Set(inventory.map((item) => item.file));
  const found = [];
  collectParagraphs(article).forEach((paragraph) => {
    for (const match of paragraph.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const target = normalizeHref(match[1]);
      const anchor = stripTags(match[2]);
      if (!validTargets.has(target)) errors.push(`${paragraph.location}: cel linku nie istnieje w lokalnym inventory BlogPosting (${target || match[1]}).`);
      if (!isNaturalAnchor(anchor)) errors.push(`${paragraph.location}: anchor „${anchor}” jest generyczny albo nienaturalny.`);
      if (/^centrum-/i.test(target)) {
        const approved = article.topic_center_approval?.status === 'APPROVED_BY_USER'
          && article.topic_center_approval?.center_url === target;
        if (!approved) errors.push(`${paragraph.location}: link do centrum ${target} nie ma jawnej akceptacji użytkownika.`);
      }
      found.push({ target, anchor, location: paragraph.location });
    }
  });
  return found;
}

function buildIncomingSuggestions(article, inventory, articleTokens) {
  const target = `${article.slug}.html`;
  return inventory
    .filter((item) => item.content_role === 'editorial_article')
    .filter((item) => !item.links.includes(target))
    .map((item) => ({ source: item.file, title: item.title, relevance_score: scoreCandidate(articleTokens, item) }))
    .filter((item) => item.relevance_score >= 6)
    .sort((a, b) => b.relevance_score - a.relevance_score || a.source.localeCompare(b.source, 'pl'))
    .slice(0, 6)
    .map((item) => ({ ...item, action: `Po publikacji znaleźć w ${item.source} istniejący fragment odpowiadający intencji „${article.primary_keyword}” i dopiero tam dodać link.` }));
}

function prepareArticleArchitecture(article, options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const mutate = options.mutate === true;
  const errors = [];
  const warnings = [];
  const inventory = options.inventory || buildArticleInventory(root);
  const strategy = validateStrategy(article, errors);
  const existing = validateExistingLinks(article, inventory, errors);
  if (errors.length) {
    const result = {
      ok: false,
      inventory_count: inventory.length,
      strategy,
      cannibalization_candidates: [],
      existing_links: existing,
      added_links: [],
      confirmed_link_count: 0,
      incoming_link_suggestions: [],
      topic_center_assessment: null,
      errors,
      warnings,
    };
    if (mutate) {
      article.intent_audit = {
        status: 'BLOCKED',
        inventory_count: inventory.length,
        primary_keyword: strategy.primary,
        search_intent: strategy.intent,
        cannibalization_candidates: [],
      };
    }
    return result;
  }
  const primaryContent = [
    strategy.primary,
    ...strategy.supporting,
    article.title,
    article.seo_title,
    article.lead,
    article.quick_answer,
    ...collectParagraphs(article).map((item) => item.plain),
  ].join(' ');
  const articleTokens = unique(tokens(primaryContent));
  const cannibalization = detectCannibalization(article, inventory, root);
  const distinction = article.intent_differentiation || {};
  if (cannibalization.length) {
    const compared = normalizeHref(distinction.compared_url || '');
    const decision = String(distinction.decision || '').trim();
    const need = String(distinction.distinct_user_need || '').trim();
    if (!compared || !cannibalization.some((item) => item.file === compared) || decision !== 'NEW_PRIMARY' || need.length < 30) {
      errors.push(`CANNIBALIZATION_REVIEW_REQUIRED: fraza „${strategy.primary || 'MISSING'}” koliduje z ${cannibalization.map((item) => item.file).join(', ')}. Wymagane intent_differentiation {compared_url, decision:"NEW_PRIMARY", distinct_user_need:min.30 znaków}.`);
    }
  }

  const paragraphs = collectParagraphs(article);
  const usedTargets = new Set(existing.map((item) => item.target));
  const usedLocations = new Set(existing.map((item) => item.location));
  const candidates = inventory
    .filter((item) => item.content_role === 'editorial_article')
    .filter((item) => item.file !== `${article.slug}.html` && !usedTargets.has(item.file))
    .map((item) => ({ ...item, relevance_score: scoreCandidate(articleTokens, item) }))
    .filter((item) => item.relevance_score >= 5)
    .sort((a, b) => b.relevance_score - a.relevance_score || a.file.localeCompare(b.file, 'pl'));
  const additions = [];
  const required = Math.max(4 - usedTargets.size, 0);
  for (const candidate of candidates) {
    if (additions.length >= required) break;
    const match = findAnchorForCandidate(candidate, paragraphs, usedLocations);
    if (!match) continue;
    const applied = linkPhraseOutsideTags(match.paragraph.html, match.anchor, candidate.file);
    if (!applied.applied) continue;
    additions.push({
      target: candidate.file,
      target_title: candidate.title,
      anchor: applied.actual,
      location: match.paragraph.location,
      relevance_score: candidate.relevance_score,
      selection_basis: 'Fraza istnieje w akapicie i pokrywa się z lokalną semantyką celu.',
    });
    usedTargets.add(candidate.file);
    usedLocations.add(match.paragraph.location);
    if (mutate) {
      article.sections[match.paragraph.sectionIndex].paragraphs_html[match.paragraph.paragraphIndex] = applied.html;
      match.paragraph.html = applied.html;
    }
  }
  if (usedTargets.size < 4) {
    errors.push(`INSUFFICIENT_CONTEXTUAL_LINKS: lokalne inventory pozwoliło potwierdzić ${usedTargets.size}/4 naturalnych, unikalnych linków. Nie dodano sztucznego zdania ani generycznego anchora.`);
  }

  const centerAssessment = assessCenter(article);
  const incomingSuggestions = buildIncomingSuggestions(article, inventory, articleTokens);
  if (incomingSuggestions.length < 2) {
    warnings.push(`Znaleziono tylko ${incomingSuggestions.length} mocnych kandydatów do późniejszego linku przychodzącego; nie uzupełniono listy słabymi stronami.`);
  }

  const result = {
    ok: errors.length === 0,
    inventory_count: inventory.length,
    strategy,
    cannibalization_candidates: cannibalization,
    existing_links: existing,
    added_links: additions,
    confirmed_link_count: usedTargets.size,
    incoming_link_suggestions: incomingSuggestions,
    topic_center_assessment: centerAssessment,
    errors,
    warnings,
  };
  if (mutate) {
    article.internal_link_plan = [...existing.map((item) => ({ ...item, source: 'DRAFT_VALIDATED' })), ...additions];
    article.incoming_link_suggestions = incomingSuggestions;
    article.topic_center_assessment = centerAssessment;
    article.intent_audit = {
      status: result.ok ? 'PASS' : 'BLOCKED',
      inventory_count: inventory.length,
      primary_keyword: strategy.primary,
      search_intent: strategy.intent,
      cannibalization_candidates: cannibalization,
    };
  }
  return result;
}

function validateArticleArchitecture(article, options = {}) {
  return prepareArticleArchitecture(article, { ...options, mutate: false });
}

module.exports = {
  INTENTS,
  assessCenter,
  buildArticleInventory,
  isNaturalAnchor,
  linkPhraseOutsideTags,
  normalize,
  prepareArticleArchitecture,
  validateArticleArchitecture,
};
