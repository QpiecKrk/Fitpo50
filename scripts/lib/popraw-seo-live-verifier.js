const crypto = require('crypto');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
  return values;
}

function sitemapLastmod(xml, url) {
  const block = [...String(xml || '').matchAll(/<url\b[^>]*>[\s\S]*?<\/url>/gi)]
    .map((match) => match[0]).find((entry) => entry.match(/<loc>([^<]+)<\/loc>/i)?.[1] === url) || '';
  return block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1] || '';
}

function bodyHash(body) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(body) ? body : String(body || '')).digest('hex');
}

function verifyLiveResponses(manifest, responses) {
  const errors = [];
  const checks = [];
  if (!manifest || manifest.status !== 'COMMITTED_LOCALLY_AWAITING_LIVE_DEPLOYMENT') {
    errors.push('Manifest nie oczekuje na wdrożenie live.');
  }
  const sitemap = responses.get('https://fitpo50.pl/sitemap.xml');
  if (!sitemap || sitemap.status !== 200) errors.push('Produkcja: sitemap.xml nie zwróciła HTTP 200.');
  for (const target of manifest.targets || []) {
    const htmlResponse = responses.get(target.url);
    if (!htmlResponse || htmlResponse.status !== 200) {
      errors.push(`${target.url}: brak HTTP 200.`);
      continue;
    }
    const html = String(htmlResponse.body || '');
    const canonical = canonicalFromHtml(html);
    if (canonical !== target.url) errors.push(`${target.url}: canonical=${canonical || 'MISSING'}.`);
    const dates = modifiedDates(html);
    if (!dates.length || dates.some((value) => value !== target.date_modified)) errors.push(`${target.url}: dateModified nie odpowiada zatwierdzonej wersji.`);
    for (const needle of target.content_needles || []) {
      if (!normalizeText(html).includes(normalizeText(needle))) errors.push(`${target.url}: brak zatwierdzonego fragmentu treści.`);
    }
    const exactHash = bodyHash(html) === target.expected_html_sha256;
    checks.push({ url: target.url, type: 'HTML', status: 200, canonical, date_modified: dates[0] || '', exact_hash: exactHash });
    const pdfResponse = responses.get(target.pdf_url);
    if (!pdfResponse || pdfResponse.status !== 200 || !Buffer.from(pdfResponse.body || '').subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      errors.push(`${target.pdf_url}: brak prawidłowego PDF na produkcji.`);
    } else {
      if (target.expected_pdf_sha256 && bodyHash(pdfResponse.body) !== target.expected_pdf_sha256) errors.push(`${target.pdf_url}: PDF nie odpowiada zatwierdzonej wersji.`);
      checks.push({ url: target.pdf_url, type: 'PDF', status: 200 });
    }
    const lastmod = sitemap && sitemap.status === 200 ? sitemapLastmod(sitemap.body, target.url) : '';
    if (lastmod !== String(target.date_modified || '').slice(0, 10)) errors.push(`${target.url}: sitemap lastmod=${lastmod || 'MISSING'}.`);
    for (const source of target.source_pages || []) {
      const response = responses.get(source.url);
      if (!response || response.status !== 200) {
        errors.push(`${source.url}: strona źródłowa nie zwróciła HTTP 200.`);
        continue;
      }
      for (const needle of source.content_needles || []) {
        if (!normalizeText(response.body).includes(normalizeText(needle))) errors.push(`${source.url}: brak zatwierdzonego linku lub fragmentu.`);
      }
      const sourceCanonical = canonicalFromHtml(response.body);
      if (sourceCanonical !== source.url) errors.push(`${source.url}: canonical=${sourceCanonical || 'MISSING'}.`);
      const sourceDates = modifiedDates(response.body);
      if (!sourceDates.length || sourceDates.some((value) => value !== source.date_modified)) errors.push(`${source.url}: dateModified nie odpowiada zatwierdzonej wersji.`);
      const sourcePdf = responses.get(source.pdf_url);
      if (!sourcePdf || sourcePdf.status !== 200 || !Buffer.from(sourcePdf.body || '').subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        errors.push(`${source.pdf_url}: brak prawidłowego PDF na produkcji.`);
      } else if (source.expected_pdf_sha256 && bodyHash(sourcePdf.body) !== source.expected_pdf_sha256) {
        errors.push(`${source.pdf_url}: PDF nie odpowiada zatwierdzonej wersji.`);
      }
      const sourceLastmod = sitemap && sitemap.status === 200 ? sitemapLastmod(sitemap.body, source.url) : '';
      if (sourceLastmod !== String(source.date_modified || '').slice(0, 10)) errors.push(`${source.url}: sitemap lastmod=${sourceLastmod || 'MISSING'}.`);
      checks.push({ url: source.url, type: 'SOURCE_PAGE', status: 200, canonical: sourceCanonical, date_modified: sourceDates[0] || '' });
    }
  }
  const inspectionUrls = [...new Set((manifest.targets || []).map((target) => target.url))].slice(0, 3);
  const recrawlUrls = [...new Set((manifest.targets || []).flatMap((target) => target.source_pages_for_recrawl || []))];
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    status: errors.length ? 'LIVE_DEPLOYMENT_INCOMPLETE' : 'LIVE_DEPLOYED_AND_VALIDATED',
    approved_ids: manifest.approved_ids || [],
    gsc_url_inspection: errors.length ? [] : inspectionUrls,
    source_pages_for_recrawl: errors.length ? [] : recrawlUrls,
    checks,
    errors,
  };
}

module.exports = {
  bodyHash,
  canonicalFromHtml,
  modifiedDates,
  sitemapLastmod,
  verifyLiveResponses,
};
