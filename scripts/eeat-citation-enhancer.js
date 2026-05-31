#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = 'true';
    else { out[key] = next; i += 1; }
  }
  return out;
}

function boolOpt(v, fallback) {
  if (v === undefined) return fallback;
  const x = String(v).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(x)) return true;
  if (['0', 'false', 'no', 'off'].includes(x)) return false;
  return fallback;
}

function isGenericLabel(label) {
  const s = String(label || '').trim();
  if (!s) return true;
  if (/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return true;
  return s.length < 14;
}

function extractPubmedId(url) {
  const m = String(url || '').match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?/i);
  return m ? m[1] : '';
}

function extractDoi(url) {
  const raw = String(url || '');
  const doiInUrl = raw.match(/doi\.org\/(10\.[^\s/?#]+\/[^^\s?#]+)/i);
  if (doiInUrl) return decodeURIComponent(doiInUrl[1]);
  const doiQuery = raw.match(/doi=([^&#]+)/i);
  return doiQuery ? decodeURIComponent(doiQuery[1]) : '';
}

function formatAuthors(authors) {
  if (!Array.isArray(authors) || !authors.length) return 'Autorzy badania';
  const first = authors[0] || {};
  const family = String(first.family || first.name || '').trim();
  if (!family) return 'Autorzy badania';
  if (authors.length === 1) return family;
  return `${family} et al.`;
}

async function fetchPubmedLabel(id) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${encodeURIComponent(id)}&retmode=json`;
  const res = await fetch(url, { headers: { 'user-agent': 'fitpo50-citation-enhancer/1.0' } });
  if (!res.ok) throw new Error(`PubMed HTTP ${res.status}`);
  const data = await res.json();
  const item = data?.result?.[id];
  if (!item) throw new Error('PubMed empty result');
  const author = formatAuthors(item.authors || []);
  const year = String(item.pubdate || '').match(/\b(19|20)\d{2}\b/)?.[0] || 'n.d.';
  const title = String(item.title || '').replace(/\.$/, '').trim() || 'Untitled study';
  const journal = String(item.fulljournalname || item.source || '').trim();
  return `${author} (${year}). ${title}.${journal ? ` ${journal}.` : ''}`.replace(/\s+/g, ' ').trim();
}

async function fetchCrossrefLabel(doi) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'fitpo50-citation-enhancer/1.0 (mailto:contact@fitpo50.pl)' } });
  if (!res.ok) throw new Error(`Crossref HTTP ${res.status}`);
  const data = await res.json();
  const msg = data?.message;
  if (!msg) throw new Error('Crossref empty result');
  const author = formatAuthors(msg.author || []);
  const year = msg?.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
  const title = Array.isArray(msg.title) ? String(msg.title[0] || '') : String(msg.title || '');
  const journal = Array.isArray(msg['container-title']) ? String(msg['container-title'][0] || '') : String(msg['container-title'] || '');
  return `${author} (${year}). ${title.replace(/\.$/, '')}.${journal ? ` ${journal}.` : ''}`.replace(/\s+/g, ' ').trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file ? path.resolve(process.cwd(), args.file) : '';
  const write = boolOpt(args.write, false);
  const strict = boolOpt(args.strict, false);

  if (!file) {
    console.error('Usage: node scripts/eeat-citation-enhancer.js --file <path.fitpo50.json> [--write true] [--strict false]');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`[FAIL] Missing file: ${file}`);
    process.exit(1);
  }

  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const src = Array.isArray(json.sources) ? json.sources : [];
  let updated = 0;
  let checked = 0;
  const warnings = [];

  for (const item of src) {
    if (!item || typeof item !== 'object') continue;
    const url = String(item.url || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    checked += 1;

    const currentLabel = String(item.label || item.citation || '').trim();
    if (!isGenericLabel(currentLabel)) continue;

    try {
      const pmid = extractPubmedId(url);
      const doi = extractDoi(url);
      let label = '';
      if (pmid) label = await fetchPubmedLabel(pmid);
      else if (doi) label = await fetchCrossrefLabel(doi);
      if (label) {
        item.label = label;
        updated += 1;
      }
    } catch (err) {
      warnings.push(`${url}: ${err.message || err}`);
    }
  }

  if (write) fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8');

  console.log(`[EEAT] checked=${checked} updated=${updated} write=${write ? 'true' : 'false'}`);
  if (warnings.length) {
    console.log('[EEAT][WARN] metadata fetch issues:');
    warnings.slice(0, 20).forEach((w) => console.log(`- ${w}`));
    if (strict) {
      console.error('[FAIL] strict=true and metadata fetch warnings were detected');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(`[FAIL] eeat-citation-enhancer -> ${err.message || err}`);
  process.exit(1);
});
