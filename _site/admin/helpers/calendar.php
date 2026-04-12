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
 * Usuwa osierocone strony dnia: sukcesy/YYYY-MM-DD.html,
 * które nie mają już odpowiadającej daty wpisu published w bazie.
 *
 * @param array<int,string> $publishedDates
 */
function cleanupOrphanedDayPages(array $publishedDates): int {
    $dir = SITE_ROOT . 'sukcesy/';
    if (!is_dir($dir)) {
        return 0;
    }

    $publishedMap = [];
    foreach ($publishedDates as $date) {
        if (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $publishedMap[$date] = true;
        }
    }

    $files = glob($dir . '*.html');
    if ($files === false) {
        return 0;
    }

    $removed = 0;
    foreach ($files as $filePath) {
        $baseName = basename($filePath);
        if (!preg_match('/^(\d{4}-\d{2}-\d{2})\.html$/', $baseName, $m)) {
            continue;
        }
        $fileDate = $m[1];
        if (!isset($publishedMap[$fileDate]) && is_file($filePath)) {
            if (@unlink($filePath)) {
                $removed++;
            }
        }
    }

    return $removed;
}

/**
 * Zapamiętuje liczbę osieroconych stron dnia usuniętych
 * podczas ostatniego przebudowania kalendarza.
 */
function setLastOrphanCleanupCount(int $count): void {
    $GLOBALS['fitpo50_last_orphan_cleanup_count'] = max(0, $count);
}

/**
 * Zwraca liczbę osieroconych stron dnia usuniętych
 * podczas ostatniego przebudowania kalendarza.
 */
