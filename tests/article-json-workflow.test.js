const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  STATUSES,
  cleanupPreparedArtifact,
  inspectPreparedArtifact,
  reportPathForJson,
  sha256File,
} = require('../scripts/lib/article-json-artifact');
const { allocateOutput, buildStageDefinitions, collectChanges, copyMediaPackage, runStagesUntilFailure } = require('../scripts/article-json-workbench');
const { expectedPreparedPath, packageHashesMatch, preparedPathFromOutput } = require('../scripts/article-add');

const REPO = path.resolve(__dirname, '..');

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

test('content blockers run before media conversion and the final package preflight', () => {
  const labels = buildStageDefinitions('/tmp/article.json', '/tmp/assets').map((item) => item.label);
  assert.ok(labels.indexOf('Pełny preflight treści przed kosztowną obróbką mediów') < labels.indexOf('Pakiet mediów: nazwy, warianty, jakość i różnorodność'));
  assert.ok(labels.indexOf('Pakiet mediów: nazwy, warianty, jakość i różnorodność') < labels.indexOf('Domknięcie mapowania dowodów po dodaniu podpisów mediów'));
  assert.ok(labels.indexOf('Domknięcie mapowania dowodów po dodaniu podpisów mediów') < labels.indexOf('Bramka kompletnego JSON'));
  assert.ok(labels.indexOf('Pakiet mediów: nazwy, warianty, jakość i różnorodność') < labels.indexOf('Końcowy preflight pakietu importowego'));
});

test('workbench reuses one stable ready file unless revision history is explicitly requested', () => withTempDir((dir) => {
  const first = allocateOutput(dir, 'testowy-artykul');
  fs.writeFileSync(first, '{}');
  assert.equal(allocateOutput(dir, 'testowy-artykul'), first);
  assert.match(allocateOutput(dir, 'testowy-artykul', true), /-r2\.fitpo50\.json$/);
}));

test('one-command controller reads the prepared artifact path from workbench output', () => {
  assert.equal(preparedPathFromOutput('[ARTICLE-JSON] status=CONTENT_READY\n[ARTICLE-JSON] JSON: /tmp/gotowy.fitpo50.json\n'), '/tmp/gotowy.fitpo50.json');
});

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
  const json = { slug: 'test', media_manifest: { entries: [{ source_file: 'hero.png', source: { sha256: imageHash }, variants: {} }] } };
  fs.writeFileSync(source, `${JSON.stringify(json)}\n`);
  fs.writeFileSync(prepared, `${JSON.stringify(json)}\n`);
  fs.writeFileSync(reportPathForJson(prepared), `${JSON.stringify({ status: STATUSES.CONTENT_READY, source_file: source, source_sha256: sha256File(source), output_file: prepared, output_sha256: sha256File(prepared) })}\n`);
  assert.equal(packageHashesMatch(source, sourceDir, prepared), true);
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
  };
  fs.writeFileSync(reportPathForJson(file), `${JSON.stringify(report)}\n`);
  assert.equal(inspectPreparedArtifact(file, REPO).ok, true);

  fs.writeFileSync(file, '{"slug":"nowy-artykul","title":"Zmieniono po kontroli"}\n');
  const inspected = inspectPreparedArtifact(file, REPO);
  assert.equal(inspected.ok, false);
  assert.match(inspected.errors.join(' '), /SHA-256/);
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

  assert.equal(result.status, 1);
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

test('ready-check rejects raw JSON without protected artifact metadata', () => withTempDir((dir) => {
  const source = path.join(dir, 'raw.fitpo50.json');
  fs.writeFileSync(source, '{"slug":"raw-ready-check"}\n');
  const result = spawnSync('node', ['scripts/article-ready-check.js', '--file', source], { cwd: REPO, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /CONTENT_READY/);
}));

test('private staging mode cannot be used to bypass the transactional controller', () => withTempDir((dir) => {
  const source = path.join(dir, 'raw.fitpo50.json');
  fs.writeFileSync(source, '{"slug":"raw-staging-bypass"}\n');
  const result = spawnSync('node', ['scripts/article-pipeline.js', '--file', source, '--staging-internal', 'true'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /CONTENT_READY|prywatnym trybem/);
}));
