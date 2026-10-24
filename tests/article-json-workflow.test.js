const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  STATUSES,
  cleanupPreparedArtifact,
  computePreparedPackageFingerprint,
  inspectPreparedArtifact,
  reportPathForJson,
  sha256File,
} = require('../scripts/lib/article-json-artifact');
const { allocateOutput, buildStageDefinitions, collectChanges, copyMediaPackage, runStagesUntilFailure } = require('../scripts/article-json-workbench');
const { executeArticleAdd, expectedPreparedPath, packageHashesMatch, preparedPathFromOutput, reviewArtifacts } = require('../scripts/article-add');
const { packageIdentity } = require('../scripts/lib/package-identity');
const {
  EXIT_CODES,
  classifyPipelineFailure,
  contentBlocked,
  statusPath,
} = require('../scripts/lib/article-pipeline-status');
const { buildAboutEntities, normalizeEntities } = require('../scripts/import-article');
const { validateScope } = require('../scripts/lib/article-scope-guard');
const { MAX_REPAIR_ATTEMPTS, readAttemptState, recordRepairFailure, resetSameDraft } = require('../scripts/lib/article-repair-attempts');
const { assertSeoPatchOverwriteAllowed } = require('../scripts/article-pipeline');
const { appendDeploymentRegistry, deploymentEntries, seoPatchesForArticle } = require('../scripts/lib/popraw-seo-deployment-registry');

const REPO = path.resolve(__dirname, '..');
const PASS_PACKAGE_AUDIT = () => ({ exit_code: 0, report_file: '/tmp/package-audit-pass.json', by_owner: { PISARZ: [], ILUSTRATOR: [], CODEX: [] } });
const SILENT_PACKAGE_AUDIT = () => {};

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-json-test-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('status lifecycle uses only DRAFT, CONTENT_READY and BLOCKED', () => {
  assert.deepEqual(Object.values(STATUSES), ['DRAFT', 'CONTENT_READY', 'BLOCKED']);
});

test('pipeline exit codes distinguish success, review, content blockers and environment failures', () => {
  assert.deepEqual(EXIT_CODES, { SUCCESS: 0, AWAITING_REVIEW: 10, CONTENT_BLOCKED: 20, ENVIRONMENT_FAILURE: 30 });
  assert.equal(classifyPipelineFailure(contentBlocked('CONTENT_READY missing')).exitCode, 20);
  assert.equal(classifyPipelineFailure(new Error('CONTENT_READY missing')).exitCode, 30);
  assert.equal(classifyPipelineFailure(new Error('spawn ENOENT')).exitCode, 30);
});

test('forced UPDATE blocks registered popraw-seo patches with exit 20 unless explicitly allowed', () => withTempDir((root) => {
  const registryDir = path.join(root, 'data', 'reports');
  fs.mkdirSync(registryDir, { recursive: true });
  fs.writeFileSync(path.join(registryDir, 'popraw-seo-deployments.json'), `${JSON.stringify({
    status: 'COMMITTED_LOCALLY_AWAITING_LIVE_DEPLOYMENT',
    targets: [
      { id: 'BOOST 7', file: 'target.html', source_pages: [{ file: 'linked-source.html' }] },
    ],
  })}\n`);

  for (const [slug, expectedRole] of [['target', 'TARGET'], ['linked-source', 'SOURCE_PAGE']]) {
    let caught;
    try {
      assertSeoPatchOverwriteAllowed({ root, slug, operation: 'UPDATE', force: true, allowOverwrite: false });
    } catch (error) {
      caught = error;
    }
    assert.equal(classifyPipelineFailure(caught).exitCode, EXIT_CODES.CONTENT_BLOCKED);
    assert.equal(caught.pipelineCode, 'SEO_PATCH_OVERWRITE_BLOCKED');
    assert.match(caught.message, new RegExp(`BOOST 7 \\(${expectedRole}: ${slug}\\.html\\)`));
    assert.match(caught.message, /--allow-overwrite-seo-patches/);
  }

  assert.deepEqual(assertSeoPatchOverwriteAllowed({
    root, slug: 'target', operation: 'UPDATE', force: true, allowOverwrite: true,
  }), []);
  assert.deepEqual(assertSeoPatchOverwriteAllowed({
    root, slug: 'target', operation: 'CREATE', force: true, allowOverwrite: false,
  }), []);
}));

