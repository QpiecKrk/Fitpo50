<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/calendar.php';
requireLogin();
verifyCsrf();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: ../dashboard.php'); exit; }

$db = getDb();
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if (!$id) { header('Location: ../dashboard.php'); exit; }

$stmt = $db->prepare('SELECT * FROM entries WHERE id = ?');
$stmt->execute([$id]);
$entry = $stmt->fetch();
if (!$entry) { header('Location: ../dashboard.php'); exit; }

try {
    $date = $entry['entry_date'];

    // 1. Usuń plik HTML artykułu
    if (!empty($entry['html_file'])) {
        $path = SITE_ROOT . $entry['html_file'];
        if (file_exists($path)) @unlink($path);
    }

    // 2. Usuń media (orphan cleanup)
    $mediaFiles = $db->prepare('SELECT filename FROM media WHERE entry_id = ?');
    $mediaFiles->execute([$id]);
    foreach ($mediaFiles->fetchAll() as $m) {
        $fp = UPLOADS_DIR . $m['filename'];
        if (file_exists($fp)) @unlink($fp);
    }

    // 3. Usuń wpis z bazy (CASCADE usuwa media)
    $db->prepare('DELETE FROM entries WHERE id = ?')->execute([$id]);

    // 4. Regeneruj stronę dnia + kalendarz (json_encode, bez regex na JS)
    syncDay($db, $date);

    $_SESSION['flash_success'] = 'Wpis usunięty. Strona dnia i kalendarz zaktualizowane.';

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd podczas usuwania: ' . $e->getMessage();
}

header('Location: ../dashboard.php');
exit;
