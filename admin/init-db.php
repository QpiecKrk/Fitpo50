<?php
// ============================================================
// init-db.php — jednorazowa inicjalizacja bazy danych
// Uruchom RAZ: https://admin.fitpo50.pl/init-db.php?token=setup2026fitpo50
// Kasuje się automatycznie po wykonaniu.
// ============================================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$token = $_GET['token'] ?? '';
if ($token !== 'setup2026fitpo50') {
    http_response_code(403);
    die('403 Forbidden');
}

$errors = [];
$success = [];

try {
    $db = getDb();

    $db->exec("
        CREATE TABLE IF NOT EXISTS entries (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            title        VARCHAR(500)  NOT NULL,
            slug         VARCHAR(600)  NOT NULL UNIQUE,
            entry_date   DATE          NOT NULL,
            lead         TEXT,
            content      LONGTEXT      NOT NULL,
            status       ENUM('draft','published','hidden') NOT NULL DEFAULT 'draft',
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            published_at DATETIME,
            html_file    VARCHAR(300)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $success[] = 'Tabela entries — OK';

    $db->exec("
        CREATE TABLE IF NOT EXISTS media (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            entry_id      INT NOT NULL,
            filename      VARCHAR(300) NOT NULL,
            original_name VARCHAR(300),
            mime_type     VARCHAR(100),
            sort_order    INT DEFAULT 0,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $success[] = 'Tabela media — OK';

    $db->exec("
        CREATE TABLE IF NOT EXISTS failed_logins (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            ip           VARCHAR(45),
            attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ip_time (ip, attempted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $success[] = 'Tabela failed_logins — OK';

} catch (Exception $e) {
    $errors[] = 'Błąd bazy danych: ' . $e->getMessage();
}

// Samousunięcie
$selfDeleted = @unlink(__FILE__);
?>
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>DB Init</title>
<meta name="robots" content="noindex,nofollow">
<style>
  body{font-family:monospace;padding:2rem;background:#0f172a;color:#e2e8f0;}
  .ok{color:#4ade80;} .err{color:#f87171;}
  .warn{color:#f59e0b;margin-top:1.5rem;padding:1rem;border:1px solid #f59e0b;border-radius:8px;}
  li{margin:.4rem 0;}
</style>
</head>
<body>
<h2>Inicjalizacja bazy danych</h2>
<ul>
  <?php foreach ($success as $s): ?><li class="ok">✅ <?= h($s) ?></li><?php endforeach; ?>
  <?php foreach ($errors as $e): ?><li class="err">❌ <?= h($e) ?></li><?php endforeach; ?>
</ul>
<?php if (empty($errors)): ?>
  <p class="ok"><strong>Baza gotowa.</strong> Następny krok: wgraj hash hasła do config.php (uruchom init-hash.php).</p>
<?php endif; ?>
<div class="warn">
  <?= $selfDeleted ? '🗑️ Plik init-db.php został automatycznie usunięty.' : '⚠️ Usuń init-db.php ręcznie z serwera!' ?>
</div>
</body>
</html>
