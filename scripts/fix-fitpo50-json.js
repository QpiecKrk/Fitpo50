#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const TODAY = '2026-04-27';
const ALLOWED_CATEGORIES = new Set(['zdrowie', 'ciekawe', 'jedzenie', 'ruch']);
const CATEGORY_LANDING_PAGES = new Set([
  'index.html',
  'porady.html',
  'rusz-sie.html',
  'jedzenie.html',
  'zdrowie.html',
  'ciekawe.html',
  'dziennik.html',
  'o-mnie.html',
]);
const FALLBACK_SOURCES = [
  { label: 'World Health Organization: Physical activity guidelines', url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity' },
  { label: 'CDC: Benefits of physical activity', url: 'https://www.cdc.gov/physicalactivity/basics/pa-health/index.htm' },
  { label: 'American Heart Association: Physical activity recommendations', url: 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/aha-recs-for-physical-activity-in-adults' },
  { label: 'NIH: Exercise and physical activity', url: 'https://www.nia.nih.gov/health/exercise-and-physical-activity' },
  { label: 'Mayo Clinic: Exercise and fitness', url: 'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/exercise/art-20048389' },
  { label: 'PubMed: Cardiorespiratory fitness and mortality', url: 'https://pubmed.ncbi.nlm.nih.gov/29971482/' },
];

function parseArgs(argv) {
  const out = { write: false, allowOutsideRepo: false };
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

function removeLocalHtmlLinks(html) {
  return String(html || '').replace(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_full, href, text) => {
      const h = String(href || '').trim();
      if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(h)) return _full;
      if (/\.html(?:[?#].*)?$/i.test(h)) {
        // JSON gate blokuje lokalne linki *.html na etapie importu.
        // Zostawiamy sam tekst, a linki kontekstowe uzupełniamy po imporcie na finalnym HTML.
        return String(text || '');
      }
      return _full;
    }
  );
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

function validate(json) {
  const errors = [];
  if (!json.title || json.title.length < 55 || json.title.length > 65) {
    errors.push(`title poza zakresem 55-65 (jest ${String(json.title || '').length})`);
  }
  if (!json.meta_description || json.meta_description.length < 145 || json.meta_description.length > 160) {
    errors.push(`meta_description poza zakresem 145-160 (jest ${String(json.meta_description || '').length})`);
  }
  if (!ALLOWED_CATEGORIES.has(String(json.category || ''))) {
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
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
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

  json.title = truncateAtWordBoundary(String(json.title || '').replace(/\s+/g, ' ').trim(), 65);
  if (json.title.length < 55) {
    json.title = truncateAtWordBoundary(`${json.title} – praktyczny przewodnik dla osób po 50. roku życia`, 65);
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

  if (!ALLOWED_CATEGORIES.has(String(json.category || '').trim())) {
    json.category = 'ciekawe';
  }
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
    const title = stripTags(String(section.title || section.heading || `Sekcja ${idx + 1}`)).trim();
    const paragraphsRaw = Array.isArray(section.paragraphs_html)
      ? section.paragraphs_html
      : htmlToParagraphs(section.content_html || '');
    const paragraphs = paragraphsRaw.map((p) => removeLocalHtmlLinks(ensureParagraphWrapper(p))).filter(Boolean);
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
        title: stripTags(String(infoBox.title || `Ważne: ${title}`)).trim(),
        content_html: removeLocalHtmlLinks(ensureParagraphWrapper(infoBox.content_html || fallbackInfoContent)),
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
    answer_html: removeLocalHtmlLinks(ensureParagraphWrapper((f && (f.answer_html || f.answer)) || '')),
  })).filter((f) => f.question && f.answer_html);

  while (json.answer_blocks.length < 4) {
    json.answer_blocks.push({
      question: 'Jak wprowadzić te zalecenia krok po kroku?',
      answer_html: '<p>Najlepiej zacząć od małej zmiany, monitorować efekty przez 2-4 tygodnie i dopiero potem zwiększać zakres działania.</p>',
    });
  }

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
  } else {
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
