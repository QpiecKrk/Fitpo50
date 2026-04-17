(function() {
  'use strict';

  const feedRoot = document.querySelector('[data-news-feed]');
  const schemaNode = document.getElementById('news-feed-schema');
  if (!feedRoot) return;

  const fallbackVersion = Math.floor(Date.now() / 60000);
  const sources = [
    './admin/api/news-feed.php',
    'https://admin.fitpo50.pl/api/news-feed.php',
    `./assets/data/news-fallback.json?v=${fallbackVersion}`
  ];

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeItem(item) {
    const normalizedImage = item.image && typeof item.image === 'object'
      ? item.image
      : (item.thumbnail && typeof item.thumbnail === 'object' ? item.thumbnail : null);

    return {
      id: item.id || Math.random().toString(36).substr(2, 9),
      title: item.title || 'Bez tytułu',
      content_html: item.content_html || item.content || '',
      published_at: item.published_at || item.date || '',
      updated_at: item.updated_at || '',
      image: normalizedImage,
      sources: Array.isArray(item.sources) ? item.sources : []
    };
  }

  function buildImageHtml(item) {
    if (!item.image || !item.image.jpg) return '';
    const altText = escapeHtml(item.image.alt || item.title);
    const width = Number(item.image.width || 400);
    const height = Number(item.image.height || 250);

    return `
      <div class="news-card__media">
        <picture>
          ${item.image.avif ? `<source srcset="${item.image.avif}" type="image/avif">` : ''}
          ${item.image.webp ? `<source srcset="${item.image.webp}" type="image/webp">` : ''}
          <img src="${item.image.jpg}" alt="${altText}" loading="lazy" decoding="async" width="${width}" height="${height}">
        </picture>
      </div>
    `;
  }

  function buildSourcesHtml(item) {
    if (!item.sources || item.sources.length === 0) return '';
    return `
      <div class="news-card__sources">
        <details>
          <summary>Źródła i kontekst</summary>
          <ul>
            ${item.sources.map(src => `
              <li>
                <a href="${src.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(src.label || 'Źródło')}</a>
                ${src.note ? `<span class="news-card__source-note">${escapeHtml(src.note)}</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </details>
      </div>
    `;
  }

  function attachBodyStyling(cardNode) {
    const contentNode = cardNode.querySelector('.news-card__body');
    if (!contentNode) return;
    const anchors = contentNode.querySelectorAll('a[href]');
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  function buildNewsCard(rawItem, index) {
    const newsItem = normalizeItem(rawItem);
    const card = document.createElement('article');
    const hasImage = !!(newsItem.image && newsItem.image.jpg);
    card.className = `news-card ${index % 2 === 0 ? 'news-card--mint' : 'news-card--blue'}${hasImage ? '' : ' news-card--no-media'}`;
    card.setAttribute('data-news-id', newsItem.id);

    card.innerHTML = `
      ${buildImageHtml(newsItem)}
      <div class="news-card__content">
        <h3 class="news-card__title">${escapeHtml(newsItem.title)}</h3>
        <div class="news-card__body">${newsItem.content_html}</div>
        ${buildSourcesHtml(newsItem)}
      </div>
    `;

    attachBodyStyling(card);
    return card;
  }

  const initialBatchSize = 5;
  const nextBatchSize = 5;
  let allNewsItems = [];
  let renderedCount = 0;
  let isBatchLoading = false;
  let observer = null;
  let observerSupported = false;
  let paginationNode = null;
  let loaderNode = null;
  let sentinelNode = null;
  let moreButton = null;

  function ensurePagination() {
    if (paginationNode) return;

    paginationNode = document.createElement('div');
    paginationNode.className = 'news-feed-pagination';

    loaderNode = document.createElement('div');
    loaderNode.className = 'news-feed-loader';
    loaderNode.setAttribute('aria-live', 'polite');
    loaderNode.hidden = true;
    loaderNode.innerHTML = `
      <span class="news-feed-loader__dot"></span>
      <span class="news-feed-loader__dot"></span>
      <span class="news-feed-loader__dot"></span>
    `;

    sentinelNode = document.createElement('div');
    sentinelNode.className = 'news-feed-sentinel';
    sentinelNode.setAttribute('aria-hidden', 'true');

    moreButton = document.createElement('button');
    moreButton.type = 'button';
    moreButton.className = 'news-feed-more-btn';
    moreButton.textContent = 'Pokaż kolejne 5 newsów';
    moreButton.hidden = true;
    moreButton.addEventListener('click', () => appendNextBatch());

    paginationNode.appendChild(loaderNode);
    paginationNode.appendChild(sentinelNode);
    paginationNode.appendChild(moreButton);
  }

  function setBatchLoadingState(loading) {
    isBatchLoading = loading;
    if (!loaderNode) return;
    loaderNode.hidden = !loading;
    feedRoot.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  function updatePaginationVisibility() {
    if (!paginationNode) return;

    const hasMore = renderedCount < allNewsItems.length;
    paginationNode.hidden = !hasMore;

    if (!hasMore) {
      if (observer) observer.disconnect();
      return;
    }

    moreButton.hidden = observerSupported;
  }

  async function appendNextBatch() {
    if (isBatchLoading) return;
    if (renderedCount >= allNewsItems.length) return;

    setBatchLoadingState(true);
    await new Promise((resolve) => window.setTimeout(resolve, 280));

    const nextItems = allNewsItems.slice(renderedCount, renderedCount + nextBatchSize);
    const fragment = document.createDocumentFragment();
    nextItems.forEach((item, idx) => {
      fragment.appendChild(buildNewsCard(item, renderedCount + idx));
    });
    feedRoot.insertBefore(fragment, paginationNode);
    renderedCount += nextItems.length;

    setBatchLoadingState(false);
    updatePaginationVisibility();
  }

  function enableAutoBatching() {
    if (!('IntersectionObserver' in window) || !sentinelNode) {
      observerSupported = false;
      updatePaginationVisibility();
      return;
    }

    observerSupported = true;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          appendNextBatch();
        }
      });
    }, {
      root: feedRoot,
      threshold: 0.16,
      rootMargin: '0px 0px 140px 0px'
    });

    observer.observe(sentinelNode);
    updatePaginationVisibility();
  }

  function renderNews(items) {
    if (!Array.isArray(items) || items.length === 0) {
      feedRoot.innerHTML = `
        <article class="news-card news-card--placeholder">
          <div class="news-card__content">
            <h3 class="news-card__title">Brak opublikowanych newsów</h3>
            <p class="news-card__body">Dodaj pierwszy wpis w panelu administracyjnym, aby sekcja NEWS wyświetliła treści live.</p>
          </div>
        </article>
      `;
      feedRoot.setAttribute('aria-busy', 'false');
      return;
    }

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    observerSupported = false;
    allNewsItems = items.map((item) => normalizeItem(item));
    renderedCount = 0;
    setBatchLoadingState(false);
    feedRoot.innerHTML = '';
    ensurePagination();

    const firstBatch = allNewsItems.slice(0, initialBatchSize);
    firstBatch.forEach((item, index) => {
      feedRoot.appendChild(buildNewsCard(item, index));
    });
    renderedCount = firstBatch.length;

    feedRoot.appendChild(paginationNode);
    updatePaginationVisibility();
    enableAutoBatching();
  }

  function updateNewsSchema(items) {
    if (!schemaNode || !Array.isArray(items) || items.length === 0) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Szybkie newsy i ciekawostki',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: items.length,
      itemListElement: items.map((rawItem, idx) => {
        const item = normalizeItem(rawItem);
        const image = item.image && item.image.jpg
          ? ('https://fitpo50.pl/' + item.image.jpg.replace(/^\.\//, ''))
          : 'https://fitpo50.pl/assets/logo.jpg';
        const dateValue = (item.published_at || item.updated_at || '').slice(0, 10) || '2026-04-16';

        return {
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@type': 'Article',
            headline: item.title,
            url: 'https://fitpo50.pl/#news',
            datePublished: dateValue,
            dateModified: dateValue,
            image,
            author: { '@type': 'Organization', name: 'FitPo50' },
            publisher: {
              '@type': 'Organization',
              name: 'FitPo50',
              logo: { '@type': 'ImageObject', url: 'https://fitpo50.pl/assets/logo.jpg' }
            }
          }
        };
      })
    };

    schemaNode.textContent = JSON.stringify(schema);
  }

  async function tryFetch(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }
    const data = await response.json();
    if (!data) {
      throw new Error('INVALID_PAYLOAD');
    }

    if (Array.isArray(data.items)) {
      return data;
    }

    if (Array.isArray(data)) {
      return { items: data };
    }

    if (!Array.isArray(data.items)) {
      throw new Error('INVALID_PAYLOAD');
    }

    return data;
  }

  function scheduleSchemaUpdate(items) {
    if (!schemaNode || !Array.isArray(items) || items.length === 0) return;
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => updateNewsSchema(items), { timeout: 900 });
      return;
    }
    setTimeout(() => updateNewsSchema(items), 150);
  }

  async function initNews() {
    for (const url of sources) {
      try {
        const payload = await tryFetch(url);
        renderNews(payload.items);
        scheduleSchemaUpdate(payload.items);
        return;
      } catch (error) {
        // Continue to fallback source
      }
    }
    renderNews([]);
  }

  // Defer execution until the browser is idle or just after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(initNews, { timeout: 1200 });
      } else {
        setTimeout(initNews, 120);
      }
    });
  } else {
    initNews();
  }
})();
