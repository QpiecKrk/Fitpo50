/* ============================================================
   FitPo50 — Application TypeScript (converted from JavaScript)
   Dark mode, accordions, scroll animations, mobile nav
   ============================================================ */

(function () {
  'use strict';

  // ----------------------------------------------------------
  // DARK MODE TOGGLE
  // ----------------------------------------------------------
  const themeToggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const root = document.documentElement;
  let currentTheme: 'dark' | 'light' = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', currentTheme);
  updateThemeIcon();

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', currentTheme);
      updateThemeIcon();
    });
  }

  function updateThemeIcon() {
    if (!themeToggle) return;
    if (currentTheme === 'dark') {
      themeToggle.setAttribute('aria-label', 'Przełącz na tryb jasny');
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    } else {
      themeToggle.setAttribute('aria-label', 'Przełącz na tryb ciemny');
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  }

  // ----------------------------------------------------------
  // MOBILE NAV TOGGLE
  // ----------------------------------------------------------
  const navToggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
  const nav = document.getElementById('main-nav');
  const body = document.body;
  let navOpen = false;

  if (navToggle && nav) {
    const defaultNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    const closeNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const navLinks = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.nav__link'));

    navToggle.setAttribute('aria-controls', 'main-nav');

    const setNavState = (open: boolean) => {
      navOpen = open;
      nav.classList.toggle('is-open', navOpen);
      body.classList.toggle('nav-open', navOpen);
      navToggle.setAttribute('aria-expanded', String(navOpen));
      navToggle.setAttribute('aria-label', navOpen ? 'Zamknij menu nawigacji' : 'Otwórz menu nawigacji');
      navToggle.innerHTML = navOpen ? closeNavIcon : defaultNavIcon;
    });

    navToggle.addEventListener('click', () => {
      setNavState(!navOpen);
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navOpen) {
          setNavState(false);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navOpen) {
        setNavState(false);
        navToggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (!navOpen || window.innerWidth >= 768) return;
      const target = event.target as Node;
      if (!nav.contains(target) && !navToggle.contains(target)) {
        setNavState(false);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && navOpen) {
        setNavState(false);
      }
    });
  }

  // ----------------------------------------------------------
  // HEADER SCROLL BEHAVIOR (hide on scroll down, show on up)
  // ----------------------------------------------------------
  const header = document.querySelector<HTMLElement>('.header');
  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateHeader() {
    const scrollY = window.scrollY;
    if (scrollY > 80) {
      if (scrollY > lastScrollY && scrollY > 200) {
        header?.classList.add('header--hidden');
      } else {
        header?.classList.remove('header--hidden');
      }
      header?.style.boxShadow = 'var(--shadow-sm)';
    } else {
      header?.classList.remove('header--hidden');
      header?.style.boxShadow = 'none';
    }
    lastScrollY = scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });

  // ----------------------------------------------------------
  // ARTICLE ACCORDIONS
  // ----------------------------------------------------------
  const articleCards = document.querySelectorAll<HTMLElement>('.article-card');

  articleCards.forEach(card => {
    const header = card.querySelector<HTMLElement>('.article-card__header');
    const body = card.querySelector<HTMLElement>('.article-card__body');
    if (!header || !body) return;

    function toggleCard() {
      const isOpen = card.classList.contains('is-open');
      // Close all other cards
      articleCards.forEach(otherCard => {
        if (otherCard !== card && otherCard.classList.contains('is-open')) {
          otherCard.classList.remove('is-open');
          const otherHeader = otherCard.querySelector<HTMLElement>('.article-card__header');
          if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
        }
      });
      // Toggle current
      card.classList.toggle('is-open', !isOpen);
      header.setAttribute('aria-expanded', String(!isOpen));
      // Scroll into view if opening
      if (!isOpen) {
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }

    header.addEventListener('click', toggleCard);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCard();
      }
    });
  });

  // ----------------------------------------------------------
  // ARTICLE CATALOG SEARCH
  // ----------------------------------------------------------
  const articleSearchInput = document.querySelector<HTMLInputElement>('[data-article-search]');
  const articleSearchClear = document.querySelector<HTMLButtonElement>('[data-article-search-clear]');
  const articleItems = Array.from(document.querySelectorAll<HTMLElement>('[data-article-item]'));
  const articleCountTargets = document.querySelectorAll<HTMLElement>('[data-article-count]');
  const articleSearchStatus = document.querySelector<HTMLElement>('[data-search-status]');
  const articleSearchEmpty = document.querySelector<HTMLElement>('[data-search-empty]');
  const articleSearchMatches = document.querySelector<HTMLElement>('[data-search-matches]');
  const articleResults = document.querySelector<HTMLElement>('[data-article-results]');
  const articleSearchResultsStrip = document.querySelector<HTMLElement>('[data-search-results-strip]');
  const articleMoreWrap = document.querySelector<HTMLElement>('[data-article-more-wrap]');
  const articleMoreButton = document.querySelector<HTMLButtonElement>('[data-article-more]');
  const categoryFilters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-category-filter]'));
  const articleSort = document.querySelector<HTMLSelectElement>('[data-article-sort]');
  const catalogSummary = document.querySelector<HTMLElement>('[data-catalog-summary]');

  if (articleSearchInput && articleItems.length > 0) {
    let searchCommitted = false;
    let articlesExpanded = false;
    const initialVisibleArticles = 8;
    let activeCategory = 'all';
    let activeSort = 'newest';
    const categoryLabels: Record<string, string> = {
      all: 'we wszystkich kategoriach',
      start: 'w kategorii Start',
      motywacja: 'w kategorii Motywacja',
      odzywianie: 'w kategorii Odżywianie',
      suplementacja: 'w kategorii Suplementacja',
      wiedza: 'w kategorii Wiedza'
    };

    const normalize = (value: string) =>
      value
        .toLocaleLowerCase('pl-PL')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const getReadTimeValue = (value: string) => {
      const match = value.match(/\d+/);
      return match ? Number(match[0]) : 999;
    };

    const updateArticleSearch = () => {
      const query = normalize(articleSearchInput.value);
      const sortedItems = [...articleItems].sort((a, b) => {
        if (activeSort === 'alphabetical') {
          const aTitle = a.dataset.articleTitle ?? '';
          const bTitle = b.dataset.articleTitle ?? '';
          return aTitle.localeCompare(bTitle, 'pl');
        }

        if (activeSort === 'shortest') {
          const aTime = getReadTimeValue(a.dataset.readTime ?? '');
          const bTime = getReadTimeValue(b.dataset.readTime ?? '');
          return aTime - bTime;
        }

        const aOrder = Number(a.dataset.order ?? '0');
        const bOrder = Number(b.dataset.order ?? '0');
        return bOrder - aOrder;
      });

      sortedItems.forEach(item => {
        articleResults?.appendChild(item);
      });

      let visibleCount = 0;
      const matchedArticles: Array<{ title: string; href: string }> = [];

      sortedItems.forEach(item => {
        const searchText = normalize(item.dataset.searchText ?? item.textContent ?? '');
        const category = item.dataset.category ?? 'all';
        const matchesQuery = query.length === 0 || searchText.includes(query);
        const matchesCategory = activeCategory === 'all' || category === activeCategory;
        const matches = matchesQuery && matchesCategory;

        if (matches) {
          visibleCount += 1;
          const title = item.dataset.articleTitle ?? item.textContent?.trim() ?? 'Artykuł';
          const href = item.getAttribute('href') ?? '#';
          matchedArticles.push({ title, href });
        }
        const shouldCollapse = query.length === 0 && !articlesExpanded && matches && visibleCount > initialVisibleArticles;
        item.hidden = !matches || shouldCollapse;
      });

      articleCountTargets.forEach(target => {
        target.textContent = String(visibleCount);
      });

      if (catalogSummary) {
        const categoryLabel = categoryLabels[activeCategory] ?? 'we wszystkich kategoriach';
        catalogSummary.textContent = `${visibleCount} ${visibleCount === 1 ? 'artykuł' : visibleCount < 5 ? 'artykuły' : 'artykułów'} ${categoryLabel}`;
      }

      if (articleSearchStatus) {
        articleSearchStatus.textContent = query.length === 0
          ? 'Wpisz słowo i zobacz, w których artykułach występuje temat.'
          : visibleCount > 0
            ? `Znaleziono ${visibleCount} ${visibleCount === 1 ? 'artykuł' : visibleCount < 5 ? 'artykuły' : 'artykułów'} dla frazy "${articleSearchInput.value.trim()}".`
            : `Brak wyników dla frazy "${articleSearchInput.value.trim()}".`;
      }

      if (articleSearchMatches) {
        articleSearchMatches.innerHTML = '';
        articleSearchMatches.hidden = query.length === 0 || matchedArticles.length === 0;
        articleSearchResultsStrip?.classList.toggle('is-visible', searchCommitted && query.length > 0 && matchedArticles.length > 0);

        if (query.length > 0 && matchedArticles.length > 0) {
          matchedArticles.forEach(article => {
            const link = document.createElement('a');
            link.className = 'search-match';
            link.href = article.href;
            link.textContent = article.title;
            articleSearchMatches.appendChild(link);
          });
        }
      }

      if (articleSearchEmpty) {
        articleSearchEmpty.hidden = visibleCount > 0;
      }

      if (articleMoreWrap && articleMoreButton) {
        const hiddenByCollapse = query.length === 0 && !articlesExpanded && visibleCount > initialVisibleArticles;
        articleMoreWrap.hidden = !hiddenByCollapse;
        if (hiddenByCollapse) {
          const remaining = visibleCount - initialVisibleArticles;
          articleMoreButton.textContent = `Pokaz jeszcze ${remaining} ${remaining === 1 ? 'artykuł' : remaining < 5 ? 'artykuły' : 'artykułów'}`;
        }
      }

      if (!searchCommitted || query.length === 0 || matchedArticles.length === 0) {
        articleSearchResultsStrip?.classList.remove('is-visible');
      }

      if (articleSearchClear) {
        articleSearchClear.hidden = query.length === 0;
      }
    };

    articleSearchInput.addEventListener('input', () => {
      searchCommitted = false;
      updateArticleSearch();
    });
    articleSearchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      searchCommitted = true;
      updateArticleSearch();

      const target = articleSearchMatches && !articleSearchMatches.hidden && articleSearchMatches.childElementCount > 0
        ? articleSearchMatches
        : !articleSearchEmpty?.hidden
          ? articleSearchEmpty
          : articleResults;

      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    articleSearchClear?.addEventListener('click', () => {
      searchCommitted = false;
      articlesExpanded = false;
      articleSearchInput.value = '';
      updateArticleSearch();
      articleSearchInput.focus();
    });

    categoryFilters.forEach(filter => {
      filter.addEventListener('click', () => {
        activeCategory = filter.dataset.categoryFilter ?? 'all';
        articlesExpanded = false;
        categoryFilters.forEach(button => {
          button.classList.toggle('is-active', button === filter);
        });
        updateArticleSearch();
      });
    });

    articleSort?.addEventListener('change', () => {
      activeSort = articleSort.value;
      articlesExpanded = false;
      updateArticleSearch();
    });

    articleMoreButton?.addEventListener('click', () => {
      articlesExpanded = true;
      updateArticleSearch();
    });

    updateArticleSearch();
  }

  // ----------------------------------------------------------
  // SCROLL REVEAL (IntersectionObserver)
  // ----------------------------------------------------------
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ----------------------------------------------------------
  // SMOOTH SCROLL for hash links
  // ----------------------------------------------------------
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId === '#' || targetId === '#top') return; // let default handle #top
      const target = document.querySelector<HTMLElement>(targetId!);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Update URL hash without scrolling
        history.pushState(null, '', targetId);
      }
    });
  });

})();
