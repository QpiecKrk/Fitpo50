#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (!n || n.startsWith('--')) out[k] = 'true';
    else { out[k] = n; i += 1; }
  }
  return out;
}

function findHtmlFiles(root) {
  const out = [];
  const skipDirs = new Set(['.git', 'node_modules', 'admin', '_site', 'temp-clone']);
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        walk(p);
      } else if (e.isFile() && e.name.endsWith('.html')) {
        out.push(p);
      }
    }
  }
  walk(root);
  return out;
}

function extractLinks(html) {
  const links = [];
  const rx = /<a\b[^>]*href="([^"]+)"/gi;
  for (const m of html.matchAll(rx)) {
    const href = String(m[1] || '').trim();
    if (!href || /^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
    const clean = href.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
    if (!clean.endsWith('.html')) continue;
    links.push(clean);
  }
  return links;
}

function tokenize(slug) {
  return String(slug || '')
    .toLowerCase()
    .replace(/\.html$/i, '')
    .split(/[^a-z0-9]+/)
    .filter((x) => x && x.length > 2 && !['html', 'fitpo50', 'po', 'dla'].includes(x));
}

function scoreSimilarity(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  let overlap = 0;
  for (const x of A) if (B.has(x)) overlap += 1;
  return overlap;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const minInbound = Number(args['min-inbound'] || 2);
  const reportDir = path.join(root, 'data', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const files = findHtmlFiles(root);
  const pages = new Map();
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    const html = fs.readFileSync(abs, 'utf8');
    pages.set(rel, { rel, links: extractLinks(html) });
  }

  const inbound = new Map();
  for (const rel of pages.keys()) inbound.set(rel, 0);
  for (const page of pages.values()) {
    for (const l of page.links) {
      if (inbound.has(l)) inbound.set(l, (inbound.get(l) || 0) + 1);
    }
  }

  const ignore = new Set(['index.html', 'porady.html', 'rusz-sie.html', 'jedzenie.html', 'zdrowie.html', 'ciekawe.html']);
  const weak = [...pages.keys()]
    .filter((rel) => !ignore.has(rel))
    .filter((rel) => (inbound.get(rel) || 0) < minInbound)
    .sort((a, b) => (inbound.get(a) || 0) - (inbound.get(b) || 0));

  const suggestions = [];
  for (const target of weak) {
    const candidates = [...pages.keys()]
      .filter((src) => src !== target)
      .filter((src) => !pages.get(src).links.includes(target))
      .map((src) => ({ src, score: scoreSimilarity(src, target), inboundSrc: inbound.get(src) || 0 }))
      .sort((a, b) => b.score - a.score || b.inboundSrc - a.inboundSrc)
      .slice(0, 5);
    suggestions.push({
      target,
      inbound: inbound.get(target) || 0,
      suggested_sources: candidates.filter((c) => c.score > 0),
    });
  }

  const payload = {
    generated_at: new Date().toISOString(),
    pages_total: pages.size,
    min_inbound: minInbound,
    weak_pages: suggestions,
  };

  const jsonPath = path.join(reportDir, 'link-topology-report.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# Link Topology Report');
  lines.push('');
  lines.push(`- generated_at: ${payload.generated_at}`);
  lines.push(`- pages_total: ${payload.pages_total}`);
  lines.push(`- min_inbound: ${payload.min_inbound}`);
  lines.push('');
  if (!suggestions.length) {
    lines.push('Brak stron poniżej progu inbound linków.');
  } else {
    for (const s of suggestions) {
      lines.push(`## ${s.target} (inbound: ${s.inbound})`);
      if (!s.suggested_sources.length) {
        lines.push('- Brak mocnych kandydatów semantycznych.');
      } else {
        s.suggested_sources.forEach((x) => lines.push(`- ${x.src} (score=${x.score}, inbound_src=${x.inboundSrc})`));
      }
      lines.push('');
    }
  }
  const mdPath = path.join(reportDir, 'link-topology-report.md');
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`[LINK-TOPOLOGY] pages=${pages.size} weak=${suggestions.length}`);
  console.log(`[LINK-TOPOLOGY] report: ${path.relative(root, jsonPath)}`);
  console.log(`[LINK-TOPOLOGY] report: ${path.relative(root, mdPath)}`);
}

main();
