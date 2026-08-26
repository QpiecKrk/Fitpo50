#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { POLICY, validators } = require('./lib/article-policy');
const { CATEGORY_LANDING_PAGES, isSupportedCategory, normalizeCategory } = require('./lib/categories');
const { collectArticleFragments, fragmentNeedsEvidence, isMedicalArticle } = require('./lib/article-evidence');

function toLocalIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TODAY = toLocalIsoDate();
function parseArgs(argv) {
  const out = { write: false, allowOutsideRepo: false, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--file') {
      out.file = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (t === '--write') {
      out.write = String(argv[i + 1] || 'true').trim().toLowerCase() !== 'false';
      i += 1;
      continue;
    }
    if (t === '--allow-outside-repo') {
      out.allowOutsideRepo = String(argv[i + 1] || 'true').trim().toLowerCase() !== 'false';
      i += 1;
      continue;
    }
    if (t === '--check') {
      out.check = String(argv[i + 1] || 'true').trim().toLowerCase() !== 'false';
      i += 1;
      continue;
    }
  }
  return out;
}

function isInsideRepo(absPath, repoRoot) {
  const rel = path.relative(repoRoot, absPath);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function stripTags(text) {
  return decodeHtmlEntities(String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function normalizeFaqResearch(items) {
  return (Array.isArray(items) ? items : [])
    .map((r) => ({
      question: stripTags(String((r && r.question) || '')).replace(/\s+/g, ' ').trim(),
      source_label: stripTags(String((r && (r.source_label || r.label || r.citation || r.title)) || '')).replace(/\s+/g, ' ').trim(),
      source_url: String((r && (r.source_url || r.url)) || '').trim(),
      source_type: String((r && (r.source_type || r.sourceType)) || '').trim(),
      query: String((r && r.query) || '').replace(/\s+/g, ' ').trim(),
      research_note: stripTags(String((r && (r.research_note || r.researchNote)) || '')).replace(/\s+/g, ' ').trim(),
      checked_at: String((r && (r.checked_at || r.checkedAt)) || '').trim(),
      url_status: String((r && (r.url_status || r.urlStatus)) || '').trim(),
      http_status: Number((r && (r.http_status || r.httpStatus)) || 0) || 0,
      final_url: String((r && (r.final_url || r.finalUrl)) || '').trim(),
    }))
    .filter((r) => r.question && r.source_label && /^https:\/\//i.test(r.source_url));
}

function decodeHtmlEntities(input) {
  const named = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    ndash: '-',
    mdash: '-',
    hellip: '...',
    bdquo: '"',
    ldquo: '"',
    rdquo: '"',
    rsquo: "'",
    lsquo: "'",
  };
  return String(input || '')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _m;
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _m;
    })
    .replace(/&([a-z]+);/gi, (m, key) => named[key.toLowerCase()] ?? m);
}

function wordCount(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function truncateAtWordBoundary(text, maxChars) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= maxChars) return value;
  const probe = value.slice(0, maxChars + 1);
  const cut = probe.lastIndexOf(' ');
  if (cut >= Math.floor(maxChars * 0.6)) return probe.slice(0, cut).trim();
  return value.slice(0, maxChars).trim();
}

function ensureParagraphWrapper(html) {
  const raw = String(html || '').trim();
  if (!raw) return '';
  if (/^<(?:p|div|table|figure|aside|ul|ol|blockquote|pre)[\s>]/i.test(raw)) return raw;
  return `<p>${raw}</p>`;
}

