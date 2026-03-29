<?php
// article.php — szablon generowanego artykułu "Moje Sukcesy"
// Zmienne dostępne: $entry (array), $media (array)
// Generuje kompletny HTML zgodny ze standardem artykułów FitPo50

$siteUrl    = defined('SITE_URL') ? SITE_URL : 'https://fitpo50.pl/';
$adminUrl   = defined('ADMIN_URL') ? ADMIN_URL : 'https://admin.fitpo50.pl/';
$slug       = $entry['slug'];
$title      = $entry['title'];
$lead       = $entry['lead'] ?? '';
$content    = $entry['content'];
$date       = $entry['entry_date'];   // YYYY-MM-DD
$dateIso    = $date . 'T10:00:00+02:00';
$dateModIso = ($entry['updated_at'] ?? $date) . 'T10:00:00+02:00';
$pageUrl    = $siteUrl . $slug . '.html';

// Pierwszy obraz jako hero/og:image
$heroImg = null;
$heroUrl = $siteUrl . 'assets/Hero_Porady1.png';
foreach ($media as $m) {
    if (str_starts_with($m['mime_type'] ?? '', 'image/')) {
        $heroImg = $m;
        $heroUrl = $adminUrl . 'uploads/' . $m['filename'];
        break;
    }
}

// Czas czytania (szacunek: ~200 słów/min)
$words   = str_word_count(strip_tags($content));
$readMin = max(1, round($words / 200));
?>
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S21SKTVM7K"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());
  gtag("config", "G-S21SKTVM7K");
</script>
<title><?= htmlspecialchars($title) ?> | FitPo50</title>
<meta name="description" content="<?= htmlspecialchars($lead ?: mb_substr(strip_tags($content), 0, 155)) ?>">
<meta name="robots" content="index,follow">
<meta property="og:title" content="<?= htmlspecialchars($title) ?>">
<meta property="og:description" content="<?= htmlspecialchars($lead ?: mb_substr(strip_tags($content), 0, 155)) ?>">
<meta property="og:type" content="article">
<meta property="og:url" content="<?= $pageUrl ?>">
<meta property="og:image" content="<?= htmlspecialchars($heroUrl) ?>">
<meta property="og:locale" content="pl_PL">
<meta property="article:published_time" content="<?= $dateIso ?>">
<meta property="article:modified_time" content="<?= $dateModIso ?>">
<meta property="article:author" content="FitPo50">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= htmlspecialchars($title) ?>">
<meta name="twitter:description" content="<?= htmlspecialchars($lead ?: mb_substr(strip_tags($content), 0, 155)) ?>">
<meta name="twitter:image" content="<?= htmlspecialchars($heroUrl) ?>">
<link rel="canonical" href="<?= $pageUrl ?>">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": <?= json_encode($title, JSON_UNESCAPED_UNICODE) ?>,
  "description": <?= json_encode($lead ?: mb_substr(strip_tags($content), 0, 155), JSON_UNESCAPED_UNICODE) ?>,
  "inLanguage": "pl-PL",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": <?= json_encode($pageUrl) ?>
  },
  "url": <?= json_encode($pageUrl) ?>,
  "image": <?= json_encode($heroUrl) ?>,
  "datePublished": <?= json_encode($dateIso) ?>,
  "dateModified": <?= json_encode($dateModIso) ?>,
  "keywords": ["Moje Sukcesy", "FitPo50", "forma po 50"],
  "author": {
    "@type": "Organization",
    "name": "FitPo50",
    "url": "https://fitpo50.pl/"
  },
  "publisher": {
    "@type": "Organization",
    "name": "FitPo50",
    "url": "https://fitpo50.pl/",
    "logo": {
      "@type": "ImageObject",
      "url": "https://fitpo50.pl/assets/logo.jpg"
    }
  }
}
</script>

<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&amp;display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="./base.css">
<link rel="stylesheet" href="./style.css?v=1.1">

