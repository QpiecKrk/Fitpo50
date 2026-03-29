> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `admin/actions/delete.php` (Domain: **Generic Logic**)

### 📐 Generic Logic Conventions & Fixes
- **[what-changed] Updated schema DOMDocument — prevents null/undefined runtime crashes**: -     $libxml_prev = libxml_use_internal_errors(true);
+     $normalized = str_replace(["\r\n", "\r"], "\n", trim($html));
-     $dom = new DOMDocument();
+     if (!preg_match('/<\s*[a-zA-Z][^>]*>/', $normalized)) {
-     
+         $html = autoFormatPlainText($normalized);
-     $encoded = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
+     } else {
-     $success = @$dom->loadHTML('<body>' . $encoded . '</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
+         $html = $normalized;
-     
+     }
-     if (!$success) {
+ 
-         libxml_use_internal_errors($libxml_prev);
+     $libxml_prev = libxml_use_internal_errors(true);
-         return strip_tags($html);
+     $dom = new DOMDocument();
-     }
+     
-     
+     $encoded = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
-     $allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div'];
+     $success = @$dom->loadHTML('<body>' . $encoded . '</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
-     $allowedAttributes = ['href', 'class', 'id', 'target', 'rel'];
+     
- 
+     if (!$success) {
-     $removeInvalidNodes = function (DOMNode $node) use (&$removeInvalidNodes, $allowedTags, $allowedAttributes) {
+         libxml_use_internal_errors($libxml_prev);
-         for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
+         return strip_tags($html);
-             $child = $node->childNodes->item($i);
+     }
-             
+     
-             if ($child instanceof DOMElement) {
+     $allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div'];
-                 $tag = strtolower($child->tagName);
+     $allowedAttributes = ['href', 'class', 'id', 'target', 'rel'];
-                 if (!in_array($tag, $allowedTags)) {
+ 
-                     if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed'])) {
+     $removeInvalidNodes = fun
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [handleUploads(), processAndSaveImageVariants(), generateArticleHtml(), sanitizeHtml(), autoFormatPlainText()]
- **[what-changed] what-changed in day-list.php**: -           $imageMedia = array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/'));
+           $imageMedia = array_values(array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/')));
-         <div class="entry-carousel reveal" aria-label="Galeria zdjęć wpisu">
+         <div class="entry-carousel reveal" aria-label="Galeria zdjęć wpisu" tabindex="0">
-                 <?= renderMediaPicture($m['filename'], $m['original_name'] ?? $title, $adminUrl, '1200', '675', 'lazy') ?>
+                 <?= renderMediaPicture($m['filename'], $m['original_name'] ?? $title, $adminUrl, '1200', '675', $idx === 0 ? 'eager' : 'lazy') ?>

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[what-changed] what-changed in article.php**: - $imageMedia = array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/'));
+ $imageMedia = array_values(array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/')));
-     <div class="entry-carousel reveal" aria-label="Galeria zdjęć wpisu">
+     <div class="entry-carousel reveal" aria-label="Galeria zdjęć wpisu" tabindex="0">

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[convention] Strengthened types Nawigacja — prevents null/undefined runtime crashes**: - .article-hero { position: relative; width: 100%; max-width: 1000px; margin: 0 auto var(--space-16); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,.15); }
+ .article-header__lead { font-size: clamp(1.1rem, 2.1vw, 1.32rem); color: var(--color-accent); max-width: 62ch; margin: 0 auto; line-height: 1.7; font-weight: 600; }
- .article-hero picture, .article-hero img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }
+ .article-hero { position: relative; width: 100%; max-width: 1000px; margin: 0 auto var(--space-16); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,.15); }
- .article-content { max-width: 720px; margin: 0 auto; font-size: 1.125rem; line-height: 1.8; color: var(--text-muted); padding: 0 var(--space-6); }
+ .article-hero picture, .article-hero img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }
- .article-content > * + * { margin-top: var(--space-6); }
+ .article-content { max-width: 720px; margin: 0 auto; font-size: 1.125rem; line-height: 1.8; color: var(--text-muted); padding: 0 var(--space-6); }
- .article-content h2 { font-family: var(--font-display); font-size: 2.25rem; color: var(--text-base); margin-top: var(--space-12); margin-bottom: var(--space-6); line-height: 1.3; position: relative; padding-bottom: var(--space-3); }
+ .article-content > * + * { margin-top: var(--space-6); }
- .article-content h2::after { content: ""; position: absolute; left: 0; bottom: 0; width: 60px; height: 4px; background: var(--color-primary); border-radius: 2px; }
+ .article-content h2 { font-family: var(--font-display); font-size: 2.25rem; color: var(--text-base); margin-top: var(--space-12); margin-bottom: var(--space-6); line-height: 1.3; position: relative; padding-bottom: var(--space-3); }
- .article-content h3 { font-family: var(--font-display); font-size: 1.5rem; color: var(--color-accent); margin-top: var(--space-10
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[what-changed] Updated schema Nawigacja — prevents null/undefined runtime crashes**: - .article-hero { position: relative; width: 100%; max-width: 1000px; margin: 0 auto var(--space-10); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,.15); }
+ .article-header__lead { font-size: clamp(1.1rem, 2.1vw, 1.32rem); color: var(--color-accent); max-width: 62ch; margin: 0 auto; line-height: 1.7; font-weight: 600; }
- .article-hero img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }
+ .article-hero { position: relative; width: 100%; max-width: 1000px; margin: 0 auto var(--space-10); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,.15); }
- .article-content { max-width: 720px; margin: 0 auto var(--space-12); font-size: 1.125rem; line-height: 1.8; color: var(--text-muted); padding: 0 var(--space-6); }
+ .article-hero img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }
- .article-content > * + * { margin-top: var(--space-6); }
+ .article-content { max-width: 720px; margin: 0 auto var(--space-12); font-size: 1.125rem; line-height: 1.8; color: var(--text-muted); padding: 0 var(--space-6); }
- .article-content h2 { font-family: var(--font-display); font-size: 2.25rem; color: var(--text-base); margin-top: var(--space-12); margin-bottom: var(--space-6); line-height: 1.3; position: relative; padding-bottom: var(--space-3); }
+ .article-content > * + * { margin-top: var(--space-6); }
- .article-content h2::after { content: ""; position: absolute; left: 0; bottom: 0; width: 60px; height: 4px; background: var(--color-primary); border-radius: 2px; }
+ .article-content h2 { font-family: var(--font-display); font-size: 2.25rem; color: var(--text-base); margin-top: var(--space-12); margin-bottom: var(--space-6); line-height: 1.3; position: relative; padding-bottom: var(--space-3); }
- .article-content h3 { font-family: var(--font-display); font-size: 1.5rem; color: var(--color-accent); margin-top: var(--space-10); }
+ .articl
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [renderMediaPicture()]
- **[what-changed] Updated schema RuntimeException**: -     $newDecl = "const userEntries = {$json};";
+     if (!is_string($json)) {
- 
+         throw new RuntimeException('Nie udało się zbudować JSON dla kalendarza.');
-     // Podmień CAŁY blok między markerami
+     }
-     $content = file_get_contents($calFile);
+     $newDecl = "const userEntries = {$json};";
-     $updated = preg_replace_callback(
+     // Podmień CAŁY blok między markerami
-         '/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s',
+     $content = file_get_contents($calFile);
-         static function () use ($newDecl): string {
+ 
-             // Replacement to PHP string — żadnych specjalnych znaków regex
+     if (!preg_match('/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s', $content)) {
-             return "// ENTRIES_START\n  {$newDecl}\n  // ENTRIES_END";
+         throw new RuntimeException('Brak markerów ENTRIES_START/ENTRIES_END w moje-sukcesy.html');
-         },
+     }
-         $content
+ 
-     );
+     $updated = preg_replace_callback(
- 
+         '/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s',
-     if ($updated !== null) {
+         static function () use ($newDecl): string {
-         file_put_contents($calFile, $updated);
+             // Replacement to PHP string — żadnych specjalnych znaków regex
-     }
+             return "// ENTRIES_START\n  {$newDecl}\n  // ENTRIES_END";
- }
+         },
- 
+         $content
+     );
+ 
+     if ($updated === null) {
+         throw new RuntimeException('Nie udało się podmienić bloku wpisów kalendarza.');
+     }
+ 
+     file_put_contents($calFile, $updated);
+ }
+ 

