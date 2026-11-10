const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');

const { validateFile } = require('../scripts/validate-article-standard');
const { validateTopicCenter } = require('../scripts/lib/topic-center-contract');
const contractDiff = require('../scripts/run-article-contract-diff');

const ROOT = path.resolve(__dirname, '..');
const CENTERS = ['centrum-bialka-po-50.html', 'centrum-cholesterolu-po-50.html', 'centrum-metabolizmu-po-50.html', 'centrum-nadcisnienia-po-50.html', 'centrum-snu-po-50.html', 'centrum-treningu-silowego-po-50.html'];

function centerFixture(run) {
  const root = createManagedTempDir({ prefix: 'fitpo50-faq-head-', type: 'center-faq-test', projectRoot: ROOT });
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
    for (const name of fs.readdirSync(ROOT).filter((file) => file.endsWith('.html') && !CENTERS.includes(file))) {
      fs.symlinkSync(path.join(ROOT, name), path.join(root, name));
    }
    for (const name of CENTERS) {
      const baseline = spawnSync('git', ['show', `HEAD:${name}`], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(baseline.status, 0, baseline.stderr);
      fs.writeFileSync(path.join(root, name), baseline.stdout);
    }
    git('add', '--', ...CENTERS); git('commit', '-qm', 'center fixture');
    return run(root);
  } finally { disposeTempWorkspace(root, { status: 'COMPLETED' }); }
}

function centerErrors(root, name) {
  const python = `import importlib.util,json,pathlib,sys\nspec=importlib.util.spec_from_file_location('validator',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.REPO_ROOT=pathlib.Path(sys.argv[2]).resolve(); print(json.dumps(m.validate(pathlib.Path(sys.argv[2],sys.argv[3]),changed=True)))`;
  const result = spawnSync('python3', ['-c', python, path.join(ROOT, 'scripts/validate-topic-center.py'), root, name], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('sześć centrów: zmiana listy i linków z FAQ identycznym z HEAD przechodzi', () => centerFixture((root) => {
  for (const name of CENTERS) {
    const file = path.join(root, name);
    const html = fs.readFileSync(file, 'utf8');
    const original = html.match(/class="hub-article-link" href="([^"]+)"/)[1];
    const target = 'porady.html';
    const changed = html.replace(`class="hub-article-link" href="${original}"`, `class="hub-article-link" href="${target}"`)
      .replace(`"url": "https://fitpo50.pl/${original}"`, `"url": "https://fitpo50.pl/${target}"`);
    assert.notEqual(changed, html);
    fs.writeFileSync(file, changed);
    assert.deepEqual(centerErrors(root, name), [], name);
  }
}));

test('sześć centrów: licznik artykułów może zmienić się z listą przy identycznym FAQ', () => centerFixture((root) => {
  for (const name of CENTERS) {
    const file = path.join(root, name);
    const html = fs.readFileSync(file, 'utf8');
    const changed = html.replace(
      /(<div class="hub-metric"><strong>)\d+(<\/strong><span>artykułów w centrum<\/span><\/div>)/,
      '$1999$2',
    );
    assert.notEqual(changed, html, name);
    fs.writeFileSync(file, changed);
    assert.deepEqual(centerErrors(root, name), [], name);
  }
}));

test('zmiana innej metryki centrum nadal blokuje wyjątek legacy FAQ', () => centerFixture((root) => {
  const name = 'centrum-snu-po-50.html';
  const file = path.join(root, name);
  const html = fs.readFileSync(file, 'utf8');
  const changed = html.replace(
    /(<div class="hub-metric"><strong>)\d+(<\/strong><span>pytania z odpowiedziami<\/span><\/div>)/,
    '$1999$2',
  );
  assert.notEqual(changed, html);
  fs.writeFileSync(file, changed);
  assert.ok(centerErrors(root, name).some((error) => error.includes('FAQ_RESEARCH_MANUAL_RESEARCH_LEGACY')));
}));

test('sześć centrów: zmiana FAQ, JSON-LD lub researchu blokuje wyjątek', () => centerFixture((root) => {
  for (const name of CENTERS) {
    const file = path.join(root, name);
    const html = fs.readFileSync(file, 'utf8');
    const question = html.match(/<div class="hub-faq-list"><article[^>]*><h3>([^<]+)<\/h3>/)[1];
    const variants = [
      html.replace(`<h3>${question}</h3>`, `<h3>${question} Zmiana</h3>`),
      html.replace(/(<div class="hub-faq-list"><article[^>]*><h3>[^<]+<\/h3><p>)/, '$1Zmiana odpowiedzi. '),
      html.replace(`"name": "${question}"`, `"name": "${question} Zmiana"`),
      html.replace('"source_type": "manual_research"', '"source_type": "gsc"'),
    ];
    for (const variant of variants) {
      assert.notEqual(variant, html, name);
      fs.writeFileSync(file, variant);
      assert.ok(centerErrors(root, name).some((error) => error.includes('FAQ_RESEARCH_MANUAL_RESEARCH_LEGACY')), name);
    }
  }
}));
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

test('changed topic center retains the manual_research baseline only with identical FAQ', () => {
  const center = path.join(ROOT, 'centrum-snu-po-50.html');
  const globalAudit = validateTopicCenter(center);
  const changedAudit = validateTopicCenter(center, { changed: true });

  assert.deepEqual(globalAudit.errors, []);
  assert.deepEqual(changedAudit.errors, []);
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
