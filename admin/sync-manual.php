<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers/calendar.php';

// Wymagamy zalogowania, aby nie każdy mógł wywołać sync
requireLogin();

$db = getDb();
$errors = [];
$stats = [];
$synced = false;
$csrf = csrfToken();

// 1. Podstawowe statystyki (zawsze widoczne przez GET)
try {
    $stmt = $db->query("SELECT COUNT(*) FROM entries WHERE status = 'published'");
    $publishedCount = (int)$stmt->fetchColumn();
    $stats[] = "Wpisy o statusie 'published' w bazie: $publishedCount";

    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    $content = file_get_contents($calFile);
    preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $content, $m);
    $currentCount = 0;
    if (isset($m[1])) {
        $decoded = json_decode($m[1], true);
        $currentCount = is_array($decoded) ? count($decoded) : 0;
    }
    $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";

} catch (Exception $e) {
    $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
}

// 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        verifyCsrf();
        $syncedCount = calendarRebuild($db);
        sitemapRebuild($db);
        $synced = true;
        $stats[] = "✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.";
    } catch (Exception $e) {
        $errors[] = "BŁĄD SYNCHRONIZACJI: " . $e->getMessage();
    }
}

?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>Ręczna Synchronizacja Kalendarza</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; background: #f4f7f6; }
        .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-top: 0; }
        .stat { padding: 10px; margin: 5px 0; background: #e8f4fd; border-left: 4px solid #3498db; }
        .error { padding: 15px; margin: 20px 0; background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; border-radius: 4px; }
        .success { color: #059669; font-weight: bold; }
        .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Diagnostyka Kalendarza</h1>
        
        <?php foreach ($stats as $stat): ?>
            <div class="stat"><?= h($stat) ?></div>
        <?php endforeach; ?>

        <?php foreach ($errors as $error): ?>
            <div class="error"><?= h($error) ?></div>
        <?php endforeach; ?>

        <form method="POST" action="sync-manual.php" style="margin-top: 20px;">
            <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
            <button type="submit" class="btn" style="background: #27ae60; border: none; cursor: pointer; font-size: 1rem;">
                🚀 Uruchom pełną synchronizację (POST)
            </button>
        </form>

        <a href="dashboard.php" class="btn" style="background: #64748b;">Powrót do pulpitu</a>
    </div>
</body>
</html>
