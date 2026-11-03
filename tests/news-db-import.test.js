'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const IMPORTER = path.join(ROOT, 'scripts', 'news-db-import.php');

function phpString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function runLibrary(code) {
  return spawnSync('php', [
    '-d', 'display_errors=0',
    '-r',
    `define('FITPO50_NEWS_DB_IMPORT_LIBRARY', true); require ${phpString(IMPORTER)}; ${code}`,
  ], { cwd: ROOT, encoding: 'utf8' });
}

function fixtureItem(overrides = {}) {
  return {
    id: 'news_fixture_a',
    title: 'Tytuł technicznego fixture',
    content_html: '<p>Treść fixture.</p>',
    status: 'published',
    sort_order: 2,
    image_base: 'news_20261103_120000_aabbccdd',
    image_alt: 'Opis fixture',
    image_hashes: {
      jpg: 'A'.repeat(40),
      webp: 'B'.repeat(40),
      avif: 'C'.repeat(40),
    },
    sources: [{ label: 'Źródło fixture', url: 'https://example.com/source' }],
    created_at: '2026-11-03T11:00:00+00:00',
    updated_at: '2026-11-03T12:00:00+00:00',
    published_at: '2026-11-03T12:00:00+00:00',
    ...overrides,
  };
}

function writeEnvelope(directory, name, items, updatedAt = '2026-11-03T12:30:00+00:00') {
  const file = path.join(directory, name);
  fs.writeFileSync(file, `${JSON.stringify({ version: 1, updatedAt, items }, null, 2)}\n`);
  return file;
}

function analyze(file) {
  const result = runLibrary(
    `$result = newsDbImportAnalyzeFile(${phpString(file)}); echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);`,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('importer jest CLI-only, nie ładuje auth.php i nie zawiera DDL ani upsertu', () => {
  assert.equal(fs.existsSync(IMPORTER), true, 'Brak scripts/news-db-import.php');
  const source = fs.readFileSync(IMPORTER, 'utf8');
  assert.match(source, /PHP_SAPI\s*!==\s*['"]cli['"]/);
  assert.match(source, /admin[\/\\]bootstrap\.php/);
  assert.match(source, /admin[\/\\]helpers[\/\\]news-db\.php/);
  assert.doesNotMatch(source, /auth\.php/);
  assert.doesNotMatch(source, /\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|DATABASE)\b/i);
  assert.doesNotMatch(source, /ON\s+DUPLICATE\s+KEY/i);
  assert.doesNotMatch(source, /getMessage\s*\(/);
});

test('mapowanie zachowuje 12 pól, normalizuje UTC i mapuje puste hashe na NULL', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-db-import-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const emptyHashes = fixtureItem({
    id: 'news_fixture_b',
    status: 'draft',
    image_base: '',
    image_alt: '',
    image_hashes: { jpg: '', webp: '', avif: '' },
    created_at: '2026-11-03T13:00:00+01:00',
    updated_at: '2026-11-03T13:30:00+01:00',
    published_at: '',
  });
  const result = analyze(writeEnvelope(directory, 'news.json', [fixtureItem(), emptyHashes]));
  assert.equal(result.count, 2);
  assert.match(result.source_file_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.snapshot_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.rows[0].image_hashes, {
    jpg: 'a'.repeat(40), webp: 'b'.repeat(40), avif: 'c'.repeat(40),
  });
  assert.deepEqual(result.rows[1].image_hashes, { jpg: null, webp: null, avif: null });
  assert.equal(result.rows[1].image_base, null);
  assert.equal(result.rows[1].published_at, null);
  assert.equal(result.rows[1].created_at, '2026-11-03 12:00:00.000000');
});

test('snapshot jest stabilny przy zmianie kolejności items i kluczy, ale hash pliku nie', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-db-canon-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const a = fixtureItem({ id: 'news_a' });
  const b = fixtureItem({ id: 'news_b', sort_order: 3 });
  const reorderedA = Object.fromEntries(Object.entries(a).reverse());
  const first = analyze(writeEnvelope(directory, 'first.json', [a, b]));
  const second = analyze(writeEnvelope(directory, 'second.json', [b, reorderedA]));
  assert.equal(first.snapshot_sha256, second.snapshot_sha256);
  assert.notEqual(first.source_file_sha256, second.source_file_sha256);
});

test('częściowy zestaw image_hashes jest odrzucany', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-db-hashes-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = writeEnvelope(directory, 'partial.json', [fixtureItem({
    image_hashes: { jpg: 'a'.repeat(40), webp: '', avif: '' },
  })]);
  const result = runLibrary(
    `try { newsDbImportAnalyzeFile(${phpString(file)}); echo 'NO_ERROR'; } catch (NewsDbImportException $e) { echo $e->category; }`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'IMAGE_HASHES_PARTIAL');
});

test('round-trip wiersza bazy daje ten sam hash elementu', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-db-roundtrip-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = writeEnvelope(directory, 'roundtrip.json', [fixtureItem()]);
  const result = runLibrary(`
    $analysis = newsDbImportAnalyzeFile(${phpString(file)});
    $fromDb = newsDbImportCanonicalItemFromDatabaseRow($analysis['rows'][0]);
    echo json_encode([
      'source' => newsDbImportItemSha256($analysis['items'][0]),
      'database' => newsDbImportItemSha256($fromDb),
    ]);
  `);
  assert.equal(result.status, 0, result.stderr);
  const hashes = JSON.parse(result.stdout);
  assert.equal(hashes.source, hashes.database);
});

