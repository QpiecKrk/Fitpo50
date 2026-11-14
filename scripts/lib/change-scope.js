'use strict';

const { spawnSync } = require('node:child_process');

const LOCAL_ONLY_UNTRACKED = new Set(['docs/fitpo50-modernization-master-plan.md']);
const MARKER_PATHS = new Set(['deployment.json', '_site/deployment.json']);
const ADMIN_TESTS = new Set([
  'tests/news-editor-color.test.js',
  'tests/news-db-write.test.js',
  'tests/news-db-read-cache.test.js',
  'tests/news-db-schema.test.js',
  'tests/news-feed-error-leak.test.js',
  'tests/retired-module-exposure.test.js',
]);
// Jawna mapa mechanizmów i ich regresji. Nie wnioskujemy z prefiksu article-*.
const MODULES = [
  { files: ['.github/workflows/cwv-nightly.yml'], tests: ['tests/workflow-reliability.test.js'] },
  { files: ['scripts/lib/change-scope.js', 'scripts/run-all-prepush.js'], tests: ['tests/prepush-concurrency.test.js', 'tests/prepush-release-guardrails.test.js', 'tests/release-scope.test.js', 'tests/validation-reuse.test.js'] },
  { files: ['scripts/run-article-guard-diff.js', 'scripts/schema-validator.js', 'scripts/date-modified-guard.js', 'scripts/immutable-asset-guard.js'], tests: ['tests/release-scope.test.js'] },
  { files: ['scripts/deployment-live-verify.js', 'scripts/lib/deployment-live-verifier.js', 'scripts/live-postpush-check.sh'], tests: ['tests/deployment-safety.test.js', 'tests/prepush-release-guardrails.test.js', 'tests/validation-reuse.test.js', 'tests/publish-resume.test.js'] },
  { files: ['tests/fixtures/change-scope-past-releases.json'], tests: ['tests/prepush-concurrency.test.js'] },
  { files: ['scripts/fitpo50-doctor.js'], tests: ['tests/prepush-release-guardrails.test.js'] },
  { files: ['scripts/prepare-deployment-marker.js'], tests: ['tests/deployment-safety.test.js', 'tests/news-deploy-sync-gate.test.js', 'tests/release-scope.test.js', 'tests/validation-reuse.test.js'] },
  { files: ['scripts/export_site.sh'], tests: ['tests/export-parity.test.js', 'tests/prepush-release-guardrails.test.js'], exportProbe: true },
  { files: ['scripts/article-add.js', 'scripts/article-json-workbench.js', 'scripts/article-dry-run.js', 'scripts/lib/article-json-artifact.js', 'scripts/lib/article-repair-attempts.js', 'scripts/lib/article-scope-guard.js', 'scripts/lib/package-identity.js'], tests: ['tests/article-json-workflow.test.js', 'tests/article-dry-run.test.js', 'tests/article-technical-flow.test.js', 'tests/validation-reuse.test.js'] },
  { files: ['scripts/article-pipeline.js', 'scripts/lib/article-staging.js', 'scripts/lib/article-publication-state.js'], tests: ['tests/article-staging.test.js', 'tests/article-json-workflow.test.js', 'tests/article-technical-flow.test.js', 'tests/validation-reuse.test.js'] },
  { files: ['scripts/import-article.js'], tests: ['tests/article-json-workflow.test.js', 'tests/article-technical-flow.test.js', 'tests/import-article-faq-research.test.js'] },
  { files: ['scripts/package-audit.js'], tests: ['tests/package-audit.test.js', 'tests/article-technical-flow.test.js', 'tests/validation-reuse.test.js'] },
  { files: ['scripts/prepare-article-media.js', 'scripts/prepare-article-assets.js', 'scripts/lib/article-media.js'], tests: ['tests/article-media.test.js', 'tests/article-technical-flow.test.js'] },
  { files: ['scripts/prepare-article-architecture.js', 'scripts/lib/article-intent-links.js'], tests: ['tests/article-intent-links.test.js', 'tests/article-technical-flow.test.js'] },
  { files: ['scripts/article-preflight.js', 'scripts/article-contract-check.js', 'scripts/validate-article-standard.js', 'scripts/lib/article-head-contract.js', 'scripts/run-article-contract-diff.js', 'scripts/article-publish-guard.js', '.githooks/pre-commit'], tests: ['tests/article-technical-flow.test.js', 'tests/article-json-workflow.test.js', 'tests/release-scope.test.js'] },
  { files: ['scripts/predeploy-gate.js', 'scripts/sync-site-assets-mirror.js'], tests: ['tests/article-technical-flow.test.js', 'tests/deployment-safety.test.js'] },
  { files: ['scripts/article-preview-gate.js', 'scripts/lib/article-preview-report.js'], tests: ['tests/article-preview-report.test.js', 'tests/article-preview-dom.test.js'] },
  { files: ['scripts/validate-topic-center.py'], tests: ['tests/article-baseline-on-touch.test.js', 'tests/topic-center-pipeline.test.js'] },
  { files: ['scripts/lib/topic-center-print.js'], tests: ['tests/topic-center-pipeline.test.js', 'tests/article-preview-dom.test.js'] },
  { files: [], patterns: [/^templates\/topic-centers\/[^/]+\.html$/], scope: 'articles', tests: ['tests/topic-center-pipeline.test.js', 'tests/article-baseline-on-touch.test.js'] },
  { files: ['scripts/generate_article_pdf.py'], tests: ['tests/article-pdf-content.test.js'] },
  { files: ['scripts/lib/article-policy.js'], tests: ['tests/publishing-engine.test.js', 'tests/pipeline-blockers.test.js'] },
  { files: ['scripts/config/article-validation-baseline.json'], tests: ['tests/article-baseline-on-touch.test.js', 'tests/topic-center-pipeline.test.js', 'tests/pipeline-blockers.test.js'] },
  { files: ['scripts/json-fitpo50-gate-diff.js', 'scripts/lib/article-evidence.js'], tests: ['tests/article-evidence.test.js', 'tests/pipeline-blockers.test.js'] },
  { files: ['docs/skills/fitpo50-article-draft/scripts/validate_fitpo50_draft.py'], tests: ['tests/fitpo50-article-draft-skill.test.js'] },
  { files: ['scripts/publish-article.js'], tests: ['tests/publish-article-command.test.js', 'tests/release-scope.test.js', 'tests/publish-resume.test.js'] },
  { files: ['.githooks/pre-push', 'scripts/prepush-main-guard.js', 'scripts/prepush-diff-guard.js', 'scripts/prepush-parallel-checks.js'], tests: ['tests/prepush-main-guard.test.js', 'tests/prepush-concurrency.test.js', 'tests/release-scope.test.js', 'tests/validation-reuse.test.js'] },
  { files: ['scripts/news-public-http-check.js'], tests: ['tests/news-public-integrity.test.js', 'tests/news-deploy-sync-gate.test.js', 'tests/validation-reuse.test.js'] },
  { scope: 'news', files: ['scripts/news-integrity-check.js', 'scripts/lib/news-public-integrity.js'], tests: ['tests/news-public-integrity.test.js', 'tests/validation-reuse.test.js'] },
  { scope: 'news', files: ['scripts/news-pull.js'], tests: ['tests/news-pull.test.js'] },
];
const MODULE_BY_FILE = new Map(MODULES.flatMap((module) => module.files.map((file) => [file, module])));
const KNOWN_PIPELINE_TESTS = new Set(MODULES.flatMap((module) => module.tests));
const PIPELINE_ONLY_FILES = new Set(MODULES.filter((module) => module.scope !== 'news').flatMap((module) => module.files));
const NEWS_CODE = new Set(MODULES.filter((module) => module.scope === 'news').flatMap((module) => module.files));
const SHARED_PUBLIC_FILES = new Set(['.htaccess', 'robots.txt', 'style.css']);
const ARTICLE_WIDE_FILES = new Set(['article-template-bento.html', 'article.css']);

