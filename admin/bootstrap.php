<?php
// ============================================================
// bootstrap.php — bezpieczne ładowanie konfiguracji admina
// ============================================================

function adminRenderSetupError(string $title, array $messages): void {
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, $title . PHP_EOL . implode(PHP_EOL, $messages) . PHP_EOL);
        exit(1);
    }

    http_response_code(500);
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Robots-Tag: noindex, nofollow');
    ?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?= htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></title>
<style>
body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7f3ed;color:#1f2933}
.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
.card{max-width:680px;background:#fff;border:1px solid #eadfce;border-radius:20px;padding:28px;box-shadow:0 18px 45px rgba(31,41,51,.08)}
h1{margin:0 0 12px;font-size:24px;line-height:1.2}
p{margin:0 0 10px;line-height:1.55}
code{background:#f1eee8;border-radius:6px;padding:2px 6px}
.muted{color:#667085;font-size:14px;margin-top:18px}
</style>
</head>
<body>
<main class="wrap">
  <section class="card" role="alert">
    <h1><?= htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></h1>
    <?php foreach ($messages as $message): ?>
      <p><?= $message ?></p>
    <?php endforeach; ?>
    <p class="muted">To zabezpieczenie zastępuje biały ekran PHP 500 i wskazuje dokładny element do naprawy.</p>
  </section>
</main>
</body>
</html>
    <?php
    exit;
}

$adminConfigPath = __DIR__ . '/config.php';
$adminEntryScript = basename((string)($_SERVER['SCRIPT_NAME'] ?? $_SERVER['PHP_SELF'] ?? ''));
$isAdminSetupScript = in_array($adminEntryScript, ['init-db.php', 'init-hash.php'], true);

if (!is_file($adminConfigPath)) {
    adminRenderSetupError('Błąd konfiguracji panelu FitPo50', [
        'Brakuje pliku <code>admin/config.php</code>.',
        'Utwórz go na serwerze na podstawie <code>admin/config.example.php</code> i uzupełnij dane bazy oraz hash hasła.',
    ]);
}

require_once $adminConfigPath;

$requiredConfigConstants = [
    'APP_ENV',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASS',
    'PASSWORD_HASH',
    'SESSION_TIMEOUT',
    'SESSION_NAME',
    'SITE_ROOT',
    'ADMIN_ROOT',
    'UPLOADS_DIR',
    'SITE_URL',
    'ADMIN_URL',
    'MAX_FAILED_LOGINS',
    'FAILED_LOGIN_WINDOW',
    'CSRF_KEY',
];

$missingConfigConstants = [];
foreach ($requiredConfigConstants as $constantName) {
    if (!defined($constantName)) {
        $missingConfigConstants[] = $constantName;
    }
}

if ($missingConfigConstants) {
    adminRenderSetupError('Błąd konfiguracji panelu FitPo50', [
        'Plik <code>admin/config.php</code> istnieje, ale brakuje w nim stałych: <code>' . htmlspecialchars(implode(', ', $missingConfigConstants), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</code>.',
        'Porównaj plik z <code>admin/config.example.php</code>.',
    ]);
}

$placeholderConfigConstants = [];
$placeholderCheckedConstants = $isAdminSetupScript
    ? ['DB_NAME', 'DB_USER', 'DB_PASS']
    : ['DB_NAME', 'DB_USER', 'DB_PASS', 'PASSWORD_HASH'];

foreach ($placeholderCheckedConstants as $constantName) {
    $value = trim((string)constant($constantName));
    if ($value === '' || str_contains($value, 'CHANGE_ME') || str_contains($value, 'TU_')) {
        $placeholderConfigConstants[] = $constantName;
    }
}

if ($placeholderConfigConstants) {
    adminRenderSetupError('Błąd konfiguracji panelu FitPo50', [
        'Plik <code>admin/config.php</code> ma nieuzupełnione wartości: <code>' . htmlspecialchars(implode(', ', $placeholderConfigConstants), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</code>.',
        'Uzupełnij prawdziwe dane bazy i poprawny hash hasła.',
    ]);
}

if (!$isAdminSetupScript && password_get_info(PASSWORD_HASH)['algoName'] === 'unknown') {
    adminRenderSetupError('Błąd konfiguracji panelu FitPo50', [
        'Stała <code>PASSWORD_HASH</code> w <code>admin/config.php</code> nie jest poprawnym hashem hasła.',
        'Wygeneruj nowy hash przez <code>password_hash</code> i wklej pełną wartość zaczynającą się zwykle od <code>$2y$</code>.',
    ]);
}
