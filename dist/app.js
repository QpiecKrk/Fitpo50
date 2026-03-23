// Log for verification
console.log("FitPo50 Carousel Logic Active - v2");

(function () {
  'use strict';

  // ----------------------------------------------------------
  // DARK MODE TOGGLE
  // ----------------------------------------------------------
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', currentTheme);

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
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" /><path d="M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    } else {
      themeToggle.setAttribute('aria-label', 'Przełącz na tryb ciemny');
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  }
  updateThemeIcon();

  // ----------------------------------------------------------
  // MOBILE NAV TOGGLE
  // ----------------------------------------------------------
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');
  const body = document.body;
  let navOpen = false;

  if (navToggle && nav) {
    const defaultNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    const closeNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const navLinks = Array.from(nav.querySelectorAll('.nav__link'));

    navToggle.setAttribute('aria-controls', 'main-nav');

    const setNavState = open => {
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
        if (navOpen) setNavState(false);
      });
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && navOpen) {
        setNavState(false);
        navToggle.focus();
      }
    });
  }

  // ----------------------------------------------------------
  // ARTICLE CATALOG SEARCH & CAROUSEL
  // ----------------------------------------------------------
  const articleSearchInput = document.querySelector('[data-article-search]');
  const articleSearchClear = document.querySelector('[data-article-search-clear]');
  const articleItems = Array.from(document.querySelectorAll('[data-article-item]'));
  const articleCountTargets = document.querySelectorAll('[data-article-count]');
  const articleResults = document.querySelector('[data-article-results]');
  const carouselPagination = document.querySelector('[data-article-pagination]');
  const carouselPrev = document.querySelector('[data-carousel-prev]');
  const carouselNext = document.querySelector('[data-carousel-next]');
  const carouselIndicator = document.querySelector('[data-carousel-indicator]');
  const categoryFilters = Array.from(document.querySelectorAll('[data-category-filter]'));
  const articleSort = document.querySelector('[data-article-sort]');
  const catalogSummary = document.querySelector('[data-catalog-summary]');
  const articleSearchStatus = document.querySelector('[data-search-status]');
  const articleSearchEmpty = document.querySelector('[data-search-empty]');
  const articleSearchMatches = document.querySelector('[data-search-matches]');
  const articleSearchResultsStrip = document.querySelector('[data-search-results-strip]');

  if (articleSearchInput && articleItems.length > 0) {
    let searchCommitted = false;
    let activeCategory = 'all';
    let activeSort = 'newest';
    const initialVisibleArticles = 8;
    const categoryLabels = {
      all: 'we wszystkich kategoriach',
      start: 'w kategorii Start',
      motywacja: 'w kategorii Motywacja',
      odzywianie: 'w kategorii Odżywianie',
      suplementacja: 'w kategorii Suplementacja',
      zdrowie: 'w kategorii Zdrowie',
      wiedza: 'w kategorii Wiedza'
    };

    let currentPageIndex = 0;
    let totalPages = 1;

    const normalize = (value) => value
      .toLocaleLowerCase('pl-PL')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const getReadTimeValue = (value) => {
      const match = value.match(/\d+/);
      return match ? Number(match[0]) : 999;
    };

    const updateCarouselPosition = () => {
      if (!articleResults || !carouselIndicator || !carouselPrev || !carouselNext) return;
      articleResults.style.transform = `translateX(-${currentPageIndex * 100}%)`;
      carouselIndicator.textContent = `Strona ${currentPageIndex + 1} z ${totalPages}`;
      carouselPrev.disabled = currentPageIndex === 0;
      carouselNext.disabled = currentPageIndex === totalPages - 1;
    };

    const updateArticleSearch = () => {
      if (!articleResults) return;

      const query = normalize(articleSearchInput.value);
      const sortedItems = [...articleItems].sort((a, b) => {
        if (activeSort === 'alphabetical') {
          return (a.dataset.articleTitle || '').localeCompare(b.dataset.articleTitle || '', 'pl');
        }
        if (activeSort === 'shortest') {
          return getReadTimeValue(a.dataset.readTime || '') - getReadTimeValue(b.dataset.readTime || '');
        }
        return Number(b.dataset.order || '0') - Number(a.dataset.order || '0');
      });

      const matchedArticlesForList = [];
      const visibleItems = [];

      sortedItems.forEach(item => {
        const searchText = normalize(item.dataset.searchText || item.textContent || '');
        const category = item.dataset.category || 'all';
        const matchesQuery = query.length === 0 || searchText.includes(query);
        const matchesCategory = activeCategory === 'all' || category === activeCategory;
        
        if (matchesQuery && matchesCategory) {
          visibleItems.push(item);
          matchedArticlesForList.push({ 
            title: item.dataset.articleTitle || 'Artykuł', 
            href: item.getAttribute('href') || '#' 
          });
          item.hidden = false;
        } else {
          item.hidden = true;
        }
      });

      // Clear track and rebuild pages
      articleResults.innerHTML = '';
      totalPages = Math.ceil(visibleItems.length / initialVisibleArticles) || 1;
      currentPageIndex = 0;

      for (let i = 0; i < totalPages; i++) {
        const page = document.createElement('div');
        page.className = 'carousel-page';
        visibleItems.slice(i * initialVisibleArticles, (i + 1) * initialVisibleArticles)
                  .forEach(item => page.appendChild(item));
        articleResults.appendChild(page);
      }

      // Update UI elements
      articleCountTargets.forEach(t => t.textContent = String(visibleItems.length));
      if (catalogSummary) catalogSummary.textContent = `${visibleItems.length} artykułów ${categoryLabels[activeCategory] || ''}`;
      if (articleSearchStatus) articleSearchStatus.textContent = query.length === 0 ? 'Wpisz słowo...' : `Znaleziono ${visibleItems.length} wyników.`;
      if (articleSearchEmpty) articleSearchEmpty.hidden = visibleItems.length > 0;
      if (carouselPagination) carouselPagination.hidden = totalPages <= 1;

      if (articleSearchMatches) {
        articleSearchMatches.innerHTML = '';
        articleSearchMatches.hidden = query.length === 0 || matchedArticlesForList.length === 0;
        matchedArticlesForList.forEach(article => {
          const a = document.createElement('a');
          a.className = 'search-match';
          a.href = article.href;
          a.textContent = article.title;
          articleSearchMatches.appendChild(a);
        });
      }

      updateCarouselPosition();
    };

    articleSearchInput.addEventListener('input', () => {
      searchCommitted = false;
      updateArticleSearch();
    });

    articleSearchClear?.addEventListener('click', () => {
      articleSearchInput.value = '';
      updateArticleSearch();
      articleSearchInput.focus();
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

    categoryFilters.forEach(f => f.addEventListener('click', () => {
      activeCategory = f.dataset.categoryFilter || 'all';
      categoryFilters.forEach(b => b.classList.toggle('is-active', b === f));
      updateArticleSearch();
    }));

    articleSort?.addEventListener('change', () => {
      activeSort = articleSort.value;
      updateArticleSearch();
    });

    updateArticleSearch();
  }

  // ----------------------------------------------------------
  // SCROLL REVEAL & SMOOTH SCROLL
  // ----------------------------------------------------------
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      const target = targetId && targetId !== '#' ? document.querySelector(targetId) : null;
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

})();
