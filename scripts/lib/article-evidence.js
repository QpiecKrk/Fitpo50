const { POLICY, utils, validators } = require('./article-policy');

const FAQ_SOURCE_TYPES = new Set(POLICY.FAQ_SOURCE_TYPES.allowed_for_new_content);
const CLAIM_TYPES = new Set(['medical', 'safety', 'statistic', 'price', 'mechanism', 'general']);
const MEDICAL_EVIDENCE_LEVELS = new Set([
  'guideline',
  'systematic_review',
  'meta_analysis',
  'randomized_trial',
  'cohort',
  'primary_research',
  'regulatory',
  'official_statistics',
  'official_guidance',
  'expert_consensus',
]);
const EVIDENCE_LEVELS = new Set([
  ...MEDICAL_EVIDENCE_LEVELS,
  'official_guidance',
  'expert_consensus',
  'official_document',
  'price_list',
  'technical_documentation',
  'primary_source',
  'secondary_analysis',
]);
const STRONG_SOURCE_HOSTS = [
  'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'nih.gov', 'cancer.gov', 'who.int', 'cdc.gov',
  'ema.europa.eu', 'fda.gov', 'gov.pl', 'nhs.uk', 'cochranelibrary.com', 'cochrane.org',
  'escardio.org', 'ptkardio.pl', 'heart.org', 'ahajournals.org', 'acc.org', 'acsm.org',
  'diabetesjournals.org', 'thelancet.com', 'nejm.org', 'jamanetwork.com', 'bmj.com',
  'nature.com', 'sciencedirect.com', 'springer.com', 'wiley.com', 'oup.com',
  'journals.plos.org', 'frontiersin.org', 'europepmc.org', 'doi.org', 'espen.org', 'medlineplus.gov',
];
const EVIDENCE_CLAIM_PATTERN = /\b(ryzyk[oa]|zmniejsza|zwiększa|obniża|podnosi|powoduje|zapobiega|leczy|leczenie|terapia|skuteczn|bezpieczn|przeciwwskaz|dawk[aię]|norm[ay]|rozpozn|diagnoz|objaw|ciśnieni|cholesterol|glukoz|insulin|nowotwor|zawał|udar|śmiertelno|badani[eu]|metaanaliz|przegląd systematyczny)\b/iu;
const NUMBERED_CLAIM_PATTERN = /\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:%|mg|g|kg|µg|mcg|mmol|nmol|mmhg|cm|mm|godzin|godziny|dni|tygodni|miesięcy|lat|razy)\b/iu;
const CONCLUSION_PATTERN = /\b(dlatego|zatem|w rezultacie|to oznacza|wynika z tego|w praktyce oznacza|stąd wniosek)\b/iu;
const LOCAL_REASON_PATTERN = /\b(ponieważ|dlatego że|gdyż|bo|mechanizm|badani[eu]|dane|wynik|oznacza to, że)\b/iu;

function normalizeUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch (_err) {
    return '';
  }
}

function isIsoDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function daysBetween(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.floor((end - start) / 86400000);
}

function hostnameFor(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_err) {
    return '';
  }
}

