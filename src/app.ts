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
  const header = document.querySelector<HTMLElement>('.header');
  const body = document.body;
  let navOpen = false;

  if (navToggle && nav) {
    if (header && nav.parentElement !== header) {
      header.appendChild(nav);
    }

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
    };

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
      if (header) header.style.boxShadow = 'var(--shadow-sm)';
    } else {
      header?.classList.remove('header--hidden');
      if (header) header.style.boxShadow = 'none';
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
      const currentHeader = card.querySelector<HTMLElement>('.article-card__header');
      card.classList.toggle('is-open', !isOpen);
      if (currentHeader) currentHeader.setAttribute('aria-expanded', String(!isOpen));
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
  const categoryFilters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-category-filter]'));
  const articleSort = document.querySelector<HTMLSelectElement>('[data-article-sort]');
  const catalogSummaries = document.querySelectorAll<HTMLElement>('[data-catalog-summary]');

  // Carousel elements
  const carouselPagination = document.querySelector<HTMLElement>('[data-article-pagination]');
  const carouselPrev = document.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const carouselNext = document.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const carouselIndicator = document.querySelector<HTMLElement>('[data-carousel-indicator]');
  let revealObserver: IntersectionObserver | null = null;

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
      zdrowie: 'w kategorii Zdrowie',
      wiedza: 'w kategorii Wiedza',
      ciekawe: 'w kategorii Ciekawe'
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

    let currentPageIndex = 0;
    let totalPages = 1;

    const updateCarouselPosition = () => {
      if (!articleResults || !carouselIndicator || !carouselPrev || !carouselNext) return;

      const offset = currentPageIndex * 100;
      articleResults.style.transform = `translateX(-${offset}%)`;
      
      // Force visibility for items on the active page to avoid 'jumpy' reveal during slide
      const activePage = articleResults.children[currentPageIndex] as HTMLElement;
      if (activePage) {
        activePage.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
      }

      carouselIndicator.textContent = `Strona ${currentPageIndex + 1} z ${totalPages}`;
      carouselPrev.disabled = currentPageIndex === 0;
      carouselNext.disabled = currentPageIndex === totalPages - 1;

      // Accessibility: notify screen readers?
      articleResults.setAttribute('aria-label', `Wyświetlona strona ${currentPageIndex + 1} z ${totalPages}`);
    };

    const updateArticleSearch = () => {
      if (!articleResults) return;

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

      const matchedArticlesForList: Array<{ title: string; href: string }> = [];
      const visibleItems: HTMLElement[] = [];

      sortedItems.forEach(item => {
        const searchText = normalize(item.dataset.searchText ?? item.textContent ?? '');
        const category = item.dataset.category ?? 'all';
        const matchesQuery = query.length === 0 || searchText.includes(query);
        const matchesCategory = activeCategory === 'all' || category === activeCategory;
        const matches = matchesQuery && matchesCategory;

        if (matches) {
          visibleItems.push(item);
          const title = item.dataset.articleTitle ?? item.textContent?.trim() ?? 'Artykuł';
          const href = item.getAttribute('href') ?? '#';
          matchedArticlesForList.push({ title, href });
        }
        item.hidden = !matches;
      });

      // Clear current pages and re-group
      articleResults.innerHTML = '';
      totalPages = Math.ceil(visibleItems.length / initialVisibleArticles) || 1;
      currentPageIndex = 0; // Reset on search

      for (let i = 0; i < totalPages; i++) {
        const page = document.createElement('div');
        page.className = 'carousel-page';
        const pageItems = visibleItems.slice(i * initialVisibleArticles, (i + 1) * initialVisibleArticles);
        pageItems.forEach(item => page.appendChild(item));
        articleResults.appendChild(page);
      }

      // Re-trigger reveal animations for new positions
      visibleItems.forEach(item => {
        item.classList.remove('is-visible');
        if (revealObserver) revealObserver.observe(item);
      });

      articleCountTargets.forEach(target => {
        target.textContent = String(visibleItems.length);
      });

      catalogSummaries.forEach(summary => {
        const categoryLabel = categoryLabels[activeCategory] ?? 'we wszystkich kategoriach';
        summary.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? 'artykuł' : visibleItems.length < 5 ? 'artykuły' : 'artykułów'} ${categoryLabel}`;
      });

      if (articleSearchStatus) {
        articleSearchStatus.textContent = query.length === 0
          ? 'Wpisz słowo i zobacz, w których artykułach występuje temat.'
          : visibleItems.length > 0
            ? `Znaleziono ${visibleItems.length} ${visibleItems.length === 1 ? 'artykuł' : visibleItems.length < 5 ? 'artykuły' : 'artykułów'} dla frazy "${articleSearchInput.value.trim()}".`
            : `Brak wyników dla frazy "${articleSearchInput.value.trim()}".`;
      }

      if (articleSearchMatches) {
        articleSearchMatches.innerHTML = '';
        articleSearchMatches.hidden = query.length === 0 || matchedArticlesForList.length === 0;
        articleSearchResultsStrip?.classList.toggle('is-visible', searchCommitted && query.length > 0 && matchedArticlesForList.length > 0);

        if (query.length > 0 && matchedArticlesForList.length > 0) {
          matchedArticlesForList.forEach(article => {
            const link = document.createElement('a');
            link.className = 'search-match';
            link.href = article.href;
            link.textContent = article.title;
            articleSearchMatches.appendChild(link);
          });
        }
      }

      if (articleSearchEmpty) {
        articleSearchEmpty.hidden = visibleItems.length > 0;
      }

      if (carouselPagination) {
        carouselPagination.hidden = totalPages <= 1;
      }

      updateCarouselPosition();

      if (!searchCommitted || query.length === 0 || matchedArticlesForList.length === 0) {
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
      updateArticleSearch();
    });

    carouselPrev?.addEventListener('click', () => {
      if (currentPageIndex > 0) {
        currentPageIndex--;
        updateCarouselPosition();
      }
    });

    carouselNext?.addEventListener('click', () => {
      if (currentPageIndex < totalPages - 1) {
        currentPageIndex++;
        updateCarouselPosition();
      }
    });

    updateArticleSearch();
  }

  // ----------------------------------------------------------
  // SIMPLE CATEGORY CAROUSEL (category subpages)
  // ----------------------------------------------------------
  const simpleCarousels = Array.from(document.querySelectorAll<HTMLElement>('[data-simple-carousel]'));
  const simplePageSize = 8;

  simpleCarousels.forEach(carousel => {
    const carouselId = carousel.dataset.simpleCarousel;
    if (!carouselId) return;

    const track = carousel.querySelector<HTMLElement>('.carousel-track');
    const nav = document.querySelector<HTMLElement>(`[data-carousel-nav="${carouselId}"]`);
    if (!track || !nav) return;

    const prevButton = nav.querySelector<HTMLButtonElement>('[data-carousel-prev]');
    const nextButton = nav.querySelector<HTMLButtonElement>('[data-carousel-next]');
    const indicator = nav.querySelector<HTMLElement>('[data-carousel-indicator]');
    if (!prevButton || !nextButton || !indicator) return;

    const items = Array.from(track.querySelectorAll<HTMLElement>('.article-index-card'));
    if (items.length === 0) return;

    track.innerHTML = '';

    const totalPages = Math.ceil(items.length / simplePageSize) || 1;
    const pages: HTMLElement[] = [];

    for (let i = 0; i < totalPages; i++) {
      const page = document.createElement('div');
      page.className = 'carousel-page';
      const pageItems = items.slice(i * simplePageSize, (i + 1) * simplePageSize);
      pageItems.forEach(item => page.appendChild(item));
      track.appendChild(page);
      pages.push(page);
    }

    let currentPageIndex = 0;

    const updatePosition = () => {
      const offset = currentPageIndex * 100;
      track.style.transform = `translateX(-${offset}%)`;

      const activePage = pages[currentPageIndex];
      activePage?.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));

      indicator.textContent = `Strona ${currentPageIndex + 1} z ${totalPages}`;
      prevButton.disabled = currentPageIndex === 0;
      nextButton.disabled = currentPageIndex === totalPages - 1;
    };

    prevButton.addEventListener('click', () => {
      if (currentPageIndex === 0) return;
      currentPageIndex -= 1;
      updatePosition();
    });

    nextButton.addEventListener('click', () => {
      if (currentPageIndex >= totalPages - 1) return;
      currentPageIndex += 1;
      updatePosition();
    });

    nav.hidden = totalPages <= 1;
    updatePosition();
  });

  // ----------------------------------------------------------
  // SCROLL REVEAL (IntersectionObserver)
  // ----------------------------------------------------------
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });
  revealObserver = observer;

  document.querySelectorAll('.reveal').forEach(el => revealObserver?.observe(el));

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
