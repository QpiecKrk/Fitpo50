<?php
// index.php — przekierowanie do panelu logowania
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
startSecureSession();

if (!empty($_SESSION['logged_in'])) {
    header('Location: dashboard.php');
} else {
    header('Location: login.php');
}
exit;
