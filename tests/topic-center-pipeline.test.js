const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pageKind } = require('../scripts/lib/publication-page-kind');
const { buildPatchedFiles, buildDeploymentManifest } = require('../scripts/lib/popraw-seo-approved-patches');
const { isA4Page } = require('../scripts/article-preview-gate');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

const APPROVED_BASELINE_CEILING = new Map([
  ['Szybka odpowiedź musi zawierać 1-3 pełne zdania (jest 4).', new Set([
    'apob-norma-cena-jak-czytac-wynik.html',
    'co-sie-dzieje-z-cialem-gdy-nie-trenujesz-2-tygodnie.html',
    'dieta-keto-cholesterol-ldl-hdl-badania-naukowe.html',
    'healthspan-nie-lifespan-po-50.html',
    'hfpef-niewydolnosc-serca-zachowana-frakcja-wyrzutowa-po-50.html',
    'hrt-mit-badanie-po-50.html',
    'jak-czytac-etykiety-sklad-produktow-e-numery-inci.html',
    'jak-pozbyc-sie-oponki-brzusznej-po-50.html',
    'jak-zaczac-na-silowni-po-50.html',
    'jak-zaczac-sie-podciagac-po-50.html',
    'kreatyna-i-bialko-po-50-tce-jak-laczyc.html',
    'kreatyna-po-50-tce-kompletny-przewodnik.html',
    'kriokomory-i-komory-hiperbaryczne-bezpieczenstwo-po-50.html',
    'markery-krwi-co-naprawde-mowia-o-twoim-zdrowiu.html',
    'mira-ai-agent-sor-lepszy-od-lekarzy.html',
    'mit-jedzenie-cie-truje-owoce-wegle-tluszcz-sol.html',
    'motywacja-po-50.html',
    'nordic-walking-jak-zaczac-technika-kije-zdrowie.html',
    'okulary-do-czytania-trening-akomodacji-oka.html',
    'optymalizacja-snu-po-50-jak-przestac-budzic-sie-o-3-w-nocy.html',
    'regeneracja-ukladu-nerwowego-co-mowi-nauka.html',
    'sakady-supresja-sakadyczna-mozg-ukrywa-slepe-chwile.html',
    'sarkopeniczna-otylosc-problem-ktorego-nie-widac-w-lustrze.html',
    'sen-po-50.html',
    'silownia-chroni-serce-przed-zawalem.html',
    'suplementacja-po-50.html',
    'szczepionki-covid-skutki-uboczne-mity-i-fakty.html',
    'trening-silowy-eliksir-mlodosci-po-50.html',
    'ukryty-cukier-po-50-pulapki-zdrowego-jedzenia.html',
    'waty-apple-watch-moc-zdrowie-po-50.html',
    'zastrzyk-cofajacy-starzenie-komorek-er-100-zycie-biosciences.html',
    'zegar-epigenetyczny-horvatha-wiek-biologiczny-metylacja-dna.html',
  ])],
  ['FAQ_RESEARCH_MANUAL_RESEARCH_LEGACY', new Set([
    'centrum-bialka-po-50.html',
    'centrum-cholesterolu-po-50.html',
    'centrum-metabolizmu-po-50.html',
    'centrum-nadcisnienia-po-50.html',
    'centrum-snu-po-50.html',
    'centrum-treningu-silowego-po-50.html',
  ])],
]);

function baselineGrowthViolations(baseline) {
  const violations = [];
  for (const item of baseline.known_errors || []) {
    const approvedFiles = APPROVED_BASELINE_CEILING.get(item.error);
    if (!approvedFiles) {
      violations.push(`new error type: ${item.error}`);
      continue;
    }
    for (const file of item.files || []) {
      if (!approvedFiles.has(file)) violations.push(`${item.error}: ${file}`);
    }
  }
  return violations;
}

