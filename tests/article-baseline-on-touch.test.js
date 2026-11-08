const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validateFile } = require('../scripts/validate-article-standard');
const { validateTopicCenter } = require('../scripts/lib/topic-center-contract');
const contractDiff = require('../scripts/run-article-contract-diff');

const ROOT = path.resolve(__dirname, '..');
test('four-sentence GŁÓWNA 5 quick answer passes global and changed HTML validation', () => {
  const quickAnswerLimit = /Szybka odpowiedź musi zawierać 1-5 pełnych zdań/;
  const article = path.join(ROOT, 'trening-silowy-eliksir-mlodosci-po-50.html');
  const globalAudit = validateFile(article);
  const changedAudit = validateFile(article, { strictChanged: true });

  assert.equal(globalAudit.errors.some((error) => quickAnswerLimit.test(error)), false);
  assert.equal(changedAudit.errors.some((error) => quickAnswerLimit.test(error)), false);
  assert.equal(globalAudit.warnings.some((warning) => quickAnswerLimit.test(warning)), false);
});

test('changed article still accepts four sentences after the 1-5 contract change', () => {
  const article = path.join(ROOT, 'co-sie-dzieje-z-cialem-gdy-nie-trenujesz-2-tygodnie.html');
  const globalAudit = validateFile(article);
  const changedAudit = validateFile(article, { strictChanged: true });

  assert.equal(globalAudit.errors.some((error) => /Szybka odpowiedź musi zawierać 1-5 pełnych zdań/.test(error)), false);
  assert.equal(changedAudit.errors.some((error) => /Szybka odpowiedź musi zawierać 1-5 pełnych zdań/.test(error)), false);
});

test('changed topic center cannot use the manual_research baseline', () => {
  const center = path.join(ROOT, 'centrum-snu-po-50.html');
  const globalAudit = validateTopicCenter(center);
  const changedAudit = validateTopicCenter(center, { changed: true });

  assert.deepEqual(globalAudit.errors, []);
  assert.match(changedAudit.errors.join('\n'), /FAQ_RESEARCH_MANUAL_RESEARCH_LEGACY/);
});

test('changed legacy article cannot use the legacy title-date tolerance', () => {
  const name = 'apob-norma-cena-jak-czytac-wynik.html';
  const source = fs.readFileSync(path.join(ROOT, name), 'utf8');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-b3-title-'));
  const fixture = path.join(root, name);
  try {
    fs.writeFileSync(fixture, source.replace(/<title>[\s\S]*?<\/title>/i, '<title>Za krótki | FitPo50</title>'));
    const globalAudit = validateFile(fixture);
    const changedAudit = validateFile(fixture, { strictChanged: true });
    assert.equal(globalAudit.errors.some((error) => error.startsWith('HTML title base:')), false);
    assert.ok(changedAudit.errors.some((error) => error.startsWith('HTML title base:')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('every current contract error blocks a changed article even when origin/main has the same error', () => {
  assert.equal(typeof contractDiff.classifyContractResult, 'function');
  const result = contractDiff.classifyContractResult(
    { errors: ['stary błąd kontraktu'], warnings: [] },
    { errors: ['stary błąd kontraktu'], warnings: [] },
  );

  assert.deepEqual(result.blockingErrors, ['stary błąd kontraktu']);
  assert.deepEqual(result.preExistingErrors, ['stary błąd kontraktu']);
});

test('a new article plus listing files selects only that new article for changed validation', () => {
  assert.equal(typeof contractDiff.changedArticleFilesFromNameStatus, 'function');
  const changes = [
    'A\tnowy-artykul-po-50.html',
    'M\tindex.html',
    'M\tporady.html',
    'M\tzdrowie.html',
  ].join('\n');
  const selected = contractDiff.changedArticleFilesFromNameStatus(changes, {
    isArticle: (file) => file === 'nowy-artykul-po-50.html' || file === 'stary-artykul.html',
  });

  assert.deepEqual(selected, ['nowy-artykul-po-50.html']);
  assert.equal(selected.includes('stary-artykul.html'), false);
});