test('rejestr popraw-seo zachowuje dwie kolejne fale i chroni artykuły z obu', () => {
  const first = { version: 1, generated_at: '2026-10-20T10:00:00+02:00', status: 'LIVE_DEPLOYED_AND_VALIDATED', targets: [{ id: 'BOOST 1', file: 'pierwszy.html' }] };
  const second = { version: 1, generated_at: '2026-10-21T10:00:00+02:00', status: 'COMMITTED_LOCALLY_AWAITING_LIVE_DEPLOYMENT', targets: [{ id: 'ROKUJE 2', file: 'drugi.html' }] };
  const registry = appendDeploymentRegistry(appendDeploymentRegistry(null, first), second);
  assert.equal(registry.version, 2);
  assert.deepEqual(deploymentEntries(registry).map((item) => item.targets[0].file), ['pierwszy.html', 'drugi.html']);
  assert.equal(registry.targets[0].file, 'drugi.html', 'bieżąca fala pozostaje na root dla live verify');
  assert.equal(seoPatchesForArticle(registry, 'pierwszy')[0].id, 'BOOST 1');
  assert.equal(seoPatchesForArticle(registry, 'drugi')[0].id, 'ROKUJE 2');
});

test('entity sameAs accepts only the verified exact pair and preserves name-only Thing', () => {
  assert.deepEqual(normalizeEntities(['Diabetes']), [{ '@type': 'Thing', name: 'Diabetes' }]);
  assert.deepEqual(normalizeEntities([{ name: 'Cholesterol', sameAs: 'https://www.wikidata.org/wiki/Q43656' }]), [
    { '@type': 'Thing', name: 'Cholesterol', sameAs: 'https://www.wikidata.org/wiki/Q43656' },
  ]);
  assert.throws(
    () => normalizeEntities([{ name: 'Low-density lipoprotein', sameAs: 'https://www.wikidata.org/wiki/Q159472' }]),
    /ENTITY_SAME_AS_BLOCKED/,
  );
  assert.throws(
    () => normalizeEntities([{ name: 'Cholesterol', sameAs: 'https://www.wikidata.org/wiki/Q159472' }]),
    /ENTITY_SAME_AS_BLOCKED/,
  );
});

test('generator never infers ApoB or sameAs from title, takeaways and source URLs', () => {
  const about = buildAboutEntities({
    data: {},
    title: 'Ile białka po 50 roku życia — zapotrzebowanie i odżywki',
    category: { label: 'Jedzenie' },
    keyTakeaways: ['Białko wspiera utrzymanie mięśni.'],
    sources: [{ label: 'ApoB w adresie nie jest tematem', url: 'https://example.org/apob' }],
  });
  assert.deepEqual(about, []);
});

test('workbench stops dependent stages after the first failure', () => {
  const called = [];
  const definitions = [
    { label: 'one', command: 'node', args: [] },
    { label: 'two', command: 'node', args: [] },
    { label: 'three', command: 'node', args: [] },
  ];
  const stages = runStagesUntilFailure(definitions, (label) => {
    called.push(label);
    return { label, status: label === 'two' ? 'FAIL' : 'PASS' };
  });
  assert.deepEqual(called, ['one', 'two']);
  assert.deepEqual(stages.map((item) => item.status), ['PASS', 'FAIL']);
});

