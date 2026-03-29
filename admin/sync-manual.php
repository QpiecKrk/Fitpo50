<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers/calendar.php';

// Wymagamy zalogowania, aby nie każdy mógł wywołać sync
requireLogin();

$db = getDb();
$errors = [];
$stats = [];

try {
    // 1. Sprawdź liczbę wpisów w bazie
    $stmt = $db->query("SELECT COUNT(*) FROM entries WHERE status = 'published'");
    $publishedCount = (int)$stmt->fetchColumn();
    $stats[] = "Wpisy o statusie 'published' w bazie: <strong>$publishedCount</strong>";

    // 2. Wykonaj pełną przebudowę kalendarza
    $syncedCount = calendarRebuild($db);
    $stats[] = "Liczba dni wpisanych do moje-sukcesy.html: <strong>$syncedCount</strong>";

    // 3. Sprawdź czy plik istnieje i czy fistaszki tam są
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    $content = file_get_contents($calFile);
    if (strpos($content, 'const userEntries = [];') !== false && $syncedCount > 0) {
        $errors[] = "UWAGA: Mimo synchronizacji $syncedCount dni, w pliku nadal widnieje pusty userEntries! Możliwy problem z uprawnieniami zapisu lub markerami.";
    }

    // 4. Pobierz próbkę dat dla pewności
    if ($publishedCount > 0) {
        $stmt = $db->query("SELECT entry_date FROM entries WHERE status = 'published' ORDER BY entry_date DESC LIMIT 5");
        $sample = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $stats[] = "Ostatnie daty w bazie: " . implode(", ", $sample);
    }

} catch (Exception $e) {
    $errors[] = "BŁĄD KRYTYCZNY: " . $e->getMessage();
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
            <div class="stat"><?= $stat ?></div>
        <?php endforeach; ?>

        <?php foreach ($errors as $error): ?>
            <div class="error"><?= $error ?></div>
        <?php endforeach; ?>

        <?php if (empty($errors)): ?>
            <p class="success">✓ Synchronizacja zakończona pomyślnie.</p>
        <?php endif; ?>

        <a href="dashboard.php" class="btn">Powrót do pulpitu</a>
        <a href="sync-manual.php" class="btn" style="background: #27ae60;">Uruchom ponownie</a>
    </div>
</body>
</html>