function normalizeInternalHtmlLinks(html) {
  return String(html || '').replace(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (full, href) => {
      const h = String(href || '').trim();
      if (!h) return full;
      if (/^https?:\/\/(www\.)?fitpo50\.pl\/[^"\s]+\.html(?:[?#].*)?$/i.test(h)) {
        const rel = h
          .replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, './');
        return full.replace(href, rel);
      }
      if (!/^(https?:|mailto:|tel:|#|javascript:)/i.test(h) && /\.html(?:[?#].*)?$/i.test(h) && !h.startsWith('./')) {
        return full.replace(href, `./${h.replace(/^\//, '')}`);
      }
      return full;
    }
  );
}

function sanitizeCodeGlyphs(html) {
  const map = new Map([
    ['κ', 'kappa'],
    ['Κ', 'Kappa'],
    ['α', 'alpha'],
    ['Α', 'Alpha'],
    ['β', 'beta'],
    ['Β', 'Beta'],
    ['γ', 'gamma'],
    ['Γ', 'Gamma'],
    ['δ', 'delta'],
    ['Δ', 'Delta'],
    ['θ', 'theta'],
    ['Θ', 'Theta'],
    ['λ', 'lambda'],
    ['Λ', 'Lambda'],
    ['μ', 'mu'],
    ['Μ', 'Mu'],
    ['π', 'pi'],
    ['Π', 'Pi'],
    ['σ', 'sigma'],
    ['Σ', 'Sigma'],
    ['ω', 'omega'],
    ['Ω', 'Omega'],
    ['×', 'x'],
    ['·', '.'],
    ['−', '-'],
    ['≤', '<='],
    ['≥', '>='],
    ['≈', '~'],
    ['²', '^2'],
    ['³', '^3'],
  ]);
  return String(html || '').replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (full, code) => {
    let normalized = String(code || '');
    for (const [from, to] of map.entries()) {
      normalized = normalized.split(from).join(to);
    }
    return full.replace(code, normalized);
  });
}

