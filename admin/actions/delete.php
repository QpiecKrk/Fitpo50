<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
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

    // 2. Usuń media tego wpisu (orphan cleanup)
    $mediaFiles = $db->prepare('SELECT filename FROM media WHERE entry_id = ?');
    $mediaFiles->execute([$id]);
    foreach ($mediaFiles->fetchAll() as $m) {
        $fp = UPLOADS_DIR . $m['filename'];
        if (file_exists($fp)) @unlink($fp);
    }

    // 3. Usuń wpis z bazy (CASCADE usuwa rekordy z tabeli media)
    $db->prepare('DELETE FROM entries WHERE id = ?')->execute([$id]);

    // 4. Regeneruj stronę dnia i kalendarz na podstawie pozostałych wpisów
    regenerateDayPage($db, $date);

    $_SESSION['flash_success'] = 'Wpis usunięty. Strona dnia i kalendarz zaktualizowane.';

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd podczas usuwania: ' . $e->getMessage();
}

header('Location: ../dashboard.php');
exit;

// ============================================================
function regenerateDayPage(PDO $db, string $date): void {
    $stmt = $db->prepare("SELECT * FROM entries WHERE entry_date = ? AND status = 'published' ORDER BY created_at ASC");
    $stmt->execute([$date]);
    $entries = $stmt->fetchAll();

    if (empty($entries)) {
        $dayPath = SITE_ROOT . 'sukcesy/' . $date . '.html';
        if (file_exists($dayPath)) @unlink($dayPath);
        removeFromCalendar($date);
        return;
    }

    generateDayListPage($date, $entries);
    $url = SITE_URL . 'sukcesy/' . $date . '.html';
    injectCalendarEntry($date, $url);
}

function generateDayListPage(string $date, array $entries): void {
    $dir = SITE_ROOT . 'sukcesy/';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    ob_start();
    require ADMIN_ROOT . 'templates/day-list.php';
    $html = ob_get_clean();
    file_put_contents($dir . $date . '.html', $html);
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
    $content = preg_replace('/\s*\{[^}]*date:\s*"' . preg_quote($date, '/') . '"[^}]*\},?/', '', $content);
    $newEntry = "\n    { date: \"$date\", url: \"$url\" },";
    $content  = preg_replace('/(const userEntries\s*=\s*\[)/', '$1' . $newEntry, $content);
    if ($content !== null) file_put_contents($calFile, $content);
}
