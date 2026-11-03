<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/news.php';
require_once __DIR__ . '/../helpers/news-db-write.php';
require_once __DIR__ . '/../helpers/git-sync.php';
requireLogin();
verifyCsrf();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../news-dashboard.php');
    exit;
}

$id = trim((string)($_POST['id'] ?? ''));
if ($id === '') {
    $_SESSION['flash_error'] = 'Brak identyfikatora newsa.';
    header('Location: ../news-dashboard.php');
    exit;
}

try {
    $dbMode = newsStorageMode() === 'db';
    $store = loadNewsStore();
    $item = findNewsItemById($store, $id);

    if (!$item) {
        throw new RuntimeException('Nie znaleziono newsa do usunięcia.');
    }

    $wasPublished = ($item['status'] ?? '') === 'published';
    $cacheWarning = null;
    if ($dbMode) {
        $write = newsDbWriteMutation('delete', $item, null, date('c'));
        if (!empty($item['image_base']) && !deleteNewsImageVariants($item['image_base'])) {
            error_log('[NEWS_DB_IMAGE_ORPHAN] change_id=' . $write['change_id']);
        }
        $cacheWarning = newsDbRebuildCacheAfterCommit($write['change_id']);
    } else {
        if (!empty($item['image_base'])) {
            deleteNewsImageVariants($item['image_base']);
        }
        $store = deleteNewsItemById($store, $id);
        saveNewsStore($store);
    }

    $gitSync = $wasPublished
        ? runGitAutoSync(['news'], 'news delete')
        : null;

    $_SESSION['flash_success'] = 'News został usunięty.' . gitSyncResultNote($gitSync);
    $gitError = gitSyncFlashError($gitSync);
    if ($gitError !== null) {
        $_SESSION['flash_error'] = $gitError;
    }
    if ($cacheWarning !== null) {
        $_SESSION['flash_error'] = $cacheWarning;
    }
} catch (Throwable $e) {
    $_SESSION['flash_error'] = (isset($dbMode) && $dbMode) ? 'Błąd: NEWS_DB_WRITE_FAILED' : ('Błąd: ' . $e->getMessage());
}

header('Location: ../news-dashboard.php');
exit;
