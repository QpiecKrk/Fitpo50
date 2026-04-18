#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SITE_HOST = 'fitpo50.pl';

function listHtmlFiles() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
}

function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function findArticleContent(html) {
  const m = html.match(/<article class="article-content"[\s\S]*?<\/article>/i);
  return m ? m[0] : null;
}

function extractFirstSentence(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const sentenceMatch = normalized.match(/(.+?[.!?])(\s|$)/);
  if (sentenceMatch) return sentenceMatch[1].trim();
  return normalized.slice(0, 180).trim();
}

function extractHeadings(articleHtml) {
  const headings = [];
  const regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = regex.exec(articleHtml))) {
    const heading = cleanText(match[1]);
    if (heading) headings.push(heading);
    if (headings.length >= 3) break;
  }
  return headings;
}

function buildTakeawaysBlock(articleHtml) {
  const firstPMatch = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const firstParagraph = firstPMatch ? cleanText(firstPMatch[1]) : '';
  const firstSentence = firstParagraph
    ? extractFirstSentence(firstParagraph)
    : 'Regularność i małe kroki dają lepsze efekty niż chwilowe zrywy.';
  const headings = extractHeadings(articleHtml);

  const bullets = [];
  bullets.push(`Najważniejsze: ${firstSentence}`);
  if (headings[0]) bullets.push(`W artykule znajdziesz konkrety o: ${headings[0]}.`);
  if (headings[1]) bullets.push(`Drugi kluczowy temat: ${headings[1]}.`);
  if (bullets.length < 3) {
    bullets.push('Na końcu znajdziesz praktyczny krok do wdrożenia od razu.');
  }

  return `
      <section class="key-takeaways reveal" data-ai-summary="auto" aria-label="Kluczowe wnioski">
        <h2>Kluczowe wnioski</h2>
        <ul>
          ${bullets.slice(0, 3).map((b) => `<li>${b}</li>`).join('\n          ')}
        </ul>
      </section>
`;
}

function addTakeawaysIfMissing(html) {
  if (/class="key-takeaways/i.test(html) || /data-ai-summary="auto"/i.test(html)) return html;

  const articleMatch = html.match(/<article class="article-content"[\s\S]*?<\/article>/i);
  if (!articleMatch) return html;

  const articleHtml = articleMatch[0];
  const block = buildTakeawaysBlock(articleHtml);
  const withBlock = articleHtml.replace(/(<p[^>]*>[\s\S]*?<\/p>)/i, `$1\n${block}`);
  return html.replace(articleHtml, withBlock);
}

function collectExternalLinks(html) {
  const articleHtml = findArticleContent(html) ?? html;
  const links = [];
  const regex = /href="(https?:\/\/[^"]+)"/gi;
  let match;
  while ((match = regex.exec(articleHtml))) {
    const url = match[1];
    try {
      const parsed = new URL(url);
      if (parsed.hostname === SITE_HOST || parsed.hostname.endsWith(`.${SITE_HOST}`)) continue;
      links.push(url);
    } catch {
      // ignore malformed links
    }
  }
  return Array.from(new Set(links)).slice(0, 10);
}

function schemaObjectsFromParsed(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x === 'object');
  if (parsed && typeof parsed === 'object') return [parsed];
  return [];
}

function enrichBlogPostingSchema(parsed, html) {
  const objects = schemaObjectsFromParsed(parsed);
  let changed = false;

  for (const obj of objects) {
    if (obj['@type'] !== 'BlogPosting') continue;

    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords
      : typeof obj.keywords === 'string'
        ? obj.keywords.split(',').map((x) => x.trim()).filter(Boolean)
        : [];

    const entities = keywords.slice(0, 6).map((name) => ({ '@type': 'Thing', name }));
    if (!obj.about || (Array.isArray(obj.about) && obj.about.length === 0)) {
      obj.about = entities.slice(0, 4);
      changed = true;
    }
    if (!obj.mentions || (Array.isArray(obj.mentions) && obj.mentions.length === 0)) {
      obj.mentions = entities.slice(2, 6);
      changed = true;
    }

    const externalLinks = collectExternalLinks(html);
    if (!obj.citation && externalLinks.length > 0) {
      obj.citation = externalLinks;
      changed = true;
    }
  }

  return { parsed, changed };
}

function updateJsonLd(html) {
  return html.replace(
    /<script type="application\/ld\+json"([^>]*)>([\s\S]*?)<\/script>/g,
    (full, attrs, jsonContent) => {
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch {
        return full;
      }

      const { changed, parsed: next } = enrichBlogPostingSchema(parsed, html);
      if (!changed) return full;

      return `<script type="application/ld+json"${attrs}>\n${JSON.stringify(next, null, 2)}\n</script>`;
    }
  );
}

let updated = 0;
for (const file of listHtmlFiles()) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');
  if (!/"@type":\s*"BlogPosting"/.test(html)) continue;

  let next = html;
  next = addTakeawaysIfMissing(next);
  next = updateJsonLd(next);

  if (next !== html) {
    fs.writeFileSync(filePath, next, 'utf8');
    updated += 1;
  }
}

console.log(`Sprint 3 apply complete. Updated files: ${updated}`);