<style>
.article-page { padding-top: var(--space-20); padding-bottom: var(--space-12); }
.article-header { text-align: center; margin-bottom: var(--space-12); max-width: 980px; margin-inline: auto; padding: 0 var(--space-6); }
.article-header__meta { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: var(--space-6); font-size: .95rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
.article-header__title { font-family: var(--font-display); font-size: clamp(2.25rem, 5.4vw, 4.1rem); line-height: 1.1; color: var(--text-base); margin-bottom: var(--space-6); letter-spacing: -.02em; font-weight: 700; }
.article-hero { position: relative; width: 100%; max-width: 1000px; margin: 0 auto var(--space-16); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,.15); }
.article-hero picture, .article-hero img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }
.article-content { max-width: 720px; margin: 0 auto; font-size: 1.125rem; line-height: 1.8; color: var(--text-muted); padding: 0 var(--space-6); }
.article-content > * + * { margin-top: var(--space-6); }
.article-content h2 { font-family: var(--font-display); font-size: 2.25rem; color: var(--text-base); margin-top: var(--space-12); margin-bottom: var(--space-6); line-height: 1.3; position: relative; padding-bottom: var(--space-3); }
.article-content h2::after { content: ""; position: absolute; left: 0; bottom: 0; width: 60px; height: 4px; background: var(--color-primary); border-radius: 2px; }
.article-content h3 { font-family: var(--font-display); font-size: 1.5rem; color: var(--color-accent); margin-top: var(--space-10); }
.article-content p { margin-bottom: var(--space-4); }
.article-content img { width: 100%; border-radius: var(--radius-md); margin: var(--space-10) 0; box-shadow: 0 10px 30px rgba(0,0,0,.1); }
.article-quote { background: var(--bg-surface); border-left: 4px solid var(--color-primary); padding: var(--space-6) var(--space-8); margin: var(--space-10) 0; font-style: italic; font-size: 1.35rem; color: var(--text-base); border-radius: 0 var(--radius-md) var(--radius-md) 0; font-family: var(--font-display); }
.drop-cap::first-letter { float: left; font-size: 4.5rem; line-height: .8; font-weight: 700; color: var(--color-primary); margin-right: 12px; margin-top: 8px; font-family: var(--font-display); }
.medical-disclaimer { font-size: .875rem; color: var(--text-muted); font-style: italic; border-top: 1px solid var(--border-color); padding-top: var(--space-6); margin-top: var(--space-12); }
.entry-media-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); margin: var(--space-10) 0; }
.entry-media-gallery img { width: 100%; border-radius: var(--radius-md); box-shadow: 0 6px 16px rgba(0,0,0,.1); }
.article-promo-card:hover .article-promo-img { transform: scale(1.05); }
.article-promo-card:hover { transform: translateY(-4px); box-shadow: 0 15px 35px rgba(14,143,170,.15) !important; border-color: var(--color-primary-light) !important; }
</style>
</head>
<body>

<header class="header" id="top">
  <div class="container header__inner">
    <a href="index.html#top" class="logo" aria-label="FitPo50 — strona główna">
      <img src="./assets/logo.jpg" alt="FitPo50" class="logo__img" width="48" height="48">
    </a>
    <nav class="header__desktop-nav" aria-label="Nawigacja pulpit">
      <a href="index.html#o-nas" class="nav__link">O mnie</a>
      <a href="index.html#baza-wiedzy" class="nav__link">Baza wiedzy</a>
      <a href="porady.html" class="nav__link">Porady</a>
      <a href="moje-sukcesy.html" class="nav__link">Moje Sukcesy</a>
      <a href="https://www.instagram.com/fitpo50" class="nav__link" target="_blank" rel="noopener noreferrer">Instagram</a>
    </nav>
  </div>
  <nav class="header__scroll" aria-label="Kategorie mobilne">
    <div class="header__scroll-inner">
      <a href="index.html" class="header__scroll-link">Główna</a>
      <a href="index.html#baza-wiedzy" class="header__scroll-link">Wiedza</a>
      <a href="index.html#trendy" class="header__scroll-link">Trendy</a>
      <a href="porady.html" class="header__scroll-link">Porady</a>
      <a href="moje-sukcesy.html" class="header__scroll-link">Moje Sukcesy</a>
      <a href="https://www.instagram.com/fitpo50" target="_blank" rel="noopener noreferrer" class="header__scroll-link">Instagram</a>
    </div>
  </nav>
</header>

