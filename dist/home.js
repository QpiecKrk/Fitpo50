/* ============================================================
   FitPo50 — lightweight homepage runtime
   Keeps only index-critical interactions to reduce JS cost.
   ============================================================ */
(function () {
  'use strict';

  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  let currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', currentTheme);

  const setThemeIcon = () => {
    if (!themeToggle) return;
    if (currentTheme === 'dark') {
      themeToggle.setAttribute('aria-label', 'Przełącz na tryb jasny');
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    } else {
      themeToggle.setAttribute('aria-label', 'Przełącz na tryb ciemny');
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  };

  setThemeIcon();
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', currentTheme);
      setThemeIcon();
    });
  }

  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');
  const header = document.querySelector('.header');
  const body = document.body;
  let navOpen = false;

  if (navToggle && nav) {
    if (header && nav.parentElement !== header) {
      header.appendChild(nav);
    }

    const navLinks = Array.from(nav.querySelectorAll('.nav__link'));
    const burgerIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    const setNavState = (open) => {
      navOpen = open;
      nav.classList.toggle('is-open', navOpen);
      body.classList.toggle('nav-open', navOpen);
      navToggle.setAttribute('aria-expanded', String(navOpen));
      navToggle.innerHTML = navOpen ? closeIcon : burgerIcon;
    };

    navToggle.addEventListener('click', () => setNavState(!navOpen));
    navLinks.forEach((link) => link.addEventListener('click', () => navOpen && setNavState(false)));
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && navOpen) setNavState(false);
    });
  }

  // Header hide/show on scroll with rAF throttling.
  let lastScrollY = window.scrollY;
  let ticking = false;
  const updateHeader = () => {
    const scrollY = window.scrollY;
    if (header) {
      if (scrollY > 80) {
        if (scrollY > lastScrollY && scrollY > 200) header.classList.add('header--hidden');
        else header.classList.remove('header--hidden');
        header.style.boxShadow = 'var(--shadow-sm)';
      } else {
        header.classList.remove('header--hidden');
        header.style.boxShadow = 'none';
      }
    }
    lastScrollY = scrollY;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateHeader);
    }
  }, { passive: true });

  // Hero parallax only on desktop and only when motion is allowed.
  (() => {
    const heroBg = document.querySelector('.hero__bg');
    if (!heroBg) return;

    const desktopMq = window.matchMedia('(min-width: 992px)');
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let parallaxTicking = false;

    const resetTransform = () => { heroBg.style.transform = ''; };
    const updateParallax = () => {
      const scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        heroBg.style.transform = 'translate3d(0,' + (scrolled * 0.15) + 'px,0)';
      }
      parallaxTicking = false;
    };

    const onScroll = () => {
      if (!desktopMq.matches || motionMq.matches) return;
      if (parallaxTicking) return;
      parallaxTicking = true;
      window.requestAnimationFrame(updateParallax);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    const onModeChange = () => (!desktopMq.matches || motionMq.matches) ? resetTransform() : onScroll();

    if (typeof desktopMq.addEventListener === 'function') {
      desktopMq.addEventListener('change', onModeChange);
      motionMq.addEventListener('change', onModeChange);
    } else {
      desktopMq.addListener(onModeChange);
      motionMq.addListener(onModeChange);
    }
  })();

  // Reveal-on-scroll.
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // Smooth scroll for hash links.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#' || targetId === '#top') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', targetId);
    });
  });
})();
