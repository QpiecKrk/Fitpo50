#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function text(value) {
  return String(value || '').trim();
}

function normalizedQuestion(value) {
  return text(value).toLocaleLowerCase('pl-PL').replace(/[?!.]+$/u, '').replace(/\s+/gu, ' ');
}

function requiredPlacements(article) {
  const sections = Array.isArray(article.sections) ? article.sections : [];
  return ['hero', ...sections.flatMap((section, index) => (
    text(section?.section_role || 'main').toLowerCase() === 'utility' ? [] : [`sekcja-${index + 1}`]
  ))];
}

function inspectArticlePackage(article, assetsDir) {
  const issues = {
    WRITER_FIX_REQUIRED: [],
    ILLUSTRATOR_FIX_REQUIRED: [],
  };
  const faq = Array.isArray(article?.answer_blocks) ? article.answer_blocks : [];
  const research = Array.isArray(article?.faq_research) ? article.faq_research : [];
  const sourceUrls = new Set((Array.isArray(article?.sources) ? article.sources : [])
    .map((item) => text(item?.url))
    .filter(Boolean));
  if (faq.length !== research.length) {
    issues.WRITER_FIX_REQUIRED.push('answer_blocks i faq_research muszą odpowiadać sobie 1:1.');
  }
  const researchQuestions = research.map((item) => normalizedQuestion(item?.question));
  faq.forEach((item, index) => {
    const question = normalizedQuestion(item?.question);
    if (!question || question !== researchQuestions[index]) {
      issues.WRITER_FIX_REQUIRED.push(`FAQ #${index + 1} nie odpowiada pytaniu faq_research #${index + 1} 1:1.`);
    }
  });
  research.forEach((item, index) => {
    for (const field of ['intent_verified', 'intent_checked_at', 'verified_suggestion']) {
      if (Object.prototype.hasOwnProperty.call(item || {}, field)) {
        issues.WRITER_FIX_REQUIRED.push(`faq_research #${index + 1}: pole ${field} nadaje lokalny pipeline, nie Pisarz.`);
      }
    }
  });

  const prompts = Array.isArray(article?.image_prompts_v4) ? article.image_prompts_v4 : [];
  const required = requiredPlacements(article);
  const placements = prompts.map((item) => text(item?.section_ref));
  required.forEach((placement) => {
    if (placements.filter((item) => item === placement).length !== 1) {
      issues.WRITER_FIX_REQUIRED.push(`image_prompts_v4 wymaga dokładnie jednego wpisu ${placement}.`);
    }
  });
  const seenBases = new Set();
  prompts.forEach((prompt, index) => {
    const base = text(prompt?.filename_base);
    const sourceFile = text(prompt?.source_file);
    const label = base || `image_prompts_v4[${index}]`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9]\d*$/.test(base)) {
      issues.WRITER_FIX_REQUIRED.push(`${label}: filename_base musi być kebab-case i kończyć się -vN.`);
    }
    if (seenBases.has(base)) issues.WRITER_FIX_REQUIRED.push(`${label}: powtórzony filename_base.`);
    if (base) seenBases.add(base);
    if (!base || sourceFile !== `${base}.jpg`) {
      issues.WRITER_FIX_REQUIRED.push(`${label}: source_file musi być dokładnie filename_base + .jpg.`);
    }
    (Array.isArray(prompt?.evidence_source_urls) ? prompt.evidence_source_urls : []).forEach((url) => {
      if (!sourceUrls.has(text(url))) {
        issues.WRITER_FIX_REQUIRED.push(`${label}: evidence_source_urls zawiera URL spoza finalnego sources[]: ${url}`);
      }
    });
    if (!base) return;
    for (const extension of ['jpg', 'webp', 'avif']) {
      const fileName = `${base}.${extension}`;
      if (!fs.existsSync(path.join(assetsDir, fileName))) {
        issues.ILLUSTRATOR_FIX_REQUIRED.push(`${label}: brak ${fileName} w katalogu paczki.`);
      }
    }
  });
  const notes = article?.editorial_notes && typeof article.editorial_notes === 'object' ? article.editorial_notes : {};
  const noteText = JSON.stringify(notes);
  if (/ZNANA FLAGA WALIDATORA|KONFLIKT ZASAD Z WALIDATOREM/iu.test(noteText)) {
    issues.WRITER_FIX_REQUIRED.push('editorial_notes zawiera historyczny konflikt lub znaną flagę walidatora; przekaż wyłącznie aktualny stan zgodny z kontraktem.');
  }
  const localTasks = Array.isArray(notes.local_pipeline_tasks) ? notes.local_pipeline_tasks : [];
  localTasks
    .filter((item) => /uzupełnij FAQ|uzupelnij FAQ|wygeneruj (?:i obejrzyj )?obrazy|podmień URL|podmien URL|napraw dowód|napraw dowod/iu.test(text(item)))
    .forEach((item) => {
      issues.WRITER_FIX_REQUIRED.push(`local_pipeline_tasks przerzuca zadanie Pisarza lub Ilustratora na lokalny pipeline: ${text(item)}`);
    });
  return {
    ok: Object.values(issues).every((items) => items.length === 0),
    issues,
    summary: {
      faq: faq.length,
      prompts: prompts.length,
      required_images: required.length,
      assets_dir: assetsDir,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log('Użycie: node scripts/article-package-intake.js --file <draft.fitpo50.json> [--assets-dir <katalog>]');
    return;
  }
  if (!args.file) throw new Error('Brak --file.');
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw new Error(`Brak JSON-u: ${file}`);
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(file));
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = inspectArticlePackage(article, assetsDir);
  for (const [owner, items] of Object.entries(result.issues)) {
    items.forEach((item) => console.error(`[${owner}] ${item}`));
  }
  if (!result.ok) {
    console.error(`[PACKAGE-INTAKE][FAIL] faq=${result.summary.faq} prompts=${result.summary.prompts} required_images=${result.summary.required_images}`);
    process.exitCode = 2;
    return;
  }
  console.log(`[PACKAGE-INTAKE][PASS] FAQ=${result.summary.faq}; obrazy=${result.summary.prompts}; JPG/WebP/AVIF kompletne.`);
  console.log('[LOCAL_AGENT_PENDING] Linkowanie wewnętrzne, kanibalizacja, media_manifest, visual review, HTML, PDF i publikacja pozostają po stronie dodaj artykuł.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[PACKAGE-INTAKE][FAIL] ${error.message || error}`);
    process.exit(2);
  }
}

module.exports = { inspectArticlePackage, normalizedQuestion, parseArgs, requiredPlacements };