<main class="article-page">
  <div class="container">
    <div class="article-header reveal">
      <div class="article-header__meta">
        <span style="color: var(--color-accent); font-weight: 700;">Moje Sukcesy</span>
        <span>•</span>
        <span><?= htmlspecialchars(strftime('%e %B %Y', strtotime($date))) ?></span>
        <span>•</span>
        <span style="display:flex;align-items:center;gap:4px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <?= $readMin ?> min czytania
        </span>
      </div>
      <h1 class="article-header__title" style="color: var(--color-primary);"><?= htmlspecialchars($title) ?></h1>
      <?php if ($lead): ?>
        <p style="font-size:1.2rem;color:var(--text-muted);max-width:60ch;margin:0 auto;"><?= htmlspecialchars($lead) ?></p>
      <?php endif; ?>
    </div>

    <?php if ($heroImg): ?>
    <div class="article-hero reveal">
      <img src="<?= htmlspecialchars($adminUrl . 'uploads/' . $heroImg['filename']) ?>"
           alt="<?= htmlspecialchars($heroImg['original_name'] ?? $title) ?>"
           loading="eager" width="1200" height="675">
    </div>
    <?php endif; ?>

    <article class="article-content">
      <?= $content ?>

      <?php
      // Pozostałe zdjęcia (poza pierwszym/hero)
      $restMedia = array_slice($media, $heroImg ? 1 : 0);
      if (!empty($restMedia)):
      ?>
      <div class="entry-media-gallery">
        <?php foreach ($restMedia as $m): if (!str_starts_with($m['mime_type'] ?? '', 'image/')) continue; ?>
        <img src="<?= htmlspecialchars($adminUrl . 'uploads/' . $m['filename']) ?>"
             alt="<?= htmlspecialchars($m['original_name'] ?? '') ?>"
             loading="lazy" width="800" height="600">
        <?php endforeach; ?>
      </div>
      <?php endif; ?>

      <div class="medical-disclaimer">
        Ten wpis powstał z mojego osobistego doświadczenia i nie zastępuje porady medycznej. Przed zmianami aktywności fizycznej lub diety skonsultuj się ze specjalistą.
      </div>
    </article>
  </div>
</main>

<!-- Czytelnia -->
<section class="porady-preview section-padding" style="background-color: var(--color-surface); padding-top: var(--space-16); padding-bottom: var(--space-20); margin-top: 0;">
  <div class="container">
    <div class="section-header" style="text-align: center;">
      <span class="section-header__label">Czytelnia</span>
      <h2 class="section-header__title" style="color: var(--color-primary); font-family: var(--font-display);">Najnowsze Porady i Artykuły</h2>
      <p class="section-header__desc">Praktyczna wiedza, którą możesz wdrożyć na najbliższym treningu.</p>
    </div>
    <div class="articles-grid-preview">
      <a href="jak-zaczac-na-silowni-po-50.html" class="article-promo-card reveal" style="display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--color-bg);border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.06);transition:all .3s ease;border:1px solid var(--color-border);">
        <div style="position:relative;height:200px;overflow:hidden;">
          <picture>
            <source srcset="./assets/hero_porady.avif" type="image/avif">
            <source srcset="./assets/hero_porady.webp" type="image/webp">
            <img src="./assets/hero_porady.png" alt="Jak zacząć na siłowni po 50-tce" style="width:100%;height:100%;object-fit:cover;transition:transform .5s ease;" class="article-promo-img" loading="lazy" width="640" height="640">
          </picture>
          <div style="position:absolute;top:12px;left:12px;background:var(--color-accent);color:white;padding:4px 10px;border-radius:var(--radius-sm);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Ruch</div>
        </div>
        <div style="padding:var(--space-6);display:flex;flex-direction:column;flex-grow:1;">
          <h4 style="font-family:var(--font-display);font-size:1.35rem;font-weight:600;margin-bottom:var(--space-3);line-height:1.3;">Jak zacząć na siłowni po 50-tce</h4>
          <p style="font-size:.95rem;color:var(--color-text-muted);line-height:1.6;margin-bottom:var(--space-4);flex-grow:1;">Pierwszy trening, plan na start i spokojne wejście — bez chaosu i wstydu.</p>
          <span class="btn btn--outline" style="border-color:var(--color-primary);color:var(--color-primary);align-self:flex-start;padding:var(--space-2) var(--space-4);">Czytaj artykuł -></span>
        </div>
      </a>
      <a href="dieta-po-50.html" class="article-promo-card reveal" style="display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--color-bg);border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.06);transition:all .3s ease;border:1px solid var(--color-border);">
        <div style="position:relative;height:200px;overflow:hidden;">
          <picture>
            <source srcset="./assets/cake_control_1774116224639.avif" type="image/avif">
            <source srcset="./assets/cake_control_1774116224639.webp" type="image/webp">
            <img src="./assets/cake_control_1774116224639.png" alt="Dieta po 50-tce" style="width:100%;height:100%;object-fit:cover;transition:transform .5s ease;" class="article-promo-img" loading="lazy" width="640" height="640">
          </picture>
          <div style="position:absolute;top:12px;left:12px;background:var(--color-accent);color:white;padding:4px 10px;border-radius:var(--radius-sm);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Odżywianie</div>
        </div>
        <div style="padding:var(--space-6);display:flex;flex-direction:column;flex-grow:1;">
          <h4 style="font-family:var(--font-display);font-size:1.35rem;font-weight:600;margin-bottom:var(--space-3);line-height:1.3;">Dieta po 50-tce kontra nawyki</h4>
          <p style="font-size:.95rem;color:var(--color-text-muted);line-height:1.6;margin-bottom:var(--space-4);flex-grow:1;">Czemu diety nie działają i co naprawdę zmienia sposób jedzenia na lata.</p>
          <span class="btn btn--outline" style="border-color:var(--color-primary);color:var(--color-primary);align-self:flex-start;padding:var(--space-2) var(--space-4);">Czytaj artykuł -></span>
        </div>
      </a>
      <a href="moje-sukcesy.html" class="article-promo-card reveal" style="display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--color-bg);border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.06);transition:all .3s ease;border:1px solid var(--color-border);">
        <div style="position:relative;height:200px;overflow:hidden;background:linear-gradient(135deg,rgba(14,143,170,.9),rgba(19,72,93,.95));display:flex;align-items:center;justify-content:center;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
        </div>
        <div style="padding:var(--space-6);display:flex;flex-direction:column;flex-grow:1;">
          <h4 style="font-family:var(--font-display);font-size:1.35rem;font-weight:600;margin-bottom:var(--space-3);line-height:1.3;">Moje Sukcesy — Kalendarz</h4>
          <p style="font-size:.95rem;color:var(--color-text-muted);line-height:1.6;margin-bottom:var(--space-4);flex-grow:1;">Przeglądaj wszystkie moje wpisy dzień po dniu w kalendarzu miesięcznym.</p>
          <span class="btn btn--outline" style="border-color:var(--color-primary);color:var(--color-primary);align-self:flex-start;padding:var(--space-2) var(--space-4);">Czytaj artykuł -></span>
        </div>
      </a>
    </div>
  </div>
