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
$title = trim(strip_tags((string)($_POST['title'] ?? '')));
$contentRaw = trim((string)($_POST['content'] ?? ''));
$status = (string)($_POST['status'] ?? 'draft');
$sortOrder = (int)($_POST['sort_order'] ?? 9999);
$imageAlt = trim(strip_tags((string)($_POST['image_alt'] ?? '')));
$deleteImage = !empty($_POST['delete_image']);

if (!in_array($status, ['draft', 'published'], true)) {
    $status = 'draft';
}

if ($sortOrder < 1 || $sortOrder > 9999) {
    $sortOrder = 9999;
}

$redirect = $id !== '' ? ('Location: ../news-form.php?id=' . urlencode($id)) : 'Location: ../news-form.php';

try {
    $store = loadNewsStore();
    $existing = $id !== '' ? findNewsItemById($store, $id) : null;

    if ($id !== '' && !$existing) {
        throw new RuntimeException('Nie znaleziono newsa do edycji.');
    }

    if ($title === '') {
        throw new RuntimeException('Tytuł newsa jest wymagany.');
    }

    if ($contentRaw === '') {
        throw new RuntimeException('Treść newsa jest wymagana.');
    }

    $contentHtml = sanitizeNewsHtml($contentRaw);
    if ($contentHtml === '') {
        throw new RuntimeException('Po oczyszczeniu treści news jest pusty.');
    }

    $linkErrors = validateInternalLinksInNewsHtml($contentHtml);
    if (!empty($linkErrors)) {
        throw new RuntimeException(implode(' ', $linkErrors));
    }

    $sources = normalizeNewsSources(
        (array)($_POST['source_label'] ?? []),
        (array)($_POST['source_url'] ?? [])
    );

    $now = date('c');
    $itemId = $existing['id'] ?? ('news_' . bin2hex(random_bytes(6)));

    $imageBase = $existing['image_base'] ?? '';
    $hasNewUpload = isset($_FILES['news_image']) && (int)($_FILES['news_image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;

    if ($hasNewUpload) {
        // Stary obraz usuwamy dopiero po udanej konwersji nowego wariantu.
        $processed = processNewsImageUpload($_FILES['news_image'], $imageBase !== '' ? $imageBase : null);
        $imageBase = $processed['image_base'];
    } elseif ($deleteImage && $imageBase !== '') {
        deleteNewsImageVariants($imageBase);
        $imageBase = '';
    }

    $imageAltFinal = $imageAlt;
    if ($imageBase !== '' && $imageAltFinal === '') {
        $imageAltFinal = $title;
    }

    if ($imageBase === '') {
        $imageAltFinal = '';
    }

    $item = normalizeNewsItem([
        'id' => $itemId,
        'title' => $title,
        'content_html' => $contentHtml,
        'status' => $status,
        'sort_order' => $sortOrder,
        'image_base' => $imageBase,
        'image_alt' => $imageAltFinal,
        'sources' => $sources,
        'created_at' => $existing['created_at'] ?? $now,
        'updated_at' => $now,
        'published_at' => $status === 'published'
            ? ($existing['published_at'] ?: $now)
            : '',
    ]);

    $store = upsertNewsItem($store, $item);
    $store['items'] = sortNewsItems($store['items']);
    saveNewsStore($store);

    $_SESSION['flash_success'] = $status === 'published'
        ? 'News zapisany i opublikowany (live + fallback).'
        : 'News zapisany jako roboczy.';

    header('Location: ../news-form.php?id=' . urlencode($itemId));
    exit;

} catch (Throwable $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
    header($redirect);
    exit;
}
