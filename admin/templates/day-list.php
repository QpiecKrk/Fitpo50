<?php
// day-list.php — szablon strony listy wpisów z jednego dnia
// Zmienne: $date (string YYYY-MM-DD), $entries (array of entry rows)

$siteUrl  = defined('SITE_URL') ? SITE_URL : 'https://fitpo50.pl/';
$dateFormatted = date('j F Y', strtotime($date ?? ''));
$pageTitle = 'Wpisy z ' . $dateFormatted;
$pageUrl   = $siteUrl . 'wpisy-' . ($date ?? '') . '.html';
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
<meta name="description" content="Wszystkie wpisy FitPo50 z dnia <?= htmlspecialchars($dateFormatted) ?>.">
<meta name="robots" content="index,follow">
<meta property="og:title" content="<?= htmlspecialchars($pageTitle) ?>">
<meta property="og:type" content="website">
<meta property="og:url" content="<?= $pageUrl ?>">
<meta property="og:locale" content="pl_PL">
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
.day-list-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-8); max-width: 720px; margin: 0 auto; padding: 0 var(--space-6); }
.entry-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-8); text-decoration: none; color: inherit; display: block; transition: all .25s ease; }
.entry-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(14,143,170,.12); border-color: var(--color-primary); }
.entry-card__title { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--color-primary); margin-bottom: var(--space-3); line-height: 1.25; }
.entry-card__lead { font-size: 1rem; color: var(--text-muted); line-height: 1.7; }
.entry-card__cta { display: inline-block; margin-top: var(--space-4); font-weight: 600; color: var(--color-accent); font-size: .95rem; }
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

    <div class="day-list-grid">
      <?php foreach ($entries as $e): ?>
      <a href="<?= htmlspecialchars($siteUrl . $e['html_file']) ?>" class="entry-card reveal">
        <div class="entry-card__title"><?= htmlspecialchars($e['title']) ?></div>
        <?php if (!empty($e['lead'])): ?>
          <p class="entry-card__lead"><?= htmlspecialchars($e['lead']) ?></p>
        <?php endif; ?>
        <span class="entry-card__cta">Czytaj wpis →</span>
      </a>
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

</body>
</html>
