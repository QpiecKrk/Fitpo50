'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { auditPackage, imageIssues } = require('../scripts/package-audit');
const { packageIdentity } = require('../scripts/lib/package-identity');
const { normalizeCloseCode } = require('../scripts/prepush-parallel-checks');
const { verifyDeployment, sha256 } = require('../scripts/lib/deployment-live-verifier');
const { validateInput } = require('../scripts/article-dry-run');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'package-audit', 'multi-error.fitpo50.json');

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

test('tożsamość paczki obejmuje JSON, AVIF, WebP, JPG i każdy dodatkowy plik', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-package-identity-'));
  const article = { image_prompts_v4: [{ filename_base: 'hero-v1', source_file: 'hero-v1.jpg' }] };
  const jsonFile = path.join(dir, 'draft.fitpo50.json');
  fs.writeFileSync(jsonFile, JSON.stringify(article));
  for (const name of ['hero-v1.jpg', 'hero-v1.webp', 'hero-v1.avif', 'notes.txt']) fs.writeFileSync(path.join(dir, name), name);
  const first = packageIdentity(jsonFile, dir, article);
  assert.deepEqual(first.entries.map((entry) => entry.path).sort(), ['draft.fitpo50.json', 'hero-v1.avif', 'hero-v1.jpg', 'hero-v1.webp', 'notes.txt']);
  fs.writeFileSync(path.join(dir, 'hero-v1.webp'), 'changed');
  assert.notEqual(packageIdentity(jsonFile, dir, article).hash, first.hash);
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
