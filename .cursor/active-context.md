> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `admin/index.php` (Domain: **Generic Logic**)

### 📐 Generic Logic Conventions & Fixes
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