test('center contract rejects duplicate schema, missing evidence, broken links and FAQ mismatch', () => {
  const repo = path.resolve(__dirname, '..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'center-contract-'));
  const name = 'centrum-snu-po-50.html';
  const valid = fs.readFileSync(path.join(__dirname, 'fixtures/topic-centers', name), 'utf8');
  const validNew = valid.replaceAll('"source_type": "manual_research"', '"source_type": "paa"');
  for (const file of fs.readdirSync(repo).filter((file) => file.endsWith('.html') && file !== name)) {
    fs.symlinkSync(path.join(repo, file), path.join(root, file));
  }
  const run = (html) => {
    fs.writeFileSync(path.join(root, name), html);
    return spawnSync('python3', [path.join(repo, 'scripts/validate-topic-center.py'), path.join(root, name)], {encoding: 'utf8'});
  };
  const result = run(validNew);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const cases = [
    [validNew.replace('</head>', '<script type="application/ld+json">{"@type":"BlogPosting"}</script></head>'), 'bez duplikatów'],
    [validNew.replaceAll('data-evidence=', 'data-unused='), 'wykorzystane przy konkretnej tezie'],
    [validNew.replace('href="sen-po-50.html"', 'href="missing.html"'), 'Uszkodzony link'],
    [validNew.replace('Ile godzin snu zaleca się dorosłym?</h3>', 'Inne pytanie?</h3>'), 'FAQ HTML i schema'],
    [validNew.replace('class="hub-article-link"', 'class="other-link"'), 'ItemList'],
  ];
  for (const [html, error] of cases) {
    const failed = run(html);
    assert.notEqual(failed.status, 0, error);
    assert.ok(failed.stdout.includes(error), failed.stdout + failed.stderr);
  }
});

test('only the six exact published centers retain the manual_research baseline', () => {
  const repo = path.resolve(__dirname, '..');
  const legacyCenters = [
    'centrum-bialka-po-50.html',
    'centrum-cholesterolu-po-50.html',
    'centrum-metabolizmu-po-50.html',
    'centrum-nadcisnienia-po-50.html',
    'centrum-snu-po-50.html',
    'centrum-treningu-silowego-po-50.html',
  ];
  for (const name of legacyCenters) {
    const result = spawnSync('python3', [path.join(repo, 'scripts/validate-topic-center.py'), path.join(repo, name)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${name}\n${result.stdout}\n${result.stderr}`);
  }

  const template = path.join(repo, 'templates/topic-centers/centrum-snu-po-50.html');
  const rejectedTemplate = spawnSync('python3', [path.join(repo, 'scripts/validate-topic-center.py'), template], { encoding: 'utf8' });
  assert.notEqual(rejectedTemplate.status, 0);
  assert.match(rejectedTemplate.stdout, /FAQ_RESEARCH_MANUAL_RESEARCH_LEGACY/);
});

test('every published topic center is listed in llms.txt and generated llms-full.txt', () => {
  const centers = fs.readdirSync(REPO).filter((file) => /^centrum-.*\.html$/.test(file)).sort();
  const llms = fs.readFileSync(path.join(REPO, 'llms.txt'), 'utf8');
  const full = fs.readFileSync(path.join(REPO, 'llms-full.txt'), 'utf8');
  assert.equal(centers.length, 6);
  for (const center of centers) {
    const url = `https://fitpo50.pl/${center}`;
    assert.match(llms, new RegExp(`^- url: ${url.replaceAll('.', '\\.')}$`, 'm'), `${center} missing from llms.txt`);
    assert.match(full, new RegExp(`^URL: ${url.replaceAll('.', '\\.')}$`, 'm'), `${center} missing from llms-full.txt`);
  }
});

test('article validation baseline can only shrink from the frozen approved ceiling', () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/config/article-validation-baseline.json'), 'utf8'));
  assert.deepEqual(baselineGrowthViolations(baseline), []);

  const removal = structuredClone(baseline);
  removal.known_errors[0].files.pop();
  assert.deepEqual(baselineGrowthViolations(removal), []);

  const addition = structuredClone(baseline);
  addition.known_errors[0].files.push('nowy-artykul.html');
  assert.match(baselineGrowthViolations(addition).join('\n'), /nowy-artykul\.html/);

  const substitution = structuredClone(baseline);
  substitution.known_errors[1].files[0] = 'centrum-nowe-po-50.html';
  assert.match(baselineGrowthViolations(substitution).join('\n'), /centrum-nowe-po-50\.html/);

  const newErrorType = structuredClone(baseline);
  newErrorType.known_errors.push({ error: 'NOWY_TYP_BŁĘDU', files: ['sen-po-50.html'] });
  assert.match(baselineGrowthViolations(newErrorType).join('\n'), /new error type: NOWY_TYP_BŁĘDU/);
});

test('A4 accepts Chromium rounding but rejects Letter, landscape and missing dimensions', () => {
  assert.ok(isA4Page('Page size: 594.96 x 841.92 pts (A4)'));
  assert.ok(isA4Page('Page size: 595.276 x 841.89 pts (A4)'));
  assert.equal(isA4Page('Page size: 612 x 792 pts (letter)'), false);
  assert.equal(isA4Page('Page size: 841.89 x 595.276 pts (A4)'), false);
  assert.equal(isA4Page(''), false);
});

test('whole-page deployment verifies final dates and generated PDF metadata', () => {
  const finalHtml = '<!DOCTYPE html><html><head><meta content="2026-09-05"></head><body>PDF 547 KB</body></html>';
  const items = [{id: 'BOOST 1', file: 'center.html', operations: [{after: '<!DOCTYPE html><html>Draft</html>'}]}];
  const deployment = buildDeploymentManifest({manifest: {}, items, contents: new Map([['center.html', finalHtml]]), targetFiles: ['center.html'], iso: '2026-09-05T10:00:00+02:00'});
  assert.deepEqual(deployment.targets[0].content_needles, [finalHtml]);
});

test('layout, not BlogPosting or filename, selects the publication contract', () => {
  assert.equal(pageKind('<div class="hub-shell"><main><h1 id="hub-title">Sen</h1></main></div>'), 'topic_center');
  assert.equal(pageKind("<article id='body' class='reveal article-content'>Treść</article>"), 'article');
  assert.equal(pageKind('<script>{"@type":"BlogPosting"}</script>'), 'unsupported');
});

test('a linked source center receives dates, PDF and live validation obligations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'center-pipeline-'));
  const html = '<meta property="article:modified_time" content="2026-08-01T10:00:00+02:00"><script>{"@type":"BlogPosting","dateModified":"2026-08-01T10:00:00+02:00"}</script><div class="hub-shell"><main><h1 id="hub-title">Sen</h1><p>Rytm snu.</p></main></div>';
  fs.writeFileSync(path.join(root, 'target.html'), html);
  fs.writeFileSync(path.join(root, 'support.html'), html);
  const items = [{ id: 'BOOST 1', file: 'target.html', operations: [
    { before: 'Rytm snu.', after: 'Dzienniczek snu.' },
    { file: 'support.html', before: 'Rytm snu.', after: '<a href="target.html">Dzienniczek snu</a>.' },
  ] }];
  const iso = '2026-09-05T10:00:00+02:00';
  const result = buildPatchedFiles({}, items, root, iso);
  assert.deepEqual(new Set(result.articleFiles), new Set(['target.html', 'support.html']));
  assert.ok(result.contents.get('support.html').includes(iso));
  const deployment = buildDeploymentManifest({ manifest: {}, items, contents: result.contents, targetFiles: result.targetFiles, iso });
  assert.equal(deployment.targets[0].source_pages[0].pdf_url, 'https://fitpo50.pl/assets/pdf/support.pdf');
});
