#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(ROOT, file), content, 'utf8');
}

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html')
    .filter((f) => {
      const raw = read(f);
      return /<meta\s+property="og:type"\s+content="article">/i.test(raw);
    })
    .sort();
}

function decodeHtml(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(str) {
  return decodeHtml(String(str || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeAssetUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      if (parsed.pathname.startsWith('/assets/')) return `.${parsed.pathname}`;
      return u;
    } catch {
      return u;
    }
  }
  if (u.startsWith('/assets/')) return `.${u}`;
  return u;
}

function normalizeCategory(raw) {
  const v = String(raw || '').toLowerCase();
  if (v.includes('ruch')) return { key: 'ruch', label: 'Ruch', cardClass: 'article-kicker-card--ruch' };
  if (v.includes('jedzenie') || v.includes('dieta') || v.includes('nawyk')) return { key: 'jedzenie', label: 'Jedzenie', cardClass: 'article-kicker-card--jedzenie' };
  if (v.includes('zdrow') || v.includes('badania')) return { key: 'zdrowie', label: 'Zdrowie', cardClass: 'article-kicker-card--zdrowie' };
  if (v.includes('ciekaw') || v.includes('lifestyle')) return { key: 'ciekawe', label: 'Ciekawe', cardClass: 'article-kicker-card--ciekawe' };
  return { key: 'ciekawe', label: 'Ciekawe', cardClass: 'article-kicker-card--ciekawe' };
}

function extract(raw, regex, group = 1, fallback = '') {
  const m = raw.match(regex);
  return m ? (m[group] || '').trim() : fallback;
}

function ensureNightShellScript(headInner) {
  if (/document\.documentElement\.classList\.add\('night-shell'\)/.test(headInner)) {
    return headInner;
  }
  const script = `<script>\n  (function () {\n    try {\n      var isPhone = (window.matchMedia && (window.matchMedia('(max-width: 820px)').matches || window.matchMedia('(hover: none) and (pointer: coarse)').matches));\n      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;\n      var h = new Date().getHours();\n      var isNight = (h >= 19 || h < 7);\n      if (isPhone && (prefersDark || isNight)) document.documentElement.classList.add('night-shell');\n    } catch (_) {}\n  })();\n</script>\n`;
  if (/<title>/i.test(headInner)) {
    return headInner.replace(/<title>/i, `${script}<title>`);
  }
  return `${script}${headInner}`;
}

function cleanupHead(headInner) {
  let h = headInner;
  h = h.replace(/<style[\s\S]*?<\/style>\s*/gi, '');

  const removable = [
    /<link[^>]*href="\.\/base\.css"[^>]*>\s*/gi,
    /<link[^>]*href="\.\/style\.css[^\"]*"[^>]*>\s*/gi,
    /<link[^>]*href="\.\/article\.css[^\"]*"[^>]*>\s*/gi,
    /<link[^>]*href="\.\/assets\/footer\.css[^\"]*"[^>]*>\s*/gi,
    /<link[^>]*rel="icon"[^>]*>\s*/gi,
    /<meta[^>]*name="google-adsense-account"[^>]*>\s*/gi,
    /<script[^>]*src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[\s\S]*?<\/script>\s*/gi
  ];

  for (const rx of removable) h = h.replace(rx, '');

  h = ensureNightShellScript(h);

  const styleBlock = [
    '<link rel="stylesheet" href="./base.css">',
    '<link rel="stylesheet" href="./style.css?v=1.2">',
    '<link rel="stylesheet" href="./article.css?v=1.2">',
    '<link rel="icon" href="./assets/logo.jpg" type="image/jpeg">',
    '<link rel="stylesheet" href="./assets/footer.css?v=1">',
    '<meta name="google-adsense-account" content="ca-pub-4993821807276758">',
    '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4993821807276758" crossorigin="anonymous"></script>'
  ].join('\n');

  h = `${h.trim()}\n\n${styleBlock}\n`;
  return h;
}

function extractArticleInner(raw) {
  const m = raw.match(/<article[^>]*class="article-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i);
  if (!m) return '<p class="drop-cap">Treść artykułu do uzupełnienia.</p>';
  let inner = m[1];
  inner = inner.replace(/\sstyle\s*=\s*"[^"]*"/gi, '');
  inner = inner.replace(/\sstyle\s*=\s*'[^']*'/gi, '');
  inner = inner.replace(/<style[\s\S]*?<\/style>\s*/gi, '');
  return inner.trim();
}

function extractMeta(raw) {
  const categoryRaw = extract(raw, /<meta\s+property="article:section"\s+content="([^"]*)"/i, 1, 'Ciekawe');
  const category = normalizeCategory(categoryRaw);
  const timeRequired = extract(raw, /"timeRequired"\s*:\s*"PT(\d+)M"/i, 1, '10');
  const readingTime = `${timeRequired} min czytania`;

  const h1Html = extract(raw, /<h1[^>]*>([\s\S]*?)<\/h1>/i, 1, 'Tytuł artykułu');
  const h1Text = stripTags(h1Html) || 'Tytuł artykułu';

  const heroBlock = raw.match(/<div[^>]*class="[^"]*article-hero[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i);
  let heroSrc = '';
  let heroAlt = h1Text;
  let heroMotto = '';

  if (heroBlock) {
    heroSrc = extract(heroBlock[1], /<img[^>]*src="([^"]+)"/i, 1, '');
    heroAlt = extract(heroBlock[1], /<img[^>]*alt="([^"]*)"/i, 1, h1Text) || h1Text;
    const mottoRaw = extract(heroBlock[1], /<div[^>]*class="[^"]*hero-motto[^"]*"[^>]*>([\s\S]*?)<\/div>/i, 1, '');
    heroMotto = mottoRaw
      .replace(/\sstyle\s*=\s*"[^"]*"/gi, '')
      .replace(/\sstyle\s*=\s*'[^']*'/gi, '')
      .trim();
  }

  if (!heroSrc) {
    heroSrc = extract(raw, /<meta\s+property="og:image"\s+content="([^"]+)"/i, 1, '');
  }

  heroSrc = normalizeAssetUrl(heroSrc);
  if (!heroSrc) heroSrc = './assets/logo.jpg';

  const base = path.basename(heroSrc).replace(/\.[a-zA-Z0-9]+$/, '');
  const heroBase = base || 'logo';

  if (!heroMotto) {
    const defaults = {
      ruch: 'Ruszaj się regularnie.\nTwoje ciało odwdzięczy się szybciej niż myślisz.',
      jedzenie: 'Jedz mądrze.\nTwoje codzienne wybory budują formę po 50.',
      zdrowie: 'Dbaj o zdrowie.\nProste decyzje dziś robią różnicę jutro.',
      ciekawe: 'Patrz szerzej.\nNowe perspektywy wzmacniają motywację do zmian.'
    };
    heroMotto = defaults[category.key];
  }

  return { category, readingTime, h1Text, heroAlt, heroBase, heroMotto };
}