function getLastOrphanCleanupCount(): int {
    return (int)($GLOBALS['fitpo50_last_orphan_cleanup_count'] ?? 0);
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
         WHERE status = 'published' AND entry_date IS NOT NULL
         ORDER BY entry_date DESC"
    );
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // 1a. Usuń osierocone strony dnia, które nie mają już wpisów published.
    $orphanRemovedCount = cleanupOrphanedDayPages($dates);
    setLastOrphanCleanupCount($orphanRemovedCount);

    // 2. Zbuduj tablicę wpisów
    $items = [];
    foreach ($dates as $date) {
        $items[] = [
            'date' => $date,
            'url'  => SITE_URL . 'sukcesy/' . $date . '.html',
        ];
    }

    // Osobne, stabilne źródło danych dla frontendu kalendarza (same-origin JSON).
    writeCalendarEntriesJson($items);

    $dbCount = count($items);

    // 3. Wygeneruj poprawny JavaScript
    $json = json_encode(
        $items,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    if (!is_string($json)) {
        throw new RuntimeException('Nie udało się zbudować JSON dla kalendarza.');
    }
    $newDecl = "let userEntries = {$json};";

    // 4. Podmień CAŁY blok między markerami
    $content = file_get_contents($calFile);
    if ($content === false) {
        throw new RuntimeException('Nie udało się odczytać pliku moje-sukcesy.html');
    }
    $backupContent = $content;

    $extractEntriesCount = static function (string $html): int {
        preg_match('/\/\/ ENTRIES_START\s*(?:const|let)\s+userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $html, $m);
        if (!isset($m[1])) {
            return 0;
        }
        $decoded = json_decode($m[1], true);
        return is_array($decoded) ? count($decoded) : 0;
    };

    $restoreBackup = static function () use ($calFile, $backupContent): bool {
        $restoreTmpFile = $calFile . '.restore.tmp';
        if (file_put_contents($restoreTmpFile, $backupContent) === false) {
            return false;
        }
        if (!@rename($restoreTmpFile, $calFile)) {
            @unlink($restoreTmpFile);
            return false;
        }
        return true;
    };

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

    $updatedCount = $extractEntriesCount($updated);
    if ($dbCount > 0 && $updatedCount === 0) {
        throw new RuntimeException("KRYTYCZNA NIESPÓJNOŚĆ: W bazie jest $dbCount wpisów, ale wygenerowany kalendarz jest pusty.");
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
    if ($savedContent === false) {
        $restored = $restoreBackup();
        throw new RuntimeException(
            'WERYFIKACJA FAILED: Nie udało się odczytać pliku kalendarza po zapisie.'
            . ($restored ? ' Przywrócono poprzednią wersję.' : ' Nie udało się przywrócić poprzedniej wersji.')
        );
    }

    // Sprawdź czy nowa zawartość jest spójna
    $finalCount = $extractEntriesCount($savedContent);

    // Krytyczne zabezpieczenie: jeśli w bazie są wpisy, a w pliku ich nie ma — COFNIJ/ALARM
    if ($dbCount > 0 && $finalCount === 0) {
        $restored = $restoreBackup();
        throw new RuntimeException(
            "KRYTYCZNA NIESPÓJNOŚĆ: W bazie jest $dbCount wpisów, ale zapisał się pusty kalendarz!"
            . ($restored ? ' Przywrócono poprzednią wersję.' : ' Nie udało się przywrócić poprzedniej wersji.')
        );
    }

    return $finalCount;
}

/**
 * Zapisuje publiczny plik calendar-entries.json atomowo.
 * Frontend może dzięki temu działać bez zależności od CORS/admin subdomeny.
 *
 * @param array<int,array{date:string,url:string}> $items
 */
function writeCalendarEntriesJson(array $items): void {
    $jsonFile = SITE_ROOT . 'calendar-entries.json';
    $tmpFile = $jsonFile . '.tmp';

    $payload = [
        'ok' => true,
        'entries' => $items,
    ];

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (!is_string($json)) {
        throw new RuntimeException('Nie udało się wygenerować JSON dla calendar-entries.json.');
    }

    if (file_put_contents($tmpFile, $json) === false) {
        @unlink($tmpFile);
        throw new RuntimeException('Błąd zapisu pliku tymczasowego calendar-entries.json.');
    }

    $written = file_get_contents($tmpFile);
    if ($written === false) {
        @unlink($tmpFile);
        throw new RuntimeException('Błąd odczytu pliku tymczasowego calendar-entries.json.');
    }

    $decoded = json_decode($written, true);
    if (!is_array($decoded) || !isset($decoded['entries']) || !is_array($decoded['entries'])) {
        @unlink($tmpFile);
        throw new RuntimeException('Weryfikacja calendar-entries.json nie powiodła się (niepoprawny JSON).');
    }

    if (!@rename($tmpFile, $jsonFile)) {
        @unlink($tmpFile);
        throw new RuntimeException('Błąd podmiany pliku calendar-entries.json.');
    }
}

/**
 * Przebudowuje sitemap.xml dopisując aktualne strony dni z katalogu sukcesy/
 * @return int Liczba dopisanych stron /sukcesy/
 */
function sitemapRebuild(PDO $db): int {
    $sitemapFile = SITE_ROOT . 'sitemap.xml';
    $tmpFile = $sitemapFile . '.tmp';
    
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
        if ($urlNode instanceof DOMElement) {
            $locNode = $urlNode->getElementsByTagName('loc')->item(0);
            if ($locNode && str_contains($locNode->nodeValue, '/sukcesy/')) {
                $toRemove[] = $urlNode;
            }
        }
    }
    foreach ($toRemove as $node) {
        $urlset->removeChild($node);
    }

    // Dodaj aktualne dni
    $stmt = $db->query(
        "SELECT entry_date, MAX(updated_at) as last_updated 
         FROM entries 
         WHERE status = 'published' AND entry_date IS NOT NULL
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

    // ATOMOWY ZAPIS SITEMAPY
    if ($dom->save($tmpFile) === false) {
        @unlink($tmpFile);
        throw new RuntimeException('Błąd zapisu pliku tymczasowego sitemap.xml.');
    }

    // Walidacja pliku tymczasowego przez ponowne wczytanie
    $validator = new DOMDocument();
    if (!@$validator->load($tmpFile)) {
        @unlink($tmpFile);
        throw new RuntimeException('BŁĄD KRYTYCZNY: Wygenerowany plik sitemap.xml.tmp jest niepoprawnym XML!');
    }

    // Atomowa podmiana
    if (!@rename($tmpFile, $sitemapFile)) {
        @unlink($tmpFile);
        throw new RuntimeException('Błąd podczas atomowej podmiany pliku sitemap.xml.');
    }

    return $count;
}
