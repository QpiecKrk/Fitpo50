'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { auditPackage, imageIssues, metricProposal, printReport, unitIssues } = require('../scripts/package-audit');
const { inspectImage } = require('../scripts/lib/article-media');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');
const { packageIdentity } = require('../scripts/lib/package-identity');
const { executeArticleAddCore } = require('../scripts/article-add');
const { cleanupArticleInput } = require('../scripts/article-cleanup-input');
const { computePreparedPackageFingerprint } = require('../scripts/lib/article-json-artifact');
const { statusPath } = require('../scripts/lib/article-pipeline-status');
const { normalizeCloseCode } = require('../scripts/prepush-parallel-checks');
const { verifyDeployment, sha256 } = require('../scripts/lib/deployment-live-verifier');
const { validateInput } = require('../scripts/article-dry-run');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'package-audit', 'multi-error.fitpo50.json');
const VALID_PACKAGE_DIR = path.join(ROOT, 'tests', 'fixtures', 'package-audit', 'valid-package');
const VALID_PACKAGE = path.join(VALID_PACKAGE_DIR, 'package-audit-valid.fitpo50.json');

function withTechnicalPackage(callback) {
  const root = createManagedTempDir({ prefix: 'fitpo50-technical-audit-test-', type: 'article-package-audit-test', projectRoot: ROOT });
  const assetsDir = path.join(root, 'package');
  fs.mkdirSync(assetsDir);
  for (const name of fs.readdirSync(VALID_PACKAGE_DIR)) fs.copyFileSync(path.join(VALID_PACKAGE_DIR, name), path.join(assetsDir, name));
  const file = path.join(assetsDir, path.basename(VALID_PACKAGE));
  const args = { file, 'assets-dir': assetsDir, 'report-dir': path.join(root, 'reports'), profile: 'technical' };
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  try { return callback({ root, assetsDir, file, args, article }); }
  finally { disposeTempWorkspace(root, { status: 'COMPLETED' }); }
}

test('technical: poprawna paczka przechodzi bez oceny treści, dowodów, FAQ i review obrazów', () => withTechnicalPackage(({ root, assetsDir, file, args, article }) => {
  article.sources = [];
  article.evidence_claims = [{ claim: 'Niezgodna fraza testowa', location: 'nieistniejace.pole', claim_type: 'medical', source_urls: ['https://example.invalid/bez-pobierania'] }];
  article.answer_blocks = [{ question: 'Pytanie testowe?', answer_html: '<p>Odpowiedź testowa.</p>' }];
  article.faq_research = [];
  article.lead = 'Przykład techniczny: 180 pounds.';
  article.seo_title = 'x'.repeat(100);
  delete article.search_intent;
  delete article.primary_keyword;
  fs.writeFileSync(file, JSON.stringify(article));
  const before = packageIdentity(file, assetsDir, article);
  const report = auditPackage(args, { root, spawnSync: () => assert.fail('Profil techniczny nie może uruchamiać walidatora redakcyjnego.') });
  assert.equal(report.status, 'TECHNICAL_READY');
  assert.equal(report.exit_code, 0);
  assert.equal(report.summary.errors, 0);
  assert.equal(report.package_files.length, 7);
  assert.equal(report.mandatory_visual_review.status, 'NOT_IN_SCOPE');
  assert.ok(report.not_in_scope.includes('EVIDENCE_REVIEW'));
  assert.ok(report.not_in_scope.includes('FAQ_RESEARCH'));
  assert.equal(report.next_step, 'BUILD_AND_VALIDATE_ARTICLE_IN_STAGING');
  assert.equal(packageIdentity(file, assetsDir, article).hash, before.hash, 'Audyt nie zmienia JSON-u ani obrazów.');
  const output = [];
  const originalLog = console.log;
  try { console.log = (line) => output.push(line); printReport(report); }
  finally { console.log = originalLog; }
  assert.doesNotMatch(output.join('\n'), /VISUAL_REVIEW.*PENDING/);
}));

