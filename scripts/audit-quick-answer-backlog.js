#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { validators, utils } = require('./lib/article-policy');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const JSON_OUT = path.join(REPORT_DIR, 'quick-answer-backlog.json');
const MD_OUT = path.join(REPORT_DIR, 'quick-answer-backlog.md');
const GENERIC_QUICK_ANSWER_PATTERNS = [
  /Po 50-tce w temacie/i,
  /najlepiej działa plan oparty na danych/i,
  /najpierw sprawdź punkt wyjścia/i,
  /wdrażaj zmiany krokami przez 4-8 tygodni/i,
  /zmniejsz obciążenie i\s*$/i,
];

function listArticleFiles() {
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith('.html'))
    .filter((name) => name !== 'article-template-bento.html')
    .filter((name) => {
      const raw = fs.readFileSync(path.join(ROOT, name), 'utf8');
      return /<body[^>]*class="[^"]*article-template[^"]*"/i.test(raw);
    });
}

function readTopPriorityUrls() {
  const reportPath = path.join(ROOT, 'data', 'reports', 'gsc-weekly-report.json');
  if (!fs.existsSync(reportPath)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const urls = [];
    const opp = parsed?.opportunities || {};
    const pools = ['ctr_problems', 'top3_zero_click', 'cannibalization'];
    for (const key of pools) {
      const arr = Array.isArray(opp[key]) ? opp[key] : [];
      for (const item of arr) {
        const url = String(item?.url || item?.page || '').trim();
        if (url) urls.push(url);
      }
    }
    return new Set(urls.slice(0, 12));
  } catch (_err) {
    return new Set();
  }
}

function categoryFromRaw(raw) {
  const match = raw.match(/<body[^>]*class="[^"]*article--(ruch|jedzenie|zdrowie|ciekawe)[^"]*"/i);
  return match ? String(match[1]).toLowerCase() : 'unknown';
}

function waveForItem(url, category, topUrls) {
  if (topUrls.has(url)) return 1;
  if (category === 'zdrowie' || category === 'jedzenie') return 2;
  return 3;
}

function findGenericQuickAnswerIssue(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const pattern = GENERIC_QUICK_ANSWER_PATTERNS.find((rx) => rx.test(normalized));
  return pattern ? 'generyczny quick answer z szablonu' : '';
}

function main() {
  const topUrls = readTopPriorityUrls();
  const files = listArticleFiles();
  const items = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const qaHtml = raw.match(/<section\s+class="quick-answer[^"]*"[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
    const qaText = utils.stripTags(qaHtml).replace(/\s+/g, ' ').trim();
    const category = categoryFromRaw(raw);
    const url = `https://fitpo50.pl/${file}`;
    const validation = validators.validateQuickAnswer(qaText, { mode: 'strict' });
    const hasBannedPhrase = validators.containsBannedPhrase(qaText).found;
    const genericIssue = findGenericQuickAnswerIssue(qaText);
    const hasNumberOrCondition = validators.hasNumberOrCondition(qaText);
    const wave = waveForItem(url, category, topUrls);
    const errors = [...validation.errors];
    if (genericIssue) errors.push(genericIssue);
    const status = errors.length ? 'DO_NAPRAWY' : 'NAPRAWIONO';

    items.push({
      file,
      url,
      category,
      quick_answer_words: validation.words,
      has_banned_phrase: hasBannedPhrase,
      has_generic_template: Boolean(genericIssue),
      has_number_or_condition: hasNumberOrCondition,
      wave,
      status,
      errors,
    });
  }

  const backlog = items
    .filter((item) => item.status === 'DO_NAPRAWY')
    .sort((a, b) => a.wave - b.wave || a.url.localeCompare(b.url));

  const report = {
    generated_at: new Date().toISOString(),
    total_articles: items.length,
    fail_count: backlog.length,
    fixed_count: items.length - backlog.length,
    items: backlog,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# Quick Answer Backlog');
  lines.push('');
  lines.push(`- generated_at: ${report.generated_at}`);
  lines.push(`- total_articles: ${report.total_articles}`);
  lines.push(`- fail_count: ${report.fail_count}`);
  lines.push(`- fixed_count: ${report.fixed_count}`);
  lines.push('');
  lines.push('| URL | Kategoria | Słowa | Banned phrase | Generyczny szablon | Liczba/warunek | Fala | Status |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---|');
  for (const item of backlog) {
    lines.push(`| ${item.url} | ${item.category} | ${item.quick_answer_words} | ${item.has_banned_phrase ? 'tak' : 'nie'} | ${item.has_generic_template ? 'tak' : 'nie'} | ${item.has_number_or_condition ? 'tak' : 'nie'} | ${item.wave} | ${item.status} |`);
  }
  fs.writeFileSync(MD_OUT, `${lines.join('\n')}\n`, 'utf8');

  console.log(`[PASS] quick-answer-backlog: fail=${report.fail_count}, fixed=${report.fixed_count}`);
  console.log(`- JSON: ${path.relative(ROOT, JSON_OUT)}`);
  console.log(`- MD:   ${path.relative(ROOT, MD_OUT)}`);
}

main();
