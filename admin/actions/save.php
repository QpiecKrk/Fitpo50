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

$title      = trim($_POST['title'] ?? '');
$lead       = trim($_POST['lead'] ?? '');
$content    = trim($_POST['content'] ?? '');
$entry_date = trim($_POST['entry_date'] ?? '');
$status     = in_array($_POST['status'] ?? '', ['draft','published','hidden'])
              ? $_POST['status'] : 'draft';
if ($action === 'draft') $status = 'draft';

$errors = [];
if (!$title)      $errors[] = 'Tytuł jest wymagany.';
if (!$content)    $errors[] = 'Treść jest wymagana.';
if (!$entry_date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $entry_date)) $errors[] = 'Nieprawidłowa data.';

if ($errors) {
    $_SESSION['flash_error'] = implode(' ', $errors);
    header($id ? "Location: ../entry-form.php?id=$id" : 'Location: ../entry-form.php');
    exit;
}

$slug = generateSlug($entry_date, $title);

try {
    $affectedDates = [];

    if ($id) {
        $old = $db->prepare('SELECT * FROM entries WHERE id = ?');
        $old->execute([$id]);
        $oldEntry = $old->fetch();

        $check = $db->prepare('SELECT id FROM entries WHERE slug = ? AND id != ?');
        $check->execute([$slug, $id]);
        if ($check->fetch()) $slug .= '-' . substr(uniqid(), -4);

        $db->prepare('UPDATE entries SET title=?,slug=?,entry_date=?,lead=?,content=?,status=?,updated_at=NOW() WHERE id=?')
           ->execute([$title, $slug, $entry_date, $lead, $content, $status, $id]);

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

        $db->prepare('INSERT INTO entries (title,slug,entry_date,lead,content,status) VALUES (?,?,?,?,?,?)')
           ->execute([$title, $slug, $entry_date, $lead, $content, $status]);
        $id = (int)$db->lastInsertId();
        $affectedDates[] = $entry_date;
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
    foreach (array_unique($affectedDates) as $d) {
        syncDay($db, $d);
    }

    $_SESSION['flash_success'] = $status === 'published'
        ? 'Wpis opublikowany! Strona dnia i kalendarz zaktualizowane.'
        : 'Wpis zapisany.';
    header("Location: ../entry-form.php?id=$id");

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
    header($id ? "Location: ../entry-form.php?id=$id" : 'Location: ../entry-form.php');
}
exit;

// ── helpers ──────────────────────────────────────────────────────────
function handleUploads(PDO $db, int $entryId): void {
    $allowed = ['image/jpeg','image/png','image/webp','image/gif'];
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
