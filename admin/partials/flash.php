<?php
// partials/flash.php — wyświetla flash messages z sesji
// Dołącz przez: require __DIR__ . '/../partials/flash.php';
if (!empty($_SESSION['flash_success'])) { ?>
  <div class="alert alert--success"><?= htmlspecialchars($_SESSION['flash_success']) ?></div>
  <?php unset($_SESSION['flash_success']);
}
if (!empty($_SESSION['flash_error'])) { ?>
  <div class="alert alert--error"><?= htmlspecialchars($_SESSION['flash_error']) ?></div>
  <?php unset($_SESSION['flash_error']);
}
