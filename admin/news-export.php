<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers/news.php';
requireLogin();

$store = loadNewsStore();
exportNewsStoreAsDownload($store);
exit;