📌 IDE AST Context: Modified symbols likely include [syncDay(), regenerateDayPage(), calendarRebuild()]
- **[problem-fix] Fixed null crash in Nadpisz — prevents null/undefined runtime crashes**: -     $content = preg_replace('/\s*\{[^}]*date:\s*"' . preg_quote($date, '/') . '"[^}]*\},?/', '', $content);
+     if ($content === false) return;
-     if ($content !== null) file_put_contents($calFile, $content);
+ 
- }
+     [$entries, $found] = readCalendarEntries($content);
- 
+     if (!$found) return;
- function injectCalendarEntry(string $date, string $url): void {
+ 
-     $calFile = SITE_ROOT . 'moje-sukcesy.html';
+     $entries = array_values(array_filter(
-     if (!file_exists($calFile)) return;
+         $entries,
-     $content = file_get_contents($calFile);
+         static fn(array $item): bool => ($item['date'] ?? '') !== $date
-     $content = preg_replace('/\s*\{[^}]*date:\s*"' . preg_quote($date, '/') . '"[^}]*\},?/', '', $content);
+     ));
-     $newEntry = "\n    { date: \"$date\", url: \"$url\" },";
+ 
-     $content  = preg_replace('/(const userEntries\s*=\s*\[)/', '$1' . $newEntry, $content);
+     $updated = writeCalendarEntries($content, $entries);
-     if ($content !== null) file_put_contents($calFile, $content);
+     if ($updated !== null) file_put_contents($calFile, $updated);
+ function injectCalendarEntry(string $date, string $url): void {
+     $calFile = SITE_ROOT . 'moje-sukcesy.html';
+     if (!file_exists($calFile)) return;
+     $content = file_get_contents($calFile);
+     if ($content === false) return;
+ 
+     [$entries, $found] = readCalendarEntries($content);
+     if (!$found) return;
+ 
+     // Nadpisz istniejący wpis dla tej samej daty, żeby nie duplikować "fistaszka".
+     $entries = array_values(array_filter(
+         $entries,
+         static fn(array $item): bool => ($item['date'] ?? '') !== $date
+     ));
+     array_unshift($entries, ['date' => $date, 'url' => $url]);
+ 
+     $updated = writeCalendarEntries($content, $entries);
+     if ($updated !== null) file_put_contents($calFile, $updated);
+ }
+ 
+ /**
+  * @return array{0: array<int, array{date:string,url:string}>, 1: bool}
+  */
+ function rea
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [ok(), err(), renderDayPage(), removeFromCalendar(), injectCalendarEntry()]
- **[what-changed] Updated entries database schema — filters out falsy/null values explicitly**: -  *
+  * Zarządzanie wpisami kalendarza przez json_encode + markery.
-  * Jedyne źródło prawdy o kalendarzu.
+  * NIE operujemy regexem na treści JS.
-  * Zasada: NIE operujemy regexem na treści JS.
+  *
-  *
+  * Format markerów w moje-sukcesy.html:
-  * calendarRebuild($db) — odpytuje bazę i wstrzykuje cały blok
+  *   // ENTRIES_START
-  *   const userEntries = [...json...];
+  *   const userEntries = [...];
-  * między markery <!--ENTRIES_START--> / <!--ENTRIES_END-->
+  *   // ENTRIES_END
-  * użytkownik json_encode gwarantuje poprawny JS.
+  *
-  *
+  * PHP podmienia CAŁY blok między markerami — gwarancja poprawnego JS.
-  * regenerateDayPage($db, $date) — generuje lub usuwa sukcesy/YYYY-MM-DD.html
+  */
-  */
+ 
- 
+ /**
- /**
+  * Aktualizuje stronę dnia I kalendarz — wywołaj po każdej zmianie.
-  * Generuje (lub usuwa) stronę dnia i od razu przebudowuje kalendarz.
+  */
-  * Wywołuj po każdej zmianie statusu wpisu.
+ function syncDay(PDO $db, string $date): void {
-  */
+     regenerateDayPage($db, $date);
- function syncDay(PDO $db, string $date): void {
+     calendarRebuild($db);
-     regenerateDayPage($db, $date);
+ }
-     calendarRebuild($db);
+ 
- }
+ /**
- 
+  * Generuje sukcesy/YYYY-MM-DD.html dla wszystkich opublikowanych
- /**
+  * wpisów z danej daty. Jeśli brak wpisów — usuwa plik.
-  * Generuje sukcesy/YYYY-MM-DD.html ze wszystkich opublikowanych
+  */
-  * wpisów tego dnia. Jeśli brak wpisów — usuwa plik.
+ function regenerateDayPage(PDO $db, string $date): void {
-  */
+     $dir     = SITE_ROOT . 'sukcesy/';
- function regenerateDayPage(PDO $db, string $date): void {
+     $dayFile = $dir . $date . '.html';
-     $dir     = SITE_ROOT . 'sukcesy/';
+ 
-     $dayFile = $dir . $date . '.html';
+     $stmt = $db->prepare(
- 
+         "SELECT * FROM entries
-     $stmt = $db->prepare(
+          WHERE entry_date = ? AND status = 'published'
-         "SELECT * FROM entries WHERE entry_date = ? AND status = 'published' ORDER BY created_at ASC"
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [syncDay(), regenerateDayPage(), calendarRebuild()]
- **[what-changed] Updated entries database schema — filters out falsy/null values explicitly**: -  * Bezpieczna aktualizacja tablicy userEntries w moje-sukcesy.html
+  *
-  *
+  * Jedyne źródło prawdy o kalendarzu.
-  * Używa preg_replace_callback + /s modifier żeby:
+  * Zasada: NIE operujemy regexem na treści JS.
-  * - operować TYLKO na wnętrzu tablicy (między [ a ])
+  *
-  * - unikać regex-gotcha z znakami specjalnymi w replacemencie
+  * calendarRebuild($db) — odpytuje bazę i wstrzykuje cały blok
-  * - nie dotykać kodu JS poza tablicą
+  *   const userEntries = [...json...];
-  */
+  * między markery <!--ENTRIES_START--> / <!--ENTRIES_END-->
- 
+  * użytkownik json_encode gwarantuje poprawny JS.
- /**
+  *
-  * Dodaje lub zastępuje wpis dla danego dnia w kalendarzu.
+  * regenerateDayPage($db, $date) — generuje lub usuwa sukcesy/YYYY-MM-DD.html
-  * Zawsze podaje URL do strony dnia (sukcesy/YYYY-MM-DD.html).
+  */
-  */
+ 
- function calendarInject(string $date, string $url): void {
+ /**
-     _calendarModify($date, $url);
+  * Generuje (lub usuwa) stronę dnia i od razu przebudowuje kalendarz.
- }
+  * Wywołuj po każdej zmianie statusu wpisu.
- 
+  */
- /**
+ function syncDay(PDO $db, string $date): void {
-  * Usuwa wpis dla danego dnia z kalendarza.
+     regenerateDayPage($db, $date);
-  * Wywołuje się gdy nie ma już żadnych opublikowanych wpisów w tym dniu.
+     calendarRebuild($db);
-  */
+ }
- function calendarRemove(string $date): void {
+ 
-     _calendarModify($date, null);
+ /**
- }
+  * Generuje sukcesy/YYYY-MM-DD.html ze wszystkich opublikowanych
- 
+  * wpisów tego dnia. Jeśli brak wpisów — usuwa plik.
- /**
+  */
-  * Wewnętrzna funkcja — modyfikuje tablicę userEntries.
+ function regenerateDayPage(PDO $db, string $date): void {
-  * $url === null → usuń wpis; $url !== null → wstaw/zastąp wpis
+     $dir     = SITE_ROOT . 'sukcesy/';
-  */
+     $dayFile = $dir . $date . '.html';
- function _calendarModify(string $date, ?string $url): void {
+ 
-     $calFile = SITE_ROOT . 'moje-sukcesy.html';
+     $stmt = $db->prepare(
-     if (!file_
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [syncDay(), regenerateDayPage(), calendarRebuild()]
- **[what-changed] Replaced auth Jednorazowy — uses a proper password hashing algorithm**: - // Jednorazowy skrypt do generowania hasha hasła
+ // Jednorazowy skrypt do generowania hasha hasła — KASUJE SIĘ PO UŻYCIU
- // Uruchom RAZ po wgraniu na serwer: https://admin.fitpo50.pl/init-hash.php
+ // Uruchom RAZ: https://admin.fitpo50.pl/init-hash.php?token=setup2026fitpo50
- // Następnie skopiuj hash do config.php i USUŃ ten plik z serwera.
+ // Skopiuj hash do config.php → plik zostanie automatycznie usunięty.
- if (php_sapi_name() !== 'cli' && !isset($_SERVER['HTTP_HOST'])) { die('Direct access not allowed'); }
+ 
- 
+ $token = $_GET['token'] ?? '';
- // Prosta ochrona (żeby nikt nie wywołał przez URL bez wiedzy)
+ if ($token !== 'setup2026fitpo50') {
- $token = $_GET['token'] ?? '';
+     http_response_code(403);
- if ($token !== 'setup2026fitpo50') {
+     die('403 Forbidden');
-     http_response_code(403);
+ }
-     die('403 Forbidden — podaj ?token=setup2026fitpo50');
+ 
- }
+ $[REDACTED]
- 
+ $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
- $[REDACTED]
+ $verify = password_verify($password, $hash);
- $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
+ 
- ?>
+ // Skasuj ten plik z serwera natychmiast po wygenerowaniu hasha
- <!DOCTYPE html>
+ $selfDeleted = @unlink(__FILE__);
- <html lang="pl">
+ ?>
- <head><meta charset="UTF-8"><title>Hash Generator</title>
+ <!DOCTYPE html>
- <meta name="robots" content="noindex,nofollow">
+ <html lang="pl">
- <style>body{font-family:monospace;padding:2rem;background:#0f172a;color:#e2e8f0;}
+ <head><meta charset="UTF-8"><title>Hash Generator</title>
- code{background:#1e293b;padding:1rem;display:block;border-radius:8px;word-break:break-all;color:#4ade80;margin:1rem 0;font-size:1.1rem;}
+ <meta name="robots" content="noindex,nofollow">
- .warn{color:#f59e0b;margin-top:2rem;padding:1rem;border:1px solid #f59e0b;border-radius:8px;}</style>
+ <style>
- </head>
+   body{font-family:monospace;padding:2rem;background:#0f172a;color:#e2e8f0;}
- <body>
+   
… [diff truncated]
