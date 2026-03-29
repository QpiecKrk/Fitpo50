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
    // Generuj HTML artykułu
    $mediaRows = $db->prepare('SELECT * FROM media WHERE entry_id = ? ORDER BY sort_order, id');
    $mediaRows->execute([$id]);
    $entryMedia = $mediaRows->fetchAll();

    ob_start();
    require ADMIN_ROOT . 'templates/article.php';
    $articleHtml = ob_get_clean();
    $htmlFile = $entry['slug'] . '.html';
    file_put_contents(SITE_ROOT . $htmlFile, $articleHtml);

    // Zaktualizuj status w bazie
    $db->prepare('UPDATE entries SET html_file=?, published_at=NOW(), status=? WHERE id=?')
       ->execute([$htmlFile, 'published', $id]);

    // Regeneruj stronę dnia + kalendarz (json_encode, bez regex na JS)
    syncDay($db, $entry['entry_date']);

    $_SESSION['flash_success'] = 'Wpis opublikowany! Strona dnia i fistaszek zaktualizowane.';

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd publikacji: ' . $e->getMessage();
}

header('Location: ../dashboard.php');
exit;
