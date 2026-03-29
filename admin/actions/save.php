<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
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
    if ($id) {
        $old = $db->prepare('SELECT * FROM entries WHERE id = ?');
        $old->execute([$id]);
        $oldEntry = $old->fetch();

        // Upewnij unikalność sluga
        $check = $db->prepare('SELECT id FROM entries WHERE slug = ? AND id != ?');
        $check->execute([$slug, $id]);
        if ($check->fetch()) $slug .= '-' . substr(uniqid(), -4);

        $db->prepare('UPDATE entries SET title=?,slug=?,entry_date=?,lead=?,content=?,status=?,updated_at=NOW() WHERE id=?')
           ->execute([$title, $slug, $entry_date, $lead, $content, $status, $id]);

        // Poprzednio opublikowany → teraz nie opublikowany: usuń stary HTML artykułu
        if ($oldEntry['status'] === 'published' && $status !== 'published') {
            if (!empty($oldEntry['html_file'])) {
                $path = SITE_ROOT . $oldEntry['html_file'];
                if (file_exists($path)) @unlink($path);
            }
            $db->prepare('UPDATE entries SET html_file=NULL, published_at=NULL WHERE id=?')->execute([$id]);
            // Data mogła się zmienić — regeneruj stronę starego dnia
            regenerateDayPage($db, $oldEntry['entry_date']);
        }

        // Zmiana daty u wpisu opublikowanego → regeneruj obydwa dni
        if ($oldEntry['status'] === 'published' && $status === 'published'
            && $oldEntry['entry_date'] !== $entry_date) {
            regenerateDayPage($db, $oldEntry['entry_date']);
        }

    } else {
        $check = $db->prepare('SELECT id FROM entries WHERE slug = ?');
        $check->execute([$slug]);
        if ($check->fetch()) $slug .= '-' . substr(uniqid(), -4);

        $db->prepare('INSERT INTO entries (title,slug,entry_date,lead,content,status) VALUES (?,?,?,?,?,?)')
           ->execute([$title, $slug, $entry_date, $lead, $content, $status]);
        $id = (int)$db->lastInsertId();
    }

    // Usuń zaznaczone media
    foreach ((array)($_POST['delete_media'] ?? []) as $mediaId) {
        $mediaId = (int)$mediaId;
        $mRow = $db->prepare('SELECT filename FROM media WHERE id=? AND entry_id=?');
        $mRow->execute([$mediaId, $id]);
        $mRow = $mRow->fetch();
        if ($mRow) {
            $fp = UPLOADS_DIR . $mRow['filename'];
            if (file_exists($fp)) @unlink($fp);
            $db->prepare('DELETE FROM media WHERE id=?')->execute([$mediaId]);
        }
    }

    // Upload nowych mediów
    if (!empty($_FILES['media_files']['name'][0])) handleUploads($db, $id);

    // Generuj HTML artykułu + stronę dnia jeśli published
    if ($status === 'published') {
        $entryRow = $db->prepare('SELECT * FROM entries WHERE id=?');
        $entryRow->execute([$id]);
        $entryData = $entryRow->fetch();

        $mediaRows = $db->prepare('SELECT * FROM media WHERE entry_id=? ORDER BY sort_order,id');
        $mediaRows->execute([$id]);
        $entryMedia = $mediaRows->fetchAll();

        // Generuj plik HTML artykułu
        $htmlFile = generateArticleHtml($entryData, $entryMedia);
        $db->prepare('UPDATE entries SET html_file=?,published_at=NOW() WHERE id=?')->execute([$htmlFile, $id]);

        // Regeneruj stronę dnia i zaktualizuj kalendarz
        // Odśwież $entryData po update
        $entryRow->execute([$id]);
        $entryData = $entryRow->fetch();
        regenerateDayPage($db, $entryData['entry_date']);
    }

    $_SESSION['flash_success'] = $status === 'published'
        ? 'Wpis opublikowany i pojawił się w kalendarzu!'
        : 'Wpis zapisany.';
    header("Location: ../entry-form.php?id=$id");

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd: ' . $e->getMessage();
    header($id ? "Location: ../entry-form.php?id=$id" : 'Location: ../entry-form.php');
}
exit;

// ============================================================
// Funkcje pomocnicze
// ============================================================

/**
 * Regeneruje stronę dnia (sukcesy/YYYY-MM-DD.html) na podstawie
 * wszystkich opublikowanych wpisów z danej daty.
 * Jeden dzień = jedna strona dnia — zawsze.
 */
function regenerateDayPage(PDO $db, string $date): void {
    $stmt = $db->prepare("SELECT * FROM entries WHERE entry_date = ? AND status = 'published' ORDER BY created_at ASC");
    $stmt->execute([$date]);
    $entries = $stmt->fetchAll();

    if (empty($entries)) {
        // Brak wpisów — usuń stronę dnia i fistaszka
        $dayPath = SITE_ROOT . 'sukcesy/' . $date . '.html';
        if (file_exists($dayPath)) @unlink($dayPath);
        removeFromCalendar($date);
        return;
    }

    // Generuj stronę dnia
    generateDayListPage($date, $entries);

    // Kalendarz zawsze wskazuje na stronę dnia
    $url = SITE_URL . 'sukcesy/' . $date . '.html';
    injectCalendarEntry($date, $url);
}

function generateDayListPage(string $date, array $entries): string {
    $filename = 'sukcesy/' . $date . '.html';
    $dir = SITE_ROOT . 'sukcesy/';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    ob_start();
    require ADMIN_ROOT . 'templates/day-list.php';
    $html = ob_get_clean();
    file_put_contents(SITE_ROOT . $filename, $html);
    return $filename;
}

function generateArticleHtml(array $entry, array $media): string {
    ob_start();
    require ADMIN_ROOT . 'templates/article.php';
    $html = ob_get_clean();
    $filename = $entry['slug'] . '.html';
    file_put_contents(SITE_ROOT . $filename, $html);
    return $filename;
}

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

function removeFromCalendar(string $date): void {
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    if (!file_exists($calFile)) return;
    $content = file_get_contents($calFile);
    $content = preg_replace('/\s*\{[^}]*date:\s*"' . preg_quote($date, '/') . '"[^}]*\},?/', '', $content);
    if ($content !== null) file_put_contents($calFile, $content);
}

function injectCalendarEntry(string $date, string $url): void {
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    if (!file_exists($calFile)) return;
    $content = file_get_contents($calFile);
    // Usuń stary wpis z tą datą
    $content = preg_replace('/\s*\{[^}]*date:\s*"' . preg_quote($date, '/') . '"[^}]*\},?/', '', $content);
    // Wstaw nowy na początku tablicy
    $newEntry = "\n    { date: \"$date\", url: \"$url\" },";
    $content  = preg_replace('/(const userEntries\s*=\s*\[)/', '$1' . $newEntry, $content);
    if ($content !== null) file_put_contents($calFile, $content);
}
