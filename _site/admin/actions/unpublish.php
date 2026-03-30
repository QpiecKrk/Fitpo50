<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/calendar.php';
requireLogin();
verifyCsrf();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: ../dashboard.php'); exit; }

$db = getDb();
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;

$stmt = $db->prepare('SELECT * FROM entries WHERE id = ?');
$stmt->execute([$id]);
$entry = $stmt->fetch();
if (!$entry) { header('Location: ../dashboard.php'); exit; }

try {
    $date = $entry['entry_date'];

    // Usuń plik HTML artykułu
    if (!empty($entry['html_file'])) {
        $path = SITE_ROOT . $entry['html_file'];
        if (file_exists($path)) @unlink($path);
    }

    // Cofnij status do roboczy
    $db->prepare('UPDATE entries SET status=?, html_file=NULL, published_at=NULL WHERE id=?')
       ->execute(['draft', $id]);

    // Regeneruj stronę dnia + kalendarz (json_encode, bez regex na JS)
    syncDay($db, $date);

    $_SESSION['flash_success'] = 'Wpis cofnięty do roboczych. Strona dnia i fistaszek zaktualizowane.';

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd cofania publikacji: ' . $e->getMessage();
}

header('Location: ../dashboard.php');
exit;
