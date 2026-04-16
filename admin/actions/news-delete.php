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

    $store = deleteNewsItemById($store, $id);
    saveNewsStore($store);

    $_SESSION['flash_success'] = 'News został usunięty.';
} catch (Throwable $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
}

header('Location: ../news-dashboard.php');
exit;
