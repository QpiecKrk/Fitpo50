#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const targetDir = path.resolve(ROOT, process.argv[2] || '_site');
const reportDir = path.join(ROOT, 'data', 'reports');
const reportJsonPath = path.join(reportDir, 'seo-crawl-report.json');
const reportMdPath = path.join(reportDir, 'seo-crawl-report.md');

const CRITICAL_PAGES = new Set(['index.html', 'porady.html', 'rusz-sie.html', 'jedzenie.html', 'zdrowie.html', 'ciekawe.html']);
const ORPHAN_ALLOWLIST = new Set(['404.html', 'search.html']);
const DUPLICATES_HARD_FAIL = String(process.env.SEO_DUPLICATES_HARD_FAIL || '').trim().toLowerCase() === 'true';

function listHtmlFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) listHtmlFiles(abs, out);
    if (e.isFile() && e.name.endsWith('.html')) out.push(abs);
  }
  return out;
}

function relFromTarget(absPath) {
  return path.relative(targetDir, absPath).replace(/\\/g, '/');
}

function normalizeRef(baseFile, raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(value)) return '';
  const clean = value.split('#')[0].split('?')[0].trim();
  if (!clean) return '';
  if (clean.startsWith('/')) return clean.replace(/^\/+/, '');
  const baseDir = path.dirname(baseFile);
  return path.normalize(path.join(baseDir, clean)).replace(/\\/g, '/');
}

function collectRefs(html) {
  const safeHtml = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const refs = [];
  const attrRx = /\b(?:href|src)\s*=\s*"([^"]+)"/gi;
  for (const m of safeHtml.matchAll(attrRx)) refs.push(String(m[1] || '').trim());
  const srcsetRx = /\bsrcset\s*=\s*"([^"]+)"/gi;
  for (const m of safeHtml.matchAll(srcsetRx)) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    for (const part of raw.split(',')) {
      const item = part.trim().split(/\s+/)[0];
      if (item) refs.push(item);
    }
  }
  return refs;
}

function extractCanonical(html) {
  const m = String(html).match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  return m ? String(m[1]).trim() : '';
}

function extractRobots(html) {
  const m = String(html).match(/<meta\s+name="robots"\s+content="([^"]+)"/i);
  return m ? String(m[1]).trim().toLowerCase() : '';
}

function extractTitle(html) {
  const m = String(html).match(/<title>([\s\S]*?)<\/title>/i);
  return m ? String(m[1]).replace(/\s+/g, ' ').trim() : '';
}

function extractDescription(html) {
  const m = String(html).match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? String(m[1]).replace(/\s+/g, ' ').trim() : '';
}