test('scope guard accepts declared local fields and blocks writer-owned content', () => {
  const before = { sections: [{ paragraphs_html: ['<p>Wstęp. Dobry sen pomaga.</p>'] }], sources: [{ url: 'https://example.test/a' }] };
  const local = structuredClone(before);
  local.internal_link_plan = [];
  assert.equal(validateScope(before, local, { stage: 'ARCHITECTURE' }).ok, true);
  assert.equal(validateScope(before, local, { stage: 'MEDIA' }).ok, false);

  const verified = structuredClone(before);
  verified.evidence_verification = { version: 1, entries: {} };
  assert.equal(validateScope(before, verified, { stage: 'EVIDENCE' }).ok, true);
  assert.equal(validateScope(before, verified, { stage: 'NORMALIZATION' }).ok, false);

  const linked = structuredClone(before);
  linked.sections[0].paragraphs_html[0] = '<p>Wstęp. <a href="sen-po-50.html">Dobry sen</a> pomaga.</p>';
  assert.equal(validateScope(before, linked, { stage: 'ARCHITECTURE' }).ok, true);

  for (const field of ['sources', 'evidence_claims', 'answer_blocks', 'faq_research']) {
    const changed = structuredClone(before);
    changed[field] = [{ changed: true }];
    assert.equal(validateScope(before, changed, { stage: 'NORMALIZATION' }).ok, false, field);
  }
  const rewritten = structuredClone(before);
  rewritten.sections[0].paragraphs_html[0] = '<p>Zmieniona treść merytoryczna.</p>';
  assert.equal(validateScope(before, rewritten, { stage: 'ARCHITECTURE' }).ok, false);
});

test('repair circuit breaker is hash-bound, ignores new writer versions and supports explicit restart', () => withTempDir((dir) => {
  const slug = 'test-prob';
  assert.equal(MAX_REPAIR_ATTEMPTS, 2);
  recordRepairFailure(dir, slug, 'hash-a');
  recordRepairFailure(dir, slug, 'hash-a');
  assert.equal(readAttemptState(dir, slug, 'hash-a').repair_attempts, 2);
  assert.equal(readAttemptState(dir, slug, 'hash-b').repair_attempts, 0);
  resetSameDraft(dir, slug, 'hash-a');
  assert.equal(readAttemptState(dir, slug, 'hash-a').repair_attempts, 0);
}));

test('article:add counts content blockers from the whole command and stops before a third attempt', () => withTempDir((dir) => {
  const slug = 'limit-calego-article-add';
  const source = path.join(dir, `${slug}.fitpo50.json`);
  const outputDir = path.join(dir, 'ready');
  const prepared = path.join(outputDir, `${slug}.fitpo50.json`);
  fs.writeFileSync(source, `${JSON.stringify({ slug })}\n`);
  let pipelineCalls = 0;
  const runCommand = (_command, args) => {
    if (args[0] === 'scripts/article-json-workbench.js') {
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(prepared, `${JSON.stringify({ slug })}\n`);
      return { status: 0, stdout: `[ARTICLE-JSON] JSON: ${prepared}\n`, stderr: '' };
    }
    if (args[0] === 'scripts/article-pipeline.js') {
      pipelineCalls += 1;
      return { status: EXIT_CODES.CONTENT_BLOCKED, stdout: '', stderr: '' };
    }
    throw new Error(`Nieoczekiwane polecenie: ${args.join(' ')}`);
  };
  const args = { file: source, 'assets-dir': dir, 'output-dir': outputDir };

  const dependencies = { root: dir, runCommand, auditPackage: PASS_PACKAGE_AUDIT, printPackageAuditReport: SILENT_PACKAGE_AUDIT };
  assert.equal(executeArticleAdd(args, dependencies), EXIT_CODES.CONTENT_BLOCKED);
  assert.equal(executeArticleAdd(args, dependencies), EXIT_CODES.CONTENT_BLOCKED);
  assert.equal(readAttemptState(dir, slug, sha256File(source)).repair_attempts, 2);
  assert.throws(
    () => executeArticleAdd(args, dependencies),
    /Przekroczono limit 2 prób/,
  );
  assert.equal(pipelineCalls, 2);
}));

