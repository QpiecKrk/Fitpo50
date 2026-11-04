<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    echo "PROBE_FAIL: CLI_ONLY\n";
    exit(30);
}

$newsDbWriteProbeRoot = dirname(__DIR__);
require_once $newsDbWriteProbeRoot . '/admin/helpers/news-db-write.php';

function newsDbWriteProbeDraft(string $id, string $now): array
{
    return [
        'id' => $id,
        'title' => 'PROBE',
        'content_html' => '<p>probe</p>',
        'status' => 'draft',
        'sort_order' => 1,
        'image_base' => '',
        'image_alt' => '',
        'image_hashes' => ['jpg' => '', 'webp' => '', 'avif' => ''],
        'sources' => [],
        'created_at' => $now,
        'updated_at' => $now,
        'published_at' => '',
    ];
}

function newsDbWriteProbeExecute(
    array $dependencies,
    callable $counts,
    string $id,
    string $now
): array {
    $beforeCounts = array_map('intval', $counts());
    $commitReached = false;
    $rollbackReached = false;
    $originalRollback = $dependencies['rollback'];
    $dependencies['rollback'] = static function () use ($originalRollback, &$rollbackReached): void {
        $rollbackReached = true;
        $originalRollback();
    };
    $dependencies['commit'] = static function () use (&$commitReached): never {
        $commitReached = true;
        throw new RuntimeException('PROBE_ROLLBACK');
    };

    $exception = null;
    $item = newsDbWriteProbeDraft($id, $now);
    $storeUpdatedAt = newsDbImportUtc($now, false, 'store_updated_at')['database'];
    try {
        newsDbWriteTransaction('create', null, $item, $storeUpdatedAt, $dependencies);
    } catch (NewsDbWriteException $error) {
        $exception = $error;
    }
    $afterCounts = array_map('intval', $counts());
    $rollbackOk = $exception instanceof NewsDbWriteException
        && $commitReached
        && $rollbackReached
        && $exception->stage === 'commit'
        && $exception->diagnosticCode === 'PROBE_ROLLBACK'
        && $beforeCounts === $afterCounts;

    return [
        'stage' => $exception?->stage ?? 'unknown',
        'result' => $rollbackOk ? 'ROLLBACK_OK' : 'FAILED',
        'sqlstate' => $exception?->sqlState ?? 'NA',
        'driver_code' => $exception?->driverCode ?? 0,
        'news_rows' => $afterCounts[0] ?? -1,
        'journal_rows' => $afterCounts[1] ?? -1,
    ];
}

function newsDbWriteProbePrint(array $result): void
{
    echo 'PROBE_STAGE_REACHED=' . $result['stage'] . "\n";
    echo 'PROBE_RESULT=' . $result['result'] . "\n";
    echo 'SQLSTATE=' . $result['sqlstate'] . "\n";
    echo 'DRIVER_CODE=' . $result['driver_code'] . "\n";
    echo 'NEWS_ROWS=' . $result['news_rows'] . "\n";
    echo 'JOURNAL_ROWS=' . $result['journal_rows'] . "\n";
}

function newsDbWriteProbeMain(array $argv): int
{
    if (count($argv) !== 2 || $argv[1] !== '--run') {
        echo "PROBE_PLAN=CREATE_DRAFT_IN_TRANSACTION_THEN_FORCE_ROLLBACK\n";
        echo "PROBE_AWAITING_RUN=use --run\n";
        return 10;
    }

    $root = dirname(__DIR__);
    try {
        require_once $root . '/admin/bootstrap.php';
        $database = getNewsDb();
        $dependencies = newsDbWriteDefaultDependencies($database);
        $counts = static fn(): array => [
            (int)$database->query('SELECT COUNT(*) FROM news')->fetchColumn(),
            (int)$database->query('SELECT COUNT(*) FROM news_journal')->fetchColumn(),
        ];
        $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.u\Z');
        $result = newsDbWriteProbeExecute(
            $dependencies,
            $counts,
            'news_probe_' . bin2hex(random_bytes(8)),
            $now
        );
        newsDbWriteProbePrint($result);
        return $result['result'] === 'ROLLBACK_OK' ? 0 : 20;
    } catch (Throwable $error) {
        $diagnostics = newsDbWriteDiagnosticFields($error);
        newsDbWriteProbePrint([
            'stage' => 'connect',
            'result' => 'FAILED',
            'sqlstate' => $diagnostics['sqlstate'],
            'driver_code' => $diagnostics['driver_code'],
            'news_rows' => -1,
            'journal_rows' => -1,
        ]);
        return 30;
    }
}

$newsDbWriteProbeScript = (string)($_SERVER['SCRIPT_FILENAME'] ?? '');
if ($newsDbWriteProbeScript !== '' && realpath($newsDbWriteProbeScript) === __FILE__) {
    exit(newsDbWriteProbeMain($argv));
}
