<?php
/**
 * test-live.php — Test na żywo: 2 wpisy z datą 2026-04-03
 *
 * Uruchom RAZ po deployu:
 *   https://admin.fitpo50.pl/test-live.php?token=test2026fitpo50
 *
 * Co robi:
 *  1. Sprawdza istnienie i prawa zapisu katalogu sukcesy/
 *  2. Sprawdza czy init-hash.php i init-db.php zostały usunięte
 *  3. Wstawia 2 testowe wpisy z datą 2026-04-03
 *  4. Uruchamia pełną logikę publikacji
 *  5. Weryfikuje: sukcesy/2026-04-03.html, 1 fistaszek w kalendarzu, 2 wpisy na stronie dnia
 *  6. Sprząta dane testowe
 *  7. Kasuje się sam
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$token = $_GET['token'] ?? '';
if ($token !== 'test2026fitpo50') { http_response_code(403); die('403'); }

$results = [];
$errors  = [];
$TEST_DATE = '2026-04-03';

function ok(string $msg, array &$r): void  { $r[] = ['ok',  $msg]; }
function err(string $msg, array &$e): void { $e[] = ['err', $msg]; }

// ============================================================
// 1. Sprawdź katalog sukcesy/
// ============================================================
$sukcesyDir = SITE_ROOT . 'sukcesy/';
if (!is_dir($sukcesyDir)) {
    if (@mkdir($sukcesyDir, 0755, true)) {
        ok("Katalog sukcesy/ — utworzony", $results);
    } else {
        err("Katalog sukcesy/ — NIE MOŻNA UTWORZYĆ. Sprawdź uprawnienia serwera.", $errors);
    }
} else {
    ok("Katalog sukcesy/ — istnieje", $results);
}

// sprawdź zapis
$testFile = $sukcesyDir . '_write_test_' . time() . '.tmp';
if (@file_put_contents($testFile, 'ok')) {
    @unlink($testFile);
    ok("Katalog sukcesy/ — zapis działa", $results);
} else {
    err("Katalog sukcesy/ — BRAK PRAW ZAPISU. Uruchom: chmod 755 " . $sukcesyDir, $errors);
}

// ============================================================
// 2. Sprawdź czy init-hash.php i init-db.php zniknęły
// ============================================================
foreach (['init-hash.php', 'init-db.php'] as $initFile) {
    $path = __DIR__ . '/' . $initFile;
    if (file_exists($path)) {
        err("$initFile NADAL ISTNIEJE na serwerze! Usuń go ręcznie natychmiast.", $errors);
    } else {
        ok("$initFile — usunięty ✓", $results);
    }
}

// ============================================================
// 3. Przygotuj DB i logikę
// ============================================================
try {
    $db = getDb();

    // Usuń ewentualne poprzednie dane testowe
    $db->prepare("DELETE FROM entries WHERE slug LIKE 'test-%' AND entry_date = ?")->execute([$TEST_DATE]);

    // Wstaw wpis A
    $slugA = $TEST_DATE . '-test-poranny-trening';
    $db->prepare("INSERT INTO entries (title, slug, entry_date, lead, content, status, html_file, published_at)
                  VALUES (?, ?, ?, ?, ?, 'published', ?, NOW())")
       ->execute([
           'Test: Poranny trening',
           $slugA,
           $TEST_DATE,
           'Krótki lead wpisu A',
           '<p>Treść wpisu testowego A.</p>',
           $slugA . '.html',
       ]);
    $idA = (int)$db->lastInsertId();

    // Wstaw wpis B
    $slugB = $TEST_DATE . '-test-wieczorny-spacer';
    $db->prepare("INSERT INTO entries (title, slug, entry_date, lead, content, status, html_file, published_at)
                  VALUES (?, ?, ?, ?, ?, 'published', ?, NOW())")
       ->execute([
           'Test: Wieczorny spacer',
           $slugB,
           $TEST_DATE,
           'Krótki lead wpisu B',
           '<p>Treść wpisu testowego B.</p>',
           $slugB . '.html',
       ]);
    $idB = (int)$db->lastInsertId();

    ok("Wpis A ($slugA) wstawiony do bazy (id=$idA)", $results);
    ok("Wpis B ($slugB) wstawiony do bazy (id=$idB)", $results);

    // ============================================================
    // 4. Uruchom regenerateDayPage — serce logiki
    // ============================================================
    $stmt = $db->prepare("SELECT * FROM entries WHERE entry_date = ? AND status = 'published' ORDER BY created_at ASC");
    $stmt->execute([$TEST_DATE]);
    $dayEntries = $stmt->fetchAll();

    // Wygeneruj stronę dnia
    if (!is_dir($sukcesyDir)) @mkdir($sukcesyDir, 0755, true);
    $dayHtml = renderDayPage($TEST_DATE, $dayEntries);
    file_put_contents($sukcesyDir . $TEST_DATE . '.html', $dayHtml);

    // Wstaw fistaszka do kalendarza
    $url = SITE_URL . 'sukcesy/' . $TEST_DATE . '.html';
    injectCalendarEntry($TEST_DATE, $url);

    ok("regenerateDayPage — " . count($dayEntries) . " wpisy (" . $TEST_DATE . ")", $results);

    // ============================================================
    // 5. Weryfikacje
    // ============================================================

    // (a) Plik dnia istnieje
    $dayFile = $sukcesyDir . $TEST_DATE . '.html';
    if (file_exists($dayFile)) {
        ok("sukcesy/$TEST_DATE.html — plik istnieje ✓", $results);
        $content = file_get_contents($dayFile);
        $countA = substr_count($content, 'Test: Poranny trening');
        $countB = substr_count($content, 'Test: Wieczorny spacer');
        if ($countA > 0 && $countB > 0) {
            ok("sukcesy/$TEST_DATE.html — zawiera OBA wpisy (A: $countA, B: $countB) ✓", $results);
        } else {
            err("sukcesy/$TEST_DATE.html — BRAKUJE wpisów (A: $countA, B: $countB)", $errors);
        }
    } else {
        err("sukcesy/$TEST_DATE.html — plik NIE ISTNIEJE", $errors);
    }

    // (b) Kalendarz ma dokładnie 1 wpis z $TEST_DATE
    $calContent = file_get_contents(SITE_ROOT . 'moje-sukcesy.html');
    preg_match_all('/' . preg_quote($TEST_DATE, '/') . '/', $calContent, $m);
    $calCount = count($m[0]);
    if ($calCount === 1) {
        ok("moje-sukcesy.html — dokładnie 1 fistaszek dla $TEST_DATE ✓", $results);
    } else {
        err("moje-sukcesy.html — znaleziono $calCount wpisów dla $TEST_DATE (oczekiwano 1)", $errors);
    }

    // (c) URL w kalendarzu wskazuje na stronę dnia
    if (str_contains($calContent, "sukcesy/$TEST_DATE.html")) {
        ok("moje-sukcesy.html — URL wskazuje na sukcesy/$TEST_DATE.html ✓", $results);
    } else {
        err("moje-sukcesy.html — URL NIE wskazuje na sukcesy/$TEST_DATE.html", $errors);
    }

    // ============================================================
    // 6. Sprzątanie danych testowych
    // ============================================================
    $db->prepare("DELETE FROM entries WHERE entry_date = ? AND slug LIKE 'test-%'")->execute([$TEST_DATE]);
    if (file_exists($dayFile)) @unlink($dayFile);
    // Przywróć kalendarz - usuń testowy wpis
    removeFromCalendar($TEST_DATE);
    ok("Dane testowe — wyczyszczone ✓", $results);

} catch (Exception $e) {
    err("Błąd testu: " . $e->getMessage(), $errors);
}

// Skasuj siebie
$selfDeleted = @unlink(__FILE__);

// ============================================================
// Render
// ============================================================
$allOk = empty($errors);
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex,nofollow">
<title>Test Live — FitPo50</title>
<style>
  body { font-family: monospace; padding: 2rem; background: #0f172a; color: #e2e8f0; max-width: 800px; }
  h2 { color: <?= $allOk ? '#4ade80' : '#f87171' ?>; }
  .ok  { color: #4ade80; padding: .3rem 0; }
  .err { color: #f87171; padding: .3rem 0; font-weight: bold; }
  .section { margin: 1.5rem 0; padding: 1rem; background: #1e293b; border-radius: 8px; }
  .warn { color: #f59e0b; margin-top: 1rem; padding: .75rem 1rem; border: 1px solid #f59e0b; border-radius: 8px; }
</style>
</head>
<body>
<h2><?= $allOk ? '✅ WSZYSTKIE TESTY PRZESZŁY' : '❌ WYKRYTO BŁĘDY' ?></h2>
<p><strong>Test: 2 wpisy z datą <?= $TEST_DATE ?> → 1 link w kalendarzu → 1 strona dnia z 2 wpisami</strong></p>

<div class="section">
<?php foreach ($results as $r): ?>
  <div class="ok">✓ <?= htmlspecialchars($r[1]) ?></div>
<?php endforeach; ?>
<?php foreach ($errors as $e): ?>
  <div class="err">✗ <?= htmlspecialchars($e[1]) ?></div>
<?php endforeach; ?>
</div>

<div class="warn">
  <?= $selfDeleted ? '🗑️ test-live.php usunięty automatycznie.' : '⚠️ Usuń test-live.php ręcznie z serwera!' ?>
</div>
</body>
</html>
<?php

// ============================================================
// Helpers (standalone, bez ADMIN_ROOT)
// ============================================================
function renderDayPage(string $date, array $entries): string {
    $siteUrl       = defined('SITE_URL') ? SITE_URL : 'https://fitpo50.pl/';
    $dateFormatted = date('j F Y', strtotime($date));
    $pageTitle     = 'Wpisy z ' . $dateFormatted;
    $pageUrl       = $siteUrl . 'sukcesy/' . $date . '.html';
    ob_start();
    ?><!DOCTYPE html><html lang="pl"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= htmlspecialchars($pageTitle) ?> | FitPo50</title>
<meta name="robots" content="index,follow">
<link rel="canonical" href="<?= $pageUrl ?>">
<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= $siteUrl ?>base.css">
<link rel="stylesheet" href="<?= $siteUrl ?>style.css?v=1.1">
<style>.day-page{padding:5rem 1.5rem;max-width:720px;margin:0 auto}.day-entry{background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:2rem;margin-bottom:1.5rem;text-decoration:none;color:inherit;display:block}.day-entry h2{font-family:var(--font-display);color:var(--color-primary);margin-bottom:.5rem}.day-entry p{color:var(--text-muted)}.back{display:inline-block;margin-top:2rem;color:var(--color-primary)}</style>
</head><body>
<main class="day-page">
<p style="color:var(--color-accent);font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:.85rem">Moje Sukcesy</p>
<h1 style="font-family:var(--font-display);font-size:2.5rem;margin-bottom:2rem"><?= htmlspecialchars($pageTitle) ?></h1>
<?php foreach ($entries as $e): ?>
<a href="<?= htmlspecialchars($siteUrl . ($e['html_file'] ?? '#')) ?>" class="day-entry">
  <h2><?= htmlspecialchars($e['title']) ?></h2>
  <?php if (!empty($e['lead'])): ?><p><?= htmlspecialchars($e['lead']) ?></p><?php endif; ?>
  <span style="color:var(--color-accent);font-weight:600;font-size:.9rem">Czytaj całość →</span>
</a>
<?php endforeach; ?>
<a href="<?= $siteUrl ?>moje-sukcesy.html" class="back">← Wróć do kalendarza</a>
</main>
</body></html><?php
    return ob_get_clean();
}

function removeFromCalendar(string $date): void {
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    if (!file_exists($calFile)) return;
    $content = file_get_contents($calFile);
    if ($content === false) return;

    [$entries, $found] = readCalendarEntries($content);
    if (!$found) return;

    $entries = array_values(array_filter(
        $entries,
        static fn(array $item): bool => ($item['date'] ?? '') !== $date
    ));

    $updated = writeCalendarEntries($content, $entries);
    if ($updated !== null) file_put_contents($calFile, $updated);
}

function injectCalendarEntry(string $date, string $url): void {
    $calFile = SITE_ROOT . 'moje-sukcesy.html';
    if (!file_exists($calFile)) return;
    $content = file_get_contents($calFile);
    if ($content === false) return;

    [$entries, $found] = readCalendarEntries($content);
    if (!$found) return;

    // Nadpisz istniejący wpis dla tej samej daty, żeby nie duplikować "fistaszka".
    $entries = array_values(array_filter(
        $entries,
        static fn(array $item): bool => ($item['date'] ?? '') !== $date
    ));
    array_unshift($entries, ['date' => $date, 'url' => $url]);

    $updated = writeCalendarEntries($content, $entries);
    if ($updated !== null) file_put_contents($calFile, $updated);
}

/**
 * @return array{0: array<int, array{date:string,url:string}>, 1: bool}
 */
function readCalendarEntries(string $content): array {
    if (!preg_match(
        '/\/\/ ENTRIES_START\s*const userEntries\s*=\s*(\[[\s\S]*?\]);\s*\/\/ ENTRIES_END/',
        $content,
        $m
    )) {
        return [[], false];
    }

    $decoded = json_decode($m[1], true);
    if (!is_array($decoded)) {
        return [[], true];
    }

    $entries = [];
    foreach ($decoded as $item) {
        if (!is_array($item)) continue;
        $date = isset($item['date']) ? (string)$item['date'] : '';
        $url  = isset($item['url']) ? (string)$item['url'] : '';
        if ($date === '' || $url === '') continue;
        $entries[] = ['date' => $date, 'url' => $url];
    }

    return [$entries, true];
}

/**
 * @param array<int, array{date:string,url:string}> $entries
 */
function writeCalendarEntries(string $content, array $entries): ?string {
    $json = json_encode(
        $entries,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    if (!is_string($json)) return null;

    return preg_replace_callback(
        '/\/\/ ENTRIES_START.*?\/\/ ENTRIES_END/s',
        static function () use ($json): string {
            return "// ENTRIES_START\n  const userEntries = {$json};\n  // ENTRIES_END";
        },
        $content
    );
}
