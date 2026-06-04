#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.cwd();
const DEFAULT_INPUT_DIR = process.env.GSC_WORK_DIR || path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
const DEFAULT_OUTPUT_DIR = DEFAULT_INPUT_DIR;
const SITE_ORIGIN = 'https://fitpo50.pl';

const CORE_PAGES = new Set([
  'index.html',
  'porady.html',
  'rusz-sie.html',
  'jedzenie.html',
  'zdrowie.html',
  'ciekawe.html',
  'dziennik.html',
  'o-mnie.html',
]);

const TECHNICAL_PAGES = new Set([
  'polityka-prywatnosci.html',
  'search.html',
  'article-template-bento.html',
  'google4a31b58b207723ed.html',
]);

const STOPWORDS = new Set([
  'html',
  'fitpo50',
  'oraz',
  'jest',
  'jak',
  'czy',
  'dla',
  'bez',
  'nie',
  'sie',
  'się',
  'po',
  'roku',
  'lat',
  'tce',
  'plus',
  'twoje',
  'twoim',
  'ktore',
  'które',
  'kiedy',
  'dlaczego',
  'przed',
  'przy',
  'jego',
  'jej',
  'ich',
  'nasze',
  'nasza',
  'temat',
  'praktyczny',
  'poradnik',
]);

