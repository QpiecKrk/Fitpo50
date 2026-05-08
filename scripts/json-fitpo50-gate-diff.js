#!/usr/bin/env node

const fs = require('fs');
const { spawnSync } = require('child_process');

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
  const out = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--file') {
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

function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function normalizeTextForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectRepeatedLongSentences(chunks) {
  const source = chunks.map((x) => String(x || '')).join(' ');
  const plain = source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const map = new Map();
  for (const sentence of sentences) {
    const norm = normalizeTextForCompare(sentence);
    if (!norm) continue;
    if (countWords(norm) < 8) continue;
    if (norm.length < 45) continue;
    map.set(norm, (map.get(norm) || 0) + 1);
  }
  return [...map.entries()].filter(([, c]) => c >= 3);
}

function isQuestionHeading(text) {
  return String(text || '').trim().endsWith('?');
}

function checkNoLocalHtmlLinks(value, label) {
  const rx = /href\s*=\s*"([^"]+)"/gi;
  const text = String(value || '');
  for (const m of text.matchAll(rx)) {
    const href = String(m[1] || '').trim();
    if (!href) continue;
    if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) continue;
    if (/\.html(?:[?#].*)?$/i.test(href)) {
      errors.push(`${label}: wykryto lokalny link *.html (${href})`);
    }
  }
}

function validateFile(file) {
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

  const keyTakeaways = Array.isArray(json.key_takeaways) ? json.key_takeaways.filter(Boolean) : [];
  if (keyTakeaways.length !== 4) {
    errors.push(`${file}: key_takeaways musi mieć dokładnie 4 elementy (jest ${keyTakeaways.length}).`);
  }

  const quickAnswer = String(json.quick_answer || json.quickAnswer || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const quickAnswerWords = countWords(quickAnswer);
  if (!quickAnswer) {
    errors.push(`${file}: brak quick_answer (wymagane 40-60 słów).`);
  } else if (quickAnswerWords < 40 || quickAnswerWords > 60) {
    errors.push(`${file}: quick_answer poza limitem 40-60 słów (jest ${quickAnswerWords}).`);
  }

  const sections = Array.isArray(json.sections) ? json.sections : [];
  if (sections.length < 6) errors.push(`${file}: sections musi mieć minimum 6 elementów (jest ${sections.length}).`);
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i] || {};
    if (!isQuestionHeading(String(s.title || s.heading || '').trim())) {
      errors.push(`${file}: sections[${i}].title musi być pytaniem zakończonym "?".`);
    }
    const paragraphs = Array.isArray(s.paragraphs_html) ? s.paragraphs_html : [];
    if (paragraphs.length < 2) {
      errors.push(`${file}: sections[${i}] ma mniej niż 2 akapity.`);
      continue;
    }
    const first = String(paragraphs[0] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wc = countWords(first);
    if (wc < 35 || wc > 80) {
      errors.push(`${file}: sections[${i}] pierwszy akapit poza limitem 35-80 słów (jest ${wc}).`);
    }

    if (!s.image || typeof s.image !== 'object') {
      errors.push(`${file}: sections[${i}] brak image.`);
    } else {
      if (!String(s.image.src || '').trim()) errors.push(`${file}: sections[${i}].image.src puste.`);
      if (!String(s.image.alt || '').trim()) errors.push(`${file}: sections[${i}].image.alt puste.`);
      if (!String(s.image.caption || '').trim()) errors.push(`${file}: sections[${i}].image.caption puste.`);
    }

    for (const p of paragraphs) checkNoLocalHtmlLinks(p, `${file}: sections[${i}].paragraphs_html`);
  }

  const faq = Array.isArray(json.answer_blocks) ? json.answer_blocks : [];
  if (faq.length < 4) {
    warnings.push(`${file}: answer_blocks < 4 (uzupełni importer).`);
  }
  const faqResearch = Array.isArray(json.faq_research) ? json.faq_research : [];
  if (faqResearch.length < 4) {
    errors.push(`${file}: faq_research musi mieć minimum 4 wpisy (jest ${faqResearch.length}).`);
  }
  for (let i = 0; i < faq.length; i += 1) {
    checkNoLocalHtmlLinks(faq[i]?.answer_html || '', `${file}: answer_blocks[${i}].answer_html`);
  }

  const sources = Array.isArray(json.sources) ? json.sources : [];
  if (sources.length < 6) {
    errors.push(`${file}: sources musi mieć minimum 6 pozycji (jest ${sources.length}).`);
  }

  const repeated = collectRepeatedLongSentences([
    json.lead || '',
    json.quick_answer || json.quickAnswer || '',
    ...sections.flatMap((s) => Array.isArray(s.paragraphs_html) ? s.paragraphs_html : []),
  ]);
  if (repeated.length) {
    errors.push(`${file}: wykryto powtarzalne zdania (${repeated[0][1]}x): "${repeated[0][0].slice(0, 90)}..."`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let targets = [];
  if (args.files.length) {
    targets = args.files;
  } else {
    const changed = readChangedFiles();
    targets = changed.filter(isFitpoJson);
  }
  if (!targets.length) {
    console.log('[PASS] json:gate:diff - brak zmienionych plików *.fitpo50.json');
    return;
  }

  const normalized = [...new Set(targets.map((f) => String(f || '').trim()).filter(Boolean))];
  for (const file of normalized) {
    if (!fs.existsSync(file)) {
      errors.push(`${file}: plik nie istnieje.`);
      continue;
    }
    validateFile(file);
  }

  if (warnings.length) {
    console.log('\n[WARN]');
    for (const w of warnings) console.log(`- ${w}`);
  }

  if (errors.length) {
    console.log('\n[FAIL] json:gate:diff');
    for (const e of errors) console.log(`- ${e}`);
    process.exit(1);
  }

  console.log(`[PASS] json:gate:diff - sprawdzono pliki: ${normalized.length}`);
}

try {
  main();
} catch (err) {
  console.error(`[FAIL] json:gate:diff -> ${err.message || err}`);
  process.exit(1);
}
