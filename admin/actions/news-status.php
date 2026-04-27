<?php
require_once __DIR__ . '/../config.php';
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
$status = (string)($_POST['status'] ?? 'draft');
if (!in_array($status, ['draft', 'published'], true)) {
    $status = 'draft';
}

if ($id === '') {
    $_SESSION['flash_error'] = 'Brak identyfikatora newsa.';
    header('Location: ../news-dashboard.php');
    exit;
}

try {
    $store = loadNewsStore();
    $item = findNewsItemById($store, $id);

    if (!$item) {
        throw new RuntimeException('Nie znaleziono newsa do zmiany statusu.');
    }

    if ($status === 'published') {
        $imageBase = trim((string)($item['image_base'] ?? ''));
        if ($imageBase !== '' && !newsImageVariantsExist($imageBase)) {
            throw new RuntimeException('Nie można opublikować: miniatura newsa nie istnieje w assets/news. Dodaj miniaturę ponownie i zapisz.');
        }
    }

    $now = date('c');
    $item['status'] = $status;
    $item['updated_at'] = $now;
    $item['published_at'] = $status === 'published' ? ($item['published_at'] ?: $now) : '';

    $store = upsertNewsItem($store, $item);
    $store['items'] = sortNewsItems($store['items']);
    saveNewsStore($store);

    $gitSync = runGitAutoSync(['news'], 'news status');

    $_SESSION['flash_success'] = $status === 'published'
        ? 'News został opublikowany.' . gitSyncResultNote($gitSync)
        : 'Publikacja newsa została cofnięta.' . gitSyncResultNote($gitSync);
    $gitError = gitSyncFlashError($gitSync);
    if ($gitError !== null) {
        $_SESSION['flash_error'] = $gitError;
    }
} catch (Throwable $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
}

header('Location: ../news-dashboard.php');
exit;
