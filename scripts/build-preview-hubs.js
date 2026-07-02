#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const hubs = [
  {
    file: 'centrum-treningu-silowego-po-50.html',
    title: 'Trening siłowy po 50',
    description: 'Bezpieczny start, progresja, maszyny, siła chwytu, błędy, regeneracja i planowanie treningu po pięćdziesiątce.',
    kicker: 'Centrum ruchu',
    icon: '🏋️',
    accent: '#ef8d3d',
    accentSoft: '#fff1e6',
    promise: 'Najpierw uczysz ciało ruchu, potem dokładamy obciążenie. Bez bohaterstwa, bez chaosu i bez gonienia planów z internetu.',
    focus: 'Od pierwszej wizyty do sensownej progresji',
    focusLead: 'Zacznij od maszyn i prostych zasad, potem przejdź do siły, postawy i regularnej progresji.',
    steps: ['Start bez bólu', 'Maszyny i technika', 'Progresja ciężaru', 'Regeneracja'],
    featured: {
      title: 'Jak zacząć na siłowni po 50?',
      url: 'jak-zaczac-na-silowni-po-50.html',
      text: 'Zobacz, jak bezpiecznie wrócić do ćwiczeń po latach albo zacząć od zera.',
    },
    articles: [
      ['Trening maszynowy po 50', 'trening-maszynowy-po-50.html', 'plan 30 dni'],
      ['7 błędów na siłowni po 50', 'siedem-bledow-silownia-po-50.html', 'bezpieczeństwo'],
      ['Siła chwytu po 50', 'sila-chwytu-po-50.html', 'marker sprawności'],
      ['Trening 3x30 po 50', 'trening-3x30-dla-50-plus.html', 'minimum skuteczne'],
      ['Trening siłowy chroni serce', 'silownia-chroni-serce-przed-zawalem.html', 'serce'],
    ],
    assets: ['Jak zacząć od maszyn i przejść do wolnych ciężarów', 'Jak rozpoznać sygnał ostrzegawczy i skorygować ćwiczenie', 'Kiedy zwiększyć obciążenie, a kiedy zostać przy obecnym'],
  },
  {
    file: 'centrum-bialka-po-50.html',
    title: 'Białko po 50',
    description: 'Ile białka jeść, jak rozłożyć porcje, kiedy WPC/WPI ma sens i jak chronić mięśnie bez dietetycznej paniki.',
    kicker: 'Centrum mięśni',
    icon: '🥚',
    accent: '#d98934',
    accentSoft: '#fff3df',
    promise: 'Nie chodzi o kult odżywki. Chodzi o proste porcje białka, które pomagają utrzymać mięśnie, sytość i siłę.',
    focus: 'Od dziennej dawki do talerza',
    focusLead: 'Sprawdź, ile białka potrzebujesz, jak rozłożyć je w ciągu dnia i z jakich produktów najłatwiej je dostarczyć.',
    steps: ['Ile gramów?', 'Porcja na posiłek', 'Produkty', 'WPC czy WPI'],
    featured: {
      title: 'Ile białka po 50 roku życia?',
      url: 'ile-bialka-po-50-roku-zycia-zapotrzebowanie-odzywki.html',
      text: 'Sprawdź dzienny zakres, porcje na talerzu i rozsądne zastosowanie odżywek.',
    },
    articles: [
      ['Kreatyna i białko po 50', 'kreatyna-i-bialko-po-50-tce-jak-laczyc.html', 'łączenie'],
      ['Kreatyna po 50', 'kreatyna-po-50-tce-kompletny-przewodnik.html', 'suplementacja'],
      ['Sarkopeniczna otyłość', 'sarkopeniczna-otylosc-problem-ktorego-nie-widac-w-lustrze.html', 'mięśnie'],
      ['Jedz więcej po 50', 'jedz-wiecej-po-50.html', 'energia'],
      ['Suplementy po 50', 'suplementy-po-50-tce-kompletny-przewodnik.html', 'wybór'],
    ],
    assets: ['Jak przeliczyć produkty na gramy białka', 'Jak oszacować dzienny zakres według masy ciała', 'Jak rozłożyć białko między posiłki'],
  },
  {
    file: 'centrum-snu-po-50.html',
    title: 'Sen po 50',
    description: 'Pobudki w nocy, melatonina, bezdech, stres, temperatura sypialni i regeneracja po treningu.',
    kicker: 'Centrum regeneracji',
    icon: '🌙',
    accent: '#5577d8',
    accentSoft: '#edf1ff',
    promise: 'Najpierw ustalamy, dlaczego sen się sypie. Dopiero potem dobieramy spokojne, mierzalne zmiany.',
    focus: 'Od pobudek nocnych do regeneracji',
    focusLead: 'Sprawdź, co możesz poprawić samodzielnie i które objawy warto omówić z lekarzem.',
    steps: ['Pobudki nocne', 'Rytm dobowy', 'Bezdech i sygnały', 'Regeneracja'],
    featured: {
      title: 'Optymalizacja snu po 50',
      url: 'optymalizacja-snu-po-50-jak-przestac-budzic-sie-o-3-w-nocy.html',
      text: 'Praktyczny przewodnik dla osób, które budzą się w środku nocy i nie wiedzą, od czego zacząć.',
    },
    articles: [
      ['Sen po 50', 'sen-po-50.html', 'podstawy'],
      ['Testosteron po 50 naturalnie', 'testosteron-po-50-naturalnie-bez-trt.html', 'hormony'],
      ['Jak obniżyć kortyzol po 50', 'jak-obnizyc-kortyzol-po-50-stres-oponka-brzuszna.html', 'stres'],
      ['Kolagen po 50', 'kolagen-suplementacja-po-50.html', 'regeneracja'],
      ['Komórki zombie i senoliza', 'komorki-zombie-skora-starzenie-po-50-senoliza-abt-263.html', 'starzenie'],
    ],
    assets: ['Jak uporządkować wieczorną rutynę', 'Co może stać za nocnymi pobudkami', 'Od jakiej jednej zmiany zacząć poprawę snu'],
  },
  {
    file: 'centrum-nadcisnienia-po-50.html',
    title: 'Nadciśnienie po 50',
    description: 'Ciśnienie, elastyczność naczyń, dieta DASH, marsz, trening siłowy i domowe pomiary bez straszenia.',
    kicker: 'Centrum serca',
    icon: '🫀',
    accent: '#d85d5d',
    accentSoft: '#fff0f0',
    promise: 'Uporządkuj domowe pomiary, zmiany stylu życia i sygnały, przy których nie warto zwlekać z lekarzem.',
    focus: 'Od pomiaru do planu działania',
    focusLead: 'Przejdź spokojnie od prawidłowego pomiaru przez żywienie i ruch do sygnałów alarmowych.',
    steps: ['Pomiar', 'Naczynia', 'DASH', 'Ruch'],
    featured: {
      title: 'Nadciśnienie i elastyczność naczyń',
      url: 'nadcisnienie-tetnicze-jak-odzyskac-elastycznosc-naczyn.html',
      text: 'Zobacz, jak stan naczyń, dieta i ruch wpływają na ciśnienie po 50-tce.',
    },
    articles: [
      ['Trening siłowy przy ciśnieniu', 'trening-silowy-po-50-cisnienie-plan-8-tygodni.html', 'plan'],
      ['Siłownia chroni serce', 'silownia-chroni-serce-przed-zawalem.html', 'serce'],
      ['Wydolność VO2max po 50', 'wydolnosc-vo2max-starzenie-po-50.html', 'kondycja'],
      ['Tłuszcz trzewny', 'tluszcz-trzewny-choroby-jak-walczyc.html', 'ryzyko'],
      ['Badania po 50', 'badania-po-50.html', 'kontrola'],
    ],
    assets: ['Jak prawidłowo prowadzić domowe pomiary ciśnienia', 'Jak połączyć wynik z rozsądnym następnym krokiem', 'Jak przygotować pytania na wizytę lekarską'],
  },
  {
    file: 'centrum-cholesterolu-po-50.html',
    title: 'Cholesterol i badania po 50',
    description: 'ApoB, ApoA1, lipidogram, markery krwi i praktyczne pytania do omówienia z lekarzem.',
    kicker: 'Centrum badań',
    icon: '🧪',
    accent: '#6b9f58',
    accentSoft: '#eff8ea',
    promise: 'Nie gonimy jednego wyniku. Układamy badania w sensowny obraz ryzyka, pytań i kolejnych kroków.',
    focus: 'Od wyniku do dobrego pytania',
    focusLead: 'Zobacz, jak łączyć lipidogram, ApoB i kontekst metaboliczny w jeden czytelny obraz.',
    steps: ['Lipidogram', 'ApoB/ApoA1', 'Ryzyko', 'Pytania'],
    featured: {
      title: 'ApoB i ApoA1 po 50',
      url: 'apob-apoa-badania-cholesterol.html',
      text: 'Ten przewodnik porządkuje markery, które często pokazują więcej niż sam wynik LDL-C.',
    },
    articles: [
      ['ApoB norma, cena i wynik', 'apob-norma-cena-jak-czytac-wynik.html', 'interpretacja'],
      ['Dieta keto a cholesterol', 'dieta-keto-cholesterol-ldl-hdl-badania-naukowe.html', 'dieta'],
      ['Markery krwi po 50', 'markery-krwi-co-naprawde-mowia-o-twoim-zdrowiu.html', 'badania'],
      ['Badania krwi po 50', 'badania-krwi-po-50-jak-czesto.html', 'częstotliwość'],
      ['Dieta przeciwzapalna', 'dieta-przeciwzapalna-po-50-produkty-jadlospis.html', 'styl życia'],
    ],
    assets: ['Jak czytać lipidogram w szerszym kontekście', 'Jak odróżnić ApoB, ApoA1 i LDL-C', 'Jak przygotować pytania do omówienia z lekarzem'],
  },
  {
    file: 'centrum-metabolizmu-po-50.html',
    title: 'Metabolizm i brzuch po 50',
    description: 'Oponka, tłuszcz trzewny, kortyzol, cukier, post przerywany i realistyczne strategie bez karania się dietą.',
    kicker: 'Centrum energii',
    icon: '🔥',
    accent: '#c96c3f',
    accentSoft: '#fff0e8',
    promise: 'Tu nie chodzi o cudowny trik. Chodzi o rozpoznanie, czy problemem jest ruch, sen, stres, jedzenie czy ich miks.',
    focus: 'Od obwodu pasa do nawyków',
    focusLead: 'Sprawdź możliwe przyczyny rosnącego obwodu pasa bez dokładania kolejnej listy zakazów.',
    steps: ['Tłuszcz trzewny', 'Kortyzol', 'Cukier', 'Nawyki'],
    featured: {
      title: 'Jak pozbyć się oponki po 50?',
      url: 'jak-pozbyc-sie-oponki-brzusznej-po-50.html',
      text: 'Zobacz, jak połączyć dietę, ruch i stres w rozsądny plan zmniejszania obwodu pasa.',
    },
    articles: [
      ['MIT: metabolizm po 50', 'mit-metabolizm-po-50-zwalnia-tycie.html', 'mit/fakty'],
      ['Tłuszcz trzewny', 'tluszcz-trzewny-choroby-jak-walczyc.html', 'ryzyko'],
      ['Jak obniżyć kortyzol', 'jak-obnizyc-kortyzol-po-50-stres-oponka-brzuszna.html', 'stres'],
      ['Ukryty cukier po 50', 'ukryty-cukier-po-50-pulapki-zdrowego-jedzenia.html', 'jedzenie'],
      ['Post przerywany po 50', 'post-przerywany-intermittent-fasting-po-50-korzysci-metaboliczne-ryzyko-utraty-miesni.html', 'strategia'],
      ['Waga smart i skład ciała', 'waga-smart-pomiar-skladu-ciala-prawda.html', 'pomiar'],
    ],
    assets: ['Jak prawidłowo mierzyć obwód pasa', 'Jak przejść od możliwej przyczyny do konkretnej zmiany', 'Jak wybrać prosty nawyk na najbliższe 14 dni'],
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHeader() {
  return `    <header class="hub-topbar">
      <a class="hub-brand" href="index.html" aria-label="FitPo50 — centra tematyczne">
        <img class="hub-brand__logo" src="./assets/logo-fitpo50.png" alt="Logo FitPo50" width="112" height="112" loading="eager" fetchpriority="high" decoding="async" onerror="this.style.display='none'">
        <span class="hub-brand__text">
          <span class="hub-brand__name">FitPo50</span>
          <span class="hub-brand__tagline">WRÓĆ DO FORMY<br>PO 50-TCE</span>
        </span>
      </a>
      <nav class="hub-nav" aria-label="Menu centrum tematycznego">
        <a href="index.html">Home</a>
        <a href="index.html#centra-tematyczne" class="is-active">Centra</a>
        <a href="porady.html">Porady</a>
        <a href="rusz-sie.html">Ruch</a>
        <a href="jedzenie.html">Jedzenie</a>
        <a href="zdrowie.html">Zdrowie</a>
        <a href="ciekawe.html">Ciekawe</a>
      </nav>
      <form class="hub-searchbar" action="search.html" role="search">
        <span aria-hidden="true">🔎</span>
        <input name="q" type="search" placeholder="Szukaj w FitPo50...">
      </form>
    </header>`;
}

function renderFooter() {
  return `    <footer class="site-footer-bento" aria-label="Stopka FitPo50">
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
            <li><a href="index.html#centra-tematyczne">Centra</a></li>
            <li><a href="porady.html">Porady</a></li>
            <li><a href="rusz-sie.html">Ruch</a></li>
            <li><a href="jedzenie.html">Jedzenie</a></li>
            <li><a href="zdrowie.html">Zdrowie</a></li>
            <li><a href="ciekawe.html">Ciekawe</a></li>
            <li><a href="o-mnie.html">O mnie</a></li>
          </ul>
        </section>
      </div>

      <div class="site-footer-bento__bottom">
        <p class="site-footer-bento__copy">© 2026 FitPo50 | <a href="polityka-prywatnosci.html">Polityka Prywatności i Cookies</a></p>
        <p class="site-footer-bento__note">Ważna informacja: nie jestem lekarzem. Treści na stronie mają charakter edukacyjny i informacyjny, nie zastępują konsultacji medycznej ani indywidualnych zaleceń specjalisty.</p>
      </div>
    </footer>`;
}

function renderHub(hub) {
  const articleLinks = hub.articles
    .map(([title, url, label]) => `              <a class="hub-article-link" href="${escapeHtml(url)}"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(label)}</small></span><span class="hub-article-link__cta">czytaj →</span></a>`)
    .join('\n');
  const steps = hub.steps
    .map((step, index) => `            <div class="hub-path__step"><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(step)}</div>`)
    .join('\n');
  const assets = hub.assets
    .map((asset) => `              <li>${escapeHtml(asset)}</li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover">
  <title>${escapeHtml(hub.title)} | FitPo50</title>
  <meta name="description" content="${escapeHtml(hub.description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="https://fitpo50.pl/${escapeHtml(hub.file)}">
  <link rel="stylesheet" href="./base.css">
  <link rel="stylesheet" href="./style.css?v=1.4">
  <link rel="stylesheet" href="./assets/footer.css?v=1">
  <link rel="stylesheet" href="./assets/topic-hub.css">
  <link rel="icon" href="./favicon.png" type="image/png">
  <link rel="apple-touch-icon" href="./favicon.png">
  <script>
    (function () {
      try {
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var isPhone = window.matchMedia && (window.matchMedia('(max-width: 820px)').matches || window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        var hour = new Date().getHours();
        var isNight = hour >= 19 || hour < 7;
        if (prefersDark || (isPhone && isNight)) document.documentElement.classList.add('night-shell');
      } catch (_) {}
    })();
  </script>
</head>
<body style="--hub-accent:${hub.accent};--hub-accent-soft:${hub.accentSoft};">
  <div class="hub-shell">
${renderHeader()}
    <main>
      <section class="hub-hero" aria-labelledby="hub-title">
        <div class="hub-hero__copy">
          <div class="hub-breadcrumb"><a href="index.html#centra-tematyczne">Centra tematyczne</a><span>›</span><span>${escapeHtml(hub.title)}</span></div>
          <span class="hub-kicker">${escapeHtml(hub.kicker)}</span>
          <h1 id="hub-title">${escapeHtml(hub.title)}</h1>
          <p class="hub-hero__lead">${escapeHtml(hub.description)}</p>
          <div class="hub-promise">${escapeHtml(hub.promise)}</div>
          <div class="hub-actions">
            <a class="hub-btn" href="#najwazniejsze-artykuly">Przejdź do artykułów</a>
            <a class="hub-btn hub-btn--secondary" href="index.html#centra-tematyczne">Wróć do centrów</a>
          </div>
        </div>
        <aside class="hub-hero__panel" aria-label="Podsumowanie centrum">
          <div class="hub-focus-card">
            <span class="hub-focus-card__icon" aria-hidden="true">${hub.icon}</span>
            <strong>${escapeHtml(hub.focus)}</strong>
            <span>${escapeHtml(hub.focusLead)}</span>
          </div>
          <div class="hub-metrics">
            <div class="hub-metric"><strong>${hub.articles.length + 1}</strong><span>artykułów w centrum</span></div>
            <div class="hub-metric"><strong>${hub.assets.length}</strong><span>praktyczne pytania</span></div>
          </div>
        </aside>
      </section>
      <section class="hub-section" aria-labelledby="sciezka-title">
        <div class="hub-section__head">
          <div>
            <h2 id="sciezka-title">Od czego zacząć?</h2>
            <p>Przejdź przez temat po kolei: od podstaw i pomiarów do praktycznych decyzji, które możesz zastosować w swoim życiu.</p>
          </div>
        </div>
        <div class="hub-path">
${steps}
        </div>
      </section>
      <section class="hub-content-grid" aria-label="Zawartość centrum">
        <div class="hub-section" id="najwazniejsze-artykuly">
          <h2>Najważniejsze artykuły</h2>
          <a class="hub-featured" href="${escapeHtml(hub.featured.url)}">
            <span><small>Start tutaj</small><strong>${escapeHtml(hub.featured.title)}</strong><p>${escapeHtml(hub.featured.text)}</p></span>
            <span class="hub-featured__arrow">→</span>
          </a>
          <div class="hub-article-list">
${articleLinks}
          </div>
        </div>
        <aside class="hub-side-card">
          <h3>W praktyce</h3>
          <p class="hub-side-card__lead">Najważniejsze pytania, które uporządkujesz dzięki materiałom z tego centrum.</p>
          <ul class="hub-asset-list">
${assets}
          </ul>
          <div class="hub-note"><strong>Prosty start:</strong> najpierw przeczytaj materiał oznaczony „Start tutaj”. Potem wybierz z listy temat, który chcesz pogłębić.</div>
          <div class="hub-actions">
            <a class="hub-btn" href="index.html#centra-tematyczne">Wróć do centrów</a>
            <a class="hub-btn hub-btn--secondary" href="porady.html">Czytelnia</a>
          </div>
        </aside>
      </section>
    </main>
${renderFooter()}
  </div>
  <script src="./dist/app.js?v=1.2" defer></script>
</body>
</html>
`;
}

for (const hub of hubs) {
  const html = renderHub(hub);
  fs.writeFileSync(path.join(ROOT, hub.file), html, 'utf8');
  fs.mkdirSync(path.join(ROOT, '_site'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '_site', hub.file), html, 'utf8');
  console.log(`updated ${hub.file}`);
}

fs.mkdirSync(path.join(ROOT, '_site', 'assets'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'assets', 'topic-hub.css'), path.join(ROOT, '_site', 'assets', 'topic-hub.css'));
console.log('updated _site/assets/topic-hub.css');
