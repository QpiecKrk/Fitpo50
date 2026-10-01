#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { canonicalFromHtml, modifiedDates, sha256, verifyDeployment } = require('./lib/deployment-live-verifier');
const { publicFingerprint } = require('./prepare-deployment-marker');

function parseArgs(argv) {
  const out = { baseUrl: 'https://fitpo50.pl', retries: 4, delayMs: 15000, timeoutMs: 20000 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === '--base-url' && value) { out.baseUrl = value.replace(/\/$/, ''); index += 1; }
    else if (token === '--commit' && value) { out.commit = value; index += 1; }
    else if (token === '--retries' && value) { out.retries = Math.max(0, Number(value) || 0); index += 1; }
    else if (token === '--delay-ms' && value) { out.delayMs = Math.max(0, Number(value) || 0); index += 1; }
    else if (token === '--timeout-ms' && value) { out.timeoutMs = Math.max(1000, Number(value) || 20000); index += 1; }
  }
  return out;
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || '').trim() || `git ${args.join(' ')} failed`);
  return String(result.stdout || '').trim();
}

function localArticlesForCommit(commit, baseUrl) {
  const result = spawnSync('git', ['diff', '--name-only', `${commit}^`, commit, '--', '*.html'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return String(result.stdout || '').split('\n').map((value) => value.trim()).filter((file) => file && !file.startsWith('_site/')).flatMap((file) => {
    if (!fs.existsSync(file)) return [];
    const html = fs.readFileSync(file, 'utf8');
    if (!/"@type"\s*:\s*"BlogPosting"/.test(html)) return [];
    const canonical = canonicalFromHtml(html);
    const dates = modifiedDates(html);
    if (!canonical || dates.length !== 1) throw new Error(`${file}: niejednoznaczny canonical lub dateModified.`);
    const slug = path.basename(file, '.html');
    const imagePaths = [...html.matchAll(/<(?:source|img)\b[^>]+(?:src|srcset)=["']([^"']+)["']/gi)]
      .flatMap((match) => match[1].split(',').map((entry) => entry.trim().split(/\s+/)[0]))
      .filter((value) => value && !/^(?:https?:|data:|\/\/)/.test(value))
      .map((value) => new URL(value, canonical).href);
    const exportedHtml = path.join('_site', file);
    const exportedPdf = path.join('_site', 'assets', 'pdf', `${slug}.pdf`);
    if (!fs.existsSync(exportedHtml)) throw new Error(`Brak ${exportedHtml}.`);
    if (!fs.existsSync(exportedPdf)) throw new Error(`Brak ${exportedPdf}.`);
    return [{
      url: canonical,
      dateModified: dates[0],
      pdfUrl: `${baseUrl}/assets/pdf/${slug}.pdf`,
      imageUrls: [...new Set(imagePaths)],
      expectedHtmlSha256: sha256(fs.readFileSync(exportedHtml)),
      expectedPdfSha256: sha256(fs.readFileSync(exportedPdf)),
    }];
  });
}

function expectedBaseFiles(baseUrl) {
  const files = [
    ['/', 'index.html'],
    ['/porady.html', 'porady.html'],
    ['/sitemap.xml', 'sitemap.xml'],
    ['/llms.txt', 'llms.txt'],
    ['/ads.txt', 'ads.txt'],
  ];
  return files.map(([urlPath, localPath]) => ({ url: `${baseUrl}${urlPath}`, sha256: sha256(fs.readFileSync(path.join('_site', localPath))) }));
}

function urlsFor(baseUrl, articles) {
  return [...new Set([
    `${baseUrl}/deployment.json`, `${baseUrl}/`, `${baseUrl}/porady.html`, `${baseUrl}/sitemap.xml`, `${baseUrl}/llms.txt`, `${baseUrl}/ads.txt`,
    ...articles.flatMap((article) => [article.url, article.pdfUrl, ...article.imageUrls]),
  ])];
}

async function fetchOne(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache', 'user-agent': 'fitpo50-deployment-verifier/1.0' }, signal: controller.signal });
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
  } finally { clearTimeout(timer); }
}

async function collect(urls, timeoutMs) {
  const responses = new Map();
  await Promise.all(urls.map(async (url) => {
    try { responses.set(url, await fetchOne(url, timeoutMs)); }
    catch (error) { responses.set(url, { status: 0, body: Buffer.alloc(0), error: String(error.message || error) }); }
  }));
  return responses;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const marker = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
  const fingerprint = publicFingerprint(path.join(process.cwd(), '_site'));
  if (marker.public_fingerprint_sha256 !== fingerprint) throw new Error('deployment.json nie odpowiada bieżącemu eksportowi _site. Uruchom npm run deployment:prepare.');
  const expectedCommit = args.commit || git(['rev-parse', 'HEAD']);
  const remoteCommit = git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s+/)[0] || '';
  const articles = localArticlesForCommit(expectedCommit, args.baseUrl);
  const baseFiles = expectedBaseFiles(args.baseUrl);
  let result;
  for (let attempt = 0; attempt <= args.retries; attempt += 1) {
    console.log(`[LIVE] Próba ${attempt + 1}/${args.retries + 1}.`);
    const responses = await collect(urlsFor(args.baseUrl, articles), args.timeoutMs);
    result = verifyDeployment({ expectedCommit, remoteCommit, marker, responses, baseUrl: args.baseUrl, baseFiles, articles });
    if (result.status === 'LIVE_DEPLOYED_AND_VALIDATED') break;
    if (attempt < args.retries) await sleep(args.delayMs);
  }
  fs.mkdirSync(path.join('data', 'reports'), { recursive: true });
  fs.writeFileSync(path.join('data', 'reports', 'deployment-live-status.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[${result.status}] commit=${expectedCommit} release=${marker.release_id}`);
  if (result.errors.length) result.errors.forEach((error) => console.error(`[BLOCKER] ${error}`));
  if (result.status !== 'LIVE_DEPLOYED_AND_VALIDATED') process.exit(2);
}

main().catch((error) => {
  console.error(`[LIVE][FAIL] ${error.message || error}`);
  process.exit(1);
});
