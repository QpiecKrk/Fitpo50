<?php

require_once __DIR__ . '/../config.php';

const NEWS_CARD_IMAGE_WIDTH = 640;
const NEWS_CARD_IMAGE_HEIGHT = 480;

function newsLiveFilePath(): string {
    return SITE_ROOT . 'data' . DIRECTORY_SEPARATOR . 'news-live.json';
}

function newsBackupDirPath(): string {
    return SITE_ROOT . 'data' . DIRECTORY_SEPARATOR . 'news-backups';
}

function newsFallbackFilePath(): string {
    return SITE_ROOT . 'assets' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'news-fallback.json';
}

function newsAssetsDirPath(): string {
    return SITE_ROOT . 'assets' . DIRECTORY_SEPARATOR . 'news' . DIRECTORY_SEPARATOR;
}

function ensureNewsStorage(): void {
    $dirs = [
        SITE_ROOT . 'data',
        newsBackupDirPath(),
        SITE_ROOT . 'assets' . DIRECTORY_SEPARATOR . 'data',
        newsAssetsDirPath(),
    ];

    foreach ($dirs as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new RuntimeException('Nie udało się utworzyć katalogu: ' . $dir);
        }
    }
}

function defaultNewsStore(): array {
    return [
        'version' => 1,
        'updatedAt' => date('c'),
        'items' => [],
    ];
}

function loadNewsStore(): array {
    ensureNewsStorage();
    $file = newsLiveFilePath();

    if (!is_file($file)) {
        return defaultNewsStore();
    }

    $raw = file_get_contents($file);
    if ($raw === false || trim($raw) === '') {
        return defaultNewsStore();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Plik news-live.json ma nieprawidłowy format JSON.');
    }

    $items = [];
    foreach (($decoded['items'] ?? []) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $items[] = normalizeNewsItem($item);
    }

    return [
        'version' => 1,
        'updatedAt' => (string)($decoded['updatedAt'] ?? date('c')),
        'items' => $items,
    ];
}

function normalizeNewsItem(array $item): array {
    $status = (string)($item['status'] ?? 'draft');
    if (!in_array($status, ['draft', 'published'], true)) {
        $status = 'draft';
    }

    $sources = [];
    foreach (($item['sources'] ?? []) as $source) {
        if (!is_array($source)) {
            continue;
        }
        $label = trim((string)($source['label'] ?? ''));
        $url = trim((string)($source['url'] ?? ''));
        if ($label === '' || $url === '') {
            continue;
        }
        $sources[] = ['label' => $label, 'url' => $url];
    }

    $sortOrder = (int)($item['sort_order'] ?? 9999);

    return [
        'id' => (string)($item['id'] ?? 'news_' . bin2hex(random_bytes(6))),
        'title' => trim((string)($item['title'] ?? '')),
        'content_html' => (string)($item['content_html'] ?? ''),
        'status' => $status,
        'sort_order' => $sortOrder,
        'image_base' => trim((string)($item['image_base'] ?? '')),
        'image_alt' => trim((string)($item['image_alt'] ?? '')),
        'sources' => $sources,
        'created_at' => (string)($item['created_at'] ?? date('c')),
        'updated_at' => (string)($item['updated_at'] ?? date('c')),
        'published_at' => (string)($item['published_at'] ?? ''),
    ];
}

function saveNewsStore(array $store, bool $withBackup = true): void {
    ensureNewsStorage();

    $normalizedItems = [];
    foreach (($store['items'] ?? []) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $normalizedItems[] = normalizeNewsItem($item);
    }

    $payload = [
        'version' => 1,
        'updatedAt' => date('c'),
        'items' => $normalizedItems,
    ];

    $livePath = newsLiveFilePath();

    if ($withBackup && is_file($livePath)) {
        $backupName = 'news-live-' . date('Ymd_His') . '.json';
        $backupPath = newsBackupDirPath() . DIRECTORY_SEPARATOR . $backupName;
        @copy($livePath, $backupPath);
    }

    atomicWriteJson($livePath, $payload);
    writeNewsLiveMirrorPayload($payload);
    writeNewsFallbackPayload($payload);
}