function isStrongMedicalSource(url) {
  const hostname = hostnameFor(url);
  return Boolean(hostname && STRONG_SOURCE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`)));
}

function hasPublicationIdentifier(source) {
  const doi = String(source?.doi || '').trim();
  const pmid = String(source?.pmid || '').trim();
  const url = String(source?.url || source?.source_url || '').trim();
  return Boolean(doi || pmid || /doi\.org\/10\./i.test(url) || /pubmed\.ncbi\.nlm\.nih\.gov\/\d+/i.test(url));
}

function isQualifiedBlockedSource(source) {
  return String(source?.url_status || '').toLowerCase() === 'blocked_by_publisher'
    && [403, 405].includes(Number(source?.http_status || 0))
    && (hasPublicationIdentifier(source) || isStrongMedicalSource(source?.url || source?.source_url));
}

function countsTowardSourceMinimum(source) {
  return String(source?.url_status || '').toLowerCase() === 'reachable' || isQualifiedBlockedSource(source);
}

function withEvidenceVerification(json, item) {
  const url = String(item?.url || item?.source_url || item?.sourceUrl || '').trim();
  const verified = json?.evidence_verification?.entries?.[url];
  return verified && typeof verified === 'object' ? { ...item, ...verified } : item;
}

function validateSourceContractFields(source, label) {
  const errors = [];
  for (const field of ['fallback_url', 'evidence_scope', 'publication_date', 'checked_via', 'recheck_after']) {
    if (!Object.prototype.hasOwnProperty.call(source || {}, field)) errors.push(`${label}.${field} jest obowiązkowe (null jest dozwolony).`);
  }
  const fallback = source?.fallback_url;
  if (fallback !== null && fallback !== undefined && !/^https:\/\//i.test(String(fallback))) errors.push(`${label}.fallback_url musi być HTTPS URL-em albo null.`);
  for (const field of ['evidence_scope', 'checked_via']) {
    const value = source?.[field];
    if (value !== null && value !== undefined && !String(value).trim()) errors.push(`${label}.${field} musi być niepustym tekstem albo null.`);
  }
  for (const field of ['publication_date', 'recheck_after']) {
    const value = source?.[field];
    if (value !== null && value !== undefined && !isIsoDay(value)) errors.push(`${label}.${field} musi mieć format YYYY-MM-DD albo null.`);
    if (value !== null && value !== undefined && isIsoDay(value) && String(value) > new Date().toISOString().slice(0, 10)) errors.push(`${label}.${field} nie może być datą z przyszłości.`);
  }
  return errors;
}

function collectOverlayEvidenceClaims(json) {
  const claims = [];
  const key = Array.isArray(json?.image_prompts_v4) ? 'image_prompts_v4' : 'image_prompts';
  (Array.isArray(json?.[key]) ? json[key] : []).forEach((prompt, promptIndex) => {
    (Array.isArray(prompt?.overlay_claims) ? prompt.overlay_claims : []).forEach((claim, claimIndex) => {
      claims.push({
        claim: claim?.claim,
        location: `${key}[${promptIndex}].overlay_text_pl`,
        claim_type: claim?.claim_type || 'statistic',
        source_urls: claim?.source_url ? [claim.source_url] : [],
        _label: `${key}[${promptIndex}].overlay_claims[${claimIndex}]`,
      });
    });
  });
  return claims;
}

function deviceModelTokens(value) {
  return new Set(String(value || '').toLowerCase().match(/\b(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9-]{3,}\b/g) || []);
}

function isAuthoritativeDeviceDocumentation(source, fragmentText) {
  const level = String(source?.evidence_level || source?.evidenceLevel || '').trim().toLowerCase();
  if (level !== 'technical_documentation') return false;
  const fragmentTokens = deviceModelTokens(fragmentText);
  if (!fragmentTokens.size) return false;
  const sourceTokens = deviceModelTokens(`${source?.label || ''} ${source?.url || ''}`);
  return [...fragmentTokens].some((token) => sourceTokens.has(token));
}

function collectArticleFragments(json) {
  const fragments = [];
  const promptPlacements = new Set((Array.isArray(json.image_prompts_v4) ? json.image_prompts_v4 : (Array.isArray(json.image_prompts) ? json.image_prompts : []))
    .map((prompt) => String(prompt?.section_ref || '').trim()).filter(Boolean));
  const add = (location, text) => {
    const plain = utils.stripTags(text).replace(/\s+/g, ' ').trim();
    if (plain) fragments.push({ location, text: plain });
  };
  add('lead', json.lead);
  add('quick_answer', json.quick_answer || json.quickAnswer);
  add('hero_motto_html', json.hero_motto_html || json.hero_motto);
  (Array.isArray(json.key_takeaways) ? json.key_takeaways : []).forEach((item, index) => add(`key_takeaways[${index}]`, item));
  (Array.isArray(json.sections) ? json.sections : []).forEach((section, sectionIndex) => {
    (Array.isArray(section?.paragraphs_html) ? section.paragraphs_html : []).forEach((paragraph, paragraphIndex) => {
      add(`sections[${sectionIndex}].paragraphs_html[${paragraphIndex}]`, paragraph);
    });
    (Array.isArray(section?.list_items) ? section.list_items : []).forEach((item, itemIndex) => {
      add(`sections[${sectionIndex}].list_items[${itemIndex}]`, item);
    });
    if (section?.info_box) add(`sections[${sectionIndex}].info_box.content_html`, section.info_box.content_html);
    const derivedImagePlacement = String(section?.image?.placement || '').trim();
    if (section?.image && (!derivedImagePlacement || !promptPlacements.has(derivedImagePlacement))) {
      add(`sections[${sectionIndex}].image.alt`, section.image.alt);
      add(`sections[${sectionIndex}].image.caption`, section.image.caption);
    }
    (Array.isArray(section?.images) ? section.images : []).forEach((image, imageIndex) => {
      add(`sections[${sectionIndex}].images[${imageIndex}].caption`, image?.caption);
    });
  });
  (Array.isArray(json.answer_blocks) ? json.answer_blocks : []).forEach((item, index) => {
    add(`answer_blocks[${index}].answer_html`, item?.answer_html || item?.answer);
  });
  const promptKey = Array.isArray(json.image_prompts_v4) && json.image_prompts_v4.length
    ? 'image_prompts_v4'
    : 'image_prompts';
  (Array.isArray(json[promptKey]) ? json[promptKey] : []).forEach((prompt, index) => {
    add(`${promptKey}[${index}].alt_pl`, prompt?.alt_pl);
    add(`${promptKey}[${index}].caption_pl`, prompt?.caption_pl);
    add(`${promptKey}[${index}].overlay_text_pl`, prompt?.overlay_text_pl);
  });
  return fragments;
}

function isMedicalArticle(json) {
  if (String(json.category || '').trim().toLowerCase() === 'zdrowie') return true;
  const subject = utils.fuzzyNormalize(`${json.title || ''} ${json.slug || ''}`);
  return /\b(choroba|badanie|serce|cisnienie|cholesterol|cukrzyca|insulina|lek|terapia|diagnoza|objawy|nowotwor|hormon|szczepionka|krew|apob|lpa|kortyzol)\b/u.test(subject);
}

function fragmentNeedsEvidence(fragment, medicalArticle) {
  const text = String(fragment?.text || '');
  if (NUMBERED_CLAIM_PATTERN.test(text)) return true;
  if (EVIDENCE_CLAIM_PATTERN.test(text)) return true;
  return medicalArticle && /\b(zaleca|nie należy|należy|powinien|powinna|można stosować|nie stosuj)\b/iu.test(text);
}

function validateCheckedUrl(item, label, today, errors, warnings = [], options = {}) {
  const url = String(item?.url || item?.source_url || item?.sourceUrl || '').trim();
  const checkedAt = String(item?.checked_at || item?.checkedAt || '').trim();
  const urlStatus = String(item?.url_status || item?.urlStatus || '').trim().toLowerCase();
  const httpStatus = Number(item?.http_status || item?.httpStatus || 0);
  if (!/^https?:\/\//i.test(url)) errors.push(`${label}: brak poprawnego URL http/https.`);
  if (!isIsoDay(checkedAt)) {
    errors.push(`${label}: brak daty checked_at w formacie YYYY-MM-DD.`);
  } else {
    const age = daysBetween(checkedAt, today);
    if (age < 0) errors.push(`${label}: checked_at jest datą z przyszłości.`);
    if (age > 180) errors.push(`${label}: weryfikacja URL ma ${age} dni; wymagane ponowne sprawdzenie (maks. 180 dni).`);
  }
  if (urlStatus === 'blocked_by_publisher') {
    if (![401, 403, 405].includes(httpStatus)) errors.push(`${label}: status blocked_by_publisher wymaga HTTP 401, 403 albo 405.`);
    else if (isQualifiedBlockedSource(item)) warnings.push(`${label}: wydawca blokuje automat (HTTP ${httpStatus}); źródło ma trwały identyfikator albo wiarygodną domenę i wymaga kontroli merytorycznej, lecz nie blokuje transportowo.`);
    else errors.push(`${label}: wydawca blokuje automat (HTTP ${httpStatus || '?'}), a źródło nie ma DOI/PMID ani wiarygodnej domeny urzędowej lub naukowej.`);
  } else if (urlStatus === 'temporarily_unavailable') {
    errors.push(`${label}: serwer źródła jest chwilowo niedostępny albo ogranicza żądania (HTTP ${httpStatus || '?'}); ponów kontrolę.`);
    if (httpStatus !== 429 && httpStatus < 500) errors.push(`${label}: status temporarily_unavailable wymaga HTTP 429 albo 5xx.`);
  } else if (urlStatus === 'verification_failed') {
    errors.push(`${label}: nie udało się zweryfikować źródła z powodu błędu DNS, timeoutu, TLS albo połączenia; ponów kontrolę.`);
    if (httpStatus !== 0) errors.push(`${label}: status verification_failed nie może udawać odpowiedzi HTTP.`);
  } else if (urlStatus === 'broken') {
    errors.push(`${label}: źródło jest martwe (HTTP ${httpStatus || '?'}); wymagane źródło zastępcze.`);
    if (![404, 410].includes(httpStatus)) errors.push(`${label}: status broken wymaga HTTP 404 albo 410.`);
  } else if (urlStatus === 'reachable') {
    if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
      errors.push(`${label}: końcowy HTTP ${httpStatus || '?'} nie potwierdza dostępności źródła; wymagany kod 2xx po przekierowaniach.`);
    }
  } else if (urlStatus === 'requires_local_verification' && options.allowPendingVerification) {
    warnings.push(`${label}: URL czeka na lokalną weryfikację pipeline.`);
  } else if (urlStatus !== 'reachable') {
    errors.push(`${label}: nieznany url_status "${urlStatus || 'brak'}".`);
  }
}

function validateFaqResearch(json, today, warnings = [], options = {}) {
  const errors = [];
  const faq = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  const research = Array.isArray(json.faq_research) ? json.faq_research : [];
  const faqByQuestion = new Set(faq.map((item) => utils.faqIntentNormalize(item?.question || '')).filter(Boolean));
  const researchSeen = new Set();

  research.forEach((rawItem, index) => {
    const item = withEvidenceVerification(json, rawItem);
    const label = `faq_research[${index}]`;
    const question = String(item?.question || '').trim();
    const normalizedQuestion = utils.faqIntentNormalize(question);
    const sourceType = String(item?.source_type || item?.sourceType || '').trim().toLowerCase();
    const sourceUrl = String(item?.source_url || item?.sourceUrl || item?.url || '').trim();
    const query = String(item?.query || '').trim();
    const note = String(item?.research_note || item?.researchNote || '').trim();

    if (/\bwariant\s+\d+\b/iu.test(question)) errors.push(`${label}: niedozwolone sztuczne pytanie typu "wariant N".`);
    if (!normalizedQuestion || !faqByQuestion.has(normalizedQuestion)) errors.push(`${label}: pytanie nie ma odpowiednika 1:1 w answer_blocks.`);
    if (researchSeen.has(normalizedQuestion)) errors.push(`${label}: zduplikowane źródło intencji FAQ.`);
    researchSeen.add(normalizedQuestion);
    if (!FAQ_SOURCE_TYPES.has(sourceType)) {
      errors.push(`${label}: source_type musi być jednym z: ${[...FAQ_SOURCE_TYPES].join(', ')}.`);
    }
    validateCheckedUrl(item, label, today, errors, warnings, { allowPendingVerification: options.allowPendingVerification });

    if (sourceType === 'autocomplete') {
      if (!/suggestqueries\.google\.com\/complete\/search/i.test(sourceUrl)) {
        errors.push(`${label}: autocomplete wymaga rzeczywistego adresu Google Suggest dla konkretnego zapytania.`);
      }
      try {
        const urlQuery = new URL(sourceUrl).searchParams.get('q') || '';
        if (!urlQuery || utils.faqIntentNormalize(urlQuery) !== normalizedQuestion) {
          errors.push(`${label}: parametr q autocomplete musi odpowiadać pytaniu FAQ 1:1.`);
        }
      } catch (_err) {
        // Niepoprawny URL został już zgłoszony przez validateCheckedUrl.
      }
      if (item?.intent_verified !== true && !options.allowPendingAutocomplete) {
        errors.push(`${label}: odpowiedź Google Suggest nie została lokalnie sprawdzona albo nie zawiera pytania FAQ 1:1.`);
      }
      const verifiedSuggestion = String(item?.verified_suggestion || '').trim();
      if (item?.intent_verified === true && utils.faqIntentNormalize(verifiedSuggestion) !== normalizedQuestion) {
        errors.push(`${label}: verified_suggestion nie odpowiada pytaniu FAQ 1:1.`);
      }
    }
    if (sourceType === 'gsc') {
      const requirement = POLICY.FAQ_SOURCE_REQUIREMENTS.gsc;
      const impressions = Number(item?.impressions);
      if ((requirement.query_required && !query) || !Number.isFinite(impressions) || impressions < requirement.impressions_min) {
        errors.push(`${label}: GSC wymaga query oraz impressions >= ${requirement.impressions_min}.`);
      }
    }
    if (sourceType === 'paa') {
      const requirement = POLICY.FAQ_SOURCE_REQUIREMENTS.paa;
      if ((requirement.query_required && !query) || note.length < requirement.research_note_min_chars) {
        errors.push(`${label}: PAA wymaga query i research_note (min. ${requirement.research_note_min_chars} znaków).`);
      }
    }
  });

  for (const question of faqByQuestion) {
    if (!researchSeen.has(question)) errors.push(`FAQ "${question}" nie ma udokumentowanego pochodzenia w faq_research.`);
  }
  return errors;
}

function validateArticleEvidence(json, options = {}) {
  const errors = [];
  const warnings = [];
  const today = String(options.today || new Date().toISOString().slice(0, 10));
  const fragments = collectArticleFragments(json);
  const fragmentsByLocation = new Map(fragments.map((item) => [item.location, item]));
  const medicalArticle = isMedicalArticle(json);
  const sources = Array.isArray(json.sources) ? json.sources : [];
  const claims = [
    ...(Array.isArray(json.evidence_claims) ? json.evidence_claims : []),
    ...collectOverlayEvidenceClaims(json),
  ];
  const logicLinks = Array.isArray(json.logic_links) ? json.logic_links : [];
  const sourceByUrl = new Map();
  const validLogicConclusions = new Set();

  logicLinks.forEach((link, index) => {
    const label = `logic_links[${index}]`;
    const conclusionLocation = String(link?.conclusion_location || link?.conclusionLocation || '').trim();
    const premiseLocations = Array.isArray(link?.premise_locations) ? link.premise_locations.map((item) => String(item || '').trim()) : [];
    const reasoning = String(link?.reasoning || '').replace(/\s+/g, ' ').trim();
    if (!fragmentsByLocation.has(conclusionLocation)) errors.push(`${label}: conclusion_location nie wskazuje istniejącego fragmentu.`);
    if (!premiseLocations.length) errors.push(`${label}: wymagane premise_locations z wcześniejszym wyjaśnieniem.`);
    premiseLocations.forEach((location) => {
      if (!fragmentsByLocation.has(location)) errors.push(`${label}: premise_location nie istnieje: ${location}`);
      if (location === conclusionLocation) errors.push(`${label}: wniosek nie może być własną przesłanką.`);
    });
    if (reasoning.length < 20) errors.push(`${label}: reasoning musi konkretnie wyjaśniać przejście od przesłanek do wniosku (min. 20 znaków).`);
    if (fragmentsByLocation.has(conclusionLocation) && premiseLocations.length && reasoning.length >= 20) {
      validLogicConclusions.add(conclusionLocation);
    }
  });

  sources.forEach((rawSource, index) => {
    const source = withEvidenceVerification(json, rawSource);
    const url = String(source?.url || '').trim();
    const normalized = normalizeUrl(url);
    validateCheckedUrl(source, `sources[${index}]`, today, errors, warnings, { allowPendingVerification: options.allowPendingVerification });
    errors.push(...validateSourceContractFields(rawSource, `sources[${index}]`));
    if (normalized) {
      const parsed = new URL(normalized);
      const ncbi = ['pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'www.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov'].includes(parsed.hostname);
      if (ncbi && (parsed.searchParams.has('term') || /(?:^|\/)search(?:\/|$)/.test(parsed.pathname) || ['/', '/pubmed', '/pmc'].includes(parsed.pathname))) {
        errors.push(`sources[${index}]: wyniki wyszukiwania lub strona główna nie są konkretną publikacją bibliograficzną.`);
      }
    }
    if (!String(source?.label || '').trim()) errors.push(`sources[${index}]: brak pełnego label.`);
    const evidenceLevel = String(source?.evidence_level || source?.evidenceLevel || '').trim().toLowerCase();
    if (!EVIDENCE_LEVELS.has(evidenceLevel)) {
      errors.push(`sources[${index}]: brak poprawnego evidence_level (${[...EVIDENCE_LEVELS].join(', ')}).`);
    }
    if (normalized) {
      if (sourceByUrl.has(normalized)) errors.push(`sources[${index}]: zduplikowany URL źródła.`);
      sourceByUrl.set(normalized, { ...source, url, index });
    }
  });

  if (!claims.length) errors.push('Brak evidence_claims: lista źródeł bez mapowania do konkretnych twierdzeń jest dekoracyjna.');
  const mappedLocations = new Set();
  const usedSourceUrls = new Set();
  claims.forEach((claim, index) => {
    const label = claim?._label || `evidence_claims[${index}]`;
    const location = String(claim?.location || '').trim();
    const claimText = utils.stripTags(claim?.claim || '').replace(/\s+/g, ' ').trim();
    const claimType = String(claim?.claim_type || claim?.claimType || '').trim().toLowerCase();
    const sourceUrls = Array.isArray(claim?.source_urls) ? claim.source_urls : [];
    const fragment = fragmentsByLocation.get(location);
    const minimumClaimWords = /\.overlay_text_pl$/u.test(location) ? 2 : 5;
    const minimumClaimWordsLabel = minimumClaimWords === 2 ? 'słowa' : 'słów';
    if (!fragment) errors.push(`${label}: location "${location}" nie wskazuje istniejącego fragmentu JSON.`);
    if (utils.countWords(claimText) < minimumClaimWords) {
      errors.push(`${label}: claim musi nazywać konkretne twierdzenie (min. ${minimumClaimWords} ${minimumClaimWordsLabel}).`);
    }
    if (fragment && claimText && !utils.fuzzyNormalize(fragment.text).includes(utils.fuzzyNormalize(claimText))) {
      errors.push(`${label}: claim nie występuje w przypisanym fragmencie ${location}.`);
    }
    if (!CLAIM_TYPES.has(claimType)) errors.push(`${label}: claim_type musi być jednym z: ${[...CLAIM_TYPES].join(', ')}.`);
    if (!sourceUrls.length) errors.push(`${label}: brak source_urls przypisanych do twierdzenia.`);
    mappedLocations.add(location);
    let hasStrongMedicalEvidence = false;
    let hasAuthoritativeDeviceDocumentation = false;
    sourceUrls.forEach((rawUrl) => {
      const normalized = normalizeUrl(rawUrl);
      const source = sourceByUrl.get(normalized);
      if (!source) {
        errors.push(`${label}: source_url nie występuje w sources[]: ${rawUrl}`);
        return;
      }
      usedSourceUrls.add(normalized);
      const level = String(source.evidence_level || source.evidenceLevel || '').trim().toLowerCase();
      if (isStrongMedicalSource(source.url) && MEDICAL_EVIDENCE_LEVELS.has(level)) hasStrongMedicalEvidence = true;
      if (claimType === 'safety' && isAuthoritativeDeviceDocumentation(source, fragment?.text || claimText)) {
        hasAuthoritativeDeviceDocumentation = true;
      }
    });
    if (claimType === 'medical' && !hasStrongMedicalEvidence) {
      errors.push(`${label}: twierdzenie ${claimType} wymaga silnego źródła medycznego i jawnego evidence_level.`);
    }
    if (claimType === 'safety' && !hasStrongMedicalEvidence && !hasAuthoritativeDeviceDocumentation) {
      errors.push(`${label}: twierdzenie safety wymaga silnego źródła medycznego albo dokumentacji technicznej producenta wskazanego modelu urządzenia.`);
    }
  });

  fragments.filter((fragment) => fragmentNeedsEvidence(fragment, medicalArticle)).forEach((fragment) => {
    if (!mappedLocations.has(fragment.location)) {
      errors.push(`${fragment.location}: twierdzenie wymagające dowodu nie ma wpisu w evidence_claims.`);
    }
  });
  fragments.forEach((fragment) => {
    if (!CONCLUSION_PATTERN.test(fragment.text)) return;
    const hasMappedEvidence = mappedLocations.has(fragment.location);
    const hasLocalReason = LOCAL_REASON_PATTERN.test(fragment.text) || NUMBERED_CLAIM_PATTERN.test(fragment.text);
    const hasPriorExplanation = validLogicConclusions.has(fragment.location);
    if (!hasMappedEvidence && !hasLocalReason && !hasPriorExplanation) {
      errors.push(`${fragment.location}: wniosek nie wynika z liczby, źródła ani wyjaśnionego wcześniej mechanizmu.`);
    }
  });

  sourceByUrl.forEach((source, normalized) => {
    if (!usedSourceUrls.has(normalized)) errors.push(`sources[${source.index}]: źródło nie wspiera żadnego evidence_claims — dekoracyjna lista źródeł jest zabroniona.`);
  });

  if (medicalArticle && sources.length) {
    const strong = sources.filter((source) => {
      const level = String(source?.evidence_level || source?.evidenceLevel || '').trim().toLowerCase();
      return isStrongMedicalSource(source?.url) && MEDICAL_EVIDENCE_LEVELS.has(level);
    }).length;
    const ratio = strong / sources.length;
    if (strong < 2 || ratio < 0.67) {
      errors.push(`Temat medyczny: wymagane min. 2 silne źródła i 67% sources[] z wiarygodnych domen oraz evidence_level (jest ${strong}/${sources.length}).`);
    }
  }

  errors.push(...validateFaqResearch(json, today, warnings, options));
  const logic = validators.validateLogicalCoherence(fragments.map((fragment) => ({ label: fragment.location, text: fragment.text })));
  errors.push(...logic.errors);
  return { ok: errors.length === 0, errors, warnings, medicalArticle, fragments };
}

module.exports = {
  validateFaqResearch,
  CLAIM_TYPES,
  EVIDENCE_LEVELS,
  FAQ_SOURCE_TYPES,
  MEDICAL_EVIDENCE_LEVELS,
  collectArticleFragments,
  fragmentNeedsEvidence,
  isMedicalArticle,
  isAuthoritativeDeviceDocumentation,
  countsTowardSourceMinimum,
  collectOverlayEvidenceClaims,
  hasPublicationIdentifier,
  isQualifiedBlockedSource,
  isStrongMedicalSource,
  normalizeUrl,
  withEvidenceVerification,
  validateSourceContractFields,
  validateArticleEvidence,
};
