#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const MAX_AGE_DAYS = 120;
const MIN_FAQ = 4;

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .filter((f) => /<article\s+class="article-content">/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
}

function extractDateModified(html) {
  const meta = html.match(/<meta\s+property="article:modified_time"\s+content="([^"]+)"/i);
  if (meta) return String(meta[1] || '').trim();
  const json = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of json) {
    try {
      const parsed = JSON.parse(String(m[1] || '').trim());
      const obj = Array.isArray(parsed) ? parsed.find((x) => x && (x['@type'] === 'BlogPosting' || (Array.isArray(x['@type']) && x['@type'].includes('BlogPosting')))) : parsed;
      if (obj && obj.dateModified) return String(obj.dateModified).trim();
    } catch (_e) {
      // noop
    }
  }
  return '';
}

function ageDays(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function main() {
  const files = listArticleFiles();
  const stale = [];
  const lowFaq = [];

  for (const file of files) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const faqCount = (html.match(/<article\s+class="faq-item"/gi) || []).length;
    if (faqCount < MIN_FAQ) {
      lowFaq.push({ file, faqCount });
    }
    const dm = extractDateModified(html);
    const days = dm ? ageDays(dm) : null;
    if (days === null || days > MAX_AGE_DAYS) {
      stale.push({ file, dateModified: dm || '(brak)', ageDays: days });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    maxAgeDays: MAX_AGE_DAYS,
    minFaq: MIN_FAQ,
    totals: {
      articles: files.length,
      staleFaqCandidates: stale.length,
      lowFaqCount: lowFaq.length,
    },
    stale,
    lowFaq,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = path.join(REPORT_DIR, 'faq-refresh-report.json');
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[PASS] faq-refresh-report generated: ${out}`);
  console.log(`- artykuly: ${files.length}`);
  console.log(`- stale FAQ candidates: ${stale.length}`);
  console.log(`- low FAQ count: ${lowFaq.length}`);
}

main();

