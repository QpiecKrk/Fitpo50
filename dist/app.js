"use strict";
(() => {
  (function() {
    "use strict";
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const root = document.documentElement;
    const themeStorageKey = "fitpo50-theme";
    const storedTheme = (() => {
      try {
        const value = window.localStorage.getItem(themeStorageKey);
        return value === "dark" || value === "light" ? value : "";
      } catch (_err) {
        return "";
      }
    })();
    let currentTheme = storedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    root.setAttribute("data-theme", currentTheme);
    updateThemeIcon();
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", currentTheme);
        try {
          window.localStorage.setItem(themeStorageKey, currentTheme);
        } catch (_err) {
        }
        updateThemeIcon();
      });
    }
    function updateThemeIcon() {
      if (!themeToggle) return;
      if (currentTheme === "dark") {
        themeToggle.setAttribute("aria-label", "Prze\u0142\u0105cz na tryb jasny");
        themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      } else {
        themeToggle.setAttribute("aria-label", "Prze\u0142\u0105cz na tryb ciemny");
        themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      }
    }
    const navToggle = document.querySelector(".nav-toggle");
    const nav = document.getElementById("main-nav");
    const header = document.querySelector(".header");
    const body = document.body;
    let navOpen = false;
    if (navToggle && nav) {
      if (header && nav.parentElement !== header) {
        header.appendChild(nav);
      }
      const defaultNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
      const closeNavIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      const navLinks = Array.from(nav.querySelectorAll(".nav__link"));
      navToggle.setAttribute("aria-controls", "main-nav");
      const setNavState = (open) => {
        navOpen = open;
        nav.classList.toggle("is-open", navOpen);
        body.classList.toggle("nav-open", navOpen);
        navToggle.setAttribute("aria-expanded", String(navOpen));
        navToggle.setAttribute("aria-label", navOpen ? "Zamknij menu nawigacji" : "Otw\xF3rz menu nawigacji");
        navToggle.innerHTML = navOpen ? closeNavIcon : defaultNavIcon;
      };
      navToggle.addEventListener("click", () => {
        setNavState(!navOpen);
      });
      navLinks.forEach((link) => {
        link.addEventListener("click", () => {
          if (navOpen) {
            setNavState(false);
          }
        });
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && navOpen) {
          setNavState(false);
          navToggle.focus();
        }
      });
      document.addEventListener("click", (event) => {
        if (!navOpen || window.innerWidth >= 768) return;
        const target = event.target;
        if (!nav.contains(target) && !navToggle.contains(target)) {
          setNavState(false);
        }
      });
      window.addEventListener("resize", () => {
        if (window.innerWidth >= 768 && navOpen) {
          setNavState(false);
        }
      });
    }
    let lastScrollY = window.scrollY;
    let ticking = false;
    function updateHeader() {
      const scrollY = window.scrollY;
      if (scrollY > 80) {
        if (scrollY > lastScrollY && scrollY > 200) {
          header == null ? void 0 : header.classList.add("header--hidden");
        } else {
          header == null ? void 0 : header.classList.remove("header--hidden");
        }
        if (header) header.style.boxShadow = "var(--shadow-sm)";
      } else {
        header == null ? void 0 : header.classList.remove("header--hidden");
        if (header) header.style.boxShadow = "none";
      }
      lastScrollY = scrollY;
      ticking = false;
    }
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
    const articleCards = document.querySelectorAll(".article-card");
    articleCards.forEach((card) => {
      const header2 = card.querySelector(".article-card__header");
      const body2 = card.querySelector(".article-card__body");
      if (!header2 || !body2) return;
      function toggleCard() {
        const isOpen = card.classList.contains("is-open");
        articleCards.forEach((otherCard) => {
          if (otherCard !== card && otherCard.classList.contains("is-open")) {
            otherCard.classList.remove("is-open");
            const otherHeader = otherCard.querySelector(".article-card__header");
            if (otherHeader) otherHeader.setAttribute("aria-expanded", "false");
          }
        });
        const currentHeader = card.querySelector(".article-card__header");
        card.classList.toggle("is-open", !isOpen);
        if (currentHeader) currentHeader.setAttribute("aria-expanded", String(!isOpen));
        if (!isOpen) {
          setTimeout(() => {
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 100);
        }
      }
      header2.addEventListener("click", toggleCard);
      header2.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCard();
        }
      });
    });
    const articleSearchInput = document.querySelector("[data-article-search]");
    const articleSearchClear = document.querySelector("[data-article-search-clear]");
    const articleItems = Array.from(document.querySelectorAll("[data-article-item]"));
    const articleCountTargets = document.querySelectorAll("[data-article-count]");
    const articleSearchStatus = document.querySelector("[data-search-status]");
    const articleSearchEmpty = document.querySelector("[data-search-empty]");
    const articleSearchMatches = document.querySelector("[data-search-matches]");
    const articleResults = document.querySelector("[data-article-results]");
    const articleSearchResultsStrip = document.querySelector("[data-search-results-strip]");
    const categoryFilters = Array.from(document.querySelectorAll("[data-category-filter]"));
    const articleSort = document.querySelector("[data-article-sort]");
    const catalogSummaries = document.querySelectorAll("[data-catalog-summary]");
    const carouselPagination = document.querySelector("[data-article-pagination]");
    const carouselPrev = document.querySelector("[data-carousel-prev]");
    const carouselNext = document.querySelector("[data-carousel-next]");
    const carouselIndicator = document.querySelector("[data-carousel-indicator]");
    let revealObserver = null;
    if (articleSearchInput && articleItems.length > 0) {
      let searchCommitted = false;
      let articlesExpanded = false;
      const initialVisibleArticles = 8;
      let activeCategory = "all";
      let activeSort = "newest";
      const categoryLabels = {
        all: "we wszystkich kategoriach",
        ruch: "w kategorii Ruch",
        jedzenie: "w kategorii Jedzenie",
        zdrowie: "w kategorii Zdrowie",
        ciekawe: "w kategorii Ciekawe"
      };
      const normalize = (value) => value.toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const getReadTimeValue = (value) => {
        const match = value.match(/\d+/);
        return match ? Number(match[0]) : 999;
      };
      let currentPageIndex = 0;
      let totalPages = 1;
      const updateCarouselPosition = () => {
        if (!articleResults || !carouselIndicator || !carouselPrev || !carouselNext) return;
        const offset = currentPageIndex * 100;
        articleResults.style.transform = `translateX(-${offset}%)`;
        const activePage = articleResults.children[currentPageIndex];
        if (activePage) {
          activePage.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
        }
        carouselIndicator.textContent = `Strona ${currentPageIndex + 1} z ${totalPages}`;
        carouselPrev.disabled = currentPageIndex === 0;
        carouselNext.disabled = currentPageIndex === totalPages - 1;
        articleResults.setAttribute("aria-label", `Wy\u015Bwietlona strona ${currentPageIndex + 1} z ${totalPages}`);
      };
      const updateArticleSearch = () => {
        if (!articleResults) return;
        const query = normalize(articleSearchInput.value);
        const sortedItems = [...articleItems].sort((a, b) => {
          var _a, _b, _c, _d, _e, _f;
          if (activeSort === "alphabetical") {
            const aTitle = (_a = a.dataset.articleTitle) != null ? _a : "";
            const bTitle = (_b = b.dataset.articleTitle) != null ? _b : "";
            return aTitle.localeCompare(bTitle, "pl");
          }
          if (activeSort === "shortest") {
            const aTime = getReadTimeValue((_c = a.dataset.readTime) != null ? _c : "");
            const bTime = getReadTimeValue((_d = b.dataset.readTime) != null ? _d : "");
            return aTime - bTime;
          }
          const aOrder = Number((_e = a.dataset.order) != null ? _e : "0");
          const bOrder = Number((_f = b.dataset.order) != null ? _f : "0");
          return bOrder - aOrder;
        });
        const matchedArticlesForList = [];
        const visibleItems = [];
        sortedItems.forEach((item) => {
          var _a, _b, _c, _d, _e, _f, _g;
          const searchText = normalize((_b = (_a = item.dataset.searchText) != null ? _a : item.textContent) != null ? _b : "");
          const category = (_c = item.dataset.category) != null ? _c : "all";
          const matchesQuery = query.length === 0 || searchText.includes(query);
          const matchesCategory = activeCategory === "all" || category === activeCategory;
          const matches = matchesQuery && matchesCategory;
          if (matches) {
            visibleItems.push(item);
            const title = (_f = (_e = item.dataset.articleTitle) != null ? _e : (_d = item.textContent) == null ? void 0 : _d.trim()) != null ? _f : "Artyku\u0142";
            const href = (_g = item.getAttribute("href")) != null ? _g : "#";
            matchedArticlesForList.push({ title, href });
          }
          item.hidden = !matches;
        });
        articleResults.innerHTML = "";
        totalPages = Math.ceil(visibleItems.length / initialVisibleArticles) || 1;
        currentPageIndex = 0;
        for (let i = 0; i < totalPages; i++) {
          const page = document.createElement("div");
          page.className = "carousel-page";
          const pageItems = visibleItems.slice(i * initialVisibleArticles, (i + 1) * initialVisibleArticles);
          pageItems.forEach((item) => page.appendChild(item));
          articleResults.appendChild(page);
        }
        visibleItems.forEach((item) => {
          item.classList.remove("is-visible");
          if (revealObserver) revealObserver.observe(item);
        });
        articleCountTargets.forEach((target) => {
          target.textContent = String(visibleItems.length);
        });
        catalogSummaries.forEach((summary) => {
          var _a;
          const categoryLabel = (_a = categoryLabels[activeCategory]) != null ? _a : "we wszystkich kategoriach";
          summary.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? "artyku\u0142" : visibleItems.length < 5 ? "artyku\u0142y" : "artyku\u0142\xF3w"} ${categoryLabel}`;
        });
        if (articleSearchStatus) {
          articleSearchStatus.textContent = query.length === 0 ? "Wpisz s\u0142owo i zobacz, w kt\xF3rych artyku\u0142ach wyst\u0119puje temat." : visibleItems.length > 0 ? `Znaleziono ${visibleItems.length} ${visibleItems.length === 1 ? "artyku\u0142" : visibleItems.length < 5 ? "artyku\u0142y" : "artyku\u0142\xF3w"} dla frazy "${articleSearchInput.value.trim()}".` : `Brak wynik\xF3w dla frazy "${articleSearchInput.value.trim()}".`;
        }
        if (articleSearchMatches) {
          articleSearchMatches.innerHTML = "";
          articleSearchMatches.hidden = query.length === 0 || matchedArticlesForList.length === 0;
          articleSearchResultsStrip == null ? void 0 : articleSearchResultsStrip.classList.toggle("is-visible", searchCommitted && query.length > 0 && matchedArticlesForList.length > 0);
          if (query.length > 0 && matchedArticlesForList.length > 0) {
            matchedArticlesForList.forEach((article) => {
              const link = document.createElement("a");
              link.className = "search-match";
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
          articleSearchResultsStrip == null ? void 0 : articleSearchResultsStrip.classList.remove("is-visible");
        }
        if (articleSearchClear) {
          articleSearchClear.hidden = query.length === 0;
        }
      };
      articleSearchInput.addEventListener("input", () => {
        searchCommitted = false;
        updateArticleSearch();
      });
      articleSearchInput.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        searchCommitted = true;
        updateArticleSearch();
        const target = articleSearchMatches && !articleSearchMatches.hidden && articleSearchMatches.childElementCount > 0 ? articleSearchMatches : !(articleSearchEmpty == null ? void 0 : articleSearchEmpty.hidden) ? articleSearchEmpty : articleResults;
        target == null ? void 0 : target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      articleSearchClear == null ? void 0 : articleSearchClear.addEventListener("click", () => {
        searchCommitted = false;
        articlesExpanded = false;
        articleSearchInput.value = "";
        updateArticleSearch();
        articleSearchInput.focus();
      });
      categoryFilters.forEach((filter) => {
        filter.addEventListener("click", () => {
          var _a;
          activeCategory = (_a = filter.dataset.categoryFilter) != null ? _a : "all";
          articlesExpanded = false;
          categoryFilters.forEach((button) => {
            button.classList.toggle("is-active", button === filter);
          });
          updateArticleSearch();
        });
      });
      articleSort == null ? void 0 : articleSort.addEventListener("change", () => {
        activeSort = articleSort.value;
        updateArticleSearch();
      });
      carouselPrev == null ? void 0 : carouselPrev.addEventListener("click", () => {
        if (currentPageIndex > 0) {
          currentPageIndex--;
          updateCarouselPosition();
        }
      });
      carouselNext == null ? void 0 : carouselNext.addEventListener("click", () => {
        if (currentPageIndex < totalPages - 1) {
          currentPageIndex++;
          updateCarouselPosition();
        }
      });
      updateArticleSearch();
    }
    const simpleCarousels = Array.from(document.querySelectorAll("[data-simple-carousel]"));
    const simplePageSize = 8;
    simpleCarousels.forEach((carousel) => {
      const carouselId = carousel.dataset.simpleCarousel;
      if (!carouselId) return;
      const track = carousel.querySelector(".carousel-track");
      const nav2 = document.querySelector(`[data-carousel-nav="${carouselId}"]`);
      if (!track || !nav2) return;
      const prevButton = nav2.querySelector("[data-carousel-prev]");
      const nextButton = nav2.querySelector("[data-carousel-next]");
      const indicator = nav2.querySelector("[data-carousel-indicator]");
      if (!prevButton || !nextButton || !indicator) return;
      const items = Array.from(track.querySelectorAll(".article-index-card"));
      if (items.length === 0) return;
      track.innerHTML = "";
      const totalPages = Math.ceil(items.length / simplePageSize) || 1;
      const pages = [];
      for (let i = 0; i < totalPages; i++) {
        const page = document.createElement("div");
        page.className = "carousel-page";
        const pageItems = items.slice(i * simplePageSize, (i + 1) * simplePageSize);
        pageItems.forEach((item) => page.appendChild(item));
        track.appendChild(page);
        pages.push(page);
      }
      let currentPageIndex = 0;
      const updatePosition = () => {
        const offset = currentPageIndex * 100;
        track.style.transform = `translateX(-${offset}%)`;
        const activePage = pages[currentPageIndex];
        activePage == null ? void 0 : activePage.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
        indicator.textContent = `Strona ${currentPageIndex + 1} z ${totalPages}`;
        prevButton.disabled = currentPageIndex === 0;
        nextButton.disabled = currentPageIndex === totalPages - 1;
      };
      prevButton.addEventListener("click", () => {
        if (currentPageIndex === 0) return;
        currentPageIndex -= 1;
        updatePosition();
      });
      nextButton.addEventListener("click", () => {
        if (currentPageIndex >= totalPages - 1) return;
        currentPageIndex += 1;
        updatePosition();
      });
      nav2.hidden = totalPages <= 1;
      updatePosition();
    });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -40px 0px"
    });
    revealObserver = observer;
    document.querySelectorAll(".reveal").forEach((el) => revealObserver == null ? void 0 : revealObserver.observe(el));
    const googleAdsPdfConversionId = "AW-18108612630/VY2pCMLU56IcEJaA7rpD";
    const googleTagWindow = window;
    function isArticlePdfDownload(anchor) {
      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch (e) {
        return false;
      }
      return url.origin === window.location.origin && /^\/assets\/pdf\/[^/]+\.pdf$/i.test(url.pathname);
    }
    document.addEventListener("click", (event) => {
      var _a;
      const anchor = (_a = event.target) == null ? void 0 : _a.closest("a[href]");
      if (!anchor || !isArticlePdfDownload(anchor) || typeof googleTagWindow.gtag !== "function") {
        return;
      }
      googleTagWindow.gtag("event", "conversion", {
        send_to: googleAdsPdfConversionId,
        value: 1,
        currency: "PLN",
        event_label: new URL(anchor.href, window.location.href).pathname
      });
    });
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const targetId = link.getAttribute("href");
        if (targetId === "#" || targetId === "#top") return;
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.pushState(null, "", targetId);
        }
      });
    });
    const readingModeStorageKey = "fitpo50_reading_sanctuary";
    const canUseReadingMode = !window.location.pathname.includes("/admin/") && document.querySelector(".article-content") !== null;
    if (canUseReadingMode) {
      const articleContent = document.querySelector(".article-content");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "reading-sanctuary-toggle";
      btn.setAttribute("aria-label", "W\u0142\u0105cz tryb czytania");
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = `
      <span class="reading-sanctuary-toggle__icon" aria-hidden="true">Aa</span>
      <span class="reading-sanctuary-toggle__label">Tryb czytania</span>
    `;
      const setReadingMode = (enabled) => {
        document.body.classList.toggle("reading-sanctuary-active", enabled);
        btn.classList.toggle("is-active", enabled);
        btn.setAttribute("aria-pressed", enabled ? "true" : "false");
        btn.setAttribute("aria-label", enabled ? "Wy\u0142\u0105cz tryb czytania" : "W\u0142\u0105cz tryb czytania");
        try {
          window.localStorage.setItem(readingModeStorageKey, enabled ? "1" : "0");
        } catch (e) {
        }
      };
      const toggleReadingModeWithoutJump = (enabled) => {
        const anchorSelectors = "h2,h3,p,li,figure,blockquote,.highlight-box,.key-takeaways,.faq-item,table";
        const anchors = articleContent ? Array.from(articleContent.querySelectorAll(anchorSelectors)) : [];
        const anchor = anchors.find((el) => {
          const rect = el.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight;
        }) || null;
        const anchorTopBefore = anchor ? anchor.getBoundingClientRect().top : 0;
        const fallbackScrollY = window.scrollY;
        setReadingMode(enabled);
        window.requestAnimationFrame(() => {
          if (anchor && anchor.isConnected) {
            const anchorTopAfter = anchor.getBoundingClientRect().top;
            const delta = anchorTopAfter - anchorTopBefore;
            if (Math.abs(delta) > 1) {
              window.scrollTo({ top: window.scrollY + delta, left: 0, behavior: "auto" });
            }
            return;
          }
          const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          window.scrollTo({ top: Math.min(fallbackScrollY, maxScrollY), left: 0, behavior: "auto" });
        });
      };
      let initialEnabled = false;
      try {
        initialEnabled = window.localStorage.getItem(readingModeStorageKey) === "1";
      } catch (e) {
        initialEnabled = false;
      }
      btn.addEventListener("click", () => {
        const nextValue = !document.body.classList.contains("reading-sanctuary-active");
        toggleReadingModeWithoutJump(nextValue);
      });
      document.body.appendChild(btn);
      setReadingMode(initialEnabled);
    }
    const prefetchedUrls = /* @__PURE__ */ new Set();
    function isPrefetchableLink(anchor) {
      var _a, _b;
      const href = (_b = (_a = anchor.getAttribute("href")) == null ? void 0 : _a.trim()) != null ? _b : "";
      if (!href || href.startsWith("#")) return false;
      if (anchor.hasAttribute("download")) return false;
      if (anchor.target && anchor.target !== "_self") return false;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
      if (href.includes("/admin/")) return false;
      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch (e) {
        return false;
      }
      if (url.origin !== window.location.origin) return false;
      if (url.pathname.startsWith("/admin/")) return false;
      if (url.pathname === window.location.pathname && url.hash) return false;
      if (!/\.html$/i.test(url.pathname) && url.pathname !== "/" && !url.pathname.endsWith("/")) return false;
      return true;
    }
    function prefetchUrl(url) {
      if (!url || prefetchedUrls.has(url)) return;
      prefetchedUrls.add(url);
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      link.as = "document";
      document.head.appendChild(link);
    }
    function schedulePrefetch(anchor) {
      if (!isPrefetchableLink(anchor)) return;
      window.setTimeout(() => prefetchUrl(anchor.href), 50);
    }
    document.addEventListener("mouseover", (event) => {
      var _a;
      const anchor = (_a = event.target) == null ? void 0 : _a.closest("a[href]");
      if (!anchor) return;
      schedulePrefetch(anchor);
    }, { passive: true });
    document.addEventListener("focusin", (event) => {
      var _a;
      const anchor = (_a = event.target) == null ? void 0 : _a.closest("a[href]");
      if (!anchor) return;
      schedulePrefetch(anchor);
    });
    document.addEventListener("touchstart", (event) => {
      var _a;
      const anchor = (_a = event.target) == null ? void 0 : _a.closest("a[href]");
      if (!anchor) return;
      schedulePrefetch(anchor);
    }, { passive: true });
    const topShareBtn = document.getElementById("share-article-top");
    const shareStatus = document.getElementById("share-status");
    const shareLinks = Array.from(document.querySelectorAll("[data-share-network]"));
    if (topShareBtn && shareLinks.length > 0) {
      const pageUrl = window.location.href;
      const pageTitle = document.title.replace(/\s*\|\s*FitPo50\s*$/i, "").trim();
      const encodedUrl = encodeURIComponent(pageUrl);
      const encodedTitle = encodeURIComponent(pageTitle);
      const setShareStatus = (message) => {
        if (!shareStatus) return;
        shareStatus.textContent = message;
      };
      const shareUrls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
        mail: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A%0A${encodedUrl}`
      };
      shareLinks.forEach((item) => {
        const network = item.getAttribute("data-share-network");
        if (!network) return;
        if (network in shareUrls && item instanceof HTMLAnchorElement) {
          item.href = shareUrls[network];
        }
        item.addEventListener("click", async (event) => {
          const currentNetwork = item.getAttribute("data-share-network");
          if (!currentNetwork) return;
          if (currentNetwork === "copy") {
            event.preventDefault();
            try {
              await navigator.clipboard.writeText(pageUrl);
              setShareStatus("Link skopiowany do schowka.");
            } catch (e) {
              setShareStatus("Nie uda\u0142o si\u0119 skopiowa\u0107 linku.");
            }
            return;
          }
          if (currentNetwork === "mail") {
            setShareStatus("Otwieram klienta poczty.");
            return;
          }
          setShareStatus("Otwieram okno udost\u0119pniania.");
        });
      });
      topShareBtn.addEventListener("click", async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title: pageTitle, text: pageTitle, url: pageUrl });
            setShareStatus("Udost\u0119pniono.");
            return;
          } catch (e) {
          }
        }
        const shareSection = document.querySelector(".share-article-section");
        if (shareSection) {
          shareSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setShareStatus("Wybierz kana\u0142 udost\u0119pniania poni\u017Cej.");
      });
    }
    const headerSearchInputs = Array.from(document.querySelectorAll('.searchbar input[type="search"]'));
    const isSearchPage = window.location.pathname.endsWith("/search.html") || window.location.pathname === "/search.html";
    const redirectToSearchPage = (query) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;
      const target = `search.html?q=${encodeURIComponent(trimmedQuery)}`;
      window.location.href = target;
    };
    headerSearchInputs.forEach((searchInput) => {
      var _a;
      searchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        if (isSearchPage) return;
        event.preventDefault();
        redirectToSearchPage(searchInput.value);
      });
      const searchIcon = (_a = searchInput.closest(".searchbar")) == null ? void 0 : _a.querySelector("span");
      if (!searchIcon) return;
      searchIcon.setAttribute("role", "button");
      searchIcon.setAttribute("tabindex", "0");
      searchIcon.setAttribute("aria-label", "Szukaj");
      searchIcon.addEventListener("click", () => {
        if (isSearchPage) return;
        redirectToSearchPage(searchInput.value);
      });
      searchIcon.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (isSearchPage) return;
        event.preventDefault();
        redirectToSearchPage(searchInput.value);
      });
    });
  })();
})();
