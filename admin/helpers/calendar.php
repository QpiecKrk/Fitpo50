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
function syncDay(PDO $db, string $date): int {
    regenerateDayPage($db, $date);
    $count = calendarRebuild($db);
    sitemapRebuild($db);
    return $count;
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
 * bezpośrednio z bazy danych z atomowym zapisem i weryfikacją.
 */
function calendarRebuild(PDO $db): int {
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    $tmpFile = $calFile . '.tmp';
    
    if (!file_exists($calFile)) return 0;

    // 1. Pobierz wszystkie opublikowane daty
    $stmt = $db->query(
        "SELECT DISTINCT entry_date FROM entries
         WHERE status = 'published'
         ORDER BY entry_date DESC"
    );
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // 2. Zbuduj tablicę wpisów
    $items = [];
    foreach ($dates as $date) {
        $items[] = [
            'date' => $date,
            'url'  => SITE_URL . 'sukcesy/' . $date . '.html',
        ];
    }

    $dbCount = count($items);

    // 3. Wygeneruj poprawny JavaScript
    $json = json_encode(
        $items,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    if (!is_string($json)) {
        throw new RuntimeException('Nie udało się zbudować JSON dla kalendarza.');
    }
    $newDecl = "const userEntries = {$json};";

    // 4. Podmień CAŁY blok między markerami
    $content = file_get_contents($calFile);
    if (!$content) {
        throw new RuntimeException('Nie udało się odczytać pliku moje-sukcesy.html');
    }

    if (!preg_match('/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s', $content)) {
        throw new RuntimeException('Brak markerów ENTRIES_START/ENTRIES_END w moje-sukcesy.html');
    }

    $updated = preg_replace_callback(
        '/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s',
        static function () use ($newDecl): string {
            return "// ENTRIES_START\n  {$newDecl}\n  // ENTRIES_END";
        },
        $content
    );

    if ($updated === null) {
        throw new RuntimeException('Błąd preg_replace przy generowaniu kalendarza.');
    }

    // 5. ATOMICZNY ZAPIS
    if (file_put_contents($tmpFile, $updated) === false) {
        throw new RuntimeException('Błąd zapisu pliku tymczasowego kalendarza.');
    }

    if (!@rename($tmpFile, $calFile)) {
        @unlink($tmpFile);
        throw new RuntimeException('Błąd przy zamianie pliku kalendarza (moje-sukcesy.html).');
    }

    // 6. WERYFIKACJA PO ZAPISIE
    $savedContent = file_get_contents($calFile);
    if (!$savedContent) {
        throw new RuntimeException('WERYFIKACJA FAILED: Plik kalendarza jest pusty po zapisie!');
    }

    // Sprawdź czy nowa zawartość jest spójna
    preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $savedContent, $m);
    $finalCount = 0;
    if (isset($m[1])) {
        $decoded = json_decode($m[1], true);
        $finalCount = is_array($decoded) ? count($decoded) : 0;
    }

    // Krytyczne zabezpieczenie: jeśli w bazie są wpisy, a w pliku ich nie ma — COFNIJ/ALARM
    if ($dbCount > 0 && $finalCount === 0) {
        throw new RuntimeException("KRYTYCZNA NIESPÓJNOŚĆ: W bazie jest $dbCount wpisów, ale zapisał się pusty kalendarz!");
    }

    return $finalCount;
}

/**
 * Przebudowuje sitemap.xml dopisując aktualne strony dni z katalogu sukcesy/
 * @return int Liczba dopisanych stron /sukcesy/
 */
function sitemapRebuild(PDO $db): int {
    $sitemapFile = SITE_ROOT . 'sitemap.xml';
    if (!file_exists($sitemapFile)) return 0;

    $dom = new DOMDocument();
    $dom->preserveWhiteSpace = false;
    $dom->formatOutput = true;
    if (!@$dom->load($sitemapFile)) return 0;

    $urlset = $dom->documentElement;
    if (!$urlset || $urlset->tagName !== 'urlset' || !($urlset instanceof DOMElement)) return 0;

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

    $count = 0;
    foreach ($dates as $row) {
        $date = $row['entry_date'];
        $lastmod = date('Y-m-d', strtotime($row['last_updated']));
        
        $urlNode = $dom->createElement('url');
        
        $locNode = $dom->createElement('loc', SITE_URL . "sukcesy/{$date}.html");
        $urlNode->appendChild($locNode);
        
        $lastmodNode = $dom->createElement('lastmod', $lastmod);
        $urlNode->appendChild($lastmodNode);
        
        $urlset->appendChild($urlNode);
        $count++;
    }

    if ($dom->save($sitemapFile) === false) {
        throw new RuntimeException('Błąd zapisu pliku sitemap.xml. Sprawdź uprawnienia.');
    }

    return $count;
}
