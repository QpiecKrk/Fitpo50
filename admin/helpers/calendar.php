<?php
/**
 * helpers/calendar.php
 * Zarządzanie wpisami kalendarza przez json_encode + markery.
 * NIE operujemy regexem na treści JS.
 *
 * Format markerów w moje-sukcesy.html:
 *   // ENTRIES_START
 *   const userEntries = [...];
 *   // ENTRIES_END
 *
 * PHP podmienia CAŁY blok między markerami — gwarancja poprawnego JS.
 */

/**
 * Aktualizuje stronę dnia I kalendarz — wywołaj po każdej zmianie.
 */
function syncDay(PDO $db, string $date): void {
    regenerateDayPage($db, $date);
    calendarRebuild($db);
    sitemapRebuild($db);
}

/**
 * Generuje sukcesy/YYYY-MM-DD.html dla wszystkich opublikowanych
 * wpisów z danej daty. Jeśli brak wpisów — usuwa plik.
 */
function regenerateDayPage(PDO $db, string $date): void {
    $dir     = SITE_ROOT . 'sukcesy/';
    $dayFile = $dir . $date . '.html';

    $stmt = $db->prepare(
        "SELECT * FROM entries
         WHERE entry_date = ? AND status = 'published'
         ORDER BY created_at ASC"
    );
    $stmt->execute([$date]);
    $entries = $stmt->fetchAll();

    // Pobierz zdjęcia (media) dla każdego wpisu, by móc pokazać całość artykułu
    foreach ($entries as &$e) {
        $mStmt = $db->prepare('SELECT * FROM media WHERE entry_id=? ORDER BY sort_order,id');
        $mStmt->execute([$e['id']]);
        $e['media'] = $mStmt->fetchAll();
    }
    unset($e);

    if (empty($entries)) {
        if (file_exists($dayFile)) @unlink($dayFile);
        return;
    }

    if (!is_dir($dir)) @mkdir($dir, 0755, true);

    ob_start();
    require ADMIN_ROOT . 'templates/day-list.php';
    $html = ob_get_clean();
    file_put_contents($dayFile, $html);
}

/**
 * Przebudowuje const userEntries w moje-sukcesy.html
 * bezpośrednio z bazy danych.
 *
 * Mechanizm:
 *  1. Pobiera wszystkie daty z opublikowanymi wpisami
 *  2. json_encode() → gwarantuje poprawny JS
 *  3. preg_replace_callback podmienia CAŁY blok
 *     między // ENTRIES_START a // ENTRIES_END
 *  4. Zero regex na treści JS — replacement to PHP string
 */
function calendarRebuild(PDO $db): void {
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    if (!file_exists($calFile)) return;

    // Pobierz wszystkie opublikowane daty
    $stmt = $db->query(
        "SELECT DISTINCT entry_date FROM entries
         WHERE status = 'published'
         ORDER BY entry_date DESC"
    );
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Zbuduj tablicę wpisów
    $items = [];
    foreach ($dates as $date) {
        $items[] = [
            'date' => $date,
            'url'  => SITE_URL . 'sukcesy/' . $date . '.html',
        ];
    }

    // Wygeneruj poprawny JavaScript przez json_encode
    $json    = json_encode(
        $items,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    if (!is_string($json)) {
        throw new RuntimeException('Nie udało się zbudować JSON dla kalendarza.');
    }
    $newDecl = "const userEntries = {$json};";

    // Podmień CAŁY blok między markerami
    $content = file_get_contents($calFile);

    if (!preg_match('/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s', $content)) {
        throw new RuntimeException('Brak markerów ENTRIES_START/ENTRIES_END w moje-sukcesy.html');
    }

    $updated = preg_replace_callback(
        '/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s',
        static function () use ($newDecl): string {
            // Replacement to PHP string — żadnych specjalnych znaków regex
            return "// ENTRIES_START\n  {$newDecl}\n  // ENTRIES_END";
        },
        $content
    );

    if ($updated === null) {
        throw new RuntimeException('Nie udało się podmienić bloku wpisów kalendarza.');
    }

    file_put_contents($calFile, $updated);
}

/**
 * Przebudowuje sitemap.xml dopisując aktualne strony dni z katalogu sukcesy/
 */
function sitemapRebuild(PDO $db): void {
    $sitemapFile = SITE_ROOT . 'sitemap.xml';
    if (!file_exists($sitemapFile)) return;

    $dom = new DOMDocument();
    $dom->preserveWhiteSpace = false;
    $dom->formatOutput = true;
    if (!@$dom->load($sitemapFile)) return;

    $urlset = $dom->documentElement;
    if (!$urlset || $urlset->tagName !== 'urlset') return;

    // Remove old sukcesy/ entries
    $toRemove = [];
    foreach ($urlset->getElementsByTagName('url') as $urlNode) {
        $locNode = $urlNode->getElementsByTagName('loc')->item(0);
        if ($locNode && str_contains($locNode->nodeValue, '/sukcesy/')) {
            $toRemove[] = $urlNode;
        }
    }
    foreach ($toRemove as $node) {
        $urlset->removeChild($node);
    }

    // Dodaj aktualne dni
    $stmt = $db->query(
        "SELECT entry_date, MAX(updated_at) as last_updated 
         FROM entries 
         WHERE status = 'published' 
         GROUP BY entry_date 
         ORDER BY entry_date DESC"
    );
    $dates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($dates as $row) {
        $date = $row['entry_date'];
        $lastmod = date('Y-m-d', strtotime($row['last_updated']));
        
        $urlNode = $dom->createElement('url');
        
        $locNode = $dom->createElement('loc', SITE_URL . "sukcesy/{$date}.html");
        $urlNode->appendChild($locNode);
        
        $lastmodNode = $dom->createElement('lastmod', $lastmod);
        $urlNode->appendChild($lastmodNode);
        
        $urlset->appendChild($urlNode);
    }

    $dom->save($sitemapFile);
}
