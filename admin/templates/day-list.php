<?php
// day-list.php — szablon strony listy wpisów z jednego dnia
// Zmienne: $date (string YYYY-MM-DD), $entries (array of entry rows)

$siteUrl  = defined('SITE_URL') ? SITE_URL : 'https://fitpo50.pl/';
$uploadsUrl = $siteUrl . 'admin/uploads/';
$dateFormatted = date('j F Y', strtotime($date ?? ''));
$pageTitle = 'Wpisy z ' . $dateFormatted;
$pageDesc  = 'Wszystkie wpisy FitPo50 z dnia ' . $dateFormatted . '.';
$pageUrl   = $siteUrl . 'sukcesy/' . ($date ?? '') . '.html';

$adminUrl  = defined('ADMIN_URL') ? ADMIN_URL : 'https://admin.fitpo50.pl/';
$ogImage   = $siteUrl . 'assets/Hero_Porady1.png'; // Domyślne tło
foreach ($entries as $e) {
    if (!empty($e['media'])) {
        foreach ($e['media'] as $m) {
            if (str_starts_with($m['mime_type'] ?? '', 'image/')) {
                // Wybierzmy pierwsze znalezione zdjęcie jako OG Image
                // Zamieniamy na JPG by mieć 100% kompatybilności z Facebookiem/X
                $base = pathinfo($m['filename'], PATHINFO_FILENAME);
                if (file_exists(ADMIN_ROOT . 'uploads/' . $base . '.jpg')) {
                    $ogImage = $uploadsUrl . $base . '.jpg';
                } else {
                    $ogImage = $uploadsUrl . $m['filename'];
                }
                break 2;
            }
        }
    }
}

if (!function_exists('renderMediaPicture')) {
    function renderMediaPicture($filename, $originalName, $uploadsUrl, $adminUrl, $width, $height, $loading = 'lazy', $fit = 'cover') {
        $alt = htmlspecialchars($originalName);
        $srcPrimary = htmlspecialchars($uploadsUrl . $filename);
        $srcFallback = htmlspecialchars($adminUrl . 'uploads/' . $filename);
        return '<img src="' . $srcPrimary . '" alt="' . $alt . '" width="' . $width . '" height="' . $height . '" loading="' . $loading . '" onerror="if(!this.dataset.fallback){this.dataset.fallback=\'1\';this.src=\'' . $srcFallback . '\';}" style="width:100%;height:100%;object-fit:' . $fit . ';">';
    }
}
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());
  gtag("config", "G-S21SKTVM7K");
</script>
<title><?= htmlspecialchars($pageTitle) ?> | FitPo50</title>
<meta name="description" content="<?= htmlspecialchars($pageDesc) ?>">
<meta name="robots" content="index,follow">

<meta property="og:title" content="<?= htmlspecialchars($pageTitle) ?> | FitPo50">
<meta property="og:description" content="<?= htmlspecialchars($pageDesc) ?>">
<meta property="og:type" content="website">
<meta property="og:url" content="<?= $pageUrl ?>">
<meta property="og:image" content="<?= htmlspecialchars($ogImage) ?>">
<meta property="og:locale" content="pl_PL">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= htmlspecialchars($pageTitle) ?> | FitPo50">
<meta name="twitter:description" content="<?= htmlspecialchars($pageDesc) ?>">
<meta name="twitter:image" content="<?= htmlspecialchars($ogImage) ?>">

<link rel="canonical" href="<?= $pageUrl ?>">

