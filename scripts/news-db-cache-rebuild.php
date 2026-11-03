<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    echo "CACHE_REBUILD_FAIL: CLI_ONLY\n";
    exit(30);
}

if ($argc !== 2 || $argv[1] !== '--apply') {
    echo "CACHE_REBUILD_AWAITING_APPLY: użyj --apply\n";
    exit(10);
}

$root = dirname(__DIR__);
try {
    require_once $root . '/admin/bootstrap.php';
    require_once $root . '/admin/helpers/news.php';
    $documents = rebuildNewsCacheFromDatabase();
    echo 'CACHE_REBUILD_OK: NEWS_ROWS=' . count($documents['live']['items'])
        . ' PUBLISHED_ROWS=' . count($documents['fallback']['items']) . "\n";
    exit(0);
} catch (Throwable $error) {
    error_log('[NEWS_DB_CACHE_REBUILD_ERROR] ' . get_class($error));
    echo "CACHE_REBUILD_FAIL: ENVIRONMENT\n";
    exit(30);
}
