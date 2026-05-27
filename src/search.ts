(function () {
  'use strict';

  type SearchCategory = 'all' | 'Ruch' | 'Jedzenie' | 'Zdrowie' | 'Ciekawe' | 'Porady';

  type SearchEntry = {
    slug: string;
    url: string;
    title: string;
    category: string;
    readTime: string;
    description: string;
    headings: string[];
    content: string;
  };

  type SearchResult = {
    entry: SearchEntry;
    score: number;
    snippet: string;
  };

  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  const clearBtn = document.querySelector<HTMLButtonElement>('[data-search-clear]');
  const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-search-chip]'));
  const countNode = document.querySelector<HTMLElement>('[data-search-count]');
  const resultsNode = document.querySelector<HTMLElement>('[data-search-results]');
  const emptyNode = document.querySelector<HTMLElement>('[data-search-empty]');

  if (!input || !resultsNode || !countNode || !emptyNode) {
    return;
  }

  let indexCache: SearchEntry[] | null = null;
  let activeCategory: SearchCategory = 'all';
  let debounceTimer = 0;
  let fallbackNoticeShown = false;
  const MIN_TOKEN_LENGTH = 4;

  function escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeText(value: string): string {
    return value
      .toLocaleLowerCase('pl-PL')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(query: string): string[] {
    return normalizeText(query)
      .split(' ')
      .filter((token) => token.length >= MIN_TOKEN_LENGTH);
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildDiacriticsRegexStr(token: string): string {
    const map: Record<string, string> = {
      a: '[aąAĄ]',
      c: '[cćCĆ]',
      e: '[eęEĘ]',
      l: '[lłLŁ]',
      n: '[nńNŃ]',
      o: '[oóOÓ]',
      s: '[sśSŚ]',
      z: '[zźżZŹŻ]',
      x: '[xX]'
    };

    return token
      .split('')
      .map((char) => map[char.toLowerCase()] || escapeRegExp(char))
      .join('');
  }

  function buildWholeWordRegex(token: string, flags = 'gu'): RegExp {
    const pattern = buildDiacriticsRegexStr(token);
    return new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, flags);
  }

  function countWholeWordOccurrences(text: string, token: string): number {
    const regex = buildWholeWordRegex(token);
    let count = 0;
    let match = regex.exec(text);
    while (match) {
      count += 1;
      match = regex.exec(text);
    }
    return count;
  }

  async function loadIndex(): Promise<SearchEntry[]> {
    if (indexCache) return indexCache;

    const response = await fetch('./assets/data/search-index.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Nie udało się pobrać indeksu wyszukiwarki.');
    }

    const payload = (await response.json()) as SearchEntry[];
    indexCache = Array.isArray(payload) ? payload : [];
    return indexCache;
  }

  function createSnippet(content: string, queryTokens: string[]): string {
    const plain = content.replace(/\s+/g, ' ').trim();
    if (!plain) return '';

    const normalizedPlain = normalizeText(plain);
    let matchIndex = -1;
    let tokenUsed = '';

    for (const token of queryTokens) {
      const regex = buildWholeWordRegex(token);
      const match = regex.exec(normalizedPlain);
      if (!match) continue;
      const idx = match.index + (match[1]?.length || 0);
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
      const regex = buildWholeWordRegex(token, 'giu');
      highlighted = highlighted.replace(regex, (_, prefix: string, word: string) => `${prefix}<mark class="search-highlight">${word}</mark>`);
    }

    const leftDots = start > 0 ? '... ' : '';
    const rightDots = end < plain.length ? ' ...' : '';
    return `${leftDots}${highlighted}${rightDots}`;
  }

  function scoreEntry(entry: SearchEntry, queryTokens: string[]): SearchResult | null {
    const title = normalizeText(entry.title);
    const description = normalizeText(entry.description);
    const headings = normalizeText(entry.headings.join(' '));
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

  function renderResults(results: SearchResult[]): void {
    if (results.length === 0) {
      resultsNode.innerHTML = '';
      emptyNode.hidden = false;
      return;
    }

    emptyNode.hidden = true;

    resultsNode.innerHTML = results
      .map(({ entry, snippet }) => {
        const categoryClass = `search-result__badge--${normalizeText(entry.category)}`;
        const readTime = entry.readTime ? `<span class="search-result__meta">${escapeHtml(entry.readTime)}</span>` : '';

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
      })
      .join('');
  }

  async function runSearch(): Promise<void> {
    const query = input.value.trim();
    const tokens = tokenize(query);

    if (tokens.length === 0) {
      countNode.textContent = `Wpisz frazę (minimum ${MIN_TOKEN_LENGTH} znaki), aby przeszukać artykuły.`;
      resultsNode.innerHTML = '';
      emptyNode.hidden = true;
      return;
    }

    const index = await loadIndex();

    const filtered = activeCategory === 'all'
      ? index
      : index.filter((entry) => entry.category === activeCategory);

    let scored = filtered
      .map((entry) => scoreEntry(entry, tokens))
      .filter((result): result is SearchResult => result !== null)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'pl'))
      .slice(0, 30);

    fallbackNoticeShown = false;
    if (scored.length === 0 && activeCategory !== 'all') {
      scored = index
        .map((entry) => scoreEntry(entry, tokens))
        .filter((result): result is SearchResult => result !== null)
        .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'pl'))
        .slice(0, 30);
      fallbackNoticeShown = scored.length > 0;
    }

    const uniqueArticles = new Set(scored.map((item) => item.entry.url)).size;
    countNode.textContent = fallbackNoticeShown
      ? `Brak wyników w kategorii ${activeCategory}. Pokazuję ${scored.length} wyników globalnie (${uniqueArticles} artykułów).`
      : `Znaleziono ${scored.length} wyników w ${uniqueArticles} artykułach.`;

    renderResults(scored);
  }

  function scheduleSearch(): void {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void runSearch();
    }, 150);
  }

  function syncUrl(): void {
    const params = new URLSearchParams(window.location.search);
    if (input.value.trim()) {
      params.set('q', input.value.trim());
    } else {
      params.delete('q');
    }
    if (activeCategory !== 'all') {
      params.set('cat', activeCategory);
    } else {
      params.delete('cat');
    }

    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', next);
  }

  function setActiveChip(next: SearchCategory): void {
    activeCategory = next;
    chips.forEach((chip) => {
      const isActive = chip.dataset.searchChip === next;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  input.addEventListener('input', () => {
    syncUrl();
    scheduleSearch();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      syncUrl();
      void runSearch();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncUrl();
      void runSearch();
      input.focus();
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const next = (chip.dataset.searchChip || 'all') as SearchCategory;
      setActiveChip(next);
      syncUrl();
      void runSearch();
    });
  });

  const initialParams = new URLSearchParams(window.location.search);
  const initialQuery = initialParams.get('q') || '';
  const initialCategory = initialParams.get('cat') as SearchCategory | null;

  if (initialCategory && ['all', 'Ruch', 'Jedzenie', 'Zdrowie', 'Ciekawe', 'Porady'].includes(initialCategory)) {
    setActiveChip(initialCategory);
  } else {
    setActiveChip('all');
  }

  input.value = initialQuery;

  void runSearch();
})();
