<?php
declare(strict_types=1);

/**
 * Zwraca osobne, fail-closed połączenie do shadow store NEWS.
 *
 * Stałe NEWS_DB_* muszą zostać zdefiniowane przez prywatną konfigurację
 * środowiska przed pierwszym wywołaniem tej funkcji.
 * NEWS_DB_HOST musi mieć wartość '127.0.0.1'; 'localhost' użyłby gniazda.
 */
function getNewsDb(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $requiredConstants = [
        'NEWS_DB_HOST',
        'NEWS_DB_NAME',
        'NEWS_DB_USER',
        'NEWS_DB_PASS',
    ];

    foreach ($requiredConstants as $constantName) {
        if (!defined($constantName)) {
            throw new RuntimeException('NEWS_DB_CONFIG_MISSING');
        }
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        constant('NEWS_DB_HOST'),
        constant('NEWS_DB_NAME')
    );

    try {
        $pdo = new PDO(
            $dsn,
            constant('NEWS_DB_USER'),
            constant('NEWS_DB_PASS'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );

        $currentMode = (string) $pdo->query('SELECT @@SESSION.sql_mode')->fetchColumn();
        $sqlModes = array_values(array_filter(array_map('trim', explode(',', $currentMode))));
        if (!in_array('STRICT_ALL_TABLES', $sqlModes, true)) {
            $sqlModes[] = 'STRICT_ALL_TABLES';
        }

        $pdo->exec('SET SESSION sql_mode = ' . $pdo->quote(implode(',', $sqlModes)));
        $pdo->exec("SET SESSION time_zone = '+00:00'");
        $connection = $pdo;
    } catch (Throwable $exception) {
        error_log('[NEWS_DB_CONNECTION_ERROR] ' . get_class($exception));
        throw new RuntimeException('NEWS_DB_CONNECTION_ERROR');
    }

    return $connection;
}