function normalize(file) {
  return String(file || '').replace(/^.* -> /, '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function lines(output) {
  return String(output || '').split('\n').map(normalize).filter(Boolean);
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${String(result.stderr || result.stdout || '').trim()}`);
  return lines(result.stdout);
}

function selectedFiles(argv = process.argv.slice(2), env = process.env) {
  const index = argv.indexOf('--files-json');
  const raw = index >= 0 ? argv[index + 1] : env.FITPO50_CHANGED_FILES_JSON;
  if (raw === undefined) {
    if (index >= 0) throw new Error('Brak wartości --files-json.');
    return null;
  }
  const files = JSON.parse(raw);
  if (!Array.isArray(files) || files.some((file) => typeof file !== 'string' || !file || /[\0\r\n]/.test(file)
    || file.startsWith('/') || file.split(/[\\/]/).includes('..'))) throw new Error('Nieprawidłowa lista plików zadania.');
  return [...new Set(files.map(normalize))].sort();
}

function filesFromPushRefs(lines, cwd = process.cwd(), runner = spawnSync) {
  const files = new Set();
  const read = (args) => {
    const result = runner('git', args, { cwd, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Nie można ustalić wysyłanych plików: git ${args.join(' ')}: ${result.stderr || ''}`);
    return String(result.stdout || '');
  };
  for (const line of String(lines || '').trim().split(/\r?\n/).filter(Boolean)) {
    const [localRef, localSha, remoteRef, remoteSha, extra] = line.trim().split(/\s+/);
    if (!localRef || !/^[a-f0-9]{40,64}$/i.test(localSha || '') || !/^[a-f0-9]{40,64}$/i.test(remoteSha || '') || extra) throw new Error('Nieprawidłowe referencje pre-push.');
    if (remoteRef !== 'refs/heads/main') continue;
    if (/^0+$/.test(localSha)) throw new Error('Usunięcie main jest zabronione.');
    let output;
    if (/^0+$/.test(remoteSha)) output = read(['ls-tree', '-r', '--name-only', '-z', localSha]);
    else {
      read(['merge-base', '--is-ancestor', remoteSha, localSha]);
      output = read(['diff', '--name-only', '--no-renames', '-z', remoteSha, localSha, '--']);
    }
    output.split('\0').filter(Boolean).forEach((file) => files.add(file));
  }
  return [...files].sort();
}

