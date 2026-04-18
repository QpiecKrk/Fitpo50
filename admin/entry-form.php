<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers/news.php';
requireLogin();

$db = getDb();
$csrf = csrfToken();

// Tryb edycji istniejącego wpisu
$entry = null;
$media = [];
$editMode = false;

if (isset($_GET['id'])) {
    $stmt = $db->prepare('SELECT * FROM entries WHERE id = ?');
    $stmt->execute([(int)$_GET['id']]);
    $entry = $stmt->fetch();
    if (!$entry) {
        header('Location: dashboard.php');
        exit;
    }
    $editMode = true;
    $mediaStmt = $db->prepare('SELECT * FROM media WHERE entry_id = ? ORDER BY sort_order, id');
    $mediaStmt->execute([$entry['id']]);
    $media = $mediaStmt->fetchAll();
}

$pageTitle = $editMode ? 'Edytuj wpis' : 'Nowy wpis';
$logoUrl = 'assets/logo.jpg?v=2';
$today = date('Y-m-d');
$videoSourceValue = $entry['video_source'] ?? 'none';
if (!in_array($videoSourceValue, ['none', 'youtube', 'upload'], true)) {
    $videoSourceValue = 'none';
}
$youtubeVideoId = $entry['youtube_video_id'] ?? '';
$youtubeUrlValue = $youtubeVideoId ? ('https://www.youtube.com/watch?v=' . $youtubeVideoId) : '';
$youtubeOrientationValue = ($entry['youtube_orientation'] ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
$uploadedVideoFilename = $entry['uploaded_video_filename'] ?? '';
$uploadedVideoMime = $entry['uploaded_video_mime'] ?? '';
$uploadedVideoOrientationValue = ($entry['uploaded_video_orientation'] ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
$internalLinks = getInternalArticleOptions();
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
<link rel="stylesheet" href="assets/panel.css?v=20260416-6">
</head>
<body class="panel-body panel-body--entry-form">

<header class="panel-header">
  <div class="panel-header__inner">
    <div class="panel-header__brand">
      <img src="<?= h($logoUrl) ?>" alt="FitPo50" width="36" height="36"
           onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://fitpo50.pl/assets/logo.jpg';}">
      <span class="panel-header__title">Panel redakcyjny</span>
    </div>
    <nav class="panel-header__nav">
      <a href="dashboard.php" class="panel-nav-link">Wpisy</a>
      <a href="news-dashboard.php" class="panel-nav-link">Newsy</a>
      <a href="logout.php" class="panel-nav-link panel-nav-link--logout">Wyloguj</a>
    </nav>
  </div>
</header>

<main class="panel-main">
  <div class="panel-container">

    <?php require __DIR__ . '/partials/flash.php'; ?>

    <div class="page-heading">
      <h2 class="panel-section-title"><?= h($pageTitle) ?></h2>
      <?php if ($editMode && $entry['status'] === 'published' && $entry['html_file']): ?>
        <a href="<?= SITE_URL . h($entry['html_file']) ?>" target="_blank" rel="noopener noreferrer" class="btn-panel btn-panel--outline btn-panel--sm">
          Podejrzyj na stronie ↗
        </a>
      <?php endif; ?>
    </div>

    <form method="POST" action="actions/save.php" enctype="multipart/form-data" id="entry-form" novalidate>
      <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
      <?php if ($editMode): ?>
        <input type="hidden" name="id" value="<?= $entry['id'] ?>">
      <?php endif; ?>

      <div class="form-grid">

        <!-- Lewa kolumna: pola główne -->
        <div class="form-main">

          <div class="form-group">
            <label for="title" class="form-label">Tytuł <span class="required">*</span></label>
            <input type="text" id="title" name="title" class="form-input"
              value="<?= h($entry['title'] ?? '') ?>" required
              placeholder="np. Mój pierwszy tydzień na siłowni">
          </div>

          <div class="form-group">
            <label for="lead" class="form-label">Lead <span class="form-hint">(opcjonalny — skrót treści)</span></label>
            <textarea id="lead" name="lead" class="form-input form-textarea form-textarea--sm"
              placeholder="Krótki wstęp (1-2 zdania), który pojawi się w kalendarzu pod fistaszkiem."><?= h($entry['lead'] ?? '') ?></textarea>
          </div>

          <div class="form-group">
            <label for="content" class="form-label">Treść główna <span class="required">*</span></label>
            <div class="entry-editor-layout">
              <aside class="entry-editor-rail news-editor-toolbar" role="toolbar" aria-label="Formatowanie wpisu">
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline entry-editor-action" data-format-open="<strong>" data-format-close="</strong>" data-active-check="strong" title="Pogrubienie"><strong>B</strong></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline entry-editor-action" data-format-open="<strong class='news-text-strong-black'>" data-format-close="</strong>" data-active-check="class:news-text-strong-black" title="Czarny bold"><strong>B+</strong></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline entry-editor-action" data-format-open="<em>" data-format-close="</em>" data-active-check="em" title="Kursywa"><em>I</em></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--1'>" data-format-close="</span>" data-active-check="class:news-text-tone--1" aria-label="Kolor 1" title="Kolor 1" style="--chip-color:#0B7285;background:#E6F6F8;border-color:#0B7285;"></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--2'>" data-format-close="</span>" data-active-check="class:news-text-tone--2" aria-label="Kolor 2" title="Kolor 2" style="--chip-color:#1D4ED8;background:#EAF1FF;border-color:#1D4ED8;"></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--3'>" data-format-close="</span>" data-active-check="class:news-text-tone--3" aria-label="Kolor 3" title="Kolor 3" style="--chip-color:#B45309;background:#FFF4E8;border-color:#B45309;"></button>
                <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--4'>" data-format-close="</span>" data-active-check="class:news-text-tone--4" aria-label="Kolor 4" title="Kolor 4" style="--chip-color:#7C3AED;background:#F4EDFF;border-color:#7C3AED;"></button>
              </aside>

              <div class="entry-editor-main">
                <div class="news-editor-toolbar news-editor-toolbar--links">
                  <select id="entry-internal-link-select" class="form-input form-select">
                    <option value="">Wybierz link wewnętrzny...</option>
                    <?php foreach ($internalLinks as $link): ?>
                      <option value="<?= h($link['href']) ?>"><?= h($link['label']) ?></option>
                    <?php endforeach; ?>
                  </select>
                  <input type="text" id="entry-link-url" class="form-input" inputmode="url" autocomplete="off" placeholder="Wklej link (https://... lub /sciezka.html)">
                  <button type="button" class="btn-panel btn-panel--sm btn-panel--primary" id="entry-insert-link-btn">Wstaw link</button>
                </div>

                <div class="news-editor-surface">
                  <div id="entry-content-editor"
                       class="news-content-editor"
                       contenteditable="true"
                       spellcheck="true"
                       data-placeholder="Wpisz treść wpisu i formatuj ją szybko z paska po lewej lub na dole telefonu."></div>
                </div>
              </div>
            </div>
            <div class="news-editor-mobile-bar" role="toolbar" aria-label="Szybkie formatowanie mobilne">
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline entry-editor-action" data-format-open="<strong>" data-format-close="</strong>" data-active-check="strong" title="Pogrubienie"><strong>B</strong></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline entry-editor-action" data-format-open="<strong class='news-text-strong-black'>" data-format-close="</strong>" data-active-check="class:news-text-strong-black" title="Czarny bold"><strong>B+</strong></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline entry-editor-action" data-format-open="<em>" data-format-close="</em>" data-active-check="em" title="Kursywa"><em>I</em></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--1'>" data-format-close="</span>" data-active-check="class:news-text-tone--1" aria-label="Kolor 1" title="Kolor 1" style="--chip-color:#0B7285;background:#E6F6F8;border-color:#0B7285;"></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--2'>" data-format-close="</span>" data-active-check="class:news-text-tone--2" aria-label="Kolor 2" title="Kolor 2" style="--chip-color:#1D4ED8;background:#EAF1FF;border-color:#1D4ED8;"></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--3'>" data-format-close="</span>" data-active-check="class:news-text-tone--3" aria-label="Kolor 3" title="Kolor 3" style="--chip-color:#B45309;background:#FFF4E8;border-color:#B45309;"></button>
              <button type="button" class="btn-panel btn-panel--sm btn-panel--outline news-color-chip entry-editor-action" data-format-open="<span class='news-text-tone--4'>" data-format-close="</span>" data-active-check="class:news-text-tone--4" aria-label="Kolor 4" title="Kolor 4" style="--chip-color:#7C3AED;background:#F4EDFF;border-color:#7C3AED;"></button>
            </div>
            <textarea id="content" name="content" class="entry-content-input-hidden" hidden><?= h($entry['content'] ?? '') ?></textarea>
          </div>

          <!-- Upload mediów -->
          <div class="form-group">
            <label class="form-label">Multimedia</label>
            <?php if (!empty($media)): ?>
              <div class="media-grid" id="media-grid">
                <?php foreach ($media as $m): ?>
                  <div class="media-item" data-id="<?= $m['id'] ?>">
                    <?php if (str_starts_with($m['mime_type'] ?? '', 'image/')): ?>
                      <img src="<?= ADMIN_URL ?>uploads/<?= h($m['filename']) ?>"
                           alt="<?= h($m['original_name'] ?? '') ?>" class="media-thumb">
                    <?php else: ?>
                      <div class="media-file-icon">📎</div>
                    <?php endif; ?>
                    <div class="media-item__name"><?= h($m['original_name'] ?? $m['filename']) ?></div>
                    <label class="media-item__delete">
                      <input type="checkbox" name="delete_media[]" value="<?= $m['id'] ?>"> Usuń
                    </label>
                  </div>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>
            <div class="upload-zone" id="upload-zone">
              <input type="file" id="media_files" name="media_files[]"
                     accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                     multiple class="upload-input">
              <label for="media_files" class="upload-label">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Kliknij lub przeciągnij pliki</span>
                <small>JPG, PNG, WebP, AVIF — max 10 MB/plik</small>
              </label>
              <div id="upload-preview" class="upload-preview"></div>
            </div>
          </div>

        </div>

        <!-- Prawa kolumna: meta -->
        <div class="form-sidebar">

          <!-- Akcje -->
          <div class="sidebar-card form-actions-desktop">
            <h3 class="sidebar-card__title">Publikacja</h3>
            <p class="form-hint" style="margin-bottom:0.9rem;">
              Zapisz zawsze odkłada wpis do <strong>Roboczych</strong>. Publikację robisz potem z listy wpisów przyciskiem <strong>Opublikuj</strong>.
            </p>

            <div class="btn-stack">
              <button type="submit" name="action" value="save" class="btn-panel btn-panel--primary btn-full">
                💾 Zapisz (roboczy)
              </button>
              <?php if ($editMode && $entry['status'] === 'published' && $entry['html_file']): ?>
                <a href="<?= SITE_URL . h($entry['html_file']) ?>" target="_blank" rel="noopener noreferrer"
                   class="btn-panel btn-panel--outline btn-full">
                  👁 Podejrzyj wpis ↗
                </a>
              <?php endif; ?>
            </div>
          </div>

          <!-- Data wpisu -->
          <div class="sidebar-card">
            <h3 class="sidebar-card__title">Data wpisu</h3>
            <div class="form-group">
              <label for="entry_date" class="form-label">Data <span class="required">*</span></label>
              <input type="date" id="entry_date" name="entry_date" class="form-input"
                value="<?= h($entry['entry_date'] ?? $today) ?>" required>
              <p class="form-hint">Data określa miejsce fistaszka w kalendarzu.</p>
            </div>
          </div>

          <div class="sidebar-card">
            <h3 class="sidebar-card__title">Wideo</h3>
            <div class="form-group">
              <label for="video_source" class="form-label">Źródło wideo</label>
              <select id="video_source" name="video_source" class="form-input form-select">
                <option value="none" <?= $videoSourceValue === 'none' ? 'selected' : '' ?>>Brak</option>
                <option value="youtube" <?= $videoSourceValue === 'youtube' ? 'selected' : '' ?>>YouTube (link)</option>
                <option value="upload" <?= $videoSourceValue === 'upload' ? 'selected' : '' ?>>Plik z telefonu/komputera</option>
              </select>
              <p class="form-hint">Wideo zastępuje hero ze zdjęć na stronie wpisu.</p>
            </div>

            <div class="video-settings" id="youtube-settings">
              <div class="form-group">
                <label for="youtube_url" class="form-label">Link YouTube</label>
                <input type="url" id="youtube_url" name="youtube_url" class="form-input"
                       placeholder="https://www.youtube.com/watch?v=..."
                       value="<?= h($youtubeUrlValue) ?>">
                <p class="form-hint">Obsługiwane: `youtube.com/watch`, `youtu.be`, `youtube.com/shorts`.</p>
              </div>
              <div class="form-group">
                <label for="youtube_orientation" class="form-label">Orientacja YouTube</label>
                <select id="youtube_orientation" name="youtube_orientation" class="form-input form-select">
                  <option value="horizontal" <?= $youtubeOrientationValue === 'horizontal' ? 'selected' : '' ?>>Pozioma (16:9)</option>
                  <option value="vertical" <?= $youtubeOrientationValue === 'vertical' ? 'selected' : '' ?>>Pionowa (9:16)</option>
                </select>
              </div>
            </div>

            <div class="video-settings" id="upload-settings">
              <div class="form-group">
                <label for="uploaded_video_file" class="form-label">Plik wideo</label>
                <input type="file" id="uploaded_video_file" name="uploaded_video_file" class="form-input"
                       accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v">
                <p class="form-hint">MP4, MOV, M4V, WebM. Limit: 150 MB.</p>
              </div>
              <div class="form-group">
                <label for="uploaded_video_orientation" class="form-label">Orientacja pliku</label>
                <select id="uploaded_video_orientation" name="uploaded_video_orientation" class="form-input form-select">
                  <option value="horizontal" <?= $uploadedVideoOrientationValue === 'horizontal' ? 'selected' : '' ?>>Pozioma (16:9)</option>
                  <option value="vertical" <?= $uploadedVideoOrientationValue === 'vertical' ? 'selected' : '' ?>>Pionowa (9:16)</option>
                </select>
              </div>
              <?php if ($uploadedVideoFilename): ?>
                <div class="video-existing">
                  <p><strong>Aktualny plik:</strong> <?= h($uploadedVideoFilename) ?></p>
                  <?php if ($uploadedVideoMime): ?>
                    <p><strong>MIME:</strong> <?= h($uploadedVideoMime) ?></p>
                  <?php endif; ?>
                  <p><a href="<?= ADMIN_URL ?>uploads/<?= h($uploadedVideoFilename) ?>" target="_blank" rel="noopener noreferrer">Podgląd pliku ↗</a></p>
                  <label class="media-item__delete">
                    <input type="checkbox" name="delete_uploaded_video" value="1"> Usuń aktualny plik wideo
                  </label>
                </div>
              <?php endif; ?>
            </div>
          </div>

          <!-- Niebezpieczna strefa -->
          <?php if ($editMode): ?>
          <div class="sidebar-card sidebar-card--danger">
            <h3 class="sidebar-card__title sidebar-card__title--danger">Strefa niebezpieczna</h3>
            <form method="POST" action="actions/delete.php"
                  onsubmit="return confirm('Usunąć wpis „<?= addslashes(h($entry['title'])) ?>"?\nOperacja usunie stronę HTML i fistaszek z kalendarza.\nTej operacji nie można cofnąć.')">
              <input type="hidden" name="csrf_token" value="<?= h($csrf) ?>">
              <input type="hidden" name="id" value="<?= $entry['id'] ?>">
              <button type="submit" class="btn-panel btn-panel--danger btn-full">🗑 Usuń wpis</button>
            </form>
          </div>
          <?php endif; ?>

        </div>
      </div>
      <div class="form-actions-mobile" data-form-actions-mobile>
        <button type="submit" name="action" value="save" class="btn-panel btn-panel--primary btn-full">💾 Zapisz (roboczy)</button>
      </div>
    </form>

  </div>
</main>

<script>
// Podgląd aktualnie wybranych plików (model jak w panelu newsów: bez kumulacji/DataTransfer)
const fileInput = document.getElementById('media_files');
const preview = document.getElementById('upload-preview');
const form = document.getElementById('entry-form');
const videoSourceSelect = document.getElementById('video_source');
const youtubeSettings = document.getElementById('youtube-settings');
const uploadSettings = document.getElementById('upload-settings');
const entryEditor = document.getElementById('entry-content-editor');
const entryContentInput = document.getElementById('content');
const entryToolbarButtons = document.querySelectorAll('.entry-editor-action');
const entryInternalLinkSelect = document.getElementById('entry-internal-link-select');
const entryLinkInput = document.getElementById('entry-link-url');
const entryInsertLinkButton = document.getElementById('entry-insert-link-btn');
let entrySavedSelection = null;

function toggleVideoSettings() {
  const source = videoSourceSelect ? videoSourceSelect.value : 'none';
  if (youtubeSettings) youtubeSettings.style.display = source === 'youtube' ? 'block' : 'none';
  if (uploadSettings) uploadSettings.style.display = source === 'upload' ? 'block' : 'none';
}

if (videoSourceSelect) {
  videoSourceSelect.addEventListener('change', toggleVideoSettings);
  toggleVideoSettings();
}

if (entryEditor && entryContentInput) {
  entryEditor.innerHTML = entryContentInput.value.trim() !== '' ? entryContentInput.value : '<p><br></p>';

  function syncEntryTextareaFromEditor() {
    entryContentInput.value = entryEditor.innerHTML.trim();
  }

  function entrySelectionWithinEditor(selection) {
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    return entryEditor.contains(range.commonAncestorContainer);
  }

  function rememberEntrySelection() {
    const selection = window.getSelection();
    if (!entrySelectionWithinEditor(selection)) return;
    entrySavedSelection = selection.getRangeAt(0).cloneRange();
  }

  function restoreEntrySelection() {
    if (!entrySavedSelection) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(entrySavedSelection);
    return true;
  }

  function entryRangeToHtml(range) {
    const temp = document.createElement('div');
    temp.appendChild(range.cloneContents());
    return temp.innerHTML;
  }

  function wrapEntrySelection(openTag, closeTag) {
    entryEditor.focus();
    if (!restoreEntrySelection()) {
      rememberEntrySelection();
    }

    const selection = window.getSelection();
    if (!entrySelectionWithinEditor(selection)) {
      alert('Najpierw zaznacz słowo lub fragment tekstu.');
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      alert('Najpierw zaznacz słowo lub fragment tekstu.');
      return;
    }

    const selectedHtml = entryRangeToHtml(range);
    document.execCommand('insertHTML', false, openTag + selectedHtml + closeTag);
    syncEntryTextareaFromEditor();
    rememberEntrySelection();
    updateEntryToolbarState();
  }

  function entryEnsureNotEmpty() {
    const plain = (entryEditor.textContent || '').replace(/\u00a0/g, ' ').trim();
    return plain !== '';
  }

  function entryGetSelectionElement() {
    const selection = window.getSelection();
    if (!entrySelectionWithinEditor(selection)) return null;

    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    return node instanceof Element ? node : null;
  }

  function entryMatchesActiveCheck(element, check) {
    if (!element || !check) return false;
    if (check === 'strong') return !!element.closest('strong, b, .news-text-strong-black');
    if (check === 'em') return !!element.closest('em, i');
    if (check.startsWith('class:')) {
      const cls = check.slice('class:'.length).trim();
      return cls !== '' ? !!element.closest('.' + cls) : false;
    }
    return false;
  }

  function updateEntryToolbarState() {
    const selectedEl = entryGetSelectionElement();
    entryToolbarButtons.forEach((button) => {
      const check = button.getAttribute('data-active-check') || '';
      const active = selectedEl ? entryMatchesActiveCheck(selectedEl, check) : false;
      button.classList.toggle('is-active', active);
    });
  }

  function bindEntryToolbarAction(button) {
    const eventName = window.PointerEvent ? 'pointerdown' : ('ontouchstart' in window ? 'touchstart' : 'mousedown');
    const opts = eventName === 'touchstart' ? { passive: false } : false;

    button.addEventListener(eventName, (event) => {
      event.preventDefault();
      rememberEntrySelection();
      wrapEntrySelection(button.getAttribute('data-format-open') || '', button.getAttribute('data-format-close') || '');
    }, opts);

    button.addEventListener('click', (event) => {
      event.preventDefault();
    });
  }

  document.addEventListener('selectionchange', rememberEntrySelection);
  document.addEventListener('selectionchange', updateEntryToolbarState);

  ['input', 'keyup', 'blur'].forEach((eventName) => {
    entryEditor.addEventListener(eventName, () => {
      syncEntryTextareaFromEditor();
      rememberEntrySelection();
      updateEntryToolbarState();
    });
  });

  entryEditor.addEventListener('focus', () => {
    rememberEntrySelection();
    updateEntryToolbarState();
  });

  entryToolbarButtons.forEach((button) => bindEntryToolbarAction(button));

  if (entryInsertLinkButton) {
    const entryLinkEventName = window.PointerEvent ? 'pointerdown' : ('ontouchstart' in window ? 'touchstart' : 'mousedown');
    const entryLinkEventOpts = entryLinkEventName === 'touchstart' ? { passive: false } : false;

    const applyEntryLink = (event) => {
      event.preventDefault();
      rememberEntrySelection();
      const href = (entryLinkInput?.value || '').trim() || (entryInternalLinkSelect?.value || '').trim();
      if (!href) {
        alert('Wybierz link wewnętrzny lub wklej adres URL.');
        return;
      }
      wrapEntrySelection('<a href="' + href + '">', '</a>');
      if (entryInternalLinkSelect) entryInternalLinkSelect.value = '';
    };

    entryInsertLinkButton.addEventListener(entryLinkEventName, applyEntryLink, entryLinkEventOpts);
    entryInsertLinkButton.addEventListener('click', (event) => event.preventDefault());
  }

  if (entryInternalLinkSelect && entryLinkInput) {
    entryInternalLinkSelect.addEventListener('change', () => {
      const selectedValue = (entryInternalLinkSelect.value || '').trim();
      if (selectedValue) {
        entryLinkInput.value = selectedValue;
      }
    });
  }

  syncEntryTextareaFromEditor();
  updateEntryToolbarState();
}

function renderPreview(files) {
  if (!preview) return;
  preview.innerHTML = '';
  (files || []).forEach((file) => {
    const item = document.createElement('div');
    item.className = 'upload-preview__item';

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = file.name;
        
        const span = document.createElement('span');
        span.textContent = file.name;

        item.appendChild(img);
        item.appendChild(span);
        preview.appendChild(item);
      };
      reader.readAsDataURL(file);
    } else {
      item.innerHTML = `<div class="media-file-icon">📎</div><span>${file.name}</span>`;
      preview.appendChild(item);
    }
  });
}

if (fileInput) {
  fileInput.addEventListener('change', function() {
    renderPreview(Array.from(this.files || []));
  });
}

// Intercepcja wysyłania formularza
if (form) {
form.addEventListener('submit', function(event) {
  if (entryEditor && entryContentInput) {
    entryContentInput.value = entryEditor.innerHTML.trim();
    const plain = (entryEditor.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (!plain) {
      event.preventDefault();
      alert('Treść wpisu jest wymagana.');
      entryEditor.focus();
      return;
    }
  }
});
}
</script>

</body>
</html>
