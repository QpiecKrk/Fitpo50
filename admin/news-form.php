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
    'sort_order' => 1,
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
$httpHost = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
$newsPreviewBase = strpos($httpHost, 'admin.') === 0
    ? 'https://fitpo50.pl/assets/news/'
    : '../assets/news/';
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
<link rel="stylesheet" href="assets/panel.css?v=20260416-4">
</head>
<body class="panel-body panel-body--news-form panel-body--has-mobile-nav">

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

            <div class="news-editor-layout">
              <aside class="news-editor-rail news-editor-toolbar" role="toolbar" aria-label="Formatowanie treści">
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-editor-action" data-format-open="<strong>" data-format-close="</strong>" data-active-check="strong" title="Pogrubienie"><strong>B</strong></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-editor-action" data-format-open="<strong class='news-text-strong-black'>" data-format-close="</strong>" data-active-check="class:news-text-strong-black" title="Czarny bold"><strong>B+</strong></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-editor-action" data-format-open="<em>" data-format-close="</em>" data-active-check="em" title="Kursywa"><em>I</em></button>

                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--1'>" data-format-close="</span>" data-active-check="class:news-text-tone--1" aria-label="Kolor 1" title="Kolor 1" style="--chip-color:#0B7285;background:#E6F6F8;border-color:#0B7285;"></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--2'>" data-format-close="</span>" data-active-check="class:news-text-tone--2" aria-label="Kolor 2" title="Kolor 2" style="--chip-color:#1D4ED8;background:#EAF1FF;border-color:#1D4ED8;"></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--3'>" data-format-close="</span>" data-active-check="class:news-text-tone--3" aria-label="Kolor 3" title="Kolor 3" style="--chip-color:#B45309;background:#FFF4E8;border-color:#B45309;"></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--4'>" data-format-close="</span>" data-active-check="class:news-text-tone--4" aria-label="Kolor 4" title="Kolor 4" style="--chip-color:#7C3AED;background:#F4EDFF;border-color:#7C3AED;"></button>
              </aside>

              <div class="news-editor-main">
                <div class="news-editor-toolbar news-editor-toolbar--links">
                  <select id="internal-link-select" class="form-input form-select">
                    <option value="">Wybierz link wewnętrzny...</option>
                    <?php foreach ($internalLinks as $link): ?>
                      <option value="<?= h($link['href']) ?>"><?= h($link['label']) ?></option>
                    <?php endforeach; ?>
                  </select>
                  <button type="button" class="btn-panel btn-panel--sm btn-panel--primary" id="insert-link-btn">Wstaw link</button>
                </div>

                <div class="news-editor-surface" style="background:#f8fbff;border:1px solid #cfe1ea;">
                  <div id="news-content-editor"
                       class="news-content-editor"
                       contenteditable="true"
                       spellcheck="true"
                       style="background:#ffffff;color:#102130;"
                       data-placeholder="Wpisz treść newsa i formatuj ją z paska nad edytorem."></div>
                </div>
              </div>
            </div>
            <div class="news-editor-mobile-bar" role="toolbar" aria-label="Szybkie formatowanie mobilne">
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-editor-action" data-format-open="<strong>" data-format-close="</strong>" data-active-check="strong" title="Pogrubienie"><strong>B</strong></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-editor-action" data-format-open="<strong class='news-text-strong-black'>" data-format-close="</strong>" data-active-check="class:news-text-strong-black" title="Czarny bold"><strong>B+</strong></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-editor-action" data-format-open="<em>" data-format-close="</em>" data-active-check="em" title="Kursywa"><em>I</em></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--1'>" data-format-close="</span>" data-active-check="class:news-text-tone--1" aria-label="Kolor 1" title="Kolor 1" style="--chip-color:#0B7285;background:#E6F6F8;border-color:#0B7285;"></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--2'>" data-format-close="</span>" data-active-check="class:news-text-tone--2" aria-label="Kolor 2" title="Kolor 2" style="--chip-color:#1D4ED8;background:#EAF1FF;border-color:#1D4ED8;"></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--3'>" data-format-close="</span>" data-active-check="class:news-text-tone--3" aria-label="Kolor 3" title="Kolor 3" style="--chip-color:#B45309;background:#FFF4E8;border-color:#B45309;"></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip news-editor-action" data-format-open="<span class='news-text-tone--4'>" data-format-close="</span>" data-active-check="class:news-text-tone--4" aria-label="Kolor 4" title="Kolor 4" style="--chip-color:#7C3AED;background:#F4EDFF;border-color:#7C3AED;"></button>
            </div>
            <input type="hidden" id="news-content" name="content" value="<?= h($item['content_html']) ?>">
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
          <div class="sidebar-card form-actions-desktop">
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
                  <source srcset="<?= h($newsPreviewBase . $item['image_base']) ?>.avif" type="image/avif">
                  <source srcset="<?= h($newsPreviewBase . $item['image_base']) ?>.webp" type="image/webp">
                  <img src="<?= h($newsPreviewBase . $item['image_base']) ?>.jpg" alt="<?= h($item['image_alt'] ?: $item['title']) ?>" width="320" height="240" loading="lazy">
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
      <div class="form-actions-mobile" data-form-actions-mobile>
        <button type="submit" class="btn-panel btn-panel--primary btn-full">💾 Zapisz news</button>
        <a href="news-dashboard.php" class="btn-panel btn-panel--outline btn-full">Anuluj</a>
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
  const editor = document.getElementById('news-content-editor');
  const toolbarButtons = document.querySelectorAll('[data-format-open]');
  const linkSelect = document.getElementById('internal-link-select');
  const insertLinkButton = document.getElementById('insert-link-btn');
  const addSourceButton = document.getElementById('add-source-btn');
  const sourcesList = document.getElementById('news-sources-list');
  const sourceTemplate = document.getElementById('news-source-template');
  let savedSelection = null;

  if (!textarea || !editor) return;

  editor.innerHTML = textarea.value.trim() !== '' ? textarea.value : '<p><br></p>';

  function syncTextareaFromEditor() {
    textarea.value = editor.innerHTML.trim();
  }

  function selectionWithinEditor(selection) {
    if (!selection || selection.rangeCount === 0) {
      return false;
    }
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer);
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (!selectionWithinEditor(selection)) {
      return;
    }
    savedSelection = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    if (!savedSelection) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(savedSelection);
    return true;
  }

  function rangeToHtml(range) {
    const temp = document.createElement('div');
    temp.appendChild(range.cloneContents());
    return temp.innerHTML;
  }

  function wrapSelection(openTag, closeTag) {
    editor.focus();
    if (!restoreSelection()) {
      rememberSelection();
    }

    const selection = window.getSelection();
    if (!selectionWithinEditor(selection)) {
      alert('Najpierw zaznacz słowo lub fragment tekstu.');
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      alert('Najpierw zaznacz słowo lub fragment tekstu.');
      return;
    }

    const selectedHtml = rangeToHtml(range);
    document.execCommand('insertHTML', false, openTag + selectedHtml + closeTag);
    syncTextareaFromEditor();
    rememberSelection();
    updateToolbarState();
  }

  function ensureEditorNotEmpty() {
    const plain = (editor.textContent || '').replace(/\u00a0/g, ' ').trim();
    return plain !== '';
  }

  document.addEventListener('selectionchange', rememberSelection);
  document.addEventListener('selectionchange', updateToolbarState);

  ['input', 'keyup', 'blur'].forEach((eventName) => {
    editor.addEventListener(eventName, () => {
      syncTextareaFromEditor();
      rememberSelection();
      updateToolbarState();
    });
  });

  editor.addEventListener('focus', () => {
    rememberSelection();
    updateToolbarState();
  });
  syncTextareaFromEditor();

  function getSelectionElement() {
    const selection = window.getSelection();
    if (!selectionWithinEditor(selection)) {
      return null;
    }

    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    return node instanceof Element ? node : null;
  }

  function matchesActiveCheck(element, check) {
    if (!element || !check) return false;
    if (check === 'strong') return !!element.closest('strong, b, .news-text-strong-black');
    if (check === 'em') return !!element.closest('em, i');
    if (check.startsWith('class:')) {
      const cls = check.slice('class:'.length).trim();
      return cls !== '' ? !!element.closest('.' + cls) : false;
    }
    return false;
  }

  function updateToolbarState() {
    const selectedEl = getSelectionElement();
    toolbarButtons.forEach((button) => {
      const check = button.getAttribute('data-active-check') || '';
      const active = selectedEl ? matchesActiveCheck(selectedEl, check) : false;
      button.classList.toggle('is-active', active);
    });
  }

  function bindToolbarAction(button) {
    const eventName = window.PointerEvent ? 'pointerdown' : ('ontouchstart' in window ? 'touchstart' : 'mousedown');
    const opts = eventName === 'touchstart' ? { passive: false } : false;

    button.addEventListener(eventName, (event) => {
      event.preventDefault();
      rememberSelection();
      wrapSelection(button.getAttribute('data-format-open') || '', button.getAttribute('data-format-close') || '');
    }, opts);

    button.addEventListener('click', (event) => {
      event.preventDefault();
    });
  }

  toolbarButtons.forEach((button) => {
    bindToolbarAction(button);
  });

  if (insertLinkButton) {
    const linkEventName = window.PointerEvent ? 'pointerdown' : ('ontouchstart' in window ? 'touchstart' : 'mousedown');
    const linkEventOpts = linkEventName === 'touchstart' ? { passive: false } : false;

    const applyInternalLink = (event) => {
      event.preventDefault();
      rememberSelection();
      if (!linkSelect || !linkSelect.value) {
        alert('Wybierz link wewnętrzny z listy.');
        return;
      }
      wrapSelection('<a href="' + linkSelect.value + '">', '</a>');
    };

    insertLinkButton.addEventListener(linkEventName, applyInternalLink, linkEventOpts);
    insertLinkButton.addEventListener('click', (event) => event.preventDefault());
  }

  const form = document.getElementById('news-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      syncTextareaFromEditor();
      if (!ensureEditorNotEmpty()) {
        event.preventDefault();
        alert('Treść newsa jest wymagana.');
        editor.focus();
      }
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

  updateToolbarState();
})();
</script>

<nav class="panel-mobile-nav" aria-label="Nawigacja panelu">
  <a href="dashboard.php" class="panel-mobile-nav__item">Wpisy</a>
  <a href="entry-form.php" class="panel-mobile-nav__item">Nowy</a>
  <a href="news-dashboard.php" class="panel-mobile-nav__item panel-mobile-nav__item--active">Newsy</a>
  <a href="logout.php" class="panel-mobile-nav__item panel-mobile-nav__item--logout">Wyloguj</a>
</nav>

</body>
</html>
