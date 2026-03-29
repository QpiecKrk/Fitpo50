> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `admin/api/calendar-entries.php` (Domain: **Generic Logic**)

### 📐 Generic Logic Conventions & Fixes
- **[problem-fix] Fixed null crash in Exception**: -         'entries' => $entries,
+         'entries' => $entries
-         'count'   => count($entries)
+     ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
-     ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
+ 
- 
+ } catch (Exception $e) {
- } catch (Exception $e) {
+     http_response_code(500);
-     http_response_code(500);
+     echo json_encode([
-     echo json_encode([
+         'ok'    => false,
-         'ok'    => false,
+         'error' => 'Błąd serwera przy pobieraniu wpisów.'
-         'error' => 'Błąd serwera przy pobieraniu wpisów.'
+     ]);
-     ]);
+ }
- }
+ 
- 
- **[what-changed] what-changed in calendar.php**: -     if (!$urlset || $urlset->tagName !== 'urlset') return 0;
+     if (!$urlset || $urlset->tagName !== 'urlset' || !($urlset instanceof DOMElement)) return 0;

📌 IDE AST Context: Modified symbols likely include [syncDay(), regenerateDayPage(), calendarRebuild(), sitemapRebuild()]
- **[what-changed] Replaced auth Zsynchronizowano**: -         $sitemapContentAfter = file_get_contents(SITE_ROOT . 'sitemap.xml');
+         $calContentAfter = file_get_contents(SITE_ROOT . 'moje-sukcesy.html');
-         $verifySitemapCount = substr_count($sitemapContentAfter, '/sukcesy/');
+         preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $calContentAfter, $m);
-         
+         $finalCalCount = 0;
-         $stats[] = "✓ Zsynchronizowano pomyślnie:";
+         if (isset($m[1])) {
-         $stats[] = "— Kalendarz: $syncedCalCount dni";
+             $decoded = json_decode($m[1], true);
-         $stats[] = "— Sitemap: $syncedSitemapCount adresów (Weryfikacja pliku: $verifySitemapCount)";
+             $finalCalCount = is_array($decoded) ? count($decoded) : 0;
-         
+         }
-         if ($verifySitemapCount !== $syncedSitemapCount) {
+ 
-             $errors[] = "UWAGA: Rozbieżność w sitemapie! Oczekiwano $syncedSitemapCount, znaleziono $verifySitemapCount.";
+         $sitemapContentAfter = file_get_contents(SITE_ROOT . 'sitemap.xml');
-         }
+         $verifySitemapCount = substr_count($sitemapContentAfter, '/sukcesy/');
-     } catch (Exception $e) {
+         
-         $errors[] = "BŁĄD SYNCHRONIZACJI: " . $e->getMessage();
+         $stats[] = "✓ Zsynchronizowano pomyślnie:";
-     }
+         $stats[] = "— Kalendarz: $syncedCalCount dni (w pliku: $finalCalCount)";
- }
+         $stats[] = "— Sitemap: $syncedSitemapCount adresów (w pliku: $verifySitemapCount)";
- 
+         
- ?>
+         // Twarda walidacja niespójności
- <!DOCTYPE html>
+         if ($publishedCount > 0 && $finalCalCount === 0) {
- <html lang="pl">
+             $errors[] = "⚠️ KRYTYCZNA NIESPÓJNOŚĆ: Kalendarz w HTML jest pustY, mimo że w bazie jest $publishedCount wpisów!";
- <head>
+         }
-     <meta charset="UTF-8">
+ 
-     <title>Ręczna Synchronizacja Kalendarza</title>
+         if ($verifySitemapCount !== $syncedSitemapCount) {
-     <style>
+             
… [diff truncated]
- **[what-changed] Updated entries database schema**: -  * bezpośrednio z bazy danych.
+  * bezpośrednio z bazy danych z atomowym zapisem i weryfikacją.
-  *
+  */
-  * Mechanizm:
+ function calendarRebuild(PDO $db): int {
-  *  1. Pobiera wszystkie daty z opublikowanymi wpisami
+     $calFile = SITE_ROOT . 'moje-sukcesy.html';
-  *  2. json_encode() → gwarantuje poprawny JS
+     $tmpFile = $calFile . '.tmp';
-  *  3. preg_replace_callback podmienia CAŁY blok
+     
-  *     między // ENTRIES_START a // ENTRIES_END
+     if (!file_exists($calFile)) return 0;
-  *  4. Zero regex na treści JS — replacement to PHP string
+ 
-  */
+     // 1. Pobierz wszystkie opublikowane daty
- function calendarRebuild(PDO $db): int {
+     $stmt = $db->query(
-     $calFile = SITE_ROOT . 'moje-sukcesy.html';
+         "SELECT DISTINCT entry_date FROM entries
-     if (!file_exists($calFile)) return 0;
+          WHERE status = 'published'
- 
+          ORDER BY entry_date DESC"
-     // Pobierz wszystkie opublikowane daty
+     );
-     $stmt = $db->query(
+     $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);
-         "SELECT DISTINCT entry_date FROM entries
+ 
-          WHERE status = 'published'
+     // 2. Zbuduj tablicę wpisów
-          ORDER BY entry_date DESC"
+     $items = [];
-     );
+     foreach ($dates as $date) {
-     $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);
+         $items[] = [
- 
+             'date' => $date,
-     // Zbuduj tablicę wpisów
+             'url'  => SITE_URL . 'sukcesy/' . $date . '.html',
-     $items = [];
+         ];
-     foreach ($dates as $date) {
+     }
-         $items[] = [
+ 
-             'date' => $date,
+     $dbCount = count($items);
-             'url'  => SITE_URL . 'sukcesy/' . $date . '.html',
+ 
-         ];
+     // 3. Wygeneruj poprawny JavaScript
-     }
+     $json = json_encode(
- 
+         $items,
-     $count = count($items);
+         JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
- 
+     );
-     // Wygeneruj poprawny JavaScript przez json_encode
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [syncDay(), regenerateDayPage(), calendarRebuild(), sitemapRebuild()]
- **[what-changed] Replaced auth Statystyki**: -     $calFile = SITE_ROOT . 'moje-sukcesy.html';
+     // Statystyki Kalendarza
-     $content = file_get_contents($calFile);
+     $calFile = SITE_ROOT . 'moje-sukcesy.html';
-     preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $content, $m);
+     $calContent = file_get_contents($calFile);
-     $currentCount = 0;
+     preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $calContent, $m);
-     if (isset($m[1])) {
+     $currentCalCount = 0;
-         $decoded = json_decode($m[1], true);
+     if (isset($m[1])) {
-         $currentCount = is_array($decoded) ? count($decoded) : 0;
+         $decoded = json_decode($m[1], true);
-     }
+         $currentCalCount = is_array($decoded) ? count($decoded) : 0;
-     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";
+     }
- 
+     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCalCount dni";
- } catch (Exception $e) {
+ 
-     $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
+     // Statystyki Sitemap
- }
+     $sitemapFile = SITE_ROOT . 'sitemap.xml';
- 
+     $sitemapContent = file_exists($sitemapFile) ? file_get_contents($sitemapFile) : '';
- // 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
+     $currentSitemapCount = substr_count($sitemapContent, '/sukcesy/');
- if ($_SERVER['REQUEST_METHOD'] === 'POST') {
+     $stats[] = "Aktualnie w sitemap.xml: $currentSitemapCount wpisów /sukcesy/";
-     try {
+ 
-         verifyCsrf();
+ } catch (Exception $e) {
-         $syncedCount = calendarRebuild($db);
+     $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
-         sitemapRebuild($db);
+ }
-         $synced = true;
+ 
-         $stats[] = "✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.";
+ // 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
-     } catch (Exception $e) {
+ if ($_SERVER['REQUEST_METHOD'] === 'POST') {
-         $errors[] = "BŁĄD SYNCHRONIZACJI
… [diff truncated]
- **[what-changed] Replaced auth Baza — uses a proper password hashing algorithm**: - // --- Baza danych ---
+ define('APP_ENV', 'production'); // 'dev' lub 'production'
- define('DB_HOST', 'localhost');
+ 
- define('DB_NAME', 'u542460614_fitpo50');   // ← uzupełnij nazwę bazy z panelu Hostinger
+ // --- Baza danych ---
- define('DB_USER', 'u542460614_admin');      // ← uzupełnij użytkownika DB
+ define('DB_HOST', 'localhost');
- define('DB_PASS', 'TWOJE_HASLO_DB');        // ← uzupełnij hasło DB
+ define('DB_NAME', 'u542460614_fitpo50');   // ← uzupełnij nazwę bazy z panelu Hostinger
- 
+ define('DB_USER', 'u542460614_admin');      // ← uzupełnij użytkownika DB
- // --- Hasło aplikacyjne ---
+ define('DB_PASS', 'TWOJE_HASLO_DB');        // ← uzupełnij hasło DB
- // Hash bcrypt (cost 12).
+ 
- // Wygenerowany przez: php -r "echo password_hash('TWOJE_HASLO', PASSWORD_BCRYPT, ['cost'=>12]);"
+ // --- Hasło aplikacyjne ---
- // Uruchom init-hash.php jednorazowo, żeby uzyskać hash, a potem go tutaj wklej.
+ // Hash bcrypt (cost 12).
- define('PASSWORD_HASH', '$2y$12$PLACEHOLDER_RUN_INIT_HASH_PHP');
+ // Wygenerowany przez: php -r "echo password_hash('TWOJE_HASLO', PASSWORD_BCRYPT, ['cost'=>12]);"
- 
+ // Uruchom init-hash.php jednorazowo, żeby uzyskać hash, a potem go tutaj wklej.
- // --- Sesja ---
+ define('PASSWORD_HASH', '$2y$12$PLACEHOLDER_RUN_INIT_HASH_PHP');
- define('SESSION_TIMEOUT', 7200);       // 2 godziny
+ 
- define('SESSION_NAME', 'fp50_admin');
+ // --- Sesja ---
- 
+ define('SESSION_TIMEOUT', 7200);       // 2 godziny
- // --- Ścieżki ---
+ define('SESSION_NAME', 'fp50_admin');
- define('SITE_ROOT', dirname(__DIR__) . DIRECTORY_SEPARATOR);
+ 
- define('ADMIN_ROOT', __DIR__ . DIRECTORY_SEPARATOR);
+ // --- Ścieżki ---
- define('UPLOADS_DIR', ADMIN_ROOT . 'uploads' . DIRECTORY_SEPARATOR);
+ define('SITE_ROOT', dirname(__DIR__) . DIRECTORY_SEPARATOR);
- 
+ define('ADMIN_ROOT', __DIR__ . DIRECTORY_SEPARATOR);
- // --- URL ---
+ define('UPLOADS_DIR', ADMIN_ROOT . 'uploads' . DIRECTORY_SEPARATOR);
- define('SITE_URL', 'https://fitpo50.pl/');
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [APP_ENV, DB_HOST, DB_NAME, DB_USER, DB_PASS]
- **[problem-fix] Fixed null crash in Wpisy — prevents null/undefined runtime crashes**: - $dateFormatted = date('j F Y', strtotime($date ?? ''));
+ $uploadsUrl = $siteUrl . 'admin/uploads/';
- $pageTitle = 'Wpisy z ' . $dateFormatted;
+ $dateFormatted = date('j F Y', strtotime($date ?? ''));
- $pageDesc  = 'Wszystkie wpisy FitPo50 z dnia ' . $dateFormatted . '.';
+ $pageTitle = 'Wpisy z ' . $dateFormatted;
- $pageUrl   = $siteUrl . 'sukcesy/' . ($date ?? '') . '.html';
+ $pageDesc  = 'Wszystkie wpisy FitPo50 z dnia ' . $dateFormatted . '.';
- 
+ $pageUrl   = $siteUrl . 'sukcesy/' . ($date ?? '') . '.html';
- $adminUrl  = defined('ADMIN_URL') ? ADMIN_URL : 'https://admin.fitpo50.pl/';
+ 
- $ogImage   = $siteUrl . 'assets/Hero_Porady1.png'; // Domyślne tło
+ $adminUrl  = defined('ADMIN_URL') ? ADMIN_URL : 'https://admin.fitpo50.pl/';
- foreach ($entries as $e) {
+ $ogImage   = $siteUrl . 'assets/Hero_Porady1.png'; // Domyślne tło
-     if (!empty($e['media'])) {
+ foreach ($entries as $e) {
-         foreach ($e['media'] as $m) {
+     if (!empty($e['media'])) {
-             if (str_starts_with($m['mime_type'] ?? '', 'image/')) {
+         foreach ($e['media'] as $m) {
-                 // Wybierzmy pierwsze znalezione zdjęcie jako OG Image
+             if (str_starts_with($m['mime_type'] ?? '', 'image/')) {
-                 // Zamieniamy na JPG by mieć 100% kompatybilności z Facebookiem/X
+                 // Wybierzmy pierwsze znalezione zdjęcie jako OG Image
-                 $base = pathinfo($m['filename'], PATHINFO_FILENAME);
+                 // Zamieniamy na JPG by mieć 100% kompatybilności z Facebookiem/X
-                 if (file_exists(ADMIN_ROOT . 'uploads/' . $base . '.jpg')) {
+                 $base = pathinfo($m['filename'], PATHINFO_FILENAME);
-                     $ogImage = $adminUrl . 'uploads/' . $base . '.jpg';
+                 if (file_exists(ADMIN_ROOT . 'uploads/' . $base . '.jpg')) {
-                 } else {
+                     $ogImage = $uploadsUrl . $base . '.jpg';
-                     $ogImage = $adminUrl . 'uploads
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[problem-fix] Fixed null crash in YYYY — prevents null/undefined runtime crashes**: - $slug       = $entry['slug'];
+ $uploadsUrl = $siteUrl . 'admin/uploads/';
- $title      = $entry['title'];
+ $slug       = $entry['slug'];
- $lead       = $entry['lead'] ?? '';
+ $title      = $entry['title'];
- $content    = $entry['content'];
+ $lead       = $entry['lead'] ?? '';
- $date       = $entry['entry_date'];   // YYYY-MM-DD
+ $content    = $entry['content'];
- $dateIso    = $date . 'T10:00:00+02:00';
+ $date       = $entry['entry_date'];   // YYYY-MM-DD
- $dateModIso = ($entry['updated_at'] ?? $date) . 'T10:00:00+02:00';
+ $dateIso    = $date . 'T10:00:00+02:00';
- $pageUrl    = $siteUrl . $slug . '.html';
+ $dateModIso = ($entry['updated_at'] ?? $date) . 'T10:00:00+02:00';
- 
+ $pageUrl    = $siteUrl . $slug . '.html';
- // Pierwszy obraz jako hero/og:image
+ 
- $imageMedia = array_values(array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/')));
+ // Pierwszy obraz jako hero/og:image
- $imageCount = count($imageMedia);
+ $imageMedia = array_values(array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/')));
- $heroImg = $imageCount > 0 ? reset($imageMedia) : null;
+ $imageCount = count($imageMedia);
- $heroUrl = $heroImg ? ($adminUrl . 'uploads/' . $heroImg['filename']) : ($siteUrl . 'assets/Hero_Porady1.png');
+ $heroImg = $imageCount > 0 ? reset($imageMedia) : null;
- 
+ $heroUrl = $heroImg ? ($uploadsUrl . $heroImg['filename']) : ($siteUrl . 'assets/Hero_Porady1.png');
- // Czas czytania (szacunek: ~200 słów/min)
+ 
- $words   = str_word_count(strip_tags($content));
+ // Czas czytania (szacunek: ~200 słów/min)
- $readMin = max(1, round($words / 200));
+ $words   = str_word_count(strip_tags($content));
- 
+ $readMin = max(1, round($words / 200));
- // Helper: bezpieczne renderowanie mediów z picture (avif, webp) + leniwe ładownie
+ 
- function renderMediaPicture($filename, $originalName, $adminUrl, $width, $height, $loading = 'lazy', $fit = 'cover') {
+ // Helper: bezpieczne renderowanie mediów z pictur
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[what-changed] Replaced auth Podstawowe**: - 
+ $csrf = csrfToken();
- // 1. Podstawowe statystyki (zawsze widoczne przez GET)
+ 
- try {
+ // 1. Podstawowe statystyki (zawsze widoczne przez GET)
-     $stmt = $db->query("SELECT COUNT(*) FROM entries WHERE status = 'published'");
+ try {
-     $publishedCount = (int)$stmt->fetchColumn();
+     $stmt = $db->query("SELECT COUNT(*) FROM entries WHERE status = 'published'");
-     $stats[] = "Wpisy o statusie 'published' w bazie: $publishedCount";
+     $publishedCount = (int)$stmt->fetchColumn();
- 
+     $stats[] = "Wpisy o statusie 'published' w bazie: $publishedCount";
-     $calFile = SITE_ROOT . 'moje-sukcesy.html';
+ 
-     $content = file_get_contents($calFile);
+     $calFile = SITE_ROOT . 'moje-sukcesy.html';
-     preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $content, $m);
+     $content = file_get_contents($calFile);
-     $currentCount = 0;
+     preg_match('/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/', $content, $m);
-     if (isset($m[1])) {
+     $currentCount = 0;
-         $decoded = json_decode($m[1], true);
+     if (isset($m[1])) {
-         $currentCount = is_array($decoded) ? count($decoded) : 0;
+         $decoded = json_decode($m[1], true);
-     }
+         $currentCount = is_array($decoded) ? count($decoded) : 0;
-     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";
+     }
- 
+     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";
- } catch (Exception $e) {
+ 
-     $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
+ } catch (Exception $e) {
- }
+     $errors[] = "Błąd odczytu statystyk: " . $e->getMessage();
- 
+ }
- // 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
+ 
- if ($_SERVER['REQUEST_METHOD'] === 'POST') {
+ // 2. Faktyczna synchronizacja (tylko przez POST z CSRF)
-     try {
+ if ($_SERVER['REQUEST_METHOD'] === 'POST') {
-         verifyCsrf();
+     try {
-         $syncedCount = calendarRebu
… [diff truncated]
- **[what-changed] what-changed in sync-manual.php**: -     $stats[] = "Wpisy o statusie 'published' w bazie: <strong>$publishedCount</strong>";
+     $stats[] = "Wpisy o statusie 'published' w bazie: $publishedCount";
-     $stats[] = "Aktualnie w moje-sukcesy.html: <strong>$currentCount</strong> dni";
+     $stats[] = "Aktualnie w moje-sukcesy.html: $currentCount dni";
-         $stats[] = "<span class='success'>✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.</span>";
+         $stats[] = "✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.";
-             <div class="stat"><?= $stat ?></div>
+             <div class="stat"><?= h($stat) ?></div>
- **[trade-off] trade-off in article.php**: - <script>
+ <?php require ADMIN_ROOT . 'templates/carousel-script.php'; ?>
- document.addEventListener('DOMContentLoaded', () => {
+ 
-     const carousels = document.querySelectorAll('.entry-carousel');
+ <nav class="bottom-nav" aria-label="Nawigacja dolna">
-     carousels.forEach(carousel => {
+   <a href="index.html" class="bottom-nav__item">
-         const track = carousel.querySelector('.entry-carousel__track');
+     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
-         const slides = Array.from(track.children);
+     <span>Dom</span>
-         const dotsContainer = carousel.querySelector('.entry-carousel__dots');
+   </a>
-         const prevBtn = carousel.querySelector('.entry-carousel__btn--prev');
+   <a href="porady.html" class="bottom-nav__item">
-         const nextBtn = carousel.querySelector('.entry-carousel__btn--next');
+     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
-         
+     <span>Porady</span>
-         if (slides.length < 2) return;
+   </a>
- 
+   <a href="moje-sukcesy.html" class="bottom-nav__item">
-         // Create dots
+     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
-         slides.forEach((_, i) => {
+     <span>Sukcesy</span>
-             const dot = document.createElement('button');
+   </a>
-             dot.classList.add('entry-carousel__dot');
+   <a href="https://www.instag
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[convention] Fixed null crash in DOMDocument — prevents null/undefined runtime crashes — confirmed 3x**: -     $allowed = ['image/jpeg','image/png','image/webp','image/gif'];
+     $allowed = ['image/jpeg','image/png','image/webp','image/gif','image/avif'];
-     // Usunięcie znaków końca linii i niepotrzebnych encji dodanych przez libxml, jeżeli wystąpiły by na obrzeżach
+     // DOMDocument sam dba o poprawność encji w $dom->saveHTML()
-     $out = str_replace(['%5C', '%22'], ['\\', '"'], $out);
+     
-     
+     libxml_clear_errors();
-     libxml_clear_errors();
+     libxml_use_internal_errors($libxml_prev);
-     libxml_use_internal_errors($libxml_prev);
+     
-     
+     return trim($out);
-     return trim($out);
+ }
- }
+ 
- 
+ function autoFormatPlainText(string $text): string {
- function autoFormatPlainText(string $text): string {
+     if ($text === '') return '';
-     if ($text === '') return '';
+ 
- 
+     $blocks = preg_split('/\n{2,}/', $text) ?: [];
-     $blocks = preg_split('/\n{2,}/', $text) ?: [];
+     $out = [];
-     $out = [];
+ 
- 
+     foreach ($blocks as $blockRaw) {
-     foreach ($blocks as $blockRaw) {
+         $block = trim($blockRaw);
-         $block = trim($blockRaw);
+         if ($block === '') continue;
-         if ($block === '') continue;
+ 
- 
+         $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), static fn($line) => $line !== ''));
-         $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), static fn($line) => $line !== ''));
+         if (empty($lines)) continue;
-         if (empty($lines)) continue;
+ 
- 
+         if (isBulletBlock($lines)) {
-         if (isBulletBlock($lines)) {
+             $items = [];
-             $items = [];
+             foreach ($lines as $line) {
-             foreach ($lines as $line) {
+                 $clean = preg_replace('/^[-*]\s+/u', '', $line);
-                 $clean = preg_replace('/^[-*]\s+/u', '', $line);
+                 $safe = htmlspecialchars($clean ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
-             
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [handleUploads(), processAndSaveImageVariants(), generateArticleHtml(), sanitizeHtml(), autoFormatPlainText()]
- **[convention] Added session cookies authentication — prevents null/undefined runtime crashes — confirmed 3x**: -         $synced = true;
+         sitemapRebuild($db);
-         $stats[] = "<span class='success'>✓ Zsynchronizowano pomyślnie $syncedCount dni.</span>";
+         $synced = true;
-     } catch (Exception $e) {
+         $stats[] = "<span class='success'>✓ Zsynchronizowano pomyślnie $syncedCount dni oraz mapę strony.</span>";
-         $errors[] = "BŁĄD SYNCHRONIZACJI: " . $e->getMessage();
+     } catch (Exception $e) {
-     }
+         $errors[] = "BŁĄD SYNCHRONIZACJI: " . $e->getMessage();
- }
+     }
- 
+ }
- ?>
+ 
- <!DOCTYPE html>
+ ?>
- <html lang="pl">
+ <!DOCTYPE html>
- <head>
+ <html lang="pl">
-     <meta charset="UTF-8">
+ <head>
-     <title>Ręczna Synchronizacja Kalendarza</title>
+     <meta charset="UTF-8">
-     <style>
+     <title>Ręczna Synchronizacja Kalendarza</title>
-         body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; background: #f4f7f6; }
+     <style>
-         .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
+         body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; background: #f4f7f6; }
-         h1 { color: #2c3e50; margin-top: 0; }
+         .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
-         .stat { padding: 10px; margin: 5px 0; background: #e8f4fd; border-left: 4px solid #3498db; }
+         h1 { color: #2c3e50; margin-top: 0; }
-         .error { padding: 15px; margin: 20px 0; background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; border-radius: 4px; }
+         .stat { padding: 10px; margin: 5px 0; background: #e8f4fd; border-left: 4px solid #3498db; }
-         .success { color: #059669; font-weight: bold; }
+         .error { padding: 15px; margin: 20px 0; background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; border-radius: 4px; }
-         .btn { display: inline-block; padding: 10px 20
… [diff truncated]
- **[what-changed] Replaced auth Uruchom**: - // Uruchom RAZ: https://admin.fitpo50.pl/init-db.php?token=setup2026fitpo50
+ // Uruchom RAZ: https://admin.fitpo50.pl/init-db.php?token=CHANGE_ME
- if ($token !== 'setup2026fitpo50') {
+ if ($token !== 'CHANGE_ME') {
-     die('403 Forbidden');
+     die('403 Forbidden — Ustaw bezpieczny token w kodzie przed użyciem.');
- **[convention] Replaced auth Panel — prevents null/undefined runtime crashes — confirmed 3x**: - $logoUrl = 'assets/logo.jpg';
+ $logoUrl = 'assets/logo.jpg?v=2';
-       <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36">
+       <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36"
-       <span class="panel-header__title">Panel redakcyjny</span>
+            onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://fitpo50.pl/assets/logo.jpg';}">
-     </div>
+       <span class="panel-header__title">Panel redakcyjny</span>
-     <nav class="panel-header__nav">
+     </div>
-       <a href="dashboard.php" class="panel-nav-link">Wpisy</a>
+     <nav class="panel-header__nav">
-       <a href="entry-form.php" class="panel-nav-link panel-nav-link--active">Nowy wpis</a>
+       <a href="dashboard.php" class="panel-nav-link">Wpisy</a>
-       <a href="../moje-sukcesy.html" target="_blank" rel="noopener noreferrer" class="panel-nav-link">Moje Sukcesy ↗</a>
+       <a href="entry-form.php" class="panel-nav-link panel-nav-link--active">Nowy wpis</a>
-       <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
+       <a href="../moje-sukcesy.html" target="_blank" rel="noopener noreferrer" class="panel-nav-link">Moje Sukcesy ↗</a>
-     </nav>
+       <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
-   </div>
+     </nav>
- </header>
+   </div>
- 
+ </header>
- <main class="panel-main">
+ 
-   <div class="panel-container">
+ <main class="panel-main">
- 
+   <div class="panel-container">
-     <?php require __DIR__ . '/partials/flash.php'; ?>
+ 
- 
+     <?php require __DIR__ . '/partials/flash.php'; ?>
-     <div class="page-heading">
+ 
-       <h2 class="panel-section-title"><?= h($pageTitle) ?></h2>
+     <div class="page-heading">
-       <?php if ($editMode && $entry['status'] === 'published' && $entry['html_file']): ?>
+       <h2 class="panel-section-title"><?= h($pageTitle) ?></h2>
-         <a href="<?= SITE_URL . h($entry['html_file']) ?>" target="_
… [diff truncated]
