<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/calendar.php';
requireLogin();
verifyCsrf();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: ../dashboard.php'); exit; }

$db     = getDb();
$id     = isset($_POST['id']) ? (int)$_POST['id'] : null;
$action = $_POST['action'] ?? 'save';

$title      = strip_tags(trim($_POST['title'] ?? ''));
$lead       = strip_tags(trim($_POST['lead'] ?? ''));
$content    = sanitizeHtml(trim($_POST['content'] ?? ''));
$entry_date = trim($_POST['entry_date'] ?? '');
$status     = in_array($_POST['status'] ?? '', ['draft','published','hidden'])
              ? $_POST['status'] : 'draft';
if ($action === 'draft') $status = 'draft';
$videoSource = in_array($_POST['video_source'] ?? '', ['none', 'youtube', 'upload'], true)
    ? $_POST['video_source']
    : 'none';
$youtubeUrl = trim($_POST['youtube_url'] ?? '');
$youtubeOrientation = normalizeOrientation($_POST['youtube_orientation'] ?? 'horizontal');
$uploadedVideoOrientation = normalizeOrientation($_POST['uploaded_video_orientation'] ?? 'horizontal');
$deleteUploadedVideo = !empty($_POST['delete_uploaded_video']);
$youtubeVideoIdFromInput = null;
$hasNewUploadedVideo = isset($_FILES['uploaded_video_file'])
    && ($_FILES['uploaded_video_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;

$errors = [];
if (!$title)      $errors[] = 'Tytuł jest wymagany.';
if (!$content)    $errors[] = 'Treść jest wymagana.';
if (!$entry_date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $entry_date)) $errors[] = 'Nieprawidłowa data.';
if ($videoSource === 'youtube') {
    if ($youtubeUrl === '') {
        $errors[] = 'Dodaj link YouTube lub wybierz inne źródło wideo.';
    } else {
        $youtubeVideoIdFromInput = extractYouTubeVideoId($youtubeUrl);
        if (!$youtubeVideoIdFromInput) {
            $errors[] = 'Nie udało się odczytać ID filmu z linku YouTube.';
        }
    }
}
if ($videoSource === 'upload' && !$hasNewUploadedVideo && !$id) {
    $errors[] = 'Wgraj plik wideo lub wybierz inne źródło.';
}

if ($errors) {
    $_SESSION['flash_error'] = implode(' ', $errors);
    header($id ? "Location: ../entry-form.php?id=$id" : 'Location: ../entry-form.php');
    exit;
}

$slug = generateSlug($entry_date, $title);

try {
    ensureVideoColumns($db);
    $affectedDates = [];

    $youtubeVideoId = null;
    $uploadedVideoFilename = null;
    $uploadedVideoMime = null;

    if ($id) {
        $old = $db->prepare('SELECT * FROM entries WHERE id = ?');
        $old->execute([$id]);
        $oldEntry = $old->fetch();
        if (!$oldEntry) {
            throw new RuntimeException('Nie znaleziono wpisu do edycji.');
        }
        $youtubeVideoId = $oldEntry['youtube_video_id'] ?? null;
        $uploadedVideoFilename = $oldEntry['uploaded_video_filename'] ?? null;
        $uploadedVideoMime = $oldEntry['uploaded_video_mime'] ?? null;

        $check = $db->prepare('SELECT id FROM entries WHERE slug = ? AND id != ?');
        $check->execute([$slug, $id]);
        if ($check->fetch()) $slug .= '-' . substr(uniqid(), -4);

        // Zbierz daty do regeneracji (stara data jeśli się zmieniła)
        $affectedDates[] = $entry_date;
        if ($oldEntry['entry_date'] !== $entry_date) {
            $affectedDates[] = $oldEntry['entry_date'];
        }

        // Jeśli publikacja cofnięta — usuń plik HTML artykułu
        if ($oldEntry['status'] === 'published' && $status !== 'published') {
            if (!empty($oldEntry['html_file'])) {
                $p = SITE_ROOT . $oldEntry['html_file'];
                if (file_exists($p)) @unlink($p);
            }
            $db->prepare('UPDATE entries SET html_file=NULL, published_at=NULL WHERE id=?')->execute([$id]);
        }

    } else {
        $check = $db->prepare('SELECT id FROM entries WHERE slug = ?');
        $check->execute([$slug]);
        if ($check->fetch()) $slug .= '-' . substr(uniqid(), -4);

        $affectedDates[] = $entry_date;
    }

    if ($youtubeVideoIdFromInput !== null) {
        $youtubeVideoId = $youtubeVideoIdFromInput;
    } elseif (!$id) {
        $youtubeVideoId = null;
    }

    if ($deleteUploadedVideo && $uploadedVideoFilename) {
        $oldVideoPath = UPLOADS_DIR . $uploadedVideoFilename;
        if (file_exists($oldVideoPath)) @unlink($oldVideoPath);
        $uploadedVideoFilename = null;
        $uploadedVideoMime = null;
    }

    if ($hasNewUploadedVideo) {
        $uploadedVideo = handleVideoUpload($_FILES['uploaded_video_file']);
        if ($uploadedVideoFilename && $uploadedVideoFilename !== $uploadedVideo['filename']) {
            $oldVideoPath = UPLOADS_DIR . $uploadedVideoFilename;
            if (file_exists($oldVideoPath)) @unlink($oldVideoPath);
        }
        $uploadedVideoFilename = $uploadedVideo['filename'];
        $uploadedVideoMime = $uploadedVideo['mime'];
    }

    if ($videoSource === 'youtube' && !$youtubeVideoId) {
        throw new RuntimeException('Wybrane źródło YouTube wymaga poprawnego linku.');
    }
    if ($videoSource === 'upload' && !$uploadedVideoFilename) {
        throw new RuntimeException('Wybrane źródło "Plik wideo" wymaga dodanego pliku.');
    }

    if ($id) {
        $db->prepare('UPDATE entries SET title=?,slug=?,entry_date=?,lead=?,content=?,status=?,video_source=?,youtube_video_id=?,youtube_orientation=?,uploaded_video_filename=?,uploaded_video_mime=?,uploaded_video_orientation=?,updated_at=NOW() WHERE id=?')
           ->execute([
               $title,
               $slug,
               $entry_date,
               $lead,
               $content,
               $status,
               $videoSource,
               $youtubeVideoId,
               $youtubeOrientation,
               $uploadedVideoFilename,
               $uploadedVideoMime,
               $uploadedVideoOrientation,
               $id
           ]);
    } else {
        $db->prepare('INSERT INTO entries (title,slug,entry_date,lead,content,status,video_source,youtube_video_id,youtube_orientation,uploaded_video_filename,uploaded_video_mime,uploaded_video_orientation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
           ->execute([
               $title,
               $slug,
               $entry_date,
               $lead,
               $content,
               $status,
               $videoSource,
               $youtubeVideoId,
               $youtubeOrientation,
               $uploadedVideoFilename,
               $uploadedVideoMime,
               $uploadedVideoOrientation
           ]);
        $id = (int)$db->lastInsertId();
    }

    // Usuń zaznaczone media
    foreach ((array)($_POST['delete_media'] ?? []) as $mediaId) {
        $mediaId = (int)$mediaId;
        $mRow = $db->prepare('SELECT filename FROM media WHERE id=? AND entry_id=?');
        $mRow->execute([$mediaId, $id]);
        $m = $mRow->fetch();
        if ($m) {
            $fp = UPLOADS_DIR . $m['filename'];
            if (file_exists($fp)) @unlink($fp);
            $db->prepare('DELETE FROM media WHERE id=?')->execute([$mediaId]);
        }
    }

    // Upload nowych mediów
    if (!empty($_FILES['media_files']['name'][0])) handleUploads($db, $id);

    // Generuj HTML artykułu jeśli published
    if ($status === 'published') {
        $entryRow = $db->prepare('SELECT * FROM entries WHERE id=?');
        $entryRow->execute([$id]);
        $entryData = $entryRow->fetch();

        $mediaRows = $db->prepare('SELECT * FROM media WHERE entry_id=? ORDER BY sort_order,id');
        $mediaRows->execute([$id]);
        $entryMedia = $mediaRows->fetchAll();

        $htmlFile = generateArticleHtml($entryData, $entryMedia);
        $db->prepare('UPDATE entries SET html_file=?,published_at=NOW() WHERE id=?')->execute([$htmlFile, $id]);
        $affectedDates[] = $entry_date;
    }

    // Regeneruj strony dni + kalendarz (json_encode, bez regex na JS)
    $syncedCount = 0;
    foreach (array_unique($affectedDates) as $d) {
        $syncedCount = syncDay($db, $d);
    }

    $_SESSION['flash_success'] = $status === 'published'
        ? "Wpis opublikowany! Kalendarz zsynchronizowany ($syncedCount dni)."
        : 'Wpis zapisany.';
    header("Location: ../entry-form.php?id=$id");

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
    header($id ? "Location: ../entry-form.php?id=$id" : 'Location: ../entry-form.php');
}
exit;

// ── helpers ──────────────────────────────────────────────────────────
function handleUploads(PDO $db, int $entryId): void {
    $allowed = ['image/jpeg','image/png','image/webp','image/gif','image/avif'];
    $maxSize = 10 * 1024 * 1024;
    $files   = $_FILES['media_files'];
    $count   = count($files['name']);
    for ($i = 0; $i < $count; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK || $files['size'][$i] > $maxSize) continue;
        $mime = mime_content_type($files['tmp_name'][$i]);
        if (!in_array($mime, $allowed)) continue;
        $ext      = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
        $filename = uniqid('img_', true) . '.' . $ext;
        $destPath = UPLOADS_DIR . $filename;
        
        // Kompresja i skalowanie
        $destDir = UPLOADS_DIR;
        $baseName = uniqid('img_', true);
        
        if ($mime === 'image/gif') {
            // Animowanych GIF nie ruszamy GD, żeby nie zepsuć klatek
            $filename = $baseName . '.gif';
            move_uploaded_file($files['tmp_name'][$i], $destDir . $filename);
            $success = true;
        } else {
            $generated = processAndSaveImageVariants($files['tmp_name'][$i], $baseName, $mime, $destDir);
            $filename = $generated['jpg'] ?? ($baseName . '.jpg');
            $success = !empty($generated);
        }

        if ($success) {
            $db->prepare('INSERT INTO media (entry_id,filename,original_name,mime_type,sort_order) VALUES (?,?,?,?,?)')
               ->execute([$entryId, $filename, $files['name'][$i], $mime, $i]);
        }
    }
}

/**
 * Optymalizuje obraz: obraca według EXIF, skaluje (max 1600px) i kompresuje 
 * do 3 wariantów: AVIF, WebP, JPG.
 * Zwraca mapę z wygenerowanymi nazwami plików.
 */
function processAndSaveImageVariants(string $sourcePath, string $baseName, string $mime, string $destDir): array {
    $image = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($sourcePath),
        'image/png'  => @imagecreatefrompng($sourcePath),
        'image/webp' => @imagecreatefromwebp($sourcePath),
        default      => false,
    };
    if (!$image) {
        // Fallback w razie uszkodzonego nagłówka: kopiowanie
        move_uploaded_file($sourcePath, $destDir . $baseName . '.jpg');
        return ['jpg' => $baseName . '.jpg'];
    }

    // Korekta orientacji EXIF (tylko JPEG)
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($sourcePath);
        if (!empty($exif['Orientation'])) {
            $image = match ($exif['Orientation']) {
                3 => imagerotate($image, 180, 0),
                6 => imagerotate($image, -90, 0),
                8 => imagerotate($image, 90, 0),
                default => $image
            };
        }
    }

    // Oblicz wymiary (Max 1600px)
    $maxWidth = 1600;
    $maxHeight = 1600;
    $origWidth = imagesx($image);
    $origHeight = imagesy($image);

    if ($origWidth > $maxWidth || $origHeight > $maxHeight) {
        $ratio = min($maxWidth / $origWidth, $maxHeight / $origHeight);
        $newWidth = (int)round($origWidth * $ratio);
        $newHeight = (int)round($origHeight * $ratio);

        $resized = imagecreatetruecolor($newWidth, $newHeight);
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        $transparent = imagecolorallocatealpha($resized, 255, 255, 255, 127);
        imagefilledrectangle($resized, 0, 0, $newWidth, $newHeight, $transparent);

        imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);
        imagedestroy($image);
        $image = $resized;
    }

    $generated = [];
    $gd_info = gd_info();

    // 1. Zapisz JPG (wymagane, fallback)
    $jpgPath = $destDir . $baseName . '.jpg';
    // By usunąć czarne tło z elementów PNG przy konwersji do JPG:
    $jpgImage = imagecreatetruecolor(imagesx($image), imagesy($image));
    $white = imagecolorallocate($jpgImage, 255, 255, 255);
    imagefill($jpgImage, 0, 0, $white);
    imagecopy($jpgImage, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
    imagejpeg($jpgImage, $jpgPath, 82); // Quality 82
    imagedestroy($jpgImage);
    $generated['jpg'] = $baseName . '.jpg';

    // Włączyć obsługę przezroczystości dla natywnych WebP/AVIF
    imagealphablending($image, false);
    imagesavealpha($image, true);

    // 2. Zapisz WebP (jeśli obsługiwane)
    if (!empty($gd_info['WebP Support'])) {
        $webpPath = $destDir . $baseName . '.webp';
        imagewebp($image, $webpPath, 85);
        $generated['webp'] = $baseName . '.webp';
    }

    // 3. Zapisz AVIF (jeśli obsługiwane przez GD w PHP 8+)
    if (!empty($gd_info['AVIF Support']) && function_exists('imageavif')) {
        $avifPath = $destDir . $baseName . '.avif';
        imageavif($image, $avifPath, 75);
        $generated['avif'] = $baseName . '.avif';
    }

    imagedestroy($image);
    return $generated;
}

