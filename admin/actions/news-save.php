<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/news.php';
require_once __DIR__ . '/../helpers/git-sync.php';
requireLogin();
verifyCsrf();

const NEWS_AUTO_LINK_MIN_WORDS = 80;

function pluralizeSourceAdj(int $count): string {
    if ($count === 1) {
        return 'nieprawidłowe źródło';
    }
    $mod10 = $count % 10;
    $mod100 = $count % 100;
    if ($mod10 >= 2 && $mod10 <= 4 && !($mod100 >= 12 && $mod100 <= 14)) {
        return 'nieprawidłowe źródła';
    }
    return 'nieprawidłowych źródeł';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../news-dashboard.php');
    exit;
}

$id = trim((string)($_POST['id'] ?? ''));
$title = trim(strip_tags((string)($_POST['title'] ?? '')));
$contentRaw = trim((string)($_POST['content'] ?? ''));
$currentHref = trim((string)($_POST['current_href'] ?? ''));
$status = 'draft';
$sortOrder = (int)($_POST['sort_order'] ?? 1);
$imageAlt = trim(strip_tags((string)($_POST['image_alt'] ?? '')));
$deleteImage = !empty($_POST['delete_image']);

if ($sortOrder < 1 || $sortOrder > 9999) {
    $sortOrder = 1;
}

$redirect = $id !== '' ? ('Location: ../news-form.php?id=' . urlencode($id)) : 'Location: ../news-form.php';
$newUploadedImageBase = null;
$previousImageBase = null;

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

    $contentPlain = trim(preg_replace('/\s+/u', ' ', strip_tags($contentHtml)) ?? '');
    $newsWordCount = countWordsUtf8($contentPlain);
    $newsLinkLimits = deriveAutoLinkLimitsForWordCount($newsWordCount, 'news');
    $autoLinkResult = autoLinkInternalArticlesInHtml($contentHtml, [
        'min_words' => NEWS_AUTO_LINK_MIN_WORDS,
        'min_links' => $newsLinkLimits['min_links'],
        'max_links' => $newsLinkLimits['max_links'],
        'current_href' => $currentHref,
    ]);
    $contentHtml = $autoLinkResult['html'];

    $linkErrors = validateInternalLinksInNewsHtml($contentHtml);
    if (!empty($linkErrors)) {
        throw new RuntimeException(implode(' ', $linkErrors));
    }

    $sourcesResult = normalizeNewsSourcesLenient(
        (array)($_POST['source_label'] ?? []),
        (array)($_POST['source_url'] ?? [])
    );
    $sources = $sourcesResult['sources'];
    $invalidSources = $sourcesResult['invalid'];

    $now = date('c');
    $itemId = $existing['id'] ?? ('news_' . bin2hex(random_bytes(6)));

    $imageBase = $existing['image_base'] ?? '';
    $previousImageBase = $imageBase !== '' ? $imageBase : null;
    $hasNewUpload = isset($_FILES['news_image']) && (int)($_FILES['news_image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;

    if ($hasNewUpload) {
        $processed = processNewsImageUpload($_FILES['news_image']);
        $imageBase = $processed['image_base'];
        $newUploadedImageBase = $imageBase;
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
    if ($newUploadedImageBase !== null && $previousImageBase !== null && $previousImageBase !== $newUploadedImageBase) {
        deleteNewsImageVariants($previousImageBase);
    }

    $wasPublishedBefore = $existing && ($existing['status'] ?? '') === 'published';
    $touchesPublished = $status === 'published' || $wasPublishedBefore;
    $gitSync = $touchesPublished
        ? runGitAutoSync(['news'], 'news save/publish')
        : null;

    $successMessage = 'News zapisany jako roboczy.' . gitSyncResultNote($gitSync);
    $successMessage .= formatAutoInternalLinksMessage(
        (int)($autoLinkResult['added'] ?? 0),
        (bool)($autoLinkResult['skipped_short'] ?? false),
        NEWS_AUTO_LINK_MIN_WORDS
    );
    $invalidCount = count($invalidSources);
    if ($invalidCount > 0) {
        $successMessage .= ' Uwaga: pominięto ' . $invalidCount . ' ' . pluralizeSourceAdj($invalidCount) . '.';
    }
    $_SESSION['flash_success'] = $successMessage;

    $gitError = gitSyncFlashError($gitSync);
    if ($gitError !== null) {
        $_SESSION['flash_error'] = $gitError;
    }

    header('Location: ../news-dashboard.php');
    exit;

} catch (Throwable $e) {
    if ($newUploadedImageBase !== null) {
        deleteNewsImageVariants($newUploadedImageBase);
    }
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
    header($redirect);
    exit;
}