function parseSitemapPaths() {
  const sitemapPath = path.join(targetDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return [];
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  return [...xml.matchAll(/<loc>https:\/\/fitpo50\.pl\/([^<]+)<\/loc>/gi)].map((m) => String(m[1] || '').trim()).filter(Boolean);
}

function writeReports(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const lines = [];
  lines.push('# SEO Crawl Report');
  lines.push('');
  lines.push(`- HTML files: **${report.summary.html_files}**`);
  lines.push(`- Broken links: **${report.summary.broken_links}**`);
  lines.push(`- Canonical errors: **${report.summary.canonical_errors}**`);
  lines.push(`- Robots noindex critical: **${report.summary.noindex_critical}**`);
  lines.push(`- Duplicate titles: **${report.summary.duplicate_titles}**`);
  lines.push(`- Duplicate descriptions: **${report.summary.duplicate_descriptions}**`);
  lines.push(`- Orphan pages: **${report.summary.orphan_pages}**`);
  lines.push('');
  if (report.critical.length) {
    lines.push('## Critical');
    report.critical.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }
  if (report.warnings.length) {
    lines.push('## Warnings');
    report.warnings.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }
  fs.writeFileSync(reportMdPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(targetDir)) {
    console.error(`[FAIL] seo-crawl -> brak katalogu: ${targetDir}`);
    process.exit(1);
  }

  const htmlFilesAbs = listHtmlFiles(targetDir);
  const htmlFiles = htmlFilesAbs.map(relFromTarget);
  const htmlSet = new Set(htmlFiles);
  const incoming = new Map(htmlFiles.map((f) => [f, 0]));
  const titleMap = new Map();
  const descMap = new Map();

  const critical = [];
  const warnings = [];
  const broken = [];
  const canonicalErrors = [];
  const noindexCritical = [];

  for (const relFile of htmlFiles) {
    const abs = path.join(targetDir, relFile);
    const html = fs.readFileSync(abs, 'utf8');
    const refs = collectRefs(html);

    for (const raw of refs) {
      if (/[{}`$]/.test(raw)) continue;
      const normalized = normalizeRef(relFile, raw);
      if (!normalized) continue;
      if (normalized.startsWith('admin/')) continue;
      const targetAbs = path.join(targetDir, normalized);
      if (!fs.existsSync(targetAbs)) {
        broken.push(`${relFile} -> ${raw} (brak: ${normalized})`);
        continue;
      }
      if (htmlSet.has(normalized)) incoming.set(normalized, (incoming.get(normalized) || 0) + 1);
    }

    const canonical = extractCanonical(html);
    const isGoogleVerification = /^google[a-z0-9]+\.html$/i.test(relFile);
    if (!canonical) {
      if (!isGoogleVerification) {
        canonicalErrors.push(`${relFile}: brak canonical`);
      }
    } else {
      const isRedirect = /http-equiv="refresh"/i.test(html);
      if (isRedirect) {
        // Redirect pages can point to their target canonical
      } else if (relFile === 'index.html') {
        if (canonical !== 'https://fitpo50.pl/' && canonical !== 'https://fitpo50.pl/index.html') {
          canonicalErrors.push(`${relFile}: canonical=${canonical} (expected https://fitpo50.pl/ or https://fitpo50.pl/index.html)`);
        }
      } else {
        const expected = `https://fitpo50.pl/${relFile}`;
        if (canonical !== expected) canonicalErrors.push(`${relFile}: canonical=${canonical} (expected ${expected})`);
      }
    }

    const robots = extractRobots(html);
    if (CRITICAL_PAGES.has(relFile) && /\bnoindex\b/i.test(robots)) {
      noindexCritical.push(`${relFile}: robots=${robots}`);
    }

    const title = extractTitle(html);
    if (title) {
      const arr = titleMap.get(title) || [];
      arr.push(relFile);
      titleMap.set(title, arr);
    }
    const desc = extractDescription(html);
    if (desc) {
      const arr = descMap.get(desc) || [];
      arr.push(relFile);
      descMap.set(desc, arr);
    }
  }

  const sitemapPaths = parseSitemapPaths();
  for (const rel of sitemapPaths) {
    if (!fs.existsSync(path.join(targetDir, rel))) {
      critical.push(`sitemap.xml wskazuje nieistniejący plik: ${rel}`);
    }
  }

  const dupTitles = [...titleMap.entries()].filter(([, files]) => files.length > 1);
  const dupDescs = [...descMap.entries()].filter(([, files]) => files.length > 1);
  dupTitles.forEach(([title, files]) => warnings.push(`duplicate <title>: "${title}" -> ${files.join(', ')}`));
  dupDescs.forEach(([desc, files]) => warnings.push(`duplicate meta description: "${desc}" -> ${files.join(', ')}`));

  const orphans = htmlFiles.filter((f) => !ORPHAN_ALLOWLIST.has(f) && f !== 'index.html' && (incoming.get(f) || 0) === 0);
  orphans.forEach((o) => warnings.push(`orphan page: ${o}`));

  if (broken.length) critical.push(...broken);
  if (canonicalErrors.length) critical.push(...canonicalErrors);
  if (noindexCritical.length) critical.push(...noindexCritical);
  if (DUPLICATES_HARD_FAIL && (dupTitles.length || dupDescs.length)) {
    critical.push(`duplicate title/description hard fail enabled: titles=${dupTitles.length}, descriptions=${dupDescs.length}`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    target_dir: targetDir,
    summary: {
      html_files: htmlFiles.length,
      broken_links: broken.length,
      canonical_errors: canonicalErrors.length,
      noindex_critical: noindexCritical.length,
      duplicate_titles: dupTitles.length,
      duplicate_descriptions: dupDescs.length,
      orphan_pages: orphans.length,
    },
    critical,
    warnings,
  };

  writeReports(report);

  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (critical.length) {
    console.log('\n[FAIL] seo-crawl');
    critical.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }
  console.log(`[PASS] seo-crawl OK (HTML: ${htmlFiles.length}, dir: ${targetDir}).`);
}

main();
