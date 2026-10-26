#!/usr/bin/env node
'use strict';

const { EXIT, NewsPullError } = require('./news-pull');
const { validatePublicNewsCheckout } = require('./lib/news-public-integrity');

async function fetchWithTimeout(url, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache', 'user-agent': 'fitpo50-news-integrity/1.0' },
      signal: controller.signal,
    });
  } catch (error) {
    throw new NewsPullError(`NEWS_HTTP_ENVIRONMENT: brak odpowiedzi dla ${url} (${error.message || error}).`, EXIT.ENVIRONMENT);
  } finally {
    clearTimeout(timer);
  }
}

async function checkPublicNewsImagesHttp(options = {}) {
  const root = options.root || process.cwd();
  const baseUrl = String(options.baseUrl || 'https://fitpo50.pl').replace(/\/$/, '');
  const timeoutMs = Number(options.timeoutMs || 20_000);
  const fetchImpl = options.fetchImpl || global.fetch;
  const checkout = validatePublicNewsCheckout({ root });
  if (checkout.errors.length) {
    throw new NewsPullError(`NEWS_PUBLIC_INVALID: ${checkout.errors.join(' | ')}`, EXIT.DATA, checkout.errors);
  }
  const failures = [];
  await Promise.all(checkout.runtimeImages.map(async (image) => {
    const url = `${baseUrl}/${image.relative}`;
    const response = await fetchWithTimeout(url, timeoutMs, fetchImpl);
    if (response.status !== 200) failures.push(`${image.relative}: HTTP ${response.status}`);
  }));
  if (failures.length) {
    throw new NewsPullError(`NEWS_IMAGE_MISSING: ${failures.join(' | ')}`, EXIT.DATA, failures);
  }
  return { status: 'NEWS_PUBLIC_IMAGES_OK', checked: checkout.runtimeImages.length };
}

async function main() {
  try {
    const result = await checkPublicNewsImagesHttp();
    console.log(`[PASS] ${result.status}: ${result.checked} runtime wariantów NEWS zwraca HTTP 200.`);
  } catch (error) {
    const exitCode = error instanceof NewsPullError ? error.exitCode : EXIT.ENVIRONMENT;
    console.error(`[NEWS HTTP][FAIL][${exitCode}] ${error.message || error}`);
    if (Array.isArray(error.details)) error.details.forEach((detail) => console.error(`- ${detail}`));
    process.exitCode = exitCode;
  }
}

if (require.main === module) main();

module.exports = { checkPublicNewsImagesHttp, fetchWithTimeout };