function generateArticleHtml(array $entry, array $media): string {
    ob_start();
    require ADMIN_ROOT . 'templates/article.php';
    $html = ob_get_clean();
    $filename = $entry['slug'] . '.html';
    file_put_contents(SITE_ROOT . $filename, $html);
    return $filename;
}

/**
 * Bezpiecznie oczyszcza wejściowy HTML zostawiając tylko whitelist tagów i atrybutów.
 */
function sanitizeHtml(string $html): string {
    if (empty($html)) return '';

    $normalized = str_replace(["\r\n", "\r"], "\n", trim($html));
    if (!preg_match('/<\s*[a-zA-Z][^>]*>/', $normalized)) {
        $html = autoFormatPlainText($normalized);
    } else {
        $html = $normalized;
    }

    $libxml_prev = libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    
    $encoded = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
    $success = @$dom->loadHTML('<body>' . $encoded . '</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    
    if (!$success) {
        libxml_use_internal_errors($libxml_prev);
        return strip_tags($html);
    }
    
    $allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div'];
    $allowedAttributes = ['href', 'class', 'id', 'target', 'rel'];

    $removeInvalidNodes = function (DOMNode $node) use (&$removeInvalidNodes, $allowedTags, $allowedAttributes) {
        for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
            $child = $node->childNodes->item($i);
            
            if ($child instanceof DOMElement) {
                $tag = strtolower($child->tagName);
                if (!in_array($tag, $allowedTags)) {
                    if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed'])) {
                        $node->removeChild($child);
                    } else {
                        while ($child->firstChild) {
                            $node->insertBefore($child->firstChild, $child);
                        }
                        $node->removeChild($child);
                    }
                    continue;
                }
                
                for ($a = $child->attributes->length - 1; $a >= 0; $a--) {
                    $attr = $child->attributes->item($a);
                    $attrName = strtolower($attr->name);
                    
                    if (!in_array($attrName, $allowedAttributes)) {
                        $child->removeAttributeNode($attr);
                        continue;
                    }
                    
                    if ($attrName === 'href' && preg_match('/^(javascript|vbscript|data):/i', $attr->value)) {
                        $child->removeAttributeNode($attr);
                    }
                }
                $removeInvalidNodes($child);
            }
        }
    };
    
    $body = $dom->getElementsByTagName('body')->item(0);
    if ($body) {
        $removeInvalidNodes($body);
    }
    
    $out = '';
    if ($body) {
        foreach ($body->childNodes as $child) {
            $out .= $dom->saveHTML($child);
        }
    }
    
    // DOMDocument sam dba o poprawność encji w $dom->saveHTML()
    
    libxml_clear_errors();
    libxml_use_internal_errors($libxml_prev);
    
    return trim($out);
}

