#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectArticlePackage } = require('./article-package-intake');
const { validateArticleEvidence } = require('./lib/article-evidence');
const { inspectImage } = require('./lib/article-media');
const { packageIdentity } = require('./lib/package-identity');

const ROOT = path.resolve(__dirname, '..');
const OWNERS = Object.freeze({ WRITER: 'PISARZ', ILLUSTRATOR: 'ILUSTRATOR', CODEX: 'CODEX' });
const EXIT = Object.freeze({ READY: 0, CONTENT: 20, ENVIRONMENT: 30 });
const TOP_LEVEL_FIELDS = new Set([
  'answer_blocks', 'category', 'editorial_notes', 'evidence_claims', 'faq_research', 'hero_motto_html',
  'image_prompts_v4', 'key_takeaways', 'lead', 'listing_desc', 'listing_title', 'logic_links',
  'meta_description', 'og_description', 'og_title', 'primary_keyword', 'quick_answer', 'reading_time',
  'schema_blogposting_description', 'search_intent', 'sections', 'seo_title', 'slug', 'sources', 'status',
  'supporting_keywords', 'title', 'twitter_description', 'twitter_title', 'myth_claim',
]);
const REQUIRED_TEXT_FIELDS = [
  'title', 'seo_title', 'og_title', 'twitter_title', 'slug', 'category', 'meta_description',
  'og_description', 'twitter_description', 'schema_blogposting_description', 'listing_title',
  'listing_desc', 'lead', 'quick_answer', 'reading_time', 'hero_motto_html', 'search_intent', 'primary_keyword',
];
const ARRAY_FIELD_CONTRACTS = Object.freeze({
  sections: new Set(['title', 'section_role', 'paragraphs_html']),
  sources: new Set(['id', 'label', 'url', 'evidence_level', 'fallback_url', 'evidence_scope', 'publication_date', 'publication_year', 'checked_via', 'recheck_after', 'checked_at', 'url_status', 'http_status', 'doi_or_pmid']),
  evidence_claims: new Set(['claim', 'location', 'claim_type', 'source_urls']),
  answer_blocks: new Set(['question', 'answer_html']),
  faq_research: new Set(['question', 'source_type', 'source_label', 'source_url', 'research_note', 'checked_at', 'url_status', 'http_status']),
  image_prompts_v4: new Set(['section_ref', 'filename_base', 'source_file', 'topic', 'technique', 'composition', 'purpose', 'season_and_time', 'mood', 'aspect_ratio', 'prompt_en', 'overlay_text_pl', 'evidence_source_urls', 'requires_exact_data_render', 'negative_prompt', 'alt_pl', 'caption_pl', 'visual_review', 'overlay_claims']),
});
const NESTED_TEXT_FIELDS = Object.freeze({
  sections: ['title'],
  sources: ['id', 'label', 'url'],
  evidence_claims: ['claim', 'location', 'claim_type'],
  answer_blocks: ['question', 'answer_html'],
  faq_research: ['question', 'source_type', 'source_label', 'source_url'],
  image_prompts_v4: ['section_ref', 'filename_base', 'source_file', 'topic', 'technique', 'composition', 'purpose', 'aspect_ratio', 'prompt_en', 'alt_pl', 'caption_pl'],
});

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (!token.startsWith('--')) continue;
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[token.slice(2)] = true;
    else { out[token.slice(2)] = next; index += 1; }
  }
  return out;
}

function jsonPathFromMessage(message) {
  const match = String(message).match(/\b(sources|evidence_claims|answer_blocks|faq_research|image_prompts_v4|sections)\[(\d+)\](?:\.([a-zA-Z0-9_]+))?/);
  if (match) return `/${match[1]}/${match[2]}${match[3] ? `/${match[3]}` : ''}`;
  const field = String(message).match(new RegExp(`\\b(${[...TOP_LEVEL_FIELDS].join('|')})\\b`));
  return field ? `/${field[1]}` : '/';
}

