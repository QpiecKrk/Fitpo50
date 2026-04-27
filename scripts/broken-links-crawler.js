#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const targetDir = path.resolve(ROOT, process.argv[2] || '_site');
const errors = [];
const warnings = [];

function listHtmlFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      listHtmlFiles(abs, out);
      continue;
    }
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

function existsRef(rel) {
  const abs = path.join(targetDir, rel);
  return fs.existsSync(abs);
}

function checkSitemapTargets() {
  const sitemapPath = path.join(targetDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    warnings.push('Brak sitemap.xml w katalogu eksportu.');
    return;
  }
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const urls = [...xml.matchAll(/<loc>https:\/\/fitpo50\.pl\/([^<]+)<\/loc>/gi)].map((m) => String(m[1] || '').trim());
  for (const rel of urls) {
    if (!rel) continue;
    if (!existsRef(rel)) {
      errors.push(`sitemap.xml wskazuje nieistniejący plik w eksporcie: ${rel}`);
    }
  }
}

function main() {
  if (!fs.existsSync(targetDir)) {
    console.error(`[FAIL] broken-links-crawler -> brak katalogu: ${targetDir}`);
    process.exit(1);
  }

  const htmlFiles = listHtmlFiles(targetDir);
  if (!htmlFiles.length) {
    console.log('[PASS] broken-links-crawler - brak plików HTML do analizy.');
    return;
  }

  for (const absHtml of htmlFiles) {
    const html = fs.readFileSync(absHtml, 'utf8');
    const from = relFromTarget(absHtml);
    const refs = collectRefs(html);
    for (const raw of refs) {
      if (/[{}`$]/.test(raw)) continue;
      const normalized = normalizeRef(from, raw);
      if (!normalized) continue;
      if (normalized.startsWith('admin/')) continue;
      if (!existsRef(normalized)) {
        errors.push(`${from} -> ${raw} (brak: ${normalized})`);
      }
    }
  }

  checkSitemapTargets();

  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL] broken-links-crawler');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }

  console.log(`[PASS] broken-links-crawler OK (HTML: ${htmlFiles.length}, dir: ${targetDir}).`);
}

main();
