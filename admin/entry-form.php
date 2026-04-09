<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
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
      <a href="entry-form.php" class="panel-nav-link panel-nav-link--active">Nowy wpis</a>
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
      <?php if ($editMode && $entry['status'] === 'published' && $entry['html_file']): ?>
        <a href="<?= SITE_URL . h($entry['html_file']) ?>" target="_blank" rel="noopener noreferrer" class="btn-panel btn-panel--outline btn-panel--sm">
          Podejrzyj na stronie ↗
        </a>
      <?php endif; ?>
    </div>

    <form method="POST" action="actions/save.php" enctype="multipart/form-data" id="entry-form">
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
            <textarea id="content" name="content" class="form-input form-textarea form-textarea--lg"
              required placeholder="Treść wpisu — HTML lub czysty tekst..."><?= h($entry['content'] ?? '') ?></textarea>
            <p class="form-hint">Możesz używać HTML: &lt;p&gt;, &lt;h2&gt;, &lt;h3&gt;, &lt;ul&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;blockquote&gt; itp.</p>
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
          <div class="sidebar-card">
            <h3 class="sidebar-card__title">Publikacja</h3>
            <div class="form-group">
              <label for="status" class="form-label">Status</label>
              <select id="status" name="status" class="form-input form-select">
                <?php foreach (['draft'=>'📝 Roboczy','published'=>'✅ Opublikowany','hidden'=>'🙈 Ukryty'] as $k=>$v): ?>
                  <option value="<?= $k ?>" <?= ($entry['status'] ?? 'draft') === $k ? 'selected' : '' ?>><?= $v ?></option>
                <?php endforeach; ?>
              </select>
              <p class="form-hint">
                <strong>Roboczy</strong> — niewidoczny publicznie, bez fistaszka.<br>
                <strong>Opublikowany</strong> — generuje stronę + fistaszek w kalendarzu.<br>
                <strong>Ukryty</strong> — bez strony i fistaszka.
              </p>
            </div>

            <div class="btn-stack">
              <button type="submit" name="action" value="save" class="btn-panel btn-panel--primary btn-full">
                💾 Zapisz
              </button>
              <button type="submit" name="action" value="draft" class="btn-panel btn-panel--outline btn-full">
                📝 Zapisz jako roboczy
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
    </form>

  </div>
</main>

<script>
// Podgląd i kumulacja wybranych plików (rozwiązanie dla mobile/aparatu)
let accumulatedFiles = [];
const fileInput = document.getElementById('media_files');
const preview = document.getElementById('upload-preview');
const form = document.getElementById('entry-form');
const videoSourceSelect = document.getElementById('video_source');
const youtubeSettings = document.getElementById('youtube-settings');
const uploadSettings = document.getElementById('upload-settings');

function toggleVideoSettings() {
  const source = videoSourceSelect ? videoSourceSelect.value : 'none';
  if (youtubeSettings) youtubeSettings.style.display = source === 'youtube' ? 'block' : 'none';
  if (uploadSettings) uploadSettings.style.display = source === 'upload' ? 'block' : 'none';
}

if (videoSourceSelect) {
  videoSourceSelect.addEventListener('change', toggleVideoSettings);
  toggleVideoSettings();
}

fileInput.addEventListener('change', function() {
  const newFiles = Array.from(this.files);
  
  newFiles.forEach(file => {
    // Prosty fingerprint do unikania duplikatów
    const identifier = file.name + '-' + file.size + '-' + file.lastModified;
    const exists = accumulatedFiles.find(f => (f.name + '-' + f.size + '-' + f.lastModified) === identifier);
    
    if (!exists) {
      accumulatedFiles.push(file);
    }
  });

  renderPreview();
  
  // Czyścimy input, aby kolejne kliknięcie i zrobienie tego samego zdjęcia/wybór z aparatu 
  // znów wyzwoliło zdarzenie "change". Przed wysłaniem i tak wstrzykniemy accumulatedFiles.
  this.value = '';
});

function renderPreview() {
  preview.innerHTML = '';
  accumulatedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'upload-preview__item';
    item.style.position = 'relative'; // dla przycisku usuwania

    // Przycisk usuwania
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '✕';
    removeBtn.type = 'button';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '4px';
    removeBtn.style.right = '4px';
    removeBtn.style.background = 'rgba(230, 48, 81, 0.9)'; // pasuje do kolorystyki panelu (danger)
    removeBtn.style.color = '#fff';
    removeBtn.style.border = 'none';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.width = '24px';
    removeBtn.style.height = '24px';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.zIndex = '10';
    removeBtn.style.display = 'flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';
    removeBtn.style.fontSize = '12px';
    removeBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    
    removeBtn.onclick = (e) => {
      e.preventDefault();
      accumulatedFiles.splice(index, 1);
      renderPreview();
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = file.name;
        
        const span = document.createElement('span');
        span.textContent = file.name;
        
        item.appendChild(removeBtn);
        item.appendChild(img);
        item.appendChild(span);
        preview.appendChild(item);
      };
      reader.readAsDataURL(file);
    } else {
      item.innerHTML = `<div class="media-file-icon">📎</div><span>${file.name}</span>`;
      item.appendChild(removeBtn);
      preview.appendChild(item);
    }
  });
}

// Intercepcja wysyłania formularza
form.addEventListener('submit', function() {
  // Transfer zgromadzonych plików do natywnego inputa przed wysłaniem żądania
  const dt = new DataTransfer();
  accumulatedFiles.forEach(f => dt.items.add(f));
  fileInput.files = dt.files;
});
</script>

</body>
</html>