function assertReleaseFiles(marker, files, readHash) {
  const expected = selectedFiles(['--files-json', JSON.stringify(marker?.release_files)], {});
  const actual = [...new Set(files)].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Zakres staged/pusha nie odpowiada release_files markera. Przygotuj marker dla całego wydania.');
  for (const file of expected.filter((file) => !MARKER_PATHS.has(file))) {
    if (!Object.hasOwn(marker.release_file_hashes || {}, file) || readHash(file) !== marker.release_file_hashes[file]) throw new Error(`Niezgodna zawartość pliku wydania: ${file}`);
  }
  return actual;
}

function collectChangedFiles(cwd = process.cwd()) {
  const ahead = git(cwd, ['diff', '--name-only', '--no-renames', 'origin/main...HEAD']);
  const staged = git(cwd, ['diff', '--cached', '--name-only', '--no-renames']);
  const unstaged = git(cwd, ['diff', '--name-only', '--no-renames']);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard'])
    .filter((file) => !LOCAL_ONLY_UNTRACKED.has(file));
  return [...new Set([...ahead, ...staged, ...unstaged, ...untracked])].sort();
}

function withoutSitePrefix(file) {
  return normalize(file).replace(/^_site\//, '');
}

function newsInScope(scope) {
  const scopes = scope?.scopes || scope?.change_scope;
  return scope?.full === true || !Array.isArray(scopes) || scopes.includes('full') || scopes.includes('news');
}

function isNewsPath(file) {
  const value = withoutSitePrefix(file);
  return value === 'data/news-live.json'
    || value.startsWith('data/news-backups/')
    || value.startsWith('assets/news/')
    || value === 'assets/data/news-fallback.json';
}

function isAdminPath(file) {
  const value = withoutSitePrefix(file);
  return value.startsWith('admin/') && !/\.md$/i.test(value);
}

function isArticlePath(file) {
  const value = withoutSitePrefix(file);
  return (!NEWS_CODE.has(value) && /^[^/]+\.html$/i.test(value))
    || ['sitemap.xml', 'llms.txt', 'llms-full.txt', 'assets/data/search-index.json'].includes(value)
    || value.startsWith('assets/pdf/')
    || /^data\/crosslink-suggestions\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(value)
    || (/^assets\/.+\.(?:avif|webp|jpe?g|png)$/i.test(value) && !value.startsWith('assets/news/'));
}

function isArticleReportPath(file) {
  return /^data\/reports\/(?:article-publications|article-preview)\/[^/]+\.(?:json|md)$/.test(file)
    || ['data/reports/published-articles-log.json', 'data/reports/gsc-after-publication-queue.json', 'data/reports/gsc-after-publication-queue.txt', 'data/reports/popraw-seo-deployments.json'].includes(file);
}

function isDocumentationPath(file) {
  const value = normalize(file);
  return !value.startsWith('_site/') && /\.md$/i.test(value)
    && (!value.includes('/') || value.startsWith('docs/')) && !LOCAL_ONLY_UNTRACKED.has(value);
}

function isPipelineOnlyPath(file) {
  const value = withoutSitePrefix(file);
  return !normalize(file).startsWith('_site/') && !ADMIN_TESTS.has(value)
    && (PIPELINE_ONLY_FILES.has(value) || KNOWN_PIPELINE_TESTS.has(value));
}

function requiresExportProbe(file) {
  return MODULE_BY_FILE.get(withoutSitePrefix(file))?.exportProbe === true;
}

function classifyChangedFiles(files) {
  const normalized = [...new Set((files || []).map(normalize).filter(Boolean))]
    .filter((file) => !MARKER_PATHS.has(file))
    .sort();
  const buckets = { admin: [], news: [], articles: [], pipeline: [], docs: [], export_probe: [], full: [], unknown: [] };
  const reasons = [];
  const testFiles = new Set();
  let articleWide = false;
  for (const file of normalized) {
    const value = withoutSitePrefix(file);
    const module = MODULE_BY_FILE.get(file) || MODULES.find((item) => item.patterns?.some((pattern) => pattern.test(file)));
    let scope;
    let reason;
    if (requiresExportProbe(file) && module) { scope = 'export_probe'; reason = 'Zmiana eksportera: wymagana sonda eksportu i parity, wynik nie jest zakładany.'; }
    else if (isNewsPath(file) || NEWS_CODE.has(value)) { scope = 'news'; reason = 'Zmiana danych, obrazów lub kodu NEWS.'; }
    else if (isAdminPath(file) || ADMIN_TESTS.has(file)) { scope = 'admin'; reason = 'Zmiana panelu lub jego przypisanej regresji.'; }
    else if (SHARED_PUBLIC_FILES.has(value)) { scope = 'full'; reason = 'Wspólna konfiguracja lub publiczny shell wpływa również na NEWS i pozostałe moduły.'; }
    else if (ARTICLE_WIDE_FILES.has(value)) { scope = 'articles'; articleWide = true; reason = 'Wspólny szablon lub CSS artykułów: kontrola wszystkich artykułów, bez NEWS.'; }
    else if (module?.scope === 'articles') { scope = 'articles'; reason = 'Szablon konkretnego centrum tematycznego: kontrola powiązanego centrum.'; }
    else if (isPipelineOnlyPath(file)) { scope = 'pipeline'; reason = module ? 'Znany mechanizm: składnia i jawnie przypisane testy; brak samodzielnej zmiany stron publicznych.' : 'Zmieniony znany test: uruchomienie tego testu.'; }
    else if (isArticlePath(file) || isArticleReportPath(file)) { scope = 'articles'; reason = 'Strona artykułu albo jego media, PDF, mirror, listing, indeks lub raport publikacji.'; }
    else if (isDocumentationPath(file)) { scope = 'docs'; reason = 'Opis lub instrukcja bez wpływu na publiczne pliki; bez budowania strony.'; }
    else { scope = 'unknown'; reason = 'Nieznany wpływ: wyjaśnij go i uzupełnij mapę przed uruchomieniem kontroli.'; }
    buckets[scope].push(file);
    const tests = [...new Set([
      ...(module ? module.tests : (KNOWN_PIPELINE_TESTS.has(file) ? [file] : [])),
      ...(scope === 'news' ? ['tests/news-public-integrity.test.js', 'tests/news-deploy-sync-gate.test.js'] : []),
    ])];
    tests.forEach((test) => testFiles.add(test));
    reasons.push({ file, scope, reason, tests });
  }
  const common = { files: normalized, buckets, reasons, testFiles: [...testFiles].sort(), articleWide, blocked: buckets.unknown.length > 0 };
  if (buckets.full.length) {
    return {
      ...common,
      scopes: ['full'],
      full: true,
      requiresExportProbe: false,
    };
  }
  const scopes = ['admin', 'news', 'articles', 'pipeline', 'docs']
    .filter((scope) => buckets[scope].length > 0 || (scope === 'pipeline' && buckets.export_probe.length > 0));
  return {
    ...common,
    scopes,
    full: false,
    requiresExportProbe: buckets.export_probe.length > 0,
  };
}

function assertResolvedScope(classification) {
  if (!classification.blocked) return classification;
  throw new Error(`Nieustalony wpływ zmian — nie uruchomiono kosztownych kontroli:\n${classification.reasons.filter((item) => item.scope === 'unknown').map((item) => `- ${item.file}: ${item.reason}`).join('\n')}`);
}

function filesForScope(classification, scope) {
  const values = [...(classification?.buckets?.[scope] || [])];
  return (scope === 'admin' ? values.filter(isAdminPath) : values).sort();
}

module.exports = {
  ADMIN_TESTS,
  MODULES,
  PIPELINE_ONLY_FILES,
  classifyChangedFiles,
  selectedFiles,
  filesFromPushRefs,
  assertReleaseFiles,
  assertResolvedScope,
  collectChangedFiles,
  filesForScope,
  isAdminPath,
  isArticlePath,
  isNewsPath,
  isPipelineOnlyPath,
  requiresExportProbe,
  normalize,
  withoutSitePrefix,
  newsInScope,
};
