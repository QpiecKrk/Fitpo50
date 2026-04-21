#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function getHtmlFiles() {
  return fs.readdirSync(process.cwd())
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html');
}

function isArticleHtml(content) {
  return /<body[^>]*class="[^"]*article-template[^"]*"/i.test(content);
}

function validateFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const errors = [];

  const requiredPatterns = [
    { label: 'body.article-template', regex: /<body[^>]*class="[^"]*article-template[^"]*"/i },
    { label: 'body.article--kategoria', regex: /<body[^>]*class="[^"]*article--(ruch|jedzenie|zdrowie|ciekawe)[^"]*"/i },
    { label: '.shell', regex: /class="shell"/i },
    { label: 'header.topbar', regex: /<header\s+class="topbar"/i },
    { label: 'article-intro-grid', regex: /class="[^"]*article-intro-grid[^"]*"/i },
    { label: 'article-content', regex: /class="article-content"/i },
    { label: 'Czytelnia index-style section', regex: /<section\s+class="reading-room porady-preview section-padding"\s+id="porady-preview">/i },
    { label: 'Czytelnia head', regex: /class="reading-room__head\s+reveal"/i },
    { label: 'Czytelnia icon wrapper', regex: /class="title-with-icon"/i },
    { label: 'bottom-nav', regex: /<nav\s+class="bottom-nav"/i },
    { label: 'site-footer-bento', regex: /<footer\s+class="site-footer-bento"/i },
    { label: 'style.css include', regex: /href="\.\/style\.css(\?v=[^"]+)?"/i },
    { label: 'article.css include', regex: /href="\.\/article\.css(\?v=[^"]+)?"/i }
  ];

  for (const rule of requiredPatterns) {
    if (!rule.regex.test(raw)) errors.push(`Brak: ${rule.label}`);
  }

  if (/\sstyle\s*=\s*['"]/i.test(raw)) {
    errors.push('Wykryto inline CSS (style="...")');
  }

  if (/<style[\s>]/i.test(raw)) {
    errors.push('Wykryto lokalny blok <style>');
  }

  const bodyOpen = raw.search(/<body[^>]*>/i);
  const bodyClose = raw.search(/<\/body>/i);
  const footerOpen = raw.search(/<footer\s+class="site-footer-bento"/i);
  if (bodyOpen === -1 || bodyClose === -1 || footerOpen === -1) {
    errors.push('Brak body/footer do walidacji położenia');
  } else if (!(footerOpen > bodyOpen && footerOpen < bodyClose)) {
    errors.push('Footer jest poza <body>');
  }

  const bodyClassMatch = raw.match(/<body[^>]*class="([^"]+)"/i);
  const categoryMatch = bodyClassMatch ? bodyClassMatch[1].match(/article--(ruch|jedzenie|zdrowie|ciekawe)/i) : null;
  if (categoryMatch) {
    const key = categoryMatch[1].toLowerCase();
    const kickerRegex = new RegExp(`article-kicker-card--${key}`, 'i');
    if (!kickerRegex.test(raw)) {
      errors.push(`Kategoria body (${key}) nie zgadza się z article-kicker-card--${key}`);
    }
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const explicitMode = args.length > 0;
  let files = explicitMode ? args : getHtmlFiles();
  files = files.filter((f) => fs.existsSync(path.resolve(process.cwd(), f)));

  const articleFiles = files.filter((f) => {
    if (explicitMode) return true;
    const c = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
    return isArticleHtml(c);
  });

  if (!articleFiles.length) {
    console.log('Brak plików artykułów do walidacji.');
    return;
  }

  let hasErrors = false;
  for (const f of articleFiles) {
    const errs = validateFile(path.resolve(process.cwd(), f));
    if (errs.length) {
      hasErrors = true;
      console.log(`\n✖ ${f}`);
      errs.forEach((e) => console.log(`  - ${e}`));
    } else {
      console.log(`✔ ${f}`);
    }
  }

  if (hasErrors) process.exit(1);
}

main();
