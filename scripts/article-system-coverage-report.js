#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { collectPages } = require('./gsc-priority-map');
const { validatePreviewReport } = require('./lib/article-preview-report');
const { inspectGscInput } = require('./lib/gsc-data-contract');

const ROOT = process.cwd();
const SITE_ORIGIN = 'https://fitpo50.pl';
const OUTPUT_DIR = path.join(ROOT, 'data', 'reports', 'local');
const JSON_OUTPUT = path.join(OUTPUT_DIR, 'article-system-coverage.json');
const TEXT_OUTPUT = path.join(OUTPUT_DIR, 'article-system-coverage.txt');

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function relative(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function fileObservedAt(file) {
  if (!fs.existsSync(file)) return null;
  return fs.statSync(file).mtime.toISOString();
}

function gitSnapshot(root) {
  try {
    return {
      head_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      head_committed_at: execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    };
  } catch (_error) {
    return { head_commit: 'UNKNOWN', head_committed_at: null };
  }
}

function selectProductionArticles(pages) {
  const inventory = pages
    .filter((page) => page.type === 'article' && page.in_sitemap === true)
    .map((page) => ({
      slug: page.path.replace(/\.html$/, ''),
      path: page.path,
      url: page.url,
      title: page.title,
      content_role: page.content_role,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'pl'));

  const included = new Set(inventory.map((article) => article.path));
  const excludedBlogPostingPages = pages
    .filter((page) => page.has_blogposting === true && !included.has(page.path))
    .map((page) => ({
      path: page.path,
      reason: page.in_sitemap !== true
        ? 'NOT_IN_SITEMAP'
        : (page.type === 'excluded_noindex' ? 'NOINDEX' : `PAGE_TYPE_${String(page.type || 'UNKNOWN').toUpperCase()}`),
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'pl'));

  return { inventory, excluded_blogposting_pages: excludedBlogPostingPages };
}

function classifyPreview(root, slug, validator = validatePreviewReport) {
  const reportFile = path.join(root, 'data', 'reports', 'article-preview', `${slug}.json`);
  if (!fs.existsSync(reportFile)) {
    return {
      classification: 'MISSING',
      version: null,
      source_file: relative(root, reportFile),
      source_observed_at: null,
      errors: [],
    };
  }

  const validation = validator(root, slug, { allowLegacy: true });
  const version = Number(validation.report?.version);
  let classification = 'STALE_OR_INVALID';
  if (validation.ok && version === 3) classification = 'V3_PREVIEW_READY';
  if (validation.ok && version === 2) classification = 'LEGACY_V2_CURRENT';
  if (validation.ok && version === 1) classification = 'LEGACY_V1_CURRENT';

  return {
    classification,
    version: Number.isFinite(version) ? version : null,
    source_file: relative(root, reportFile),
    source_observed_at: fileObservedAt(reportFile),
    errors: Array.isArray(validation.errors) ? validation.errors : [],
  };
}

function readPublicationManifests(root) {
  const directory = path.join(root, 'data', 'reports', 'article-publications');
  const bySlug = new Map();
  const invalid = [];
  if (!fs.existsSync(directory)) return { bySlug, invalid, source_state: 'SOURCE_MISSING', source_file: relative(root, directory) };

  for (const name of fs.readdirSync(directory).filter((file) => file.endsWith('.json')).sort()) {
    const file = path.join(directory, name);
    const report = readJson(file);
    if (!report || typeof report.slug !== 'string' || !report.slug.trim()) {
      invalid.push(relative(root, file));
      continue;
    }
    bySlug.set(report.slug, {
      status: report.status || 'UNKNOWN',
      generated_at: report.generated_at || null,
      source_file: relative(root, file),
    });
  }
  return { bySlug, invalid, source_state: 'SOURCE_CURRENT', source_file: relative(root, directory) };
}

function readStaticValidation(root, git) {
  const file = path.join(root, 'data', 'reports', 'fitpo50-doctor.json');
  const doctor = readJson(file);
  if (!doctor) {
    return { status: 'NOT_CHECKED', source_state: 'SOURCE_MISSING', source_file: relative(root, file), source_generated_at: null, source_observed_at: null };
  }
  const check = Array.isArray(doctor.checks) ? doctor.checks.find((item) => item.label === 'Predeploy check') : null;
  const generatedAt = Date.parse(doctor.generated_at || '');
  const committedAt = Date.parse(git.head_committed_at || '');
  const sourceState = Number.isFinite(generatedAt) && (!Number.isFinite(committedAt) || generatedAt >= committedAt)
    ? 'SOURCE_CURRENT'
    : 'SOURCE_STALE';
  return {
    status: check ? (check.ok === true ? 'PASS' : 'FAIL') : 'NOT_CHECKED',
    source_state: sourceState,
    source_file: relative(root, file),
    source_generated_at: doctor.generated_at || null,
    source_observed_at: fileObservedAt(file),
    doctor_status: doctor.status || 'UNKNOWN',
    evidence: check ? check.details || null : null,
  };
}

function readDeployment(root, git) {
  const file = path.join(root, 'data', 'reports', 'local', 'deployment-live-status.json');
  const deployment = readJson(file);
  if (!deployment) {
    return { status: 'UNKNOWN', source_state: 'SOURCE_MISSING', source_file: relative(root, file), source_observed_at: null, expected_commit: null, remote_commit: null, release_id: null };
  }
  return {
    status: deployment.status || 'UNKNOWN',
    source_state: deployment.expected_commit === git.head_commit ? 'SOURCE_CURRENT' : 'SOURCE_STALE',
    source_file: relative(root, file),
    source_observed_at: fileObservedAt(file),
    expected_commit: deployment.expected_commit || null,
    remote_commit: deployment.remote_commit || null,
    release_id: deployment.release_id || null,
  };
}

function readGscIntegration(root, now) {
  const inputDir = path.join(root, 'data', 'gsc');
  const apiFile = path.join(inputDir, 'gsc-weekly-report-api.json');
  const apiReport = readJson(apiFile);
  if (!apiReport) {
    return {
      status: 'UNKNOWN',
      source_state: 'SOURCE_MISSING',
      source_file: relative(root, apiFile),
      source_generated_at: null,
      source_observed_at: null,
      data_contract: 'NOT_CHECKED',
    };
  }
  const contract = inspectGscInput(inputDir, { strictPeriods: true, now });
  return {
    status: apiReport.status || 'UNKNOWN',
    report_kind: apiReport.report_kind || 'UNKNOWN',
    auth_mode: apiReport.auth_mode || 'UNKNOWN',
    property: apiReport.property || null,
    source_state: contract.freshness?.status === 'PASS' ? 'SOURCE_CURRENT' : 'SOURCE_STALE',
    source_file: relative(root, apiFile),
    source_generated_at: apiReport.generated_at || null,
    source_observed_at: fileObservedAt(apiFile),
    data_contract: contract.status,
    data_contract_checked_at: contract.checked_at,
    data_contract_errors: contract.errors,
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function buildCoverageReport(options = {}) {
  const root = options.root || ROOT;
  const now = options.now || new Date();
  const git = options.git || gitSnapshot(root);
  const pages = options.pages || collectPages(SITE_ORIGIN);
  const selected = selectProductionArticles(pages);
  const publications = readPublicationManifests(root);
  const articles = selected.inventory.map((article) => {
    const preview = classifyPreview(root, article.slug, options.previewValidator || validatePreviewReport);
    const publication = publications.bySlug.get(article.slug);
    return {
      ...article,
      preview,
      publication_manifest: publication
        ? { state: 'PRESENT', ...publication }
        : { state: 'MISSING', status: null, generated_at: null, source_file: null },
    };
  });
  const previewCounts = countBy(articles.map((article) => article.preview), 'classification');
  const publicationSlugs = articles.filter((article) => article.publication_manifest.state === 'PRESENT').map((article) => article.slug);

  return {
    report_kind: 'ARTICLE_SYSTEM_COVERAGE',
    version: 1,
    generated_at: now.toISOString(),
    informational_only: true,
    git,
    catalog: {
      source: 'scripts/gsc-priority-map.js#collectPages',
      rule: 'type=article AND in_sitemap=true',
      total: articles.length,
      editorial_articles: articles.filter((article) => article.content_role === 'editorial_article').length,
      topic_centers: articles.filter((article) => article.content_role === 'topic_center').length,
      excluded_blogposting_pages: selected.excluded_blogposting_pages,
    },
    preview_coverage: {
      source: 'scripts/lib/article-preview-report.js#validatePreviewReport allowLegacy=true',
      counts: {
        V3_PREVIEW_READY: previewCounts.V3_PREVIEW_READY || 0,
        LEGACY_V2_CURRENT: previewCounts.LEGACY_V2_CURRENT || 0,
        LEGACY_V1_CURRENT: previewCounts.LEGACY_V1_CURRENT || 0,
        STALE_OR_INVALID: previewCounts.STALE_OR_INVALID || 0,
        MISSING: previewCounts.MISSING || 0,
      },
      stale_or_invalid: articles.filter((article) => article.preview.classification === 'STALE_OR_INVALID').map((article) => article.slug),
      missing: articles.filter((article) => article.preview.classification === 'MISSING').map((article) => article.slug),
      legacy_scope_note: 'CURRENT dla v1/v2 potwierdza wyłącznie zgodność objętych raportem hashy. Nie oznacza semantycznego review v3.',
    },
    publication_coverage: {
      source: publications.source_file,
      source_state: publications.source_state,
      present: publicationSlugs.length,
      missing: articles.length - publicationSlugs.length,
      slugs_with_manifest: publicationSlugs,
      invalid_manifest_files: publications.invalid,
      scope_note: 'Brak manifestu historycznej publikacji jest informacją o pokryciu, a nie nową bramką dla legacy.',
    },
    system_statuses: {
      static_validation: readStaticValidation(root, git),
      deployment: readDeployment(root, git),
      external_integrations: {
        gsc: readGscIntegration(root, now),
      },
    },
    articles,
  };
}

function renderText(report) {
  const p = report.preview_coverage.counts;
  const staticStatus = report.system_statuses.static_validation;
  const deployment = report.system_statuses.deployment;
  const gsc = report.system_statuses.external_integrations.gsc;
  const lines = [
    'FITPO50 — POKRYCIE KATALOGU I STATUSY SYSTEMOWE',
    `Wygenerowano: ${report.generated_at}`,
    `HEAD: ${report.git.head_commit}`,
    'Tryb: INFORMACYJNY; ten raport nie jest bramką publikacyjną.',
    '',
    'KATALOG',
    `- wszystkie indeksowalne BlogPosting: ${report.catalog.total}`,
    `- artykuły redakcyjne: ${report.catalog.editorial_articles}`,
    `- centra tematyczne: ${report.catalog.topic_centers}`,
    `- źródło: ${report.catalog.source}`,
    `- reguła: ${report.catalog.rule}`,
    `- wykluczone BlogPosting: ${report.catalog.excluded_blogposting_pages.map((item) => `${item.path} (${item.reason})`).join(', ') || 'brak'}`,
    '',
    'PREVIEW',
    `- V3_PREVIEW_READY: ${p.V3_PREVIEW_READY}`,
    `- LEGACY_V2_CURRENT: ${p.LEGACY_V2_CURRENT}`,
    `- LEGACY_V1_CURRENT: ${p.LEGACY_V1_CURRENT}`,
    `- STALE_OR_INVALID: ${p.STALE_OR_INVALID}`,
    `- MISSING: ${p.MISSING}`,
    `- stale/invalid: ${report.preview_coverage.stale_or_invalid.join(', ') || 'brak'}`,
    `- missing: ${report.preview_coverage.missing.join(', ') || 'brak'}`,
    `- ograniczenie legacy: ${report.preview_coverage.legacy_scope_note}`,
    '',
    'MANIFESTY PUBLIKACJI',
    `- PRESENT: ${report.publication_coverage.present}`,
    `- MISSING: ${report.publication_coverage.missing}`,
    `- slugi z manifestem: ${report.publication_coverage.slugs_with_manifest.join(', ') || 'brak'}`,
    `- źródło: ${report.publication_coverage.source} (${report.publication_coverage.source_state})`,
    `- interpretacja: ${report.publication_coverage.scope_note}`,
    '',
    'ROZDZIELONE STATUSY SYSTEMOWE',
    `- static_validation: ${staticStatus.status}; ${staticStatus.source_state}; źródło ${staticStatus.source_file}; generated_at ${staticStatus.source_generated_at || 'brak'}`,
    `- deployment: ${deployment.status}; ${deployment.source_state}; commit ${deployment.expected_commit || 'brak'}; release ${deployment.release_id || 'brak'}; źródło ${deployment.source_file}`,
    `- GSC: ${gsc.status}; ${gsc.source_state}; data_contract ${gsc.data_contract}; generated_at ${gsc.source_generated_at || 'brak'}; źródło ${gsc.source_file}`,
    '',
    'BRAKUJĄCE LUB NIEAKTUALNE ŹRÓDŁA',
  ];
  const sourceIssues = [];
  if (staticStatus.source_state !== 'SOURCE_CURRENT') sourceIssues.push(`static_validation: ${staticStatus.source_state}`);
  if (deployment.source_state !== 'SOURCE_CURRENT') sourceIssues.push(`deployment: ${deployment.source_state}`);
  if (gsc.source_state !== 'SOURCE_CURRENT') sourceIssues.push(`GSC: ${gsc.source_state}`);
  if (report.publication_coverage.source_state !== 'SOURCE_CURRENT') sourceIssues.push(`publication_manifests: ${report.publication_coverage.source_state}`);
  lines.push(...(sourceIssues.length ? sourceIssues.map((issue) => `- ${issue}`) : ['- brak']));
  lines.push('', 'Raport zachowuje osobne znaczenie każdego statusu i nie wylicza globalnego PASS.', '');
  return lines.join('\n');
}

function writeOutputs(report, outputDir = OUTPUT_DIR) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonFile = path.join(outputDir, path.basename(JSON_OUTPUT));
  const textFile = path.join(outputDir, path.basename(TEXT_OUTPUT));
  fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(textFile, renderText(report), 'utf8');
  return { jsonFile, textFile };
}

function main() {
  const report = buildCoverageReport();
  const outputs = writeOutputs(report);
  console.log(`[ARTICLE-COVERAGE] articles=${report.catalog.total} preview=${JSON.stringify(report.preview_coverage.counts)}`);
  console.log(`[ARTICLE-COVERAGE] JSON: ${relative(ROOT, outputs.jsonFile)}`);
  console.log(`[ARTICLE-COVERAGE] TXT: ${relative(ROOT, outputs.textFile)}`);
}

if (require.main === module) main();

module.exports = {
  buildCoverageReport,
  classifyPreview,
  readDeployment,
  readGscIntegration,
  readStaticValidation,
  renderText,
  selectProductionArticles,
  writeOutputs,
};
