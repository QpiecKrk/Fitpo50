<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers/news.php';
requireLogin();

$csrf = csrfToken();
$store = loadNewsStore();
$internalLinks = getInternalArticleOptions();

$editMode = false;
$item = [
    'id' => '',
    'title' => '',
    'content_html' => '',
    'status' => 'draft',
    'sort_order' => 9999,
    'image_base' => '',
    'image_alt' => '',
    'sources' => [],
    'created_at' => date('c'),
    'updated_at' => date('c'),
    'published_at' => '',
];

if (!empty($_GET['id'])) {
    $existing = findNewsItemById($store, (string)$_GET['id']);
    if ($existing) {
        $item = $existing;
        $editMode = true;
    }
}

$logoUrl = 'assets/logo.jpg?v=2';
$pageTitle = $editMode ? 'Edytuj news' : 'Dodaj news';
$sources = $item['sources'];
if (empty($sources)) {
    $sources = [['label' => '', 'url' => '']];
}
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?= h($pageTitle) ?> — Panel FitPo50</title>
<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/panel.css">
</head>
<body class="panel-body">

<header class="panel-header">
  <div class="panel-header__inner">
    <div class="panel-header__brand">
      <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36"
           onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://fitpo50.pl/assets/logo.jpg';}">
      <span class="panel-header__title">Panel redakcyjny</span>
    </div>
    <nav class="panel-header__nav">
      <a href="dashboard.php" class="panel-nav-link">Wpisy</a>
      <a href="entry-form.php" class="panel-nav-link">Nowy wpis</a>
      <a href="news-dashboard.php" class="panel-nav-link panel-nav-link--active">Newsy</a>
      <a href="../moje-sukcesy.html" target="_blank" rel="noopener noreferrer" class="panel-nav-link">Moje Sukcesy ↗</a>
      <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
    </nav>
  </div>
</header>

<main class="panel-main">
  <div class="panel-container">

    <?php require __DIR__ . '/partials/flash.php'; ?>

    <div class="page-heading">
      <h2 class="panel-section-title"><?= h($pageTitle) ?></h2>
      <a href="news-dashboard.php" class="btn-panel btn-panel--outline btn-panel--sm">← Wróć do listy</a>
    </div>

    <form method="POST" action="actions/news-save.php" enctype="multipart/form-data" id="news-form">
      <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
      <input type="hidden" name="id" value="<?= h($item['id']) ?>">

      <div class="form-grid">
        <div class="form-main">
          <div class="form-group">
            <label for="title" class="form-label">Tytuł <span class="required">*</span></label>
            <input type="text" id="title" name="title" class="form-input" required value="<?= h($item['title']) ?>" placeholder="np. Zimne kąpiele po treningu mogą hamować efekty">
          </div>

          <div class="form-group">
            <label for="news-content" class="form-label">Treść newsa <span class="required">*</span></label>

            <div class="news-editor-toolbar" role="toolbar" aria-label="Formatowanie treści">
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline" data-wrap-open="<strong>" data-wrap-close="</strong>"><strong>B</strong></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline" data-wrap-open="<em>" data-wrap-close="</em>"><em>I</em></button>

              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline" data-wrap-open="<span class=\"news-text-tone--1\">" data-wrap-close="</span>" style="color:#0B7285;">Kolor 1</button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline" data-wrap-open="<span class=\"news-text-tone--2\">" data-wrap-close="</span>" style="color:#1D4ED8;">Kolor 2</button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline" data-wrap-open="<span class=\"news-text-tone--3\">" data-wrap-close="</span>" style="color:#B45309;">Kolor 3</button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline" data-wrap-open="<span class=\"news-text-tone--4\">" data-wrap-close="</span>" style="color:#7C3AED;">Kolor 4</button>
            </div>

            <div class="news-editor-toolbar" style="margin-top:0.5rem;">
              <select id="internal-link-select" class="form-input form-select" style="max-width: 420px;">
                <option value="">Wybierz link wewnętrzny...</option>
                <?php foreach ($internalLinks as $link): ?>
                  <option value="<?= h($link['href']) ?>"><?= h($link['label']) ?></option>
                <?php endforeach; ?>
              </select>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--primary" id="insert-link-btn">Wstaw link</button>
            </div>

            <textarea id="news-content" name="content" class="form-input form-textarea form-textarea--lg" required placeholder="Wklej treść newsa. Możesz używać prostego tekstu, list i formatowania z paska."><?= h($item['content_html']) ?></textarea>
            <p class="form-hint">Kliknij w zaznaczone słowo, aby dodać <strong>bold</strong>, <em>italic</em>, kolor lub link wewnętrzny. Zewnętrzne linki dodawaj wyłącznie w sekcji źródeł.</p>
          </div>

          <div class="form-group">
            <label class="form-label">Źródła <span class="form-hint">(opcjonalne, ale obowiązkowe przy liczbach/claimach)</span></label>
            <div id="news-sources-list" class="news-sources-list">
              <?php foreach ($sources as $source): ?>
                <div class="news-source-row">
                  <input type="text" name="source_label[]" class="form-input" placeholder="Nazwa źródła" value="<?= h($source['label']) ?>">
                  <input type="url" name="source_url[]" class="form-input" placeholder="https://..." value="<?= h($source['url']) ?>">
                  <button type="button" class="btn-panel btn-panel--sm btn-panel--danger" data-remove-source>Usuń</button>
                </div>
              <?php endforeach; ?>
            </div>
            <button type="button" id="add-source-btn" class="btn-panel btn-panel--sm btn-panel--outline" style="margin-top:0.6rem;">+ Dodaj źródło</button>
          </div>
        </div>

        <div class="form-sidebar">
          <div class="sidebar-card">
            <h3 class="sidebar-card__title">Publikacja</h3>
            <div class="form-group">
              <label for="status" class="form-label">Status</label>
              <select id="status" name="status" class="form-input form-select">
                <option value="draft" <?= $item['status'] === 'draft' ? 'selected' : '' ?>>📝 Roboczy</option>
                <option value="published" <?= $item['status'] === 'published' ? 'selected' : '' ?>>✅ Opublikowany</option>
              </select>
              <p class="form-hint">Po statusie <strong>Opublikowany</strong> news pojawia się od razu na stronie.</p>
            </div>

            <div class="form-group">
              <label for="sort-order" class="form-label">Kolejność</label>
              <input type="number" min="1" max="9999" step="1" id="sort-order" name="sort_order" class="form-input" value="<?= (int)$item['sort_order'] ?>">
              <p class="form-hint">Mniejsza liczba = wyżej na liście.</p>
            </div>

            <div class="btn-stack">
              <button type="submit" class="btn-panel btn-panel--primary btn-full">💾 Zapisz news</button>
              <a href="news-dashboard.php" class="btn-panel btn-panel--outline btn-full">Anuluj</a>
            </div>
          </div>

          <div class="sidebar-card">
            <h3 class="sidebar-card__title">Miniatura</h3>
            <?php if (!empty($item['image_base'])): ?>
              <div class="news-image-preview">
                <picture>
                  <source srcset="../assets/news/<?= h($item['image_base']) ?>.avif" type="image/avif">
                  <source srcset="../assets/news/<?= h($item['image_base']) ?>.webp" type="image/webp">
                  <img src="../assets/news/<?= h($item['image_base']) ?>.jpg" alt="<?= h($item['image_alt'] ?: $item['title']) ?>" width="320" height="240" loading="lazy">
                </picture>
              </div>
              <label class="media-item__delete" style="margin:0.6rem 0 0.8rem;">
                <input type="checkbox" name="delete_image" value="1"> Usuń obecną miniaturę
              </label>
            <?php endif; ?>

            <div class="form-group">
              <label for="news-image" class="form-label">Nowa miniatura</label>
              <input type="file" id="news-image" name="news_image" class="form-input" accept="image/jpeg,image/png,image/webp,image/avif">
              <p class="form-hint">Po zapisie obraz będzie automatycznie zmniejszony i skonwertowany. Jeśli konwersja nie powiedzie się, zapis zostanie zablokowany.</p>
            </div>

            <div class="form-group">
              <label for="image-alt" class="form-label">Alt miniatury</label>
              <input type="text" id="image-alt" name="image_alt" class="form-input" value="<?= h($item['image_alt']) ?>" placeholder="Opis miniatury (opcjonalny)">
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</main>

