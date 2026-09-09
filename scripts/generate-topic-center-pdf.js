#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { pageKind } = require('./lib/publication-page-kind');
const { prepareCenterPrint } = require('./lib/topic-center-print');
const { withChromium } = require('./lib/playwright-lifecycle');

async function generate(file) {
  const html = fs.readFileSync(file, 'utf8');
  if (pageKind(html) !== 'topic_center') throw new Error('Generator centrum wymaga struktury hub-shell/main/hub-title.');
  await withChromium(chromium, async (browser) => {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.route(/^https?:\/\//, (route) => route.abort());
    await page.goto(pathToFileURL(path.resolve(file)).href);
    await prepareCenterPrint(page);
    await page.evaluate(() => document.fonts.ready);
    const slug = path.basename(file, '.html');
    const output = path.join(path.dirname(file), 'assets', 'pdf', `${slug}.pdf`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await page.pdf({ path: output, format: 'A4', preferCSSPageSize: true, printBackground: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;text-align:center;font-size:8px;color:#666">FitPo50 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
    console.log(`[PDF] ${output}`);
  }, { timeoutMs: 120000, label: `PDF centrum ${path.basename(file)}` });
}

if (require.main === module) generate(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { generate };
