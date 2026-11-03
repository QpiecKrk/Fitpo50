'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join(ROOT, 'admin', 'helpers', 'news-db-canonical.php');
const READER = path.join(ROOT, 'admin', 'helpers', 'news-db-read.php');
const CACHE_CLI = path.join(ROOT, 'scripts', 'news-db-cache-rebuild.php');
const API = path.join(ROOT, 'admin', 'api', 'news-feed.php');

function phpString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function runPhp(code) {
  return spawnSync('php', ['-d', 'display_errors=0', '-r', code], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function requireReader(code, prefix = '') {
  return runPhp(`${prefix} require ${phpString(CANONICAL)}; require ${phpString(READER)}; ${code}`);
}

function fixtureRowsPhp() {
  return `[[
    'id' => 'news_fixture',
    'title' => 'Techniczny fixture',
    'content_html' => '<p>Treść.</p>',
    'status' => 'published',
    'sort_order' => 1,
    'image_base' => 'news_fixture_image',
    'image_alt' => 'Opis obrazu',
    'image_sha1_jpg' => str_repeat('a', 40),
    'image_sha1_webp' => str_repeat('b', 40),
    'image_sha1_avif' => str_repeat('c', 40),
    'sources_json' => '[{"label":"Źródło","url":"https://example.com/source"}]',
    'created_at' => '2026-11-03 10:00:00.000000',
    'updated_at' => '2026-11-03 11:00:00.000000',
    'published_at' => '2026-11-03 11:00:00.000000',
  ]]`;
}

test('NEWS_STORAGE_MODE domyślnie i dla nieznanej wartości pozostaje file', () => {
  for (const [prefix, expected] of [
    ['', 'file'],
    ["define('NEWS_STORAGE_MODE', 'unexpected');", 'file'],
    ["define('NEWS_STORAGE_MODE', 'db');", 'db'],
  ]) {
    const result = requireReader("echo newsStorageMode();", prefix);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stdout, expected);
  }
});

test('tryb file ładuje panel bez katalogu scripts i bez zależności od importera', (t) => {
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fitpo50-news-file-mode-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const admin = path.join(directory, 'admin');
  const helpers = path.join(admin, 'helpers');
  fs.mkdirSync(helpers, { recursive: true });
  fs.writeFileSync(path.join(admin, 'bootstrap.php'), `<?php define('SITE_ROOT', ${phpString(`${directory}${path.sep}`)});`);
  for (const name of ['news.php', 'internal-links.php', 'news-db.php', 'news-db-canonical.php', 'news-db-read.php']) {
    fs.copyFileSync(path.join(ROOT, 'admin', 'helpers', name), path.join(helpers, name));
  }
  const result = runPhp(`require ${phpString(path.join(helpers, 'news.php'))}; echo newsStorageMode();`);
  assert.equal(fs.existsSync(path.join(directory, 'scripts')), false);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout, 'file');
});