test('article:add dry-run forwards the explicit SEO overwrite flag and does not consume repair attempts', () => withTempDir((dir) => {
  const slug = 'dry-run-flaga-seo';
  const source = path.join(dir, `${slug}.fitpo50.json`);
  fs.writeFileSync(source, `${JSON.stringify({ slug })}\n`);
  let childArgs = [];
  const status = executeArticleAdd({
    file: source,
    'dry-run': 'true',
    'allow-overwrite-seo-patches': 'true',
  }, {
    root: dir,
    auditPackage: PASS_PACKAGE_AUDIT,
    printPackageAuditReport: SILENT_PACKAGE_AUDIT,
    runCommand(_command, args) {
      childArgs = args;
      return { status: EXIT_CODES.CONTENT_BLOCKED, stdout: '', stderr: '' };
    },
  });
  assert.equal(status, EXIT_CODES.CONTENT_BLOCKED);
  assert.ok(childArgs.includes('--allow-overwrite-seo-patches'));
  assert.equal(readAttemptState(dir, slug, sha256File(source)).repair_attempts, 0);
}));

test('content blockers run before media conversion and the final package preflight', () => {
  const labels = buildStageDefinitions('/tmp/article.json', '/tmp/assets').map((item) => item.label);
  assert.equal(labels[0], 'Szybki odbiór paczki Pisarz + Ilustrator');
  assert.ok(labels.indexOf('Szybki odbiór paczki Pisarz + Ilustrator') < labels.indexOf('Kontrakt wejściowy treści, FAQ, dowodów i promptów obrazów'));
  assert.ok(labels.indexOf('Kontrakt wejściowy treści, FAQ, dowodów i promptów obrazów') < labels.indexOf('Lokalna intencja, kanibalizacja, linkowanie i centra'));
  assert.ok(labels.indexOf('Pełny preflight treści przed kosztowną obróbką mediów') < labels.indexOf('Pakiet mediów: nazwy, warianty, jakość i różnorodność'));
  assert.ok(labels.indexOf('Pakiet mediów: nazwy, warianty, jakość i różnorodność') < labels.indexOf('Kontrola mapowania dowodów po dodaniu podpisów mediów'));
  assert.ok(labels.indexOf('Domknięcie mapowania dowodów po dodaniu podpisów mediów') < labels.indexOf('Bramka kompletnego JSON'));
  assert.ok(labels.indexOf('Pakiet mediów: nazwy, warianty, jakość i różnorodność') < labels.indexOf('Końcowy preflight pakietu importowego'));
});