function writeNewsLiveMirrorPayload(array $store): void {
    $siteLive = SITE_ROOT . '_site' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'news-live.json';
    $siteLiveDir = dirname($siteLive);
    if (is_dir($siteLiveDir)) {
        atomicWriteJson($siteLive, $store);
    }
}

function atomicWriteJson(string $filePath, array $payload): void {
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new RuntimeException('Nie udało się zakodować JSON.');
    }

    $tmpPath = $filePath . '.tmp';
    if (file_put_contents($tmpPath, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Nie udało się zapisać pliku tymczasowego: ' . $filePath);
    }

    if (!@rename($tmpPath, $filePath)) {
        @unlink($tmpPath);
        throw new RuntimeException('Nie udało się podmienić pliku: ' . $filePath);
    }
}

function writeNewsFallbackPayload(array $store): void {
    $payload = buildPublicNewsPayload($store);
    atomicWriteJson(newsFallbackFilePath(), $payload);

    $siteFallback = SITE_ROOT . '_site' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'news-fallback.json';
    $siteFallbackDir = dirname($siteFallback);
    if (is_dir($siteFallbackDir)) {
        atomicWriteJson($siteFallback, $payload);
    }
}

function buildPublicNewsPayload(array $store): array {
    $items = [];

    foreach (($store['items'] ?? []) as $rawItem) {
        if (!is_array($rawItem)) {
            continue;
        }
        $item = normalizeNewsItem($rawItem);
        if ($item['status'] !== 'published') {
            continue;
        }

        $items[] = [
            'id' => $item['id'],
            'title' => $item['title'],
            'content_html' => $item['content_html'],
            'sort_order' => $item['sort_order'],
            'image' => buildPublicImageData($item),
            'sources' => $item['sources'],
            'updated_at' => $item['updated_at'],
            'published_at' => $item['published_at'] ?: $item['updated_at'],
            'excerpt' => buildNewsExcerpt($item['content_html']),
        ];
    }

    usort($items, static function (array $a, array $b): int {
        if ($a['sort_order'] === $b['sort_order']) {
            return strcmp($b['published_at'], $a['published_at']);
        }
        return $a['sort_order'] <=> $b['sort_order'];
    });

    return [
        'version' => 1,
        'updatedAt' => date('c'),
        'items' => array_values($items),
    ];
}

function buildPublicImageData(array $item): ?array {
    $base = trim((string)($item['image_base'] ?? ''));
    if ($base === '') {
        return null;
    }

    $prefix = './assets/news/' . $base;

    return [
        'avif' => $prefix . '.avif',
        'webp' => $prefix . '.webp',
        'jpg' => $prefix . '.jpg',
        'alt' => trim((string)($item['image_alt'] ?? $item['title'] ?? '')),
        'width' => NEWS_CARD_IMAGE_WIDTH,
        'height' => NEWS_CARD_IMAGE_HEIGHT,
    ];
}

function buildNewsExcerpt(string $html, int $max = 220): string {
    $text = trim(preg_replace('/\s+/u', ' ', strip_tags($html)) ?? '');
    if (mb_strlen($text) <= $max) {
        return $text;
    }
    return rtrim(mb_substr($text, 0, $max - 1)) . '…';
}