test('wiersze DB mapują się do 12 pól store, NULL-hashe do pustych ciągów i daty UTC', () => {
  const result = requireReader(`
    $rows = ${fixtureRowsPhp()};
    $item = newsDbCanonicalItemFromDatabaseRow($rows[0]);
    $updated = '2026-11-03 11:30:00.000000';
    $snapshot = newsDbSnapshotFromRows($rows, $updated);
    $journal = [[
      'journal_id' => 1, 'operation' => 'import',
      'snapshot_sha256' => $snapshot, 'store_updated_at' => $updated,
    ]];
    echo json_encode(newsDbStoreFromRowsAndJournal($rows, $journal), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const store = JSON.parse(result.stdout);
  assert.equal(store.version, 1);
  assert.equal(store.updatedAt, '2026-11-03T11:30:00.000000Z');
  assert.equal(store.items.length, 1);
  assert.deepEqual(Object.keys(store.items[0]), [
    'id', 'title', 'content_html', 'status', 'sort_order', 'image_base',
    'image_alt', 'image_hashes', 'sources', 'created_at', 'updated_at', 'published_at',
  ]);
  assert.deepEqual(store.items[0].image_hashes, {
    jpg: 'a'.repeat(40), webp: 'b'.repeat(40), avif: 'c'.repeat(40),
  });
});

test('tryb db odmawia bez dokładnie jednego importu lub przy niezgodnym najnowszym snapshotcie', () => {
  const result = requireReader(`
    $rows = ${fixtureRowsPhp()};
    $updated = '2026-11-03 11:30:00.000000';
    $snapshot = newsDbSnapshotFromRows($rows, $updated);
    $validImport = ['journal_id' => 1, 'operation' => 'import', 'snapshot_sha256' => $snapshot, 'store_updated_at' => $updated];
    $validUpdate = ['journal_id' => 2, 'operation' => 'update', 'snapshot_sha256' => $snapshot, 'store_updated_at' => $updated];
    $cases = [
      [],
      [$validImport, $validImport],
      [$validImport, array_merge($validUpdate, ['snapshot_sha256' => str_repeat('f', 64)])],
      [$validImport, $validUpdate],
    ];
    $out = [];
    foreach ($cases as $journal) {
      try { newsDbStoreFromRowsAndJournal($rows, $journal); $out[] = 'PASS'; }
      catch (RuntimeException $error) { $out[] = $error->getMessage(); }
    }
    echo json_encode($out);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), [
    'NEWS_DB_IMPORT_GUARD_FAILED',
    'NEWS_DB_IMPORT_GUARD_FAILED',
    'NEWS_DB_SNAPSHOT_MISMATCH',
    'PASS',
  ]);
});

test('awaria DB w publicznym API zwraca wyłącznie publiczny fallback i loguje tylko klasę', () => {
  const result = requireReader(`
    $logs = [];
    $fallback = ['version' => 1, 'updatedAt' => '2026-11-03T12:00:00Z', 'items' => [['id' => 'public']]];
    $payload = newsPublicFeedResolve(
      static function (): array { throw new RuntimeException('tajny DSN'); },
      static fn(array $store): array => $store,
      static fn(): array => $fallback,
      static function (string $line) use (&$logs): void { $logs[] = $line; }
    );
    echo json_encode(['payload' => $payload, 'logs' => $logs]);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.payload.items, [{ id: 'public' }]);
  assert.deepEqual(output.logs, ['[NEWS_FEED_DB_ERROR] RuntimeException']);
  assert.doesNotMatch(result.stdout, /tajny DSN|news-live\.json/);
});

test('odczyt i API nie zawierają ścieżki zapisu cache, a zapis jest tylko w jawnej komendzie CLI', () => {
  const api = fs.readFileSync(API, 'utf8');
  const reader = fs.readFileSync(READER, 'utf8');
  assert.doesNotMatch(api, /rebuildNewsCache|atomicWriteJson|file_put_contents|rename\s*\(/);
  assert.doesNotMatch(reader, /file_put_contents|rename\s*\(/);
  assert.equal(fs.existsSync(CACHE_CLI), true, 'Brak jawnej komendy odbudowy cache');
  const cli = fs.readFileSync(CACHE_CLI, 'utf8');
  assert.match(cli, /PHP_SAPI\s*!==\s*['"]cli['"]/);
  assert.match(cli, /--apply/);
  assert.match(cli, /rebuildNewsCacheFromDatabase/);
});

test('dokumenty cache są deterministyczne, a fallback nie zawiera szkiców', () => {
  const result = requireReader(`
    $store = [
      'version' => 1,
      'updatedAt' => '2026-11-03T12:00:00.000000Z',
      'items' => [
        ['id' => 'published', 'status' => 'published'],
        ['id' => 'draft', 'status' => 'draft'],
      ],
    ];
    $builder = static function (array $value): array {
      return [
        'version' => 1,
        'updatedAt' => $value['updatedAt'],
        'items' => array_values(array_filter($value['items'], static fn(array $item): bool => $item['status'] === 'published')),
      ];
    };
    $first = newsDbCacheDocuments($store, $builder);
    $second = newsDbCacheDocuments($store, $builder);
    echo json_encode(['same' => $first === $second, 'documents' => $first]);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.same, true);
  assert.deepEqual(output.documents.fallback.items.map((item) => item.id), ['published']);
  assert.deepEqual(output.documents.live.items.map((item) => item.id), ['published', 'draft']);
});
