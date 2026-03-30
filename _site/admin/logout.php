<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
requireLogin();

session_unset();
session_destroy();
header('Location: ' . ADMIN_URL . 'login.php');
exit;
