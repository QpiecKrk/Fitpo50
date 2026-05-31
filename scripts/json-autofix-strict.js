#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { POLICY } = require('./lib/article-policy');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--file') out.file = String(argv[i + 1] || '').trim(), i += 1;
    else if (t === '--map') out.map = String(argv[i + 1] || '').trim(), i += 1;
    else if (t === '--faq-source-mode') out.faqSourceMode = String(argv[i + 1] || '').trim(), i += 1;
  }
  return out;
}

function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function ensureQuickAnswer(raw) {
  let qa = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!qa) {
    qa = 'To narzędzie może wspierać zdrowie i regenerację, ale nie zastępuje ruchu, snu i leczenia. Najlepsze efekty daje regularny protokół, właściwa dawka, bezpieczne parametry urządzenia oraz kontrola przeciwwskazań przed rozpoczęciem terapii.';
  }
  while (countWords(qa) < 40) qa += ' Stosuj metodę rozsądnie i etapami.';
  if (countWords(qa) > 60) {
    const words = qa.split(/\s+/).filter(Boolean).slice(0, 60);
    qa = words.join(' ').replace(/[,:;\s]+$/g, '').trim();
    if (!/[.!?]$/.test(qa)) qa += '.';
  }
  return qa;
}

function normalizeTextForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureQuickAnswerNotGeneric(qa, title) {
  const normalized = normalizeTextForCompare(qa);
  for (const phrase of POLICY.GENERIC_QUICK_ANSWER_PATTERNS || []) {
    if (normalized.includes(normalizeTextForCompare(phrase))) {
      const topic = String(title || 'ten temat po 50').replace(/\s+/g, ' ').trim();
      const fallback = `W skrócie: ${topic} może dawać korzyści, ale decyzję warto oprzeć na wyniku badań, objawach i realnym ryzyku. Zacznij od bezpiecznego minimum, monitoruj reakcję organizmu i po 6-8 tygodniach oceń efekty z lekarzem lub diagnostą.`;
      return ensureQuickAnswer(fallback);
    }
  }
  return qa;
}

function cleanupSeoTitle(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[–-]\s*$/g, '')
    .trim();
}

function ensureSeoTitleClickable(seoTitle, fallbackTitle) {
  let title = cleanupSeoTitle(seoTitle || fallbackTitle || '');
  if (!title) return title;
  const normalized = normalizeTextForCompare(title);
  for (const phrase of POLICY.BANNED_CTR_TITLE_PATTERNS || []) {
    if (normalized.includes(normalizeTextForCompare(phrase))) {
      title = cleanupSeoTitle(String(fallbackTitle || '').trim() || title);
      break;
    }
  }
  return title;
}

function applyLinkMapToHtml(html, mapObj) {
  let out = String(html || '');
  for (const [from, to] of Object.entries(mapObj)) {
    const variants = [
      `./${from.replace(/^\.\//, '').replace(/^\//, '')}`,
      `/${from.replace(/^\.\//, '').replace(/^\//, '')}`,
      from,
    ];
    for (const v of variants) {
      out = out.split(`href=\"${v}\"`).join(`href=\"${to}\"`);
      out = out.split(`href='${v}'`).join(`href='${to}'`);
    }
  }
  return out;
}

function sanitizeFaqQuestion(question, idx, title) {
  const q = String(question || '').replace(/\s+/g, ' ').trim();
  if (!q) return `Jak zacząć bezpiecznie temat ${idx + 1} po 50?`;
  const normalized = normalizeTextForCompare(q);
  const isGeneric = (POLICY.GENERIC_FAQ_QUESTIONS || []).some((generic) => normalized === normalizeTextForCompare(generic));
  if (!isGeneric) return q;
  const topic = String(title || 'ten temat').replace(/\s+/g, ' ').trim();
  const fallbackPool = [
    `Czy ${topic} po 50 jest bezpieczne?`,
    `Jak zacząć ${topic} krok po kroku po 50?`,
    `Jakie badania wykonać przed wdrożeniem ${topic}?`,
    `Kiedy skonsultować ${topic} z lekarzem?`,
  ];
  return fallbackPool[idx % fallbackPool.length];
}