test('technical: jeden raport zbiera błędy niezależnych pól, HTML i brakujących wariantów', () => withTechnicalPackage(({ root, file, args, article, assetsDir }) => {
  delete article.title;
  article.meta_description = null;
  article.slug = '../nieprawidlowy';
  article.category = 'nieznana';
  article.sections = [null, { title: 12, section_role: 'nieznana', paragraphs_html: [12, '<p><table><tr><td>Test</td></tr></table></p>'] }];
  article.sources = [{ label: false, url: 'javascript:alert(1)' }];
  fs.unlinkSync(path.join(assetsDir, `${article.image_prompts_v4[0].filename_base}.webp`));
  fs.writeFileSync(file, JSON.stringify(article));
  const report = auditPackage(args, { root });
  const issues = Object.values(report.by_owner).flat();
  for (const pointer of ['/title', '/meta_description', '/slug', '/category', '/sections/0', '/sections/1/title', '/sections/1/paragraphs_html/0', '/sections/1/paragraphs_html/1', '/sources/0/label', '/sources/0/url', '/image_prompts_v4/0/webp']) {
    assert.ok(issues.some((item) => item.path === pointer), `Brak błędu ${pointer}.`);
  }
  assert.equal(report.status, 'TECHNICAL_BLOCKED');
  assert.equal(report.exit_code, 20);
  assert.deepEqual(report.proposed_changes, [], 'Audyt nie proponuje generowania obrazów ani zmiany treści.');
}));

test('technical: nieprawidłowe typy kolekcji i korzenia dają raport zamiast wyjątku', () => withTechnicalPackage(({ root, file, args, article }) => {
  article.sections = {};
  article.sources = 'lista';
  article.image_prompts_v4 = null;
  fs.writeFileSync(file, JSON.stringify(article));
  const report = auditPackage(args, { root });
  assert.equal(report.exit_code, 20);
  assert.equal(report.blocked_dependencies.length, 3);
  for (const pointer of ['/sections', '/sources', '/image_prompts_v4']) assert.ok(report.by_owner.PISARZ.some((item) => item.path === pointer));
  for (const value of [null, [], 42]) {
    fs.writeFileSync(file, JSON.stringify(value));
    const invalid = auditPackage(args, { root });
    assert.equal(invalid.exit_code, 20);
    assert.equal(invalid.by_owner.PISARZ[0].code, 'JSON_ROOT_INVALID');
    assert.equal(invalid.blocked_dependencies.length, 1);
  }
}));

test('technical: błąd składni ma kod 20, brak dostępu do JSON-u kod 30', () => withTechnicalPackage(({ root, file, args }) => {
  fs.writeFileSync(file, '{');
  const syntax = auditPackage(args, { root });
  assert.equal(syntax.exit_code, 20);
  assert.equal(syntax.by_owner.PISARZ[0].code, 'JSON_PARSE_ERROR');
  assert.equal(syntax.blocked_dependencies[0].dependency, 'JSON_PARSE');
  const missing = auditPackage({ ...args, file: path.join(root, 'nie-ma.json') }, { root });
  assert.equal(missing.exit_code, 30);
  assert.equal(missing.status, 'ENVIRONMENT_FAILURE');
  assert.equal(missing.next_step, 'FIX_ENVIRONMENT_AND_REPEAT_AUDIT');
  assert.equal(missing.by_owner.CODEX[0].code, 'JSON_READ_ENVIRONMENT_FAILURE');
}));

test('technical: istniejący slug wymaga jawnego force, nieznany profil jest odrzucany', () => withTechnicalPackage(({ root, args, article }) => {
  fs.writeFileSync(path.join(root, `${article.slug}.html`), '<html></html>');
  assert.equal(auditPackage(args, { root }).exit_code, 20);
  assert.equal(auditPackage({ ...args, force: 'true' }, { root }).exit_code, 0);
  assert.throws(() => auditPackage({ ...args, profile: 'dowolny' }, { root }), /Nieobsługiwany profil/);
}));