function autoFormatPlainText(string $text): string {
    if ($text === '') return '';

    $blocks = preg_split('/\n{2,}/', $text) ?: [];
    $out = [];

    foreach ($blocks as $blockRaw) {
        $block = trim($blockRaw);
        if ($block === '') continue;

        $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), static fn($line) => $line !== ''));
        if (empty($lines)) continue;

        if (isBulletBlock($lines)) {
            $items = [];
            foreach ($lines as $line) {
                $clean = preg_replace('/^[-*]\s+/u', '', $line);
                $safe = htmlspecialchars($clean ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $items[] = '<li>' . autoEmphasizeKeywords($safe) . '</li>';
            }
            $out[] = "<ul>\n" . implode("\n", $items) . "\n</ul>";
            continue;
        }

        if (isNumberedBlock($lines)) {
            $items = [];
            foreach ($lines as $line) {
                $clean = preg_replace('/^\d+[\.\)]\s+/u', '', $line);
                $safe = htmlspecialchars($clean ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $items[] = '<li>' . autoEmphasizeKeywords($safe) . '</li>';
            }
            $out[] = "<ol>\n" . implode("\n", $items) . "\n</ol>";
            continue;
        }

        if (count($lines) === 1) {
            if (preg_match('/^#{2,3}\s+(.+)$/u', $lines[0], $m)) {
                $heading = htmlspecialchars(trim($m[1]), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $out[] = '<h3>' . autoEmphasizeKeywords($heading) . '</h3>';
                continue;
            }
            if (isAutoHeading($lines[0])) {
                $heading = htmlspecialchars(rtrim($lines[0], ':'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $out[] = '<h3>' . autoEmphasizeKeywords($heading) . '</h3>';
                continue;
            }
        }

        $paragraphLines = [];
        foreach ($lines as $line) {
            $safeLine = htmlspecialchars($line, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $paragraphLines[] = autoEmphasizeKeywords($safeLine);
        }
        $out[] = '<p>' . implode("<br>\n", $paragraphLines) . '</p>';
    }

    return implode("\n", $out);
}

function isBulletBlock(array $lines): bool {
    foreach ($lines as $line) {
        if (!preg_match('/^[-*]\s+.+/u', $line)) {
            return false;
        }
    }
    return true;
}

function isNumberedBlock(array $lines): bool {
    foreach ($lines as $line) {
        if (!preg_match('/^\d+[\.\)]\s+.+/u', $line)) {
            return false;
        }
    }
    return true;
}

function isAutoHeading(string $line): bool {
    $line = trim($line);
    $length = mb_strlen($line);
    if ($length < 8 || $length > 72) return false;
    return str_ends_with($line, ':');
}

function autoEmphasizeKeywords(string $text): string {
    $text = preg_replace('/^(Wazne|Ważne|Uwaga|Tip|Wskazowka|Wskazówka|Kluczowe|Cel|Plan|Progres|Postep|Postęp)(\s*:)/iu', '<strong>$1</strong>$2', $text);
    return (string)preg_replace('/\b(najwazniejsze|najważniejsze|kluczowe|wazne|ważne|uwaga|wskazowka|wskazówka|tip|progres|postep|postęp)\b/iu', '<strong>$1</strong>', $text);
}

function normalizeOrientation(string $value): string {
    return $value === 'vertical' ? 'vertical' : 'horizontal';
}

function extractYouTubeVideoId(string $url): ?string {
    $url = trim($url);
    if ($url === '') return null;

    if (preg_match('/^[a-zA-Z0-9_-]{11}$/', $url)) {
        return $url;
    }

    $parts = @parse_url($url);
    if (!is_array($parts)) return null;

    $host = strtolower($parts['host'] ?? '');
    $path = trim($parts['path'] ?? '', '/');
    parse_str($parts['query'] ?? '', $query);

    if (str_contains($host, 'youtu.be') && $path !== '') {
        $candidate = explode('/', $path)[0];
        return preg_match('/^[a-zA-Z0-9_-]{11}$/', $candidate) ? $candidate : null;
    }

    if (str_contains($host, 'youtube.com') || str_contains($host, 'youtube-nocookie.com')) {
        if (!empty($query['v']) && preg_match('/^[a-zA-Z0-9_-]{11}$/', (string)$query['v'])) {
            return (string)$query['v'];
        }

        $segments = $path !== '' ? explode('/', $path) : [];
        if (count($segments) >= 2 && in_array($segments[0], ['shorts', 'embed', 'live'], true)) {
            return preg_match('/^[a-zA-Z0-9_-]{11}$/', $segments[1]) ? $segments[1] : null;
        }
    }

    return null;
}

function handleVideoUpload(array $file): array {
    $maxSize = 150 * 1024 * 1024; // 150 MB
    $allowedMime = [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-m4v',
    ];
    $allowedExt = ['mp4', 'webm', 'mov', 'm4v'];

    $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Nie udało się wgrać pliku wideo (kod błędu: ' . (int)$error . ').');
    }

    $size = (int)($file['size'] ?? 0);
    if ($size <= 0 || $size > $maxSize) {
        throw new RuntimeException('Plik wideo jest pusty albo przekracza limit 150 MB.');
    }

    $tmpName = (string)($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new RuntimeException('Nieprawidłowy plik tymczasowy uploadu wideo.');
    }

    $mime = (string)(mime_content_type($tmpName) ?: '');
    $originalName = (string)($file['name'] ?? 'video.mp4');
    $ext = strtolower((string)pathinfo($originalName, PATHINFO_EXTENSION));

    $isMimeAllowed = in_array($mime, $allowedMime, true);
    $isExtAllowed = in_array($ext, $allowedExt, true);
    if (!$isMimeAllowed && !$isExtAllowed) {
        throw new RuntimeException('Nieobsługiwany format wideo. Dozwolone: MP4, MOV, M4V, WebM.');
    }

    if (!$isExtAllowed) {
        $ext = match ($mime) {
            'video/webm' => 'webm',
            'video/quicktime' => 'mov',
            'video/x-m4v' => 'm4v',
            default => 'mp4',
        };
    }

    $filename = uniqid('vid_', true) . '.' . $ext;
    $destPath = UPLOADS_DIR . $filename;
    if (!move_uploaded_file($tmpName, $destPath)) {
        throw new RuntimeException('Nie udało się zapisać pliku wideo na serwerze.');
    }

    return [
        'filename' => $filename,
        'mime' => $isMimeAllowed ? $mime : ('video/' . ($ext === 'mov' ? 'quicktime' : $ext)),
    ];
}

function ensureVideoColumns(PDO $db): void {
    static $checked = false;
    if ($checked) return;

    $columns = [
        'video_source' => "ALTER TABLE entries ADD COLUMN video_source VARCHAR(16) NOT NULL DEFAULT 'none' AFTER status",
        'youtube_video_id' => "ALTER TABLE entries ADD COLUMN youtube_video_id VARCHAR(32) NULL AFTER video_source",
        'youtube_orientation' => "ALTER TABLE entries ADD COLUMN youtube_orientation VARCHAR(12) NOT NULL DEFAULT 'horizontal' AFTER youtube_video_id",
        'uploaded_video_filename' => "ALTER TABLE entries ADD COLUMN uploaded_video_filename VARCHAR(300) NULL AFTER youtube_orientation",
        'uploaded_video_mime' => "ALTER TABLE entries ADD COLUMN uploaded_video_mime VARCHAR(100) NULL AFTER uploaded_video_filename",
        'uploaded_video_orientation' => "ALTER TABLE entries ADD COLUMN uploaded_video_orientation VARCHAR(12) NOT NULL DEFAULT 'horizontal' AFTER uploaded_video_mime",
    ];

    foreach ($columns as $columnName => $ddl) {
        $stmt = $db->prepare(
            "SELECT COUNT(*) 
             FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'entries' 
               AND COLUMN_NAME = ?"
        );
        $stmt->execute([$columnName]);
        $exists = (int)$stmt->fetchColumn() > 0;
        if (!$exists) {
            $db->exec($ddl);
        }
    }

    $checked = true;
}
