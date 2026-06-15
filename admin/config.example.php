<?php
// Skopiuj ten plik jako admin/config.php na serwerze i uzupełnij wartości.
// Nie commituj admin/config.php ani _site/admin/config.php.

define('APP_ENV', 'prod');

define('DB_HOST', 'localhost');
define('DB_NAME', 'CHANGE_ME');
define('DB_USER', 'CHANGE_ME');
define('DB_PASS', 'CHANGE_ME');

define('PASSWORD_HASH', 'CHANGE_ME_PASSWORD_HASH');

define('SESSION_TIMEOUT', 7200);
define('SESSION_NAME', 'fp50_admin');

define('SITE_ROOT', dirname(__DIR__) . DIRECTORY_SEPARATOR);
define('ADMIN_ROOT', __DIR__ . DIRECTORY_SEPARATOR);
define('UPLOADS_DIR', ADMIN_ROOT . 'uploads' . DIRECTORY_SEPARATOR);

define('SITE_URL', 'https://fitpo50.pl/');
define('ADMIN_URL', 'https://admin.fitpo50.pl/');

define('MAX_FAILED_LOGINS', 5);
define('FAILED_LOGIN_WINDOW', 900);

define('CSRF_KEY', 'fp50_csrf_token');

return true;