test('technical: błędna ścieżka obrazu blokuje jego odczyt, inne pliki nadal są sprawdzane', () => withTechnicalPackage(({ root, file, args, article, assetsDir }) => {
  article.image_prompts_v4[0].filename_base = '../spoza-paczki-v1';
  article.image_prompts_v4[0].source_file = '../spoza-paczki-v1.jpg';
  fs.writeFileSync(file, JSON.stringify(article));
  let inspected = 0;
  const report = auditPackage(args, { root, inspectImage(image) {
    assert.equal(path.dirname(image), assetsDir);
    inspected += 1;
    return { width: 1080, height: 600, aspect_ratio: 1.8 };
  } });
  assert.equal(report.exit_code, 20);
  assert.equal(inspected, 3);
  assert.ok(report.by_owner.PISARZ.some((item) => item.code === 'IMAGE_FILENAME_INVALID'));
  assert.ok(report.blocked_dependencies.some((item) => item.dependency === '/image_prompts_v4/0/filename_base'));
}));

test('technical: wymiary i uszkodzenie wariantu są błędami technicznymi bez konwersji', () => withTechnicalPackage(({ root, args }) => {
  const report = auditPackage(args, { root, inspectImage(file) {
    if (file.endsWith('.avif')) throw new Error('Uszkodzony wariant.');
    return file.endsWith('.webp') ? { width: 900, height: 900, aspect_ratio: 1 } : { width: 1000, height: 500, aspect_ratio: 2 };
  } });
  const codes = report.by_owner.ILUSTRATOR.map((item) => item.code);
  for (const code of ['IMAGE_UNREADABLE', 'IMAGE_TOO_SMALL', 'IMAGE_BAD_RATIO', 'IMAGE_VARIANT_SIZE_MISMATCH']) assert.ok(codes.includes(code), code);
  assert.equal(report.exit_code, 20);
  assert.deepEqual(report.proposed_changes, []);
}));

test('technical: awaria narzędzia odczytu obrazów ma kod środowiska 30', () => withTechnicalPackage(({ root, args }) => {
  const report = auditPackage(args, { root, inspectImage() {
    throw Object.assign(new Error('Brak identify.'), { code: 'IMAGE_INSPECT_ENVIRONMENT_FAILURE' });
  } });
  assert.equal(report.exit_code, 30);
  assert.equal(report.status, 'ENVIRONMENT_FAILURE');
  assert.equal(report.by_owner.CODEX.length, 6);
}));

test('technical: raport nie nadpisuje redakcyjnego raportu tej samej paczki', () => withTechnicalPackage(({ root, args }) => {
  const technical = auditPackage(args, { root });
  const editorial = auditPackage({ ...args, profile: 'editorial' });
  assert.equal(editorial.exit_code, 0);
  assert.equal(editorial.status, 'READY_FOR_VISUAL_REVIEW');
  assert.equal(technical.package_sha256, editorial.package_sha256);
  assert.notEqual(technical.report_file, editorial.report_file);
  assert.equal(JSON.parse(fs.readFileSync(technical.report_file, 'utf8')).profile, 'technical');
}));

test('technical: odczyt obrazu zwraca metadane bez sygnatury wizualnej', () => {
  const image = path.join(VALID_PACKAGE_DIR, 'package-audit-valid-hero-v1.jpg');
  const result = inspectImage(image, { technicalOnly: true });
  assert.ok(result.width >= 1024);
  assert.ok(result.height >= 560);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(result, 'perceptual_hash'), false);
});