function patchCommonQuoteMismatches(raw) {
  let out = String(raw || '');
  out = out.replace(/„([^”"\n]*?)",/g, '„$1”,');
  out = out.replace(/„([^”"\n]*?)"\./g, '„$1”.');
  out = out.replace(/„([^”"\n]*?)";/g, '„$1”;');
  out = out.replace(/„([^”"\n]*?)":/g, '„$1”:');
  out = out.replace(/„([^”"\n]*?)"\)/g, '„$1”)');
  return out;
}

function extractLikelyJsonObject(raw) {
  const text = String(raw || '').trim();
  if (!text) return text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? String(fenced[1] || '').trim() : text;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return candidate.slice(first, last + 1).trim();
  }
  return candidate;
}

function parseJsonWithDiagnostics(raw) {
  const stripped = extractLikelyJsonObject(raw);
  try {
    return { json: JSON.parse(stripped), patched: false };
  } catch (err) {
    const patchedRaw = patchCommonQuoteMismatches(stripped);
    if (patchedRaw !== stripped) {
      try {
        return { json: JSON.parse(patchedRaw), patched: true, patchedRaw };
      } catch (_ignore) {
        // continue with original error diagnostics
      }
    }
    const message = String(err && err.message ? err.message : err);
    const posMatch = message.match(/position (\d+)/i);
    if (!posMatch) {
      throw new Error(message);
    }
    const pos = Number(posMatch[1]);
    const head = stripped.slice(0, pos);
    const line = head.split('\n').length;
    const col = pos - head.lastIndexOf('\n');
    const lineText = stripped.split('\n')[line - 1] || '';
    throw new Error(`${message} (line ${line}, col ${col}): ${lineText.trim()}`);
  }
}


function normalizeDate(input) {
  const raw = String(input || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return TODAY;
  if (raw > TODAY) return TODAY;
  return raw;
}

function dedupeSources(sources) {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const label = String(s.label || s.citation || s.title || s.name || '').replace(/\s+/g, ' ').trim();
    const url = String(s.url || '').trim();
    if (!label || !/^https:\/\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...s,
      label,
      url,
      evidence_level: inferEvidenceLevel(s),
      checked_at: String(s.checked_at || s.checkedAt || '').trim(),
      url_status: String(s.url_status || s.urlStatus || '').trim(),
      http_status: Number(s.http_status || s.httpStatus || 0) || 0,
    });
  }
  return out;
}

function inferEvidenceLevel(source) {
  const explicit = String(source?.evidence_level || source?.evidenceLevel || '').trim().toLowerCase();
  if (explicit) return explicit;
  const type = stripTags(String(source?.type || '')).toLowerCase();
  if (/meta.?analiz/.test(type)) return 'meta_analysis';
  if (/przegląd systematyczny/.test(type)) return 'systematic_review';
  if (/randomiz/.test(type)) return 'randomized_trial';
  if (/kohort/.test(type)) return 'cohort';
  if (/regulator/.test(type)) return 'regulatory';
  if (/wytycz|konsensus/.test(type)) return 'guideline';
  if (/raport instytucjonalny/.test(type)) return 'expert_consensus';
  if (/dokument instytucjonalny|rekomendac|stanowisko/.test(type)) return 'official_guidance';
  if (/statystyk.*oficjal/.test(type)) return 'official_statistics';
  if (/badanie oryginalne|analiza laboratoryjna|badanie mechanistyczne|opis przypadku|korespondencja naukowa/.test(type)) return 'primary_research';
  if (/dokument techniczny/.test(type)) return 'technical_documentation';
  if (/dokument/.test(type)) return 'official_document';
  return 'secondary_analysis';
}

function firstEvidenceSentence(html) {
  const plain = stripTags(String(html || '')).replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  const sentence = plain.match(/^.{20,}?(?:[.!?](?=\s|$)|$)/u)?.[0] || plain;
  const clean = sentence.replace(/\s+/g, ' ').trim();
  return wordCount(clean) >= 5 ? clean : plain;
}

function legacyLocationToPath(location, sections) {
  const raw = String(location || '').trim();
  if (/^(?:lead|quick_answer|hero_motto_html|key_takeaways\[\d+\]|answer_blocks\[\d+\]\.answer_html|sections\[\d+\]\.(?:paragraphs_html|list_items)\[\d+\]|sections\[\d+\]\.info_box\.content_html|sections\[\d+\]\.image\.caption)$/.test(raw)) return raw;
  const sectionMatch = raw.match(/sections\[(\d+)\]/i);
  if (!sectionMatch) return '';
  const sectionIndex = Number(sectionMatch[1]);
  const section = sections[sectionIndex];
  if (!section) return '';
  const paragraphMatch = raw.match(/akapit(?:y|ach)?\s*(\d+)/i);
  const paragraphIndex = paragraphMatch ? Math.max(Number(paragraphMatch[1]) - 1, 0) : 0;
  if (!Array.isArray(section.paragraphs_html) || !section.paragraphs_html[paragraphIndex]) return '';
  return `sections[${sectionIndex}].paragraphs_html[${paragraphIndex}]`;
}

function normalizeEvidenceClaims(claims, sources, sections) {
  const sourceById = new Map(sources.map((source) => [String(source.id || '').trim(), source.url]).filter(([id, url]) => id && url));
  return (Array.isArray(claims) ? claims : []).map((claim) => {
    const location = legacyLocationToPath(claim?.location, sections);
    const locationMatch = location.match(/^sections\[(\d+)\]\.paragraphs_html\[(\d+)\]$/);
    const fragment = locationMatch
      ? sections[Number(locationMatch[1])]?.paragraphs_html?.[Number(locationMatch[2])]
      : '';
    const sourceUrls = Array.isArray(claim?.source_urls) && claim.source_urls.length
      ? claim.source_urls
      : (Array.isArray(claim?.sources) ? claim.sources.map((id) => sourceById.get(String(id || '').trim())).filter(Boolean) : []);
    return {
      claim: location ? firstEvidenceSentence(fragment) : stripTags(String(claim?.claim || '')).trim(),
      location,
      claim_type: String(claim?.claim_type || claim?.claimType || inferClaimType(fragment)).trim().toLowerCase(),
      source_urls: [...new Set(sourceUrls)],
      note: stripTags(String(claim?.note || claim?.status || '')).trim(),
    };
  }).filter((claim) => claim.location && claim.claim && claim.source_urls.length);
}

function evidenceSourceUrls(ids, sourceById) {
  return [...new Set((Array.isArray(ids) ? ids : []).map((id) => sourceById.get(String(id || '').trim())).filter(Boolean))];
}

function inferClaimType(fragment) {
  const text = stripTags(fragment).toLowerCase();
  if (/\d/.test(text)) return 'statistic';
  if (/metodolog|liczebno|próba|błąd systematyczny|korelac|przyczynowo|dowód|sygnał|wniosek|obawa|przekaz|internet|nagłówek|doświadczenie/.test(text)) return 'general';
  if (/mechanizm|mrna|dna|jądr|transkrypt|immunolog|komórk|nanocząst/.test(text)) return 'mechanism';
  return 'medical';
}

function expandEvidenceClaims(json) {
  const claims = Array.isArray(json.evidence_claims) ? [...json.evidence_claims] : [];
  const mapped = new Set(claims.map((claim) => String(claim.location || '').trim()).filter(Boolean));
  const sourceById = new Map((Array.isArray(json.sources) ? json.sources : [])
    .map((source) => [String(source.id || '').trim(), String(source.url || '').trim()])
    .filter(([id, url]) => id && url));
  const globalUrls = evidenceSourceUrls(json.evidence_source_ids, sourceById);
  const fragments = collectArticleFragments(json);
  const medical = isMedicalArticle(json);
  fragments.filter((fragment) => fragmentNeedsEvidence(fragment, medical) || /\b(dlatego|zatem|w rezultacie|to oznacza|wynika z tego|w praktyce oznacza|stąd wniosek)\b/iu.test(fragment.text)).forEach((fragment) => {
    if (mapped.has(fragment.location)) return;
    let urls = globalUrls;
    const sectionMatch = fragment.location.match(/^sections\[(\d+)\]/);
    const answerMatch = fragment.location.match(/^answer_blocks\[(\d+)\]/);
    if (sectionMatch) urls = evidenceSourceUrls(json.sections?.[Number(sectionMatch[1])]?.evidence_source_ids, sourceById);
    if (answerMatch) urls = evidenceSourceUrls(json.answer_blocks?.[Number(answerMatch[1])]?.evidence_source_ids, sourceById);
    if (!urls.length) return;
    claims.push({
      claim: firstEvidenceSentence(fragment.text),
      location: fragment.location,
      claim_type: inferClaimType(fragment.text),
      source_urls: urls,
      note: 'Mapowanie utworzone z jawnych evidence_source_ids dostarczonych dla tego fragmentu lub sekcji.',
    });
    mapped.add(fragment.location);
  });
  return claims;
}

function htmlToParagraphs(contentHtml) {
  const html = String(contentHtml || '');
  const matches = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((m) => m[0].trim()).filter(Boolean);
  return matches;
}

function htmlToListItems(contentHtml) {
  const html = String(contentHtml || '');
  const out = [];
  for (const ul of html.matchAll(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi)) {
    const body = String(ul[1] || '');
    for (const li of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = stripTags(String(li[1] || '')).replace(/\s+/g, ' ').trim();
      if (text) out.push(text);
    }
  }
  return out;
}

function ensureQuestionHeading(title) {
  const clean = stripTags(String(title || '')).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (/[?]$/.test(clean)) return clean;
  return `${clean}?`;
}

function buildQuickAnswer(json) {
  const fromJson = stripTags(String(json.quick_answer || json.quickAnswer || '')).replace(/\s+/g, ' ').trim();
  return fromJson;
}

function validate(json) {
  const errors = [];
  const titleValidation = validators.validateTitleText(json.title, {
    label: 'title',
    min: POLICY.TITLE.JSON_MIN,
    max: POLICY.TITLE.MAX
  });
  if (!titleValidation.ok) {
    errors.push(...titleValidation.errors);
  }
  if (!json.meta_description || json.meta_description.length < 145 || json.meta_description.length > 160) {
    errors.push(`meta_description poza zakresem 145-160 (jest ${String(json.meta_description || '').length})`);
  }
  if (!isSupportedCategory(json.category)) {
    errors.push(`category niepoprawne (${json.category})`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(json.date_published || '')) || String(json.date_published) > TODAY) {
    errors.push(`date_published niepoprawne (${json.date_published})`);
  }
  if (!Array.isArray(json.key_takeaways) || json.key_takeaways.length !== 4) {
    errors.push('key_takeaways != 4');
  }
  if (!Array.isArray(json.sections) || json.sections.length < 6) {
    errors.push(`sections < 6 (jest ${Array.isArray(json.sections) ? json.sections.length : 0})`);
  }
  const qaWords = wordCount(stripTags(String(json.quick_answer || '')));
  if (qaWords < 40 || qaWords > 60) {
    errors.push(`quick_answer poza zakresem 40-60 słów (jest ${qaWords})`);
  }
  if (Array.isArray(json.sections)) {
    for (let i = 0; i < json.sections.length; i += 1) {
      const title = String(json.sections[i]?.title || '').trim();
      if (!title.endsWith('?')) {
        errors.push(`sections[${i}].title musi być pytaniem zakończonym "?".`);
      }
    }
  }
  if (!Array.isArray(json.sources) || json.sources.length < 4) {
    errors.push(`sources < 4 (jest ${Array.isArray(json.sources) ? json.sources.length : 0})`);
  }
  if (!Array.isArray(json.answer_blocks) || json.answer_blocks.length < 4) {
    errors.push(`answer_blocks < 4 (jest ${Array.isArray(json.answer_blocks) ? json.answer_blocks.length : 0})`);
  }
  const prompts = Array.isArray(json.image_prompts_v4) && json.image_prompts_v4.length
    ? json.image_prompts_v4
    : (Array.isArray(json.image_prompts) ? json.image_prompts : []);
  const expectedImages = (Array.isArray(json.sections) ? json.sections.length : 0) + 1;
  if (prompts.length !== expectedImages) errors.push(`image_prompts musi zawierać dokładnie hero + obraz każdej sekcji (${expectedImages}); jest ${prompts.length}.`);
  return errors;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Użycie: node scripts/fix-fitpo50-json.js --file data/import/file.fitpo50.json [--write true|false]');
    process.exit(1);
  }
  const repoRoot = process.cwd();
  const file = path.resolve(repoRoot, args.file);
  if (!fs.existsSync(file)) {
    console.error(`[FAIL] Brak pliku: ${file}`);
    process.exit(1);
  }
  if (!isInsideRepo(file, repoRoot) && !args.allowOutsideRepo) {
    console.error(`[FAIL] Plik wejściowy jest poza repo: ${file}`);
    console.error('[FAIL] Najpierw skopiuj JSON do data/import/ i uruchom ponownie.');
    process.exit(1);
  }

  let json;
  let patchedRaw = null;
  try {
    const rawText = fs.readFileSync(file, 'utf8');
    const parsed = parseJsonWithDiagnostics(rawText);
    json = parsed.json;
    if (parsed.patched && parsed.patchedRaw) {
      patchedRaw = parsed.patchedRaw;
    }
  } catch (err) {
    console.error(`[FAIL] JSON parse error: ${err.message}`);
    process.exit(1);
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    console.error('[FAIL] Wymagany pojedynczy obiekt JSON.');
    process.exit(1);
  }

  delete json.related;
  delete json.related_articles;

  const rawTitleInput = String(json.title || '').replace(/\s+/g, ' ').trim();
  const rawSeoTitleInput = String(json.seo_title || '').replace(/\s+/g, ' ').trim();
  json.title = truncateAtWordBoundary(rawTitleInput, 65);
  if (!rawSeoTitleInput || rawSeoTitleInput === rawTitleInput) {
    json.seo_title = truncateAtWordBoundary(json.title, POLICY.TITLE.SEO_BASE_MAX);
  } else {
    json.seo_title = truncateAtWordBoundary(rawSeoTitleInput, POLICY.TITLE.SEO_BASE_MAX);
  }
  json.slug = String(json.slug || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  json.meta_description = truncateAtWordBoundary(String(json.meta_description || '').replace(/\s+/g, ' ').trim(), 160);

  json.category = normalizeCategory(json.category || json.section || 'ciekawe').key;
  json.lead = stripTags(String(json.lead || '')).replace(/\s+/g, ' ').trim();
  json.reading_time = String(json.reading_time || '12 minut').replace(/\s+/g, ' ').trim();
  json.date_published = normalizeDate(json.date_published);
  json.hero_image = String(json.hero_image || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  json.hero_alt = String(json.hero_alt || json.title || '').replace(/\s+/g, ' ').trim();
  json.hero_motto_html = String(json.hero_motto_html || '').trim();
  if (json.hero_motto_html && !/^<em>[\s\S]*<\/em>$/.test(json.hero_motto_html)) {
    json.hero_motto_html = `<em>${stripTags(json.hero_motto_html)}</em>`;
  }

  const takeaways = Array.isArray(json.key_takeaways) ? json.key_takeaways : [];
  json.key_takeaways = takeaways.map((x) => stripTags(String(x || '')).trim()).filter(Boolean).slice(0, 4);

  const sections = Array.isArray(json.sections) ? json.sections : [];
  json.sections = sections.map((s) => {
    const section = (s && typeof s === 'object') ? s : {};
    const title = ensureQuestionHeading(stripTags(String(section.title || section.heading || '')).trim());
    const paragraphsRaw = Array.isArray(section.paragraphs_html)
      ? section.paragraphs_html
      : htmlToParagraphs(section.content_html || '');
    const paragraphs = paragraphsRaw.map((p) => sanitizeCodeGlyphs(normalizeInternalHtmlLinks(ensureParagraphWrapper(p)))).filter(Boolean);

    const listItems = Array.isArray(section.list_items) ? section.list_items : htmlToListItems(section.content_html || '');
    const infoBox = section.info_box && typeof section.info_box === 'object' ? section.info_box : {};
    const image = section.image && typeof section.image === 'object' ? section.image : {};
    const normalizedSection = {
      title,
      paragraphs_html: paragraphs,
      list_items: listItems.map((x) => stripTags(String(x || '')).trim()).filter(Boolean),
      evidence_source_ids: [...new Set((Array.isArray(section.evidence_source_ids) ? section.evidence_source_ids : []).map((id) => String(id || '').trim()).filter(Boolean))],
      image: {
        src: String(image.src || '').trim(),
        alt: stripTags(String(image.alt || '')).trim(),
        caption: stripTags(String(image.caption || '')).trim(),
        width: Number(image.width || 0) || 0,
        height: Number(image.height || 0) || 0,
      },
    };
    if (String(infoBox.content_html || '').trim()) {
      normalizedSection.info_box = {
        style: String(infoBox.style || 'accent').trim(),
        title: stripTags(String(infoBox.title || '')).trim(),
        content_html: sanitizeCodeGlyphs(normalizeInternalHtmlLinks(ensureParagraphWrapper(infoBox.content_html))),
      };
    }
    return normalizedSection;
  });

  const faq = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  json.answer_blocks = faq.map((f) => ({
    question: stripTags(String((f && f.question) || '')).trim(),
    answer_html: sanitizeCodeGlyphs(normalizeInternalHtmlLinks(ensureParagraphWrapper((f && (f.answer_html || f.answer)) || ''))),
    evidence_source_ids: [...new Set((Array.isArray(f?.evidence_source_ids) ? f.evidence_source_ids : []).map((id) => String(id || '').trim()).filter(Boolean))],
  })).filter((f) => f.question && f.answer_html);

  json.quick_answer = buildQuickAnswer(json);

  json.sources = dedupeSources(Array.isArray(json.sources) ? json.sources : []);

  json.evidence_claims = normalizeEvidenceClaims(json.evidence_claims, json.sources, json.sections);
  json.evidence_claims = expandEvidenceClaims(json);

  json.faq_research = normalizeFaqResearch(json.faq_research);

  const promptKey = Array.isArray(json.image_prompts_v4) && json.image_prompts_v4.length ? 'image_prompts_v4' : 'image_prompts';
  const imagePrompts = Array.isArray(json[promptKey]) ? json[promptKey] : [];
  const mapped = imagePrompts.map((p, promptIndex) => {
    const prompt = p && typeof p === 'object' ? p : {};
    const rawRef = String(prompt.section_ref || '').trim();
    const sectionIndex = json.sections.findIndex((section) => stripTags(section.title).toLowerCase() === ensureQuestionHeading(stripTags(rawRef)).toLowerCase());
    const sectionRef = /^hero$/i.test(rawRef)
      ? 'hero'
      : (/^sekcja-\d+$/i.test(rawRef) ? rawRef.toLowerCase() : (sectionIndex >= 0 ? `sekcja-${sectionIndex + 1}` : (promptIndex === 0 ? 'hero' : rawRef)));
    return {
      ...prompt,
      section_ref: sectionRef,
      topic: String(prompt.topic || prompt.purpose || '').trim(),
      technique: String(prompt.technique || prompt.style || '').trim(),
      composition: String(prompt.composition || prompt.orientation || '').trim(),
      aspect_ratio: String(prompt.aspect_ratio || prompt.orientation || '').trim(),
      source_file: String(prompt.source_file || '').trim(),
    };
  });
  for (const p of mapped) {
    const fb = String(p.filename_base || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    p.filename_base = fb;
    p.section_ref = String(p.section_ref || '').trim();
    p.topic = String(p.topic || '').trim();
    p.technique = String(p.technique || '').trim();
    p.composition = String(p.composition || '').trim();
    p.purpose = String(p.purpose || '').trim();
    p.aspect_ratio = String(p.aspect_ratio || '').trim();
    p.source_file = String(p.source_file || '').trim();
    p.nano_banana_prompt = String(p.nano_banana_prompt || '').trim();
    p.alt_pl = String(p.alt_pl || '').trim();
    p.caption_pl = String(p.caption_pl || '').trim();
    p.overlay_text_pl = String(p.overlay_text_pl || '').trim();
    p.negative_prompt = String(p.negative_prompt || '').trim();
    if (p.visual_review && typeof p.visual_review === 'object') {
      p.visual_review = {
        status: String(p.visual_review.status || '').trim(),
        matches_topic: p.visual_review.matches_topic === true,
        reviewed_by: String(p.visual_review.reviewed_by || '').trim(),
        reviewed_at: String(p.visual_review.reviewed_at || '').trim(),
        note: String(p.visual_review.note || '').trim(),
      };
    }
  }
  json[promptKey] = mapped;

  const hero = mapped.find((p) => p.section_ref === 'hero');
  if (hero?.filename_base) {
    json.hero_image = hero.filename_base;
  }

  for (let i = 0; i < json.sections.length; i += 1) {
    const ref = `sekcja-${i + 1}`;
    const prompt = mapped.find((p) => p.section_ref === ref);
    if (prompt?.filename_base && json.sections[i]?.image) json.sections[i].image.src = `./assets/${prompt.filename_base}.webp`;
  }

  const finalErrors = validate(json);

  if (args.write) {
    const backupPath = `${file}.bak`;
    fs.copyFileSync(file, backupPath);
    fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    console.log(`[OK] Backup zapisany: ${path.relative(repoRoot, backupPath)}`);
    if (patchedRaw !== null) {
      console.log('[OK] Zastosowano automatyczną naprawę niedomkniętych cudzysłowów w surowym JSON.');
    }
  } else if (!args.check) {
    process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  }

  if (finalErrors.length) {
    console.error('\n[FAIL] fix-fitpo50-json');
    for (const err of finalErrors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log(`[OK] fix-fitpo50-json: ${path.relative(process.cwd(), file)}`);
}

if (require.main === module) main();

module.exports = { ensureParagraphWrapper, normalizeFaqResearch };