function buildRelatedPool(originals) {
  function toCard(file) {
    const raw = originals[file] || '';
    const categoryRaw = extract(raw, /<meta\s+property="article:section"\s+content="([^"]*)"/i, 1, 'Ciekawe');
    const category = normalizeCategory(categoryRaw);
    const title = stripTags(extract(raw, /<h1[^>]*>([\s\S]*?)<\/h1>/i, 1, 'Artykuł'));
    const desc = extract(raw, /<meta\s+name="description"\s+content="([^"]*)"/i, 1, 'Przeczytaj artykuł.');
    const mins = extract(raw, /"timeRequired"\s*:\s*"PT(\d+)M"/i, 1, '10');
    const imageUrl = normalizeAssetUrl(extract(raw, /<meta\s+property="og:image"\s+content="([^"]+)"/i, 1, './assets/logo.jpg'));
    const imageBase = path.basename(imageUrl).replace(/\.[a-zA-Z0-9]+$/, '') || 'logo';
    return {
      href: file,
      categoryLabel: category.label,
      categoryKey: category.key,
      timeShort: `${mins} min`,
      title,
      desc,
      imageBase,
      alt: title
    };
  }

  const allFiles = Object.keys(originals).sort();
  const pool = allFiles.reduce((acc, f) => {
    acc[f] = toCard(f);
    return acc;
  }, {});

  const byCategory = {
    ruch: allFiles.filter((f) => pool[f].categoryKey === 'ruch'),
    jedzenie: allFiles.filter((f) => pool[f].categoryKey === 'jedzenie'),
    zdrowie: allFiles.filter((f) => pool[f].categoryKey === 'zdrowie'),
    ciekawe: allFiles.filter((f) => pool[f].categoryKey === 'ciekawe')
  };

  return { pool, byCategory, allFiles };
}

