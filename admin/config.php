<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'u542460614_XiGkk');
define('DB_USER', 'u542460614_jQQSu');
define('DB_PASS', 'pK8rV7!mQ2xS4#nD6zT1');

define('PASSWORD_HASH', '$2y$12$F..JZu2ZkyFLkLthndPEWewCTfGxeHsST.knX4vxwwg9g1D48tKca');

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
