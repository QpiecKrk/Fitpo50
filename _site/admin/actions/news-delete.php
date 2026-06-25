<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/news.php';
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
    $store = loadNewsStore();
    $item = findNewsItemById($store, $id);

    if (!$item) {
        throw new RuntimeException('Nie znaleziono newsa do usunięcia.');
    }

    if (!empty($item['image_base'])) {
        deleteNewsImageVariants($item['image_base']);
    }

    $wasPublished = ($item['status'] ?? '') === 'published';

    $store = deleteNewsItemById($store, $id);
    saveNewsStore($store);

    $gitSync = $wasPublished
        ? runGitAutoSync(['news'], 'news delete')
        : null;

    $_SESSION['flash_success'] = 'News został usunięty.' . gitSyncResultNote($gitSync);
    $gitError = gitSyncFlashError($gitSync);
    if ($gitError !== null) {
        $_SESSION['flash_error'] = $gitError;
    }
} catch (Throwable $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
}

header('Location: ../news-dashboard.php');
exit;
