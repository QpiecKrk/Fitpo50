<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    echo "IMPORT_FAIL: CLI_ONLY\n";
    exit(30);
}

require_once __DIR__ . '/../admin/helpers/news-db-canonical.php';

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

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    exit(newsDbImportMain($argv));
}
