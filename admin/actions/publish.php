<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
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
    $html = ob_get_clean();
    $htmlFile = $entry['slug'] . '.html';
    file_put_contents(SITE_ROOT . $htmlFile, $html);

    // Zaktualizuj wpis w bazie
    $db->prepare('UPDATE entries SET html_file = ?, published_at = NOW(), status = ? WHERE id = ?')
       ->execute([$htmlFile, 'published', $id]);

    // Regeneruj stronę dnia — pobierz wszystkie opublikowane wpisy z tej daty (w tym ten właśnie)
    regenerateDayPage($db, $entry['entry_date']);

    $_SESSION['flash_success'] = 'Wpis opublikowany! Strona dnia i fistaszek zaktualizowane.';

} catch (Exception $e) {
    $_SESSION['flash_error'] = 'Błąd publikacji: ' . $e->getMessage();
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
