<?php
require_once __DIR__ . '/../config.php';
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
    // Dla "Moje Sukcesy" publikacja wskazuje stronę dnia, bez tworzenia osobnego slug.html.
    cleanupLegacyStandaloneHtml($entry['html_file'] ?? null);
    $htmlFile = buildDayHtmlPath((string)$entry['entry_date']);

    // Zaktualizuj status w bazie
    $db->prepare('UPDATE entries SET html_file=?, published_at=NOW(), status=? WHERE id=?')
       ->execute([$htmlFile, 'published', $id]);

    // Regeneruj stronę dnia + kalendarz (json_encode, bez regex na JS)
    syncDay($db, $entry['entry_date']);

    $gitSync = runGitAutoSync(['sukcesy'], 'moje-sukcesy publish');

    $_SESSION['flash_success'] = 'Wpis opublikowany! Strona dnia i fistaszek zaktualizowane.' . gitSyncResultNote($gitSync);
    $gitError = gitSyncFlashError($gitSync);
    if ($gitError !== null) {
        $_SESSION['flash_error'] = $gitError;
    }

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd publikacji: ' . $e->getMessage();
}

header('Location: ../dashboard.php');
exit;

function buildDayHtmlPath(string $entryDate): string {
    return 'sukcesy/' . $entryDate . '.html';
}

function cleanupLegacyStandaloneHtml(?string $htmlFile): void {
    if (!$htmlFile) return;
    if (str_starts_with($htmlFile, 'sukcesy/')) return;
    if (!str_ends_with($htmlFile, '.html')) return;
    $path = SITE_ROOT . $htmlFile;
    if (is_file($path)) {
        @unlink($path);
    }
}
