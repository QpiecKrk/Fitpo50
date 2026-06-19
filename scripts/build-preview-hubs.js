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
    focusLead: 'Ścieżka prowadzi od maszyn i prostych zasad do siły, postawy i regularności.',
    steps: ['Start bez bólu', 'Maszyny i technika', 'Progresja ciężaru', 'Regeneracja'],
    featured: {
      title: 'Jak zacząć na siłowni po 50?',
      url: 'jak-zaczac-na-silowni-po-50.html',
      text: 'Najlepszy punkt wejścia, jeśli ktoś wraca po latach albo zaczyna od zera.',
    },
    articles: [
      ['Trening maszynowy po 50', 'trening-maszynowy-po-50.html', 'plan 30 dni'],
      ['7 błędów na siłowni po 50', 'siedem-bledow-silownia-po-50.html', 'bezpieczeństwo'],
      ['Siła chwytu po 50', 'sila-chwytu-po-50.html', 'marker sprawności'],
      ['Trening 3x30 po 50', 'trening-3x30-dla-50-plus.html', 'minimum skuteczne'],
      ['Trening siłowy chroni serce', 'silownia-chroni-serce-przed-zawalem.html', 'serce'],
    ],
    assets: ['Plan startowy: od maszyn do wolnych ciężarów', 'Mapa błędów: ćwiczenie → sygnał ostrzegawczy → korekta', 'Prosty schemat: kiedy zwiększyć obciążenie'],
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
    focusLead: 'Czytelnik ma szybko zrozumieć ile, kiedy i z czego zjeść białko.',
    steps: ['Ile gramów?', 'Porcja na posiłek', 'Produkty', 'WPC czy WPI'],
    featured: {
      title: 'Ile białka po 50 roku życia?',
      url: 'ile-bialka-po-50-roku-zycia-zapotrzebowanie-odzywki.html',
      text: 'Główny przewodnik po dawkowaniu, talerzu i odżywkach bez przesady.',
    },
    articles: [
      ['Kreatyna i białko po 50', 'kreatyna-i-bialko-po-50-tce-jak-laczyc.html', 'łączenie'],
      ['Kreatyna po 50', 'kreatyna-po-50-tce-kompletny-przewodnik.html', 'suplementacja'],
      ['Sarkopeniczna otyłość', 'sarkopeniczna-otylosc-problem-ktorego-nie-widac-w-lustrze.html', 'mięśnie'],
      ['Jedz więcej po 50', 'jedz-wiecej-po-50.html', 'energia'],
      ['Suplementy po 50', 'suplementy-po-50-tce-kompletny-przewodnik.html', 'wybór'],
    ],
    assets: ['Translator porcji: produkty → gramy białka', 'Kalkulator dawki według masy ciała', 'Schemat rozłożenia białka w ciągu dnia'],
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
    focusLead: 'Ścieżka pomaga odróżnić higienę snu od sygnałów, z którymi warto iść do lekarza.',
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
    assets: ['Checklista wieczornej rutyny', 'Mapa pobudek nocnych: objaw → możliwa przyczyna → pierwszy krok', 'Plan 7 spokojniejszych nocy'],
  },
  {
    file: 'centrum-nadcisnienia-po-50.html',
    title: 'Nadciśnienie po 50',
    description: 'Ciśnienie, elastyczność naczyń, dieta DASH, marsz, trening siłowy i domowe pomiary bez straszenia.',
    kicker: 'Centrum serca',
    icon: '🫀',
    accent: '#d85d5d',
    accentSoft: '#fff0f0',
    promise: 'To centrum ma porządkować decyzje: co mierzyć, co zmienić w stylu życia i kiedy nie zwlekać z lekarzem.',
    focus: 'Od pomiaru do planu działania',
    focusLead: 'Czytelnik dostaje spokojną mapę: pomiar, żywienie, ruch, sygnały alarmowe.',
    steps: ['Pomiar', 'Naczynia', 'DASH', 'Ruch'],
    featured: {
      title: 'Nadciśnienie i elastyczność naczyń',
      url: 'nadcisnienie-tetnicze-jak-odzyskac-elastycznosc-naczyn.html',
      text: 'Nowy przewodnik o tym, jak naczynia, dieta i ruch wpływają na ciśnienie po 50.',
    },
    articles: [
      ['Trening siłowy przy ciśnieniu', 'trening-silowy-po-50-cisnienie-plan-8-tygodni.html', 'plan'],
      ['Siłownia chroni serce', 'silownia-chroni-serce-przed-zawalem.html', 'serce'],
      ['Wydolność VO2max po 50', 'wydolnosc-vo2max-starzenie-po-50.html', 'kondycja'],
      ['Tłuszcz trzewny', 'tluszcz-trzewny-choroby-jak-walczyc.html', 'ryzyko'],
      ['Badania po 50', 'badania-po-50.html', 'kontrola'],
    ],
    assets: ['Karta domowych pomiarów ciśnienia', 'Tabela: wynik → znaczenie → następny krok', 'Lista pytań na wizytę lekarską'],
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
    focusLead: 'Centrum ma pomóc czytelnikowi rozumieć lipidogram, ApoB i kontekst metaboliczny.',
    steps: ['Lipidogram', 'ApoB/ApoA1', 'Ryzyko', 'Pytania'],
    featured: {
      title: 'ApoB i ApoA1 po 50',
      url: 'apob-apoa-badania-cholesterol.html',
      text: 'Najważniejszy tekst w klastrze: porządkuje markery, które często mówią więcej niż sam LDL.',
    },
    articles: [
      ['ApoB norma, cena i wynik', 'apob-norma-cena-jak-czytac-wynik.html', 'interpretacja'],
      ['Dieta keto a cholesterol', 'dieta-keto-cholesterol-ldl-hdl-badania-naukowe.html', 'dieta'],
      ['Markery krwi po 50', 'markery-krwi-co-naprawde-mowia-o-twoim-zdrowiu.html', 'badania'],
      ['Badania krwi po 50', 'badania-krwi-po-50-jak-czesto.html', 'częstotliwość'],
      ['Dieta przeciwzapalna', 'dieta-przeciwzapalna-po-50-produkty-jadlospis.html', 'styl życia'],
    ],
    assets: ['Tabela interpretacji lipidogramu', 'Ściąga: ApoB, ApoA1 i LDL bez chaosu', 'Lista pytań do omówienia z lekarzem'],
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
    focusLead: 'Czytelnik ma dostać praktyczną mapę przyczyn, a nie kolejną listę zakazów.',
    steps: ['Tłuszcz trzewny', 'Kortyzol', 'Cukier', 'Nawyki'],
    featured: {
      title: 'Jak pozbyć się oponki po 50?',
      url: 'jak-pozbyc-sie-oponki-brzusznej-po-50.html',
      text: 'Centralny przewodnik po brzuchu, który łączy dietę, ruch i stres.',
    },
    articles: [
      ['Tłuszcz trzewny', 'tluszcz-trzewny-choroby-jak-walczyc.html', 'ryzyko'],
      ['Jak obniżyć kortyzol', 'jak-obnizyc-kortyzol-po-50-stres-oponka-brzuszna.html', 'stres'],
      ['Ukryty cukier po 50', 'ukryty-cukier-po-50-pulapki-zdrowego-jedzenia.html', 'jedzenie'],
      ['Post przerywany po 50', 'post-przerywany-intermittent-fasting-po-50-korzysci-metaboliczne-ryzyko-utraty-miesni.html', 'strategia'],
      ['Waga smart i skład ciała', 'waga-smart-pomiar-skladu-ciala-prawda.html', 'pomiar'],
    ],
    assets: ['Checklista obwodu pasa i prostych pomiarów', 'Mapa: przyczyna → co sprawdzić → co zmienić', 'Plan 14 dni prostych nawyków'],
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
  <link rel="icon" href="./assets/logo.jpg" type="image/jpeg">
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
            <a class="hub-btn" href="#najwazniejsze-artykuly">Zobacz ścieżkę</a>
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
            <div class="hub-metric"><strong>${hub.articles.length + 1}</strong><span>artykułów w ścieżce</span></div>
            <div class="hub-metric"><strong>${hub.assets.length}</strong><span>praktyczne narzędzia</span></div>
          </div>
        </aside>
      </section>
      <section class="hub-section" aria-labelledby="sciezka-title">
        <div class="hub-section__head">
          <div>
            <h2 id="sciezka-title">Jak czytać to centrum?</h2>
            <p>To nie jest przypadkowa lista linków. To kolejność, która pomaga wejść w temat od podstaw do decyzji praktycznych.</p>
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
          <h3>Praktyczne narzędzia</h3>
          <p class="hub-side-card__lead">Krótkie ściągi i mapy decyzji, które pomagają przejść od czytania do działania.</p>
          <ul class="hub-asset-list">
${assets}
          </ul>
          <div class="hub-note"><strong>Jak korzystać:</strong> zacznij od artykułu startowego, potem wybierz jeden problem z listy i przejdź do tekstu szczegółowego.</div>
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