test('article:add content gate rejects manual_research before import', () => withTempDir((dir) => {
  const fixture = JSON.parse(fs.readFileSync(
    path.join(REPO, 'tests/fixtures/article-packages/zmiana-czasu-corrected.fitpo50.json'),
    'utf8',
  ));
  fixture.faq_research[0].source_type = 'manual_research';
  const file = path.join(dir, 'manual-research.fitpo50.json');
  fs.writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
  const result = spawnSync('node', ['scripts/json-fitpo50-gate-diff.js', '--file', file], { cwd: REPO, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /source_type musi być jednym z: gsc, paa, autocomplete/);
}));

test('workbench reuses one stable ready file unless revision history is explicitly requested', () => withTempDir((dir) => {
  const first = allocateOutput(dir, 'testowy-artykul');
  fs.writeFileSync(first, '{}');
  assert.equal(allocateOutput(dir, 'testowy-artykul'), first);
  assert.match(allocateOutput(dir, 'testowy-artykul', true), /-r2\.fitpo50\.json$/);
}));

test('one-command controller reads the prepared artifact path from workbench output', () => {
  assert.equal(preparedPathFromOutput('[ARTICLE-JSON] status=CONTENT_READY\n[ARTICLE-JSON] JSON: /tmp/gotowy.fitpo50.json\n'), '/tmp/gotowy.fitpo50.json');
});

test('one-command controller exposes predictable review artifacts', () => {
  assert.deepEqual(reviewArtifacts('/tmp/stage', 'testowy-artykul'), {
    stage_root: '/tmp/stage',
    review_template: '/tmp/stage/.tmp/article-preview/testowy-artykul/visual-review-template.json',
    desktop: '/tmp/stage/.tmp/article-preview/testowy-artykul/desktop.png',
    mobile: '/tmp/stage/.tmp/article-preview/testowy-artykul/mobile.png',
    pdf_pages: '/tmp/stage/.tmp/article-preview/testowy-artykul/pdf-pages',
  });
});

test('changed JSON never silently reuses an older review transaction', () => withTempDir((dir) => {
  const source = path.join(dir, 'zmieniony-artykul.json');
  fs.writeFileSync(source, `${JSON.stringify({ slug: 'zmieniony-artykul', title: 'Zmieniony artykuł' })}\n`);
  const stateFile = statusPath(dir, 'zmieniony-artykul');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify({
    status: 'AWAITING_REVIEW',
    source_sha256: 'stary-hash',
    next_args: { stage_root: '/tmp/stary-stage', input_file: '/tmp/stary.fitpo50.json' },
  })}\n`);
  const status = executeArticleAdd({ file: source }, {
    root: dir,
    auditPackage: PASS_PACKAGE_AUDIT,
    printPackageAuditReport: SILENT_PACKAGE_AUDIT,
    runCommand() {
      throw new Error('Nie wolno uruchamiać kolejnego etapu dla zmienionego JSON-u.');
    },
  });
  assert.equal(status, EXIT_CODES.CONTENT_BLOCKED);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).status, 'AWAITING_REVIEW');
}));

test('article:add prowadzi poprawny fixture przez przygotowanie i atom publikacyjny', () => withTempDir((dir) => {
  const source = path.join(dir, 'kontrolowany-fixture.json');
  const outputDir = path.join(dir, 'ready');
  const prepared = path.join(outputDir, 'kontrolowany-fixture.fitpo50.json');
  fs.writeFileSync(source, `${JSON.stringify({ slug: 'kontrolowany-fixture', title: 'Kontrolowany fixture' })}\n`);
  const calls = [];
  const status = executeArticleAdd({ file: source, 'output-dir': outputDir, 'allow-overwrite-seo-patches': true }, {
    auditPackage: PASS_PACKAGE_AUDIT,
    printPackageAuditReport: SILENT_PACKAGE_AUDIT,
    runCommand(command, args) {
      calls.push({ command, args });
      if (args[0] === 'scripts/article-json-workbench.js') {
        fs.mkdirSync(outputDir, { recursive: true });
        fs.copyFileSync(source, prepared);
        return { status: 0, stdout: `[ARTICLE-JSON] status=CONTENT_READY\n[ARTICLE-JSON] JSON: ${prepared}\n`, stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.equal(status, 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args[0], 'scripts/article-json-workbench.js');
  assert.equal(calls[1].args[0], 'scripts/article-pipeline.js');
  assert.ok(calls[1].args.includes(prepared));
  assert.ok(calls[1].args.includes('--allow-overwrite-seo-patches'));
}));

test('one-command controller reuses only a hash-identical CONTENT_READY package', () => withTempDir((dir) => {
  const sourceDir = path.join(dir, 'source');
  const readyDir = path.join(dir, 'ready');
  fs.mkdirSync(sourceDir);
  fs.mkdirSync(readyDir);
  const source = path.join(sourceDir, 'test.fitpo50.json');
  const prepared = path.join(readyDir, 'test.fitpo50.json');
  const image = path.join(sourceDir, 'hero.png');
  const packagedImage = path.join(readyDir, 'hero.png');
  fs.writeFileSync(image, 'image-v1');
  fs.copyFileSync(image, packagedImage);
  const imageHash = sha256File(image);
  const json = {
    slug: 'test',
    image_prompts_v4: [{ filename_base: 'test-hero-v1', source_file: 'hero.png' }],
    media_manifest: { entries: [{ source_file: 'hero.png', source: { sha256: imageHash }, variants: {} }] },
  };
  fs.writeFileSync(source, `${JSON.stringify(json)}\n`);
  fs.writeFileSync(prepared, `${JSON.stringify(json)}\n`);
  const packageState = computePreparedPackageFingerprint(prepared, json);
  const sourcePackage = packageIdentity(source, sourceDir, json);
  fs.writeFileSync(reportPathForJson(prepared), `${JSON.stringify({ status: STATUSES.CONTENT_READY, source_file: source, source_sha256: sha256File(source), source_package_sha256: sourcePackage.hash, source_package_files: sourcePackage.entries, output_file: prepared, output_sha256: sha256File(prepared), package_sha256: packageState.fingerprint, package_files: packageState.entries })}\n`);
  assert.equal(packageHashesMatch(source, sourceDir, prepared), true);
  fs.writeFileSync(path.join(sourceDir, 'test-hero-v1.webp'), 'new-variant');
  assert.equal(packageHashesMatch(source, sourceDir, prepared), false);
  fs.rmSync(path.join(sourceDir, 'test-hero-v1.webp'));
  fs.writeFileSync(image, 'image-v2');
  assert.equal(packageHashesMatch(source, sourceDir, prepared), false);
}));

test('custom output directory has one predictable prepared path', () => withTempDir((dir) => {
  const source = path.join(dir, 'draft.json');
  fs.writeFileSync(source, '{"slug":"przewidywalny-slug"}\n');
  assert.equal(expectedPreparedPath(source, path.join(dir, 'ready')), path.join(dir, 'ready', 'przewidywalny-slug.fitpo50.json'));
}));

test('change report records additions, replacements and removals with JSON paths', () => {
  const changes = collectChanges(
    { title: 'A', old: true, sections: [{ heading: 'H2' }] },
    { title: 'B', sections: [{ heading: 'H2', body: 'Treść' }] },
  );
  assert.deepEqual(changes.map((item) => [item.path, item.operation]), [
    ['$.old', 'REMOVE'],
    ['$.sections[0].body', 'ADD'],
    ['$.title', 'REPLACE'],
  ]);
});

test('ready package copies only exact media files named by the manifest', () => withTempDir((dir) => {
  const source = path.join(dir, 'source');
  const target = path.join(dir, 'ready');
  fs.mkdirSync(source);
  for (const name of ['hero.png', 'hero.jpg', 'hero.webp', 'hero.avif', 'unrelated.jpg']) fs.writeFileSync(path.join(source, name), name);
  copyMediaPackage({ entries: [{ source_file: 'hero.png', variants: {
    jpg: { file: 'hero.jpg' }, webp: { file: 'hero.webp' }, avif: { file: 'hero.avif' },
  } }] }, source, target);
  assert.deepEqual(fs.readdirSync(target).sort(), ['hero.avif', 'hero.jpg', 'hero.png', 'hero.webp']);
}));

test('prepared artifact is rejected after any post-review JSON change', () => withTempDir((dir) => {
  const file = path.join(dir, 'nowy-artykul.fitpo50.json');
  fs.writeFileSync(file, '{"slug":"nowy-artykul","title":"Wersja gotowa"}\n');
  const report = {
    status: STATUSES.CONTENT_READY,
    output_file: file,
    output_sha256: sha256File(file),
    package_sha256: computePreparedPackageFingerprint(file).fingerprint,
  };
  fs.writeFileSync(reportPathForJson(file), `${JSON.stringify(report)}\n`);
  assert.equal(inspectPreparedArtifact(file, REPO).ok, true);

  fs.writeFileSync(file, '{"slug":"nowy-artykul","title":"Zmieniono po kontroli"}\n');
  const inspected = inspectPreparedArtifact(file, REPO);
  assert.equal(inspected.ok, false);
  assert.match(inspected.errors.join(' '), /SHA-256/);
}));

test('prepared artifact is rejected after any packaged image change', () => withTempDir((dir) => {
  const file = path.join(dir, 'pakiet.fitpo50.json');
  const image = path.join(dir, 'hero.png');
  fs.writeFileSync(image, 'approved-image');
  const json = { slug: 'pakiet', media_manifest: { entries: [{ source_file: 'hero.png', variants: {} }] } };
  fs.writeFileSync(file, `${JSON.stringify(json)}\n`);
  const state = computePreparedPackageFingerprint(file, json);
  fs.writeFileSync(reportPathForJson(file), `${JSON.stringify({
    status: STATUSES.CONTENT_READY, output_file: file, output_sha256: sha256File(file), package_sha256: state.fingerprint,
  })}\n`);
  assert.equal(inspectPreparedArtifact(file, REPO).ok, true);
  fs.writeFileSync(image, 'changed-image');
  const result = inspectPreparedArtifact(file, REPO);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /całej paczki/);
}));

test('successful-publish cleanup removes only the ready JSON and its two reports', () => withTempDir((dir) => {
  const file = path.join(dir, 'gotowy.fitpo50.json');
  const report = reportPathForJson(file);
  const markdown = file.replace(/\.fitpo50\.json$/i, '.fitpo50.report.md');
  const unrelated = path.join(dir, 'grafika.webp');
  for (const target of [file, report, markdown, unrelated]) fs.writeFileSync(target, 'test');

  const result = cleanupPreparedArtifact(file);
  assert.deepEqual(result.removed.sort(), [file, report, markdown].sort());
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(report), false);
  assert.equal(fs.existsSync(markdown), false);
  assert.equal(fs.existsSync(unrelated), true);
}));

test('successful publish removes the complete generated ready package but preserves sibling packages', () => withTempDir((dir) => {
  const readyRoot = path.join(dir, 'fitpo50-json-ready');
  const packageDir = path.join(readyRoot, 'marsz-japonski');
  const siblingDir = path.join(readyRoot, 'inny-artykul');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(siblingDir, { recursive: true });
  const file = path.join(packageDir, 'marsz-japonski-r6.fitpo50.json');
  fs.writeFileSync(file, '{}');
  fs.writeFileSync(path.join(packageDir, 'marsz-japonski-r5.fitpo50.json'), '{}');
  fs.writeFileSync(path.join(packageDir, 'grafika.webp'), 'media');
  fs.writeFileSync(path.join(siblingDir, 'inny-artykul.fitpo50.json'), '{}');

  const result = cleanupPreparedArtifact(file);

  assert.deepEqual(result.removed_directories, [packageDir]);
  assert.equal(fs.existsSync(packageDir), false);
  assert.equal(fs.existsSync(siblingDir), true);
}));

test('published package cleanup reports EPERM without turning a completed publication into failure', () => withTempDir((dir) => {
  const packageDir = path.join(dir, 'fitpo50-json-ready', 'nowy-artykul');
  fs.mkdirSync(packageDir, { recursive: true });
  const file = path.join(packageDir, 'nowy-artykul.fitpo50.json');
  fs.writeFileSync(file, '{}');
  const blockedRemove = () => {
    const error = new Error('Operation not permitted');
    error.code = 'EPERM';
    throw error;
  };

  const result = cleanupPreparedArtifact(file, { remove: blockedRemove });

  assert.deepEqual(result.removed_directories, []);
  assert.deepEqual(result.retained, [{ path: packageDir, code: 'EPERM' }]);
  assert.equal(fs.existsSync(file), true);
}));

test('existing slug produces durable BLOCKED JSON and never touches HTML', () => withTempDir((dir) => {
  const slug = 'apob-norma-cena-jak-czytac-wynik';
  const existingHtml = path.join(REPO, `${slug}.html`);
  assert.equal(fs.existsSync(existingHtml), true, 'fixture HTML must exist');
  const htmlHashBefore = sha256File(existingHtml);
  const source = path.join(dir, 'incoming.json');
  const sourceText = `${JSON.stringify({ slug, title: 'Kontrolowany draft' }, null, 2)}\n`;
  fs.writeFileSync(source, sourceText);
  const outputDir = path.join(dir, 'ready');
  const result = spawnSync('node', [
    'scripts/article-json-workbench.js',
    '--file', source,
    '--output-dir', outputDir,
  ], { cwd: REPO, encoding: 'utf8' });

  assert.equal(result.status, 2);
  assert.equal(fs.readFileSync(source, 'utf8'), sourceText);
  assert.equal(sha256File(existingHtml), htmlHashBefore);
  const output = path.join(outputDir, `${slug}.fitpo50.json`);
  assert.equal(fs.existsSync(output), true);
  const report = JSON.parse(fs.readFileSync(reportPathForJson(output), 'utf8'));
  assert.equal(report.status, STATUSES.BLOCKED);
  assert.equal(report.html_created, false);
  assert.equal(report.source_preserved, true);
  assert.deepEqual(report.status_history.map((item) => item.status), [STATUSES.DRAFT, STATUSES.BLOCKED]);
  assert.match(report.blockers.join(' '), /force=false/);
}));

test('malformed input is retained as durable BLOCKED JSON with a parse report', () => withTempDir((dir) => {
  const source = path.join(dir, 'uszkodzony-draft.json');
  const sourceText = '{"slug":"uszkodzony-draft", "sections": [}\n';
  fs.writeFileSync(source, sourceText);
  const outputDir = path.join(dir, 'ready');
  const result = spawnSync('node', [
    'scripts/article-json-workbench.js',
    '--file', source,
    '--output-dir', outputDir,
  ], { cwd: REPO, encoding: 'utf8' });

  assert.equal(result.status, 2);
  const output = path.join(outputDir, 'uszkodzony-draft.fitpo50.json');
  assert.equal(fs.readFileSync(output, 'utf8'), sourceText);
  const report = JSON.parse(fs.readFileSync(reportPathForJson(output), 'utf8'));
  assert.equal(report.status, STATUSES.BLOCKED);
  assert.match(report.blockers.join(' '), /składnia JSON/);
  assert.equal(report.html_created, false);
}));

test('publisher rejects raw JSON without a CONTENT_READY report before creating HTML', () => withTempDir((dir) => {
  const slug = `mechanizm-3-test-${Date.now()}`;
  const source = path.join(dir, `${slug}.fitpo50.json`);
  fs.writeFileSync(source, `${JSON.stringify({ slug, title: 'Surowy draft' })}\n`);
  const html = path.join(REPO, `${slug}.html`);
  const result = spawnSync('node', ['scripts/article-pipeline.js', '--file', source], {
    cwd: REPO,
    encoding: 'utf8',
  });

  assert.equal(result.status, 20);
  assert.match(`${result.stdout}\n${result.stderr}`, /CONTENT_READY/);
  assert.equal(fs.existsSync(html), false);
}));

test('direct importer cannot bypass CONTENT_READY protection', () => withTempDir((dir) => {
  const slug = `mechanizm-3-importer-${Date.now()}`;
  const source = path.join(dir, `${slug}.fitpo50.json`);
  fs.writeFileSync(source, `${JSON.stringify({ slug, title: 'Surowy draft' })}\n`);
  const html = path.join(REPO, `${slug}.html`);
  const result = spawnSync('node', ['scripts/import-article.js', '--file', source, '--publish', 'true'], {
    cwd: REPO,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /CONTENT_READY/);
  assert.equal(fs.existsSync(html), false);
}));

test('private staging mode cannot be used to bypass the transactional controller', () => withTempDir((dir) => {
  const source = path.join(dir, 'raw.fitpo50.json');
  fs.writeFileSync(source, '{"slug":"raw-staging-bypass"}\n');
  const result = spawnSync('node', ['scripts/article-pipeline.js', '--file', source, '--staging-internal', 'true'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.equal(result.status, 20);
  assert.match(`${result.stdout}\n${result.stderr}`, /CONTENT_READY|prywatnym trybem/);
}));
