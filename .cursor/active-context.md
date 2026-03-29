> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `admin/init-db.php` (Domain: **Generic Logic**)

### 📐 Generic Logic Conventions & Fixes
- **[what-changed] Replaced auth Uruchom**: - // Uruchom RAZ: https://admin.fitpo50.pl/init-db.php?token=setup2026fitpo50
+ // Uruchom RAZ: https://admin.fitpo50.pl/init-db.php?token=CHANGE_ME
- if ($token !== 'setup2026fitpo50') {
+ if ($token !== 'CHANGE_ME') {
-     die('403 Forbidden');
+     die('403 Forbidden — Ustaw bezpieczny token w kodzie przed użyciem.');
- **[what-changed] Replaced auth Podstawowe**: - 
+ $csrf = csrfToken();
- // 1. Podstawowe statystyki (zawsze widoczne przez GET)
+ 
- try {
+ // 1. Podstawowe statystyki (zawsze widoczne przez GET)
-     $stmt = $db->query("SELECT COUNT(*) FROM entries WHERE status = 'published'");
+ try {
-     $publishedCount = (int)$stmt->fetchColumn();
+     $stmt = $db->query("SELECT COUNT(*) FROM entries WHERE status = 'published'");
-     $stats[] = "Wpisy o statusie 'published' w bazie: $publishedCount";
+     $publishedCount = (int)$stmt->fetchColumn();
- 
+     $stats[] = "Wpisy o statusie 'published' w bazie: $publishedCount";
-     $calFile = SITE_ROOT . 'moje-sukcesy.html';
+ 
-     $content = file_get_contents($calFile);
+     $calFile = SITE_ROOT . 'moje-sukcesy.html';
-     preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $content, $m);
+     $content = file_get_contents($calFile);
-     $currentCount = 0;
+     preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $content, $m);
-     if (isset($m[1])) {
+     $currentCount = 0;
-         $decoded = json_decode($m[1], true);
+     if (isset($m[1])) {
-         $currentCount = is_array($decoded) ? count($decoded) : 0;
+         $decoded = json_decode($m[1], true);
-     }
+         $currentCount = is_array($decoded) ? count($decoded) : 0;
-     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";
+     }
- 
+     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";
- } catch (Exception $e) {
+ 
-     $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
+ } catch (Exception $e) {
- }
+     $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
- 
+ }
- // 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
+ 
- if ($_SERVER['REQUEST_METHOD'] === 'POST') {
+ // 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
-     try {
+ if ($_SERVER['REQUEST_METHOD'] === 'POST') {
-         verifyCsrf();
+     try {
-         $syncedCount = calendarRebu
… [diff truncated]
- **[what-changed] what-changed in sync-manual.php**: -     $stats[] = "Wpisy o statusie 'published' w bazie: <strong>$publishedCount</strong>";
+     $stats[] = "Wpisy o statusie 'published' w bazie: $publishedCount";
-     $stats[] = "Aktualnie w moje-sukcesy.html: <strong>$currentCount</strong> dni";
+     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";
-         $stats[] = "<span class='success'>✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.</span>";
+         $stats[] = "✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.";
-             <div class="stat"><?= $stat ?></div>
+             <div class="stat"><?= h($stat) ?></div>
- **[convention] Added session cookies authentication — prevents null/undefined runtime crashes — confirmed 3x**: -         $synced = true;
+         sitemapRebuild($db);
-         $stats[] = "<span class='success'>✓ Zsynchronizowano pomyślnie $syncedCount dni.</span>";
+         $synced = true;
-     } catch (Exception $e) {
+         $stats[] = "<span class='success'>✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.</span>";
-         $errors[] = "BŁĄD SYNCHRONIZACJI: " . $e->getMessage();
+     } catch (Exception $e) {
-     }
+         $errors[] = "BŁĄD SYNCHRONIZACJI: " . $e->getMessage();
- }
+     }
- 
+ }
- ?>
+ 
- <!DOCTYPE html>
+ ?>
- <html lang="pl">
+ <!DOCTYPE html>
- <head>
+ <html lang="pl">
-     <meta charset="UTF-8">
+ <head>
-     <title>Ręczna Synchronizacja Kalendarza</title>
+     <meta charset="UTF-8">
-     <style>
+     <title>Ręczna Synchronizacja Kalendarza</title>
-         body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; background: #f4f7f6; }
+     <style>
-         .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
+         body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; background: #f4f7f6; }
-         h1 { color: #2c3e50; margin-top: 0; }
+         .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
-         .stat { padding: 10px; margin: 5px 0; background: #e8f4fd; border-left: 4px solid #3498db; }
+         h1 { color: #2c3e50; margin-top: 0; }
-         .error { padding: 15px; margin: 20px 0; background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; border-radius: 4px; }
+         .stat { padding: 10px; margin: 5px 0; background: #e8f4fd; border-left: 4px solid #3498db; }
-         .success { color: #059669; font-weight: bold; }
+         .error { padding: 15px; margin: 20px 0; background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; border-radius: 4px; }
-         .btn { display: inline-block; padding: 10px 20
… [diff truncated]
- **[what-changed] Added Basic Auth authentication — protects against XSS and CSRF token theft**: - https://admin.fitpo50.pl/init-db.php?token=setup2026fitpo50
+ https://admin.fitpo50.pl/init-db.php?token=CHANGE_ME
- - **Kasuje się automatycznie** po wykonaniu
+ - **Ustaw własny token** w kodzie skryptu przed uruchomieniem
- - Jeśli nie usunął się sam → usuń `init-db.php` ręcznie przez FTP
+ - **Kasuje się automatycznie** po wykonaniu
- 
+ - Jeśli nie usunął się sam → usuń `init-db.php` ręcznie przez FTP
- ---
+ 
- 
+ ---
- ### 4. Wygeneruj hash hasła
+ 
- 
+ ### 4. Wygeneruj hash hasła
- > ⚠️ `init-hash.php` **nie jest podlinkowany nigdzie** — wywołujesz go tylko raz, tu.
+ 
- 
+ > ⚠️ `init-hash.php` **nie jest podlinkowany nigdzie** — wywołujesz go tylko raz, tu.
- ```
+ 
- https://admin.fitpo50.pl/init-hash.php?token=setup2026fitpo50
+ ```
- ```
+ https://admin.fitpo50.pl/init-hash.php?token=CHANGE_ME&pass=TwojeWybraneHaslo
- 
+ ```
- - Skrypt wyświetli hash bcrypt dla hasła `272Archawili`
+ 
- - **Skopiuj hash** do `config.php` → `PASSWORD_HASH`
+ - **Ustaw własny token** w kodzie skryptu przed uruchomieniem
- - **Kasuje się automatycznie** po wykonaniu
+ - Skrypt wyświetli hash bcrypt dla Twojego hasła
- - Jeśli nie usunął się sam → usuń `init-hash.php` ręcznie przez FTP
+ - **Skopiuj hash** do `config.php` → `PASSWORD_HASH`
- 
+ - **Kasuje się automatycznie** po wykonaniu
- ---
+ - Jeśli nie usunął się sam → usuń `init-hash.php` ręcznie przez FTP
- ### 5. Wklej hash do config.php
+ ---
- Otwórz `config.php` na serwerze (przez menedżer plików lub SSH) i uzupełnij:
+ ### 5. Wklej hash do config.php
- ```php
+ Otwórz `config.php` na serwerze (przez menedżer plików lub SSH) i uzupełnij:
- define('PASSWORD_HASH', '$2y$12$...TWÓJ_HASH...');
+ 
- ```
+ ```php
- 
+ define('PASSWORD_HASH', '$2y$12$...TWÓJ_HASH...');
- ---
+ ```
- ### 6. Sprawdź uprawnienia katalogów
+ ---
- ```bash
+ ### 6. Sprawdź uprawnienia katalogów
- chmod 755 /home/u542460614/domains/fitpo50.pl/public_html/admin/
+ 
- chmod 755 /home/u542460614/domains/fitpo50.pl/public_html/admin/uploads/
+ 
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [# Panel Redakcyjny FitPo50 — Instrukcja Deploymentu]
- **[convention] Replaced auth Panel — prevents null/undefined runtime crashes — confirmed 3x**: - $logoUrl = 'assets/logo.jpg';
+ $logoUrl = 'assets/logo.jpg?v=2';
-       <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36">
+       <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36"
-       <span class="panel-header__title">Panel redakcyjny</span>
+            onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://fitpo50.pl/assets/logo.jpg';}">
-     </div>
+       <span class="panel-header__title">Panel redakcyjny</span>
-     <nav class="panel-header__nav">
+     </div>
-       <a href="dashboard.php" class="panel-nav-link">Wpisy</a>
+     <nav class="panel-header__nav">
-       <a href="entry-form.php" class="panel-nav-link panel-nav-link--active">Nowy wpis</a>
+       <a href="dashboard.php" class="panel-nav-link">Wpisy</a>
-       <a href="../moje-sukcesy.html" target="_blank" rel="noopener noreferrer" class="panel-nav-link">Moje Sukcesy ↗</a>
+       <a href="entry-form.php" class="panel-nav-link panel-nav-link--active">Nowy wpis</a>
-       <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
+       <a href="../moje-sukcesy.html" target="_blank" rel="noopener noreferrer" class="panel-nav-link">Moje Sukcesy ↗</a>
-     </nav>
+       <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
-   </div>
+     </nav>
- </header>
+   </div>
- 
+ </header>
- <main class="panel-main">
+ 
-   <div class="panel-container">
+ <main class="panel-main">
- 
+   <div class="panel-container">
-     <?php require __DIR__ . '/partials/flash.php'; ?>
+ 
- 
+     <?php require __DIR__ . '/partials/flash.php'; ?>
-     <div class="page-heading">
+ 
-       <h2 class="panel-section-title"><?= h($pageTitle) ?></h2>
+     <div class="page-heading">
-       <?php if ($editMode && $entry['status'] === 'published' && $entry['html_file']): ?>
+       <h2 class="panel-section-title"><?= h($pageTitle) ?></h2>
-         <a href="<?= SITE_URL . h($entry['html_file']) ?>" target="_
… [diff truncated]
- **[what-changed] what-changed in login.php**: - $logoUrl = rtrim(SITE_URL, '/') . '/assets/logo.jpg';
+ $logoUrl = 'assets/logo.jpg';
- **[what-changed] what-changed in entry-form.php**: - $logoUrl = rtrim(SITE_URL, '/') . '/assets/logo.jpg';
+ $logoUrl = 'assets/logo.jpg';
- **[what-changed] what-changed in dashboard.php**: - $logoUrl = rtrim(SITE_URL, '/') . '/assets/logo.jpg';
+ $logoUrl = 'assets/logo.jpg';
- **[what-changed] Replaced auth DOCTYPE — prevents null/undefined runtime crashes**: - $today = date('Y-m-d');
+ $logoUrl = rtrim(SITE_URL, '/') . '/assets/logo.jpg';
- ?>
+ $today = date('Y-m-d');
- <!DOCTYPE html>
+ ?>
- <html lang="pl">
+ <!DOCTYPE html>
- <head>
+ <html lang="pl">
- <meta charset="UTF-8">
+ <head>
- <meta name="viewport" content="width=device-width, initial-scale=1.0">
+ <meta charset="UTF-8">
- <meta name="robots" content="noindex, nofollow">
+ <meta name="viewport" content="width=device-width, initial-scale=1.0">
- <title><?= h($pageTitle) ?> — Panel FitPo50</title>
+ <meta name="robots" content="noindex, nofollow">
- <link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
+ <title><?= h($pageTitle) ?> — Panel FitPo50</title>
- <link rel="preconnect" href="https://fonts.googleapis.com">
+ <link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
- <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
+ <link rel="preconnect" href="https://fonts.googleapis.com">
- <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
+ <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
- <link rel="stylesheet" href="assets/panel.css">
+ <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
- </head>
+ <link rel="stylesheet" href="assets/panel.css">
- <body class="panel-body">
+ </head>
- 
+ <body class="panel-body">
- <header class="panel-header">
+ 
-   <div class="panel-header__inner">
+ <header class="panel-header">
-     <div class="panel-header__brand">
+   <div class="panel-header__inner">
-       <img src="../assets/logo.jpg" alt="FitPo50" width="36" height="36">
+     <div class="panel-header__brand">
-       <span class="panel-header__title">Panel redakcyjny</span>
+       <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36">
-     </div>
+       <span class="panel-header__title">Panel red
… [diff truncated]
- **[what-changed] Replaced auth Filtrowanie — prevents null/undefined runtime crashes**: - 
+ $logoUrl = rtrim(SITE_URL, '/') . '/assets/logo.jpg';
- // Filtrowanie i sortowanie
+ 
- $status_filter = $_GET['status'] ?? 'all';
+ // Filtrowanie i sortowanie
- $where = $status_filter !== 'all' ? "WHERE status = ?" : '';
+ $status_filter = $_GET['status'] ?? 'all';
- $params = $status_filter !== 'all' ? [$status_filter] : [];
+ $where = $status_filter !== 'all' ? "WHERE status = ?" : '';
- 
+ $params = $status_filter !== 'all' ? [$status_filter] : [];
- $stmt = $db->prepare("SELECT * FROM entries $where ORDER BY entry_date DESC, created_at DESC");
+ 
- $stmt->execute($params);
+ $stmt = $db->prepare("SELECT * FROM entries $where ORDER BY entry_date DESC, created_at DESC");
- $entries = $stmt->fetchAll();
+ $stmt->execute($params);
- 
+ $entries = $stmt->fetchAll();
- // Liczniki
+ 
- $counts = $db->query("SELECT status, COUNT(*) as cnt FROM entries GROUP BY status")->fetchAll();
+ // Liczniki
- $cnt = ['draft' => 0, 'published' => 0, 'hidden' => 0];
+ $counts = $db->query("SELECT status, COUNT(*) as cnt FROM entries GROUP BY status")->fetchAll();
- foreach ($counts as $c) $cnt[$c['status']] = $c['cnt'];
+ $cnt = ['draft' => 0, 'published' => 0, 'hidden' => 0];
- $total = array_sum($cnt);
+ foreach ($counts as $c) $cnt[$c['status']] = $c['cnt'];
- ?>
+ $total = array_sum($cnt);
- <!DOCTYPE html>
+ ?>
- <html lang="pl">
+ <!DOCTYPE html>
- <head>
+ <html lang="pl">
- <meta charset="UTF-8">
+ <head>
- <meta name="viewport" content="width=device-width, initial-scale=1.0">
+ <meta charset="UTF-8">
- <meta name="robots" content="noindex, nofollow">
+ <meta name="viewport" content="width=device-width, initial-scale=1.0">
- <title>Dashboard — Panel FitPo50</title>
+ <meta name="robots" content="noindex, nofollow">
- <link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
+ <title>Dashboard — Panel FitPo50</title>
- <link rel="preconnect" href="https://fonts.googleapis.com">
+ <link href="https://api.fontshare.com/v2/c
… [diff truncated]
- **[problem-fix] problem-fix in sync-manual.php**: File updated (external): admin/sync-manual.php

Content summary (78 lines):
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
    $stats[] = "Wpisy o statusie 'published' w bazie: <strong>$publishedCoun
- **[what-changed] Replaced auth Jednorazowy — uses a proper password hashing algorithm**: - // Jednorazowy skrypt do generowania hasha hasła
+ // Jednorazowy skrypt do generowania hasha hasła — KASUJE SIĘ PO UŻYCIU
- // Uruchom RAZ po wgraniu na serwer: https://admin.fitpo50.pl/init-hash.php
+ // Uruchom RAZ: https://admin.fitpo50.pl/init-hash.php?token=setup2026fitpo50
- // Następnie skopiuj hash do config.php i USUŃ ten plik z serwera.
+ // Skopiuj hash do config.php → plik zostanie automatycznie usunięty.
- if (php_sapi_name() !== 'cli' && !isset($_SERVER['HTTP_HOST'])) { die('Direct access not allowed'); }
+ 
- 
+ $token = $_GET['token'] ?? '';
- // Prosta ochrona (żeby nikt nie wywołał przez URL bez wiedzy)
+ if ($token !== 'setup2026fitpo50') {
- $token = $_GET['token'] ?? '';
+     http_response_code(403);
- if ($token !== 'setup2026fitpo50') {
+     die('403 Forbidden');
-     http_response_code(403);
+ }
-     die('403 Forbidden — podaj ?token=setup2026fitpo50');
+ 
- }
+ $[REDACTED]
- 
+ $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
- $[REDACTED]
+ $verify = password_verify($password, $hash);
- $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
+ 
- ?>
+ // Skasuj ten plik z serwera natychmiast po wygenerowaniu hasha
- <!DOCTYPE html>
+ $selfDeleted = @unlink(__FILE__);
- <html lang="pl">
+ ?>
- <head><meta charset="UTF-8"><title>Hash Generator</title>
+ <!DOCTYPE html>
- <meta name="robots" content="noindex,nofollow">
+ <html lang="pl">
- <style>body{font-family:monospace;padding:2rem;background:#0f172a;color:#e2e8f0;}
+ <head><meta charset="UTF-8"><title>Hash Generator</title>
- code{background:#1e293b;padding:1rem;display:block;border-radius:8px;word-break:break-all;color:#4ade80;margin:1rem 0;font-size:1.1rem;}
+ <meta name="robots" content="noindex,nofollow">
- .warn{color:#f59e0b;margin-top:2rem;padding:1rem;border:1px solid #f59e0b;border-radius:8px;}</style>
+ <style>
- </head>
+   body{font-family:monospace;padding:2rem;background:#0f172a;color:#e2e8f0;}
- <body>
+   
… [diff truncated]
- **[problem-fix] Fixed null crash in Wpisy — prevents null/undefined runtime crashes**: - $dateFormatted = date('j F Y', strtotime($date ?? ''));
+ $uploadsUrl = $siteUrl . 'admin/uploads/';
- $pageTitle = 'Wpisy z ' . $dateFormatted;
+ $dateFormatted = date('j F Y', strtotime($date ?? ''));
- $pageDesc  = 'Wszystkie wpisy FitPo50 z dnia ' . $dateFormatted . '.';
+ $pageTitle = 'Wpisy z ' . $dateFormatted;
- $pageUrl   = $siteUrl . 'sukcesy/' . ($date ?? '') . '.html';
+ $pageDesc  = 'Wszystkie wpisy FitPo50 z dnia ' . $dateFormatted . '.';
- 
+ $pageUrl   = $siteUrl . 'sukcesy/' . ($date ?? '') . '.html';
- $adminUrl  = defined('ADMIN_URL') ? ADMIN_URL : 'https://admin.fitpo50.pl/';
+ 
- $ogImage   = $siteUrl . 'assets/Hero_Porady1.png'; // Domyślne tło
+ $adminUrl  = defined('ADMIN_URL') ? ADMIN_URL : 'https://admin.fitpo50.pl/';
- foreach ($entries as $e) {
+ $ogImage   = $siteUrl . 'assets/Hero_Porady1.png'; // Domyślne tło
-     if (!empty($e['media'])) {
+ foreach ($entries as $e) {
-         foreach ($e['media'] as $m) {
+     if (!empty($e['media'])) {
-             if (str_starts_with($m['mime_type'] ?? '', 'image/')) {
+         foreach ($e['media'] as $m) {
-                 // Wybierzmy pierwsze znalezione zdjęcie jako OG Image
+             if (str_starts_with($m['mime_type'] ?? '', 'image/')) {
-                 // Zamieniamy na JPG by mieć 100% kompatybilności z Facebookiem/X
+                 // Wybierzmy pierwsze znalezione zdjęcie jako OG Image
-                 $base = pathinfo($m['filename'], PATHINFO_FILENAME);
+                 // Zamieniamy na JPG by mieć 100% kompatybilności z Facebookiem/X
-                 if (file_exists(ADMIN_ROOT . 'uploads/' . $base . '.jpg')) {
+                 $base = pathinfo($m['filename'], PATHINFO_FILENAME);
-                     $ogImage = $adminUrl . 'uploads/' . $base . '.jpg';
+                 if (file_exists(ADMIN_ROOT . 'uploads/' . $base . '.jpg')) {
-                 } else {
+                     $ogImage = $uploadsUrl . $base . '.jpg';
-                     $ogImage = $adminUrl . 'uploads
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[problem-fix] Fixed null crash in YYYY — prevents null/undefined runtime crashes**: - $slug       = $entry['slug'];
+ $uploadsUrl = $siteUrl . 'admin/uploads/';
- $title      = $entry['title'];
+ $slug       = $entry['slug'];
- $lead       = $entry['lead'] ?? '';
+ $title      = $entry['title'];
- $content    = $entry['content'];
+ $lead       = $entry['lead'] ?? '';
- $date       = $entry['entry_date'];   // YYYY-MM-DD
+ $content    = $entry['content'];
- $dateIso    = $date . 'T10:00:00+02:00';
+ $date       = $entry['entry_date'];   // YYYY-MM-DD
- $dateModIso = ($entry['updated_at'] ?? $date) . 'T10:00:00+02:00';
+ $dateIso    = $date . 'T10:00:00+02:00';
- $pageUrl    = $siteUrl . $slug . '.html';
+ $dateModIso = ($entry['updated_at'] ?? $date) . 'T10:00:00+02:00';
- 
+ $pageUrl    = $siteUrl . $slug . '.html';
- // Pierwszy obraz jako hero/og:image
+ 
- $imageMedia = array_values(array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/')));
+ // Pierwszy obraz jako hero/og:image
- $imageCount = count($imageMedia);
+ $imageMedia = array_values(array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/')));
- $heroImg = $imageCount > 0 ? reset($imageMedia) : null;
+ $imageCount = count($imageMedia);
- $heroUrl = $heroImg ? ($adminUrl . 'uploads/' . $heroImg['filename']) : ($siteUrl . 'assets/Hero_Porady1.png');
+ $heroImg = $imageCount > 0 ? reset($imageMedia) : null;
- 
+ $heroUrl = $heroImg ? ($uploadsUrl . $heroImg['filename']) : ($siteUrl . 'assets/Hero_Porady1.png');
- // Czas czytania (szacunek: ~200 słów/min)
+ 
- $words   = str_word_count(strip_tags($content));
+ // Czas czytania (szacunek: ~200 słów/min)
- $readMin = max(1, round($words / 200));
+ $words   = str_word_count(strip_tags($content));
- 
+ $readMin = max(1, round($words / 200));
- // Helper: bezpieczne renderowanie mediów z picture (avif, webp) + leniwe ładownie
+ 
- function renderMediaPicture($filename, $originalName, $adminUrl, $width, $height, $loading = 'lazy', $fit = 'cover') {
+ // Helper: bezpieczne renderowanie mediów z pictur
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
