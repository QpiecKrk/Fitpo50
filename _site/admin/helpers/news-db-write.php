<?php
declare(strict_types=1);

require_once __DIR__ . '/news-db-read.php';

final class NewsDbWriteException extends RuntimeException
{
    public function __construct(
        public readonly string $category,
        public readonly string $changeId,
        public readonly string $stage,
        public readonly string $sqlState,
        public readonly int $driverCode,
        public readonly string $diagnosticCode
    ) {
        parent::__construct($category);
    }
}

function newsDbWriteDiagnosticFields(Throwable $error): array
{
    $sqlState = 'NA';
    $driverCode = 0;
    $diagnosticCode = 'NA';

    if ($error instanceof PDOException) {
        $errorInfo = is_array($error->errorInfo ?? null) ? $error->errorInfo : [];
        $candidateState = strtoupper((string)($errorInfo[0] ?? ''));
        $candidateDriverCode = $errorInfo[1] ?? 0;
        if (preg_match('/^[A-Z0-9]{5}$/', $candidateState)) {
            $sqlState = $candidateState;
        }
        if (is_int($candidateDriverCode) || ctype_digit((string)$candidateDriverCode)) {
            $driverCode = (int)$candidateDriverCode;
        }
    } elseif ($error instanceof RuntimeException) {
        $candidateCode = $error->getMessage();
        if (preg_match('/^[A-Z_]{3,64}$/', $candidateCode)) {
            $diagnosticCode = $candidateCode;
        }
    }

    return [
        'sqlstate' => $sqlState,
        'driver_code' => $driverCode,
        'code' => $diagnosticCode,
    ];
}

function newsDbWriteUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function newsDbWriteJson(?array $item): ?string
{
    if ($item === null) {
        return null;
    }
    return json_encode($item, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function newsDbWriteDefaultDependencies(PDO $database): array
{
    return [
        'uuid' => 'newsDbWriteUuid',
        'acquire' => static fn(): bool => (int)$database->query("SELECT GET_LOCK('fitpo50_news_db_write', 5)")->fetchColumn() === 1,
        'begin' => static function () use ($database): void {
            $database->exec('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
            $database->beginTransaction();
        },
        'locked_state' => static fn(): array => [
            'rows' => $database->query('SELECT id, title, content_html, status, sort_order, image_base, image_alt, image_sha1_jpg, image_sha1_webp, image_sha1_avif, sources_json, created_at, updated_at, published_at FROM news ORDER BY id FOR UPDATE')->fetchAll(),
            'journal' => $database->query('SELECT journal_id, operation, snapshot_sha256, store_updated_at FROM news_journal ORDER BY journal_id FOR UPDATE')->fetchAll(),
        ],
        'apply' => static function (string $operation, ?array $before, ?array $after) use ($database): void {
            if ($operation === 'delete') {
                $statement = $database->prepare('DELETE FROM news WHERE id = :id');
                $statement->execute(['id' => $before['id']]);
                if ($statement->rowCount() !== 1) {
                    throw new RuntimeException('DELETE_COUNT');
                }
                return;
            }
            $mapped = newsDbImportMapItem($after)['row'];
            unset($mapped['image_hashes']);
            if ($operation === 'create') {
                $sql = 'INSERT INTO news (id,title,content_html,status,sort_order,image_base,image_alt,image_sha1_jpg,image_sha1_webp,image_sha1_avif,sources_json,created_at,updated_at,published_at) VALUES (:id,:title,:content_html,:status,:sort_order,:image_base,:image_alt,:image_sha1_jpg,:image_sha1_webp,:image_sha1_avif,:sources_json,:created_at,:updated_at,:published_at)';
            } else {
                $sql = 'UPDATE news SET title=:title,content_html=:content_html,status=:status,sort_order=:sort_order,image_base=:image_base,image_alt=:image_alt,image_sha1_jpg=:image_sha1_jpg,image_sha1_webp=:image_sha1_webp,image_sha1_avif=:image_sha1_avif,sources_json=:sources_json,created_at=:created_at,updated_at=:updated_at,published_at=:published_at WHERE id=:id';
            }
            $database->prepare($sql)->execute($mapped);
        },
        'rows_after' => static fn(): array => $database->query('SELECT id, title, content_html, status, sort_order, image_base, image_alt, image_sha1_jpg, image_sha1_webp, image_sha1_avif, sources_json, created_at, updated_at, published_at FROM news ORDER BY id FOR UPDATE')->fetchAll(),
        'journal' => static function (array $payload) use ($database): void {
            $statement = $database->prepare('INSERT INTO news_journal (change_id,news_id,operation,before_item_json,after_item_json,import_envelope_json,snapshot_sha256,store_updated_at,actor_type) VALUES (:change_id,:news_id,:operation,:before_item_json,:after_item_json,NULL,:snapshot_sha256,:store_updated_at,\'panel\')');
            $statement->execute($payload);
        },
        'commit' => static fn(): bool => $database->commit(),
        'rollback' => static function () use ($database): void {
            if ($database->inTransaction()) {
                $database->rollBack();
            }
        },
        'release' => static fn() => $database->query("SELECT RELEASE_LOCK('fitpo50_news_db_write')"),
    ];
}

function newsDbWriteTransaction(
    string $operation,
    ?array $before,
    ?array $after,
    string $storeUpdatedAt,
    ?array $dependencies = null
): array {
    $allowed = ['create', 'update', 'publish', 'unpublish', 'delete'];
    $changeId = (string)(($dependencies['uuid'] ?? 'newsDbWriteUuid')());
    $locked = false;
    $begun = false;
    $stage = 'connect';
    try {
        if (!in_array($operation, $allowed, true)) {
            throw new RuntimeException('OPERATION_INVALID');
        }
        if ($dependencies === null) {
            $dependencies = newsDbWriteDefaultDependencies(getNewsDb());
        }
        $stage = 'get_lock';
        $locked = (bool)$dependencies['acquire']();
        if (!$locked) {
            throw new RuntimeException('LOCK_UNAVAILABLE');
        }
        $stage = 'begin';
        $dependencies['begin']();
        $begun = true;
        $stage = 'locked_state';
        $state = $dependencies['locked_state']();
        $stage = 'store_check';
        $store = newsDbStoreFromRowsAndJournal($state['rows'], $state['journal']);
        $current = $before === null ? null : findNewsItemById($store, (string)$before['id']);
        if (($before === null && $operation !== 'create') || ($before !== null && $current === null)) {
            throw new RuntimeException('CURRENT_ITEM_MISSING');
        }
        if ($before !== null && !hash_equals(newsDbImportItemSha256($before), newsDbImportItemSha256($current))) {
            throw new RuntimeException('STALE_ITEM');
        }
        $stage = 'apply';
        $dependencies['apply']($operation, $before, $after);
        $stage = 'rows_after';
        $rowsAfter = $dependencies['rows_after']();
        $stage = 'snapshot';
        $snapshot = newsDbSnapshotFromRows($rowsAfter, $storeUpdatedAt);
        $stage = 'journal';
        $payload = [
            'change_id' => $changeId,
            'news_id' => (string)(($after ?? $before)['id'] ?? ''),
            'operation' => $operation,
            'before_item_json' => newsDbWriteJson($before),
            'after_item_json' => newsDbWriteJson($after),
            'snapshot_sha256' => $snapshot,
            'store_updated_at' => $storeUpdatedAt,
        ];
        $dependencies['journal']($payload);
        $stage = 'commit';
        $dependencies['commit']();
        $begun = false;
        return $payload;
    } catch (Throwable $error) {
        if ($begun && isset($dependencies['rollback'])) {
            $dependencies['rollback']();
        }
        $diagnostics = newsDbWriteDiagnosticFields($error);
        error_log(
            '[NEWS_DB_WRITE_ERROR] class=' . get_class($error)
            . ' stage=' . $stage
            . ' sqlstate=' . $diagnostics['sqlstate']
            . ' driver_code=' . $diagnostics['driver_code']
            . ' code=' . $diagnostics['code']
            . ' change_id=' . $changeId
        );
        throw new NewsDbWriteException(
            'NEWS_DB_WRITE_FAILED',
            $changeId,
            $stage,
            $diagnostics['sqlstate'],
            $diagnostics['driver_code'],
            $diagnostics['code']
        );
    } finally {
        if ($locked && isset($dependencies['release'])) {
            try {
                $dependencies['release']();
            } catch (Throwable $error) {
                error_log('[NEWS_DB_WRITE_LOCK_RELEASE_ERROR] ' . get_class($error) . ' change_id=' . $changeId);
            }
        }
    }
}

function newsDbWriteMutation(
    string $operation,
    ?array $before,
    ?array $after,
    string $updatedAt,
    ?array $dependencies = null
): array
{
    $dbTime = newsDbImportUtc($updatedAt, false, 'store_updated_at')['database'];
    return newsDbWriteTransaction($operation, $before, $after, $dbTime, $dependencies);
}

function newsDbRebuildCacheAfterCommit(string $changeId): ?string
{
    try {
        rebuildNewsCacheFromDatabase();
        return null;
    } catch (Throwable $error) {
        error_log('[NEWS_DB_CACHE_REBUILD_ERROR] ' . get_class($error) . ' change_id=' . $changeId);
        return 'CACHE_REBUILD_REQUIRED';
    }
}
