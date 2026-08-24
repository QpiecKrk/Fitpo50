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
    console.error('Użycie: node scripts/article-json-workbench.js --file <draft.fitpo50.json> [--output-dir <dir>] [--force true|false]');
    process.exit(1);
  }
  const sourceFile = path.resolve(ROOT, args.file);
  if (!fs.existsSync(sourceFile)) throw new Error(`Brak pliku: ${sourceFile}`);
  const outputDir = args['output-dir']
    ? path.resolve(ROOT, args['output-dir'])
    : path.join(os.homedir(), 'Downloads', 'fitpo50-json-ready');
  const fallbackSlug = safeSlug(path.basename(sourceFile).replace(/\.fitpo50\.json$/i, '').replace(/\.json$/i, ''));
  let original = null;
  try {
    original = parseJson(sourceFile);
  } catch (err) {
    if (!fallbackSlug) throw new Error(`Niepoprawny JSON (${err.message || err}) i brak poprawnego slug w nazwie pliku.`);
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
    fs.copyFileSync(workingFile, outputFile);
    const status = blockers.length ? STATUSES.BLOCKED : STATUSES.CONTENT_READY;
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

module.exports = { allocateOutput, collectChanges, main, parseArgs };