function sanitizeNewsHtml(string $html): string {
    $normalized = str_replace(["\r\n", "\r"], "\n", trim($html));
    if ($normalized === '') {
        return '';
    }

    if (!preg_match('/<\s*[a-zA-Z][^>]*>/', $normalized)) {
        $normalized = autoFormatNewsPlainText($normalized);
    }

    $prev = libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $encoded = mb_convert_encoding($normalized, 'HTML-ENTITIES', 'UTF-8');
    $loaded = @$dom->loadHTML('<body>' . $encoded . '</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

    if (!$loaded) {
        libxml_use_internal_errors($prev);
        return strip_tags($normalized);
    }

    $allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'span'];
    $allowedAttrs = ['href', 'class', 'target', 'rel'];

    $cleanNode = static function (DOMNode $node) use (&$cleanNode, $allowedTags, $allowedAttrs): void {
        for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
            $child = $node->childNodes->item($i);
            if (!$child instanceof DOMElement) {
                continue;
            }

            $tag = strtolower($child->tagName);
            if (!in_array($tag, $allowedTags, true)) {
                while ($child->firstChild) {
                    $node->insertBefore($child->firstChild, $child);
                }
                $node->removeChild($child);
                continue;
            }

            for ($a = $child->attributes->length - 1; $a >= 0; $a--) {
                $attr = $child->attributes->item($a);
                if (!$attr) {
                    continue;
                }
                $attrName = strtolower($attr->name);
                if (!in_array($attrName, $allowedAttrs, true)) {
                    $child->removeAttribute($attr->name);
                    continue;
                }

                if ($attrName === 'href' && preg_match('/^(javascript|vbscript|data):/i', $attr->value)) {
                    $child->removeAttribute('href');
                }
            }

            $cleanNode($child);
        }
    };

    $body = $dom->getElementsByTagName('body')->item(0);
    if ($body) {
        $cleanNode($body);
    }

    $out = '';
    if ($body) {
        foreach ($body->childNodes as $node) {
            $out .= $dom->saveHTML($node);
        }
    }

    libxml_clear_errors();
    libxml_use_internal_errors($prev);

    return trim((string)$out);
}

