#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { verifyLiveResponses } = require('./lib/popraw-seo-live-verifier');

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = {
    manifest: path.join(ROOT, 'data', 'reports', 'popraw-seo-deployments.json'),
    outputDir: path.join(ROOT, 'data', 'reports'),
    retries: 4,
    delayMs: 15000,
    timeoutMs: 20000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    const value = String(argv[index + 1] || '');
    if (token === '--manifest' && value) { out.manifest = path.resolve(ROOT, value); index += 1; }
    else if (token === '--output-dir' && value) { out.outputDir = path.resolve(ROOT, value); index += 1; }
    else if (token === '--retries' && value) { out.retries = Math.max(0, Number(value) || 0); index += 1; }
    else if (token === '--delay-ms' && value) { out.delayMs = Math.max(0, Number(value) || 0); index += 1; }
    else if (token === '--timeout-ms' && value) { out.timeoutMs = Math.max(1000, Number(value) || 20000); index += 1; }
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOne(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache', 'user-agent': 'fitpo50-popraw-seo-live/1.0' },
      signal: controller.signal,
    });
    const body = Buffer.from(await response.arrayBuffer());
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function urlsForManifest(manifest) {
  return [...new Set([
    'https://fitpo50.pl/sitemap.xml',
    ...(manifest.targets || []).flatMap((target) => [
      target.url,
      target.pdf_url,
      ...(target.source_pages || []).flatMap((source) => [source.url, source.pdf_url]),
    ]),
  ].filter(Boolean))];
}

async function collectResponses(manifest, timeoutMs) {
  const responses = new Map();
  for (const url of urlsForManifest(manifest)) {
    try {
      responses.set(url, await fetchOne(url, timeoutMs));
    } catch (error) {
      responses.set(url, { status: 0, body: Buffer.alloc(0), error: String(error.message || error) });
    }
  }
  return responses;
}

function writeOutputs(result, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'gsc-live-submit-queue.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const lines = [
    `Status: ${result.status}`,
    '',
    'GSC URL Inspection — wklej te adresy:',
    ...(result.gsc_url_inspection.length ? result.gsc_url_inspection.map((url) => `- ${url}`) : ['- brak, produkcja nie została potwierdzona']),
    '',
    'Strony źródłowe zmienione linkowaniem:',
    ...(result.source_pages_for_recrawl.length ? result.source_pages_for_recrawl.map((url) => `- ${url}`) : ['- brak']),
    ...(result.errors.length ? ['', 'Blokery:', ...result.errors.map((error) => `- ${error}`)] : []),
  ];
  fs.writeFileSync(path.join(outputDir, 'gsc-live-submit-queue.txt'), `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.manifest)) {
    console.log('[LIVE SEO] Brak oczekującego manifestu popraw-seo — nic do sprawdzenia.');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
  let result = null;
  for (let attempt = 0; attempt <= args.retries; attempt += 1) {
    console.log(`[LIVE SEO] Próba ${attempt + 1}/${args.retries + 1}.`);
    const responses = await collectResponses(manifest, args.timeoutMs);
    result = verifyLiveResponses(manifest, responses);
    if (result.status === 'LIVE_DEPLOYED_AND_VALIDATED') break;
    if (attempt < args.retries) await sleep(args.delayMs);
  }
  writeOutputs(result, args.outputDir);
  if (result.status !== 'LIVE_DEPLOYED_AND_VALIDATED') {
    result.errors.forEach((error) => console.error(`[LIVE SEO][BLOCKED] ${error}`));
    process.exit(2);
  }
  console.log('[LIVE_DEPLOYED_AND_VALIDATED] Produkcja odpowiada zatwierdzonemu pakietowi.');
  console.log('GSC URL Inspection:');
  result.gsc_url_inspection.forEach((url) => console.log(`- ${url}`));
  if (result.source_pages_for_recrawl.length) {
    console.log('Strony źródłowe do ponownego przeskanowania:');
    result.source_pages_for_recrawl.forEach((url) => console.log(`- ${url}`));
  }
}

main().catch((error) => {
  console.error(`[LIVE SEO][FAIL] ${error.message || error}`);
  process.exit(1);
});
