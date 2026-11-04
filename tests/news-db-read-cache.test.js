'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { pullNews } = require('../scripts/news-pull');
const { checkNewsFallbackSync } = require('../scripts/news-deploy-sync-gate');

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

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
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

test('publiczne items są identyczne dla file i canonical → row → odczyt DB', (t) => {
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fitpo50-news-public-parity-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const admin = path.join(directory, 'admin');
  const helpers = path.join(admin, 'helpers');
  const images = path.join(directory, 'assets', 'news');
  fs.mkdirSync(helpers, { recursive: true });
  fs.mkdirSync(images, { recursive: true });
  fs.writeFileSync(path.join(admin, 'bootstrap.php'), `<?php define('SITE_ROOT', ${phpString(`${directory}${path.sep}`)});`);
  for (const name of ['news.php', 'internal-links.php', 'news-db.php', 'news-db-canonical.php', 'news-db-read.php']) {
    fs.copyFileSync(path.join(ROOT, 'admin', 'helpers', name), path.join(helpers, name));
  }
  for (const extension of ['jpg', 'webp', 'avif']) {
    fs.writeFileSync(path.join(images, `news_fixture_image.${extension}`), extension);
  }

  const result = runPhp(`
    require ${phpString(path.join(helpers, 'news.php'))};
    $fileItem = [
      'id' => 'news_fixture',
      'title' => 'Techniczny fixture',
      'content_html' => '<p>Treść.</p>',
      'status' => 'published',
      'sort_order' => 1,
      'image_base' => 'news_fixture_image',
      'image_alt' => 'Opis obrazu',
      'image_hashes' => [
        'jpg' => str_repeat('a', 40),
        'webp' => str_repeat('b', 40),
        'avif' => str_repeat('c', 40),
      ],
      'sources' => [['label' => 'Źródło', 'url' => 'https://example.com/source']],
      'created_at' => '2026-11-03T10:00:00+00:00',
      'updated_at' => '2026-11-03T11:00:00+00:00',
      'published_at' => '2026-11-03T11:00:00+00:00',
    ];
    $row = newsDbImportMapItem($fileItem)['row'];
    $dbItem = newsDbCanonicalItemFromDatabaseRow($row);
    $fileItems = buildPublicNewsPayload(['version' => 1, 'items' => [$fileItem]])['items'];
    $dbItems = buildPublicNewsPayload(['version' => 1, 'items' => [$dbItem]])['items'];
    echo json_encode(['fileItems' => $fileItems, 'dbItems' => $dbItems], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.dbItems, output.fileItems);
  assert.equal(sha256Json(output.dbItems), sha256Json(output.fileItems));
  assert.equal(output.fileItems[0].updated_at, '2026-11-03T11:00:00+00:00');
  assert.equal(output.fileItems[0].published_at, '2026-11-03T11:00:00+00:00');
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

test('odbudowa cache z wierszy DB zachowuje bajty obecnych plików NEWS', (t) => {
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fitpo50-news-cache-parity-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const admin = path.join(directory, 'admin');
  const helpers = path.join(admin, 'helpers');
  const images = path.join(directory, 'assets', 'news');
  const output = path.join(directory, 'output');
  fs.mkdirSync(helpers, { recursive: true });
  fs.mkdirSync(images, { recursive: true });
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(admin, 'bootstrap.php'), `<?php define('SITE_ROOT', ${phpString(`${directory}${path.sep}`)});`);
  for (const name of ['news.php', 'internal-links.php', 'news-db.php', 'news-db-canonical.php', 'news-db-read.php']) {
    fs.copyFileSync(path.join(ROOT, 'admin', 'helpers', name), path.join(helpers, name));
  }

  const sourceStore = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'news-live.json'), 'utf8'));
  for (const item of sourceStore.items) {
    if (!item.image_base) continue;
    for (const extension of ['jpg', 'webp', 'avif']) {
      fs.writeFileSync(path.join(images, `${item.image_base}.${extension}`), extension);
    }
  }
  const sourcePath = path.join(directory, 'source.json');
  fs.writeFileSync(sourcePath, JSON.stringify(sourceStore));
  const liveOutput = path.join(output, 'news-live.json');
  const fallbackOutput = path.join(output, 'news-fallback.json');
  const changedOutputA = path.join(output, 'news-live-changed-a.json');
  const changedOutputB = path.join(output, 'news-live-changed-b.json');

  const result = runPhp(`
    require ${phpString(path.join(helpers, 'news.php'))};
    $source = json_decode(file_get_contents(${phpString(sourcePath)}), true, 512, JSON_THROW_ON_ERROR);
    $rows = [];
    foreach ($source['items'] as $item) {
      $rows[] = newsDbImportMapItem($item)['row'];
    }
    $updated = newsDbImportUtc($source['updatedAt'], false, 'updatedAt');
    $dbStore = [
      'version' => 1,
      'updatedAt' => $updated['json'],
      'items' => array_map('newsDbCanonicalItemFromDatabaseRow', $rows),
    ];
    $documents = function_exists('buildNewsCacheDocumentsFromStore')
      ? buildNewsCacheDocumentsFromStore($dbStore)
      : newsDbCacheDocuments(
          $dbStore,
          static fn(array $value): array => buildPublicNewsPayload($value, (string)$value['updatedAt'])
        );
    atomicWriteJson(${phpString(liveOutput)}, $documents['live']);
    atomicWriteJson(${phpString(fallbackOutput)}, $documents['fallback']);

    $changed = $source;
    $changed['updatedAt'] = '2026-11-04T12:34:56+00:00';
    $changed['items'][0]['title'] .= ' — zmiana';
    $changed['items'][0]['updated_at'] = '2026-11-04T12:34:56+00:00';
    $changedRows = [];
    foreach ($changed['items'] as $item) {
      $changedRows[] = newsDbImportMapItem($item)['row'];
    }
    $changedUpdated = newsDbImportUtc($changed['updatedAt'], false, 'updatedAt');
    $changedStore = [
      'version' => 1,
      'updatedAt' => $changedUpdated['json'],
      'items' => array_map('newsDbCanonicalItemFromDatabaseRow', $changedRows),
    ];
    $changedDocumentsA = buildNewsCacheDocumentsFromStore($changedStore);
    $changedDocumentsB = buildNewsCacheDocumentsFromStore($changedStore);
    atomicWriteJson(${phpString(changedOutputA)}, $changedDocumentsA['live']);
    atomicWriteJson(${phpString(changedOutputB)}, $changedDocumentsB['live']);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const liveCmp = spawnSync('cmp', [liveOutput, path.join(ROOT, 'data', 'news-live.json')], { encoding: 'utf8' });
  const fallbackCmp = spawnSync('cmp', [fallbackOutput, path.join(ROOT, 'assets', 'data', 'news-fallback.json')], { encoding: 'utf8' });
  assert.equal(liveCmp.status, 0, liveCmp.stderr || liveCmp.stdout);
  assert.equal(fallbackCmp.status, 0, fallbackCmp.stderr || fallbackCmp.stdout);
  assert.deepEqual(fs.readFileSync(changedOutputA), fs.readFileSync(changedOutputB));
  const changedStore = JSON.parse(fs.readFileSync(changedOutputA, 'utf8'));
  assert.equal(changedStore.updatedAt, '2026-11-04T12:34:56+00:00');
  assert.equal(changedStore.items.find((item) => item.id === sourceStore.items[0].id).updated_at, '2026-11-04T12:34:56+00:00');

  const imageNames = fs.readdirSync(path.join(ROOT, 'assets', 'news'));
  const transport = {
    list(account, remote) {
      const lists = {
        'data:/': ['news-live.json'],
        'data:/news-backups/': [],
        'assets:/': ['data', 'news'],
        'assets:/data/': ['news-fallback.json'],
        'assets:/news/': imageNames,
      };
      return lists[`${account}:${remote}`] || [];
    },
    download(_account, remote, target) {
      const source = remote === '/news-live.json'
        ? liveOutput
        : remote === '/data/news-fallback.json'
          ? fallbackOutput
          : path.join(ROOT, 'assets', 'news', path.basename(remote));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    },
  };

  const checkout = path.join(directory, 'checkout');
  for (const relative of [
    'data/news-live.json', '_site/data/news-live.json',
    'assets/data/news-fallback.json', '_site/assets/data/news-fallback.json',
  ]) {
    const target = path.join(checkout, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relative), target);
  }
  fs.cpSync(path.join(ROOT, 'assets', 'news'), path.join(checkout, 'assets', 'news'), { recursive: true });
  const pullReport = pullNews({
    root: checkout,
    dryRun: true,
    privateStoreTracked: false,
    transport,
    imageInspector: (file) => ({
      format: path.extname(file).toLowerCase() === '.jpg' ? 'JPEG' : path.extname(file).slice(1).toUpperCase(),
      width: 640,
      height: 480,
    }),
  });
  assert.equal(pullReport.new_news.length, 0);
  assert.equal(pullReport.changed_news.length, 0);
  assert.equal(pullReport.changed_files.length, 0);

  const gate = checkNewsFallbackSync({ root: ROOT, transport });
  assert.equal(gate.status, 'NEWS_IN_SYNC');
  assert.equal(gate.remote_hashes.live, gate.local_hashes['data/news-live.json']);
  assert.equal(gate.remote_hashes.fallback, gate.local_hashes['assets/data/news-fallback.json']);
});