test('apply wymaga trzech oczekiwań z dry-run i pustych tabel', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-db-guards-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const analysis = analyze(writeEnvelope(directory, 'guard.json', [fixtureItem()]));
  const result = runLibrary(`
    $analysis = newsDbImportAnalyzeFile(${phpString(path.join(directory, 'guard.json'))});
    $out = [];
    foreach ([
      ['source' => $analysis['source_file_sha256'], 'snapshot' => $analysis['snapshot_sha256'], 'count' => 1, 'news' => 0, 'journal' => 0],
      ['source' => '', 'snapshot' => $analysis['snapshot_sha256'], 'count' => 1, 'news' => 0, 'journal' => 0],
      ['source' => $analysis['source_file_sha256'], 'snapshot' => $analysis['snapshot_sha256'], 'count' => 1, 'news' => 1, 'journal' => 0],
    ] as $case) {
      try {
        newsDbImportValidateApplyGuard($analysis, $case['source'], $case['snapshot'], $case['count'], $case['news'], $case['journal']);
        $out[] = 'PASS';
      } catch (NewsDbImportException $e) {
        $out[] = $e->category;
      }
    }
    echo json_encode($out);
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['PASS', 'EXPECT_SOURCE_SHA256_MISMATCH', 'TABLES_NOT_EMPTY']);
  assert.equal(analysis.count, 1);
});

test('rollback wymaga dokładnie N/1 oraz zgodnego change_id i snapshotu', () => {
  const result = runLibrary(`
    $journal = [[
      'change_id' => '11111111-1111-4111-8111-111111111111',
      'operation' => 'import',
      'snapshot_sha256' => str_repeat('a', 64),
    ]];
    $out = [];
    foreach ([[1, $journal, 1, true], [2, $journal, 1, false], [1, [], 1, false]] as $case) {
      try {
        newsDbImportValidateRollbackGuard(
          $case[0], $case[1], $case[2],
          '11111111-1111-4111-8111-111111111111', str_repeat('a', 64), str_repeat('a', 64)
        );
        $out[] = 'PASS';
      } catch (NewsDbImportException $e) {
        $out[] = $e->category;
      }
    }
    echo json_encode($out);
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['PASS', 'ROLLBACK_STATE_MISMATCH', 'ROLLBACK_STATE_MISMATCH']);
});

test('verify wymaga dokładnie jednego zgodnego wpisu import i zgodnego snapshotu bazy', () => {
  const changeId = '11111111-1111-4111-8111-111111111111';
  const snapshot = 'a'.repeat(64);
  const result = runLibrary(`
    $valid = [[
      'change_id' => '${changeId}',
      'operation' => 'import',
      'snapshot_sha256' => '${snapshot}',
    ]];
    $wrongOperation = $valid;
    $wrongOperation[0]['operation'] = 'update';
    $cases = [
      [1, $valid, 1, '${changeId}', '${snapshot}', '${snapshot}'],
      [1, [], 1, '${changeId}', '${snapshot}', '${snapshot}'],
      [1, [$valid[0], $valid[0]], 1, '${changeId}', '${snapshot}', '${snapshot}'],
      [1, $wrongOperation, 1, '${changeId}', '${snapshot}', '${snapshot}'],
      [1, $valid, 1, '22222222-2222-4222-8222-222222222222', '${snapshot}', '${snapshot}'],
      [1, $valid, 1, '${changeId}', '${'b'.repeat(64)}', '${snapshot}'],
      [1, $valid, 1, '${changeId}', '${snapshot}', '${'b'.repeat(64)}'],
    ];
    $out = [];
    foreach ($cases as $case) {
      try {
        newsDbImportValidateVerifyJournal(...$case);
        $out[] = 'PASS';
      } catch (NewsDbImportException $e) {
        $out[] = $e->category;
      }
    }
    echo json_encode($out);
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    'PASS',
    'VERIFY_JOURNAL_MISMATCH',
    'VERIFY_JOURNAL_MISMATCH',
    'VERIFY_JOURNAL_MISMATCH',
    'VERIFY_JOURNAL_MISMATCH',
    'VERIFY_JOURNAL_MISMATCH',
    'VERIFY_JOURNAL_MISMATCH',
  ]);
});

test('verify bez change-id jest odrzucany przed połączeniem z bazą', () => {
  const result = runLibrary(`
    try {
      newsDbImportParseArguments([
        'script.php', '--verify',
        '--expect-count=1',
        '--expect-source-sha256=' . str_repeat('a', 64),
        '--expect-snapshot-sha256=' . str_repeat('b', 64),
      ]);
      echo 'NO_ERROR';
    } catch (NewsDbImportException $e) {
      echo $e->category;
    }
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'VERIFY_EXPECTATIONS_REQUIRED');
});

test('CLI domyślnie wybiera dry-run, a apply bez kompletu oczekiwań jest odrzucany', () => {
  const result = runLibrary(`
    $out = [];
    foreach ([['script.php'], ['script.php', '--apply']] as $argvCase) {
      try {
        $out[] = newsDbImportParseArguments($argvCase)['mode'];
      } catch (NewsDbImportException $e) {
        $out[] = $e->category;
      }
    }
    echo json_encode($out);
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['dry-run', 'APPLY_EXPECTATIONS_REQUIRED']);
});
