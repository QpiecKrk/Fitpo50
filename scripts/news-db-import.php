<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    echo "IMPORT_FAIL: CLI_ONLY\n";
    exit(30);
}

final class NewsDbImportException extends RuntimeException
{
    public function __construct(public readonly string $category)
    {
        parent::__construct($category);
    }
}

const NEWS_DB_IMPORT_FIELDS = [
    'id', 'title', 'content_html', 'status', 'sort_order', 'image_base',
    'image_alt', 'image_hashes', 'sources', 'created_at', 'updated_at',
    'published_at',
];

function newsDbImportFail(string $category): never
{
    throw new NewsDbImportException($category);
}

function newsDbImportCanonicalJson(mixed $value): string
{
    try {
        return json_encode(
            $value,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
    } catch (JsonException) {
        newsDbImportFail('JSON_ENCODING_ERROR');
    }
}

function newsDbImportUtc(string $value, bool $nullable, string $field): ?array
{
    if ($value === '') {
        if ($nullable) {
            return null;
        }
        newsDbImportFail('DATE_REQUIRED_' . strtoupper($field));
    }

    try {
        $date = new DateTimeImmutable($value);
    } catch (Throwable) {
        newsDbImportFail('DATE_INVALID_' . strtoupper($field));
    }

    $utc = $date->setTimezone(new DateTimeZone('UTC'));
    return [
        'json' => $utc->format('Y-m-d\TH:i:s.u\Z'),
        'database' => $utc->format('Y-m-d H:i:s.u'),
    ];
}

function newsDbImportImageHashes(mixed $value): array
{
    if (!is_array($value)) {
        newsDbImportFail('IMAGE_HASHES_INVALID');
    }

    $normalized = [];
    $present = 0;
    foreach (['jpg', 'webp', 'avif'] as $format) {
        $hash = strtolower(trim((string) ($value[$format] ?? '')));
        if ($hash !== '') {
            $present++;
            if (!preg_match('/^[0-9a-f]{40}$/', $hash)) {
                newsDbImportFail('IMAGE_HASH_INVALID_' . strtoupper($format));
            }
            $normalized[$format] = $hash;
        } else {
            $normalized[$format] = null;
        }
    }

    if ($present !== 0 && $present !== 3) {
        newsDbImportFail('IMAGE_HASHES_PARTIAL');
    }

    return $normalized;
}

function newsDbImportSources(mixed $value): array
{
    if (!is_array($value) || !array_is_list($value)) {
        newsDbImportFail('SOURCES_INVALID');
    }

    $sources = [];
    foreach ($value as $source) {
        if (!is_array($source)) {
            newsDbImportFail('SOURCE_INVALID');
        }
        $label = trim((string) ($source['label'] ?? ''));
        $url = trim((string) ($source['url'] ?? ''));
        if ($label === '' || !preg_match('#^https?://#i', $url)) {
            newsDbImportFail('SOURCE_INVALID');
        }
        $sources[] = ['label' => $label, 'url' => $url];
    }

    return $sources;
}

function newsDbImportMapItem(mixed $item): array
{
    if (!is_array($item)) {
        newsDbImportFail('ITEM_INVALID');
    }
    foreach (NEWS_DB_IMPORT_FIELDS as $field) {
        if (!array_key_exists($field, $item)) {
            newsDbImportFail('FIELD_MISSING_' . strtoupper($field));
        }
    }

    $id = trim((string) $item['id']);
    $title = trim((string) $item['title']);
    $content = (string) $item['content_html'];
    $status = (string) $item['status'];
    $sortOrder = filter_var($item['sort_order'], FILTER_VALIDATE_INT);
    $imageBase = trim((string) $item['image_base']);
    $imageAlt = trim((string) $item['image_alt']);
    if ($id === '' || strlen($id) > 128 || !preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
        newsDbImportFail('ID_INVALID');
    }
    if ($title === '' || mb_strlen($title) > 512 || $content === '') {
        newsDbImportFail('TEXT_FIELD_INVALID');
    }
    if (!in_array($status, ['draft', 'published'], true)) {
        newsDbImportFail('STATUS_INVALID');
    }
    if ($sortOrder === false || $sortOrder < 1 || $sortOrder > 9999) {
        newsDbImportFail('SORT_ORDER_INVALID');
    }
    if ($imageBase !== '' && (strlen($imageBase) > 191 || !preg_match('/^[A-Za-z0-9_-]+$/', $imageBase))) {
        newsDbImportFail('IMAGE_BASE_INVALID');
    }

    $hashes = newsDbImportImageHashes($item['image_hashes']);
    $sources = newsDbImportSources($item['sources']);
    $created = newsDbImportUtc((string) $item['created_at'], false, 'created_at');
    $updated = newsDbImportUtc((string) $item['updated_at'], false, 'updated_at');
    $published = newsDbImportUtc((string) $item['published_at'], true, 'published_at');
    if ($status === 'published' && ($published === null || $imageBase === '' || $imageAlt === '')) {
        newsDbImportFail('PUBLISHED_FIELDS_REQUIRED');
    }

    $canonical = [
        'id' => $id,
        'title' => $title,
        'content_html' => $content,
        'status' => $status,
        'sort_order' => (int) $sortOrder,
        'image_base' => $imageBase,
        'image_alt' => $imageAlt,
        'image_hashes' => [
            'jpg' => $hashes['jpg'] ?? '',
            'webp' => $hashes['webp'] ?? '',
            'avif' => $hashes['avif'] ?? '',
        ],
        'sources' => $sources,
        'created_at' => $created['json'],
        'updated_at' => $updated['json'],
        'published_at' => $published['json'] ?? '',
    ];

    $row = [
        'id' => $id,
        'title' => $title,
        'content_html' => $content,
        'status' => $status,
        'sort_order' => (int) $sortOrder,
        'image_base' => $imageBase === '' ? null : $imageBase,
        'image_alt' => $imageAlt,
        'image_hashes' => $hashes,
        'image_sha1_jpg' => $hashes['jpg'],
        'image_sha1_webp' => $hashes['webp'],
        'image_sha1_avif' => $hashes['avif'],
        'sources_json' => newsDbImportCanonicalJson($sources),
        'created_at' => $created['database'],
        'updated_at' => $updated['database'],
        'published_at' => $published['database'] ?? null,
    ];

    return ['item' => $canonical, 'row' => $row];
}

function newsDbImportAnalyzeFile(string $path): array
{
    if (!is_file($path) || !is_readable($path)) {
        newsDbImportFail('SOURCE_FILE_UNREADABLE');
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        newsDbImportFail('SOURCE_FILE_UNREADABLE');
    }
    try {
        $envelope = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        newsDbImportFail('SOURCE_JSON_INVALID');
    }
    if (!is_array($envelope) || ($envelope['version'] ?? null) !== 1 || !is_array($envelope['items'] ?? null)) {
        newsDbImportFail('SOURCE_ENVELOPE_INVALID');
    }
    $updated = newsDbImportUtc((string) ($envelope['updatedAt'] ?? ''), false, 'envelope_updated_at');
    $items = [];
    $rows = [];
    $ids = [];
    foreach ($envelope['items'] as $item) {
        $mapped = newsDbImportMapItem($item);
        $id = $mapped['item']['id'];
        if (isset($ids[$id])) {
            newsDbImportFail('DUPLICATE_ID');
        }
        $ids[$id] = true;
        $items[] = $mapped['item'];
        $rows[] = $mapped['row'];
    }
    usort($items, static fn(array $a, array $b): int => strcmp($a['id'], $b['id']));
    usort($rows, static fn(array $a, array $b): int => strcmp($a['id'], $b['id']));
    $canonicalEnvelope = [
        'version' => 1,
        'updatedAt' => $updated['json'],
        'items' => $items,
    ];
    return [
        'count' => count($items),
        'source_file_sha256' => hash('sha256', $raw),
        'snapshot_sha256' => hash('sha256', newsDbImportCanonicalJson($canonicalEnvelope)),
        'updated_at' => $updated['database'],
        'canonical_envelope_json' => newsDbImportCanonicalJson($canonicalEnvelope),
        'items' => $items,
        'rows' => $rows,
    ];
}

function newsDbImportCanonicalItemFromDatabaseRow(array $row): array
{
    $sources = $row['sources_json'] ?? [];
    if (is_string($sources)) {
        try {
            $sources = json_decode($sources, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            newsDbImportFail('DATABASE_SOURCE_JSON_INVALID');
        }
    }
    $hashes = is_array($row['image_hashes'] ?? null) ? $row['image_hashes'] : [
        'jpg' => $row['image_sha1_jpg'] ?? null,
        'webp' => $row['image_sha1_webp'] ?? null,
        'avif' => $row['image_sha1_avif'] ?? null,
    ];
    return newsDbImportMapItem([
        'id' => $row['id'],
        'title' => $row['title'],
        'content_html' => $row['content_html'],
        'status' => $row['status'],
        'sort_order' => (int) $row['sort_order'],
        'image_base' => $row['image_base'] ?? '',
        'image_alt' => $row['image_alt'] ?? '',
        'image_hashes' => [
            'jpg' => $hashes['jpg'] ?? '',
            'webp' => $hashes['webp'] ?? '',
            'avif' => $hashes['avif'] ?? '',
        ],
        'sources' => $sources,
        'created_at' => str_replace(' ', 'T', (string) $row['created_at']) . 'Z',
        'updated_at' => str_replace(' ', 'T', (string) $row['updated_at']) . 'Z',
        'published_at' => empty($row['published_at']) ? '' : str_replace(' ', 'T', (string) $row['published_at']) . 'Z',
    ])['item'];
}

function newsDbImportItemSha256(array $item): string
{
    return hash('sha256', newsDbImportCanonicalJson($item));
}

function newsDbImportValidateApplyGuard(
    array $analysis,
    string $expectedSource,
    string $expectedSnapshot,
    int $expectedCount,
    int $newsCount,
    int $journalCount
): void {
    if (!hash_equals($analysis['source_file_sha256'], strtolower($expectedSource))) {
        newsDbImportFail('EXPECT_SOURCE_SHA256_MISMATCH');
    }
    if (!hash_equals($analysis['snapshot_sha256'], strtolower($expectedSnapshot))) {
        newsDbImportFail('EXPECT_SNAPSHOT_SHA256_MISMATCH');
    }
    if ($analysis['count'] !== $expectedCount) {
        newsDbImportFail('EXPECT_COUNT_MISMATCH');
    }
    if ($newsCount !== 0 || $journalCount !== 0) {
        newsDbImportFail('TABLES_NOT_EMPTY');
    }
}

function newsDbImportValidateRollbackGuard(
    int $newsCount,
    array $journalRows,
    int $expectedCount,
    string $expectedChangeId,
    string $expectedSnapshot,
    string $currentSnapshot
): void {
    if ($newsCount !== $expectedCount || count($journalRows) !== 1) {
        newsDbImportFail('ROLLBACK_STATE_MISMATCH');
    }
    $journal = $journalRows[0];
    if (($journal['operation'] ?? '') !== 'import'
        || !hash_equals((string) ($journal['change_id'] ?? ''), $expectedChangeId)
        || !hash_equals((string) ($journal['snapshot_sha256'] ?? ''), strtolower($expectedSnapshot))
        || !hash_equals(strtolower($expectedSnapshot), strtolower($currentSnapshot))) {
        newsDbImportFail('ROLLBACK_IDENTITY_MISMATCH');
    }
}

function newsDbImportValidateVerifyJournal(
    int $newsCount,
    array $journalRows,
    int $expectedCount,
    string $expectedChangeId,
    string $expectedSnapshot,
    string $currentSnapshot
): void {
    try {
        newsDbImportValidateRollbackGuard(
            $newsCount,
            $journalRows,
            $expectedCount,
            $expectedChangeId,
            $expectedSnapshot,
            $currentSnapshot
        );
    } catch (NewsDbImportException) {
        newsDbImportFail('VERIFY_JOURNAL_MISMATCH');
    }
}

function newsDbImportParseArguments(array $argv): array
{
    $options = [
        'mode' => 'dry-run', 'source' => null, 'snapshot' => null,
        'count' => null, 'change_id' => null,
    ];
    $modes = [];
    foreach (array_slice($argv, 1) as $argument) {
        if (in_array($argument, ['--dry-run', '--apply', '--verify', '--rollback'], true)) {
            $modes[] = substr($argument, 2);
            continue;
        }
        foreach ([
            '--expect-source-sha256=' => 'source',
            '--expect-snapshot-sha256=' => 'snapshot',
            '--expect-count=' => 'count',
            '--change-id=' => 'change_id',
        ] as $prefix => $key) {
            if (str_starts_with($argument, $prefix)) {
                $options[$key] = substr($argument, strlen($prefix));
                continue 2;
            }
        }
        newsDbImportFail('ARGUMENT_UNKNOWN');
    }
    if (count($modes) > 1) {
        newsDbImportFail('MODE_CONFLICT');
    }
    if ($modes !== []) {
        $options['mode'] = $modes[0];
    }
    if ($options['count'] !== null && !preg_match('/^(?:0|[1-9][0-9]*)$/', (string) $options['count'])) {
        newsDbImportFail('EXPECT_COUNT_INVALID');
    }
    $options['count'] = $options['count'] === null ? null : (int) $options['count'];
    if (in_array($options['mode'], ['apply', 'verify'], true)
        && (!$options['source'] || !$options['snapshot'] || $options['count'] === null
            || ($options['mode'] === 'verify' && !$options['change_id']))) {
        newsDbImportFail(strtoupper($options['mode']) . '_EXPECTATIONS_REQUIRED');
    }
    if ($options['mode'] === 'rollback'
        && (!$options['snapshot'] || $options['count'] === null || !$options['change_id'])) {
        newsDbImportFail('ROLLBACK_EXPECTATIONS_REQUIRED');
    }
    return $options;
}

function newsDbImportCounts(PDO $database, bool $lock = false): array
{
    $suffix = $lock ? ' FOR UPDATE' : '';
    return [
        (int) $database->query('SELECT COUNT(*) FROM news' . $suffix)->fetchColumn(),
        (int) $database->query('SELECT COUNT(*) FROM news_journal' . $suffix)->fetchColumn(),
    ];
}

function newsDbImportDatabaseRows(PDO $database, bool $lock = false): array
{
    $sql = 'SELECT id, title, content_html, status, sort_order, image_base, image_alt, '
        . 'image_sha1_jpg, image_sha1_webp, image_sha1_avif, sources_json, '
        . 'created_at, updated_at, published_at FROM news ORDER BY id';
    return $database->query($sql . ($lock ? ' FOR UPDATE' : ''))->fetchAll();
}

function newsDbImportCompare(array $items, array $databaseRows): array
{
    $expected = [];
    foreach ($items as $item) {
        $expected[$item['id']] = newsDbImportItemSha256($item);
    }
    $actual = [];
    foreach ($databaseRows as $row) {
        $item = newsDbImportCanonicalItemFromDatabaseRow($row);
        $actual[$item['id']] = newsDbImportItemSha256($item);
    }
    $matches = [];
    $mismatches = [];
    foreach ($expected as $id => $hash) {
        if (($actual[$id] ?? null) === $hash) {
            $matches[] = ['id' => $id, 'sha256' => $hash];
        } else {
            $mismatches[] = $id;
        }
    }
    return [
        'matches' => $matches,
        'mismatches' => $mismatches,
        'missing' => array_values(array_diff(array_keys($expected), array_keys($actual))),
        'extra' => array_values(array_diff(array_keys($actual), array_keys($expected))),
    ];
}

function newsDbImportUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function newsDbImportInsert(PDO $database, array $analysis): string
{
    $sql = 'INSERT INTO news (id, title, content_html, status, sort_order, image_base, image_alt, '
        . 'image_sha1_jpg, image_sha1_webp, image_sha1_avif, sources_json, created_at, updated_at, published_at) '
        . 'VALUES (:id, :title, :content_html, :status, :sort_order, :image_base, :image_alt, '
        . ':image_sha1_jpg, :image_sha1_webp, :image_sha1_avif, :sources_json, :created_at, :updated_at, :published_at)';
    $statement = $database->prepare($sql);
    foreach ($analysis['rows'] as $row) {
        $parameters = $row;
        unset($parameters['image_hashes']);
        $statement->execute($parameters);
    }
    $comparison = newsDbImportCompare($analysis['items'], newsDbImportDatabaseRows($database, true));
    if ($comparison['mismatches'] !== [] || $comparison['missing'] !== [] || $comparison['extra'] !== []) {
        newsDbImportFail('DATABASE_COMPARE_FAILED');
    }
    $changeId = newsDbImportUuid();
    $journal = $database->prepare(
        'INSERT INTO news_journal '
        . '(change_id, news_id, operation, before_item_json, after_item_json, import_envelope_json, '
        . 'snapshot_sha256, store_updated_at, actor_type) '
        . "VALUES (:change_id, NULL, 'import', NULL, NULL, :envelope, :snapshot, :updated_at, 'importer')"
    );
    $journal->execute([
        'change_id' => $changeId,
        'envelope' => $analysis['canonical_envelope_json'],
        'snapshot' => $analysis['snapshot_sha256'],
        'updated_at' => $analysis['updated_at'],
    ]);
    return $changeId;
}

function newsDbImportSnapshotFromRows(array $rows, string $updatedAt): string
{
    $items = array_map('newsDbImportCanonicalItemFromDatabaseRow', $rows);
    usort($items, static fn(array $a, array $b): int => strcmp($a['id'], $b['id']));
    $updated = newsDbImportUtc(str_replace(' ', 'T', $updatedAt) . 'Z', false, 'store_updated_at');
    return hash('sha256', newsDbImportCanonicalJson([
        'version' => 1, 'updatedAt' => $updated['json'], 'items' => $items,
    ]));
}

function newsDbImportPrintAnalysis(array $analysis, string $prefix): void
{
    echo $prefix . "\n";
    echo 'COUNT: ' . $analysis['count'] . "\n";
    echo 'SOURCE_FILE_SHA256: ' . $analysis['source_file_sha256'] . "\n";
    echo 'SNAPSHOT_SHA256: ' . $analysis['snapshot_sha256'] . "\n";
}

function newsDbImportMain(array $argv): int
{
    $root = dirname(__DIR__);
    $database = null;
    $lockHeld = false;
    try {
        $options = newsDbImportParseArguments($argv);
        $sourcePath = $root . '/data/news-live.json';
        $analysis = newsDbImportAnalyzeFile($sourcePath);
        require_once $root . '/admin/bootstrap.php';
        require_once $root . '/admin/helpers/news-db.php';
        $database = getNewsDb();

        if ($options['mode'] === 'dry-run') {
            [$newsCount, $journalCount] = newsDbImportCounts($database);
            if ($newsCount !== 0 || $journalCount !== 0) {
                newsDbImportFail('TABLES_NOT_EMPTY');
            }
            newsDbImportPrintAnalysis($analysis, 'IMPORT_OK: DRY_RUN');
            echo "NEWS_ROWS: 0\nJOURNAL_ROWS: 0\n";
            return 0;
        }

        if ($options['mode'] === 'verify') {
            newsDbImportValidateApplyGuard($analysis, $options['source'], $options['snapshot'], $options['count'], 0, 0);
            $databaseRows = newsDbImportDatabaseRows($database);
            $journalRows = $database->query(
                'SELECT change_id, operation, snapshot_sha256, store_updated_at FROM news_journal'
            )->fetchAll();
            $currentSnapshot = count($journalRows) === 1
                ? newsDbImportSnapshotFromRows($databaseRows, (string) $journalRows[0]['store_updated_at'])
                : '';
            newsDbImportValidateVerifyJournal(
                count($databaseRows),
                $journalRows,
                $options['count'],
                $options['change_id'],
                $options['snapshot'],
                $currentSnapshot
            );
            $comparison = newsDbImportCompare($analysis['items'], $databaseRows);
            if (count($comparison['matches']) !== $options['count']
                || $comparison['mismatches'] !== [] || $comparison['missing'] !== [] || $comparison['extra'] !== []) {
                newsDbImportFail('VERIFY_MISMATCH');
            }
            echo "IMPORT_OK: VERIFY\n";
            foreach ($comparison['matches'] as $match) {
                echo 'MATCH id=' . $match['id'] . ' sha256=' . $match['sha256'] . "\n";
            }
            return 0;
        }

        $lockHeld = (int) $database->query("SELECT GET_LOCK('fitpo50_news_db_import', 0)")->fetchColumn() === 1;
        if (!$lockHeld) {
            newsDbImportFail('LOCK_UNAVAILABLE');
        }
        $database->exec('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        $database->beginTransaction();

        if ($options['mode'] === 'apply') {
            [$newsCount, $journalCount] = newsDbImportCounts($database, true);
            newsDbImportValidateApplyGuard(
                $analysis, $options['source'], $options['snapshot'], $options['count'], $newsCount, $journalCount
            );
            $changeId = newsDbImportInsert($database, $analysis);
            if (!hash_equals($analysis['source_file_sha256'], hash_file('sha256', $sourcePath))) {
                newsDbImportFail('SOURCE_CHANGED_DURING_IMPORT');
            }
            [$finalNews, $finalJournal] = newsDbImportCounts($database, true);
            if ($finalNews !== $analysis['count'] || $finalJournal !== 1) {
                newsDbImportFail('FINAL_COUNT_MISMATCH');
            }
            $database->commit();
            newsDbImportPrintAnalysis($analysis, 'IMPORT_OK: APPLY');
            echo 'CHANGE_ID: ' . $changeId . "\n";
            echo 'NEWS_ROWS: ' . $finalNews . "\nJOURNAL_ROWS: " . $finalJournal . "\n";
            return 0;
        }

        $rows = newsDbImportDatabaseRows($database, true);
        $journalRows = $database->query(
            'SELECT change_id, operation, snapshot_sha256, store_updated_at FROM news_journal FOR UPDATE'
        )->fetchAll();
        $currentSnapshot = count($journalRows) === 1
            ? newsDbImportSnapshotFromRows($rows, (string) $journalRows[0]['store_updated_at'])
            : '';
        newsDbImportValidateRollbackGuard(
            count($rows), $journalRows, $options['count'], $options['change_id'], $options['snapshot'], $currentSnapshot
        );
        $deleteNews = $database->prepare('DELETE FROM news');
        $deleteNews->execute();
        $deleteJournal = $database->prepare('DELETE FROM news_journal WHERE change_id = :change_id');
        $deleteJournal->execute(['change_id' => $options['change_id']]);
        [$finalNews, $finalJournal] = newsDbImportCounts($database, true);
        if ($finalNews !== 0 || $finalJournal !== 0 || $deleteJournal->rowCount() !== 1) {
            newsDbImportFail('ROLLBACK_FINAL_COUNT_MISMATCH');
        }
        $database->commit();
        echo "IMPORT_OK: ROLLBACK\nNEWS_ROWS: 0\nJOURNAL_ROWS: 0\n";
        return 0;
    } catch (NewsDbImportException $exception) {
        if ($database instanceof PDO && $database->inTransaction()) {
            $database->rollBack();
        }
        echo 'IMPORT_FAIL: ' . $exception->category . "\n";
        return 20;
    } catch (Throwable $exception) {
        if ($database instanceof PDO && $database->inTransaction()) {
            $database->rollBack();
        }
        error_log('[NEWS_DB_IMPORT_ERROR] ' . get_class($exception));
        echo "IMPORT_FAIL: ENVIRONMENT\n";
        return 30;
    } finally {
        if ($lockHeld && $database instanceof PDO) {
            try {
                $database->query("SELECT RELEASE_LOCK('fitpo50_news_db_import')");
            } catch (Throwable) {
                error_log('[NEWS_DB_IMPORT_LOCK_RELEASE_ERROR]');
            }
        }
    }
}

if (!defined('FITPO50_NEWS_DB_IMPORT_LIBRARY')) {
    exit(newsDbImportMain($argv));
}
