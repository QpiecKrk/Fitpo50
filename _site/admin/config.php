<?php
// ============================================================
// FitPo50 Admin Panel — konfiguracja
// UWAGA: Ten plik NIE trafia do repozytorium (.gitignore)
// Utwórz go ręcznie na serwerze Hostinger po deploymencie.
// ============================================================

define('APP_ENV', 'production'); // 'dev' lub 'production'

// --- Baza danych ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'u542460614_fitpo50');   // ← uzupełnij nazwę bazy z panelu Hostinger
define('DB_USER', 'u542460614_admin');      // ← uzupełnij użytkownika DB
define('DB_PASS', 'TWOJE_HASLO_DB');        // ← uzupełnij hasło DB

// --- Hasło aplikacyjne ---
// Hash bcrypt (cost 12).
// Wygenerowany przez: php -r "echo password_hash('TWOJE_HASLO', PASSWORD_BCRYPT, ['cost'=>12]);"
// Uruchom init-hash.php jednorazowo, żeby uzyskać hash, a potem go tutaj wklej.
define('PASSWORD_HASH', '$2y$12$PLACEHOLDER_RUN_INIT_HASH_PHP');

// --- Sesja ---
define('SESSION_TIMEOUT', 7200);       // 2 godziny
define('SESSION_NAME', 'fp50_admin');

// --- Ścieżki ---
define('SITE_ROOT', dirname(__DIR__) . DIRECTORY_SEPARATOR);
define('ADMIN_ROOT', __DIR__ . DIRECTORY_SEPARATOR);
define('UPLOADS_DIR', ADMIN_ROOT . 'uploads' . DIRECTORY_SEPARATOR);

// --- URL ---
define('SITE_URL', 'https://fitpo50.pl/');
define('ADMIN_URL', 'https://admin.fitpo50.pl/');

// --- Rate limiting loginów ---
define('MAX_FAILED_LOGINS', 5);
define('FAILED_LOGIN_WINDOW', 900); // 15 minut

// --- Bezpieczeństwo ---
define('CSRF_KEY', 'fp50_csrf_token');

return true;
