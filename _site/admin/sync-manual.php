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

    // Statystyki Kalendarza
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    $calContent = file_get_contents($calFile);
    preg_match('/\/\/ ENTRIES_START\s*(?:let|const)\s+userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', (string)$calContent, $m);
    $currentCalCount = 0;
    if (isset($m[1])) {
        $decoded = json_decode($m[1], true);
        $currentCalCount = is_array($decoded) ? count($decoded) : 0;
    }
    $stats[] = "Aktualnie w moje-sukcesy.html: $currentCalCount dni";

    // Statystyki Sitemap
    $sitemapFile = SITE_ROOT . 'sitemap.xml';
    $sitemapContent = file_exists($sitemapFile) ? file_get_contents($sitemapFile) : '';
    $currentSitemapCount = substr_count($sitemapContent, '/sukcesy/');
    $stats[] = "Aktualnie w sitemap.xml: $currentSitemapCount wpisów /sukcesy/";

} catch (Exception $e) {
    $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
}

// 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        verifyCsrf();
        
        $syncedCalCount = calendarRebuild($db);
        $syncedSitemapCount = sitemapRebuild($db);
        
        $synced = true;
        
        // Weryfikacja po zapisie
        $calContentAfter = file_get_contents(SITE_ROOT . 'moje-sukcesy.html');
        preg_match('/\/\/ ENTRIES_START\s*(?:let|const)\s+userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', (string)$calContentAfter, $m);
        $finalCalCount = 0;
        if (isset($m[1])) {
            $decoded = json_decode($m[1], true);
            $finalCalCount = is_array($decoded) ? count($decoded) : 0;
        }

        $sitemapContentAfter = file_get_contents(SITE_ROOT . 'sitemap.xml');
        $verifySitemapCount = substr_count($sitemapContentAfter, '/sukcesy/');
        
        $stats[] = "✓ Zsynchronizowano pomyślnie:";
        $stats[] = "— Kalendarz: $syncedCalCount dni (w pliku: $finalCalCount)";
        $stats[] = "— Sitemap: $syncedSitemapCount adresów (w pliku: $verifySitemapCount)";
        
        // Twarda walidacja niespójności
        if ($publishedCount > 0 && $finalCalCount === 0) {
            $errors[] = "⚠️ KRYTYCZNA NIESPÓJNOŚĆ: Kalendarz w HTML jest pustY, mimo że w bazie jest $publishedCount wpisów!";
        }

        if ($verifySitemapCount !== $syncedSitemapCount) {
            $errors[] = "UWAGA: Rozbieżność w sitemapie! Oczekiwano $syncedSitemapCount, znaleziono $verifySitemapCount.";
        }
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
