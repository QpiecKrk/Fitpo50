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
    $allowed = ['image/jpeg','image/png','image/webp','image/avif','image/gif'];
    $maxSize = 10 * 1024 * 1024;
    $files   = $_FILES['media_files'];
    $count   = count($files['name']);
    for ($i = 0; $i < $count; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK || $files['size'][$i] > $maxSize) continue;
        $mime = mime_content_type($files['tmp_name'][$i]);
        if (!in_array($mime, $allowed)) continue;
        $ext      = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
        $filename = uniqid('img_', true) . '.' . $ext;
        if (move_uploaded_file($files['tmp_name'][$i], UPLOADS_DIR . $filename)) {
            $db->prepare('INSERT INTO media (entry_id,filename,original_name,mime_type,sort_order) VALUES (?,?,?,?,?)')
               ->execute([$entryId, $filename, $files['name'][$i], $mime, $i]);
        }
    }
}

function generateArticleHtml(array $entry, array $media): string {
    ob_start();
    require ADMIN_ROOT . 'templates/article.php';
    $html = ob_get_clean();
    $filename = $entry['slug'] . '.html';
    file_put_contents(SITE_ROOT . $filename, $html);
    return $filename;
}