test('technical: wejście CLI wybiera profil i zapisuje techniczny raport', () => withTechnicalPackage(({ file, assetsDir, args }) => {
  const result = spawnSync('node', [
    'scripts/package-audit.js', '--file', file, '--assets-dir', assetsDir,
    '--report-dir', args['report-dir'], '--profile', 'technical',
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[PACKAGE_AUDIT\]\[TECHNICAL_READY\]/);
  assert.match(result.stdout, /\[VISUAL_REVIEW\]\[NOT_IN_SCOPE\]/);
  assert.equal(fs.readdirSync(args['report-dir']).filter((name) => name.endsWith('.technical.json')).length, 1);
}));

test('NiŚOZ nie jest błędnie rozpoznawane jako angielska jednostka oz', () => {
  assert.deepEqual(unitIssues({ lead: 'Pomoc zapewniają SOR oraz NiŚOZ.' }), []);
  assert.equal(unitIssues({ lead: 'Porcja ma 2 oz.' })[0].code, 'NON_EU_UNIT');
});

test('kompletna paczka v2 z prawdziwymi obrazami przechodzi package:audit i nie blokuje article:add', () => {
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-audit-valid-'));
  const report = auditPackage({ file: VALID_PACKAGE, 'assets-dir': VALID_PACKAGE_DIR, 'report-dir': reportDir });

  assert.equal(report.status, 'READY_FOR_VISUAL_REVIEW');
  assert.equal(report.exit_code, 0);
  assert.equal(report.summary.errors, 0);
  assert.deepEqual(report.by_owner, { PISARZ: [], ILUSTRATOR: [], CODEX: [] });
  assert.equal(report.package_files.length, 7, 'JSON oraz dwa komplety JPG/WebP/AVIF');

  let nextStageCalls = 0;
  const articleStatus = executeArticleAddCore({
    file: VALID_PACKAGE,
    'assets-dir': VALID_PACKAGE_DIR,
    'dry-run': true,
  }, {
    root: reportDir,
    auditPackage: (args, dependencies) => auditPackage({ ...args, 'report-dir': reportDir }, dependencies),
    printPackageAuditReport: () => {},
    runCommand(command, args) {
      nextStageCalls += 1;
      assert.equal(command, 'node');
      assert.equal(args[0], 'scripts/article-dry-run.js');
      return { status: 10, stdout: '', stderr: '' };
    },
  });

  assert.equal(articleStatus, 10, 'article:add dochodzi do następnego etapu AWAITING_REVIEW');
  assert.equal(nextStageCalls, 1, 'package:audit nie zatrzymuje poprawnej paczki');
  fs.rmSync(reportDir, { recursive: true, force: true });
});

test('package:audit zwraca wszystkie klasy błędów w jednym raporcie i nie zmienia paczki', () => {
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-audit-report-'));
  const before = fs.readFileSync(FIXTURE, 'utf8');
  const report = auditPackage({ file: FIXTURE, 'report-dir': reportDir });
  const codes = new Set(Object.values(report.by_owner).flat().map((item) => item.code));
  for (const expected of ['FIELD_OUTSIDE_CONTRACT', 'NULL_TEXT_FIELD', 'TEXT_INSTEAD_OF_CLAIM', 'NON_EU_UNIT', 'IMAGE_FILE_MISSING', 'OVERLAY_NUMBER_UNMAPPED']) {
    assert.ok(codes.has(expected), `brak ${expected}`);
  }
  assert.ok(report.by_owner.PISARZ.length > 3);
  assert.ok(report.by_owner.ILUSTRATOR.some((item) => item.illustrator_prompt));
  assert.ok(report.by_owner.CODEX.some((item) => item.code === 'TEXT_INSTEAD_OF_CLAIM'));
  assert.ok(report.by_owner.CODEX.some((item) => item.code === 'NULL_TEXT_FIELD'));
  assert.ok(report.proposed_changes.some((item) => item.operation === 'rename_key'));
  assert.equal(report.mandatory_visual_review.status, 'PENDING');
  assert.ok(fs.existsSync(report.report_file));
  assert.equal(fs.readFileSync(FIXTURE, 'utf8'), before);
  fs.rmSync(reportDir, { recursive: true, force: true });
});

test('niepoprawny JSON blokuje kontrole zależne jako BLOCKED_DEPENDENCY', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-audit-bad-json-'));
  const file = path.join(dir, 'bad.fitpo50.json');
  fs.writeFileSync(file, '{', 'utf8');
  const report = auditPackage({ file, 'report-dir': path.join(dir, 'reports') });
  assert.equal(report.blocked_dependencies.length, 4);
  assert.ok(report.blocked_dependencies.every((item) => item.status === 'BLOCKED_DEPENDENCY'));
  fs.rmSync(file);
  assert.equal(fs.existsSync(report.report_file), true, 'raport musi przetrwać usunięcie pliku roboczego');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('tożsamość paczki obejmuje tylko JSON i zadeklarowane obrazy, a obce pliki ignoruje', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-identity-'));
  const article = { slug: 'test', image_prompts_v4: [{ filename_base: 'test-hero-v1', source_file: 'test-hero-v1.jpg' }] };
  const jsonFile = path.join(dir, 'draft.fitpo50.json');
  fs.writeFileSync(jsonFile, JSON.stringify(article));
  for (const name of ['test-hero-v1.jpg', 'test-hero-v1.webp', 'test-hero-v1.avif', 'notes.txt']) fs.writeFileSync(path.join(dir, name), name);
  const first = packageIdentity(jsonFile, dir, article);
  assert.deepEqual(first.entries.map((entry) => entry.path).sort(), ['draft.fitpo50.json', 'test-hero-v1.avif', 'test-hero-v1.jpg', 'test-hero-v1.webp']);
  assert.deepEqual(first.ignored_files, ['notes.txt']);
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'foreign-change');
  assert.equal(packageIdentity(jsonFile, dir, article).hash, first.hash);
  fs.writeFileSync(path.join(dir, 'test-hero-v1.webp'), 'changed');
  assert.notEqual(packageIdentity(jsonFile, dir, article).hash, first.hash);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('package:audit wypisuje obce pliki jako ostrzeżenia bez wpływu na hash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-foreign-'));
  const file = path.join(dir, 'multi-error.fitpo50.json');
  fs.copyFileSync(FIXTURE, file);
  fs.writeFileSync(path.join(dir, 'obcy-plik.txt'), 'nie należy do artykułu');
  const first = auditPackage({ file, 'assets-dir': dir, 'report-dir': path.join(dir, 'reports-a') });
  assert.ok(first.warnings.some((item) => item.code === 'IGNORED_FOREIGN_FILE' && item.path === 'obcy-plik.txt'));
  fs.writeFileSync(path.join(dir, 'obcy-plik.txt'), 'zmiana obcego pliku');
  const second = auditPackage({ file, 'assets-dir': dir, 'report-dir': path.join(dir, 'reports-b') });
  assert.equal(second.package_sha256, first.package_sha256);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('warianty obrazu są sprawdzane pod kątem wymiarów i proporcji', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-images-'));
  for (const ext of ['jpg', 'webp', 'avif']) fs.writeFileSync(path.join(dir, `hero-v1.${ext}`), ext);
  const article = { sections: [], sources: [], answer_blocks: [], faq_research: [], image_prompts_v4: [{ section_ref: 'hero', filename_base: 'hero-v1', source_file: 'hero-v1.jpg', aspect_ratio: '16:9', prompt_en: 'Approved prompt' }] };
  const result = imageIssues(article, dir, { inspectImage: (file) => path.extname(file) === '.webp' ? { width: 900, height: 900, aspect_ratio: 1 } : { width: 1000, height: 500, aspect_ratio: 2 } });
  assert.ok(result.some((item) => item.code === 'IMAGE_TOO_SMALL'));
  assert.ok(result.some((item) => item.code === 'IMAGE_BAD_RATIO'));
  assert.ok(result.some((item) => item.code === 'IMAGE_VARIANT_SIZE_MISMATCH'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('proces zabity sygnałem nie może być PASS', () => {
  assert.equal(normalizeCloseCode(null, 'SIGTERM'), 30);
  assert.equal(normalizeCloseCode(0, null), 0);
});

test('awaria uruchomienia walidatora Pythona ma kod środowiska 30', () => {
  const diagnostics = validateInput(FIXTURE, path.dirname(FIXTURE), { spawnSync: () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' }) });
  assert.ok(diagnostics.some((item) => item.owner === 'ENVIRONMENT' && item.rule === 'RULE_ENVIRONMENT'));
});

test('live verifier porównuje SHA-256 obrazu i PDF z markerem', () => {
  const baseUrl = 'https://fitpo50.test';
  const articleUrl = `${baseUrl}/a.html`;
  const pdfUrl = `${baseUrl}/assets/pdf/a.pdf`;
  const imageUrl = `${baseUrl}/assets/a.webp`;
  const html = Buffer.from('<link rel="canonical" href="https://fitpo50.test/a.html"><meta property="article:modified_time" content="2026-10-24T10:00:00+02:00"><script type="application/ld+json">{"dateModified":"2026-10-24T10:00:00+02:00"}</script>');
  const marker = { release_id: 'r1' };
  const responses = new Map([
    [`${baseUrl}/deployment.json`, { status: 200, body: Buffer.from(`${JSON.stringify(marker, null, 2)}\n`) }],
    [`${baseUrl}/sitemap.xml`, { status: 200, body: Buffer.from(`<url><loc>${articleUrl}</loc><lastmod>2026-10-24</lastmod></url>`) }],
    [articleUrl, { status: 200, body: html }],
    [pdfUrl, { status: 200, body: Buffer.from('%PDF-wrong') }],
    [imageUrl, { status: 200, body: Buffer.from('wrong-image') }],
  ]);
  const result = verifyDeployment({ expectedCommit: 'c', remoteCommit: 'c', marker, responses, baseUrl, baseFiles: [], articles: [{ url: articleUrl, dateModified: '2026-10-24T10:00:00+02:00', pdfUrl, expectedHtmlSha256: sha256(html), expectedPdfSha256: sha256(Buffer.from('%PDF-right')), images: [{ url: imageUrl, expectedSha256: sha256(Buffer.from('right-image')) }] }] });
  assert.match(result.errors.join('\n'), /PDF różni się|obraz różni się/);
});

test('article:add uruchamia package:audit przed jakimkolwiek etapem zapisu i zwraca kod 20', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-article-add-audit-'));
  const file = path.join(dir, 'blocked.fitpo50.json');
  fs.writeFileSync(file, '{"slug":"blocked"}\n');
  let commands = 0;
  let printed = 0;
  const report = { exit_code: 20, report_file: path.join(dir, 'report.json'), by_owner: { PISARZ: [{ code: 'A' }, { code: 'B' }], ILUSTRATOR: [], CODEX: [] } };
  const status = executeArticleAddCore({ file }, {
    root: dir,
    auditPackage: () => report,
    printPackageAuditReport: (value) => { printed += value.by_owner.PISARZ.length; },
    runCommand: () => { commands += 1; return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(status, 20);
  assert.equal(printed, 2);
  assert.equal(commands, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('brakujący format z istniejącym masterem jest propozycją techniczną CODEX bez zapisu', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-format-'));
  fs.writeFileSync(path.join(dir, 'test-hero-v1.jpg'), 'jpg');
  const article = {
    slug: 'test', sections: [], sources: [], answer_blocks: [], faq_research: [],
    image_prompts_v4: [{ section_ref: 'hero', filename_base: 'test-hero-v1', source_file: 'test-hero-v1.jpg', aspect_ratio: '16:9', prompt_en: 'Approved prompt' }],
  };
  const result = imageIssues(article, dir, { inspectImage: () => ({ width: 1080, height: 600, aspect_ratio: 1.8 }) });
  const conversions = result.filter((item) => item.code === 'IMAGE_FORMAT_MISSING');
  assert.equal(conversions.length, 2);
  assert.ok(conversions.every((item) => item.owner === 'CODEX' && item.proposed_change.operation === 'convert_image'));
  assert.equal(fs.existsSync(path.join(dir, 'test-hero-v1.webp')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('propozycja konwersji jednostek jest deterministyczna i nie zmienia wejścia', () => {
  const input = 'Waga 180 pounds, temperatura 98 °F i dystans 2 miles.';
  const proposal = metricProposal(input);
  assert.match(proposal, /81,6 kg/);
  assert.match(proposal, /36,7 °C/);
  assert.match(proposal, /3,2 km/);
  assert.equal(input, 'Waga 180 pounds, temperatura 98 °F i dystans 2 miles.');
});

test('article:cleanup-input odmawia bez live i usuwa paczkę dopiero po potwierdzeniu sluga', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-input-cleanup-'));
  const slug = 'test-live-cleanup';
  const packageDir = path.join(root, 'Downloads', 'fitpo50-json-ready', slug);
  const input = path.join(packageDir, `${slug}.fitpo50.json`);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(input, JSON.stringify({ slug, media_manifest: { entries: [] } }));
  const identity = computePreparedPackageFingerprint(input);
  const stateFile = statusPath(root, slug);
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify({ version: 1, slug, status: 'SUCCESS', input_cleanup: { status: 'AWAITING_LIVE_CONFIRMATION', path: input, package_sha256: identity.fingerprint, package_files: identity.entries } }, null, 2)}\n`);
  const url = `https://fitpo50.pl/${slug}.html`;
  fs.writeFileSync(path.join(root, 'deployment.json'), `${JSON.stringify({ version: 2, release_id: 'release-1', articles: [{ slug, url }] }, null, 2)}\n`);
  const liveFile = path.join(root, 'data', 'reports', 'local', 'deployment-live-status.json');
  fs.mkdirSync(path.dirname(liveFile), { recursive: true });
  fs.writeFileSync(liveFile, `${JSON.stringify({ status: 'DEPLOYED', release_id: 'release-1', checks: [{ type: 'ARTICLE', url, pass: false }] }, null, 2)}\n`);
  const securityFile = path.join(root, 'data', 'reports', 'local', 'security-exposure-status.json');
  fs.writeFileSync(securityFile, `${JSON.stringify({ status: 'SECURITY_EXPOSURE_PASS', release_id: 'release-1' }, null, 2)}\n`);

  assert.throws(() => cleanupArticleInput({ root, slug }), /Brak LIVE_DEPLOYED_AND_VALIDATED/iu);
  assert.equal(fs.existsSync(input), true);

  fs.writeFileSync(liveFile, `${JSON.stringify({ status: 'LIVE_DEPLOYED_AND_VALIDATED', release_id: 'release-1', checks: [{ type: 'ARTICLE', url, pass: true }] }, null, 2)}\n`);

  fs.writeFileSync(securityFile, `${JSON.stringify({ status: 'SECURITY_EXPOSURE_BLOCKED', release_id: 'release-1' }, null, 2)}\n`);
  assert.throws(() => cleanupArticleInput({ root, slug }), /Brak SECURITY_EXPOSURE_PASS/iu);
  assert.equal(fs.existsSync(input), true);

  fs.writeFileSync(securityFile, `${JSON.stringify({ status: 'SECURITY_EXPOSURE_PASS', release_id: 'other-release' }, null, 2)}\n`);
  assert.throws(() => cleanupArticleInput({ root, slug }), /Raport bezpieczeństwa nie odpowiada/iu);
  assert.equal(fs.existsSync(input), true);

  fs.writeFileSync(securityFile, `${JSON.stringify({ status: 'SECURITY_EXPOSURE_PASS', release_id: 'release-1' }, null, 2)}\n`);
  fs.writeFileSync(input, JSON.stringify({ slug, media_manifest: { entries: [] }, changed: true }));
  assert.throws(() => cleanupArticleInput({ root, slug }), /Paczkę wejściową zmieniono/iu);
  assert.equal(fs.existsSync(input), true);
  fs.writeFileSync(input, JSON.stringify({ slug, media_manifest: { entries: [] } }));

  const cleaned = cleanupArticleInput({ root, slug });
  assert.equal(cleaned.status, 'CLEANED_AFTER_LIVE_CONFIRMATION');
  assert.equal(fs.existsSync(packageDir), false);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).input_cleanup.status, 'CLEANED_AFTER_LIVE_CONFIRMATION');
  fs.rmSync(root, { recursive: true, force: true });
});
