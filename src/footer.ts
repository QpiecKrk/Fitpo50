(() => {
  const styleId = 'fitpo50-unified-footer-style';
  const footerId = 'fitpo50-unified-footer';

  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      :root {
        --fp-footer-bg: #262f41;
        --fp-footer-bg-2: #202837;
        --fp-footer-line: #3a475f;
        --fp-footer-text: #d7e0ef;
        --fp-footer-soft: #aebad1;
        --fp-footer-title: #f0f5ff;
        --fp-footer-link: #d8e2f3;
        --fp-footer-accent: #c29a86;
      }

      .site-footer-bento {
        margin-top: clamp(20px, 3vw, 34px);
        border: 1px solid var(--fp-footer-line);
        border-radius: 18px;
        background: linear-gradient(180deg, var(--fp-footer-bg) 0%, var(--fp-footer-bg-2) 100%);
        color: var(--fp-footer-text);
        box-shadow: 0 14px 32px rgba(8, 12, 20, 0.24);
        padding: clamp(16px, 2.4vw, 24px);
      }

      .site-footer-bento,
      .site-footer-bento * {
        font-family: "Work Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif !important;
      }

      .site-footer-bento__grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: clamp(14px, 2vw, 22px);
      }

      .site-footer-bento__card {
        border: 1px solid #334157;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.02);
        padding: clamp(14px, 2vw, 18px);
        min-width: 0;
      }

      .site-footer-bento__brand {
        display: flex;
        gap: 14px;
        align-items: center;
        margin-bottom: 10px;
      }

      .site-footer-bento__logo {
        width: clamp(76px, 9vw, 112px);
        height: clamp(76px, 9vw, 112px);
        border-radius: 14px;
        object-fit: contain;
        border: 1px solid var(--fp-footer-line);
        flex: 0 0 auto;
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
      }

      .site-footer-bento__title {
        margin: 0;
        color: var(--fp-footer-title);
        font-size: clamp(1.04rem, 1.5vw, 1.2rem);
        letter-spacing: 0.01em;
        font-weight: 700;
      }

      .site-footer-bento__lead {
        margin: 8px 0 0;
        color: var(--fp-footer-soft);
        line-height: 1.58;
        font-size: 0.93rem;
        font-weight: 500;
        letter-spacing: 0;
      }

      .site-footer-bento__links-title {
        margin: 0 0 10px;
        color: var(--fp-footer-title);
        font-size: 0.95rem;
        letter-spacing: 0.01em;
        font-weight: 700;
      }

      .site-footer-bento__links {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px 12px;
      }

      .site-footer-bento__links a {
        color: var(--fp-footer-link);
        text-decoration: none;
        font-size: 0.91rem;
        line-height: 1.35;
        font-weight: 500;
        letter-spacing: 0;
      }

      .site-footer-bento__links a:hover {
        color: #ffffff;
        text-decoration: underline;
        text-decoration-color: var(--fp-footer-accent);
        text-underline-offset: 2px;
      }

      .site-footer-bento__bottom {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--fp-footer-line);
        display: grid;
        gap: 8px;
      }

      @media (min-width: 821px) {
        .site-footer-bento {
          height: 292px;
        }

        .site-footer-bento__grid {
          min-height: 180px;
        }
      }

      .site-footer-bento__copy {
        margin: 0;
        font-size: 0.85rem;
        color: #dce6f8;
        font-weight: 600;
      }

      .site-footer-bento__copy a {
        color: #e4edf8;
        text-decoration: none;
      }

      .site-footer-bento__copy a:hover {
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .site-footer-bento__note {
        margin: 0;
        font-size: 0.75rem;
        color: #aab7cf;
        line-height: 1.6;
        white-space: nowrap;
        font-weight: 500;
        letter-spacing: 0;
      }

      @media (max-width: 820px) {
        .site-footer-bento__grid {
          grid-template-columns: 1fr;
        }

        .site-footer-bento__links {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const oldFooters = Array.from(document.querySelectorAll('footer'));
  oldFooters.forEach((footer) => footer.remove());

  // Normalize top navigation spacing to match index.html exactly.
  document.querySelectorAll<HTMLElement>('.menu').forEach((menu) => {
    menu.style.padding = '0 16px';
    menu.style.gap = '18px';
    menu.style.fontWeight = '600';
    menu.style.whiteSpace = 'nowrap';
    menu.style.letterSpacing = 'normal';
    menu.style.wordSpacing = 'normal';
    menu.style.fontKerning = 'normal';
  });

  document.querySelectorAll<HTMLAnchorElement>('.menu a').forEach((link) => {
    link.style.padding = '6px 2px';
    link.style.letterSpacing = 'normal';
    link.style.wordSpacing = 'normal';
    link.style.fontKerning = 'normal';
  });

  if (document.getElementById(footerId)) return;

  const footer = document.createElement('footer');
  footer.id = footerId;
  footer.className = 'site-footer-bento';

  footer.innerHTML = `
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
  `;

  const shell = document.querySelector('.shell');
  if (shell) {
    shell.appendChild(footer);
  } else {
    document.body.appendChild(footer);
  }
})();
