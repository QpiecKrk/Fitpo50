"use strict";
/* ============================================================
   FitPo50 — Application TypeScript (converted from JavaScript)
   Dark mode, accordions, scroll animations, mobile nav
   ============================================================ */
(function () {
    'use strict';
    // ----------------------------------------------------------
    // DARK MODE TOGGLE
    // ----------------------------------------------------------
    const themeToggle = document.querySelector('[data-theme-toggle]');
    const root = document.documentElement;
    let currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
        if (!themeToggle)
            return;
        if (currentTheme === 'dark') {
            themeToggle.setAttribute('aria-label', 'Przełącz na tryb jasny');
            themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
        }
        else {
            themeToggle.setAttribute('aria-label', 'Przełącz na tryb ciemny');
            themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        }
    }
    // ----------------------------------------------------------
    // MOBILE NAV TOGGLE
    // ----------------------------------------------------------
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('main-nav');
    const header = document.querySelector('.header');
    const body = document.body;
    let navOpen = false;
    if (navToggle && nav) {
        if (header && nav.parentElement !== header) {
            header.appendChild(nav);
        }
        const defaultNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        const closeNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        const navLinks = Array.from(nav.querySelectorAll('.nav__link'));
        navToggle.setAttribute('aria-controls', 'main-nav');
        const setNavState = (open) => {
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
            if (!navOpen || window.innerWidth >= 768)
                return;
            const target = event.target;
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
                header === null || header === void 0 ? void 0 : header.classList.add('header--hidden');
            }
            else {
                header === null || header === void 0 ? void 0 : header.classList.remove('header--hidden');
            }
            if (header)
                header.style.boxShadow = 'var(--shadow-sm)';
        }
        else {
            header === null || header === void 0 ? void 0 : header.classList.remove('header--hidden');
            if (header)
                header.style.boxShadow = 'none';
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
    const articleCards = document.querySelectorAll('.article-card');
    articleCards.forEach(card => {
        const header = card.querySelector('.article-card__header');
        const body = card.querySelector('.article-card__body');
        if (!header || !body)
            return;
        function toggleCard() {
            const isOpen = card.classList.contains('is-open');
            // Close all other cards
            articleCards.forEach(otherCard => {
                if (otherCard !== card && otherCard.classList.contains('is-open')) {
                    otherCard.classList.remove('is-open');
                    const otherHeader = otherCard.querySelector('.article-card__header');
                    if (otherHeader)
                        otherHeader.setAttribute('aria-expanded', 'false');
                }
            });
            // Toggle current
            const currentHeader = card.querySelector('.article-card__header');
            card.classList.toggle('is-open', !isOpen);
            if (currentHeader)
                currentHeader.setAttribute('aria-expanded', String(!isOpen));
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
    const articleSearchInput = document.querySelector('[data-article-search]');
    const articleSearchClear = document.querySelector('[data-article-search-clear]');
    const articleItems = Array.from(document.querySelectorAll('[data-article-item]'));
    const articleCountTargets = document.querySelectorAll('[data-article-count]');
    const articleSearchStatus = document.querySelector('[data-search-status]');
    const articleSearchEmpty = document.querySelector('[data-search-empty]');
    const articleSearchMatches = document.querySelector('[data-search-matches]');
    const articleResults = document.querySelector('[data-article-results]');
    const articleSearchResultsStrip = document.querySelector('[data-search-results-strip]');
    const categoryFilters = Array.from(document.querySelectorAll('[data-category-filter]'));
    const articleSort = document.querySelector('[data-article-sort]');
    const catalogSummaries = document.querySelectorAll('[data-catalog-summary]');
    // Carousel elements
    const carouselPagination = document.querySelector('[data-article-pagination]');
    const carouselPrev = document.querySelector('[data-carousel-prev]');
    const carouselNext = document.querySelector('[data-carousel-next]');
    const carouselIndicator = document.querySelector('[data-carousel-indicator]');
    if (articleSearchInput && articleItems.length > 0) {
        let searchCommitted = false;
        let articlesExpanded = false;
        const initialVisibleArticles = 8;
        let activeCategory = 'all';
        let activeSort = 'newest';
        const categoryLabels = {
            all: 'we wszystkich kategoriach',
            start: 'w kategorii Start',
            motywacja: 'w kategorii Motywacja',
            odzywianie: 'w kategorii Odżywianie',
            suplementacja: 'w kategorii Suplementacja',
            zdrowie: 'w kategorii Zdrowie',
            wiedza: 'w kategorii Wiedza',
            ciekawe: 'w kategorii Ciekawe'
        };
        const normalize = (value) => value
            .toLocaleLowerCase('pl-PL')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        const getReadTimeValue = (value) => {
            const match = value.match(/\d+/);
            return match ? Number(match[0]) : 999;
        };
        let currentPageIndex = 0;
        let totalPages = 1;
        const updateCarouselPosition = () => {
            if (!articleResults || !carouselIndicator || !carouselPrev || !carouselNext)
                return;
            const offset = currentPageIndex * 100;
            articleResults.style.transform = `translateX(-${offset}%)`;
            // Force visibility for items on the active page to avoid 'jumpy' reveal during slide
            const activePage = articleResults.children[currentPageIndex];
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
            if (!articleResults)
                return;
            const query = normalize(articleSearchInput.value);
            const sortedItems = [...articleItems].sort((a, b) => {
                var _a, _b, _c, _d, _e, _f;
                if (activeSort === 'alphabetical') {
                    const aTitle = (_a = a.dataset.articleTitle) !== null && _a !== void 0 ? _a : '';
                    const bTitle = (_b = b.dataset.articleTitle) !== null && _b !== void 0 ? _b : '';
                    return aTitle.localeCompare(bTitle, 'pl');
                }
                if (activeSort === 'shortest') {
                    const aTime = getReadTimeValue((_c = a.dataset.readTime) !== null && _c !== void 0 ? _c : '');
                    const bTime = getReadTimeValue((_d = b.dataset.readTime) !== null && _d !== void 0 ? _d : '');
                    return aTime - bTime;
                }
                const aOrder = Number((_e = a.dataset.order) !== null && _e !== void 0 ? _e : '0');
                const bOrder = Number((_f = b.dataset.order) !== null && _f !== void 0 ? _f : '0');
                return bOrder - aOrder;
            });
            const matchedArticlesForList = [];
            const visibleItems = [];
            sortedItems.forEach(item => {
                var _a, _b, _c, _d, _e, _f, _g;
                const searchText = normalize((_b = (_a = item.dataset.searchText) !== null && _a !== void 0 ? _a : item.textContent) !== null && _b !== void 0 ? _b : '');
                const category = (_c = item.dataset.category) !== null && _c !== void 0 ? _c : 'all';
                const matchesQuery = query.length === 0 || searchText.includes(query);
                const matchesCategory = activeCategory === 'all' || category === activeCategory;
                const matches = matchesQuery && matchesCategory;
                if (matches) {
                    visibleItems.push(item);
                    const title = (_f = (_d = item.dataset.articleTitle) !== null && _d !== void 0 ? _d : (_e = item.textContent) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : 'Artykuł';
                    const href = (_g = item.getAttribute('href')) !== null && _g !== void 0 ? _g : '#';
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
                if (revealObserver)
                    revealObserver.observe(item);
            });
            articleCountTargets.forEach(target => {
                target.textContent = String(visibleItems.length);
            });
            catalogSummaries.forEach(summary => {
                var _a;
                const categoryLabel = (_a = categoryLabels[activeCategory]) !== null && _a !== void 0 ? _a : 'we wszystkich kategoriach';
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
                articleSearchResultsStrip === null || articleSearchResultsStrip === void 0 ? void 0 : articleSearchResultsStrip.classList.toggle('is-visible', searchCommitted && query.length > 0 && matchedArticlesForList.length > 0);
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
                articleSearchResultsStrip === null || articleSearchResultsStrip === void 0 ? void 0 : articleSearchResultsStrip.classList.remove('is-visible');
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
            if (e.key !== 'Enter')
                return;
            e.preventDefault();
            searchCommitted = true;
            updateArticleSearch();
            const target = articleSearchMatches && !articleSearchMatches.hidden && articleSearchMatches.childElementCount > 0
                ? articleSearchMatches
                : !(articleSearchEmpty === null || articleSearchEmpty === void 0 ? void 0 : articleSearchEmpty.hidden)
                    ? articleSearchEmpty
                    : articleResults;
            target === null || target === void 0 ? void 0 : target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        articleSearchClear === null || articleSearchClear === void 0 ? void 0 : articleSearchClear.addEventListener('click', () => {
            searchCommitted = false;
            articlesExpanded = false;
            articleSearchInput.value = '';
            updateArticleSearch();
            articleSearchInput.focus();
        });
        categoryFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                var _a;
                activeCategory = (_a = filter.dataset.categoryFilter) !== null && _a !== void 0 ? _a : 'all';
                articlesExpanded = false;
                categoryFilters.forEach(button => {
                    button.classList.toggle('is-active', button === filter);
                });
                updateArticleSearch();
            });
        });
        articleSort === null || articleSort === void 0 ? void 0 : articleSort.addEventListener('change', () => {
            activeSort = articleSort.value;
            updateArticleSearch();
        });
        carouselPrev === null || carouselPrev === void 0 ? void 0 : carouselPrev.addEventListener('click', () => {
            if (currentPageIndex > 0) {
                currentPageIndex--;
                updateCarouselPosition();
            }
        });
        carouselNext === null || carouselNext === void 0 ? void 0 : carouselNext.addEventListener('click', () => {
            if (currentPageIndex < totalPages - 1) {
                currentPageIndex++;
                updateCarouselPosition();
            }
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
            if (targetId === '#' || targetId === '#top')
                return; // let default handle #top
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Update URL hash without scrolling
                history.pushState(null, '', targetId);
            }
        });
    });
})();
