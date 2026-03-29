<?php
/**
 * admin/api/calendar-entries.php
 * Publiczny (tylko do odczytu) punkt końcowy dla mechanizmu self-heal kalendarza.
 * Zwraca wyłącznie daty i adresy URL opublikowanych wpisów.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json; charset=utf-8');
// Pozwalamy na pobieranie danych ze strony głównej (CORS)
header('Access-Control-Allow-Origin: ' . rtrim(SITE_URL, '/'));

try {
    $db = getDb();
    $stmt = $db->query(
        "SELECT DISTINCT entry_date FROM entries
         WHERE status = 'published'
         ORDER BY entry_date DESC"
    );
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $entries = [];
    foreach ($dates as $date) {
        $entries[] = [
            'date' => $date,
            'url'  => SITE_URL . 'sukcesy/' . $date . '.html',
        ];
    }

    echo json_encode([
        'ok'      => true,
        'entries' => $entries
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => 'Błąd serwera przy pobieraniu wpisów.'
    ]);
}
