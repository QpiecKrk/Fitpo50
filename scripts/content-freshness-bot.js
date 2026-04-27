#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data', 'reports');

const FRESH_DAYS = 45;
const WARNING_DAYS = 120;
const STALE_DAYS = 180;

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .filter((f) => /<article\s+class="article-content">/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function extractDateModified(html) {
  const m = html.match(/<meta\s+property="article:modified_time"\s+content="([^"]+)"/i);
  if (m) return String(m[1] || '').trim();
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(String(block[1] || '').trim());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of arr) {
        if (!obj || typeof obj !== 'object') continue;
        const type = obj['@type'];
        const isBlog = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
        if (isBlog && obj.dateModified) return String(obj.dateModified).trim();
      }
    } catch (_e) {
      // ignore
    }
  }
  return '';
}

function ageDays(iso) {
  const t = Date.parse(String(iso || '').trim());
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function countInternalLinksInArticle(html) {
  const article = html.match(/<article\s+class="article-content">([\s\S]*?)<\/article>/i);
  if (!article) return 0;
  const rx = /<a\b[^>]*href="([^"]+)"/gi;
  const unique = new Set();
  for (const m of article[1].matchAll(rx)) {
    const href = String(m[1] || '').trim();
    if (!href) continue;
    if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
    if (!/\.html(?:[?#].*)?$/i.test(href)) continue;
    if (/^\.?\/?porady\.html(?:[?#].*)?$/i.test(href)) continue;
    unique.add(href.replace(/^\.\//, ''));
  }
  return unique.size;
}

function countSources(html) {
  const srcSection = html.match(/<h2[^>]*id="zrodla"[\s\S]*?<\/section>/i);
  if (!srcSection) return 0;
  const links = srcSection[0].match(/<a\b[^>]*href="https?:\/\/[^"]+"/gi) || [];
  return links.length;
}

function classifyFreshness(days) {
  if (days === null) return 'unknown';
  if (days <= FRESH_DAYS) return 'fresh';
  if (days <= WARNING_DAYS) return 'watch';
  if (days <= STALE_DAYS) return 'stale';
  return 'critical';
}

function priorityScore({ ageClass, faqCount, sourceCount, linkCount, words }) {
  let score = 0;
  if (ageClass === 'watch') score += 15;
  if (ageClass === 'stale') score += 40;
  if (ageClass === 'critical') score += 60;
  if (ageClass === 'unknown') score += 80;

  if (faqCount < 4) score += 20;
  if (sourceCount < 6) score += 25;
  if (linkCount < 4) score += 15;
  if (words < 450) score += 10;
  return score;
}

function buildItem(file, html) {
  const dateModified = extractDateModified(html);
  const days = ageDays(dateModified);
  const ageClass = classifyFreshness(days);
  const faqCount = (html.match(/<article\s+class="faq-item"/gi) || []).length;
  const sourceCount = countSources(html);
  const linkCount = countInternalLinksInArticle(html);
  const words = countWords(stripTags(html));
  const score = priorityScore({ ageClass, faqCount, sourceCount, linkCount, words });

  return {
    file,
    dateModified: dateModified || '(brak)',
    ageDays: days,
    freshness: ageClass,
    signals: {
      faqCount,
      sourceCount,
      internalLinks: linkCount,
      wordCount: words,
    },
    priorityScore: score,
    action:
      score >= 80 ? 'pilna aktualizacja (SEO/AEO/GEO)' :
      score >= 50 ? 'aktualizacja w tym tygodniu' :
      score >= 25 ? 'monitoring i lekki refresh' :
      'OK',
  };
}

function main() {
  const files = listArticleFiles();
  const items = files
    .map((file) => {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return buildItem(file, html);
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const report = {
    generatedAt: new Date().toISOString(),
    policy: {
      priority: 'SEO -> AEO -> GEO -> AIO',
      thresholds: {
        freshDays: FRESH_DAYS,
        warningDays: WARNING_DAYS,
        staleDays: STALE_DAYS,
      },
    },
    totals: {
      articles: items.length,
      critical: items.filter((i) => i.freshness === 'critical').length,
      stale: items.filter((i) => i.freshness === 'stale').length,
      watch: items.filter((i) => i.freshness === 'watch').length,
      unknown: items.filter((i) => i.freshness === 'unknown').length,
      needsRefreshNow: items.filter((i) => i.priorityScore >= 80).length,
    },
    topPriority: items.slice(0, 20),
    all: items,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const outPath = path.join(REPORT_DIR, 'content-freshness-report.json');
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[PASS] content-freshness-bot generated: ${outPath}`);
  console.log(`- artykuly: ${report.totals.articles}`);
  console.log(`- critical: ${report.totals.critical}`);
  console.log(`- stale: ${report.totals.stale}`);
  console.log(`- needsRefreshNow: ${report.totals.needsRefreshNow}`);
}

main();

