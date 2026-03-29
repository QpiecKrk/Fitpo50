<?php
// ============================================================
// Jednorazowy skrypt do generowania hasha hasła — KASUJE SIĘ PO UŻYCIU
// Uruchom RAZ: https://admin.fitpo50.pl/init-hash.php?token=setup2026fitpo50
// Skopiuj hash do config.php → plik zostanie automatycznie usunięty.
// ============================================================

$token = $_GET['token'] ?? '';
if ($token !== 'setup2026fitpo50') {
    http_response_code(403);
    die('403 Forbidden');
}

$password = '272Archawili';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
$verify = password_verify($password, $hash);

// Skasuj ten plik z serwera natychmiast po wygenerowaniu hasha
$selfDeleted = @unlink(__FILE__);
?>
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>Hash Generator</title>
<meta name="robots" content="noindex,nofollow">
<style>
  body{font-family:monospace;padding:2rem;background:#0f172a;color:#e2e8f0;}
  h2{color:#4ade80;}
  code{background:#1e293b;padding:1rem;display:block;border-radius:8px;word-break:break-all;color:#4ade80;margin:1rem 0;font-size:1.05rem;border:1px solid #334155;}
  .warn{color:#f59e0b;margin-top:1.5rem;padding:1rem;border:1px solid #f59e0b;border-radius:8px;}
  .ok{color:#4ade80;} .err{color:#f87171;}
</style>
</head>
<body>
<h2>✅ Hash bcrypt wygenerowany</h2>
<p>Hasło: <strong><?= htmlspecialchars($password) ?></strong></p>
<p>Hash (cost=12) — <strong>skopiuj do config.php jako PASSWORD_HASH:</strong></p>
<code><?= htmlspecialchars($hash) ?></code>
<p>Weryfikacja: <span class="<?= $verify ? 'ok' : 'err' ?>"><?= $verify ? '✅ password_verify() = TRUE' : '❌ ERROR — hash nieprawidłowy' ?></span></p>
<div class="warn">
  <?php if ($selfDeleted): ?>
    🗑️ <strong>Plik init-hash.php został automatycznie usunięty z serwera.</strong> Możesz zamknąć tę kartę.
  <?php else: ?>
    ⚠️ <strong>Nie udało się automatycznie usunąć pliku.</strong> Usuń <code>init-hash.php</code> ręcznie przez FTP lub menedżer plików Hostingera.
  <?php endif; ?>
</div>
</body>
</html>
