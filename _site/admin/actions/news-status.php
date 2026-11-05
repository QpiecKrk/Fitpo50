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
$status = (string)($_POST['status'] ?? 'draft');
$dbMode = newsStorageMode() === 'db';
if (!in_array($status, ['draft', 'published'], true)) {
    $status = 'draft';
}

if ($id === '') {
    $error = new NewsEditorValidationException('form', 'Wybierz news i spróbuj ponownie.');
    $_SESSION['flash_error'] = $dbMode ? newsDbWritePanelError($error, 'prepare') : ('Błąd: ' . $error->getMessage());
    header('Location: ../news-dashboard.php');
    exit;
}

$dbPhase = 'prepare';
$dbCommitted = false;

try {
    $store = loadNewsStore();
    $item = findNewsItemById($store, $id);

    if (!$item) {
        throw new NewsEditorValidationException('form', 'Odśwież listę newsów i wybierz wpis ponownie.');
    }

    if ($status === 'published') {
        $imageBase = trim((string)($item['image_base'] ?? ''));
        $imageHashes = normalizeNewsImageHashes($item['image_hashes'] ?? null);
        if ($imageBase !== '' && !newsImageVariantsExistStrict($imageBase)) {
            throw new NewsEditorValidationException('news_image', 'Wgraj miniaturę ponownie; wymagane są warianty JPG, WebP i AVIF.');
        }
        if ($imageBase !== '' && !newsImageHashesMatch($imageBase, $imageHashes)) {
            throw new NewsEditorValidationException('news_image', 'Wgraj miniaturę ponownie; zapisane warianty obrazu są niespójne.');
        }
    }

    $now = date('c');
    $item['status'] = $status;
    $item['updated_at'] = $now;
    $item['published_at'] = $status === 'published' ? ($item['published_at'] ?: $now) : '';

    $cacheWarning = null;
    if ($dbMode) {
        $operation = $status === 'published' ? 'publish' : 'unpublish';
        $dbPhase = 'write';
        $write = newsDbWriteMutation($operation, findNewsItemById($store, $id), $item, $now);
        $dbCommitted = true;
        $dbPhase = 'post_commit';
        $cacheWarning = newsDbRebuildCacheAfterCommit($write['change_id']);
    } else {
        $store = upsertNewsItem($store, $item);
        $store['items'] = sortNewsItems($store['items']);
        saveNewsStore($store);
    }

    $gitSync = runGitAutoSync(['news'], 'news status');

    $_SESSION['flash_success'] = $status === 'published'
        ? 'News został opublikowany.' . gitSyncResultNote($gitSync)
        : 'Publikacja newsa została cofnięta.' . gitSyncResultNote($gitSync);
    $gitError = gitSyncFlashError($gitSync);
    if ($gitError !== null) {
        $_SESSION['flash_error'] = $gitError;
    }
    if ($cacheWarning !== null) {
        $_SESSION['flash_error'] = $cacheWarning;
    }
} catch (Throwable $e) {
    $_SESSION['flash_error'] = $dbMode ? newsDbWritePanelError($e, $dbPhase) : ('Błąd: ' . $e->getMessage());
}

header('Location: ../news-dashboard.php');
exit;
