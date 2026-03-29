<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
startSecureSession();

$error = '';
$timeout = isset($_GET['timeout']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    if (isRateLimited($ip)) {
        $error = 'Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za 15 minut.';
    } else {
        $password = $_POST['password'] ?? '';
        if (password_verify($password, PASSWORD_HASH)) {
            clearFailedLogins($ip);
            $_SESSION['logged_in']     = true;
            $_SESSION['last_activity'] = time();
            session_regenerate_id(true);
            header('Location: ' . ADMIN_URL . 'dashboard.php');
            exit;
        } else {
            recordFailedLogin($ip);
            $error = 'Nieprawidłowe hasło.';
            // Opóźnienie — utrudnia brute-force
            usleep(500000);
        }
    }
}

$csrf = csrfToken();
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Logowanie — Panel FitPo50</title>
<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/panel.css">
</head>
<body class="login-body">

<div class="login-wrap">
  <div class="login-card">
    <div class="login-logo">
      <img src="../assets/logo.jpg" alt="FitPo50" width="56" height="56">
    </div>
    <h1 class="login-title">Panel FitPo50</h1>
    <p class="login-subtitle">Redakcja wpisów</p>

    <?php if ($timeout): ?>
      <div class="alert alert--warn">⏱ Sesja wygasła z powodu bezczynności. Zaloguj się ponownie.</div>
    <?php endif; ?>

    <?php if ($error): ?>
      <div class="alert alert--error">⚠️ <?= h($error) ?></div>
    <?php endif; ?>

    <form method="POST" action="login.php" autocomplete="off" novalidate>
      <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">

      <div class="form-group">
        <label for="password" class="form-label">Hasło</label>
        <input
          type="password"
          id="password"
          name="password"
          class="form-input"
          autofocus
          required
          placeholder="••••••••••••"
        >
      </div>

      <button type="submit" class="btn-panel btn-panel--primary btn-full">
        Zaloguj się
      </button>
    </form>
  </div>
</div>

</body>
</html>
