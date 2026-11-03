<?php
declare(strict_types=1);

require_once __DIR__ . '/news-db.php';
require_once __DIR__ . '/news-db-canonical.php';

function newsStorageMode(): string
{
    if (!defined('NEWS_STORAGE_MODE')) {
        return 'file';
    }
    return strtolower(trim((string) constant('NEWS_STORAGE_MODE'))) === 'db' ? 'db' : 'file';
}

function newsDbSelectRows(PDO $database): array
{
    return $database->query(
        'SELECT id, title, content_html, status, sort_order, image_base, image_alt, '
        . 'image_sha1_jpg, image_sha1_webp, image_sha1_avif, sources_json, '
        . 'created_at, updated_at, published_at FROM news ORDER BY id'
    )->fetchAll();
}

function newsDbSelectJournal(PDO $database): array
{
    return $database->query(
        'SELECT journal_id, operation, snapshot_sha256, store_updated_at '
        . 'FROM news_journal ORDER BY journal_id'
    )->fetchAll();
}

function newsDbStoreFromRowsAndJournal(array $rows, array $journalRows): array
{
    $importCount = count(array_filter(
        $journalRows,
        static fn(array $row): bool => ($row['operation'] ?? '') === 'import'
    ));
    if ($importCount !== 1 || $journalRows === []) {
        throw new RuntimeException('NEWS_DB_IMPORT_GUARD_FAILED');
    }

    usort($journalRows, static fn(array $left, array $right): int => (
        (int) ($left['journal_id'] ?? 0) <=> (int) ($right['journal_id'] ?? 0)
    ));
    $latest = $journalRows[array_key_last($journalRows)];
    $updatedAt = (string) ($latest['store_updated_at'] ?? '');
    $expectedSnapshot = strtolower(trim((string) ($latest['snapshot_sha256'] ?? '')));
    if ($updatedAt === '' || !preg_match('/^[a-f0-9]{64}$/', $expectedSnapshot)) {
        throw new RuntimeException('NEWS_DB_JOURNAL_INVALID');
    }

    try {
        $actualSnapshot = newsDbSnapshotFromRows($rows, $updatedAt);
        $items = array_map('newsDbCanonicalItemFromDatabaseRow', $rows);
        $updated = newsDbImportUtc(str_replace(' ', 'T', $updatedAt) . 'Z', false, 'store_updated_at');
    } catch (NewsDbImportException $error) {
        throw new RuntimeException('NEWS_DB_DATA_INVALID', 0, $error);
    }
    if (!hash_equals($expectedSnapshot, $actualSnapshot)) {
        throw new RuntimeException('NEWS_DB_SNAPSHOT_MISMATCH');
    }

    usort($items, static fn(array $left, array $right): int => strcmp($left['id'], $right['id']));
    return [
        'version' => 1,
        'updatedAt' => $updated['json'],
        'items' => $items,
    ];
}

function loadNewsStoreFromDatabase(?callable $connectionFactory = null): array
{
    try {
        $database = $connectionFactory !== null ? $connectionFactory() : getNewsDb();
        if (!$database instanceof PDO) {
            throw new RuntimeException('NEWS_DB_CONNECTION_INVALID');
        }
        return newsDbStoreFromRowsAndJournal(
            newsDbSelectRows($database),
            newsDbSelectJournal($database)
        );
    } catch (Throwable $error) {
        error_log('[NEWS_DB_READ_ERROR] ' . get_class($error));
        throw new RuntimeException('NEWS_DB_READ_ERROR');
    }
}

function newsPublicFeedResolve(
    callable $primaryLoader,
    callable $publicBuilder,
    callable $fallbackLoader,
    ?callable $logger = null
): array {
    try {
        return $publicBuilder($primaryLoader());
    } catch (Throwable $error) {
        $line = '[NEWS_FEED_DB_ERROR] ' . get_class($error);
        if ($logger !== null) {
            $logger($line);
        } else {
            error_log($line);
        }
        return $fallbackLoader();
    }
}

function newsDbCacheDocuments(array $store, callable $publicBuilder): array
{
    return [
        'live' => $store,
        'fallback' => $publicBuilder($store),
    ];
}