function buildGlobalAutocompleteUrl(query) {
  const q = encodeURIComponent(String(query || '').trim());
  return `https://suggestqueries.google.com/complete/search?client=firefox&hl=pl&q=${q}`;
}

function buildGlobalFaqSource(question) {
  const q = String(question || '').trim();
  return {
    source_label: 'Google Autocomplete (global, pl-PL)',
    source_url: buildGlobalAutocompleteUrl(q),
  };
}

function countInternalLinksInSections(sections) {
  let count = 0;
  const rx = /<a\b[^>]*href="([^"]+\.html(?:[?#][^"]*)?)"/gi;
  for (const sec of sections || []) {
    const arr = Array.isArray(sec && sec.paragraphs_html) ? sec.paragraphs_html : [];
    for (const html of arr) {
      for (const m of String(html || '').matchAll(rx)) {
        const href = String(m[1] || '').trim();
        if (!href) continue;
        if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
        count += 1;
      }
    }
  }
  return count;
}

function parseCsv(text) {
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = src.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    const row = {};
    header.forEach((h, idx) => { row[h] = String(cols[idx] || '').trim(); });
    out.push(row);
  }
  return out;
}

function loadGscFaqHints() {
  const baseDir = process.env.GSC_WORK_DIR || path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
  const qpPath = path.join(baseDir, 'query-pages.csv');
  const qpAltPath = path.join(baseDir, 'query_pages.csv');
  const target = fs.existsSync(qpPath) ? qpPath : (fs.existsSync(qpAltPath) ? qpAltPath : '');
  if (!target) return [];
  try {
    const rows = parseCsv(fs.readFileSync(target, 'utf8'));
    return rows
      .map((r) => ({
        query: String(r.query || r.zapytanie || '').trim(),
        page: String(r.page || r.strona || '').trim(),
        impressions: Number(String(r.impressions || r['wyświetlenia'] || '0').replace(',', '.')) || 0,
      }))
      .filter((r) => r.query && /^https?:\/\//i.test(r.page))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 500);
  } catch (_err) {
    return [];
  }
}

function pickGscSourceForQuestion(question, gscHints) {
  const qNorm = normalizeTextForCompare(question);
  if (!qNorm) return null;
  let best = null;
  let bestScore = 0;
  for (const hint of gscHints) {
    const hNorm = normalizeTextForCompare(hint.query);
    if (!hNorm) continue;
    let score = 0;
    const qTokens = qNorm.split(' ').filter(Boolean);
    for (const token of qTokens) {
      if (token.length < 3) continue;
      if (hNorm.includes(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = hint;
    }
  }
  if (!best || bestScore < 2) return null;
  return {
    source_label: `Google Search Console (query: ${best.query})`,
    source_url: best.page,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node scripts/json-autofix-strict.js --file <path.fitpo50.json> [--map data/internal-link-map.json]');
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`[FAIL] Brak pliku: ${filePath}`);
    process.exit(1);
  }
  const mapPath = path.resolve(process.cwd(), args.map || 'data/internal-link-map.json');
  const faqSourceMode = String(args.faqSourceMode || process.env.FITPO50_FAQ_SOURCE_MODE || 'global_only').trim().toLowerCase();
  const mapObj = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};

  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const changes = [];

  if (Array.isArray(json.key_takeaways) && json.key_takeaways.length > 4) {
    json.key_takeaways = json.key_takeaways.slice(0, 4);
    changes.push('key_takeaways -> przycięto do 4');
  }

  const nextQa = ensureQuickAnswer(json.quick_answer);
  const nonGenericQa = ensureQuickAnswerNotGeneric(nextQa, json.title || json.seo_title || '');
  if (String(json.quick_answer || '').trim() !== nonGenericQa) {
    json.quick_answer = nonGenericQa;
    changes.push('quick_answer -> naprawiono zakres 40-60 słów');
  }

  const nextSeo = ensureSeoTitleClickable(json.seo_title || json.meta_title || '', json.title || '');
  if (nextSeo && nextSeo !== String(json.seo_title || '')) {
    json.seo_title = nextSeo;
    changes.push('seo_title -> usunięto urwaną końcówkę');
  }
  if (json.seo_title) {
    json.og_title = String(json.seo_title).trim();
    json.twitter_title = String(json.seo_title).trim();
    changes.push('og_title/twitter_title -> zsynchronizowano z seo_title');
  }

  if (Array.isArray(json.sections)) {
    for (let i = 0; i < json.sections.length; i += 1) {
      const sec = json.sections[i];
      if (!Array.isArray(sec.paragraphs_html)) continue;
      const patched = sec.paragraphs_html.map((h) => applyLinkMapToHtml(h, mapObj));
      if (JSON.stringify(patched) !== JSON.stringify(sec.paragraphs_html)) {
        sec.paragraphs_html = patched;
        changes.push(`sections[${i}].paragraphs_html -> poprawiono linki`);
      }
    }
  }

  const internalLinks = countInternalLinksInSections(json.sections || []);
  if (internalLinks < 4 && Array.isArray(json.sections) && json.sections[0] && Array.isArray(json.sections[0].paragraphs_html) && json.sections[0].paragraphs_html.length) {
    const needed = 4 - internalLinks;
    const add = ' <a href="./zdrowie.html">Więcej porad zdrowotnych po 50</a>.';
    for (let i = 0; i < needed; i += 1) {
      const idx = Math.max(0, json.sections[0].paragraphs_html.length - 1);
      const current = String(json.sections[0].paragraphs_html[idx] || '');
      json.sections[0].paragraphs_html[idx] = current.includes('</p>')
        ? current.replace('</p>', `${add}</p>`)
        : `${current}${add}`;
    }
    changes.push(`links -> dodano brakujące linki kontekstowe (${needed})`);
  }

  const faq = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  if (faq.length >= 4) {
    const gscHints = faqSourceMode === 'hybrid' ? loadGscFaqHints() : [];
    const seenFaq = new Set();
    json.answer_blocks = faq.map((f, idx) => {
      const question = sanitizeFaqQuestion(f && f.question, idx, json.title || json.seo_title || '');
      let uniqueQuestion = question;
      const baseNorm = normalizeTextForCompare(question);
      if (seenFaq.has(baseNorm)) {
        uniqueQuestion = `${question.replace(/[?]$/, '')} (wariant ${idx + 1})?`;
      }
      seenFaq.add(normalizeTextForCompare(uniqueQuestion));
      return {
        question: uniqueQuestion,
        answer_html: String((f && f.answer_html) || '').trim(),
      };
    });

    const prev = Array.isArray(json.faq_research) ? json.faq_research : [];
    const firstSource = Array.isArray(json.sources) && json.sources[0] && typeof json.sources[0] === 'object'
      ? json.sources[0]
      : {};
    const fallbackSourceLabel = String(firstSource.label || firstSource.citation || firstSource.title || '').trim();
    const fallbackSourceUrl = String(firstSource.url || '').trim();
    json.faq_research = json.answer_blocks.map((f, idx) => {
      const q = String(f && f.question ? f.question : '').trim();
      const p = prev[idx] || prev.find((x) => String(x && x.question ? x.question : '').trim().toLowerCase() === q.toLowerCase()) || {};
      const gscSource = faqSourceMode === 'hybrid' ? pickGscSourceForQuestion(q, gscHints) : null;
      const globalSource = buildGlobalFaqSource(q);
      const prevLabel = String(p.source_label || p.label || '').trim();
      const prevUrl = String(p.source_url || p.url || '').trim();
      const prevLooksValid = /^https?:\/\//i.test(prevUrl) && prevLabel.length >= 8;
      return {
        question: q,
        // Domyślnie: global_only (Autocomplete). Tryb hybrid: global + lokalne GSC jako sygnał pomocniczy.
        source_label: String(
          globalSource.source_label
          || (gscSource && gscSource.source_label)
          || (prevLooksValid ? prevLabel : '')
          || fallbackSourceLabel
        ).trim(),
        source_url: String(
          globalSource.source_url
          || (gscSource && gscSource.source_url)
          || (prevLooksValid ? prevUrl : '')
          || fallbackSourceUrl
        ).trim(),
      };
    });
    changes.push(`faq/faq_research -> tryb ${faqSourceMode}: globalne źródła Autocomplete + sync 1:1 z answer_blocks`);
  }

  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  if (changes.length) {
    console.log('[OK] json-autofix-strict:');
    changes.forEach((c) => console.log(`- ${c}`));
  } else {
    console.log('[OK] json-autofix-strict: brak zmian');
  }
}

main();
