<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers/news.php';
requireLogin();

$csrf = csrfToken();
$store = loadNewsStore();
$items = sortNewsItems($store['items'] ?? []);

$statusFilter = $_GET['status'] ?? 'all';
if (!in_array($statusFilter, ['all', 'published', 'draft'], true)) {
    $statusFilter = 'all';
}

$filtered = [];
$counts = ['published' => 0, 'draft' => 0];
foreach ($items as $rawItem) {
    $item = normalizeNewsItem($rawItem);
    if ($item['status'] === 'published') {
        $counts['published']++;
    } else {
        $counts['draft']++;
    }

    if ($statusFilter === 'all' || $item['status'] === $statusFilter) {
        $filtered[] = $item;
    }
}

$total = $counts['published'] + $counts['draft'];
$logoUrl = 'assets/logo.jpg?v=2';
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Newsy — Panel FitPo50</title>
<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/panel.css?v=20260416-6">
</head>
<body class="panel-body panel-body--news-dashboard">

<header class="panel-header">
  <div class="panel-header__inner">
    <div class="panel-header__brand">
      <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36"
           onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://fitpo50.pl/assets/logo.jpg';}">
      <span class="panel-header__title">Panel redakcyjny</span>
    </div>
    <nav class="panel-header__nav">
      <a href="dashboard.php" class="panel-nav-link">Wpisy</a>
      <a href="news-dashboard.php" class="panel-nav-link panel-nav-link--active">Newsy</a>
      <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
    </nav>
  </div>
</header>

<main class="panel-main">
  <div class="panel-container">

    <?php require __DIR__ . '/partials/flash.php'; ?>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-card__num"><?= $total ?></div>
        <div class="stat-card__label">Wszystkie newsy</div>
      </div>
      <div class="stat-card stat-card--published">
        <div class="stat-card__num"><?= $counts['published'] ?></div>
        <div class="stat-card__label">Opublikowane</div>
      </div>
      <div class="stat-card stat-card--draft">
        <div class="stat-card__num"><?= $counts['draft'] ?></div>
        <div class="stat-card__label">Robocze</div>
      </div>
    </div>

    <div class="panel-toolbar">
      <h2 class="panel-section-title">Newsy (Live + fallback)</h2>
      <div class="toolbar-actions">
        <div class="filter-tabs">
          <?php foreach (['all' => 'Wszystkie', 'published' => 'Opublikowane', 'draft' => 'Robocze'] as $key => $label): ?>
            <a href="?status=<?= h($key) ?>" class="filter-tab <?= $statusFilter === $key ? 'filter-tab--active' : '' ?>"><?= h($label) ?></a>
          <?php endforeach; ?>
        </div>
        <a href="news-form.php" class="btn-panel btn-panel--primary">+ Dodaj news</a>
      </div>
    </div>

    <?php if (empty($filtered)): ?>
      <div class="empty-state">
        <p>Brak newsów<?= $statusFilter !== 'all' ? ' o tym statusie' : '' ?>.</p>
        <a href="news-form.php" class="btn-panel btn-panel--primary">Dodaj pierwszy news</a>
      </div>
    <?php else: ?>
      <div class="entries-mobile-cards">
        <?php foreach ($filtered as $item): ?>
          <article class="entry-mobile-card">
            <div class="entry-mobile-card__head">
              <div class="entry-mobile-card__date">Kolejność: <?= (int)$item['sort_order'] ?></div>
              <span class="status-badge status-badge--<?= h($item['status']) ?>">
                <?= $item['status'] === 'published' ? '✅ Opublikowany' : '📝 Roboczy' ?>
              </span>
            </div>
            <h3 class="entry-mobile-card__title"><?= h($item['title']) ?></h3>
            <p class="entry-mobile-card__meta">Miniatura: <?= $item['image_base'] ? 'Tak' : 'Brak' ?> · Źródła: <?= count($item['sources']) ?></p>
            <p class="entry-mobile-card__meta">Aktualizacja: <?= h(substr($item['updated_at'], 0, 16)) ?></p>
            <div class="entry-mobile-card__actions">
              <a href="news-form.php?id=<?= h($item['id']) ?>" class="btn-panel btn-panel--sm btn-panel--outline">Edytuj</a>
              <form method="POST" action="actions/news-status.php">
                <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                <input type="hidden" name="id" value="<?= h($item['id']) ?>">
                <input type="hidden" name="status" value="<?= $item['status'] === 'published' ? 'draft' : 'published' ?>">
                <button type="submit" class="btn-panel btn-panel--sm <?= $item['status'] === 'published' ? 'btn-panel--warn' : 'btn-panel--success' ?>">
                  <?= $item['status'] === 'published' ? 'Cofnij publ.' : 'Opublikuj' ?>
                </button>
              </form>
              <form method="POST" action="actions/news-delete.php" onsubmit="return confirm('Usunąć ten news? Operacji nie można cofnąć.');">
                <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                <input type="hidden" name="id" value="<?= h($item['id']) ?>">
                <button type="submit" class="btn-panel btn-panel--sm btn-panel--danger">Usuń</button>
              </form>
            </div>
          </article>
        <?php endforeach; ?>
      </div>

      <div class="entries-table-wrap">
        <table class="entries-table">
          <thead>
            <tr>
              <th>Kolejność</th>
              <th>Tytuł</th>
              <th>Status</th>
              <th>Miniatura</th>
              <th>Źródła</th>
              <th>Aktualizacja</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($filtered as $item): ?>
              <tr>
                <td class="col-date"><?= (int)$item['sort_order'] ?></td>
                <td class="col-title"><strong><?= h($item['title']) ?></strong></td>
                <td>
                  <span class="status-badge status-badge--<?= h($item['status']) ?>">
                    <?= $item['status'] === 'published' ? '✅ Opublikowany' : '📝 Roboczy' ?>
                  </span>
                </td>
                <td class="col-file"><?= $item['image_base'] ? 'Tak' : 'Brak' ?></td>
                <td class="col-file"><?= count($item['sources']) ?></td>
                <td class="col-date"><?= h(substr($item['updated_at'], 0, 16)) ?></td>
                <td class="col-actions">
                  <a href="news-form.php?id=<?= h($item['id']) ?>" class="btn-panel btn-panel--sm btn-panel--outline">Edytuj</a>
                  <form method="POST" action="actions/news-status.php" style="display:inline;">
                    <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                    <input type="hidden" name="id" value="<?= h($item['id']) ?>">
                    <input type="hidden" name="status" value="<?= $item['status'] === 'published' ? 'draft' : 'published' ?>">
                    <button type="submit" class="btn-panel btn-panel--sm <?= $item['status'] === 'published' ? 'btn-panel--warn' : 'btn-panel--success' ?>">
                      <?= $item['status'] === 'published' ? 'Cofnij publ.' : 'Opublikuj' ?>
                    </button>
                  </form>
                  <form method="POST" action="actions/news-delete.php" style="display:inline;" onsubmit="return confirm('Usunąć ten news? Operacji nie można cofnąć.');">
                    <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                    <input type="hidden" name="id" value="<?= h($item['id']) ?>">
                    <button type="submit" class="btn-panel btn-panel--sm btn-panel--danger">Usuń</button>
                  </form>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>

  </div>
</main>

</body>
</html>