function issue(owner, check, code, message, options = {}) {
  return {
    owner,
    check,
    code,
    status: 'ERROR',
    path: options.path || jsonPathFromMessage(message),
    message: String(message),
    fix: options.fix || (owner === OWNERS.CODEX ? 'Codex wykonuje deterministyczną poprawkę techniczną.' : 'Uzupełnij wskazane pole zgodnie z komunikatem.'),
    ...(options.proposedChange ? { proposed_change: options.proposedChange } : {}),
    ...(options.prompt ? { illustrator_prompt: options.prompt } : {}),
  };
}

function uniqueIssues(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.owner}|${item.path}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contractIssues(article) {
  const out = [];
  for (const key of Object.keys(article || {})) {
    if (!TOP_LEVEL_FIELDS.has(key)) out.push(issue(OWNERS.WRITER, 'CONTRACT_V2', 'FIELD_OUTSIDE_CONTRACT', `Pole ${key} jest poza kontraktem draftu v2.`, { path: `/${key}`, fix: `Usuń pole ${key}; lokalne pola tworzy pipeline.` }));
  }
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (article?.[field] === null) out.push(issue(OWNERS.CODEX, 'CONTRACT_V2', 'NULL_TEXT_FIELD', `${field} ma null zamiast tekstu.`, {
      path: `/${field}`,
      fix: `Codex może znormalizować null do pustego tekstu; brak właściwej treści nadal osobno wraca do Pisarza.`,
      proposedChange: { operation: 'replace', path: `/${field}`, before: null, after: '' },
    }));
  }
  for (const [collection, allowed] of Object.entries(ARRAY_FIELD_CONTRACTS)) {
    (Array.isArray(article?.[collection]) ? article[collection] : []).forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      for (const key of Object.keys(entry)) {
        if (collection === 'evidence_claims' && key === 'text' && !('claim' in entry)) continue;
        if (!allowed.has(key)) out.push(issue(OWNERS.WRITER, 'CONTRACT_V2', 'FIELD_OUTSIDE_CONTRACT', `${collection}[${index}].${key} jest poza kontraktem draftu v2.`, { path: `/${collection}/${index}/${key}`, fix: `Usuń pole ${key} z ${collection}[${index}].` }));
      }
      for (const key of NESTED_TEXT_FIELDS[collection] || []) {
        if (entry[key] === null) out.push(issue(OWNERS.CODEX, 'CONTRACT_V2', 'NULL_TEXT_FIELD', `${collection}[${index}].${key} ma null zamiast tekstu.`, {
          path: `/${collection}/${index}/${key}`,
          fix: 'Codex może znormalizować null do pustego tekstu; brak właściwej treści nadal osobno wraca do Pisarza.',
          proposedChange: { operation: 'replace', path: `/${collection}/${index}/${key}`, before: null, after: '' },
        }));
      }
    });
  }
  (Array.isArray(article?.evidence_claims) ? article.evidence_claims : []).forEach((claim, index) => {
    if (claim && typeof claim === 'object' && 'text' in claim && !('claim' in claim)) {
      out.push(issue(OWNERS.CODEX, 'CONTRACT_V2', 'TEXT_INSTEAD_OF_CLAIM', `evidence_claims[${index}] używa text zamiast claim.`, {
        path: `/evidence_claims/${index}/text`,
        fix: 'Codex może bez zmiany treści przemianować klucz text na claim.',
        proposedChange: { operation: 'rename_key', from: `/evidence_claims/${index}/text`, to: `/evidence_claims/${index}/claim`, value: claim.text },
      }));
    }
  });
  return out;
}

function unitIssues(article) {
  const pattern = /(?:\b(?:oz|ounce|ounces|lb|lbs|pound|pounds|inch|inches|mile|miles)\b|\buncj(?:a|e|i|ę|ą)?\b|\bfunt(?:a|y|ów)?\b|\bcal(?:a|e|i)?\b|\bmil(?:a|e|i)?\b|°\s*F\b)/giu;
  const out = [];
  function walk(value, pointer) {
    if (typeof value === 'string') {
      const matches = [...value.matchAll(pattern)].map((match) => match[0]);
      if (matches.length) out.push(issue(OWNERS.CODEX, 'EU_UNITS', 'NON_EU_UNIT', `${pointer}: wykryto niedozwolone jednostki: ${[...new Set(matches)].join(', ')}.`, {
        path: pointer,
        fix: 'Codex przygotowuje deterministyczne przeliczenie na jednostki metryczne; propozycja wymaga akceptacji przed zapisem.',
        proposedChange: { operation: 'convert_to_metric', path: pointer, before: value, after: metricProposal(value) },
      }));
    } else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${pointer}/${index}`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${pointer}/${key}`));
  }
  walk(article, '');
  return out;
}

