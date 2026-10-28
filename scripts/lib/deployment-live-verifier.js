const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''))).digest('hex');
}

function canonicalFromHtml(html) {
  return String(html || '').match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]
    || String(html || '').match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)?.[1]
    || '';
}

function modifiedDates(html) {
  const values = [];
  const meta = String(html || '').match(/<meta\s+property=["']article:modified_time["']\s+content=["']([^"']+)["']/i)?.[1];
  if (meta) values.push(meta);
  for (const match of String(html || '').matchAll(/"dateModified"\s*:\s*"([^"]+)"/g)) values.push(match[1]);
  return [...new Set(values)];
}

function sitemapLastmod(xml, url) {
  const block = [...String(xml || '').matchAll(/<url\b[^>]*>[\s\S]*?<\/url>/gi)]
    .map((match) => match[0])
    .find((entry) => entry.match(/<loc>([^<]+)<\/loc>/i)?.[1] === url) || '';
  return block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1] || '';
}

function expectedNewsFiles(marker, errors) {
  if (Number(marker?.version || 0) < 3) return [];
  const news = marker?.news;
  if (!news || typeof news !== 'object') {
    errors.push('deployment.json v3 nie zawiera wymaganej sekcji news.');
    return [];
  }
  const fallback = news.fallback;
  const runtimeImages = news.runtime_images;
  if (!fallback || fallback.path !== 'assets/data/news-fallback.json' || !/^[a-f0-9]{64}$/i.test(String(fallback.sha256 || ''))) {
    errors.push('deployment.json v3 zawiera nieprawidłowy snapshot news.fallback.');
  }
  if (!Array.isArray(runtimeImages)) {
    errors.push('deployment.json v3 nie zawiera tablicy news.runtime_images.');
  }
  const files = [];
  if (fallback?.path === 'assets/data/news-fallback.json' && /^[a-f0-9]{64}$/i.test(String(fallback.sha256 || ''))) {
    files.push({ type: 'NEWS_FALLBACK', path: fallback.path, sha256: String(fallback.sha256).toLowerCase() });
  }
  for (const entry of Array.isArray(runtimeImages) ? runtimeImages : []) {
    const imagePath = String(entry?.path || '').replace(/\\/g, '/');
    const imageSha256 = String(entry?.sha256 || '').toLowerCase();
    if (!/^assets\/news\/[A-Za-z0-9_-]+\.(?:avif|webp|jpg)$/i.test(imagePath) || !/^[a-f0-9]{64}$/.test(imageSha256)) {
      errors.push(`deployment.json v3 zawiera nieprawidłowy obraz NEWS: ${imagePath || '(brak ścieżki)'}.`);
      continue;
    }
    files.push({ type: 'NEWS_RUNTIME_IMAGE', path: imagePath, sha256: imageSha256 });
  }
  if (new Set(files.map((entry) => entry.path)).size !== files.length) {
    errors.push('deployment.json v3 zawiera zduplikowane ścieżki NEWS.');
  }
  return files;
}

function verifyDeployment({ expectedCommit, remoteCommit, marker, responses, baseUrl, baseFiles = [], articles = [] }) {
  const errors = [];
  const checks = [];
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  if (!expectedCommit || remoteCommit !== expectedCommit) errors.push(`origin/main=${remoteCommit || 'MISSING'}; oczekiwano ${expectedCommit || 'MISSING'}.`);

  const markerUrl = `${normalizedBase}/deployment.json`;
  const liveMarker = responses.get(markerUrl);
  const expectedMarker = `${JSON.stringify(marker, null, 2)}\n`;
  const markerMatches = Boolean(liveMarker && liveMarker.status === 200 && sha256(liveMarker.body) === sha256(expectedMarker));
  if (!markerMatches) errors.push(`${markerUrl}: brak markera bieżącego wydania.`);
  checks.push({ type: 'RELEASE_MARKER', url: markerUrl, pass: markerMatches });

  const requiredBaseFiles = [
    { path: '/', canonical: `${normalizedBase}/` },
    { path: '/porady.html', canonical: `${normalizedBase}/porady.html` },
    { path: '/sitemap.xml' },
    { path: '/llms.txt' },
    { path: '/llms-full.txt' },
    { path: '/ads.txt' },
    { path: '/assets/data/search-index.json' },
  ];
  for (const item of requiredBaseFiles) {
    const url = `${normalizedBase}${item.path}`;
    const response = responses.get(url);
    const ok = Boolean(response && response.status === 200);
    if (!ok) errors.push(`${url}: brak HTTP 200.`);
    const expected = baseFiles.find((entry) => entry.url === url);
    if (ok && expected && sha256(response.body) !== expected.sha256) errors.push(`${url}: produkcja różni się od _site.`);
    if (ok && item.canonical) {
      const canonical = canonicalFromHtml(response.body);
      if (canonical !== item.canonical) errors.push(`${url}: canonical=${canonical || 'MISSING'}.`);
    }
    checks.push({ type: 'BASE_FILE', url, pass: ok });
  }

  for (const expected of expectedNewsFiles(marker, errors)) {
    const url = `${normalizedBase}/${expected.path}`;
    const response = responses.get(url);
    const httpOk = Boolean(response && response.status === 200);
    const hashOk = httpOk && sha256(response.body) === expected.sha256;
    if (!httpOk) errors.push(`${expected.path}: NEWS nie zwrócił HTTP 200.`);
    else if (!hashOk) errors.push(`${expected.path}: produkcja różni się od SHA-256 zapisanego w markerze.`);
    checks.push({ type: expected.type, url, pass: hashOk });
  }

  const sitemap = responses.get(`${normalizedBase}/sitemap.xml`);
  for (const article of articles) {
    const response = responses.get(article.url);
    if (!response || response.status !== 200) {
      errors.push(`${article.url}: brak HTTP 200.`);
      continue;
    }
    const html = String(response.body || '');
    if (article.expectedHtmlSha256 && sha256(response.body) !== article.expectedHtmlSha256) errors.push(`${article.url}: produkcja zawiera stary lub zmieniony HTML.`);
    if (canonicalFromHtml(html) !== article.url) errors.push(`${article.url}: błędny canonical.`);
    const dates = modifiedDates(html);
    if (!dates.length || dates.some((value) => value !== article.dateModified)) errors.push(`${article.url}: dateModified nie odpowiada eksportowi.`);
    if (!sitemap || sitemap.status !== 200 || sitemapLastmod(sitemap.body, article.url) !== article.dateModified.slice(0, 10)) errors.push(`${article.url}: brak zgodnego lastmod w sitemap.`);
    const pdf = responses.get(article.pdfUrl);
    if (!pdf || pdf.status !== 200 || !Buffer.from(pdf.body || '').subarray(0, 5).equals(Buffer.from('%PDF-'))) errors.push(`${article.pdfUrl}: brak prawidłowego PDF.`);
    else if (article.expectedPdfSha256 && sha256(pdf.body) !== article.expectedPdfSha256) errors.push(`${article.pdfUrl}: PDF różni się od _site.`);
    const images = Array.isArray(article.images) && article.images.length
      ? article.images
      : (article.imageUrls || []).map((url) => ({ url, expectedSha256: '' }));
    for (const expectedImage of images) {
      const imageUrl = expectedImage.url;
      const image = responses.get(imageUrl);
      if (!image || image.status !== 200 || Buffer.from(image.body || '').length === 0) errors.push(`${imageUrl}: brak wymaganego obrazu.`);
      else if (expectedImage.expectedSha256 && sha256(image.body) !== expectedImage.expectedSha256) errors.push(`${imageUrl}: obraz różni się od markera wdrożenia.`);
    }
    for (const listingUrl of article.listingUrls || []) {
      const listing = responses.get(listingUrl);
      if (!listing || listing.status !== 200 || !String(listing.body || '').includes(`${new URL(article.url).pathname.slice(1)}`)) {
        errors.push(`${listingUrl}: listing lub indeks nie zawiera ${article.url}.`);
      }
    }
    checks.push({ type: 'ARTICLE', url: article.url, pass: true });
  }

  const pushed = Boolean(expectedCommit && remoteCommit === expectedCommit);
  const deployed = pushed && markerMatches;
  return {
    version: 1,
    status: !pushed ? 'NOT_PUSHED' : (!deployed ? 'PUSHED' : (errors.length ? 'DEPLOYED' : 'LIVE_DEPLOYED_AND_VALIDATED')),
    expected_commit: expectedCommit,
    remote_commit: remoteCommit,
    release_id: marker?.release_id || '',
    checks,
    errors,
  };
}

module.exports = { canonicalFromHtml, expectedNewsFiles, modifiedDates, sha256, sitemapLastmod, verifyDeployment };