function parseArgs(argv) {
  const out = {
    inputDir: DEFAULT_INPUT_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    baseUrl: SITE_ORIGIN,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (token === '--input-dir') {
      out.inputDir = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (token === '--output-dir') {
      out.outputDir = path.resolve(ROOT, String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (token === '--base-url') {
      out.baseUrl = String(argv[i + 1] || '').trim().replace(/\/+$/, '') || SITE_ORIGIN;
      i += 1;
    }
  }
  return out;
}

function normalizeKey(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNumber(input) {
  const raw = String(input || '').trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function parseCsv(text) {
  const source = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = source.split('\n')[0] || '';
  const delimiters = [',', ';', '\t'];
  let delimiter = ',';
  let bestScore = -1;
  for (const candidate of delimiters) {
    const score = firstLine.split(candidate).length;
    if (score > bestScore) {
      delimiter = candidate;
      bestScore = score;
    }
  }

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      cell += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const filtered = rows.filter((cells) => cells.some((value) => String(value || '').trim() !== ''));
  if (!filtered.length) return [];
  const headers = filtered[0].map((header) => String(header || '').trim());
  return filtered.slice(1).map((cells) => {
    const out = {};
    headers.forEach((header, index) => {
      out[header] = String(cells[index] || '').trim();
    });
    return out;
  });
}

function readCsvIfExists(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

function mapGscRow(raw) {
  const out = {
    query: '',
    page: '',
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };
  for (const [key, value] of Object.entries(raw || {})) {
    const normalized = normalizeKey(key);
    if (!out.query && /(^| )query( |$)|(^| )zapytan/.test(normalized)) out.query = String(value || '').trim();
    if (!out.page && /(^| )page( |$)|(^| )stron/.test(normalized)) out.page = String(value || '').trim();
    if (/(^| )clicks( |$)|(^| )klikniec/.test(normalized)) out.clicks = parseNumber(value);
    if (/(^| )impressions( |$)|(^| )wyswietlen/.test(normalized)) out.impressions = parseNumber(value);
    if (/(^| )ctr( |$)/.test(normalized)) out.ctr = parseNumber(value);
    if (/(^| )position( |$)|(^| )pozycj/.test(normalized)) out.position = parseNumber(value);
  }
  return out;
}

function readGsc(inputDir) {
  const pages = readCsvIfExists(path.join(inputDir, 'pages.csv')).map(mapGscRow);
  const queries = readCsvIfExists(path.join(inputDir, 'queries.csv')).map(mapGscRow);
  const queryPagesFile = fs.existsSync(path.join(inputDir, 'query-pages.csv'))
    ? path.join(inputDir, 'query-pages.csv')
    : path.join(inputDir, 'query_pages.csv');
  const queryPages = readCsvIfExists(queryPagesFile).map(mapGscRow);
  return {
    status: pages.length && queries.length && queryPages.length ? 'ok' : 'INSUFFICIENT_DATA',
    files: {
      pages: path.join(inputDir, 'pages.csv'),
      queries: path.join(inputDir, 'queries.csv'),
      query_pages: queryPagesFile,
    },
    pages,
    queries,
    queryPages,
  };
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function matchOne(html, regex) {
  const match = String(html || '').match(regex);
  return decodeEntities(match ? match[1] : '');
}

function tokenize(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ąćęłńóśźż]+/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractLinks(html) {
  const links = [];
  const regex = /<a\b[^>]*href="([^"]+)"/gi;
  for (const match of String(html || '').matchAll(regex)) {
    const href = String(match[1] || '').trim();
    if (!href || /^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
    const clean = href
      .split('#')[0]
      .split('?')[0]
      .replace(/^\.\//, '')
      .replace(/^\//, '');
    if (clean.endsWith('.html')) links.push(clean);
  }
  return unique(links);
}

function canonicalToPath(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+\//i, '');
  const clean = withoutOrigin.replace(/^\/+/, '').split('#')[0].split('?')[0];
  return clean || 'index.html';
}

function pathToUrl(pagePath, baseUrl) {
  return `${baseUrl}/${String(pagePath || '').replace(/^\/+/, '')}`;
}

function readSitemapPaths() {
  const file = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => canonicalToPath(match[1]));
  return urls.filter((urlPath) => urlPath.endsWith('.html'));
}

function findRootHtmlPaths() {
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith('.html'))
    .filter((name) => !TECHNICAL_PAGES.has(name));
}

function inferCategory(pagePath, html) {
  if (CORE_PAGES.has(pagePath)) return 'core';
  const bodyClass = matchOne(html, /<body\b[^>]*class="([^"]+)"/i);
  const classCategory = String(bodyClass || '').match(/article--([a-z-]+)/i);
  if (classCategory) return classCategory[1];
  const categoryPill = matchOne(html, /article-kicker-card__category-pill[^>]*>([^<]+)/i).toLowerCase();
  if (categoryPill.includes('ruch')) return 'ruch';
  if (categoryPill.includes('jedzenie')) return 'jedzenie';
  if (categoryPill.includes('zdrowie')) return 'zdrowie';
  if (categoryPill.includes('ciekawe')) return 'ciekawe';
  return 'other';
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of String(html || '').matchAll(regex)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (_) {
      // Ignore malformed schema here; schema-validator owns hard validation.
    }
  }
  return blocks;
}

function flattenSchemaTypes(node, collector = []) {
  if (!node || typeof node !== 'object') return collector;
  if (Array.isArray(node)) {
    node.forEach((item) => flattenSchemaTypes(item, collector));
    return collector;
  }
  if (node['@type']) collector.push(String(node['@type']));
  if (node['@graph']) flattenSchemaTypes(node['@graph'], collector);
  return collector;
}

function getBlogPosting(blocks) {
  const stack = [...blocks];
  while (stack.length) {
    const item = stack.shift();
    if (!item || typeof item !== 'object') continue;
    if (Array.isArray(item)) {
      stack.push(...item);
      continue;
    }
    if (String(item['@type'] || '') === 'BlogPosting') return item;
    if (Array.isArray(item['@graph'])) stack.push(...item['@graph']);
  }
  return null;
}

function collectPages(baseUrl) {
  const paths = unique([...readSitemapPaths(), ...findRootHtmlPaths()])
    .filter((pagePath) => pagePath.endsWith('.html'))
    .filter((pagePath) => fs.existsSync(path.join(ROOT, pagePath)))
    .sort((a, b) => a.localeCompare(b, 'pl'));

  const pages = paths.map((pagePath) => {
    const abs = path.join(ROOT, pagePath);
    const html = fs.readFileSync(abs, 'utf8');
    const title = matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription = matchOne(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
    const h1 = stripTags(matchOne(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i));
    const h2 = [...String(html || '').matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
      .map((match) => stripTags(match[1]))
      .filter(Boolean);
    const blocks = parseJsonLdBlocks(html);
    const blogPosting = getBlogPosting(blocks);
    const schemaTypes = unique(flattenSchemaTypes(blocks));
    const words = tokenize(`${pagePath} ${title} ${metaDescription} ${h1} ${h2.join(' ')}`);
    const dateModified = matchOne(html, /<meta\s+property="article:modified_time"\s+content="([^"]*)"/i)
      || String(blogPosting?.dateModified || '');

    return {
      path: pagePath,
      url: pathToUrl(pagePath, baseUrl),
      type: CORE_PAGES.has(pagePath) ? 'core' : (/http-equiv=["']refresh/i.test(html) ? 'redirect' : 'article'),
      category: inferCategory(pagePath, html),
      title,
      h1,
      meta_description: metaDescription,
      h2: h2.slice(0, 12),
      date_modified: dateModified,
      tokens: unique(words),
      links_out: extractLinks(html),
      has_quick_answer: /id="quick-answer"/i.test(html),
      faq_count: (html.match(/class="[^"]*\bfaq-item\b/gi) || []).length,
      has_faq_schema: schemaTypes.includes('FAQPage'),
      has_blogposting: schemaTypes.includes('BlogPosting'),
      has_speakable: /"speakable"\s*:/i.test(html),
      citation_count: Array.isArray(blogPosting?.citation) ? blogPosting.citation.length : 0,
    };
  });

  const inboundByPath = new Map(pages.map((page) => [page.path, 0]));
  const inboundSourcesByPath = new Map(pages.map((page) => [page.path, []]));
  for (const source of pages) {
    for (const target of source.links_out) {
      if (!inboundByPath.has(target)) continue;
      inboundByPath.set(target, (inboundByPath.get(target) || 0) + 1);
      inboundSourcesByPath.get(target).push(source.path);
    }
  }

  return pages.map((page) => ({
    ...page,
    inbound_links: inboundByPath.get(page.path) || 0,
    inbound_sources: inboundSourcesByPath.get(page.path) || [],
  }));
}

function aggregateGscByPage(gsc) {
  const byUrl = new Map();
  for (const row of gsc.pages) {
    if (!row.page) continue;
    byUrl.set(row.page, {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }

  const queryByUrl = new Map();
  for (const row of gsc.queryPages) {
    if (!row.page || !row.query) continue;
    if (!queryByUrl.has(row.page)) queryByUrl.set(row.page, []);
    queryByUrl.get(row.page).push(row);
  }

  return { byUrl, queryByUrl };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function opportunityScore(metrics, page) {
  const impressions = Number(metrics?.impressions || 0);
  const ctr = Number(metrics?.ctr || 0);
  const position = Number(metrics?.position || 0);
  const gscPotential = position > 0 ? clamp((35 - position) / 35, 0, 1) : 0;
  const impressionScore = clamp(Math.log10(Math.max(1, impressions)) / 3, 0, 1);
  const ctrGap = clamp((3 - ctr) / 3, 0, 1);
  const topologyGap = clamp((5 - Number(page.inbound_links || 0)) / 5, 0, 1);
  const aeoGap = page.has_quick_answer && page.has_faq_schema && page.citation_count >= 4 ? 0 : 1;
  return Math.round((0.34 * gscPotential + 0.24 * impressionScore + 0.18 * ctrGap + 0.14 * topologyGap + 0.1 * aeoGap) * 100);
}

function classifyPriority(metrics, page, score) {
  const impressions = Number(metrics?.impressions || 0);
  const position = Number(metrics?.position || 0);
  if (page.type === 'core' || page.type === 'redirect') return 'P3_MAINTAIN';
  if (position >= 4 && position <= 20 && impressions > 0) return 'P0_NEAR_PAGE_ONE';
  if (position > 20 && position <= 50 && impressions > 0) return 'P1_GROWTH';
  if (impressions === 0 && page.inbound_links < 4) return 'P1_NO_GSC_DATA_BUILD_DISCOVERY';
  if (score >= 55) return 'P1_OPTIMIZE';
  if (page.inbound_links < 4) return 'P2_INTERNAL_LINKING';
  return 'P3_MAINTAIN';
}

function inferIntent(query) {
  const q = String(query || '').toLowerCase();
  if (/(norma|wynik|cena|ile kosztuje|badanie|poziom)/.test(q)) return 'normy/wynik/cena';
  if (/(jak|plan|zacząć|zaczac|obniżyć|obnizyc|poprawić|poprawic)/.test(q)) return 'how-to';
  if (/(czy warto|czy można|czy mozna|bezpieczne|ryzyko|skutki)/.test(q)) return 'bezpieczeństwo';
  if (/(objawy|ból|bol|problem|chorob)/.test(q)) return 'objawy/problem';
  if (/(co to|czym jest|definicja)/.test(q)) return 'definicja';
  return 'informacyjna';
}

function cleanQuery(query) {
  return String(query || '')
    .replace(/-site:[^\s]+/g, '')
    .replace(/\bsite:[^\s]+/g, '')
    .replace(/\bOR\b/g, ' ')
    .replace(/["]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulQuery(query) {
  const raw = String(query || '').trim();
  const cleaned = cleanQuery(raw);
  if (!cleaned || cleaned.length < 3) return false;
  if (/\bsite:/i.test(raw)) return false;
  if ((raw.match(/-/g) || []).length >= 3) return false;
  if (/grafike daj|^prywatnie zbadali$/i.test(cleaned)) return false;
  return true;
}

function buildKeywordPlan(page, queryRows) {
  const rows = [...queryRows]
    .filter((row) => isUsefulQuery(row.query))
    .filter((row) => row.query)
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0) || Number(a.position || 999) - Number(b.position || 999));
  const primary = cleanQuery(rows[0]?.query || page.h1 || page.title.replace(/\s*\|\s*FitPo50.*$/i, ''));
  const secondary = unique(rows.slice(1, 8).map((row) => cleanQuery(row.query))).slice(0, 6);
  const intents = unique(rows.slice(0, 10).map((row) => inferIntent(row.query))).slice(0, 4);
  return {
    primary,
    secondary,
    intents,
    evidence: rows.slice(0, 8).map((row) => ({
      query: cleanQuery(row.query),
      impressions: Math.round(row.impressions),
      clicks: Math.round(row.clicks),
      ctr: Number(row.ctr.toFixed(2)),
      position: Number(row.position.toFixed(2)),
      intent: inferIntent(row.query),
    })),
  };
}

function similarity(a, b) {
  const left = new Set(a.tokens || []);
  const right = new Set(b.tokens || []);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap;
}

function suggestSources(target, pages) {
  return pages
    .filter((page) => page.path !== target.path)
    .filter((page) => !page.links_out.includes(target.path))
    .filter((page) => page.type === 'article' || CORE_PAGES.has(page.path))
    .map((page) => ({
      from: page.path,
      score: similarity(target, page),
      inbound_strength: page.inbound_links,
      anchor: suggestAnchor(target),
      placement: suggestPlacement(page, target),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.inbound_strength - a.inbound_strength)
    .slice(0, 5);
}

function suggestAnchor(page) {
  const base = String(page.h1 || page.title || page.path)
    .replace(/\s*\|\s*FitPo50.*$/i, '')
    .replace(/[?!.]+$/g, '')
    .trim();
  if (base.length <= 54) return base;
  return base.slice(0, 51).trim();
}

function suggestPlacement(source, target) {
  const shared = (source.tokens || []).filter((token) => (target.tokens || []).includes(token)).slice(0, 3);
  if (!shared.length) return 'Akapit kontekstowy pod najbliższym H2 tematycznym.';
  return `Akapit z tematem: ${shared.join(', ')}.`;
}

function buildActionPlan(priority, page, keywordPlan, sources) {
  const actions = [];
  if (priority === 'P0_NEAR_PAGE_ONE') {
    actions.push('Wzmocnij 2-4 linkami kontekstowymi z najlepszych źródeł.');
    actions.push('Dopasuj title/meta do głównej frazy bez zmiany URL.');
    actions.push('Dodaj albo odśwież FAQ pod realne zapytania GSC.');
  } else if (priority === 'P1_GROWTH') {
    actions.push('Rozbuduj sekcję odpowiadającą na główną intencję.');
    actions.push('Dodaj 3 linki przychodzące z klastra tematycznego.');
    actions.push('Utwórz jedną krótką odpowiedź AEO pod query long-tail.');
  } else if (priority === 'P1_NO_GSC_DATA_BUILD_DISCOVERY') {
    actions.push('Podepnij stronę pod 2-3 mocne artykuły i stronę kategorii.');
    actions.push('Sprawdź, czy title/H1 jasno mówi, na jaką frazę ma rankować.');
    actions.push('Po deployu zgłoś target i strony źródłowe w GSC.');
  } else if (priority === 'P2_INTERNAL_LINKING') {
    actions.push('Dodaj 1-2 linki z tematycznie bliskich artykułów.');
    actions.push('Zostaw snippet bez zmian, jeśli CTR nie ma danych.');
  } else {
    actions.push('Monitoruj; poprawiaj dopiero przy spadku CTR/pozycji.');
  }

  if (page.type === 'article' && !page.has_quick_answer) actions.push('Dodaj blok Szybka odpowiedź pod AEO.');
  if (page.type === 'article' && page.faq_count < 3) actions.push('Dodaj FAQ z pytań GSC/PAA, nie generyczne.');
  if (page.citation_count < 4 && page.type === 'article') actions.push('Uzupełnij cytowania dla E-E-A-T/GEO.');
  if (sources.length) actions.push(`Najpierw linkuj z: ${sources.slice(0, 3).map((item) => item.from).join(', ')}.`);
  if (keywordPlan.primary) actions.push(`Fraza główna do śledzenia: "${keywordPlan.primary}".`);

  return unique(actions).slice(0, 8);
}

function readAiVisibility(inputDir) {
  const referrersPath = path.join(inputDir, 'referrers.csv');
  const checksPath = path.join(inputDir, 'ai-visibility-checks.csv');
  const aiHosts = ['chatgpt.com', 'gemini.google.com', 'perplexity.ai', 'claude.ai', 'copilot.microsoft.com', 'bing.com'];
  const refRows = readCsvIfExists(referrersPath);
  const checkRows = readCsvIfExists(checksPath);
  const referrers = [];

  for (const row of refRows) {
    const keys = Object.keys(row || {});
    const hostKey = keys.find((key) => /(host|hostname|source|referrer|domain)/i.test(key));
    const visitsKey = keys.find((key) => /(users|sessions|visits|clicks|count|traffic)/i.test(key));
    const host = String(hostKey ? row[hostKey] : '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!host || !aiHosts.some((base) => host === base || host.endsWith(`.${base}`))) continue;
    referrers.push({ host, visits: visitsKey ? Math.round(parseNumber(row[visitsKey])) : 0 });
  }

  const checks = checkRows.map((row) => {
    const keys = Object.keys(row || {});
    const get = (pattern) => {
      const key = keys.find((candidate) => pattern.test(candidate));
      return key ? String(row[key] || '').trim() : '';
    };
    return {
      checked_at: get(/checked|date|czas/i),
      engine: get(/engine|ai|model|source/i),
      prompt: get(/prompt|query|pytanie/i),
      cited_url: get(/url|link|citation|source/i),
      result: get(/result|contains|mention|status|wynik/i),
    };
  }).filter((row) => row.engine || row.prompt || row.cited_url);

  return {
    status: referrers.length || checks.length ? 'ok' : 'INSUFFICIENT_DATA',
    referrers_file: referrersPath,
    ai_visibility_checks_file: checksPath,
    referrers,
    checks,
    how_to_measure: [
      'Co tydzień eksportuj z GA4/analytics źródła ruchu do referrers.csv i szukaj hostów ChatGPT, Perplexity, Gemini, Claude, Copilot/Bing.',
      'Raz w tygodniu wykonaj ręczny test 20 promptów z TOP query i zapisz wynik do ai-visibility-checks.csv.',
      'W promptach sprawdzaj: czy AI cytuje FitPo50, który URL cytuje i czy odpowiedź używa naszego tytułu/definicji.',
      'Porównuj 7/28 dni: wejścia z AI, liczba cytowanych URL-i, liczba promptów z FitPo50 w odpowiedzi.',
    ],
  };
}

function buildPriorityMap(pages, gsc) {
  const { byUrl, queryByUrl } = aggregateGscByPage(gsc);
  return pages.map((page) => {
    const metrics = byUrl.get(page.url) || {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    };
    const queryRows = queryByUrl.get(page.url) || [];
    const keywordPlan = buildKeywordPlan(page, queryRows);
    const score = opportunityScore(metrics, page);
    const priority = classifyPriority(metrics, page, score);
    const sourceSuggestions = suggestSources(page, pages);
    const aiReadinessScore = Math.round(([
      page.has_quick_answer,
      page.has_faq_schema,
      page.has_blogposting,
      page.has_speakable,
      page.citation_count >= 4,
      page.inbound_links >= 4,
    ].filter(Boolean).length / 6) * 100);

    return {
      priority,
      opportunity_score: score,
      url: page.url,
      path: page.path,
      type: page.type,
      category: page.category,
      title: page.title,
      h1: page.h1,
      date_modified: page.date_modified,
      gsc: {
        clicks: Math.round(metrics.clicks),
        impressions: Math.round(metrics.impressions),
        ctr: Number(Number(metrics.ctr || 0).toFixed(2)),
        position: Number(Number(metrics.position || 0).toFixed(2)),
        status: queryRows.length || metrics.impressions ? 'ok' : 'NO_GSC_QUERY_PAGE_DATA',
      },
      topology: {
        inbound_links: page.inbound_links,
        inbound_sources: page.inbound_sources.slice(0, 10),
        outbound_internal_links: page.links_out.length,
        suggested_sources: sourceSuggestions,
      },
      keywords: keywordPlan,
      aeo_geo_ai: {
        ai_readiness_score: aiReadinessScore,
        has_quick_answer: page.has_quick_answer,
        faq_count: page.faq_count,
        has_faq_schema: page.has_faq_schema,
        has_blogposting: page.has_blogposting,
        has_speakable: page.has_speakable,
        citation_count: page.citation_count,
      },
      action_plan: buildActionPlan(priority, page, keywordPlan, sourceSuggestions),
      gsc_submit_after_change: [page.url, ...sourceSuggestions.slice(0, 3).map((item) => pathToUrl(item.from, SITE_ORIGIN))],
    };
  }).sort((a, b) => {
    const rank = {
      P0_NEAR_PAGE_ONE: 0,
      P1_GROWTH: 1,
      P1_NO_GSC_DATA_BUILD_DISCOVERY: 2,
      P1_OPTIMIZE: 3,
      P2_INTERNAL_LINKING: 4,
      P3_MAINTAIN: 5,
    };
    return (rank[a.priority] ?? 99) - (rank[b.priority] ?? 99)
      || b.opportunity_score - a.opportunity_score
      || b.gsc.impressions - a.gsc.impressions;
  });
}

function groupCounts(items, key) {
  const out = {};
  for (const item of items) {
    const value = String(item[key] || 'unknown');
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

function writeOutputs(report, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'gsc-priority-map.json');
  const mdPath = path.join(outputDir, 'gsc-priority-map.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# GSC Priority Map — wszystkie URL-e');
  lines.push('');
  lines.push(`Wygenerowano: ${report.generated_at}`);
  lines.push(`Status danych GSC: ${report.data_quality.gsc_status}`);
  lines.push(`Zakres: ${report.summary.pages_total} stron z sitemap/root HTML, w tym nowe bez danych GSC.`);
  lines.push('');
  lines.push('## Podsumowanie');
  Object.entries(report.summary.priority_counts).forEach(([priority, count]) => {
    lines.push(`- ${priority}: ${count}`);
  });
  lines.push('');
  lines.push('## TOP 20 — co pchać w pierwszej kolejności');
  report.priority_map.slice(0, 20).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.url}`);
    lines.push(`   - priority: ${item.priority}, score: ${item.opportunity_score}, category: ${item.category}`);
    lines.push(`   - GSC: impr ${item.gsc.impressions}, clicks ${item.gsc.clicks}, CTR ${item.gsc.ctr}%, pos ${item.gsc.position}`);
    lines.push(`   - fraza główna: ${item.keywords.primary || 'INSUFFICIENT_DATA'}`);
    if (item.keywords.secondary.length) {
      lines.push(`   - frazy wspierające: ${item.keywords.secondary.slice(0, 4).join(' | ')}`);
    }
    if (item.topology.suggested_sources.length) {
      const sources = item.topology.suggested_sources.slice(0, 3).map((source) => `${source.from} → "${source.anchor}"`);
      lines.push(`   - miejsca linków: ${sources.join(' ; ')}`);
    }
    lines.push(`   - akcja: ${item.action_plan.slice(0, 3).join(' ')}`);
  });
  lines.push('');
  lines.push('## AI Visibility Monitor');
  lines.push(`- status: ${report.ai_visibility_monitor.status}`);
  lines.push(`- plik referrerów: ${report.ai_visibility_monitor.referrers_file}`);
  lines.push(`- plik testów promptów: ${report.ai_visibility_monitor.ai_visibility_checks_file}`);
  if (report.ai_visibility_monitor.referrers.length) {
    lines.push('- wykryte wejścia AI:');
    report.ai_visibility_monitor.referrers.slice(0, 10).forEach((row) => {
      lines.push(`  - ${row.host}: ${row.visits}`);
    });
  }
  if (report.ai_visibility_monitor.checks.length) {
    lines.push('- ręczne testy cytowań AI:');
    report.ai_visibility_monitor.checks.slice(0, 10).forEach((row) => {
      lines.push(`  - ${row.engine}: ${row.prompt} → ${row.cited_url || row.result || 'brak URL'}`);
    });
  }
  lines.push('');
  lines.push('## Jak badać, czy AI nas zaciąga?');
  report.ai_visibility_monitor.how_to_measure.forEach((step) => {
    lines.push(`- ${step}`);
  });
  lines.push('');
  lines.push('## Zasada pracy falami');
  lines.push('- Fala 1: P0_NEAR_PAGE_ONE — 2-4 linki kontekstowe, snippet, FAQ, zgłoszenie targetu i źródeł w GSC.');
  lines.push('- Fala 2: P1_GROWTH — rozbudowa intencji, linkowanie z klastra, szybka odpowiedź pod AEO.');
  lines.push('- Fala 3: P1_NO_GSC_DATA_BUILD_DISCOVERY — podpięcie nowych stron pod klastry i kategorie.');
  lines.push('- Fala 4: P2/P3 — utrzymanie, odświeżanie dat, cytowań i linków bez przepalania czasu.');
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  return { jsonPath, mdPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const gsc = readGsc(args.inputDir);
  const pages = collectPages(args.baseUrl);
  const priorityMap = buildPriorityMap(pages, gsc);
  const aiVisibility = readAiVisibility(args.inputDir);
  const report = {
    generated_at: new Date().toISOString(),
    data_quality: {
      gsc_status: gsc.status,
      gsc_files: gsc.files,
      rows: {
        pages: gsc.pages.length,
        queries: gsc.queries.length,
        query_pages: gsc.queryPages.length,
      },
      page_coverage: {
        all_pages: pages.length,
        pages_with_gsc_impressions: priorityMap.filter((item) => item.gsc.impressions > 0).length,
        pages_without_gsc_data: priorityMap.filter((item) => item.gsc.impressions === 0).length,
      },
    },
    summary: {
      pages_total: pages.length,
      priority_counts: groupCounts(priorityMap, 'priority'),
      categories: groupCounts(priorityMap, 'category'),
      method: 'Sitemap/root HTML + GSC query-pages + link topology + AEO/GEO/AI readiness.',
    },
    priority_map: priorityMap,
    ai_visibility_monitor: aiVisibility,
  };

  const outputs = writeOutputs(report, args.outputDir);
  console.log(`[GSC-PRIORITY-MAP] pages=${pages.length} gsc=${gsc.status}`);
  console.log(`[GSC-PRIORITY-MAP] report: ${outputs.mdPath}`);
  console.log(`[GSC-PRIORITY-MAP] report: ${outputs.jsonPath}`);
}

main();
