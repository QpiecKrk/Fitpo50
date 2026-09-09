'use strict';

const DEFAULT_TIMEOUT_MS = 120000;

async function withChromium(chromium, task, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const label = String(options.label || 'Test przeglądarkowy');
  const launchOptions = options.launchOptions || { headless: true };
  let browser;
  let timeoutId;

  try {
    browser = await chromium.launch(launchOptions);
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} przekroczył limit ${Math.round(timeoutMs / 1000)} s.`));
      }, timeoutMs);
    });
    return await Promise.race([Promise.resolve().then(() => task(browser)), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  withChromium,
};
