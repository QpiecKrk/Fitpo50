<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
requireLogin();

$db = getDb();
$csrf = csrfToken();
$logoUrl = 'assets/logo.jpg?v=2';

// Filtrowanie i sortowanie
$status_filter = $_GET['status'] ?? 'all';
$where = $status_filter !== 'all' ? "WHERE status = ?" : '';
$params = $status_filter !== 'all' ? [$status_filter] : [];

$stmt = $db->prepare("SELECT * FROM entries $where ORDER BY
    CASE
      WHEN status = 'draft' THEN 0
      WHEN status = 'hidden' THEN 1
      ELSE 2
    END,
    entry_date DESC,
    updated_at DESC,
    created_at DESC");
$stmt->execute($params);
$entries = $stmt->fetchAll();

// Liczniki
$counts = $db->query("SELECT status, COUNT(*) as cnt FROM entries GROUP BY status")->fetchAll();
$cnt = ['draft' => 0, 'published' => 0, 'hidden' => 0];
foreach ($counts as $c) $cnt[$c['status']] = $c['cnt'];
$total = array_sum($cnt);
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Dashboard — Panel FitPo50</title>
<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/panel.css?v=20260416-6">
</head>
<body class="panel-body panel-body--dashboard">

<header class="panel-header">
  <div class="panel-header__inner">
    <div class="panel-header__brand">
      <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36"
           onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://fitpo50.pl/assets/logo.jpg';}">
      <span class="panel-header__title">Panel redakcyjny</span>
    </div>
    <nav class="panel-header__nav">
      <a href="dashboard.php" class="panel-nav-link panel-nav-link--active">Wpisy</a>
      <a href="news-dashboard.php" class="panel-nav-link">Newsy</a>
      <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
    </nav>
  </div>
</header>

<main class="panel-main">
  <div class="panel-container">

    <?php require __DIR__ . '/partials/flash.php'; ?>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-card__num"><?= $total ?></div>
        <div class="stat-card__label">Wszystkie</div>
      </div>
      <div class="stat-card stat-card--published">
        <div class="stat-card__num"><?= $cnt['published'] ?></div>
        <div class="stat-card__label">Opublikowane</div>
      </div>
      <div class="stat-card stat-card--draft">
        <div class="stat-card__num"><?= $cnt['draft'] ?></div>
        <div class="stat-card__label">Robocze</div>
      </div>
      <div class="stat-card stat-card--hidden">
        <div class="stat-card__num"><?= $cnt['hidden'] ?></div>
        <div class="stat-card__label">Ukryte</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="panel-toolbar">
      <h2 class="panel-section-title">Wpisy</h2>
      <div class="toolbar-actions">
        <div class="filter-tabs">
          <?php foreach (['all'=>'Wszystkie','published'=>'Opublikowane','draft'=>'Robocze','hidden'=>'Ukryte'] as $k=>$v): ?>
            <a href="?status=<?= $k ?>" class="filter-tab <?= $status_filter===$k ? 'filter-tab--active' : '' ?>"><?= $v ?></a>
          <?php endforeach; ?>
        </div>
        <a href="entry-form.php" class="btn-panel btn-panel--primary">+ Nowy wpis</a>
      </div>
    </div>

    <!-- Entries table -->
    <?php if (empty($entries)): ?>
      <div class="empty-state">
        <p>Brak wpisów<?= $status_filter !== 'all' ? ' o tym statusie' : '' ?>.</p>
        <a href="entry-form.php" class="btn-panel btn-panel--primary">Dodaj pierwszy wpis</a>
      </div>
    <?php else: ?>
      <div class="entries-mobile-cards">
        <?php foreach ($entries as $idx => $e): ?>
          <article class="entry-mobile-card js-batch-item" data-batch-index="<?= $idx ?>">
            <div class="entry-mobile-card__head">
              <div class="entry-mobile-card__date"><?= h($e['entry_date']) ?></div>
              <span class="status-badge status-badge--<?= h($e['status']) ?>">
                <?php echo match($e['status']) {
                  'published' => '✅ Opublikowany',
                  'draft'     => '📝 Roboczy',
                  'hidden'    => '🙈 Ukryty',
                  default     => h($e['status']),
                }; ?>
              </span>
            </div>
            <h3 class="entry-mobile-card__title"><?= h($e['title']) ?></h3>
            <?php if ($e['lead']): ?>
              <p class="entry-mobile-card__lead"><?= h(mb_substr($e['lead'], 0, 120)) ?><?= mb_strlen($e['lead']) > 120 ? '…' : '' ?></p>
            <?php endif; ?>
            <?php if ($e['html_file']): ?>
              <a href="<?= SITE_URL . h($e['html_file']) ?>" target="_blank" rel="noopener noreferrer" class="link-small">
                <?= h($e['html_file']) ?> ↗
              </a>
            <?php endif; ?>
            <div class="entry-mobile-card__actions">
              <a href="entry-form.php?id=<?= $e['id'] ?>" class="btn-panel btn-panel--sm btn-panel--outline">Edytuj</a>
              <?php if ($e['status'] !== 'published'): ?>
                <form method="POST" action="actions/publish.php">
                  <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                  <input type="hidden" name="id" value="<?= $e['id'] ?>">
                  <button type="submit" class="btn-panel btn-panel--sm btn-panel--success">Opublikuj</button>
                </form>
              <?php else: ?>
                <form method="POST" action="actions/unpublish.php">
                  <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                  <input type="hidden" name="id" value="<?= $e['id'] ?>">
                  <button type="submit" class="btn-panel btn-panel--sm btn-panel--warn">Cofnij publ.</button>
                </form>
              <?php endif; ?>
              <form method="POST" action="actions/delete.php"
                    onsubmit="return confirm('Usunąć wpis „<?= addslashes(h($e['title'])) ?>”? Tej operacji nie można cofnąć.')">
                <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                <input type="hidden" name="id" value="<?= $e['id'] ?>">
                <button type="submit" class="btn-panel btn-panel--sm btn-panel--danger">Usuń</button>
              </form>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
      <div class="entries-batch-controls js-batch-controls" data-batch-target=".entries-mobile-cards .js-batch-item" data-batch-size="10">
        <button type="button" class="btn-panel btn-panel--outline btn-panel--sm" data-batch-more>Pokaż kolejne 10</button>
        <span class="entries-batch-status" data-batch-status></span>
      </div>

      <div class="entries-table-wrap">
        <table class="entries-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tytuł</th>
              <th>Status</th>
              <th>Plik HTML</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($entries as $idx => $e): ?>
            <tr class="js-batch-item" data-batch-index="<?= $idx ?>">
              <td class="col-date"><?= h($e['entry_date']) ?></td>
              <td class="col-title">
                <strong><?= h($e['title']) ?></strong>
                <?php if ($e['lead']): ?>
                  <br><small class="text-muted"><?= h(mb_substr($e['lead'], 0, 80)) ?>…</small>
                <?php endif; ?>
              </td>
              <td>
                <span class="status-badge status-badge--<?= h($e['status']) ?>">
                  <?php echo match($e['status']) {
                    'published' => '✅ Opublikowany',
                    'draft'     => '📝 Roboczy',
                    'hidden'    => '🙈 Ukryty',
                    default     => h($e['status']),
                  }; ?>
                </span>
              </td>
              <td class="col-file">
                <?php if ($e['html_file']): ?>
                  <a href="<?= SITE_URL . h($e['html_file']) ?>" target="_blank" rel="noopener noreferrer" class="link-small">
                    <?= h($e['html_file']) ?> ↗
                  </a>
                <?php else: ?>
                  <span class="text-muted">—</span>
                <?php endif; ?>
              </td>
              <td class="col-actions">
                <a href="entry-form.php?id=<?= $e['id'] ?>" class="btn-panel btn-panel--sm btn-panel--outline">Edytuj</a>
                <?php if ($e['status'] !== 'published'): ?>
                  <form method="POST" action="actions/publish.php" style="display:inline;">
                    <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                    <input type="hidden" name="id" value="<?= $e['id'] ?>">
                    <button type="submit" class="btn-panel btn-panel--sm btn-panel--success">Opublikuj</button>
                  </form>
                <?php else: ?>
                  <form method="POST" action="actions/unpublish.php" style="display:inline;">
                    <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                    <input type="hidden" name="id" value="<?= $e['id'] ?>">
                    <button type="submit" class="btn-panel btn-panel--sm btn-panel--warn">Cofnij publ.</button>
                  </form>
                <?php endif; ?>
                <form method="POST" action="actions/delete.php" style="display:inline;"
                      onsubmit="return confirm('Usunąć wpis „<?= addslashes(h($e['title'])) ?>”? Tej operacji nie można cofnąć.')">
                  <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
                  <input type="hidden" name="id" value="<?= $e['id'] ?>">
                  <button type="submit" class="btn-panel btn-panel--sm btn-panel--danger">Usuń</button>
                </form>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <div class="entries-batch-controls js-batch-controls" data-batch-target=".entries-table tbody .js-batch-item" data-batch-size="10">
        <button type="button" class="btn-panel btn-panel--outline btn-panel--sm" data-batch-more>Pokaż kolejne 10</button>
        <span class="entries-batch-status" data-batch-status></span>
      </div>
    <?php endif; ?>

  </div>
</main>

<script>
  (function () {
    const controls = document.querySelectorAll('.js-batch-controls');
    if (!controls.length) return;

    controls.forEach((control) => {
      const targetSelector = control.getAttribute('data-batch-target');
      const step = Number(control.getAttribute('data-batch-size')) || 10;
      const button = control.querySelector('[data-batch-more]');
      const status = control.querySelector('[data-batch-status]');
      if (!targetSelector || !button || !status) return;

      const items = Array.from(document.querySelectorAll(targetSelector));
      if (items.length <= step) {
        control.hidden = true;
        return;
      }

      let visible = step;

      function update() {
        items.forEach((item, index) => {
          item.hidden = index >= visible;
        });

        const visibleNow = Math.min(visible, items.length);
        const left = Math.max(items.length - visibleNow, 0);

        status.textContent = `Pokazano ${visibleNow} z ${items.length}`;
        if (left <= 0) {
          control.hidden = true;
          return;
        }

        button.textContent = `Pokaż kolejne ${Math.min(step, left)}`;
      }

      button.addEventListener('click', () => {
        visible = Math.min(visible + step, items.length);
        update();
      });

      update();
    });
  })();
</script>

</body>
</html>
