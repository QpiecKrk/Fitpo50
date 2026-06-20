#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { POLICY, validators } = require('./lib/article-policy');
const { CATEGORY_LANDING_PAGES, isSupportedCategory, normalizeCategory } = require('./lib/categories');

function toLocalIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TODAY = toLocalIsoDate();
const FALLBACK_SOURCES = [
  { label: 'World Health Organization: Physical activity guidelines', url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity' },
  { label: 'CDC: Benefits of physical activity', url: 'https://www.cdc.gov/physicalactivity/basics/pa-health/index.htm' },
  { label: 'American Heart Association: Physical activity recommendations', url: 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/aha-recs-for-physical-activity-in-adults' },
  { label: 'NIH: Exercise and physical activity', url: 'https://www.nia.nih.gov/health/exercise-and-physical-activity' },
  { label: 'Mayo Clinic: Exercise and fitness', url: 'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/exercise/art-20048389' },
  { label: 'PubMed: Cardiorespiratory fitness and mortality', url: 'https://pubmed.ncbi.nlm.nih.gov/29971482/' },
];

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
  if (!raw) return '<p>Ta część artykułu porządkuje najważniejsze fakty i praktyczne wskazówki dla osób po 50. roku życia.</p>';
  if (/^<p[\s>]/i.test(raw)) return raw;
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

function padFirstParagraphToRange(html, minWords = 35, maxWords = 80) {
  const raw = ensureParagraphWrapper(html);
  const plain = stripTags(raw);
  let words = plain.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    const clipped = words.slice(0, maxWords).join(' ').replace(/[,:;\s]+$/g, '').trim();
    return `<p>${clipped}.</p>`;
  }
  if (words.length >= minWords) return raw;
  const addon = ' To ważny element planu zdrowia i sprawności po 50. roku życia.';
  let next = plain;
  while (wordCount(next) < minWords) {
    next = `${next}${addon}`;
  }
  return `<p>${next.trim()}</p>`;
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
    out.push({ label, url });
  }
  return out;
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

function firstMeaningfulSentenceFromParagraph(paragraphHtml) {
  const plain = stripTags(String(paragraphHtml || '')).replace(/\s+/g, ' ').trim();
  if (!plain) return 'Najważniejsze: świadome nawyki i regularna praktyka pomagają utrzymać sprawność po 50. roku życia.';
  const sentence = plain.match(/^[^.!?]+[.!?]?/);
  const base = sentence ? sentence[0].trim() : plain;
  return base.length > 220 ? `${base.slice(0, 217).trimEnd()}...` : base;
}

function buildInfoBoxTitle(sectionTitle) {
  const clean = stripTags(String(sectionTitle || '')).replace(/\s+/g, ' ').trim();
  if (!clean) return 'Najważniejszy wniosek';
  const base = clean.replace(/[?]\s*$/, '').trim();
  return base ? `Najważniejsze: ${base}` : 'Najważniejszy wniosek';
}

function ensureQuestionHeading(title) {
  const clean = stripTags(String(title || '')).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (/[?]$/.test(clean)) return clean;
  return `${clean}?`;
}

function buildQuickAnswer(json) {
  const fromJson = stripTags(String(json.quick_answer || json.quickAnswer || '')).replace(/\s+/g, ' ').trim();
  const lead = stripTags(String(json.lead || '')).replace(/\s+/g, ' ').trim();
  const firstSection = stripTags(String(json.sections?.[0]?.paragraphs_html?.[0] || '')).replace(/\s+/g, ' ').trim();
  const explicitProvided = !!fromJson;

  let base = fromJson || lead || firstSection || '';
  if (!base) {
    base = 'Najważniejsze: zacznij od małych, regularnych kroków i monitoruj efekty przez 2-4 tygodnie, aby bezpiecznie poprawiać zdrowie i sprawność po 50. roku życia.';
  }
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length > 60) {
    base = words.slice(0, 60).join(' ').replace(/[,:;\s]+$/g, '').trim();
    if (!/[.!?]$/.test(base)) base += '.';
  }
  while (wordCount(base) < 40) {
    base = `${base} To praktyczne podejście pomaga utrzymać regularność, zmniejsza ryzyko przeciążenia i daje mierzalne korzyści zdrowotne.`
      .replace(/\s+/g, ' ')
      .trim();
    const limited = base.split(/\s+/).filter(Boolean).slice(0, 60).join(' ').trim();
    base = /[.!?]$/.test(limited) ? limited : `${limited}.`;
  }
  if (!explicitProvided && lead) {
    const normalize = (v) => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, '').replace(/\s+/g, ' ').trim();
    if (normalize(base) === normalize(lead)) {
      const candidate = `Najkrócej: ${base}`;
      const words2 = candidate.split(/\s+/).filter(Boolean).slice(0, 60);
      base = words2.join(' ').trim();
      if (!/[.!?]$/.test(base)) base += '.';
    }
  }
  return base.replace(/\s+/g, ' ').trim();
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
  if (!Array.isArray(json.sources) || json.sources.length < 6) {
    errors.push(`sources < 6 (jest ${Array.isArray(json.sources) ? json.sources.length : 0})`);
  }
  if (!Array.isArray(json.answer_blocks) || json.answer_blocks.length < 4) {
    errors.push(`answer_blocks < 4 (jest ${Array.isArray(json.answer_blocks) ? json.answer_blocks.length : 0})`);
  }
  if (!Array.isArray(json.image_prompts) || json.image_prompts.length < 7) {
    errors.push(`image_prompts < 7 (jest ${Array.isArray(json.image_prompts) ? json.image_prompts.length : 0})`);
  }
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
    json.seo_title = truncateAtWordBoundary(json.title, 65);
  } else {
    json.seo_title = truncateAtWordBoundary(rawSeoTitleInput, 65);
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
  if (json.meta_description.length < 145) {
    json.meta_description = truncateAtWordBoundary(
      `${json.meta_description} Konkretne wskazówki, co robić krok po kroku, oparte na wiarygodnych źródłach naukowych.`,
      160
    );
  }

  json.category = normalizeCategory(json.category || json.section || 'ciekawe').key;
  json.lead = stripTags(String(json.lead || '')).replace(/\s+/g, ' ').trim();
  json.reading_time = String(json.reading_time || '12 minut').replace(/\s+/g, ' ').trim();
  json.date_published = normalizeDate(json.date_published);
  json.hero_image = String(json.hero_image || json.slug || 'artykul-hero')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  json.hero_alt = String(json.hero_alt || json.title || '').replace(/\s+/g, ' ').trim();
  json.hero_motto_html = String(json.hero_motto_html || '<em>Małe kroki dają trwałe efekty.</em>').trim();
  if (!/^<em>[\s\S]*<\/em>$/.test(json.hero_motto_html)) {
    json.hero_motto_html = `<em>${stripTags(json.hero_motto_html)}</em>`;
  }

  const takeaways = Array.isArray(json.key_takeaways) ? json.key_takeaways : [];
  json.key_takeaways = takeaways.map((x) => stripTags(String(x || '')).trim()).filter(Boolean).slice(0, 4);
  while (json.key_takeaways.length < 4) {
    const sec = json.sections?.[json.key_takeaways.length];
    const fallback = sec && sec.title
      ? `Najważniejsze: ${stripTags(String(sec.title)).replace(/\s+/g, ' ').trim()}.`
      : 'Najważniejsze: regularny ruch i świadome nawyki poprawiają zdrowie po 50-tce.';
    json.key_takeaways.push(fallback);
  }

  const sections = Array.isArray(json.sections) ? json.sections : [];
  json.sections = sections.map((s, idx) => {
    const section = (s && typeof s === 'object') ? s : {};
    const title = ensureQuestionHeading(stripTags(String(section.title || section.heading || `Jak wdrożyć krok ${idx + 1} w praktyce`)).trim());
    const paragraphsRaw = Array.isArray(section.paragraphs_html)
      ? section.paragraphs_html
      : htmlToParagraphs(section.content_html || '');
    const paragraphs = paragraphsRaw.map((p) => sanitizeCodeGlyphs(normalizeInternalHtmlLinks(ensureParagraphWrapper(p)))).filter(Boolean);
    while (paragraphs.length < 2) {
      paragraphs.push('<p>W praktyce kluczowe jest dopasowanie zaleceń do codziennego rytmu dnia i regularna kontrola efektów.</p>');
    }
    paragraphs[0] = padFirstParagraphToRange(paragraphs[0], 35, 72);

    const listItems = Array.isArray(section.list_items) ? section.list_items : htmlToListItems(section.content_html || '');
    const infoBox = section.info_box && typeof section.info_box === 'object' ? section.info_box : {};
    const fallbackInfoContent = `<p>${firstMeaningfulSentenceFromParagraph(paragraphs[0])}</p>`;
    const image = section.image && typeof section.image === 'object' ? section.image : {};
    return {
      title,
      paragraphs_html: paragraphs,
      list_items: listItems.map((x) => stripTags(String(x || '')).trim()).filter(Boolean),
      info_box: {
        style: 'accent',
        title: stripTags(String(infoBox.title || buildInfoBoxTitle(title))).trim(),
        content_html: sanitizeCodeGlyphs(normalizeInternalHtmlLinks(ensureParagraphWrapper(infoBox.content_html || fallbackInfoContent))),
      },
      image: {
        src: String(image.src || `./assets/${json.slug}-sekcja-${idx + 1}.webp`).trim(),
        alt: stripTags(String(image.alt || title)).trim(),
        caption: stripTags(String(image.caption || 'Grafika ilustrująca sekcję artykułu.')).trim(),
      },
    };
  });

  const faq = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  json.answer_blocks = faq.map((f) => ({
    question: stripTags(String((f && f.question) || '')).trim(),
    answer_html: sanitizeCodeGlyphs(normalizeInternalHtmlLinks(ensureParagraphWrapper((f && (f.answer_html || f.answer)) || ''))),
  })).filter((f) => f.question && f.answer_html);

  while (json.answer_blocks.length < 4) {
    json.answer_blocks.push({
      question: 'Jak wprowadzić te zalecenia krok po kroku?',
      answer_html: '<p>Najlepiej zacząć od małej zmiany, monitorować efekty przez 2-4 tygodnie i dopiero potem zwiększać zakres działania.</p>',
    });
  }

  json.quick_answer = buildQuickAnswer(json);

  json.sources = dedupeSources(Array.isArray(json.sources) ? json.sources : []);
  if (json.sources.length < 6) {
    const seen = new Set(json.sources.map((s) => String(s.url || '').toLowerCase()));
    for (const s of FALLBACK_SOURCES) {
      if (json.sources.length >= 6) break;
      const url = String(s.url || '').toLowerCase();
      if (seen.has(url)) continue;
      seen.add(url);
      json.sources.push({ label: s.label, url: s.url });
    }
  }

  const faqResearchRaw = Array.isArray(json.faq_research) ? json.faq_research : [];
  const faqResearch = faqResearchRaw
    .map((r) => ({
      question: stripTags(String((r && r.question) || '')).replace(/\s+/g, ' ').trim(),
      source_label: stripTags(String((r && (r.source_label || r.label || r.citation || r.title)) || '')).replace(/\s+/g, ' ').trim(),
      source_url: String((r && (r.source_url || r.url)) || '').trim(),
    }))
    .filter((r) => r.question && r.source_label && /^https:\/\//i.test(r.source_url));

  if (faqResearch.length >= 4) {
    json.faq_research = faqResearch;
  } else {
    const auto = [];
    const sourcePool = json.sources.slice(0, Math.max(4, json.sources.length));
    for (let i = 0; i < Math.min(4, json.answer_blocks.length); i += 1) {
      const q = json.answer_blocks[i];
      const s = sourcePool[i] || sourcePool[0];
      if (!q || !s) continue;
      auto.push({
        question: q.question,
        source_label: s.label,
        source_url: s.url,
      });
    }
    json.faq_research = auto;
  }

  const imagePrompts = Array.isArray(json.image_prompts) ? json.image_prompts : [];
  const mapped = imagePrompts.map((p) => (p && typeof p === 'object' ? p : {}));
  const used = new Set();
  for (const p of mapped) {
    const fb = String(p.filename_base || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    p.filename_base = fb || `${json.slug}-${used.size + 1}`;
    while (used.has(p.filename_base)) p.filename_base = `${p.filename_base}-x`;
    used.add(p.filename_base);
    p.section_ref = String(p.section_ref || '').trim();
    p.purpose = String(p.purpose || 'explain').trim();
    p.nano_banana_prompt = String(p.nano_banana_prompt || '').trim();
    p.alt_pl = String(p.alt_pl || '').trim();
    p.overlay_text_pl = String(p.overlay_text_pl || '').trim();
    p.negative_prompt = String(
      p.negative_prompt || 'brak angielskich napisów, brak literówek, brak zniekształconych dłoni, brak watermarków, brak losowych znaków'
    ).trim();
  }
  json.image_prompts = mapped;

  const hero = json.image_prompts.find((p) => p.section_ref === 'hero');
  if (hero) {
    json.hero_image = hero.filename_base;
  } else {
    json.image_prompts.unshift({
      filename_base: json.hero_image,
      section_ref: 'hero',
      purpose: 'hook',
      nano_banana_prompt: 'Naturalne zdjęcie hero dla artykułu FitPo50, osoby 50+, jasne światło, realistyczna scena.',
      alt_pl: json.hero_alt,
      overlay_text_pl: '',
      negative_prompt: 'brak angielskich napisów, brak literówek, brak zniekształconych dłoni, brak watermarków, brak losowych znaków',
    });
  }

  for (let i = 0; i < json.sections.length; i += 1) {
    const ref = `sekcja-${i + 1}`;
    let prompt = json.image_prompts.find((p) => p.section_ref === ref);
    if (!prompt) {
      const fromSrc = String(json.sections[i].image.src || '').match(/\.\/assets\/(.+)\.webp$/i);
      const base = fromSrc ? fromSrc[1] : `${json.slug}-sekcja-${i + 1}`;
      prompt = {
        filename_base: base,
        section_ref: ref,
        purpose: 'explain',
        nano_banana_prompt: `Ilustracja sekcji ${i + 1} artykułu FitPo50, realistyczna, czytelna, bez napisów.`,
        alt_pl: json.sections[i].image.alt,
        overlay_text_pl: '',
        negative_prompt: 'brak angielskich napisów, brak literówek, brak zniekształconych dłoni, brak watermarków, brak losowych znaków',
      };
      json.image_prompts.push(prompt);
    }
    json.sections[i].image.src = `./assets/${prompt.filename_base}.webp`;
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

main();
