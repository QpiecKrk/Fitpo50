<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/calendar.php';
require_once __DIR__ . '/../helpers/git-sync.php';
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
        if (!isSharedDayHtmlFile($entry['html_file'])) {
            $path = SITE_ROOT . $entry['html_file'];
            if (file_exists($path)) @unlink($path);
        }
    }

    // Cofnij status do roboczy
    $db->prepare('UPDATE entries SET status=?, html_file=NULL, published_at=NULL WHERE id=?')
       ->execute(['draft', $id]);

    // Regeneruj stronę dnia + kalendarz (json_encode, bez regex na JS)
    syncDay($db, $date);

    $gitSync = runGitAutoSync(['sukcesy'], 'moje-sukcesy unpublish');

    $_SESSION['flash_success'] = 'Wpis cofnięty do roboczych. Strona dnia i fistaszek zaktualizowane.' . gitSyncResultNote($gitSync);
    $gitError = gitSyncFlashError($gitSync);
    if ($gitError !== null) {
        $_SESSION['flash_error'] = $gitError;
    }

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd cofania publikacji: ' . $e->getMessage();
}

header('Location: ../dashboard.php');
exit;

function isSharedDayHtmlFile(?string $htmlFile): bool {
    return is_string($htmlFile) && preg_match('#^sukcesy/\d{4}-\d{2}-\d{2}\.html$#', $htmlFile) === 1;
}
