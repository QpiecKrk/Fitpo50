"use strict";
(() => {
  (function() {
    "use strict";
    const input = document.querySelector("[data-search-input]");
    const clearBtn = document.querySelector("[data-search-clear]");
    const chips = Array.from(document.querySelectorAll("[data-search-chip]"));
    const countNode = document.querySelector("[data-search-count]");
    const resultsNode = document.querySelector("[data-search-results]");
    const emptyNode = document.querySelector("[data-search-empty]");
    if (!input || !resultsNode || !countNode || !emptyNode) {
      return;
    }
    let indexCache = null;
    let activeCategory = "all";
    let debounceTimer = 0;
    let fallbackNoticeShown = false;
    const MIN_TOKEN_LENGTH = 4;
    function escapeHtml(unsafe) {
      return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function normalizeText(value) {
      return value.toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    }
    function tokenize(query) {
      return normalizeText(query).split(" ").filter((token) => token.length >= MIN_TOKEN_LENGTH);
    }
    function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function buildDiacriticsRegexStr(token) {
      const map = {
        a: "[a\u0105A\u0104]",
        c: "[c\u0107C\u0106]",
        e: "[e\u0119E\u0118]",
        l: "[l\u0142L\u0141]",
        n: "[n\u0144N\u0143]",
        o: "[o\xF3O\xD3]",
        s: "[s\u015BS\u015A]",
        z: "[z\u017A\u017CZ\u0179\u017B]",
        x: "[xX]"
      };
      return token.split("").map((char) => map[char.toLowerCase()] || escapeRegExp(char)).join("");
    }
    function buildWholeWordRegex(token, flags = "gu") {
      const pattern = buildDiacriticsRegexStr(token);
      return new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, flags);
    }
    function countWholeWordOccurrences(text, token) {
      const regex = buildWholeWordRegex(token);
      let count = 0;
      let match = regex.exec(text);
      while (match) {
        count += 1;
        match = regex.exec(text);
      }
      return count;
    }
    async function loadIndex() {
      if (indexCache) return indexCache;
      const response = await fetch("./assets/data/search-index.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Nie uda\u0142o si\u0119 pobra\u0107 indeksu wyszukiwarki.");
      }
      const payload = await response.json();
      indexCache = Array.isArray(payload) ? payload : [];
      return indexCache;
    }
    function createSnippet(content, queryTokens) {
      var _a;
      const plain = content.replace(/\s+/g, " ").trim();
      if (!plain) return "";
      const normalizedPlain = normalizeText(plain);
      let matchIndex = -1;
      let tokenUsed = "";
      for (const token of queryTokens) {
        const regex = buildWholeWordRegex(token);
        const match = regex.exec(normalizedPlain);
        if (!match) continue;
        const idx = match.index + (((_a = match[1]) == null ? void 0 : _a.length) || 0);
        if (matchIndex === -1 || idx < matchIndex) {
          matchIndex = idx;
          tokenUsed = token;
        }
      }
      if (matchIndex === -1 || !tokenUsed) {
        const fallback = plain.slice(0, 180).trim();
        return `${escapeHtml(fallback)}...`;
      }
      const windowSize = 90;
      const start = Math.max(0, matchIndex - windowSize);
      const end = Math.min(plain.length, matchIndex + tokenUsed.length + windowSize);
      const rawSnippet = plain.slice(start, end).trim();
      const escapedSnippet = escapeHtml(rawSnippet);
      let highlighted = escapedSnippet;
      for (const token of queryTokens) {
        if (!token) continue;
        const regex = buildWholeWordRegex(token, "giu");
        highlighted = highlighted.replace(regex, (_, prefix, word) => `${prefix}<mark class="search-highlight">${word}</mark>`);
      }
      const leftDots = start > 0 ? "... " : "";
      const rightDots = end < plain.length ? " ..." : "";
      return `${leftDots}${highlighted}${rightDots}`;
    }
    function scoreEntry(entry, queryTokens) {
      const title = normalizeText(entry.title);
      const description = normalizeText(entry.description);
      const headings = normalizeText(entry.headings.join(" "));
      const content = normalizeText(entry.content);
      let score = 0;
      for (const token of queryTokens) {
        if (buildWholeWordRegex(token).test(title)) score += 10;
        if (buildWholeWordRegex(token).test(headings)) score += 5;
        if (buildWholeWordRegex(token).test(description)) score += 3;
        const count = countWholeWordOccurrences(content, token);
        if (count > 0) score += count;
      }
      if (score <= 0) return null;
      return {
        entry,
        score,
        snippet: createSnippet(entry.content, queryTokens)
      };
    }
    function renderResults(results) {
      if (results.length === 0) {
        resultsNode.innerHTML = "";
        emptyNode.hidden = false;
        return;
      }
      emptyNode.hidden = true;
      resultsNode.innerHTML = results.map(({ entry, snippet }) => {
        const categoryClass = `search-result__badge--${normalizeText(entry.category)}`;
        const readTime = entry.readTime ? `<span class="search-result__meta">${escapeHtml(entry.readTime)}</span>` : "";
        return `
          <article class="search-result">
            <div class="search-result__top">
              <span class="search-result__badge ${categoryClass}">${escapeHtml(entry.category)}</span>
              ${readTime}
            </div>
            <h3 class="search-result__title"><a href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a></h3>
            <p class="search-result__snippet">${snippet}</p>
          </article>
        `;
      }).join("");
    }
    async function runSearch() {
      const query = input.value.trim();
      const tokens = tokenize(query);
      if (tokens.length === 0) {
        countNode.textContent = `Wpisz fraz\u0119 (minimum ${MIN_TOKEN_LENGTH} znaki), aby przeszuka\u0107 artyku\u0142y.`;
        resultsNode.innerHTML = "";
        emptyNode.hidden = true;
        return;
      }
      const index = await loadIndex();
      const filtered = activeCategory === "all" ? index : index.filter((entry) => entry.category === activeCategory);
      let scored = filtered.map((entry) => scoreEntry(entry, tokens)).filter((result) => result !== null).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "pl")).slice(0, 30);
      fallbackNoticeShown = false;
      if (scored.length === 0 && activeCategory !== "all") {
        scored = index.map((entry) => scoreEntry(entry, tokens)).filter((result) => result !== null).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "pl")).slice(0, 30);
        fallbackNoticeShown = scored.length > 0;
      }
      const uniqueArticles = new Set(scored.map((item) => item.entry.url)).size;
      countNode.textContent = fallbackNoticeShown ? `Brak wynik\xF3w w kategorii ${activeCategory}. Pokazuj\u0119 ${scored.length} wynik\xF3w globalnie (${uniqueArticles} artyku\u0142\xF3w).` : `Znaleziono ${scored.length} wynik\xF3w w ${uniqueArticles} artyku\u0142ach.`;
      renderResults(scored);
    }
    function scheduleSearch() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void runSearch();
      }, 150);
    }
    function syncUrl() {
      const params = new URLSearchParams(window.location.search);
      if (input.value.trim()) {
        params.set("q", input.value.trim());
      } else {
        params.delete("q");
      }
      if (activeCategory !== "all") {
        params.set("cat", activeCategory);
      } else {
        params.delete("cat");
      }
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
    function setActiveChip(next) {
      activeCategory = next;
      chips.forEach((chip) => {
        const isActive = chip.dataset.searchChip === next;
        chip.classList.toggle("is-active", isActive);
        chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }
    input.addEventListener("input", () => {
      syncUrl();
      scheduleSearch();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        syncUrl();
        void runSearch();
      }
    });
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        syncUrl();
        void runSearch();
        input.focus();
      });
    }
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const next = chip.dataset.searchChip || "all";
        setActiveChip(next);
        syncUrl();
        void runSearch();
      });
    });
    const initialParams = new URLSearchParams(window.location.search);
    const initialQuery = initialParams.get("q") || "";
    const initialCategory = initialParams.get("cat");
    if (initialCategory && ["all", "Ruch", "Jedzenie", "Zdrowie", "Ciekawe", "Porady"].includes(initialCategory)) {
      setActiveChip(initialCategory);
    } else {
      setActiveChip("all");
    }
    input.value = initialQuery;
    void runSearch();
  })();
})();