function metricProposal(value) {
  const rounded = (number) => Number(number.toFixed(1)).toLocaleString('pl-PL');
  return String(value)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:lbs|lb|pounds|pound|funt(?:a|y|ów)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 0.45359237)} kg`)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:ounces|ounce|oz|uncj(?:a|e|i|ę|ą)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 28.349523125)} g`)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:inches|inch|cal(?:a|e|i)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 2.54)} cm`)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:miles|mile|mil(?:a|e|i)?)\b/giu, (_all, amount) => `${rounded(Number(String(amount).replace(',', '.')) * 1.609344)} km`)
    .replace(/(\d+(?:[.,]\d+)?)\s*°\s*F\b/giu, (_all, amount) => `${rounded((Number(String(amount).replace(',', '.')) - 32) * 5 / 9)} °C`);
}

function imageIssues(article, assetsDir, dependencies = {}) {
  const out = [];
  const inspect = dependencies.inspectImage || inspectImage;
  const articleSlug = String(article?.slug || '').trim();
  const intake = inspectArticlePackage(article, assetsDir);
  intake.issues.WRITER_FIX_REQUIRED.forEach((message) => {
    const technical = /filename_base|source_file|powtórzony filename_base/iu.test(message);
    out.push(issue(technical ? OWNERS.CODEX : OWNERS.WRITER, 'IMAGE_CONTRACT', technical ? 'IMAGE_FILENAME_CONTRACT' : 'IMAGE_DRAFT_CONTRACT', message, technical ? {
      fix: 'Codex przygotowuje dokładne przemianowanie pól i plików bez zmiany obrazu; propozycja wymaga akceptacji.',
      proposedChange: { operation: 'normalize_image_filename', message },
    } : {}));
  });
  (Array.isArray(article?.image_prompts_v4) ? article.image_prompts_v4 : []).forEach((prompt, index) => {
    const base = String(prompt?.filename_base || '').trim();
    if (articleSlug && base && base !== articleSlug && !base.startsWith(`${articleSlug}-`)) {
      const suggestedBase = `${articleSlug}-${base}`;
      out.push(issue(OWNERS.CODEX, 'IMAGE_CONTRACT', 'IMAGE_FILENAME_OUTSIDE_SLUG', `${base}: filename_base nie należy do sluga ${articleSlug}.`, {
        path: `/image_prompts_v4/${index}/filename_base`,
        fix: 'Codex może przemianować bazę, source_file i istniejące warianty bez zmiany zawartości obrazów.',
        proposedChange: { operation: 'rename_image_set', from: base, to: suggestedBase },
      }));
    }
  });
  intake.issues.ILLUSTRATOR_FIX_REQUIRED.forEach((message) => {
    const prompt = (article.image_prompts_v4 || []).find((item) => message.includes(String(item?.filename_base || '')));
    const base = String(prompt?.filename_base || '').trim();
    const missingName = String(message).match(/brak\s+([^\s]+\.(?:jpg|webp|avif))/iu)?.[1] || '';
    const available = ['jpg', 'webp', 'avif'].map((extension) => `${base}.${extension}`)
      .filter((name) => base && fs.existsSync(path.join(assetsDir, name)));
    const convertible = Boolean(missingName && available.length);
    out.push(issue(convertible ? OWNERS.CODEX : OWNERS.ILLUSTRATOR, 'IMAGE_FILES', convertible ? 'IMAGE_FORMAT_MISSING' : 'IMAGE_FILE_MISSING', message, convertible ? {
      fix: `Codex może utworzyć ${missingName} z istniejącego zatwierdzonego wariantu ${available[0]} bez zmiany kadru lub treści.`,
      proposedChange: { operation: 'convert_image', from: available[0], to: missingName },
    } : {
      fix: 'Ilustrator dostarcza brakujący obraz źródłowy i komplet wariantów bez zmiany zatwierdzonych danych.',
      prompt: prompt?.prompt_en || `Create the missing exact-format variant for ${prompt?.filename_base || 'the declared article image'}; preserve composition, factual overlay and aspect ratio.`,
    }));
  });
  for (let index = 0; index < (article.image_prompts_v4 || []).length; index += 1) {
    const prompt = article.image_prompts_v4[index] || {};
    const base = String(prompt.filename_base || '');
    const metadata = [];
    for (const extension of ['jpg', 'webp', 'avif']) {
      const file = path.join(assetsDir, `${base}.${extension}`);
      if (!base || !fs.existsSync(file)) continue;
      try { metadata.push({ extension, ...inspect(file) }); }
      catch (error) {
        out.push(issue(OWNERS.CODEX, 'IMAGE_DIMENSIONS', 'IMAGE_UNREADABLE', `${base}.${extension}: ${error.message || error}`, {
          path: `/image_prompts_v4/${index}`,
          fix: 'Codex może ponownie zakodować wariant z istniejącego zatwierdzonego mastera; jeśli master także jest uszkodzony, zadanie wraca do Ilustratora.',
          proposedChange: { operation: 'reencode_image', file: `${base}.${extension}` },
        }));
      }
    }
    if (!metadata.length) continue;
    const reference = metadata[0];
    const minWidth = prompt.section_ref === 'hero' ? 1024 : 800;
    const minHeight = prompt.section_ref === 'hero' ? 560 : 450;
    if (reference.width < minWidth || reference.height < minHeight) {
      out.push(issue(OWNERS.ILLUSTRATOR, 'IMAGE_DIMENSIONS', 'IMAGE_TOO_SMALL', `${base}: ${reference.width}x${reference.height}; minimum ${minWidth}x${minHeight}.`, { path: `/image_prompts_v4/${index}`, prompt: `${prompt.prompt_en || `Regenerate ${base}.`} Output at least ${minWidth}x${minHeight}px; preserve the declared aspect ratio and exact overlay text.` }));
    }
    const ratioMatch = String(prompt.aspect_ratio || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    const declared = ratioMatch ? Number(ratioMatch[1]) / Number(ratioMatch[2]) : 0;
    if (!declared || Math.abs(reference.aspect_ratio - declared) > 0.04 || reference.aspect_ratio < 1.2 || reference.aspect_ratio > 2.1) {
      out.push(issue(OWNERS.ILLUSTRATOR, 'IMAGE_DIMENSIONS', 'IMAGE_BAD_RATIO', `${base}: proporcja ${reference.aspect_ratio} nie zgadza się z ${prompt.aspect_ratio || 'brak deklaracji'} albo layoutem 1.2–2.1.`, { path: `/image_prompts_v4/${index}/aspect_ratio`, prompt: `${prompt.prompt_en || `Regenerate ${base}.`} Use exactly the declared landscape aspect ratio ${prompt.aspect_ratio || '16:9'} without cropping away factual content.` }));
    }
    metadata.slice(1).forEach((item) => {
      if (item.width !== reference.width || item.height !== reference.height) out.push(issue(OWNERS.CODEX, 'IMAGE_DIMENSIONS', 'IMAGE_VARIANT_SIZE_MISMATCH', `${base}: wariant ${item.extension} ma ${item.width}x${item.height}, a ${reference.extension} ${reference.width}x${reference.height}.`, {
        path: `/image_prompts_v4/${index}`,
        fix: `Codex może ponownie wyeksportować ${base}.${item.extension} z zatwierdzonego mastera ${reference.extension} w ${reference.width}x${reference.height}px.`,
        proposedChange: { operation: 'reexport_image_variant', from: `${base}.${reference.extension}`, to: `${base}.${item.extension}`, width: reference.width, height: reference.height },
      }));
    });
  }
  return out;
}

function overlayIssues(article) {
  const out = [];
  const claims = Array.isArray(article.evidence_claims) ? article.evidence_claims : [];
  const numbers = (value) => [...String(value || '').matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(',', '.'));
  (article.image_prompts_v4 || []).forEach((prompt, promptIndex) => {
    if (prompt?.requires_exact_data_render !== true) return;
    (Array.isArray(prompt.overlay_claims) ? prompt.overlay_claims : []).forEach((overlay, claimIndex) => {
      const expected = numbers(overlay?.claim);
      if (!expected.length) return;
      const supporting = claims.some((claim) => (claim?.source_urls || []).includes(overlay?.source_url)
        && expected.every((number) => numbers(claim?.claim).includes(number)));
      if (!supporting) out.push(issue(OWNERS.WRITER, 'OVERLAY_CLAIMS', 'OVERLAY_NUMBER_UNMAPPED', `image_prompts_v4[${promptIndex}].overlay_claims[${claimIndex}]: liczby ${expected.join(', ')} nie mają zgodnego evidence_claim z tym samym źródłem.`, { path: `/image_prompts_v4/${promptIndex}/overlay_claims/${claimIndex}`, fix: 'Uzgodnij liczby na grafice z twierdzeniem w artykule i przypisz ten sam source_url; nie wymyślaj nowych danych.' }));
    });
  });
  return out;
}

function subprocessIssues(file, dependencies = {}) {
  const spawn = dependencies.spawnSync || spawnSync;
  const out = [];
  const python = spawn('python3', ['docs/skills/fitpo50-article-draft/scripts/validate_fitpo50_draft.py', '--allow-verified-review', file], { cwd: ROOT, encoding: 'utf8' });
  if (python.error || python.signal || python.status === null || python.status === undefined) {
    out.push(issue(OWNERS.CODEX, 'DRAFT_VALIDATOR', 'PYTHON_ENVIRONMENT_FAILURE', `Walidator Pythona nie uruchomił się${python.signal ? ` (sygnał ${python.signal})` : ''}: ${python.error?.message || 'brak kodu wyjścia'}.`, { fix: 'Codex naprawia środowisko Pythona; treść nie wraca do Pisarza.' }));
  } else {
    String(`${python.stdout || ''}\n${python.stderr || ''}`).split('\n')
      .filter((line) => line.startsWith('[FAIL] ') && !/errors=\d+/.test(line))
      .forEach((line) => out.push(issue(OWNERS.WRITER, 'DRAFT_VALIDATOR', 'DRAFT_CONTRACT', line.slice(7))));
    if (python.status !== 0 && !out.some((item) => item.check === 'DRAFT_VALIDATOR')) {
      out.push(issue(OWNERS.CODEX, 'DRAFT_VALIDATOR', 'PYTHON_ENVIRONMENT_FAILURE', `Walidator Pythona zakończył się kodem ${python.status} bez diagnostyki kontraktu.`, { fix: 'Codex diagnozuje interpreter lub zależności; nie zmieniaj treści.' }));
    }
  }
  return out;
}

function auditPackage(args, dependencies = {}) {
  if (!args.file) throw new Error('Użycie: npm run package:audit -- --file <draft.fitpo50.json> [--assets-dir <katalog>]');
  const file = path.resolve(args.file);
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(file));
  let article;
  try { article = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    const parseIssue = issue(OWNERS.WRITER, 'JSON_PARSE', 'JSON_PARSE_ERROR', error.message || error, { fix: 'Pisarz eksportuje poprawny składniowo JSON.' });
    return finishReport(file, assetsDir, null, [parseIssue], [
      { check: 'CONTRACT_V2', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
      { check: 'SOURCES_AND_COVERAGE', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
      { check: 'FAQ', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
      { check: 'IMAGE_FILES', status: 'BLOCKED_DEPENDENCY', dependency: 'JSON_PARSE' },
    ], args, dependencies);
  }
  let issues = [...contractIssues(article), ...unitIssues(article), ...imageIssues(article, assetsDir, dependencies), ...overlayIssues(article)];
  const evidence = validateArticleEvidence(article, { allowPendingAutocomplete: true, allowPendingVerification: true });
  evidence.errors.forEach((message) => issues.push(issue(OWNERS.WRITER, /faq/iu.test(message) ? 'FAQ' : 'SOURCES_AND_COVERAGE', 'EVIDENCE_CONTRACT', message)));
  issues.push(...subprocessIssues(file, dependencies));
  return finishReport(file, assetsDir, article, uniqueIssues(issues), [], args, dependencies);
}

function finishReport(file, assetsDir, article, issues, blocked, args, dependencies = {}) {
  const identity = article ? packageIdentity(file, assetsDir, article) : { hash: 'unparseable', entries: [{ path: path.basename(file), sha256: null }] };
  const reportDir = path.resolve(args['report-dir'] || process.env.FITPO50_PACKAGE_AUDIT_DIR || path.join(ROOT, 'data', 'reports', 'local', 'package-audit'));
  const grouped = Object.fromEntries(Object.values(OWNERS).map((owner) => [owner, issues.filter((item) => item.owner === owner)]));
  const environmentFailure = grouped.CODEX.some((item) => item.code.endsWith('ENVIRONMENT_FAILURE'));
  const warnings = (identity.ignored_files || []).map((fileName) => ({
    code: 'IGNORED_FOREIGN_FILE',
    path: fileName,
    message: `Plik nie należy do jawnej paczki artykułu i nie wpływa na SHA-256: ${fileName}`,
  }));
  const proposedChanges = grouped.CODEX.flatMap((item) => item.proposed_change ? [{ path: item.path, code: item.code, ...item.proposed_change }] : []);
  const report = {
    version: 1,
    generated_at: new Date().toISOString(),
    package_sha256: identity.hash,
    package_files: identity.entries,
    input_file: file,
    assets_dir: assetsDir,
    status: environmentFailure ? 'ENVIRONMENT_FAILURE' : (issues.length ? 'BLOCKED' : 'READY_FOR_VISUAL_REVIEW'),
    exit_code: environmentFailure ? EXIT.ENVIRONMENT : (issues.length ? EXIT.CONTENT : EXIT.READY),
    blocked_dependencies: blocked,
    mandatory_visual_review: { status: 'PENDING', scope: 'Wszystkie obrazy we wszystkich formatach AVIF/WebP/JPG, osobny etap tej samej rundy.' },
    by_owner: grouped,
    warnings,
    proposed_changes: proposedChanges,
    summary: { errors: issues.length, warnings: warnings.length, writer: grouped.PISARZ.length, illustrator: grouped.ILUSTRATOR.length, codex: grouped.CODEX.length, blocked_dependency: blocked.length, proposed_changes: proposedChanges.length },
  };
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `${identity.hash}.json`);
  (dependencies.writeFileSync || fs.writeFileSync)(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { ...report, report_file: reportFile };
}

function printReport(report) {
  console.log(`[PACKAGE_AUDIT][${report.status}] sha256=${report.package_sha256}`);
  for (const owner of Object.values(OWNERS)) {
    console.log(`\n[${owner}] ${report.by_owner[owner].length}`);
    report.by_owner[owner].forEach((item) => {
      console.log(`- ${item.path} [${item.code}] ${item.message}`);
      console.log(`  POPRAWKA: ${item.fix}`);
      if (item.illustrator_prompt) console.log(`  PROMPT: ${item.illustrator_prompt}`);
    });
  }
  report.blocked_dependencies.forEach((item) => console.log(`[BLOCKED_DEPENDENCY] ${item.check} <- ${item.dependency}`));
  report.warnings.forEach((item) => console.warn(`[WARNING][${item.code}] ${item.message}`));
  if (report.proposed_changes.length) {
    console.log(`\n[PROPOSED_CHANGES][AWAITING_APPROVAL] ${report.proposed_changes.length}`);
    report.proposed_changes.forEach((item) => console.log(`- ${item.path} [${item.code}] ${JSON.stringify(item)}`));
  }
  console.log(`\n[VISUAL_REVIEW][PENDING] ${report.mandatory_visual_review.scope}`);
  console.log(`[REPORT] ${report.report_file}`);
}

function main() {
  const report = auditPackage(parseArgs(process.argv.slice(2)));
  printReport(report);
  process.exitCode = report.exit_code;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`[PACKAGE_AUDIT][FAIL] ${error.message || error}`); process.exitCode = EXIT.ENVIRONMENT; }
}

module.exports = { EXIT, OWNERS, auditPackage, contractIssues, imageIssues, metricProposal, overlayIssues, parseArgs, printReport, unitIssues };
