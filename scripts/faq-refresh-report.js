#!/usr/bin/env node

const fs = require('fs');
const { atomicWriteFileSync } = require('./lib/atomic-file');
const path = require('path');
const { warsawIso } = require('./lib/time');
const { POLICY } = require('./lib/article-policy');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const MAX_AGE_DAYS = 120;

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => f !== 'article-template-bento.html')
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

function buildFaqRefreshReport(entries) {
  const stale = [];

  for (const entry of entries) {
    if (entry.faqCount > POLICY.FAQ.MINIMUM && (entry.ageDays === null || entry.ageDays > MAX_AGE_DAYS)) {
      stale.push({ file: entry.file, dateModified: entry.dateModified || '(brak)', ageDays: entry.ageDays });
    }
  }

  return {
    generatedAt: warsawIso(),
    maxAgeDays: MAX_AGE_DAYS,
    faqMinimum: POLICY.FAQ.MINIMUM,
    totals: {
      articles: entries.length,
      staleFaqCandidates: stale.length,
    },
    stale,
  };
}

function main() {
  const files = listArticleFiles();
  const entries = files.map((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const dateModified = extractDateModified(html);
    return {
      file,
      faqCount: (html.match(/<article\s+class="faq-item"/gi) || []).length,
      dateModified,
      ageDays: dateModified ? ageDays(dateModified) : null,
    };
  });
  const report = buildFaqRefreshReport(entries);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const out = path.join(REPORT_DIR, 'faq-refresh-report.json');
  atomicWriteFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[PASS] faq-refresh-report generated: ${out}`);
  console.log(`- artykuly: ${files.length}`);
  console.log(`- stale FAQ candidates: ${report.totals.staleFaqCandidates}`);
}

if (require.main === module) main();

module.exports = {
  buildFaqRefreshReport,
};