</section>

<footer class="footer" id="footer">
  <div class="container">
    <div class="footer__inner">
      <div class="footer__brand">
        <a href="index.html#top" class="logo" aria-label="FitPo50 — strona główna">
          <img src="./assets/logo.jpg" alt="FitPo50" class="logo__img logo__img--footer" width="72" height="72">
        </a>
        <p class="footer__brand-desc">Praktyczna wiedza o treningu, diecie i regeneracji dla osób po 50‑tce.</p>
      </div>
      <div>
        <h4 class="footer__heading">Nawigacja</h4>
        <ul class="footer__links" role="list">
          <li><a href="index.html">Strona Główna</a></li>
          <li><a href="porady.html">Porady</a></li>
          <li><a href="moje-sukcesy.html" style="color:var(--color-primary);">Moje Sukcesy</a></li>
        </ul>
      </div>
      <div>
        <h4 class="footer__heading">Czytelnia</h4>
        <ul class="footer__links" role="list">
          <li><a href="jak-zaczac-na-silowni-po-50.html">Jak zacząć na siłowni po 50-tce</a></li>
          <li><a href="suplementacja-po-50.html">Białko i kreatyna po 50-tce</a></li>
          <li><a href="dieta-po-50.html">Dieta po 50-tce kontra nawyki</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__bottom">
      <p class="footer__disclaimer">⚠️ Uwaga: Autor nie jest lekarzem, trenerem personalnym ani dietetykiem. Treści mają charakter informacyjny i edukacyjny.</p>
    </div>
  </div>
</footer>

<script src="./dist/app.js" defer></script>

<nav class="bottom-nav" aria-label="Nawigacja dolna">
  <a href="index.html" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    <span>Dom</span>
  </a>
  <a href="porady.html" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    <span>Porady</span>
  </a>
  <a href="moje-sukcesy.html" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
    <span>Sukcesy</span>
  </a>
  <a href="https://www.instagram.com/fitpo50" target="_blank" rel="noopener noreferrer" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
    <span>Instagram</span>
  </a>
</nav>

</body>
</html>
