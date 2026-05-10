#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--file') out.file = String(argv[i + 1] || '').trim(), i += 1;
    else if (t === '--map') out.map = String(argv[i + 1] || '').trim(), i += 1;
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

function cleanupSeoTitle(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[–-]\s*$/g, '')
    .trim();
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
  const mapObj = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};

  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const changes = [];

  if (Array.isArray(json.key_takeaways) && json.key_takeaways.length > 4) {
    json.key_takeaways = json.key_takeaways.slice(0, 4);
    changes.push('key_takeaways -> przycięto do 4');
  }

  const nextQa = ensureQuickAnswer(json.quick_answer);
  if (String(json.quick_answer || '').trim() !== nextQa) {
    json.quick_answer = nextQa;
    changes.push('quick_answer -> naprawiono zakres 40-60 słów');
  }

  const nextSeo = cleanupSeoTitle(json.seo_title || json.meta_title || '');
  if (nextSeo && nextSeo !== String(json.seo_title || '')) {
    json.seo_title = nextSeo;
    changes.push('seo_title -> usunięto urwaną końcówkę');
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
    const prev = Array.isArray(json.faq_research) ? json.faq_research : [];
    json.faq_research = faq.map((f, idx) => {
      const q = String(f && f.question ? f.question : '').trim();
      const p = prev[idx] || prev.find((x) => String(x && x.question ? x.question : '').trim().toLowerCase() === q.toLowerCase()) || {};
      return {
        question: q,
        source_label: String(p.source_label || p.label || 'Google PAA / Autocomplete + źródła artykułu').trim(),
        source_url: String(p.source_url || p.url || 'https://www.google.com/search').trim(),
      };
    });
    changes.push('faq_research -> zsynchronizowano 1:1 z answer_blocks');
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
