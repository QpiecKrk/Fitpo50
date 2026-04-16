<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/news.php';
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

    $now = date('c');
    $item['status'] = $status;
    $item['updated_at'] = $now;
    $item['published_at'] = $status === 'published' ? ($item['published_at'] ?: $now) : '';

    $store = upsertNewsItem($store, $item);
    $store['items'] = sortNewsItems($store['items']);
    saveNewsStore($store);

    $_SESSION['flash_success'] = $status === 'published'
        ? 'News został opublikowany.'
        : 'Publikacja newsa została cofnięta.';
} catch (Throwable $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
}

header('Location: ../news-dashboard.php');
exit;
