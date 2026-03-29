<?php
// ============================================================
// auth.php — middleware autoryzacji
// Dołącz na początku każdej chronionej strony
// ============================================================
require_once __DIR__ . '/config.php';

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
    }
}

function requireLogin(): void {
    startSecureSession();

    // Sprawdź sesję
    if (empty($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        header('Location: ' . ADMIN_URL . 'login.php');
        exit;
    }

    // Sprawdź timeout bezczynności
    if (isset($_SESSION['last_activity'])) {
        if (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT) {
            session_unset();
            session_destroy();
            header('Location: ' . ADMIN_URL . 'login.php?timeout=1');
            exit;
        }
    }

    // Odśwież znacznik czasu aktywności
    $_SESSION['last_activity'] = time();
}

function getDb(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function csrfToken(): string {
    startSecureSession();
    if (empty($_SESSION[CSRF_KEY])) {
        $_SESSION[CSRF_KEY] = bin2hex(random_bytes(32));
    }
    return $_SESSION[CSRF_KEY];
}

function verifyCsrf(): void {
    startSecureSession();
    $submitted = $_POST['csrf_token'] ?? '';
    $expected  = $_SESSION[CSRF_KEY] ?? '';
    if (!hash_equals($expected, $submitted)) {
        http_response_code(403);
        die('CSRF token mismatch — odśwież stronę.');
    }
}

function isRateLimited(string $ip): bool {
    try {
        $db = getDb();
        $cutoff = date('Y-m-d H:i:s', time() - FAILED_LOGIN_WINDOW);
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM failed_logins WHERE ip = ? AND attempted_at > ?'
        );
        $stmt->execute([$ip, $cutoff]);
        return (int)$stmt->fetchColumn() >= MAX_FAILED_LOGINS;
    } catch (Exception $e) {
        return false;
    }
}

function recordFailedLogin(string $ip): void {
    try {
        $db = getDb();
        $db->prepare('INSERT INTO failed_logins (ip) VALUES (?)')->execute([$ip]);
    } catch (Exception $e) { /* silent */ }
}

function clearFailedLogins(string $ip): void {
    try {
        $db = getDb();
        $db->prepare('DELETE FROM failed_logins WHERE ip = ?')->execute([$ip]);
    } catch (Exception $e) { /* silent */ }
}

function generateSlug(string $date, string $title): string {
    $map = [
        'ą'=>'a','ć'=>'c','ę'=>'e','ł'=>'l','ń'=>'n','ó'=>'o','ś'=>'s','ź'=>'z','ż'=>'z',
        'Ą'=>'a','Ć'=>'c','Ę'=>'e','Ł'=>'l','Ń'=>'n','Ó'=>'o','Ś'=>'s','Ź'=>'z','Ż'=>'z',
    ];
    $title = strtr($title, $map);
    $title = strtolower($title);
    $title = preg_replace('/[^a-z0-9\s\-]/', '', $title);
    $title = preg_replace('/[\s\-]+/', '-', trim($title));
    return $date . '-' . $title;
}

function h(string $str): string {
    return htmlspecialchars($str, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