function autoFormatNewsPlainText(string $text): string {
    $blocks = preg_split('/\n{2,}/', $text) ?: [];
    $out = [];

    foreach ($blocks as $rawBlock) {
        $block = trim($rawBlock);
        if ($block === '') {
            continue;
        }

        $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), static fn($line) => $line !== ''));
        if (empty($lines)) {
            continue;
        }

        if (isNewsBulletBlock($lines)) {
            $items = [];
            foreach ($lines as $line) {
                $clean = preg_replace('/^[-*•]\s+/u', '', $line) ?? '';
                $items[] = '<li>' . htmlspecialchars($clean, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</li>';
            }
            $out[] = "<ul>\n" . implode("\n", $items) . "\n</ul>";
            continue;
        }

        $safeLines = [];
        foreach ($lines as $line) {
            $safeLines[] = htmlspecialchars($line, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        $out[] = '<p>' . implode("<br>\n", $safeLines) . '</p>';
    }

    return implode("\n", $out);
}

function isNewsBulletBlock(array $lines): bool {
    foreach ($lines as $line) {
        if (!preg_match('/^[-*•]\s+.+/u', $line)) {
            return false;
        }
    }
    return true;
}

function validateInternalLinksInNewsHtml(string $html): array {
    $errors = [];

    $prev = libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $encoded = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
    $loaded = @$dom->loadHTML('<body>' . $encoded . '</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

    if (!$loaded) {
        libxml_use_internal_errors($prev);
        return $errors;
    }

    $anchors = $dom->getElementsByTagName('a');
    foreach ($anchors as $a) {
        $href = trim((string)$a->getAttribute('href'));
        if ($href === '') {
            continue;
        }

        if (!isAllowedInternalHref($href)) {
            $errors[] = 'W treści newsa wykryto niedozwolony link zewnętrzny: ' . $href;
        }
    }

    libxml_clear_errors();
    libxml_use_internal_errors($prev);

    return $errors;
}

function isAllowedInternalHref(string $href): bool {
    if (str_starts_with($href, '#')) {
        return true;
    }

    if (str_starts_with($href, '/')) {
        return true;
    }

    if (preg_match('#^https?://#i', $href)) {
        return false;
    }

    return preg_match('/^[a-z0-9\-._\/]+\.html(?:#[a-z0-9\-._]+)?$/i', $href) === 1;
}

function normalizeNewsSources(array $labels, array $urls): array {
    $sources = [];
    $count = max(count($labels), count($urls));

    for ($i = 0; $i < $count; $i++) {
        $label = trim((string)($labels[$i] ?? ''));
        $url = trim((string)($urls[$i] ?? ''));

        if ($label === '' && $url === '') {
            continue;
        }

        if ($label === '' || $url === '') {
            throw new RuntimeException('Każde źródło musi mieć nazwę i URL.');
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new RuntimeException('Nieprawidłowy URL źródła: ' . $url);
        }

        $scheme = strtolower((string)parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new RuntimeException('Źródło musi mieć URL http:// lub https://');
        }

        $sources[] = [
            'label' => $label,
            'url' => $url,
        ];
    }

    return $sources;
}

/**
 * @param array<int,string> $labels
 * @param array<int,string> $urls
 * @return array{sources:array<int,array{label:string,url:string}>,invalid:array<int,array{index:int,reason:string,url:string}>}
 */
function normalizeNewsSourcesLenient(array $labels, array $urls): array {
    $sources = [];
    $invalid = [];
    $count = max(count($labels), count($urls));

    for ($i = 0; $i < $count; $i++) {
        $label = trim((string)($labels[$i] ?? ''));
        $url = trim((string)($urls[$i] ?? ''));

        if ($label === '' && $url === '') {
            continue;
        }

        if ($label === '' || $url === '') {
            $invalid[] = ['index' => $i + 1, 'reason' => 'brak nazwy lub URL', 'url' => $url];
            continue;
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            $invalid[] = ['index' => $i + 1, 'reason' => 'nieprawidłowy URL', 'url' => $url];
            continue;
        }

        $scheme = strtolower((string)parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            $invalid[] = ['index' => $i + 1, 'reason' => 'nieobsługiwany protokół', 'url' => $url];
            continue;
        }

        $sources[] = [
            'label' => $label,
            'url' => $url,
        ];
    }

    return [
        'sources' => $sources,
        'invalid' => $invalid,
    ];
}

function processNewsImageUpload(array $file): array {
    $error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error === UPLOAD_ERR_NO_FILE) {
        return ['image_base' => '', 'image_alt' => ''];
    }

    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Błąd uploadu miniatury (kod ' . $error . ').');
    }

    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > 20 * 1024 * 1024) {
        throw new RuntimeException('Miniatura jest pusta lub przekracza limit 20 MB.');
    }

    $tmp = (string)($file['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        throw new RuntimeException('Nieprawidłowy plik tymczasowy miniatury.');
    }

    $mime = (string)(mime_content_type($tmp) ?: '');
    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!in_array($mime, $allowedMimes, true)) {
        throw new RuntimeException('Nieobsługiwany format miniatury. Dozwolone: JPG, PNG, WebP, AVIF.');
    }

    $source = createImageResourceFromFile($tmp, $mime);
    if (!$source) {
        throw new RuntimeException('Nie udało się odczytać miniatury.');
    }

    $target = imagecreatetruecolor(NEWS_CARD_IMAGE_WIDTH, NEWS_CARD_IMAGE_HEIGHT);
    if (!$target) {
        imagedestroy($source);
        throw new RuntimeException('Nie udało się przygotować miniatury.');
    }

    imagealphablending($target, false);
    imagesavealpha($target, true);

    $transparent = imagecolorallocatealpha($target, 255, 255, 255, 127);
    imagefilledrectangle($target, 0, 0, NEWS_CARD_IMAGE_WIDTH, NEWS_CARD_IMAGE_HEIGHT, $transparent);

    $srcW = imagesx($source);
    $srcH = imagesy($source);
    $srcRatio = $srcW / max(1, $srcH);
    $targetRatio = NEWS_CARD_IMAGE_WIDTH / NEWS_CARD_IMAGE_HEIGHT;

    if ($srcRatio > $targetRatio) {
        $cropH = $srcH;
        $cropW = (int)round($srcH * $targetRatio);
        $srcX = (int)(($srcW - $cropW) / 2);
        $srcY = 0;
    } else {
        $cropW = $srcW;
        $cropH = (int)round($srcW / $targetRatio);
        $srcX = 0;
        $srcY = (int)(($srcH - $cropH) / 2);
    }

    imagecopyresampled(
        $target,
        $source,
        0,
        0,
        $srcX,
        $srcY,
        NEWS_CARD_IMAGE_WIDTH,
        NEWS_CARD_IMAGE_HEIGHT,
        $cropW,
        $cropH
    );

    $base = 'news_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4));
    $assetsDir = newsAssetsDirPath();

    $jpgPath = $assetsDir . $base . '.jpg';
    $webpPath = $assetsDir . $base . '.webp';
    $avifPath = $assetsDir . $base . '.avif';

    $jpgCanvas = imagecreatetruecolor(NEWS_CARD_IMAGE_WIDTH, NEWS_CARD_IMAGE_HEIGHT);
    $white = imagecolorallocate($jpgCanvas, 255, 255, 255);
    imagefilledrectangle($jpgCanvas, 0, 0, NEWS_CARD_IMAGE_WIDTH, NEWS_CARD_IMAGE_HEIGHT, $white);
    imagecopy($jpgCanvas, $target, 0, 0, 0, 0, NEWS_CARD_IMAGE_WIDTH, NEWS_CARD_IMAGE_HEIGHT);

    $okJpg = imagejpeg($jpgCanvas, $jpgPath, 84);
    imagedestroy($jpgCanvas);

    $okWebp = function_exists('imagewebp') ? imagewebp($target, $webpPath, 82) : false;
    $okAvif = function_exists('imageavif') ? imageavif($target, $avifPath, 75) : false;

    imagedestroy($target);
    imagedestroy($source);

    if (!$okJpg || !$okWebp || !$okAvif) {
        @unlink($jpgPath);
        @unlink($webpPath);
        @unlink($avifPath);
        throw new RuntimeException('Konwersja miniatury nie powiodła się. News nie został zapisany.');
    }

    return [
        'image_base' => $base,
    ];
}

