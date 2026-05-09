#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOMAIN = 'https://fitpo50.pl';

function listHtmlFiles() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
}

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCanonical(html, file) {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/i);
  if (m) return m[1];
  return `${DOMAIN}/${file}`;
}

function extractTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (title) return stripHtml(title[1]).replace(/\s*\|\s*FitPo50.*/i, '');
  return 'Artykuł FitPo50';
}

function extractFirstParagraph(html) {
  const m = html.match(/<article class="article-content"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return 'Artykuł wyjaśnia temat praktycznie, prostym językiem i z naciskiem na wdrożenie.';
  const text = stripHtml(m[1]);
  if (text.length <= 280) return text;
  return `${text.slice(0, 277).trim()}...`;
}

function extractSection(html) {
  const section = html.match(/<meta property="article:section" content="([^"]+)"/i);
  if (section) return section[1];

  const m = html.match(/<div class="article-header__meta"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
  if (m) return stripHtml(m[1]) || 'Porady';
  return 'Porady';
}

function hasBlogPosting(html) {
  return /"@type":\s*"BlogPosting"/.test(html);
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  html.replace(/<script type="application\/ld\+json"(?:[^>]*)>([\s\S]*?)<\/script>/g, (full, content, offset) => {
    try {
      const parsed = JSON.parse(content);
      blocks.push({ full, content, parsed, offset });
    } catch {
      // ignore
    }
    return full;
  });
  return blocks;
}

function containsType(parsed, typeName) {
  if (Array.isArray(parsed)) return parsed.some((x) => containsType(x, typeName));
  if (!parsed || typeof parsed !== 'object') return false;
  if (parsed['@type'] === typeName) return true;
  return Object.values(parsed).some((v) => containsType(v, typeName));
}

function ensureArticleSectionMeta(html, section) {
  if (/<meta property="article:section"/i.test(html)) return html;
  return html.replace(
    /(<meta property="article:author" content="[^"]*">\n)/i,
    `$1<meta property="article:section" content="${section}">\n`
  );
}

function makeFaqScript({ title, firstParagraph }) {
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `O czym jest artykuł: "${title}"?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: firstParagraph
        }
      },
      {
        '@type': 'Question',
        name: 'Dla kogo jest ten materiał?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Materiał jest dla osób po 50. roku życia, które chcą poprawić zdrowie, sprawność i codzienne nawyki bez skrajnych metod.'
        }
      },
      {
        '@type': 'Question',
        name: 'Jaki pierwszy krok wdrożyć po przeczytaniu?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Wybierz jedną małą zmianę na najbliższe 7 dni i zapisz ją w kalendarzu. Najlepsze efekty daje regularność, nie jednorazowy zryw.'
        }
      }
    ]
  };
  return `<script type="application/ld+json" id="faqpage-schema-auto">\n${JSON.stringify(faq, null, 2)}\n</script>`;
}

function makeSpeakableScript({ canonical, title }) {
  const speakable = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    url: canonical,
    name: title,
    inLanguage: 'pl-PL',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.article-header__title', '.article-content > p:first-of-type']
    }
  };
  return `<script type="application/ld+json" id="speakable-schema-auto">\n${JSON.stringify(speakable, null, 2)}\n</script>`;
}

function injectSchema(html, snippets) {
  if (snippets.length === 0) return html;

  const marker = html.match(/<link href="https:\/\/api\.fontshare\.com\/v2\/css\?f\[\]=zodiak/i);
  if (marker && typeof marker.index === 'number') {
    return `${html.slice(0, marker.index)}${snippets.join('\n\n')}\n\n${html.slice(marker.index)}`;
  }

  return html.replace('</head>', `${snippets.join('\n\n')}\n</head>`);
}

function processFile(file) {
  const fullPath = path.join(ROOT, file);
  let html = fs.readFileSync(fullPath, 'utf8');
  const original = html;

  if (!hasBlogPosting(html)) return false;

  const canonical = extractCanonical(html, file);
  const title = extractTitle(html);
  const firstParagraph = extractFirstParagraph(html);
  const section = extractSection(html);

  html = ensureArticleSectionMeta(html, section);

  const blocks = parseJsonLdBlocks(html);
  const hasFaq = blocks.some((b) => containsType(b.parsed, 'FAQPage'));
  const hasSpeakable = blocks.some((b) => containsType(b.parsed, 'SpeakableSpecification'));

  const snippetsToAdd = [];
  if (!hasFaq) {
    snippetsToAdd.push(makeFaqScript({ title, firstParagraph }));
  }
  if (!hasSpeakable) {
    snippetsToAdd.push(makeSpeakableScript({ canonical, title }));
  }
  html = injectSchema(html, snippetsToAdd);

  if (html !== original) {
    fs.writeFileSync(fullPath, html, 'utf8');
    return true;
  }
  return false;
}

let updated = 0;
for (const file of listHtmlFiles()) {
  if (processFile(file)) updated += 1;
}

console.log(`Sprint 2 apply complete. Updated files: ${updated}`);
