#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  STATUSES,
  markdownReportPathForJson,
  reportPathForJson,
  safeSlug,
  sha256File,
} = require('./lib/article-json-artifact');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = { force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i += 1;
    }
  }
  out.force = String(out.force || 'false').toLowerCase() === 'true';
  return out;
}

function parseJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function allocateOutput(outputDir, slug) {
  fs.mkdirSync(outputDir, { recursive: true });
  let revision = 1;
  while (true) {
    const suffix = revision === 1 ? '' : `-r${revision}`;
    const candidate = path.join(outputDir, `${slug}${suffix}.fitpo50.json`);
    if (!fs.existsSync(candidate) && !fs.existsSync(reportPathForJson(candidate))) return candidate;
    revision += 1;
  }
}

function copyMediaPackage(manifest, sourceDir, targetDir) {
  const names = new Set();
  for (const entry of Array.isArray(manifest?.entries) ? manifest.entries : []) {
    if (entry.source_file) names.add(entry.source_file);
    Object.values(entry.variants || {}).forEach((variant) => {
      if (variant?.file) names.add(variant.file);
    });
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const name of names) {
    if (name !== path.basename(name)) throw new Error(`Niebezpieczna nazwa pliku w media_manifest: ${name}`);
    const source = path.join(sourceDir, name);
    const target = path.join(targetDir, name);
    if (!fs.existsSync(source)) throw new Error(`Brak pliku wskazanego przez media_manifest: ${source}`);
    if (path.resolve(source) !== path.resolve(target)) fs.copyFileSync(source, target);
  }
}

function runStage(label, command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  return {
    label,
    command: [command, ...args],
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exit_code: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function collectChanges(before, after, currentPath = '$', changes = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return changes;
  const beforeObject = before && typeof before === 'object' && !Array.isArray(before);
  const afterObject = after && typeof after === 'object' && !Array.isArray(after);
  if (beforeObject && afterObject) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    keys.forEach((key) => collectChanges(before[key], after[key], `${currentPath}.${key}`, changes));
    return changes;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      collectChanges(before[index], after[index], `${currentPath}[${index}]`, changes);
    }
    return changes;
  }
  changes.push({
    path: currentPath,
    operation: before === undefined ? 'ADD' : (after === undefined ? 'REMOVE' : 'REPLACE'),
    before_type: valueType(before),
    after_type: valueType(after),
    before: before === undefined ? null : before,
    after: after === undefined ? null : after,
  });
  return changes;
}