function createImageResourceFromFile(string $tmp, string $mime) {
    return match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($tmp),
        'image/png' => @imagecreatefrompng($tmp),
        'image/webp' => @imagecreatefromwebp($tmp),
        'image/avif' => function_exists('imagecreatefromavif') ? @imagecreatefromavif($tmp) : false,
        default => false,
    };
}

function deleteNewsImageVariants(?string $base): void {
    $base = trim((string)$base);
    if ($base === '') {
        return;
    }

    $dir = newsAssetsDirPath();
    foreach (['jpg', 'webp', 'avif'] as $ext) {
        $path = $dir . $base . '.' . $ext;
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

function upsertNewsItem(array $store, array $item): array {
    $found = false;
    foreach ($store['items'] as $index => $existing) {
        if (($existing['id'] ?? '') === $item['id']) {
            $store['items'][$index] = $item;
            $found = true;
            break;
        }
    }

    if (!$found) {
        $store['items'][] = $item;
    }

    return $store;
}

function deleteNewsItemById(array $store, string $id): array {
    $store['items'] = array_values(array_filter(
        $store['items'],
        static fn(array $item): bool => ($item['id'] ?? '') !== $id
    ));

    return $store;
}

function findNewsItemById(array $store, string $id): ?array {
    foreach ($store['items'] as $item) {
        if (($item['id'] ?? '') === $id) {
            return normalizeNewsItem($item);
        }
    }

    return null;
}

function sortNewsItems(array $items): array {
    usort($items, static function (array $a, array $b): int {
        $aNorm = normalizeNewsItem($a);
        $bNorm = normalizeNewsItem($b);

        if ($aNorm['sort_order'] === $bNorm['sort_order']) {
            return strcmp($bNorm['updated_at'], $aNorm['updated_at']);
        }

        return $aNorm['sort_order'] <=> $bNorm['sort_order'];
    });

    return $items;
}

function getInternalArticleOptions(): array {
    $files = glob(SITE_ROOT . '*.html') ?: [];
    $excluded = [
        'index.html',
        'porady.html',
        'rusz-sie.html',
        'jedzenie.html',
        'zdrowie.html',
        'ciekawe.html',
        'dziennik.html',
        'moje-sukcesy.html',
        'google4a31b58b207723ed.html',
    ];

    $options = [];

    foreach ($files as $path) {
        $basename = basename($path);
        if (in_array($basename, $excluded, true)) {
            continue;
        }

        $title = extractTitleFromHtmlFile($path);
        $options[] = [
            'href' => $basename,
            'label' => $title ?: $basename,
        ];
    }

    usort($options, static fn(array $a, array $b): int => strcasecmp($a['label'], $b['label']));

    return $options;
}

function extractTitleFromHtmlFile(string $path): string {
    $content = file_get_contents($path, false, null, 0, 6000);
    if ($content === false) {
        return '';
    }

    if (preg_match('/<title>(.*?)<\/title>/is', $content, $m)) {
        return trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
    }

    if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $content, $m)) {
        return trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
    }

    return '';
}