<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&amp;display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= $siteUrl ?>base.css">
<link rel="stylesheet" href="<?= $siteUrl ?>style.css?v=1.2">
<style>
.day-list-page { padding-top: var(--space-20); padding-bottom: var(--space-16); }
.day-list-header { text-align: center; margin-bottom: var(--space-12); }
.day-list-header__label { display: inline-block; background: var(--color-primary); color: #fff; padding: 4px 14px; border-radius: 999px; font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: var(--space-4); }
.day-list-header__title { font-family: var(--font-display); font-size: clamp(2rem, 5vw, 3.5rem); color: var(--text-base); letter-spacing: -.02em; }

.day-list-container { display: flex; flex-direction: column; width: 100%; margin: 0 auto; }

.article-header { text-align: center; margin-bottom: var(--space-4); padding: 0 var(--space-6); max-width: 980px; margin-inline: auto; }
.article-header__title { font-family: var(--font-display); font-size: clamp(2.2rem, 5vw, 3.8rem); line-height: 1.1; color: var(--text-base); margin-bottom: var(--space-6); letter-spacing: -.02em; font-weight: 700; }
.article-header__lead { font-size: clamp(1.1rem, 2.1vw, 1.32rem); color: var(--color-accent); max-width: 62ch; margin: 0 auto; line-height: 1.7; font-weight: 600; }
.article-hero { position: relative; width: 100%; max-width: 1000px; margin: 0 auto var(--space-5); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,.15); }
.article-hero img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }
.article-content { max-width: 720px; margin: 0 auto var(--space-6); font-size: 1.125rem; line-height: 1.8; color: var(--text-muted); padding: 0 var(--space-6); }
.article-content > * + * { margin-top: var(--space-6); }
.article-content h2 { font-family: var(--font-display); font-size: 2.25rem; color: var(--text-base); margin-top: var(--space-12); margin-bottom: var(--space-6); line-height: 1.3; position: relative; padding-bottom: var(--space-3); }
.article-content h2::after { content: ""; position: absolute; left: 0; bottom: 0; width: 60px; height: 4px; background: var(--color-primary); border-radius: 2px; }
.article-content h3 { font-family: var(--font-display); font-size: 1.5rem; color: var(--color-accent); margin-top: var(--space-10); }
.article-content p { margin-bottom: var(--space-4); }
.article-content img { width: 100%; border-radius: var(--radius-md); margin: var(--space-10) 0; box-shadow: 0 10px 30px rgba(0,0,0,.1); }
.article-quote { background: var(--color-surface); border-left: 4px solid var(--color-primary); padding: var(--space-6) var(--space-8); margin: var(--space-10) 0; font-style: italic; font-size: 1.35rem; color: var(--text-base); border-radius: 0 var(--radius-md) var(--radius-md) 0; font-family: var(--font-display); }
.entry-media-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin: var(--space-10) 0; }
.entry-media-gallery img { width: 100%; border-radius: var(--radius-md); box-shadow: 0 6px 16px rgba(0,0,0,.1); }

.day-list-separator { border: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(14, 143, 170, 0.4), transparent); margin: var(--space-7) 0; width: 100%; display: block; }
</style>
</head>
<body>

<header class="header" id="top">
  <div class="container header__inner">
    <a href="<?= $siteUrl ?>index.html#top" class="logo" aria-label="FitPo50 — strona główna">
      <img src="<?= $siteUrl ?>assets/logo.jpg" alt="FitPo50" class="logo__img" width="48" height="48">
    </a>
    <nav class="header__desktop-nav" aria-label="Nawigacja pulpit">
      <a href="<?= $siteUrl ?>index.html#o-nas" class="nav__link">O mnie</a>
      <a href="<?= $siteUrl ?>index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
      <a href="<?= $siteUrl ?>porady.html" class="nav__link">Porady</a>
      <a href="<?= $siteUrl ?>moje-sukcesy.html" class="nav__link">Moje Sukcesy</a>
      <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
    </nav>
  </div>
  <nav class="header__scroll" aria-label="Kategorie mobilne">
    <div class="header__scroll-inner">
      <a href="<?= $siteUrl ?>index.html" class="header__scroll-link">Główna</a>
      <a href="<?= $siteUrl ?>porady.html" class="header__scroll-link">Porady</a>
      <a href="<?= $siteUrl ?>moje-sukcesy.html" class="header__scroll-link">Moje Sukcesy</a>
    </div>
  </nav>
</header>