function pickRelated(currentFile, categoryKey, relatedSource) {
  const { pool, byCategory, allFiles } = relatedSource;
  const preferred = (byCategory[categoryKey] || []).filter((f) => f !== currentFile);
  const fallback = allFiles.filter((f) => f !== currentFile && !preferred.includes(f));
  const picked = [...preferred, ...fallback].slice(0, 3).map((f) => pool[f]);
  return picked;
}

function buildPage(file, raw, relatedSource) {
  const headInnerRaw = extract(raw, /<head>([\s\S]*?)<\/head>/i, 1, '');
  const headInner = cleanupHead(headInnerRaw);

  const articleInner = extractArticleInner(raw);
  const meta = extractMeta(raw);
  const related = pickRelated(file, meta.category.key, relatedSource);

  const relatedCardsHtml = related.map((card) => `
      <a href="${card.href}" class="article-promo-card reveal">
        <div class="article-promo-card__media">
          <picture>
            <source srcset="./assets/${card.imageBase}.avif" type="image/avif">
            <source srcset="./assets/${card.imageBase}.webp" type="image/webp">
            <img src="./assets/${card.imageBase}.jpg" alt="${card.alt.replace(/"/g, '&quot;')}" class="article-promo-img article-promo-card__img" loading="lazy" width="1080" height="603">
          </picture>
        </div>
        <div class="article-promo-card__content">
          <span class="article-promo-card__meta article-promo-card__meta--${card.categoryKey}">${card.categoryLabel} • ${card.timeShort}</span>
          <h4 class="article-promo-card__title">${card.title}</h4>
          <p class="article-promo-card__desc">${card.desc}</p>
          <span class="btn btn--outline article-promo-card__cta">Czytaj artykuł -></span>
        </div>
      </a>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
${headInner}</head>
<body class="article-template article--${meta.category.key}">
<div class="shell">
<header class="topbar">
  <a href="index.html" class="brand" aria-label="FitPo50 — strona główna">
    <img class="brand__logo" src="./assets/logo-fitpo50.png" alt="Logo FitPo50" onerror="this.style.display='none'">
    <span class="brand__text">
      <span class="brand__name">FitPo50</span>
      <span class="brand__tagline">WRÓĆ DO FORMY<br>PO 50-TCE</span>
    </span>
  </a>
  <nav class="menu" aria-label="Menu główne">
      <a href="index.html">Home</a>
      <a href="porady.html" class="is-active">Porady</a>
      <a href="index.html#news">News</a>
      <a href="rusz-sie.html">Ruch</a>
      <a href="jedzenie.html">Jedzenie</a>
      <a href="zdrowie.html">Zdrowie</a>
      <a href="ciekawe.html">Ciekawe</a>
      <a href="dziennik.html">Dziennik</a>
      <a href="o-mnie.html">O mnie</a>
  </nav>
  <label class="searchbar" aria-label="Szukaj artykułów">
    <span aria-hidden="true">🔎</span>
    <input type="search" placeholder="Szukaj artykułów...">
  </label>
</header>

<main class="article-page" id="main-article">
  <div class="container article-main-bento">
    <section class="article-intro-grid reveal" aria-label="Wstęp artykułu">
      <div class="article-kicker-card ${meta.category.cardClass}">
        <p class="article-kicker-card__meta"><span class="article-kicker-card__category-pill">${meta.category.label}</span><span>${meta.readingTime}</span></p>
        <h1 class="article-header__title">${meta.h1Text}</h1>
      </div>

      <div class="article-hero reveal">
      <picture>
        <source srcset="./assets/${meta.heroBase}.avif" type="image/avif">
        <source srcset="./assets/${meta.heroBase}.webp" type="image/webp">
        <img src="./assets/${meta.heroBase}.jpg" alt="${meta.heroAlt.replace(/"/g, '&quot;')}" loading="eager" width="1080" height="603">
      </picture>
      <div class="hero-motto">${meta.heroMotto}</div>
      </div>
    </section>

    <article class="article-content">
${articleInner}
    </article>
  </div>
</main>

<section class="reading-room porady-preview section-padding" id="porady-preview">
  <div class="reading-room__head reveal">
    <h3>
      <span class="title-with-icon">
        <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18v16H6.5A2.5 2.5 0 0 0 4 21Z"></path>
          <path d="M7 7h8M7 11h8M7 15h5"></path>
        </svg>
        Czytelnia
      </span>
    </h3>
    <p>Duża garść wiedzy podana prosto, konkretnie i po ludzku.</p>
  </div>
  <div class="articles-grid-preview">${relatedCardsHtml}
  </div>
</section>
</div>

<nav class="bottom-nav" aria-label="Nawigacja dolna">
  <a href="index.html" class="bottom-nav__item ">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg>
    <span>Dom</span>
  </a>
  <a href="porady.html" class="bottom-nav__item ">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z"></path></svg>
    <span>Porady</span>
  </a>
  <a href="index.html#baza-wiedzy" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.35-4.35"></path></svg>
    <span>Baza wiedzy</span>
  </a>
  <a href="https://www.instagram.com/fitpo50" target="_blank" rel="noopener noreferrer" class="bottom-nav__item">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><path d="M17.5 6.5h.01"></path></svg>
    <span>Instagram</span>
  </a>
</nav>

<footer class="site-footer-bento" aria-label="Stopka FitPo50">
  <div class="site-footer-bento__grid">
    <section class="site-footer-bento__card" aria-label="O serwisie FitPo50">
      <div class="site-footer-bento__brand">
        <img class="site-footer-bento__logo" src="./assets/logo-fitpo50.png" alt="Logo FitPo50" loading="lazy" width="112" height="112" onerror="this.src='./assets/logo.jpg'">
        <div>
          <h2 class="site-footer-bento__title">FitPo50.pl</h2>
          <p class="site-footer-bento__lead">Praktyczny serwis o ruchu, jedzeniu i zdrowiu po 50-tce - prosto, konkretnie i bez marketingowej ściemy.</p>
        </div>
      </div>
    </section>

    <section class="site-footer-bento__card" aria-label="Linki serwisu">
      <h3 class="site-footer-bento__links-title">Nawigacja</h3>
      <ul class="site-footer-bento__links">
        <li><a href="index.html">Home</a></li>
        <li><a href="porady.html">Porady</a></li>
        <li><a href="rusz-sie.html">Ruch</a></li>
        <li><a href="jedzenie.html">Jedzenie</a></li>
        <li><a href="zdrowie.html">Zdrowie</a></li>
        <li><a href="ciekawe.html">Ciekawe</a></li>
        <li><a href="dziennik.html">Dziennik</a></li>
        <li><a href="o-mnie.html">O mnie</a></li>
      </ul>
    </section>
  </div>

  <div class="site-footer-bento__bottom">
    <p class="site-footer-bento__copy">© 2026 FitPo50 | <a href="polityka-prywatnosci.html">Polityka Prywatności i Cookies</a></p>
    <p class="site-footer-bento__note">Ważna informacja: nie jestem lekarzem. Treści na stronie mają charakter edukacyjny i informacyjny, nie zastępują konsultacji medycznej ani indywidualnych zaleceń specjalisty.</p>
  </div>
</footer>

<script src="./dist/cmp.js" defer></script>
<script src="./dist/app.js" defer></script>
</body>
</html>
`;

  return html;
}

function main() {
  const files = listArticleFiles();
  const originals = Object.fromEntries(files.map((f) => [f, read(f)]));
  const relatedSource = buildRelatedPool(originals);

  for (const file of files) {
    const raw = originals[file];
    const html = buildPage(file, raw, relatedSource);
    write(file, html);
    const outSite = path.join(ROOT, '_site', file);
    fs.mkdirSync(path.dirname(outSite), { recursive: true });
    fs.writeFileSync(outSite, html, 'utf8');
    console.log(`OK ${file}`);
  }
}

main();