function preview(value, max = 180) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function writeReports(report, outputFile) {
  const jsonPath = reportPathForJson(outputFile);
  const mdPath = markdownReportPathForJson(outputFile);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const lines = [
    '# FitPo50 — raport przygotowania JSON',
    '',
    `- Status: **${report.status}**`,
    `- Źródło: ${report.source_file}`,
    `- Wynik: ${report.output_file}`,
    `- Slug: ${report.slug || 'MISSING'}`,
    `- force: ${report.force}`,
    `- HTML utworzony: NIE`,
    '',
    '## Przebieg statusów',
    ...report.status_history.map((item) => `- ${item.status}: ${item.at}${item.reason ? ` — ${item.reason}` : ''}`),
    '',
    '## Etapy',
    ...report.stages.map((item) => `- ${item.status}: ${item.label}`),
    '',
    `## Wszystkie zmiany (${report.changes.length})`,
  ];
  if (!report.changes.length) lines.push('- Brak zmian wartości JSON.');
  report.changes.forEach((change) => {
    lines.push(`- ${change.operation} \`${change.path}\`: ${preview(change.before)} → ${preview(change.after)}`);
  });
  if (report.blockers.length) {
    lines.push('', '## Blokery');
    report.blockers.forEach((item) => lines.push(`- ${item}`));
  }
  if (report.intent_architecture) {
    const architecture = report.intent_architecture;
    lines.push('', '## Intencja i architektura lokalna');
    lines.push(`- Główna intencja: ${architecture.search_intent || 'MISSING'}`);
    lines.push(`- Primary keyword: ${architecture.primary_keyword || 'MISSING'}`);
    lines.push(`- Frazy wspierające: ${(architecture.supporting_keywords || []).join(', ') || 'MISSING'}`);
    lines.push(`- Potwierdzone linki wychodzące: ${(architecture.internal_links || []).length}/4`);
    (architecture.internal_links || []).forEach((item) => {
      lines.push(`  - ${item.location}: „${item.anchor}” → ${item.target}`);
    });
    lines.push(`- Kandydaci do linków przychodzących: ${(architecture.incoming_links || []).length}`);
    (architecture.incoming_links || []).forEach((item) => {
      lines.push(`  - ${item.source} (relevance_score=${item.relevance_score})`);
    });
    if ((architecture.cannibalization_candidates || []).length) {
      lines.push(`- Ryzyko kanibalizacji: ${(architecture.cannibalization_candidates || []).map((item) => item.file).join(', ')}`);
    } else {
      lines.push('- Ryzyko kanibalizacji: brak mocnego konfliktu w lokalnych danych.');
    }
    const center = architecture.topic_center;
    if (center?.proposed) {
      lines.push(`- Ten artykuł warto dodać do centrum: ${center.center_name}, bo wykryto sygnały: ${(center.matched_signals || []).join(', ')}. Proponuję dodać go jako ${center.suggested_role}. Status: AWAITING_USER_APPROVAL — bez zmian centrum i bez hub-linku.`);
    } else {
      lines.push(`- Centrum tematyczne: bez propozycji (fit=${center?.fit || 'UNKNOWN'}).`);
    }
  }
  if (report.media_package) {
    lines.push('', '## Pakiet mediów');
    lines.push(`- Katalog artykułu: ${report.media_package.package_directory || 'MISSING'}`);
    lines.push(`- Obrazy: ${(report.media_package.entries || []).length}`);
    (report.media_package.entries || []).forEach((item) => {
      lines.push(`- ${item.placement}: ${item.filename_base} (${item.source?.width || '?'}×${item.source?.height || '?'}, ${item.technique}, ${item.composition})`);
    });
  }
  lines.push('', '## Następny krok');
  lines.push(report.status === STATUSES.CONTENT_READY
    ? `- Użyj przygotowanego pliku: \`npm run article:publish --file="${outputFile}"\``
    : '- Nie publikuj. Usuń wskazane blokery i ponownie uruchom prepare-json.');
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
  return { jsonPath, mdPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Użycie: node scripts/article-json-workbench.js --file <draft.fitpo50.json> [--assets-dir <katalog-artykulu>] [--output-dir <dir>] [--force true|false]');
    process.exit(1);
  }
  const sourceFile = path.resolve(ROOT, args.file);
  if (!fs.existsSync(sourceFile)) throw new Error(`Brak pliku: ${sourceFile}`);
  const outputBaseDir = args['output-dir']
    ? path.resolve(ROOT, args['output-dir'])
    : path.join(os.homedir(), 'Downloads', 'fitpo50-json-ready');
  const assetsDir = path.resolve(args['assets-dir'] || path.dirname(sourceFile));
  const fallbackSlug = safeSlug(path.basename(sourceFile).replace(/\.fitpo50\.json$/i, '').replace(/\.json$/i, ''));
  let original = null;
  try {
    original = parseJson(sourceFile);
  } catch (err) {
    if (!fallbackSlug) throw new Error(`Niepoprawny JSON (${err.message || err}) i brak poprawnego slug w nazwie pliku.`);
    const outputDir = args['output-dir'] ? outputBaseDir : path.join(outputBaseDir, fallbackSlug);
    const blockedOutput = allocateOutput(outputDir, fallbackSlug);
    fs.copyFileSync(sourceFile, blockedOutput);
    const generatedAt = new Date().toISOString();
    const blocker = `Niepoprawna składnia JSON: ${err.message || err}`;
    const report = {
      version: 1,
      generated_at: generatedAt,
      status: STATUSES.BLOCKED,
      status_history: [
        { status: STATUSES.DRAFT, at: generatedAt, reason: 'JSON przyjęty jako draft; nie utworzono HTML.' },
        { status: STATUSES.BLOCKED, at: new Date().toISOString(), reason: blocker },
      ],
      source_file: sourceFile,
      source_sha256: sha256File(sourceFile),
      output_file: blockedOutput,
      output_sha256: sha256File(blockedOutput),
      slug: fallbackSlug,
      force: args.force,
      existing_html: null,
      html_created: false,
      source_preserved: true,
      stages: [{ label: 'Parsowanie JSON', status: 'FAIL', exit_code: 1, stdout: '', stderr: blocker }],
      changes: [],
      blockers: [blocker],
    };
    const reports = writeReports(report, blockedOutput);
    console.log(`[ARTICLE-JSON] status=${STATUSES.BLOCKED}`);
    console.log(`[ARTICLE-JSON] JSON: ${blockedOutput}`);
    console.log(`[ARTICLE-JSON] raport: ${reports.mdPath}`);
    process.exitCode = 2;
    return;
  }
  const slug = safeSlug(original.slug || fallbackSlug);
  if (!slug) throw new Error('Brak poprawnego slug w JSON-ie i nazwie pliku.');
  const outputDir = args['output-dir'] ? outputBaseDir : path.join(outputBaseDir, slug);
  const outputFile = allocateOutput(outputDir, slug);
  const htmlPath = path.join(ROOT, `${slug}.html`);
  const generatedAt = new Date().toISOString();
  const statusHistory = [{ status: STATUSES.DRAFT, at: generatedAt, reason: 'JSON przyjęty jako draft; nie utworzono HTML.' }];
  const blockers = [];
  const stages = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-json-workbench-'));
  const workingFile = path.join(tempDir, `${slug}.fitpo50.json`);
  fs.copyFileSync(sourceFile, workingFile);
  try {
    if (fs.existsSync(htmlPath) && !args.force) {
      blockers.push(`Slug ${slug} już istnieje jako ${htmlPath}. Domyślne force=false blokuje przygotowanie aktualizacji.`);
    } else {
      stages.push(runStage('Bezpieczny fixer JSON', 'node', ['scripts/fix-fitpo50-json.js', '--file', workingFile, '--write', 'true', '--allow-outside-repo', 'true']));
      stages.push(runStage('Normalizacja techniczna bez generowania treści', 'node', ['scripts/json-autofix-strict.js', '--file', workingFile, '--map', 'data/internal-link-map.json']));
      stages.push(runStage('Pakiet mediów: nazwy, warianty, jakość i różnorodność', 'node', ['scripts/prepare-article-media.js', '--file', workingFile, '--assets-dir', assetsDir, '--write', 'true', '--ensure-variants', 'true']));
      stages.push(runStage('Lokalna intencja, kanibalizacja, linkowanie i centra', 'node', ['scripts/prepare-article-architecture.js', '--file', workingFile, '--write', 'true']));
      stages.push(runStage('Weryfikacja źródeł, URL-i i pochodzenia FAQ', 'node', ['scripts/verify-article-evidence.js', '--file', workingFile, '--write', 'true']));
      stages.push(runStage('Bramka treści JSON', 'node', ['scripts/json-fitpo50-gate-diff.js', '--file', workingFile]));
      stages.filter((item) => item.status === 'FAIL').forEach((item) => {
        blockers.push(`${item.label}: ${item.stderr || item.stdout || `exit ${item.exit_code}`}`);
      });
    }

    let corrected = original;
    try {
      corrected = parseJson(workingFile);
    } catch (err) {
      blockers.push(`Narzędzie utworzyło niepoprawny JSON: ${err.message || err}. Zachowano bezpieczną kopię wejścia.`);
      fs.copyFileSync(sourceFile, workingFile);
    }
    if (corrected.media_manifest && typeof corrected.media_manifest === 'object') {
      corrected.media_manifest.source_package_directory = corrected.media_manifest.package_directory || path.basename(assetsDir);
      corrected.media_manifest.package_directory = path.basename(path.dirname(outputFile));
      fs.writeFileSync(workingFile, `${JSON.stringify(corrected, null, 2)}\n`, 'utf8');
    }
    fs.copyFileSync(workingFile, outputFile);
    const status = blockers.length ? STATUSES.BLOCKED : STATUSES.CONTENT_READY;
    if (status === STATUSES.CONTENT_READY) copyMediaPackage(corrected.media_manifest, assetsDir, path.dirname(outputFile));
    statusHistory.push({
      status,
      at: new Date().toISOString(),
      reason: status === STATUSES.CONTENT_READY
        ? 'Wszystkie bramki treści JSON przeszły; nadal nie utworzono HTML.'
        : blockers[0],
    });
    const report = {
      version: 1,
      generated_at: generatedAt,
      status,
      status_history: statusHistory,
      source_file: sourceFile,
      source_sha256: sha256File(sourceFile),
      output_file: outputFile,
      output_sha256: sha256File(outputFile),
      slug,
      force: args.force,
      existing_html: fs.existsSync(htmlPath) ? htmlPath : null,
      html_created: false,
      source_preserved: true,
      stages,
      changes: collectChanges(original, corrected),
      blockers,
      intent_architecture: {
        search_intent: corrected.search_intent || '',
        primary_keyword: corrected.primary_keyword || '',
        supporting_keywords: Array.isArray(corrected.supporting_keywords) ? corrected.supporting_keywords : [],
        cannibalization_candidates: corrected.intent_audit?.cannibalization_candidates || [],
        internal_links: Array.isArray(corrected.internal_link_plan) ? corrected.internal_link_plan : [],
        incoming_links: Array.isArray(corrected.incoming_link_suggestions) ? corrected.incoming_link_suggestions : [],
        topic_center: corrected.topic_center_assessment || null,
      },
      media_package: corrected.media_manifest || null,
    };
    const reports = writeReports(report, outputFile);
    console.log(`[ARTICLE-JSON] status=${status}`);
    console.log(`[ARTICLE-JSON] JSON: ${outputFile}`);
    console.log(`[ARTICLE-JSON] raport: ${reports.mdPath}`);
    if (status !== STATUSES.CONTENT_READY) process.exitCode = 2;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[ARTICLE-JSON][FAIL] ${err.message || err}`);
    process.exit(1);
  }
}

module.exports = { allocateOutput, collectChanges, copyMediaPackage, main, parseArgs };