<main class="day-list-page">
  <div class="container">
    <div class="day-list-header reveal">
      <span class="day-list-header__label">Moje Sukcesy</span>
      <h1 class="day-list-header__title">Wpisy z <?= htmlspecialchars($dateFormatted) ?></h1>
    </div>

    <div class="day-list-container">
      <?php foreach ($entries as $index => $e): 
          $title      = $e['title'];
          $lead       = $e['lead'] ?? '';
          $content    = $e['content'];
          $media      = $e['media'] ?? [];
          
          $imageMedia = array_values(array_filter($media, fn($m) => str_starts_with($m['mime_type'] ?? '', 'image/')));
          $imageCount = count($imageMedia);
          $heroImg = $imageCount > 0 ? reset($imageMedia) : null;
          $adminUrl   = defined('ADMIN_URL') ? ADMIN_URL : 'https://admin.fitpo50.pl/';
      ?>
        <?php if ($index > 0): ?>
          <hr class="day-list-separator">
        <?php endif; ?>

        <div class="article-header reveal">
          <h2 class="article-header__title" style="color: var(--color-primary);"><?= htmlspecialchars($title) ?></h2>
          <?php if ($lead): ?>
            <p class="article-header__lead"><?= htmlspecialchars($lead) ?></p>
          <?php endif; ?>
        </div>

        <?php if ($imageCount === 1): ?>
        <div class="article-hero reveal">
          <?= renderMediaPicture($heroImg['filename'], $heroImg['original_name'] ?? $title, $uploadsUrl, $adminUrl, '1200', '675', 'eager') ?>
        </div>
        <?php elseif ($imageCount >= 2): ?>
        <div class="entry-carousel reveal" aria-label="Galeria zdjęć wpisu" tabindex="0">
          <div class="entry-carousel__track">
            <?php foreach ($imageMedia as $idx => $m): ?>
              <div class="entry-carousel__slide">
                <?= renderMediaPicture($m['filename'], $m['original_name'] ?? $title, $uploadsUrl, $adminUrl, '1200', '675', $idx === 0 ? 'eager' : 'lazy', 'contain') ?>
              </div>
            <?php endforeach; ?>
          </div>
          <button class="entry-carousel__btn entry-carousel__btn--prev" aria-label="Poprzednie zdjęcie">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="entry-carousel__btn entry-carousel__btn--next" aria-label="Następne zdjęcie">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <div class="entry-carousel__dots"></div>
        </div>
        <?php endif; ?>

        <article class="article-content">
          <?= $content ?>
        </article>

      <?php endforeach; ?>
    </div>

    <div style="text-align:center;margin-top:var(--space-12);">
      <a href="<?= $siteUrl ?>moje-sukcesy.html" class="btn btn--outline" style="border-color:var(--color-primary);color:var(--color-primary);">
        ← Wróć do kalendarza
      </a>
    </div>
  </div>
</main>

<footer class="footer" id="footer">
  <div class="container">
    <div class="footer__inner">
      <div class="footer__brand">
        <a href="<?= $siteUrl ?>index.html#top" class="logo" aria-label="FitPo50 — strona główna">
          <img src="<?= $siteUrl ?>assets/logo.jpg" alt="FitPo50" class="logo__img logo__img--footer" width="72" height="72">
        </a>
        <p class="footer__brand-desc">Praktyczna wiedza o treningu, diecie i regeneracji dla osób po 50‑tce.</p>
      </div>
      <div>
        <h4 class="footer__heading">Nawigacja</h4>
        <ul class="footer__links" role="list">
          <li><a href="<?= $siteUrl ?>index.html">Strona Główna</a></li>
          <li><a href="<?= $siteUrl ?>porady.html">Porady</a></li>
          <li><a href="<?= $siteUrl ?>moje-sukcesy.html" style="color:var(--color-primary);">Moje Sukcesy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__bottom">
      <p class="footer__disclaimer">⚠️ Uwaga: Autor nie jest lekarzem — treści mają charakter informacyjny.</p>
    </div>
  </div>
</footer>

<script src="<?= $siteUrl ?>dist/app.js" defer></script>
<?php require ADMIN_ROOT . 'templates/carousel-script.php'; ?>

<nav class="bottom-nav" aria-label="Nawigacja dolna">
  <a href="<?= $siteUrl ?>index.html" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    <span>Dom</span>
  </a>
  <a href="<?= $siteUrl ?>porady.html" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    <span>Porady</span>
  </a>
  <a href="<?= $siteUrl ?>moje-sukcesy.html" class="bottom-nav__item bottom-nav__item--active">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
    <span>Sukcesy</span>
  </a>
</nav>

<?php
$jsonLd = [
  "@context" => "https://schema.org",
  "@type" => "CollectionPage",
  "name" => $pageTitle,
  "description" => $pageDesc,
  "url" => $pageUrl,
  "isPartOf" => [
    "@type" => "WebSite",
    "name" => "FitPo50",
    "url" => $siteUrl
  ],
  "publisher" => [
    "@type" => "Organization",
    "name" => "FitPo50",
    "logo" => [
      "@type" => "ImageObject",
      "url" => $siteUrl . "assets/logo.jpg"
    ]
  ]
];
?>
<script type="application/ld+json">
<?= json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?>
</script>

</body>
</html>
