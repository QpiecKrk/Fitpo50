#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  API_REPORT_NAME,
  DEFAULT_MAX_AGE_HOURS,
  MANIFEST_NAME,
  inspectGscInput,
  writeManifestFromApiReport,
} = require('./lib/gsc-data-contract');
const { resolveGscWorkDir } = require('./lib/gsc-work-dir');

function parseArgs(argv, root = process.cwd()) {
  const out = { inputDir: resolveGscWorkDir(root) };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (token === '--input-dir') {
      const value = String(argv[index + 1] || '').trim();
      if (!value) throw new Error('Brak wartości --input-dir.');
      out.inputDir = path.resolve(root, value);
      index += 1;
    } else throw new Error(`Nieznany argument: ${token || '(pusty)'}`);
  }
  return out;
}

function readJsonRequired(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label}: brak pliku ${file}.`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`${label}: nieprawidłowy JSON (${error.message}).`); }
}

function migrateGscManifestV2(inputDir, options = {}) {
  const resolvedDir = path.resolve(inputDir);
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const manifestPath = path.join(resolvedDir, MANIFEST_NAME);
  const apiReportPath = path.join(resolvedDir, API_REPORT_NAME);
  const manifest = readJsonRequired(manifestPath, 'Manifest GSC');
  if (manifest.api_report) return { status: 'ALREADY_V2', manifest_path: manifestPath, changed: false };

  const report = readJsonRequired(apiReportPath, 'Raport API GSC');
  if (report.status !== 'OK_VERIFIED' || report.report_kind !== 'DATASET') {
    throw new Error(`MIGRATION_BLOCKED: raport API wymaga status=OK_VERIFIED i report_kind=DATASET; otrzymano status=${report.status || 'UNKNOWN'}, kind=${report.report_kind || 'UNKNOWN'}.`);
  }
  if (String(report.property || '') !== String(manifest.property || '')) {
    throw new Error('MIGRATION_BLOCKED: raport API dotyczy innej właściwości GSC niż manifest v1.');
  }
  if (JSON.stringify(report.reporting_windows || null) !== JSON.stringify(manifest.reporting_windows || null)) {
    throw new Error('MIGRATION_BLOCKED: zakresy raportu API nie odpowiadają zestawowi opisanemu przez manifest v1.');
  }

  const contract = inspectGscInput(resolvedDir, {
    strictPeriods: true,
    now,
    maxAgeHours: DEFAULT_MAX_AGE_HOURS,
  });
  const csvAgeErrors = Object.entries(contract.files || {}).flatMap(([key, file]) => {
    if (!file?.exists) return [];
    const ageHours = (now.getTime() - Date.parse(file.mtime)) / 3600000;
    if (!Number.isFinite(ageHours)) return [`${key}: nie można ustalić czasu modyfikacji CSV.`];
    if (ageHours < 0) return [`${key}: CSV ma czas modyfikacji z przyszłości.`];
    if (ageHours >= DEFAULT_MAX_AGE_HOURS) return [`${key}: CSV ma ${ageHours.toFixed(1)} h; migracja wymaga mniej niż ${DEFAULT_MAX_AGE_HOURS} h.`];
    return [];
  });
  const errors = [...contract.errors, ...csvAgeErrors];
  if (errors.length) throw new Error(`MIGRATION_BLOCKED:\n- ${errors.join('\n- ')}`);

  const outputPath = writeManifestFromApiReport(report, resolvedDir);
  return {
    status: 'MIGRATED_TO_V2',
    manifest_path: outputPath,
    api_report: JSON.parse(fs.readFileSync(outputPath, 'utf8')).api_report,
    changed: true,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = migrateGscManifestV2(args.inputDir);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(`[GSC-MIGRATE-V2][BLOCKED] ${error.message || error}`); process.exit(2); }
}

module.exports = { migrateGscManifestV2, parseArgs };
