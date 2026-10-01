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
    { path: '/ads.txt' },
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
    for (const imageUrl of article.imageUrls || []) {
      const image = responses.get(imageUrl);
      if (!image || image.status !== 200 || Buffer.from(image.body || '').length === 0) errors.push(`${imageUrl}: brak wymaganego obrazu.`);
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

module.exports = { canonicalFromHtml, modifiedDates, sha256, sitemapLastmod, verifyDeployment };
