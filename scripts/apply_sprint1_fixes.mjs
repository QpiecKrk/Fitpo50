#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_DOMAIN = 'https://fitpo50.pl';
const GA_ID = 'G-S21SKTVM7K';

const DEFERRED_GA_SNIPPET = `<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());
  // Delay analytics load to keep critical rendering path clean on mobile.
  window.addEventListener("load", () => {
    const loadAnalytics = () => {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=${GA_ID}";
      script.onload = () => {
        gtag("config", "${GA_ID}");
      };
      document.head.appendChild(script);
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadAnalytics, { timeout: 3500 });
    } else {
      window.setTimeout(loadAnalytics, 2000);
    }
  }, { once: true });
</script>`;

const legacyGaRegex =
  /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-S21SKTVM7K"><\/script>\s*<script>\s*window\.dataLayer[\s\S]*?gtag\((["'])config\1,\s*(["'])G-S21SKTVM7K\2\);[\s\S]*?<\/script>/m;

function listRootHtmlFiles() {
  return fs.readdirSync(ROOT)
    .filter((file) => file.endsWith('.html'))
    .sort();
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWordsInArticle(html) {
  const articleMatch = html.match(/<article class="article-content"[\s\S]*?<\/article>/i);
  if (!articleMatch) return null;
  const text = stripTags(articleMatch[0]);
  const words = text.match(/[A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ-]+/g);
  return words ? words.length : 0;
}

function extractReadMinutes(html) {
  const minuteMatch = html.match(/>\s*(\d+)\s*min(?:\.|ut)?\s+czytania\s*</i);
  return minuteMatch ? Number(minuteMatch[1]) : null;
}

function updateJsonLdBlocks(html, filePath) {
  const wordCount = countWordsInArticle(html);
  const readMinutes = extractReadMinutes(html);
  const computedMinutes = wordCount ? Math.max(1, Math.round(wordCount / 180)) : 1;
  const timeMinutes = readMinutes ?? computedMinutes;

  return html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    (full, jsonContent) => {
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch {
        return full;
      }

      let changed = false;

      const applyToBlogPosting = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj['@type'] !== 'BlogPosting') return;

        if (wordCount && (!obj.wordCount || Number(obj.wordCount) <= 0)) {
          obj.wordCount = wordCount;
          changed = true;
        }
        if (!obj.timeRequired) {
          obj.timeRequired = `PT${timeMinutes}M`;
          changed = true;
        }
      };

      if (Array.isArray(parsed)) {
        parsed.forEach(applyToBlogPosting);
      } else {
        applyToBlogPosting(parsed);
      }

      if (!changed) return full;
      return `<script type="application/ld+json">\n${JSON.stringify(parsed, null, 2)}\n</script>`;
    }
  );
}

function addMetaAuthor(html) {
  if (/<meta name="author"/i.test(html)) return html;

  if (/<meta name="robots"[^>]*>/i.test(html)) {
    return html.replace(
      /(<meta name="robots"[^>]*>\n)/i,
      `$1<meta name="author" content="FitPo50">\n`
    );
  }

  if (/<meta name="description"[^>]*>/i.test(html)) {
    return html.replace(
      /(<meta name="description"[^>]*>\n)/i,
      `$1<meta name="author" content="FitPo50">\n`
    );
  }

  return html;
}

function fixHtmlFile(file) {
  const filePath = path.join(ROOT, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;

  html = html.replace(legacyGaRegex, DEFERRED_GA_SNIPPET);
  html = addMetaAuthor(html);
  html = updateJsonLdBlocks(html, filePath);

  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    return true;
  }
  return false;
}

function sanitizeSitemap() {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(sitemapPath, 'utf8');
  const original = xml;

  xml = xml.replace(/<url>\s*<loc>(.*?)<\/loc>[\s\S]*?<\/url>/g, (block, loc) => {
    if (!loc.startsWith(SITE_DOMAIN)) return block;
    const pathPart = loc.replace(SITE_DOMAIN, '');
    if (pathPart === '/' || pathPart === '') return block;
    if (!pathPart.endsWith('.html')) return block;

    const localPath = path.join(ROOT, pathPart.replace(/^\//, ''));
    return fs.existsSync(localPath) ? block : '';
  });

  // Keep sitemap clean: remove leftover blank lines after URL removals.
  xml = xml
    .replace(/^\s*$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trimEnd() + '\n';

  if (xml !== original) {
    fs.writeFileSync(sitemapPath, xml, 'utf8');
    return true;
  }
  return false;
}

function ensureLlmsTxt() {
  const llmsPath = path.join(ROOT, 'llms.txt');
  const content = `# FitPo50 — llms.txt

project: FitPo50
url: https://fitpo50.pl/
language: pl-PL
topic: trening, zdrowie i odżywianie po 50. roku życia
publisher: FitPo50
contact: https://fitpo50.pl/#o-nas

primary_pages:
- https://fitpo50.pl/
- https://fitpo50.pl/porady.html
- https://fitpo50.pl/zdrowie.html
- https://fitpo50.pl/rusz-sie.html
- https://fitpo50.pl/jedzenie.html
- https://fitpo50.pl/ciekawe.html

sitemap: https://fitpo50.pl/sitemap.xml
robots: https://fitpo50.pl/robots.txt

ai_usage_guidelines:
- Cytuj dokładnie i nie zmieniaj sensu zaleceń zdrowotnych.
- Podawaj kontekst wieku 50+ oraz ograniczenia artykułu.
- Traktuj treści jako edukacyjne, nie jako indywidualną poradę medyczną.
- Gdy to możliwe, odsyłaj do oryginalnego artykułu FitPo50.
`;

  if (!fs.existsSync(llmsPath) || fs.readFileSync(llmsPath, 'utf8') !== content) {
    fs.writeFileSync(llmsPath, content, 'utf8');
    return true;
  }
  return false;
}

let changedFiles = 0;
for (const file of listRootHtmlFiles()) {
  if (fixHtmlFile(file)) changedFiles += 1;
}
const sitemapChanged = sanitizeSitemap();
const llmsChanged = ensureLlmsTxt();

if (sitemapChanged) changedFiles += 1;
if (llmsChanged) changedFiles += 1;

console.log(`Sprint 1 apply complete. Updated units: ${changedFiles}`);