<template id="news-source-template">
  <div class="news-source-row">
    <input type="text" name="source_label[]" class="form-input" placeholder="Nazwa źródła">
    <input type="url" name="source_url[]" class="form-input" placeholder="https://...">
    <button type="button" class="btn-panel btn-panel--sm btn-panel--danger" data-remove-source>Usuń</button>
  </div>
</template>

<script>
(function () {
  const textarea = document.getElementById('news-content');
  const toolbarButtons = document.querySelectorAll('[data-wrap-open]');
  const linkSelect = document.getElementById('internal-link-select');
  const insertLinkButton = document.getElementById('insert-link-btn');
  const addSourceButton = document.getElementById('add-source-btn');
  const sourcesList = document.getElementById('news-sources-list');
  const sourceTemplate = document.getElementById('news-source-template');

  function wrapSelection(openTag, closeTag) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      alert('Najpierw zaznacz słowo lub fragment tekstu.');
      return;
    }

    const value = textarea.value;
    const selected = value.slice(start, end);
    const nextValue = value.slice(0, start) + openTag + selected + closeTag + value.slice(end);
    textarea.value = nextValue;
    textarea.focus();

    const cursorStart = start + openTag.length;
    const cursorEnd = cursorStart + selected.length;
    textarea.setSelectionRange(cursorStart, cursorEnd);
  }

  toolbarButtons.forEach((button) => {
    button.addEventListener('click', () => {
      wrapSelection(button.getAttribute('data-wrap-open') || '', button.getAttribute('data-wrap-close') || '');
    });
  });

  if (insertLinkButton) {
    insertLinkButton.addEventListener('click', () => {
      if (!linkSelect || !linkSelect.value) {
        alert('Wybierz link wewnętrzny z listy.');
        return;
      }
      const href = linkSelect.value;
      wrapSelection('<a href="' + href + '">', '</a>');
    });
  }

  function bindSourceRemoveButton(scope) {
    scope.querySelectorAll('[data-remove-source]').forEach((button) => {
      button.addEventListener('click', () => {
        const rows = sourcesList.querySelectorAll('.news-source-row');
        if (rows.length <= 1) {
          const inputs = rows[0].querySelectorAll('input');
          inputs.forEach((input) => input.value = '');
          return;
        }
        button.closest('.news-source-row')?.remove();
      });
    });
  }

  bindSourceRemoveButton(document);

  if (addSourceButton) {
    addSourceButton.addEventListener('click', () => {
      if (!sourceTemplate || !sourcesList) return;
      const clone = sourceTemplate.content.cloneNode(true);
      sourcesList.appendChild(clone);
      bindSourceRemoveButton(sourcesList);
    });
  }
})();
</script>

</body>
</html>
