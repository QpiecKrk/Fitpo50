#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { inspectGscInput } = require('./lib/gsc-data-contract');

const ROOT = process.cwd();
const REPORT_DIR = process.env.FITPO50_GROWTH_REPORT_DIR
  ? path.resolve(process.env.FITPO50_GROWTH_REPORT_DIR)
  : path.join(process.cwd(), 'data', 'reports', 'growth');
const GSC_INPUT_DIR = process.env.GSC_WORK_DIR || path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
const GSC_CONTENT_STRATEGY_REPORT = process.env.GSC_CONTENT_STRATEGY_REPORT || '';
const SEO_STATE_DIR = process.env.FITPO50_SEO_STATE_DIR
  ? path.resolve(process.env.FITPO50_SEO_STATE_DIR)
  : path.join(os.homedir(), 'Downloads', 'fitpo50-seo-state');
const SITE_ORIGIN = 'https://fitpo50.pl';
const TEMPORARILY_IGNORED_SEO_FILES = new Set([
  'narzedzia.html',
]);
const SUPPORT_PAGES = new Set([
  'index.html',
  'porady.html',
  'rusz-sie.html',
  'jedzenie.html',
  'zdrowie.html',
  'ciekawe.html',
  'dziennik.html',
  'o-mnie.html',
  'moje-sukcesy.html',
  'polityka-prywatnosci.html',
  'search.html',
  'article-template-bento.html',
]);
const HUBS = [
  {
    id: 'cholesterol',
    title: 'Cholesterol i badania krwi po 50',
    preferred_file: 'centrum-cholesterolu-po-50.html',
    keywords: ['cholesterol', 'apob', 'apoa', 'ldl', 'hdl', 'lipid', 'trigliceryd', 'badania krwi'],
    must_have_assets: ['tabela interpretacji lipidogramu', 'ściąga ApoB/ApoA', 'PDF: pytania do lekarza'],
  },
  {
    id: 'sen',
    title: 'Sen po 50',
    preferred_file: 'centrum-snu-po-50.html',
    keywords: ['sen', 'snu', 'bezsen', 'melatonin', 'kortyzol', 'bezdech', 'przebudzenia', 'sypialnia'],
    must_have_assets: ['checklista higieny snu', 'tabela: objaw → przyczyna → co zrobić', 'PDF: plan 7 nocy'],
  },
  {
    id: 'nadcisnienie',
    title: 'Nadciśnienie po 50',
    preferred_file: 'centrum-nadcisnienia-po-50.html',
    keywords: ['nadcisnienie', 'ciśnienie', 'cisnienie', 'tetnic', 'naczyn', 'dash', 'serce'],
    must_have_assets: ['karta pomiaru ciśnienia', 'tabela: wynik → znaczenie → działanie', 'PDF dla wizyty lekarskiej'],
  },
  {
    id: 'bialko',
    title: 'Białko po 50',
    preferred_file: 'centrum-bialka-po-50.html',
    keywords: ['bialko', 'białko', 'wpc', 'wpi', 'sarkopen', 'kreatyna', 'miesni', 'mięśni'],
    must_have_assets: ['tabela białka w produktach', 'kalkulator dawki', 'PDF: rozkład białka w dzień'],
  },
  {
    id: 'trening-silowy',
    title: 'Trening siłowy po 50',
    preferred_file: 'centrum-treningu-silowego-po-50.html',
    keywords: ['trening', 'silown', 'siłown', 'sila', 'siła', 'miesnie', 'mięśnie', 'chwytu'],
    must_have_assets: ['plan startowy 4 tygodnie', 'tabela ćwiczeń', 'grafika: progresja obciążenia'],
  },
  {
    id: 'metabolizm',
    title: 'Metabolizm i brzuch po 50',
    preferred_file: 'centrum-metabolizmu-po-50.html',
    keywords: ['metabolizm', 'oponka', 'tluszcz', 'tłuszcz', 'trzewny', 'kortyzol', 'cukier'],
    must_have_assets: ['checklista obwodu pasa', 'tabela: przyczyna → test → działanie', 'PDF: 14 dni nawyków'],
  },
];
const AI_QUESTION_BANK = [
  ['sen', 'Dlaczego budzę się o 3 w nocy po 50 roku życia?'],
  ['sen', 'Jak poprawić sen po 50 bez leków?'],
  ['sen', 'Czy melatonina po 50 jest bezpieczna?'],
  ['sen', 'Jak rozpoznać bezdech senny u osoby po 50?'],
  ['sen', 'Jaka temperatura sypialni jest najlepsza dla snu po 50?'],
  ['nadcisnienie', 'Jak naturalnie obniżyć ciśnienie po 50?'],
  ['nadcisnienie', 'Jak mierzyć ciśnienie w domu prawidłowo?'],
  ['nadcisnienie', 'Czy trening siłowy jest bezpieczny przy nadciśnieniu?'],
  ['nadcisnienie', 'Co jeść przy nadciśnieniu po 50?'],
  ['nadcisnienie', 'Kiedy z wysokim ciśnieniem trzeba pilnie do lekarza?'],
  ['bialko', 'Ile białka dziennie po 50 roku życia?'],
  ['bialko', 'Czy białko szkodzi nerkom po 50?'],
  ['bialko', 'Co lepsze WPC czy WPI po 50?'],
  ['bialko', 'Jak rozłożyć białko w ciągu dnia po 50?'],
  ['bialko', 'Jakie produkty mają najwięcej białka dla osób 50 plus?'],
  ['trening-silowy', 'Jak zacząć trening siłowy po 50?'],
  ['trening-silowy', 'Ile razy w tygodniu ćwiczyć siłowo po 50?'],
  ['trening-silowy', 'Czy siłownia chroni serce po 50?'],
  ['trening-silowy', 'Jak uniknąć kontuzji na siłowni po 50?'],
  ['trening-silowy', 'Jak zbudować mięśnie po 50?'],
  ['metabolizm', 'Jak pozbyć się oponki brzusznej po 50?'],
  ['metabolizm', 'Dlaczego tłuszcz trzewny jest groźny po 50?'],
  ['metabolizm', 'Jak obniżyć kortyzol po 50?'],
  ['metabolizm', 'Czy post przerywany jest dobry po 50?'],
  ['metabolizm', 'Jak przyspieszyć metabolizm po 50?'],
];

function parseArgs(argv) {
  const out = { command: 'report', flags: {}, positional: [] };
  if (argv[0] && !argv[0].startsWith('--')) {
    out.command = argv[0];
    argv = argv.slice(1);
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token.startsWith('--')) {
      out.positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      out.flags[key] = true;
      continue;
    }
    out.flags[key] = value;
    i += 1;
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readSeoState(name) {
  return readJsonIfExists(path.join(SEO_STATE_DIR, name));
}

function writeSeoState(name, value) {
  ensureDir(SEO_STATE_DIR);
  writeJson(path.join(SEO_STATE_DIR, name), value);
}

function writeJson(file, payload) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeText(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${String(content || '').trimEnd()}\n`, 'utf8');
}

function readTextIfExists(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { parse_error: err.message || String(err), file };
  }
}

function findLatestGscContentStrategyReport() {
  if (GSC_CONTENT_STRATEGY_REPORT && fs.existsSync(GSC_CONTENT_STRATEGY_REPORT)) return GSC_CONTENT_STRATEGY_REPORT;
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  if (!fs.existsSync(downloadsDir)) return '';
  return fs.readdirSync(downloadsDir)
    .filter((name) => /^gsc-content-strategy-\d{4}-\d{2}-\d{2}\.md$/i.test(name))
    .map((name) => path.join(downloadsDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    [0] || '';
}

function extractMarkdownSection(markdown, headingPattern) {
  const lines = String(markdown || '').split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.map((line) => line.trim()).filter(Boolean);
}

function cleanMarkdownValue(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[-*]\s+/, '')
    .trim();
}

function strategyUrlToFile(value) {
  const raw = cleanMarkdownValue(value)
    .replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, '')
    .replace(/^\/+/, '')
    .replace(/[)#.,]+$/g, '')
    .trim();
  return raw.endsWith('.html') ? raw : raw;
}

function parsePercentValue(value) {
  return toNumber(String(value || '').replace('%', ''));
}

function parseStrategyTableRows(markdown, headingPattern, mapper) {
  const rows = [];
  for (const line of extractMarkdownSection(markdown, headingPattern)) {
    const cells = line.split('|').map(cleanMarkdownValue).filter(Boolean);
    if (!cells.length || !/^\d+$/.test(cells[0])) continue;
    const item = mapper(cells);
    if (item && item.file) rows.push(item);
  }
  return rows;
}

function readGscContentStrategyReport() {
  const file = findLatestGscContentStrategyReport();
  if (!file) {
    return {
      status: 'MISSING',
      expected_file: GSC_CONTENT_STRATEGY_REPORT || path.join(os.homedir(), 'Downloads', 'gsc-content-strategy-YYYY-MM-DD.md'),
      path: '',
      generated_date: '',
      data_quality: [],
      opportunity_leaderboard: [],
      quick_wins: [],
      action_cards: [],
      cannibalization: [],
      gsc_submit_queue: [],
      global_extra_topics: [],
    };
  }
  const markdown = readTextIfExists(file);
  const oldOpportunity = parseStrategyTableRows(markdown, /^##\s+(?:\d+\.\s+)?Opportunity Leaderboard/i, (cells) => {
    if (cells.length === 6) {
      return {
        rank: Number(cells[0]),
        file: strategyUrlToFile(cells[1]),
        query: '',
        impressions: toNumber(cells[3]),
        clicks: 0,
        ctr: parsePercentValue(cells[4]),
        position: toNumber(cells[5]),
        score: toNumber(cells[2]),
        priority: 'GSC_OPPORTUNITY',
        source_section: 'Opportunity Leaderboard',
      };
    }
    if (cells.length < 7) return null;
    return {
      rank: Number(cells[0]),
      file: strategyUrlToFile(cells[1]),
      query: cells[2],
      impressions: toNumber(cells[3]),
      clicks: 0,
      ctr: 0,
      position: toNumber(cells[4]),
      score: toNumber(cells[5]),
      priority: cells[6],
      source_section: 'Opportunity Leaderboard',
    };
  });
  const aeoOpportunity = parseStrategyTableRows(markdown, /^##\s+(?:\d+\.\s+)?AEO Opportunity Bot/i, (cells) => {
    if (cells.length < 8) return null;
    return {
      rank: Number(cells[0]),
      file: strategyUrlToFile(cells[1]),
      query: cells[7],
      impressions: toNumber(cells[2]),
      clicks: toNumber(cells[3]),
      ctr: parsePercentValue(cells[4]),
      position: toNumber(cells[5]),
      score: toNumber(cells[6]),
      priority: 'AEO_CTR_GAP',
      source_section: 'AEO Opportunity Bot',
    };
  });
  const opportunity = oldOpportunity.length ? oldOpportunity : aeoOpportunity;
  const quickWins = [];
  const quickLines = extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Quick Wins/i);
  for (let i = 0; i < quickLines.length; i += 1) {
    const match = quickLines[i].match(/^\d+\.\s+\*\*`?\/?([^`*]+)`?\*\*\s+\(([^)]+)\)/);
    if (!match) continue;
    const conclusionLine = quickLines[i + 1] || '';
    quickWins.push({
      file: match[1],
      metrics: cleanMarkdownValue(match[2]),
      conclusion: cleanMarkdownValue(conclusionLine.replace(/^\s*-\s*\*Wniosek:\*\s*/i, '')),
    });
  }
  const actionCards = [];
  for (const block of markdown.split(/\n###\s+/).slice(1)) {
    if (!/(?:Kart[ęa]|Action Card)\s+#?\d+/i.test(block)) continue;
    const header = block.split(/\r?\n/)[0] || '';
    const id = (header.match(/#?(\d+)/) || [])[1] || String(actionCards.length + 1);
    const fileMatch = header.match(/\(`\/?([^)`]+)`\)/);
    const lines = block.split(/\r?\n/).map((line) => line.trim());
    const pick = (label) => {
      const wanted = normalizeHeaderKey(label);
      const found = lines.find((line) => normalizeHeaderKey(line).includes(wanted));
      return found ? cleanMarkdownValue(found.replace(/^[-*]\s+\*\*[^:]+:\*\*\s*/, '')) : '';
    };
    const urlLine = pick('URL');
    const urlFile = strategyUrlToFile((urlLine.match(/https?:\/\/\S+/i) || [])[0] || urlLine);
    actionCards.push({
      id: `STRATEGIA ${id}`,
      file: fileMatch ? strategyUrlToFile(fileMatch[1]) : urlFile,
      metrics: pick('Metryki GSC') || pick('Metryki'),
      proposed_title: pick('Proponowany Title') || pick('Proponowany <title>'),
      proposed_meta_description: pick('Proponowany Meta Description') || pick('Proponowany `meta description`'),
      h2_faq: pick('Sugestie H2/FAQ') || pick('FAQ'),
      link_places: pick('Miejsca linków') || pick('Anchor & Linkowanie'),
      priority_effect: pick('Priorytet & Efekt'),
    });
  }
  const submitQueue = [
    ...extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Co zgłosić do GSC/i),
    ...extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Kolejka Zgłoszeń do GSC/i),
  ]
    .map((line) => (line.match(/https?:\/\/\S+/i) || [])[0] || '')
    .map((url) => url.replace(/[)`.,]+$/g, ''))
    .filter(Boolean);
  const globalExtra = [
    ...extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Nowe Artykuły GLOBAL_EXTRA/i),
    ...extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Propozycje Nowych Artykułów/i),
  ]
    .filter((line) => /^[-*]\s+/.test(line))
    .map(cleanMarkdownValue);
  const dateMatch = markdown.match(/^#\s+Raport GSC Premium \(FitPo50\)\s+—\s+(\d{4}-\d{2}-\d{2})/m)
    || markdown.match(/\*\*Data wygenerowania:\*\*\s*(\d{4}-\d{2}-\d{2})/m);
  return {
    status: 'OK',
    path: file,
    generated_date: dateMatch ? dateMatch[1] : '',
    data_quality: extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Data Quality Gate/i)
      .filter((line) => /^[-*]\s+/.test(line))
      .map(cleanMarkdownValue),
    opportunity_leaderboard: opportunity.slice(0, 10),
    quick_wins: quickWins.slice(0, 8),
    action_cards: actionCards.slice(0, 8),
    cannibalization: [
      ...extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Cannibalization/i),
      ...extractMarkdownSection(markdown, /^##\s+(?:\d+\.\s+)?Wykryta Kanibalizacja/i),
    ]
      .filter((line) => !/^---+$/.test(line))
      .slice(0, 14)
      .map(cleanMarkdownValue),
    gsc_submit_queue: submitQueue,
    global_extra_topics: globalExtra,
  };
}

function nowWarsawIso() {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetHours = Math.trunc(Math.abs(offsetMinutes) / 60);
  const offsetRest = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetRest).padStart(2, '0')}`;
}

function parseDate(input) {
  const date = new Date(String(input || '').trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function extractJsonLdObjects(html) {
  const objects = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = String(match[1] || '').trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) objects.push(...parsed);
      else objects.push(parsed);
    } catch (_) {
      continue;
    }
  }
  return objects;
}

function flattenJsonLdNodes(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonLdNodes(item, out));
    return out;
  }
  out.push(value);
  if (Array.isArray(value['@graph'])) flattenJsonLdNodes(value['@graph'], out);
  return out;
}

function hasJsonLdAuthor(html) {
  return flattenJsonLdNodes(extractJsonLdObjects(html)).some((node) => Boolean(node.author));
}

function textHasExactReference(text, reference) {
  const value = String(reference || '').trim();
  if (!value) return false;
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.some((line) => {
    const normalized = line.replace(/^[-*]\s+/, '').replace(/[),.;\]]+$/g, '');
    return normalized === value
      || normalized.endsWith(`/${value}`)
      || normalized === `${SITE_ORIGIN}/${value}`
      || normalized.includes(`/${value} `)
      || normalized.includes(`/${value})`);
  });
}

function findHtmlFiles(root) {
  const files = [];
  const skip = new Set(['.git', 'node_modules', '_site', 'dist', 'admin', 'scripts', 'tests', 'templates']);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name) && !entry.name.startsWith('.')) walk(abs);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.html')) {
        const rel = path.relative(root, abs).replace(/\\/g, '/');
        if (!SUPPORT_PAGES.has(rel)) files.push(rel);
      }
    }
  }
  walk(root);
  return files.sort();
}

function findSeoHtmlFiles(root) {
  const files = [];
  const skip = new Set(['.git', 'node_modules', '_site', 'dist', 'admin', 'scripts', 'tests', 'templates']);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name) && !entry.name.startsWith('.')) walk(abs);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(path.relative(root, abs).replace(/\\/g, '/'));
      }
    }
  }
  walk(root);
  return files.sort();
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(html, rx) {
  const match = html.match(rx);
  return match ? String(match[1] || '').trim() : '';
}

function allMatches(html, rx) {
  return [...html.matchAll(rx)].map((match) => String(match[1] || '').trim()).filter(Boolean);
}

function extractLinks(html) {
  return allMatches(html, /<a\b[^>]*href="([^"]+)"/gi)
    .map((href) => href.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\//, ''))
    .filter((href) => href.endsWith('.html'));
}

function extractArticle(file) {
  const html = readTextIfExists(path.join(ROOT, file));
  const text = stripTags(html);
  const title = stripTags(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const h1 = stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const metaDescription = firstMatch(html, /<meta\s+name="description"\s+content="([^"]*)"/i)
    || firstMatch(html, /<meta\s+content="([^"]*)"\s+name="description"/i);
  const h2 = allMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(stripTags);
  const links = extractLinks(html);
  const citations = allMatches(html, /<a\b[^>]*href="(https?:\/\/[^"]+)"/gi);
  const pdfLinks = allMatches(html, /<a\b[^>]*href="([^"]+\.pdf)"/gi);
  const imageSources = allMatches(html, /<(?:source|img)\b[^>]*(?:src|srcset)="([^"]+)"/gi);
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const captions = tables.filter((table) => /<caption\b/i.test(table)).length;
  const faqItems = [...html.matchAll(/<h3[^>]*>\s*(?:<[^>]+>)*([^<\?]+\?)[\s\S]*?<\/h3>/gi)].length;
  const dateModified = firstMatch(html, /"dateModified"\s*:\s*"([^"]+)"/i)
    || firstMatch(html, /property="article:modified_time"\s+content="([^"]+)"/i);
  const topic = detectHubTopic(`${file} ${title} ${h1} ${h2.join(' ')}`);
  return {
    file,
    url: `${SITE_ORIGIN}/${file}`,
    title,
    h1,
    meta_description: metaDescription,
    word_count: text ? text.split(/\s+/).length : 0,
    h2,
    links,
    internal_link_count: links.length,
    inbound_link_count: 0,
    citations,
    citation_count: citations.length,
    has_quick_answer: /id="quick-answer"|class="quick-answer"|Szybka odpowiedź/i.test(html),
    has_evidence_box: /fitpo50-growth-evidence|Evidence Box|Co mówią badania/i.test(html),
    has_doctor_box: /Kiedy do lekarza/i.test(html),
    has_faq: /FAQPage|Najczęstsze pytania|FAQ/i.test(html),
    faq_items: faqItems,
    has_blogposting: /"@type"\s*:\s*"BlogPosting"/i.test(html),
    has_breadcrumbs: /"@type"\s*:\s*"BreadcrumbList"/i.test(html),
    has_speakable: /"@type"\s*:\s*"SpeakableSpecification"/i.test(html),
    pdf_links: pdfLinks,
    image_sources: imageSources,
    table_count: tables.length,
    tables_with_caption: captions,
    date_modified: dateModified,
    topic,
    html,
  };
}

function detectHubTopic(value) {
  const haystack = String(value || '').toLowerCase();
  let best = { id: 'inne', score: 0 };
  for (const hub of HUBS) {
    const score = hub.keywords.reduce((sum, keyword) => sum + (haystack.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    if (score > best.score) best = { id: hub.id, score };
  }
  return best.score > 0 ? best.id : 'inne';
}

function buildCorpus() {
  const articles = findHtmlFiles(ROOT)
    .map(extractArticle)
    .filter((article) => /class="article-page"|class='article-page'|"@type"\s*:\s*"BlogPosting"/i.test(article.html));
  const byFile = new Map(articles.map((article) => [article.file, article]));
  for (const source of articles) {
    for (const link of source.links) {
      if (!byFile.has(link)) continue;
      byFile.get(link).inbound_link_count += 1;
    }
  }
  return articles.map(({ html, ...article }) => article);
}

function parseCsvRows(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    return row;
  });
}

function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function rowValue(row, candidates) {
  const lookup = new Map(Object.entries(row || {}).map(([key, value]) => [normalizeHeaderKey(key), value]));
  for (const candidate of candidates) {
    const value = lookup.get(normalizeHeaderKey(candidate));
    if (value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function toNumber(value) {
  return Number(String(value || '0').replace('%', '').replace(',', '.')) || 0;
}

function readGscPages() {
  const contract = inspectGscInput(GSC_INPUT_DIR, { strictPeriods: true });
  if (contract.blocking) {
    throw new Error(`GSC_DATA_CONTRACT_FAILED: ${contract.errors.join(' | ')}`);
  }
  const rows = parseCsvRows(path.join(GSC_INPUT_DIR, 'pages.csv'));
  const map = new Map();
  for (const row of rows) {
    const page = row.Strona || row.Page || row.URL || Object.values(row)[0] || '';
    const file = pageToFile(page);
    if (!file) continue;
    map.set(file, {
      clicks: toNumber(row.Kliknięcia || row.Clicks),
      impressions: toNumber(row.Wyświetlenia || row.Impressions),
      ctr: toNumber(row.CTR),
      position: toNumber(row.Pozycja || row.Position),
    });
  }
  return map;
}

function findReportFiles(dirs, patterns) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '_site') continue;
      const full = path.join(dir, entry.name);
      if (full === REPORT_DIR || full.startsWith(`${REPORT_DIR}${path.sep}`)) continue;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      out.push(full);
    }
  }
  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    const before = out.length;
    walk(dir);
    for (const file of out.slice(before)) {
      const rel = path.relative(dir, file);
      const name = rel.toLowerCase();
      if (!patterns.some((rx) => rx.test(name))) continue;
    }
  }
  return unique(out.filter((file) => patterns.some((rx) => rx.test(path.basename(file).toLowerCase())))).sort();
}

function pageToFile(page) {
  const value = String(page || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\/+/, '') || 'index.html';
  } catch (_) {
    return value.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '') || 'index.html';
  }
}

function scoreArticle(article, gsc) {
  const issues = [];
  if (!article.has_quick_answer) issues.push('brak szybkiej odpowiedzi');
  if (!article.has_evidence_box) issues.push('brak Evidence Box');
  if (!article.has_doctor_box) issues.push('brak bloku Kiedy do lekarza');
  if (article.faq_items < 4) issues.push('FAQ ma mniej niż 4 pytania');
  if (article.citation_count < 4) issues.push('mniej niż 4 źródła zewnętrzne');
  if (article.inbound_link_count < 3) issues.push('słabe linkowanie przychodzące');
  if (article.table_count > article.tables_with_caption) issues.push('tabela bez caption');
  if (!article.pdf_links.length) issues.push('brak PDF do udostępniania');
  if (!article.has_blogposting) issues.push('brak BlogPosting');
  if (!article.has_breadcrumbs) issues.push('brak BreadcrumbList');

  const impressions = Number(gsc?.impressions || 0);
  const position = Number(gsc?.position || 0);
  const ctr = Number(gsc?.ctr || 0);
  const gscOpportunity = (position >= 4 && position <= 20 ? 35 : 0)
    + Math.min(25, Math.log10(Math.max(1, impressions)) * 10)
    + (impressions > 20 && ctr < 1 ? 20 : 0);
  const structuralOpportunity = Math.min(50, issues.length * 7);
  return Math.round(gscOpportunity + structuralOpportunity);
}

function buildGrowthData() {
  const articles = buildCorpus();
  const gscPages = readGscPages();
  const enriched = articles.map((article) => {
    const gsc = gscPages.get(article.file) || null;
    const score = scoreArticle(article, gsc);
    return {
      ...article,
      gsc,
      growth_score: score,
      recommended_actions: buildActions(article, gsc),
    };
  }).sort((a, b) => b.growth_score - a.growth_score || (b.gsc?.impressions || 0) - (a.gsc?.impressions || 0));
  return {
    generated_at: nowWarsawIso(),
    source: {
      html_articles: enriched.length,
      gsc_pages_loaded: gscPages.size,
    },
    articles: enriched,
  };
}

function shouldSkipShareableTable(article) {
  return article.file === 'wino-i-miesnie-po-50.html';
}

function buildActions(article, gsc) {
  const actions = [];
  if (!article.has_evidence_box) actions.push({ type: 'manual-evidence-box', label: 'Przygotuj ręcznie Evidence Box dopasowany do artykułu i pokaż tekst do akceptacji.' });
  if (!article.has_doctor_box) actions.push({ type: 'manual-safety-note', label: 'Jeśli temat tego wymaga, przygotuj ręcznie blok bezpieczeństwa bez generycznego straszenia lekarzem.' });
  if (article.faq_items < 4) actions.push({ type: 'faq', label: 'Rozbuduj FAQ do minimum 4 konkretnych pytań.' });
  if (article.citation_count < 4) actions.push({ type: 'citations', label: 'Uzupełnij źródła i przypisz je do konkretnych claimów.' });
  if (article.inbound_link_count < 3) actions.push({ type: 'internal-links', label: 'Zaproponuj 2–3 linki kontekstowe i pokaż zdania do akceptacji.' });
  if (!article.pdf_links.length) actions.push({ type: 'pdf', label: 'Zaproponuj PDF/checklistę do link earningu, jeśli pasuje do intencji artykułu.' });
  if (!article.table_count && !shouldSkipShareableTable(article)) actions.push({ type: 'manual-shareable-table', label: 'Zaproponuj cytowalną tabelę HTML tylko jeśli realnie pomaga czytelnikowi.' });
  if (!article.table_count && shouldSkipShareableTable(article)) actions.push({ type: 'no-table-by-intent', label: 'Nie dodawaj tabeli: dla tego artykułu lepszy jest krótki praktyczny blok bez moralizowania.' });
  if (gsc && Number(gsc.position || 0) >= 4 && Number(gsc.position || 0) <= 20) actions.push({ type: 'gsc-refresh', label: 'Po zatwierdzonych zmianach zgłoś URL do GSC: pozycja 4–20.' });
  if (article.topic !== 'inne') actions.push({ type: 'hub-link', label: `Zaproponuj naturalne zdanie linkujące do huba: ${article.topic}.` });
  return actions;
}

function buildReport() {
  const data = buildGrowthData();
  const top = data.articles.slice(0, 20);
  const summary = {
    generated_at: data.generated_at,
    articles_total: data.articles.length,
    gsc_pages_loaded: data.source.gsc_pages_loaded,
    priority_articles: top.map((article, index) => ({
      nr: index + 1,
      file: article.file,
      title: article.h1 || article.title,
      topic: article.topic,
      score: article.growth_score,
      gsc: article.gsc,
      actions: article.recommended_actions.map((action) => action.type),
    })),
    next_commands: [
      'npm run growth:report',
      'npm run growth:gsc-refresh',
      'npm run growth:evidence-plan',
      'npm run growth:hubs',
      'npm run growth:link-assets',
      'npm run popraw-seo',
      'npm run growth:verify',
    ],
  };
  writeJson(path.join(REPORT_DIR, 'growth-report.json'), { ...summary, articles: data.articles });
  writeReportMarkdown(summary, top, path.join(REPORT_DIR, 'growth-report.md'));
  return summary;
}

function writeReportMarkdown(summary, articles, file) {
  const lines = [];
  lines.push('# FitPo50 Growth Machine');
  lines.push('');
  lines.push(`Wygenerowano: ${summary.generated_at}`);
  lines.push('');
  lines.push('## Priorytet');
  articles.forEach((article, index) => {
    lines.push(`${index + 1}. ${article.file}`);
    lines.push(`   - temat: ${article.topic}; score: ${article.growth_score}`);
    lines.push(`   - GSC: impr ${article.gsc?.impressions || 0}, klik ${article.gsc?.clicks || 0}, CTR ${article.gsc?.ctr || 0}, pozycja ${article.gsc?.position || 0}`);
    article.recommended_actions.slice(0, 5).forEach((action) => lines.push(`   - ${action.label}`));
  });
  lines.push('');
  lines.push('## Komendy');
  summary.next_commands.forEach((cmd) => lines.push(`- \`${cmd}\``));
  writeText(file, lines.join('\n'));
}

function buildAiAudit() {
  const articles = buildCorpus();
  const prompts = [];
  for (let i = 0; prompts.length < 50; i += 1) {
    const base = AI_QUESTION_BANK[i % AI_QUESTION_BANK.length];
    const topicArticles = articles.filter((article) => article.topic === base[0]).slice(0, 6);
    prompts.push({
      id: `AIQ-${String(prompts.length + 1).padStart(2, '0')}`,
      topic: base[0],
      question: base[1],
      manual_check: ['Google AI Overview', 'Gemini', 'ChatGPT', 'Perplexity'],
      record_fields: ['czy FitPo50 cytowane?', 'cytowane domeny', 'brakujący format odpowiedzi', 'URL do poprawy'],
      candidate_fitpo50_urls: topicArticles.map((article) => article.url),
    });
  }
  const report = {
    generated_at: nowWarsawIso(),
    purpose: 'Lista pytań do ręcznego/automatycznego monitoringu cytowań AI.',
    note: 'Narzędzie nie udaje zapytań do zamkniętych modeli. Przygotowuje kolejkę testów i tabelę wyników.',
    prompts,
  };
  writeJson(path.join(REPORT_DIR, 'ai-visibility-audit.json'), report);
  writeAiAuditMarkdown(report, path.join(REPORT_DIR, 'ai-visibility-audit.md'));
  return report;
}

function writeAiAuditMarkdown(report, file) {
  const lines = ['# AI Visibility Audit', '', `Wygenerowano: ${report.generated_at}`, ''];
  report.prompts.forEach((item) => {
    lines.push(`## ${item.id} — ${item.topic}`);
    lines.push(`- Pytanie: ${item.question}`);
    lines.push(`- Sprawdź: ${item.manual_check.join(', ')}`);
    if (item.candidate_fitpo50_urls.length) lines.push(`- Kandydaci FitPo50: ${item.candidate_fitpo50_urls.join(', ')}`);
    lines.push('- Zapisz: cytowane domeny, czy FitPo50 występuje, czego brakuje.');
    lines.push('');
  });
  writeText(file, lines.join('\n'));
}

function buildGscRefresh() {
  const data = buildGrowthData();
  const candidates = data.articles
    .filter((article) => article.gsc)
    .filter((article) => Number(article.gsc.position || 0) >= 4 || Number(article.gsc.impressions || 0) > 0)
    .slice(0, 30)
    .map((article, index) => ({
      nr: index + 1,
      file: article.file,
      title: article.h1 || article.title,
      score: article.growth_score,
      gsc: article.gsc,
      refresh_tasks: article.recommended_actions
        .filter((action) => ['gsc-refresh', 'evidence-box', 'faq', 'internal-links'].includes(action.type))
        .map((action) => action.label),
      gsc_submit_after_change: [article.url],
    }));
  const report = {
    generated_at: nowWarsawIso(),
    candidates,
  };
  writeJson(path.join(REPORT_DIR, 'gsc-refresh.json'), report);
  writeSimpleListMarkdown('GSC Refresh Sprint', candidates, path.join(REPORT_DIR, 'gsc-refresh.md'));
  return report;
}

function normalizeReportFile(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(www\.)?fitpo50\.pl\//i, '').replace(/^\//, '');
}

function shouldIgnoreSeoFile(file) {
  return TEMPORARILY_IGNORED_SEO_FILES.has(normalizeReportFile(file));
}

function isNoindexSeoFile(file) {
  const normalized = normalizeReportFile(file);
  if (!normalized || !normalized.endsWith('.html')) return false;
  const html = readTextIfExists(path.join(ROOT, normalized));
  const robots = html.match(/<meta\s+name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  return Boolean(robots && /\bnoindex\b/i.test(robots[1]));
}

function shouldExcludeSeoFile(file) {
  return shouldIgnoreSeoFile(file) || isNoindexSeoFile(file);
}

function actionCardsFromSeoAio(seoAio) {
  const cards = Array.isArray(seoAio?.top_action_cards) ? seoAio.top_action_cards : [];
  return cards.filter((card) => !shouldExcludeSeoFile(card.file || card.url));
}

function firstCardsByType(cards, types, limit) {
  const typeSet = new Set(types);
  return cards
    .filter((card) => typeSet.has(card.type))
    .slice(0, limit)
    .map((card) => ({
      file: card.file,
      url: card.url,
      type: card.type,
      priority: card.priority,
      segment: card.segment,
      decision: card.editorial_decision,
      query: card.keyword_plan?.primary || '',
      clicks: Number(card.gsc?.clicks || 0),
      impressions: Number(card.gsc?.impressions || 0),
      ctr: Number(card.gsc?.ctr || 0),
      position: Number(card.gsc?.position || 0),
      seo: Number(card.score?.seo || 0),
      aeo: Number(card.score?.aeo || 0),
      geo: Number(card.score?.geo || 0),
      aio: Number(card.score?.aio || 0),
      tasks: Array.isArray(card.tasks) ? card.tasks.slice(0, 4) : [],
      source_links: Array.isArray(card.internal_link_sources)
        ? card.internal_link_sources.slice(0, 4).map((item) => item.from).filter(Boolean)
          .filter((file) => !shouldExcludeSeoFile(file))
        : [],
      promotion_urls: Array.isArray(card.promotion_urls)
        ? card.promotion_urls.filter((url) => !shouldExcludeSeoFile(url)).slice(0, 6)
        : [],
    }));
}

function normalizeText(value) {
  return stripTags(String(value || ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inspectInternalLinkSuggestion(sourceFile, targetFile, anchor, placement) {
  const source = normalizeReportFile(sourceFile);
  const target = normalizeReportFile(targetFile);
  const html = readTextIfExists(path.join(ROOT, source));
  if (!html) {
    return { source_exists: false, target_already_linked: false, duplicate_anchor_in_section: false };
  }
  const targetAlreadyLinked = extractLinks(html).includes(target);
  const anchorNeedle = normalizeText(anchor);
  const placementNeedle = normalizeText(placement);
  let duplicateAnchorInSection = false;
  if (anchorNeedle) {
    const sections = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)].map((match) => match[0]);
    const relevantSections = sections.filter((section) => {
      const text = normalizeText(section);
      return (placementNeedle && text.includes(placementNeedle)) || text.includes(anchorNeedle);
    });
    duplicateAnchorInSection = relevantSections.some((section) => [...section.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
      .some((match) => normalizeText(match[1]) === anchorNeedle));
  }
  return {
    source_exists: true,
    target_already_linked: targetAlreadyLinked,
    duplicate_anchor_in_section: duplicateAnchorInSection,
  };
}

function analyzeSourceLinkSuggestions(card, limit = 4) {
  const targetFile = normalizeReportFile(card?.file || card?.url);
  const candidates = Array.isArray(card?.internal_link_sources) ? card.internal_link_sources : [];
  const accepted = [];
  const rejected = [];
  for (const item of candidates) {
    if (!item?.from || shouldIgnoreSeoFile(item.from)) continue;
    const suggestion = {
      from: normalizeReportFile(item.from),
      anchor: item.anchor || '',
      placement: item.placement || '',
      score: Number(item.score || 0),
      inbound_strength: Number(item.inbound_strength || 0),
    };
    const inspection = inspectInternalLinkSuggestion(suggestion.from, targetFile, suggestion.anchor, suggestion.placement);
    if (inspection.target_already_linked || inspection.duplicate_anchor_in_section) {
      rejected.push({
        ...suggestion,
        reason: inspection.target_already_linked ? 'TARGET_ALREADY_LINKED' : 'ANCHOR_ALREADY_LINKED_IN_SECTION',
      });
      continue;
    }
    if (accepted.length < limit) accepted.push(suggestion);
  }
  return {
    accepted,
    rejected,
    scanned: candidates.length,
  };
}

function cardAbsoluteUrl(card) {
  if (card?.url) return card.url;
  const file = normalizeReportFile(card?.file);
  return file ? `${SITE_ORIGIN}/${file}` : '';
}

function approvalGscSnapshot(card) {
  const gsc = card?.gsc || {};
  return {
    query: card?.keyword_plan?.primary || '',
    clicks: Number(gsc.clicks || 0),
    impressions: Number(gsc.impressions || 0),
    ctr: Number(gsc.ctr || 0),
    position: Number(gsc.position || 0),
  };
}

function inclusiveDays(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end || end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function estimatedTrafficGain(gsc, sourceWindowDays) {
  const days = Number(sourceWindowDays || 30);
  const scale = days > 0 ? 30 / days : 1;
  const monthlyImpressions = Number(gsc.impressions || 0) * scale;
  const monthlyClicks = Number(gsc.clicks || 0) * scale;
  const rawGain = monthlyImpressions * 0.05 - monthlyClicks;
  return {
    target_ctr: 0.05,
    source_window_days: days,
    monthly_impressions: Number(monthlyImpressions.toFixed(1)),
    current_monthly_clicks: Number(monthlyClicks.toFixed(1)),
    estimated_monthly_click_gain: Number(Math.max(0, rawGain).toFixed(1)),
    raw_monthly_click_gain: Number(rawGain.toFixed(1)),
    formula: '(monthly_impressions * 0.05) - current_monthly_clicks',
    note: Number(Math.max(0, rawGain).toFixed(1)) > 0 ? 'POTENCJAŁ_WZROSTU' : 'BRAK_ISTOTNEGO_UPSIDE_PRZY_CTR_5_PROC',
  };
}

function textContract(value, min, max, requireSentenceEnd = false, emptyStatus = 'NOT_PROPOSED') {
  const text = String(value || '').trim();
  if (!text) return { status: emptyStatus, length: 0, min, max, ends_with_sentence_mark: null };
  const endsWithSentenceMark = /[.!?]$/.test(text);
  const valid = text.length >= min && text.length <= max && (!requireSentenceEnd || endsWithSentenceMark);
  return {
    status: valid ? 'PASS' : 'FIX_REQUIRED',
    length: text.length,
    min,
    max,
    ends_with_sentence_mark: requireSentenceEnd ? endsWithSentenceMark : null,
  };
}

function cleanStrategyDraftValue(value) {
  return String(value || '')
    .replace(/\s+\(\d+\s+znak(?:i|ów|ow)?\)\s*$/i, '')
    .trim();
}

function proposalContentContract(card, article) {
  const proposedHeadline = cleanStrategyDraftValue(card?.proposed_h1 || card?.proposed_headline || card?.proposed_title || '');
  const proposedMeta = cleanStrategyDraftValue(card?.proposed_meta_description || '');
  return {
    rule: 'Każda gotowa propozycja musi przejść walidację przed pokazaniem użytkownikowi.',
    headline_required_range: '55-70',
    meta_description_required_range: '145-160 i znak końca zdania',
    current: {
      headline: textContract(article?.h1 || '', 55, 70, false, 'MISSING'),
      meta_description: textContract(article?.meta_description || '', 145, 160, true, 'MISSING'),
    },
    proposed: {
      headline: textContract(proposedHeadline, 55, 70),
      meta_description: textContract(proposedMeta, 145, 160, true),
    },
  };
}

function approvalReason(card, kind) {
  const gsc = approvalGscSnapshot(card);
  const pageSignal = gsc.query
    ? `fraza "${gsc.query}"`
    : 'sygnał na poziomie URL-a (query nieujawnione lub zanonimizowane)';
  if (kind === 'BOOST') {
    return `Google już testuje ten URL: ${pageSignal}, ${gsc.impressions} wyświetleń, CTR ${gsc.ctr}%, pozycja ${gsc.position}. Priorytetem jest precyzyjny CTR i linkowanie wewnętrzne, nie przepisywanie całego artykułu.`;
  }
  if (kind === 'ROKUJE') {
    return `URL ma ${pageSignal}: ${gsc.impressions} wyświetleń, ${gsc.clicks} kliknięć i pozycję ${gsc.position}. Działanie wynika z diagnozy ${card?.diagnosis || card?.type || 'GSC'}, a brak ujawnionego query nie usuwa strony z kolejki.`;
  }
  if (kind === 'MONITORING') {
    if (isRecentlyTouched(approvalCardKey(card), new Map([[approvalCardKey(card), { date_modified: card?.date_modified }]]), 14)) {
      return `URL jest po świeżej zmianie z ${card?.date_modified || 'nieustaloną datą'}: nie wykonujemy kolejnej edycji przed checkpointem KPI. Obserwujemy wyświetlenia, kliknięcia, CTR i pozycję, a cooldown nie usuwa strony z raportu.`;
    }
    return `URL ma diagnozę ${card?.diagnosis || card?.type || 'VISIBLE_LOW_SIGNAL'} i nie wymaga teraz kolejnej edycji. Chronimy działającą intencję, sprawdzamy trend 7/28/90 dni i wracamy do zmian dopiero po mierzalnym spadku lub nowej szansie.`;
  }
  const scores = card?.score || {};
  return `Strona ma słabą lub zerową widoczność i wynik SEO/AEO/GEO/AIO ${Number(scores.seo || 0)}/${Number(scores.aeo || 0)}/${Number(scores.geo || 0)}/${Number(scores.aio || 0)}. Najpierw trzeba zbudować konkretną odpowiedź, źródła i linkowanie, a dopiero potem zgłaszać URL w GSC.`;
}

function approvalPreparationChecklist(kind, query) {
  if (kind === 'BOOST') {
    return [
      `title i meta opis dopasowane do frazy "${query || 'fraza z GSC'}" oraz intencji czytelnika 50+`,
      'każda propozycja H1/headline: 55-70 znaków; meta description: 145-160 znaków i pełny znak końca zdania',
      'krótki lead albo doprecyzowanie pierwszego akapitu: dla kogo jest tekst, co rozwiązuje i jaki jest warunek bezpieczeństwa',
      '2-4 linki kontekstowe z podanych źródeł, z naturalnym anchorem w zdaniu',
      'aktualizacja dateModified, sitemap, _site i llms-full.txt dopiero po zatwierdzeniu treści',
      'sprawdzenie, czy tekst ma własny konkret FitPo50: liczba, przykład, próg, tabela albo obserwacja autora',
    ];
  }
  if (kind === 'ROKUJE') {
    return [
      `sprawdzenie, dlaczego Google pokazał stronę na frazę/temat "${query || 'dane z GSC'}", ale jeszcze nie daje stałych kliknięć`,
      'doprecyzowanie title/meta i pierwszej odpowiedzi tak, żeby użytkownik od razu widział konkretny wynik, próg, koszt, plan albo ryzyko',
      'każda propozycja H1/headline: 55-70 znaków; meta description: 145-160 znaków i pełny znak końca zdania',
      'dodanie 2-4 linków z liderów i centrów tematycznych, jeśli anchor naprawdę pasuje do zdania',
      'uzupełnienie FAQ tylko o pytania wynikające z GSC/PAA/autocomplete albo treści artykułu',
      'po zmianie dopisanie URL-a do kolejki GSC razem z najważniejszymi źródłami linkowania wewnętrznego',
    ];
  }
  if (kind === 'MONITORING') {
    return [
      'nie zmieniać title, meta, leadu ani FAQ bez nowego sygnału GSC lub zakończenia checkpointu',
      'porównać baseline z wynikami po 7, 14 i 28 dniach: wyświetlenia, kliknięcia, CTR i pozycję',
      'sprawdzić, czy główny URL zachowuje przypisaną intencję i czy drugi URL nie zaczyna go kanibalizować',
      'przenieść stronę do BOOST, ROKUJE albo NAPRAWA dopiero na podstawie nowych danych',
    ];
  }
  return [
    'quick answer 45-65 słów z konkretną odpowiedzią i warunkiem bezpieczeństwa, bez pustych obietnic',
    'każda propozycja H1/headline: 55-70 znaków; meta description: 145-160 znaków i pełny znak końca zdania',
    'FAQ z realnych pytań użytkowników albo danych GSC/PAA/autocomplete; bez zmyślonych problemów',
    'minimum 4 realne źródła URL do najważniejszych twierdzeń, bez halucynacji i bez źródeł dekoracyjnych',
    'własny konkret: przykład osoby 50+, próg/liczba, tabela albo obserwacja FitPo50, jeśli temat na to pozwala',
    '2-4 linki wewnętrzne z podanych źródeł oraz zgłoszenie URL w GSC po publikacji',
  ];
}

function approvalChecklistForCard(card, kind) {
  const actionType = String(card?.required_action?.action_type || '');
  if (actionType === 'PROTECT_AND_SCALE') {
    return [
      'nie zmieniać title, meta ani leadu działającego targetu bez sygnału spadku',
      `zweryfikować wskazane źródła linków: ${(card?.required_action?.source_files || []).join(', ') || 'INSUFFICIENT_DATA'}`,
      'przygotować wyłącznie naturalne zdania z linkiem na stronach źródłowych',
      'mierzyć target w oknach 7/28/90 dni',
    ];
  }
  if (actionType === 'URL_INSPECTION' || actionType === 'INDEXATION_REPAIR') {
    return [
      'odczytać verdict, coverageState, indexingState, canonical i lastCrawlTime z URL Inspection',
      'najpierw usunąć wskazany problem techniczny; nie zmieniać treści bez rozpoznanej przyczyny',
      'po walidacji sprawdzić sitemap i linki z konkretnych stron źródłowych',
    ];
  }
  return approvalPreparationChecklist(kind, card?.keyword_plan?.primary || '');
}

function buildSeoApprovalItem(card, kind, index, articleByFile, sourceWindowDays) {
  const file = normalizeReportFile(card?.file || card?.url);
  const linkAnalysis = analyzeSourceLinkSuggestions(card, 4);
  const links = linkAnalysis.accepted;
  const url = cardAbsoluteUrl(card);
  const gsc = approvalGscSnapshot(card);
  return {
    id: `${kind} ${index}`,
    kind,
    file,
    url,
    type: card?.type || '',
    priority: card?.priority || '',
    segment: card?.segment || '',
    decision: card?.editorial_decision || '',
    diagnosis: card?.diagnosis || card?.type || '',
    required_action: card?.required_action || null,
    execution_status: isRecentlyTouched(file, articleByFile, 14) ? 'COOLDOWN_MONITORUJ' : 'READY_FOR_APPROVAL',
    query: card?.keyword_plan?.primary || '',
    reason: approvalReason(card, kind),
    gsc,
    gsc_windows: card?.gsc_windows || {},
    index_inspection: card?.index_inspection || {},
    estimated_traffic_gain: estimatedTrafficGain(gsc, sourceWindowDays),
    content_contract: proposalContentContract(card, articleByFile?.get?.(file)),
    current_title: articleByFile?.get?.(file)?.title || '',
    current_meta_description: articleByFile?.get?.(file)?.meta_description || '',
    proposed_title: cleanStrategyDraftValue(card?.proposed_title || ''),
    proposed_meta_description: cleanStrategyDraftValue(card?.proposed_meta_description || ''),
    scores: {
      seo: Number(card?.score?.seo || 0),
      aeo: Number(card?.score?.aeo || 0),
      geo: Number(card?.score?.geo || 0),
      aio: Number(card?.score?.aio || 0),
    },
    prepare_before_edit: approvalChecklistForCard(card, kind),
    report_tasks: Array.isArray(card?.tasks) ? card.tasks.slice(0, 5) : [],
    internal_link_suggestions: links,
    internal_link_guard: {
      status: linkAnalysis.rejected.length ? 'DUPLICATES_REMOVED' : 'PASS',
      scanned: linkAnalysis.scanned,
      accepted: links.length,
      rejected: linkAnalysis.rejected,
    },
    gsc_submit_after_change: [
      url,
      ...links.slice(0, 3).map((item) => `${SITE_ORIGIN}/${item.from}`),
    ].filter(Boolean),
  };
}

function approvalCardKey(card) {
  return normalizeReportFile(card?.file || card?.url);
}

function buildStrategyOpportunityCard(item, actionCardsByFile) {
  const file = normalizeReportFile(item?.file);
  const strategyAction = actionCardsByFile?.get?.(file) || {};
  return {
    type: 'P1_PROMISING_GSC',
    score: {
      total: Number(item?.score || 0),
      seo: 0,
      aeo: 0,
      geo: 0,
      aio: 0,
    },
    url: file ? `${SITE_ORIGIN}/${file}` : '',
    file,
    priority: item?.priority || 'P1_ROKUJE',
    segment: 'GSC_OPPORTUNITY_NOT_LEADER',
    editorial_decision: 'wzmocnić po liderach',
    gsc: {
      clicks: Number(item?.clicks || 0),
      impressions: Number(item?.impressions || 0),
      ctr: Number(item?.ctr || 0),
      position: Number(item?.position || 0),
      status: 'strategy_report',
    },
    keyword_plan: {
      primary: item?.query || '',
      secondary: [],
      intents: [],
      useful_queries: item?.query ? [item.query] : [],
    },
    tasks: [
      'Nie przepisywać całego artykułu: najpierw doprecyzować odpowiedź pod frazę, która już ma wyświetlenia.',
      'Sprawdzić title/meta/lead: użytkownik ma od razu zrozumieć, co dostaje i dla kogo jest tekst.',
      'Dodać linki z centrum albo mocniejszych artykułów tylko wtedy, gdy anchor pasuje do kontekstu zdania.',
      'Po publikacji zgłosić URL w GSC i wrócić do KPI po 7/14/28 dniach.',
    ],
    proposed_title: strategyAction.proposed_title || '',
    proposed_meta_description: strategyAction.proposed_meta_description || '',
    internal_link_sources: [],
  };
}

function buildFullCoverageCard(item, actionCardsByFile) {
  const file = normalizeReportFile(item?.path || item?.url);
  const strategyAction = actionCardsByFile?.get?.(file) || {};
  return {
    type: 'FULL_COVERAGE_ARTICLE',
    file,
    url: item?.url || (file ? `${SITE_ORIGIN}/${file}` : ''),
    priority: item?.priority || '',
    segment: item?.visibility_segment || '',
    diagnosis: item?.diagnosis || 'UNCLASSIFIED',
    date_modified: item?.date_modified || '',
    editorial_decision: item?.editorial_decision || '',
    gsc: item?.gsc || {},
    gsc_windows: item?.gsc_windows || {},
    index_inspection: item?.index_inspection || {},
    required_action: item?.required_action || {},
    keyword_plan: {
      primary: item?.keywords?.evidence?.[0]?.query || item?.keywords?.primary || '',
      secondary: item?.keywords?.secondary || [],
      intents: item?.keywords?.intents || [],
      useful_queries: (item?.keywords?.evidence || []).map((row) => row.query).filter(Boolean),
      evidence: item?.keywords?.evidence || [],
    },
    tasks: item?.required_action?.required_change ? [item.required_action.required_change] : [],
    internal_link_sources: (item?.topology?.suggested_sources || []).map((source) => ({
      from: source.from,
      anchor: source.anchor,
      placement: source.placement,
    })),
    proposed_title: strategyAction.proposed_title || '',
    proposed_meta_description: strategyAction.proposed_meta_description || '',
    score: { total: Number(item?.opportunity_score || 0), seo: 0, aeo: 0, geo: 0, aio: 0 },
  };
}

function seoBasketForCard(card, articleByFile) {
  const file = approvalCardKey(card);
  if (isRecentlyTouched(file, articleByFile, 14)) return 'MONITORING';
  const diagnosis = String(card?.diagnosis || '');
  if (diagnosis === 'CTR_GAP_TOP10') return 'BOOST';
  if (diagnosis.startsWith('ZERO_VISIBILITY_') || ['DEEP_31_100', 'DECLINING'].includes(diagnosis)) return 'NAPRAWA';
  if (['VISIBLE_CLICKING', 'VISIBLE_LOW_SIGNAL'].includes(diagnosis)) return 'MONITORING';
  return 'ROKUJE';
}

function mergeStrategyActionDraft(card, actionCardsByFile) {
  const file = normalizeReportFile(card?.file || card?.url);
  const strategyAction = actionCardsByFile?.get?.(file);
  if (!strategyAction) return card;
  return {
    ...card,
    proposed_title: card.proposed_title || strategyAction.proposed_title || '',
    proposed_meta_description: card.proposed_meta_description || strategyAction.proposed_meta_description || '',
    strategy_action_card: strategyAction,
  };
}

function looksLikeArticleTitle(query) {
  const value = String(query || '').trim();
  if (!value) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (value.length > 70) return true;
  if (value.includes('?') && words.length > 6) return true;
  if (value.includes(':') && words.length > 5) return true;
  if (words.length > 10) return true;
  return false;
}

function articleAgeDays(file, articleByFile) {
  const article = articleByFile?.get?.(normalizeReportFile(file));
  const modified = parseDate(article?.date_modified);
  if (!modified) return null;
  return Math.max(0, Math.floor((Date.now() - modified.getTime()) / 86400000));
}

function isRecentlyTouched(file, articleByFile, days = 14) {
  const age = articleAgeDays(file, articleByFile);
  return age !== null && age <= days;
}

function hasPromisingSignal(card) {
  const gsc = approvalGscSnapshot(card);
  const query = gsc.query || '';
  const impressions = Number(gsc.impressions || 0);
  const clicks = Number(gsc.clicks || 0);
  const position = Number(gsc.position || 0);
  if (query && looksLikeArticleTitle(query)) return false;
  if (!query && (impressions > 0 || clicks > 0 || position > 0)) return true;
  if (clicks > 0 && position > 0 && position <= 40) return true;
  if (impressions >= 20 && position > 3 && position <= 30) return true;
  if (impressions >= 8 && position > 3 && position <= 12) return true;
  return false;
}

function promisingScore(card) {
  const gsc = approvalGscSnapshot(card);
  const position = Number(gsc.position || 0);
  const impressions = Number(gsc.impressions || 0);
  const clicks = Number(gsc.clicks || 0);
  const positionBoost = position > 0 && position <= 20 ? 60 - position : 0;
  const typeBoost = card?.type === 'P0_PUSH_TO_PAGE_ONE' ? 30 : card?.type === 'P2_SCALE_WINNER' ? 20 : 10;
  return impressions + clicks * 20 + positionBoost + typeBoost;
}

function buildPromisingSeoCards(cards, contentStrategy, excludedKeys, articleByFile) {
  const candidates = [];
  const seen = new Set(excludedKeys);
  const actionCardsByFile = new Map((contentStrategy?.action_cards || [])
    .map((item) => [normalizeReportFile(item.file), item])
    .filter(([file]) => Boolean(file)));
  const add = (card) => {
    const key = approvalCardKey(card);
    if (!key || seen.has(key) || shouldIgnoreSeoFile(key)) return;
    if (isRecentlyTouched(key, articleByFile, 14)) return;
    if (!hasPromisingSignal(card)) return;
    seen.add(key);
    candidates.push(card);
  };

  if (contentStrategy?.status === 'OK') {
    (contentStrategy.opportunity_leaderboard || [])
      .map((item) => buildStrategyOpportunityCard(item, actionCardsByFile))
      .filter((card) => Number(card.gsc.impressions || 0) > 0 || Number(card.gsc.position || 0) > 0)
      .forEach(add);
  }

  cards
    .filter((card) => ['P0_PUSH_TO_PAGE_ONE', 'P1_GROWTH', 'P2_SCALE_WINNER', 'P2_CORE_SUPPORT_LINKING'].includes(card.type))
    .filter((card) => Number(card.gsc?.impressions || 0) > 0 || Number(card.gsc?.position || 0) > 0)
    .sort((a, b) => promisingScore(b) - promisingScore(a))
    .forEach(add);

  return candidates
    .sort((a, b) => promisingScore(b) - promisingScore(a))
    .slice(0, 8);
}

function buildSeoApprovalWave(cards, contentStrategy, articleByFile, sourceWindowDays, fullCoverageReport) {
  const actionCardsByFile = new Map((contentStrategy?.action_cards || [])
    .map((item) => [normalizeReportFile(item.file), item])
    .filter(([file]) => Boolean(file)));
  const fullCoverageItems = (Array.isArray(fullCoverageReport?.priority_map) ? fullCoverageReport.priority_map : [])
    .filter((item) => item?.type === 'article')
    .filter((item) => !shouldIgnoreSeoFile(normalizeReportFile(item.path || item.url)))
    .map((item) => buildFullCoverageCard(item, actionCardsByFile));
  const enrichedCards = fullCoverageItems.length
    ? fullCoverageItems
    : cards.map((card) => mergeStrategyActionDraft(card, actionCardsByFile));
  const boostCards = [];
  const promisingCards = [];
  const repairCards = [];
  const monitoringCards = [];
  if (fullCoverageItems.length) {
    for (const card of enrichedCards) {
      const basket = seoBasketForCard(card, articleByFile);
      if (basket === 'BOOST') boostCards.push(card);
      else if (basket === 'NAPRAWA') repairCards.push(card);
      else if (basket === 'MONITORING') monitoringCards.push(card);
      else promisingCards.push(card);
    }
  } else {
    const legacyBoost = enrichedCards.filter((card) => card.type === 'P0_PUSH_TO_PAGE_ONE');
    const legacyRepair = enrichedCards.filter((card) => ['P1_BUILD_DISCOVERY', 'P1_AEO_UPGRADE'].includes(card.type));
    const excludedKeys = new Set([...legacyBoost, ...legacyRepair].map(approvalCardKey).filter(Boolean));
    boostCards.push(...legacyBoost);
    repairCards.push(...legacyRepair);
    promisingCards.push(...buildPromisingSeoCards(enrichedCards, contentStrategy, excludedKeys, articleByFile));
  }
  const allCards = [...boostCards, ...promisingCards, ...repairCards, ...monitoringCards];
  const allKeys = new Set(allCards.map(approvalCardKey).filter(Boolean));
  const inventoryCount = fullCoverageItems.length || allCards.length;
  const boostItems = boostCards.map((card, index) => buildSeoApprovalItem(card, 'BOOST', index + 1, articleByFile, sourceWindowDays));
  const promisingItems = promisingCards.map((card, index) => buildSeoApprovalItem(card, 'ROKUJE', index + 1, articleByFile, sourceWindowDays));
  const repairItems = repairCards.map((card, index) => buildSeoApprovalItem(card, 'NAPRAWA', index + 1, articleByFile, sourceWindowDays));
  const monitoringItems = monitoringCards.map((card, index) => buildSeoApprovalItem(card, 'MONITORING', index + 1, articleByFile, sourceWindowDays));
  const approvalItems = [...boostItems, ...promisingItems, ...repairItems, ...monitoringItems];
  return {
    status: 'AWAITING_USER_APPROVAL',
    rule: 'Każdy artykuł trafia dokładnie do jednego koszyka: BOOST, ROKUJE, NAPRAWA albo MONITORING. Cooldown przenosi do MONITORING, ale nigdy nie usuwa URL-a z raportu.',
    no_generic_text: true,
    coverage_contract: {
      status: inventoryCount === allKeys.size ? 'PASS' : 'FAIL',
      article_inventory: inventoryCount,
      assigned_actions: allKeys.size,
      omitted_articles: fullCoverageItems.filter((card) => !allKeys.has(approvalCardKey(card))).map((card) => card.file),
      basket_counts: {
        BOOST: boostCards.length,
        ROKUJE: promisingCards.length,
        NAPRAWA: repairCards.length,
        MONITORING: monitoringCards.length,
      },
    },
    approval_examples: [
      'popraw BOOST 1',
      'popraw ROKUJE 1',
      'popraw BOOST 1 NAPRAWA 2',
      'popraw 1 2 3 - agent ma doprecyzować, które ID użytkownik wybiera, jeśli numeracja jest niejednoznaczna',
    ],
    visibility_click_objective: {
      rule: 'Priorytet raportu: zwiększyć liczbę URL-i z wyświetleniami, a następnie liczbę kliknięć; oceny techniczne są wskaźnikami pomocniczymi.',
      visible_articles: approvalItems.filter((item) => Number(item.gsc.impressions || 0) > 0).length,
      clicking_articles: approvalItems.filter((item) => Number(item.gsc.clicks || 0) > 0).length,
      zero_visibility_articles: approvalItems.filter((item) => Number(item.gsc.impressions || 0) === 0).length,
      estimated_monthly_click_gain: Number(approvalItems
        .filter((item) => item.kind !== 'MONITORING')
        .reduce((sum, item) => sum + Number(item.estimated_traffic_gain?.estimated_monthly_click_gain || 0), 0)
        .toFixed(1)),
    },
    boost: boostItems,
    promising: promisingItems,
    repair: repairItems,
    monitoring: monitoringItems,
    full_portfolio: allCards.map((card) => ({
      file: approvalCardKey(card),
      basket: seoBasketForCard(card, articleByFile),
      diagnosis: card.diagnosis || card.type,
      required_action: card.required_action?.required_change || card.tasks?.[0] || 'INSUFFICIENT_DATA',
      cooldown_status: isRecentlyTouched(approvalCardKey(card), articleByFile, 14) ? 'COOLDOWN_MONITORUJ' : 'READY_FOR_APPROVAL',
    })),
  };
}

function ageDaysFrom(dateValue, generatedAt) {
  const date = parseDate(dateValue);
  const generatedDate = parseDate(generatedAt) || new Date();
  if (!date) return null;
  return Math.max(0, Math.floor((generatedDate.getTime() - date.getTime()) / 86400000));
}

function gscMetrics(article) {
  return {
    clicks: Number(article?.gsc?.clicks || 0),
    impressions: Number(article?.gsc?.impressions || 0),
    ctr: Number(article?.gsc?.ctr || 0),
    position: Number(article?.gsc?.position || 0),
  };
}

function metricDelta(baseline, current) {
  return {
    impressions: Number((Number(current.impressions || 0) - Number(baseline.impressions || 0)).toFixed(2)),
    clicks: Number((Number(current.clicks || 0) - Number(baseline.clicks || 0)).toFixed(2)),
    ctr_percentage_points: Number((Number(current.ctr || 0) - Number(baseline.ctr || 0)).toFixed(2)),
    position_improvement: Number((Number(baseline.position || 0) - Number(current.position || 0)).toFixed(2)),
  };
}

function buildDeltaCheckpoint(day, ageDays, checkpointDate, baseline, current) {
  if (ageDays < day) return { status: 'WAITING', date: checkpointDate, delta: null };
  return {
    status: 'READY',
    date: checkpointDate,
    delta: metricDelta(baseline, current),
  };
}

function buildSeoWorkHistory(articles, generatedAt, previousHistory, sourceWindowDays) {
  const generatedDate = parseDate(generatedAt) || new Date();
  const previousItems = Array.isArray(previousHistory?.urls)
    ? previousHistory.urls
    : (previousHistory?.recently_modified || []);
  const previousByFile = new Map(previousItems.map((item) => [item.file, item]));
  const snapshotDay = generatedDate.toISOString().slice(0, 10);
  const urls = (articles || [])
    .map((article) => {
      const ageDays = ageDaysFrom(article.date_modified, generatedAt);
      const modified = parseDate(article.date_modified);
      const previous = previousByFile.get(article.file);
      const sameWave = previous?.date_modified === article.date_modified;
      const current = gscMetrics(article);
      const baseline = sameWave ? previous.baseline : current;
      const previousSnapshots = sameWave
        ? (Array.isArray(previous.snapshots) && previous.snapshots.length
          ? previous.snapshots
          : [{ generated_at: previousHistory?.generated_at || generatedAt, gsc: previous.baseline }])
        : [];
      const snapshots = previousSnapshots.filter((snapshot) => String(snapshot.generated_at || '').slice(0, 10) !== snapshotDay);
      snapshots.push({ generated_at: generatedAt, source_window_days: sourceWindowDays, gsc: current });
      const checkpoints = buildKpiCheckpoints(article.date_modified);
      const previousEvents = Array.isArray(previous?.change_events) ? previous.change_events : [];
      const changeDetected = Boolean(previous && previous.date_modified !== article.date_modified);
      const changeEvents = [...previousEvents];
      if (!previous) {
        changeEvents.push({
          detected_at: generatedAt,
          date_modified: article.date_modified || 'MISSING',
          baseline: current,
          status: 'OBSERVED_BASELINE',
        });
      } else if (changeDetected) {
        changeEvents.push({
          detected_at: generatedAt,
          previous_date_modified: previous.date_modified || 'MISSING',
          date_modified: article.date_modified || 'MISSING',
          baseline: current,
          status: 'DEPLOYMENT_CHANGE_DETECTED',
        });
      }
      return {
        file: article.file,
        url: article.url,
        date_modified: article.date_modified || 'MISSING',
        age_days: ageDays,
        baseline,
        current,
        snapshots: snapshots.slice(-12),
        checkpoints,
        delta_tracker: {
          day_7: buildDeltaCheckpoint(7, ageDays, checkpoints?.day_7, baseline, current),
          day_14: buildDeltaCheckpoint(14, ageDays, checkpoints?.day_14, baseline, current),
          day_28: buildDeltaCheckpoint(28, ageDays, checkpoints?.day_28, baseline, current),
        },
        change_detected_this_run: changeDetected,
        change_events: changeEvents.slice(-24),
        cooldown_until: modified ? addDays(modified, 14) : null,
      };
    })
    .sort((a, b) => String(a.file).localeCompare(String(b.file), 'pl'));

  const recent = urls
    .filter((item) => item.age_days !== null && item.age_days <= 45)
    .sort((a, b) => a.age_days - b.age_days);

  return {
    generated_at: generatedAt,
    purpose: 'Trwała pamięć każdego URL-a: baseline, zmiany dateModified, snapshoty oraz checkpointy 7/14/28 dni.',
    cooldown_days: 14,
    source_window_days: sourceWindowDays,
    coverage: {
      article_inventory: (articles || []).length,
      urls_with_history: urls.length,
      omitted_urls: (articles || []).filter((article) => !urls.some((item) => item.file === article.file)).map((article) => article.file),
    },
    urls,
    recently_modified: recent.map((item) => {
      const checkpoints = item.checkpoints || {};
      const checkpointDates = Object.values(checkpoints).filter(Boolean);
      const next = checkpointDates.find((date) => parseDate(date) >= generatedDate) || 'SPRAWDŹ_TERAZ';
      return {
        ...item,
        next_review: next,
        status: item.age_days <= 14 ? 'COOLDOWN_MONITORUJ' : 'MOŻNA_ROZWAŻYĆ_PO_KPI',
      };
    }),
  };
}

function deploymentEvidenceForArticle(file, expectedDateModified) {
  const normalizedFile = normalizeReportFile(file);
  const slug = normalizedFile.replace(/\.html$/i, '');
  const sourcePath = path.join(ROOT, normalizedFile);
  const mirrorPath = path.join(ROOT, '_site', normalizedFile);
  const pdfPath = path.join(ROOT, 'assets', 'pdf', `${slug}.pdf`);
  const mirrorPdfPath = path.join(ROOT, '_site', 'assets', 'pdf', `${slug}.pdf`);
  const sitemap = readTextIfExists(path.join(ROOT, 'sitemap.xml'));
  const sourceHtml = readTextIfExists(sourcePath);
  const mirrorHtml = readTextIfExists(mirrorPath);
  const sourceModified = firstMatch(sourceHtml, /"dateModified"\s*:\s*"([^"]+)"/i)
    || firstMatch(sourceHtml, /property="article:modified_time"\s+content="([^"]+)"/i);
  const mirrorModified = firstMatch(mirrorHtml, /"dateModified"\s*:\s*"([^"]+)"/i)
    || firstMatch(mirrorHtml, /property="article:modified_time"\s+content="([^"]+)"/i);
  const sitemapBlock = sitemap.match(new RegExp(`<url>[\\s\\S]*?<loc>${escapeRegex(`${SITE_ORIGIN}/${normalizedFile}`)}</loc>[\\s\\S]*?</url>`, 'i'))?.[0] || '';
  const sitemapLastmod = firstMatch(sitemapBlock, /<lastmod>([^<]+)<\/lastmod>/i);
  const expectedDay = String(expectedDateModified || '').slice(0, 10);
  const checks = {
    source_html: fs.existsSync(sourcePath),
    site_html: fs.existsSync(mirrorPath),
    date_modified_source: Boolean(expectedDateModified && sourceModified === expectedDateModified),
    date_modified_site: Boolean(expectedDateModified && mirrorModified === expectedDateModified),
    sitemap_lastmod: Boolean(expectedDay && sitemapLastmod === expectedDay),
    pdf_source: fs.existsSync(pdfPath),
    pdf_site: fs.existsSync(mirrorPdfPath),
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'DEPLOYED_AND_VALIDATED' : 'DEPLOYMENT_INCOMPLETE',
    checks,
    source_date_modified: sourceModified || null,
    site_date_modified: mirrorModified || null,
    sitemap_lastmod: sitemapLastmod || null,
  };
}

function buildGscAfterChangeQueue(approvalWave, seoWorkHistory, previousQueue, deploymentInspector = deploymentEvidenceForArticle) {
  const groups = [
    ['BOOST', approvalWave?.boost || []],
    ['ROKUJE', approvalWave?.promising || []],
    ['NAPRAWA', approvalWave?.repair || []],
    ['MONITORING', approvalWave?.monitoring || []],
  ];
  const approvalByFile = new Map();
  for (const [kind, groupItems] of groups) {
    for (const item of groupItems) {
      approvalByFile.set(item.file, { kind, item });
    }
  }
  const preserved = (previousQueue?.items || []).filter((item) => item.status === 'READY_TO_SUBMIT');
  const byDeployment = new Map(preserved.map((item) => [`${item.file}|${item.date_modified}`, item]));
  for (const historyItem of seoWorkHistory?.urls || []) {
    if (!historyItem.change_detected_this_run) continue;
    const approval = approvalByFile.get(historyItem.file);
    if (!approval) continue;
    const deployment = deploymentInspector(historyItem.file, historyItem.date_modified);
    if (deployment.status !== 'DEPLOYED_AND_VALIDATED') continue;
    const urls = unique((approval.item.gsc_submit_after_change || [])
      .filter(Boolean)
      .filter((url) => !shouldExcludeSeoFile(url)));
    byDeployment.set(`${historyItem.file}|${historyItem.date_modified}`, {
      id: approval.item.id,
      kind: approval.kind,
      file: historyItem.file,
      target_url: approval.item.url,
      date_modified: historyItem.date_modified,
      detected_at: seoWorkHistory.generated_at,
      submit_urls: urls,
      status: 'READY_TO_SUBMIT',
      deployment_evidence: deployment,
      gsc_note: 'Kolejka powstała po wykryciu realnej zmiany dateModified oraz potwierdzeniu HTML, _site, sitemap i PDF.',
      monitor_after: 'KPI 7/14/28 dni od dateModified: impressions, clicks, CTR, position, AI impressions i engagement.',
    });
  }
  const items = [...byDeployment.values()];
  const submitTargets = unique(items.flatMap((item) => item.submit_urls || []));
  return {
    generated_at: nowWarsawIso(),
    status: items.length ? 'READY_AFTER_REAL_DEPLOYMENT' : 'EMPTY_AWAITING_REAL_DEPLOYMENT',
    rule: 'Do kolejki trafia wyłącznie URL z nowym dateModified i potwierdzonym kompletem: source HTML, _site HTML, sitemap lastmod oraz PDF w obu lokalizacjach.',
    submit_targets: submitTargets,
    items,
    planned_candidates_count: approvalByFile.size,
  };
}

function normalizeCannibalQuery(query) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cannibalWinnerScore(card) {
  const gsc = approvalGscSnapshot(card);
  const position = Number(gsc.position || 0);
  return Number(gsc.clicks || 0) * 1000
    + Number(gsc.impressions || 0)
    + (position > 0 ? Math.max(0, 50 - position) : 0);
}

function intentEvidenceForCard(card) {
  const evidence = Array.isArray(card?.keyword_plan?.evidence) ? card.keyword_plan.evidence : [];
  if (evidence.length) {
    return evidence
      .filter((row) => row?.query && !looksLikeArticleTitle(row.query))
      .map((row) => ({
        query: row.query,
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        position: Number(row.position || 0),
        source: 'GSC_DISCLOSED_QUERY',
        confidence: 'CONFIRMED_SIGNAL',
      }));
  }
  const primary = String(card?.keyword_plan?.primary || '').trim();
  if (!primary) return [];
  return [{
    query: primary,
    clicks: Number(card?.gsc?.clicks || 0),
    impressions: Number(card?.gsc?.impressions || 0),
    position: Number(card?.gsc?.position || 0),
    source: 'ARTICLE_TOPIC_FALLBACK',
    confidence: 'RESEARCH_REQUIRED',
  }];
}

function buildCannibalizationMap(cards, contentStrategy, previousMap) {
  const byQuery = new Map();
  for (const card of cards || []) {
    for (const evidence of intentEvidenceForCard(card)) {
      const key = normalizeCannibalQuery(evidence.query);
      if (!key || key.length < 4) continue;
      if (!byQuery.has(key)) byQuery.set(key, []);
      byQuery.get(key).push({ card, evidence });
    }
  }

  const conflicts = [];
  const intentOwners = [];
  const previousOwners = new Map((previousMap?.intent_owners || []).map((item) => [item.intent_key, item]));
  for (const [query, group] of byQuery.entries()) {
    const uniqueGroup = group.filter((entry, index, arr) => arr.findIndex((other) => approvalCardKey(other.card) === approvalCardKey(entry.card)) === index);
    const sorted = uniqueGroup.sort((a, b) => {
      const evidenceScore = (entry) => entry.evidence.clicks * 1000 + entry.evidence.impressions + (entry.evidence.position > 0 ? Math.max(0, 50 - entry.evidence.position) : 0);
      return evidenceScore(b) - evidenceScore(a) || cannibalWinnerScore(b.card) - cannibalWinnerScore(a.card);
    });
    const previousOwner = previousOwners.get(query);
    const preserved = previousOwner?.main_file
      ? sorted.find((entry) => approvalCardKey(entry.card) === previousOwner.main_file)
      : null;
    const winnerEntry = previousOwner?.owner_status === 'CONFIRMED' && preserved ? preserved : sorted[0];
    const winner = winnerEntry.card;
    const mainFile = normalizeReportFile(winner.file || winner.url);
    const displayQuery = winnerEntry.evidence.query || query;
    const supportingEntries = sorted.filter((entry) => approvalCardKey(entry.card) !== mainFile);
    const supportingPages = supportingEntries.map(({ card }) => {
      const file = normalizeReportFile(card.file || card.url);
      const inspection = inspectInternalLinkSuggestion(file, mainFile, displayQuery, '');
      return {
        file,
        anchor: displayQuery,
        suggested_html: inspection.target_already_linked
          ? ''
          : `<a href="${escapeHtml(mainFile)}">${escapeHtml(displayQuery)}</a>`,
        status: inspection.target_already_linked ? 'LINK_ALREADY_EXISTS' : 'READY_FOR_APPROVAL',
      };
    });
    const owner = {
      intent_key: query,
      intent: displayQuery,
      main_file: mainFile,
      main_url: cardAbsoluteUrl(winner),
      owner_status: previousOwner?.owner_status === 'CONFIRMED' && preserved ? 'CONFIRMED' : 'AUTO_PROPOSED',
      evidence_source: winnerEntry.evidence.source,
      confidence: winnerEntry.evidence.confidence,
      supporting_files: supportingPages.map((item) => item.file),
      first_seen_at: previousOwner?.first_seen_at || nowWarsawIso(),
      last_seen_at: nowWarsawIso(),
    };
    intentOwners.push(owner);
    if (uniqueGroup.length < 2) continue;
    conflicts.push({
      query: displayQuery,
      main_url: cardAbsoluteUrl(winner),
      main_file: mainFile,
      supporting_files: supportingPages.map((item) => item.file),
      supporting_pages: supportingPages,
      recommendation_status: 'AWAITING_USER_APPROVAL',
      action: 'Główny URL trzyma title/meta pod tę frazę. Strony wspierające linkują do niego i nie wzmacniają tego samego title pod identyczną intencję.',
      canonical_note: 'To rekomendacja właściciela intencji, nie automatyczna zmiana rel=canonical.',
      metrics: sorted.map((card) => ({
        file: normalizeReportFile(card.card.file || card.card.url),
        impressions: Number(card.evidence.impressions || 0),
        clicks: Number(card.evidence.clicks || 0),
        position: Number(card.evidence.position || 0),
      })),
    });
  }

  return {
    generated_at: nowWarsawIso(),
    status: conflicts.length || contentStrategy?.cannibalization?.length ? 'CHECK' : 'NO_STRONG_CONFLICTS',
    conflicts,
    intent_owners: intentOwners.sort((a, b) => a.intent.localeCompare(b.intent, 'pl')),
    coverage: {
      intents: intentOwners.length,
      confirmed_by_gsc: intentOwners.filter((item) => item.evidence_source === 'GSC_DISCLOSED_QUERY').length,
      research_required: intentOwners.filter((item) => item.confidence === 'RESEARCH_REQUIRED').length,
      conflicts: conflicts.length,
    },
    strategy_notes: (contentStrategy?.cannibalization || []).slice(0, 14),
    rule: 'Przy poprawkach nie wzmacniaj dwóch URL-i pod tę samą intencję. Wybierz stronę główną, a drugą potraktuj jako wsparcie linkiem.',
  };
}

function percentPart(value, total) {
  if (!Number(total || 0)) return 0;
  return Number(((Number(value || 0) / Number(total)) * 100).toFixed(1));
}

function percentChange(current, previous) {
  if (!Number(previous || 0)) return Number(current || 0) > 0 ? 100 : 0;
  return Number((((Number(current || 0) - Number(previous)) / Number(previous)) * 100).toFixed(1));
}

function formatSigned(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

function buildBroadSeoConclusions(fullCoverageReport, weeklyApi, indexCoverage) {
  const articles = (Array.isArray(fullCoverageReport?.priority_map) ? fullCoverageReport.priority_map : [])
    .filter((item) => item.type === 'article');
  if (!articles.length) {
    return { status: 'INSUFFICIENT_DATA', reason: 'Brak pełnej mapy artykułów GSC.', summary: {}, priorities: [] };
  }
  const countDiagnosis = (pattern) => articles.filter((item) => pattern.test(String(item.diagnosis || ''))).length;
  const visible = articles.filter((item) => Number(item?.gsc?.impressions || 0) > 0);
  const zeroVisibility = articles.filter((item) => Number(item?.gsc?.impressions || 0) === 0);
  const indexedZero = zeroVisibility.filter((item) => item.diagnosis === 'ZERO_VISIBILITY_INDEXED');
  const indexProblem = zeroVisibility.filter((item) => item.diagnosis !== 'ZERO_VISIBILITY_INDEXED');
  const unknownToGoogle = zeroVisibility.filter((item) => item.diagnosis === 'ZERO_VISIBILITY_UNKNOWN_TO_GOOGLE');
  const unknownInLocalSitemap = unknownToGoogle.filter((item) => item.in_sitemap === true).length;
  const unknownWithInboundLinks = unknownToGoogle.filter((item) => Number(item?.topology?.inbound_links || 0) > 0).length;
  const sortedByClicks = [...visible].sort((a, b) => Number(b.gsc.clicks || 0) - Number(a.gsc.clicks || 0) || Number(b.gsc.impressions || 0) - Number(a.gsc.impressions || 0));
  const totalClicks = visible.reduce((sum, item) => sum + Number(item.gsc.clicks || 0), 0);
  const top10Clicks = sortedByClicks.slice(0, 10).reduce((sum, item) => sum + Number(item.gsc.clicks || 0), 0);
  const categories = {};
  for (const item of articles) {
    const category = String(item.category || 'other');
    if (!categories[category]) categories[category] = { total: 0, visible: 0, zero: 0, clicks: 0, impressions: 0, ctr: 0 };
    categories[category].total += 1;
    categories[category].clicks += Number(item.gsc.clicks || 0);
    categories[category].impressions += Number(item.gsc.impressions || 0);
    if (Number(item.gsc.impressions || 0) > 0) categories[category].visible += 1;
    else categories[category].zero += 1;
  }
  Object.values(categories).forEach((category) => {
    category.ctr = category.impressions > 0 ? Number(((category.clicks / category.impressions) * 100).toFixed(2)) : 0;
  });
  const windows = weeklyApi?.reporting_windows || {};
  const day28Current = windows.day_28?.property?.current || {};
  const day28Previous = windows.day_28?.property?.previous || {};
  const imageRows = weeklyApi?.secondary_search_types_28d?.image?.current_pages || [];
  const imageClicks = imageRows.reduce((sum, item) => sum + Number(item.clicks || 0), 0);
  const imageImpressions = imageRows.reduce((sum, item) => sum + Number(item.impressions || 0), 0);
  const checked = Array.isArray(indexCoverage?.checked) ? indexCoverage.checked : [];
  const inspectionBreakdown = checked.reduce((acc, item) => {
    const key = String(item.coverage_state || 'UNKNOWN');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const priorities = [
    {
      rank: 1,
      area: 'ODZYSKANIE_INDEKSACJI',
      evidence: `${indexProblem.length} artykułów ma 0 wyświetleń i nie ma potwierdzonej indeksacji: ${countDiagnosis(/CRAWLED_NOT_INDEXED/)} zeskanowanych, ${countDiagnosis(/UNKNOWN_TO_GOOGLE/)} nieznane Google, ${countDiagnosis(/DISCOVERED_NOT_INDEXED/)} wykryte bez indeksacji. Wśród stron nieznanych Google ${unknownInLocalSitemap}/${unknownToGoogle.length} jest w lokalnej sitemapie, a ${unknownWithInboundLinks}/${unknownToGoogle.length} ma linki wewnętrzne.`,
      decision: 'Dla stron nieznanych sprawdzić publiczne HTTP 200, canonical i ostatni odczyt sitemap przez Google — same kolejne linki nie rozwiązują tej rozbieżności. Dla crawled/discovered ocenić unikalność intencji i jakość pierwszej odpowiedzi. Dopiero po naprawie zgłaszać URL.',
      urls: indexProblem.map((item) => item.url),
    },
    {
      rank: 2,
      area: 'INDEKSOWANE_BEZ_WIDOCZNOSCI',
      evidence: `${indexedZero.length} artykułów jest w indeksie, ale nie ma wyświetleń. To problem dopasowania do intencji lub konkurencyjności, a nie samego indeksowania.`,
      decision: 'Dla każdego wykonać research query/PAA, wyznaczyć jedną główną intencję, dopasować title/H1/lead i dołożyć linki z właściwego klastra. Nie ponawiać samego zgłoszenia bez zmiany strony.',
      urls: indexedZero.map((item) => item.url),
    },
    {
      rank: 3,
      area: 'NAJSZYBSZY_WZROST_KLIKNIEC',
      evidence: `${countDiagnosis(/CTR_GAP_TOP10/)} artykuły mają lukę CTR w TOP 10, a ${countDiagnosis(/POSITION_11_30/)} są na pozycjach 11-30.`,
      decision: 'Najpierw poprawiać snippet i zgodność leadu dla TOP 10, następnie odpowiedź oraz linkowanie dla pozycji 11-30. To największa obecna pula wzrostu bez tworzenia nowych artykułów.',
      urls: articles.filter((item) => /CTR_GAP_TOP10|POSITION_11_30/.test(String(item.diagnosis || ''))).map((item) => item.url),
    },
    {
      rank: 4,
      area: 'DYWERSYFIKACJA_RUCHU',
      evidence: `Dziesięć najlepszych artykułów daje ${percentPart(top10Clicks, totalClicks)}% kliknięć artykułowych.`,
      decision: 'Chronić liderów, ale linkować z nich do stron 11-30 i indeksowanych bez widoczności. Celem jest wzrost liczby URL-i zdobywających kliknięcia, nie dalsza koncentracja na kilku liderach.',
      urls: sortedByClicks.slice(0, 10).map((item) => item.url),
    },
  ];
  if (categories.mity) {
    priorities.push({
      rank: 5,
      area: 'KLASTER_MITY',
      evidence: `Mity: widoczne ${categories.mity.visible}/${categories.mity.total}, kliknięcia ${categories.mity.clicks}, wyświetlenia ${categories.mity.impressions}.`,
      decision: 'Potraktować Mity jako klaster naprawczy: sprawdzić indeksację pięciu niewidocznych tekstów, wzmacniać je z odpowiadających tematów zdrowie/jedzenie i dopasować nagłówki do pytań, które ludzie faktycznie wpisują.',
      urls: articles.filter((item) => item.category === 'mity').map((item) => item.url),
    });
  }
  if (imageImpressions > 0) {
    priorities.push({
      rank: 6,
      area: 'GOOGLE_IMAGES',
      evidence: `Google Images w 28 dni: ${Math.round(imageClicks)} kliknięcia i ${Math.round(imageImpressions)} wyświetleń na ${imageRows.length} URL-ach.`,
      decision: 'W artykułach już widocznych w Images sprawdzić zgodność hero z intencją, opis alt, podpis i kontekst wokół obrazu. Nie generować nowych grafik bez wskazania URL-i z wyświetleniami i niskim CTR.',
      urls: imageRows.sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0)).slice(0, 20).map((item) => item.page),
    });
  }
  return {
    status: 'OK',
    goal: 'Więcej zindeksowanych artykułów, więcej URL-i z wyświetleniami i większa liczba kliknięć z Google.',
    summary: {
      articles: articles.length,
      visible_articles: visible.length,
      visible_share_pct: percentPart(visible.length, articles.length),
      zero_visibility_articles: zeroVisibility.length,
      indexed_zero_visibility: indexedZero.length,
      indexation_problem: indexProblem.length,
      ctr_gap_top10: countDiagnosis(/CTR_GAP_TOP10/),
      position_11_30: countDiagnosis(/POSITION_11_30/),
      deep_31_100: countDiagnosis(/DEEP_31_100/),
      clicking_articles: articles.filter((item) => Number(item?.gsc?.clicks || 0) > 0).length,
      top10_click_share_pct: percentPart(top10Clicks, totalClicks),
      day_28: {
        clicks: Number(day28Current.total_clicks || 0),
        clicks_change_pct: percentChange(day28Current.total_clicks, day28Previous.total_clicks),
        impressions: Number(day28Current.total_impressions || 0),
        impressions_change_pct: percentChange(day28Current.total_impressions, day28Previous.total_impressions),
        position: Number(Number(day28Current.avg_position || 0).toFixed(2)),
        previous_position: Number(Number(day28Previous.avg_position || 0).toFixed(2)),
      },
      categories,
      inspection_breakdown: inspectionBreakdown,
    },
    priorities,
    operating_rule: 'Każdy kolejny popraw-seo ma ponownie policzyć te wnioski. Zmiana globalnego priorytetu wymaga zmiany danych, nie opinii automatu.',
  };
}

function buildUnifiedInsights() {
  const reportsDir = path.join(ROOT, 'data', 'reports');
  const growthData = buildGrowthData();
  const articleByFile = new Map((growthData.articles || []).map((article) => [article.file, article]));
  const seoAio = readJsonIfExists(path.join(reportsDir, 'seo-aio-command-center.json'));
  const quickAnswer = readJsonIfExists(path.join(reportsDir, 'quick-answer-backlog.json'));
  const linkTopology = readJsonIfExists(path.join(reportsDir, 'link-topology-report.json'));
  const cwv = readJsonIfExists(path.join(reportsDir, 'cwv-budget.json'));
  const doctor = readJsonIfExists(path.join(reportsDir, 'fitpo50-doctor.json'));
  const aiVisibility = readJsonIfExists(path.join(reportsDir, 'ai-visibility-monitor.json'));
  const gscSubmitQueueText = readTextIfExists(path.join(reportsDir, 'gsc-submit-queue.txt'));
  const generativeAi = readJsonIfExists(path.join(REPORT_DIR, 'gsc-generative-ai.json'));
  const snippetControls = readJsonIfExists(path.join(REPORT_DIR, 'snippet-controls-audit.json'));
  const postDeployKpi = readJsonIfExists(path.join(REPORT_DIR, 'post-deploy-kpi-plan.json'));
  const originality = readJsonIfExists(path.join(REPORT_DIR, 'originality-score.json'));
  const contentStrategy = readGscContentStrategyReport();
  const gscWeekly = readJsonIfExists(path.join(GSC_INPUT_DIR, 'gsc-weekly-report.json'));
  const gscWeeklyApi = readJsonIfExists(path.join(GSC_INPUT_DIR, 'gsc-weekly-report-api.json'));
  const fullCoverageReport = readJsonIfExists(path.join(GSC_INPUT_DIR, 'gsc-priority-map.json'));
  const indexCoverage = readJsonIfExists(path.join(GSC_INPUT_DIR, 'gsc-indexing-coverage.json'));

  const cards = actionCardsFromSeoAio(seoAio);
  const currentRange = seoAio?.data_quality?.weekly_api_ranges?.current || {};
  const sourceWindowDays = inclusiveDays(currentRange.start, currentRange.end) || 30;
  const previousHistory = readSeoState('popraw-seo-historia.json')
    || readJsonIfExists(path.join(REPORT_DIR, 'popraw-seo-historia.json'));
  const previousQueue = readSeoState('popraw-seo-gsc-po-zmianach.json')
    || readJsonIfExists(path.join(REPORT_DIR, 'popraw-seo-gsc-po-zmianach.json'));
  const previousCannibalizationMap = readSeoState('popraw-seo-kanibalizacja.json')
    || readJsonIfExists(path.join(REPORT_DIR, 'popraw-seo-kanibalizacja.json'));
  const generatedAt = nowWarsawIso();
  const approvalWave = buildSeoApprovalWave(cards, contentStrategy, articleByFile, sourceWindowDays, fullCoverageReport);
  const historyArticles = (fullCoverageReport?.priority_map || [])
    .filter((item) => item?.type === 'article')
    .map((item) => {
      const file = normalizeReportFile(item.path || item.url);
      return {
        ...(articleByFile.get(file) || {}),
        file,
        url: item.url || `${SITE_ORIGIN}/${file}`,
        date_modified: item.date_modified || articleByFile.get(file)?.date_modified || '',
        gsc: item.gsc || {},
      };
    });
  const seoWorkHistory = buildSeoWorkHistory(
    historyArticles.length ? historyArticles : (growthData.articles || []),
    generatedAt,
    previousHistory,
    sourceWindowDays,
  );
  const afterChangeGscQueue = buildGscAfterChangeQueue(approvalWave, seoWorkHistory, previousQueue);
  const actionCardsByFile = new Map((contentStrategy?.action_cards || [])
    .map((item) => [normalizeReportFile(item.file), item])
    .filter(([file]) => Boolean(file)));
  const intentCards = (fullCoverageReport?.priority_map || [])
    .filter((item) => item?.type === 'article')
    .map((item) => buildFullCoverageCard(item, actionCardsByFile));
  const cannibalizationMap = buildCannibalizationMap(
    intentCards.length ? intentCards : cards,
    contentStrategy,
    previousCannibalizationMap,
  );
  const broadSeoConclusions = buildBroadSeoConclusions(fullCoverageReport, gscWeeklyApi, indexCoverage);
  const portfolio = seoAio?.portfolio || {};
  const average = portfolio.average_scores || {};
  const waves = seoAio?.waves || {};
  const linkWeakPages = Array.isArray(linkTopology?.weak_pages)
    ? linkTopology.weak_pages
        .filter((item) => !String(item.target || '').startsWith('.agent/'))
        .filter((item) => !shouldIgnoreSeoFile(item.target))
        .filter((item) => !['article-template-bento.html', 'google4a31b58b207723ed.html', 'search.html'].includes(String(item.target || '')))
        .slice(0, 8)
    : [];
  const aiVisibilityRows = Array.isArray(aiVisibility) ? aiVisibility : [];
  const gscQueue = unique([
    ...gscSubmitQueueText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^https?:\/\//i.test(line))
      .filter((line) => !shouldExcludeSeoFile(line)),
    ...((contentStrategy.status === 'OK' ? contentStrategy.gsc_submit_queue : []) || []),
  ].filter((url) => !shouldExcludeSeoFile(url))).slice(0, 40);
  const doctorWarnings = Array.isArray(doctor?.checks)
    ? doctor.checks.filter((item) => item && item.ok === false).map((item) => ({
      label: item.label,
      level: item.level,
      details: item.details,
    }))
    : [];

  const insights = [];
  const measurementLayers = gscWeekly?.summary?.layers || null;
  if (measurementLayers?.pages?.current && measurementLayers?.disclosed_queries?.current) {
    const propertyMetrics = measurementLayers.property?.current;
    const primary = propertyMetrics || measurementLayers.pages.current;
    insights.push(`GSC — główny wynik: kliknięcia ${Math.round(primary.total_clicks || 0)}, wyświetlenia ${Math.round(primary.total_impressions || 0)}; ujawnione zapytania: ${Math.round(measurementLayers.disclosed_queries.current.total_clicks || 0)} / ${Math.round(measurementLayers.disclosed_queries.current.total_impressions || 0)}. Różnica wynika m.in. z anonimizacji zapytań.`);
  }
  if (portfolio.total_urls) {
    insights.push(`Portfel SEO/AIO obejmuje ${portfolio.total_urls} URL-i; średnie wyniki: SEO ${average.seo ?? 'brak'}, AEO ${average.aeo ?? 'brak'}, GEO ${average.geo ?? 'brak'}, AIO ${average.aio ?? 'brak'}.`);
  }
  if (Number(average.seo || 0) && Number(average.aeo || 0) && Number(average.seo) < Number(average.aeo)) {
    insights.push('Największa luka nie jest w schema/AI, tylko w klasycznym SEO: CTR, linkowanie, widoczność i dojście do pierwszej strony.');
  }
  if (quickAnswer && Number(quickAnswer.fail_count || 0) === 0) {
    insights.push(`Quick answers są domknięte: ${quickAnswer.fixed_count || 0}/${quickAnswer.total_articles || 0} artykułów spełnia kontrolę.`);
  }
  if (cwv?.summary && Number(cwv.summary.fail || 0) === 0 && Number(cwv.summary.warn || 0) === 0) {
    insights.push(`CWV lokalnie bez ostrzeżeń: ${cwv.summary.urls} testowanych URL-i, fail=0, warn=0.`);
  }
  if (aiVisibilityRows.some((row) => row.fitpo50Mentioned === false || row.fitpo50Linked === false)) {
    insights.push('AI visibility wymaga monitoringu: są tematy, gdzie odpowiedź AI jest dobra, ale FitPo50 nie pojawia się jako źródło.');
  }
  if (generativeAi?.status === 'OK') {
    insights.push(`GSC Generative AI: wykryto ${generativeAi.summary?.pages || 0} URL-i z AI impressions; te strony trzeba mierzyć osobno od klasycznego CTR.`);
  } else if (generativeAi && !generativeAi.parse_error) {
    insights.push('GSC Generative AI: brak eksportu albo brak dostępu w rollout; popraw-seo będzie gotowe, gdy raport pojawi się w Search Console.');
  }
  if (snippetControls && !snippetControls.parse_error) {
    if (snippetControls.status === 'REVIEW') {
      insights.push(`Snippet controls: ${snippetControls.summary?.review_count || 0} URL-i wymaga sprawdzenia pod noindex/nosnippet/max-snippet/data-nosnippet przed pracą AIO.`);
    } else {
      insights.push(`Snippet controls: PASS dla ${snippetControls.summary?.scanned_html || 0} plików HTML; brak restrykcji blokujących artykuły w snippetach.`);
    }
  }
  if (postDeployKpi?.candidates?.length) {
    insights.push(`KPI po wdrożeniu: ${postDeployKpi.candidates.length} URL-i ma plan kontroli 7/14/28 dni z Web GSC, AI impressions i zaangażowaniem.`);
  }
  if (originality?.average_score !== undefined) {
    insights.push(`Originality score: średnio ${originality.average_score}%; niskie wyniki oznaczają brak własnych danych, przykładów, progów albo assetów cytowalnych.`);
  }
  if (contentStrategy.status === 'OK') {
    const top = contentStrategy.opportunity_leaderboard[0];
    const topLine = top ? `${top.file}: query "${top.query}", impr ${top.impressions}, poz ${top.position}, score ${top.score}` : 'brak tabeli Opportunity Leaderboard';
    insights.push(`Zewnętrzny raport GSC ${contentStrategy.generated_date || path.basename(contentStrategy.path)} został uwzględniony; TOP Opportunity: ${topLine}.`);
  } else {
    insights.push(`Zewnętrzny raport GSC content strategy: brak pliku (${contentStrategy.expected_file}).`);
  }
  if (doctor?.status) {
    insights.push(`Doctor: ${doctor.status}. RED blokuje pracę, YELLOW oznacza ostrzeżenia operacyjne do przeczytania.`);
  }
  if (seoWorkHistory.recently_modified.length) {
    insights.push(`Pamięć poprawek: ${seoWorkHistory.recently_modified.length} URL-i było zmienianych w ostatnich 45 dniach; świeże strony są w cooldown i najpierw mierzymy KPI.`);
  }
  if (cannibalizationMap.status === 'CHECK') {
    insights.push(`Kanibalizacja: są sygnały do sprawdzenia (${cannibalizationMap.conflicts.length} grup z danych lokalnych, ${cannibalizationMap.strategy_notes.length} notatek z raportu strategii).`);
  }

  return {
    generated_at: nowWarsawIso(),
    ignored_today: Array.from(TEMPORARILY_IGNORED_SEO_FILES),
    source_reports: {
      seo_aio_command_center: Boolean(seoAio && !seoAio.parse_error),
      quick_answer_backlog: Boolean(quickAnswer && !quickAnswer.parse_error),
      link_topology: Boolean(linkTopology && !linkTopology.parse_error),
      cwv_budget: Boolean(cwv && !cwv.parse_error),
      fitpo50_doctor: Boolean(doctor && !doctor.parse_error),
      ai_visibility_monitor: Boolean(aiVisibility && !aiVisibility.parse_error),
      gsc_submit_queue: gscQueue.length > 0,
      gsc_generative_ai: Boolean(generativeAi && !generativeAi.parse_error),
      post_deploy_kpi_plan: Boolean(postDeployKpi && !postDeployKpi.parse_error),
      originality_score: Boolean(originality && !originality.parse_error),
      gsc_content_strategy: contentStrategy.status === 'OK',
      gsc_weekly_measurement: Boolean(gscWeekly && !gscWeekly.parse_error),
      gsc_full_coverage: Boolean(fullCoverageReport && !fullCoverageReport.parse_error),
      gsc_index_coverage: Boolean(indexCoverage && !indexCoverage.parse_error),
    },
    portfolio,
    waves: Object.fromEntries(Object.entries(waves).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])),
    key_insights: insights,
    gsc_priority: {
      push_to_page_one: firstCardsByType(cards, ['P0_PUSH_TO_PAGE_ONE'], 12),
      build_discovery: firstCardsByType(cards, ['P1_BUILD_DISCOVERY', 'P1_AEO_UPGRADE'], 12),
      scale_winners: firstCardsByType(cards, ['P2_SCALE_WINNER'], 8),
      core_support: firstCardsByType(cards, ['P2_CORE_SUPPORT_LINKING'], 8),
    },
    approval_wave: approvalWave,
    broad_seo_conclusions: broadSeoConclusions,
    seo_work_history: seoWorkHistory,
    gsc_after_change_queue: afterChangeGscQueue,
    cannibalization_map: cannibalizationMap,
    link_topology_attention: linkWeakPages.map((item) => ({
      file: item.target,
      inbound: item.inbound,
      suggested_sources: (item.suggested_sources || []).slice(0, 3).map((src) => src.src),
    })),
    ai_visibility_attention: aiVisibilityRows
      .filter((row) => row.fitpo50Mentioned === false || row.fitpo50Linked === false)
      .slice(0, 8)
      .map((row) => ({
        engine: row.engine,
        prompt: row.prompt,
        canonical_url: row.canonicalUrl,
        priority: row.priority,
        recommended_actions: row.recommendedActions || [],
      })),
    generative_ai_visibility: generativeAi && !generativeAi.parse_error ? {
      status: generativeAi.status,
      summary: generativeAi.summary,
      top_pages: (generativeAi.pages || []).slice(0, 10),
      source_files: generativeAi.source_files || [],
    } : null,
    snippet_controls: snippetControls && !snippetControls.parse_error ? {
      status: snippetControls.status,
      summary: snippetControls.summary,
      review: (snippetControls.review || []).slice(0, 12),
      intentional_noindex: (snippetControls.intentional_noindex || []).slice(0, 12),
    } : null,
    post_deploy_kpi: postDeployKpi && !postDeployKpi.parse_error ? {
      status: postDeployKpi.status,
      ai_report_status: postDeployKpi.ai_report_status,
      candidates: (postDeployKpi.candidates || []).slice(0, 12),
    } : null,
    originality_attention: originality && !originality.parse_error ? (originality.articles || [])
      .filter((item) => Number(item.score || 0) < 70)
      .slice(0, 12)
      .map((item) => ({
        file: item.file,
        topic: item.topic,
        score: item.score,
        gaps: item.gaps,
        recommendation: item.recommendation,
      })) : [],
    gsc_submit_queue: gscQueue,
    content_strategy: contentStrategy,
    gsc_measurement_layers: measurementLayers,
    operational_warnings: doctorWarnings,
  };
}

function buildEvidencePlan() {
  const data = buildGrowthData();
  const candidates = data.articles
    .filter((article) => !article.has_evidence_box || !article.has_doctor_box || article.citation_count < 4)
    .slice(0, 50)
    .map((article, index) => ({
      nr: index + 1,
      file: article.file,
      title: article.h1 || article.title,
      topic: article.topic,
      missing: [
        !article.has_evidence_box ? 'Evidence Box' : '',
        !article.has_doctor_box ? 'Kiedy do lekarza' : '',
        article.citation_count < 4 ? 'minimum 4 źródła' : '',
      ].filter(Boolean),
    }));
  const report = { generated_at: nowWarsawIso(), candidates };
  writeJson(path.join(REPORT_DIR, 'evidence-plan.json'), report);
  writeSimpleListMarkdown('Evidence Plan', candidates, path.join(REPORT_DIR, 'evidence-plan.md'));
  return report;
}

function buildHubsReport() {
  const data = buildGrowthData();
  const report = {
    generated_at: nowWarsawIso(),
    hubs: HUBS.map((hub) => {
      const exists = fs.existsSync(path.join(ROOT, hub.preferred_file));
      const articles = data.articles.filter((article) => article.topic === hub.id);
      const linkingToHub = exists ? articles.filter((article) => article.links.includes(hub.preferred_file)).map((article) => article.file) : [];
      return {
        id: hub.id,
        title: hub.title,
        preferred_file: hub.preferred_file,
        exists,
        article_count: articles.length,
        articles: articles.map((article) => article.file),
        articles_linking_to_hub: linkingToHub,
        missing_backlinks: exists ? articles.filter((article) => !article.links.includes(hub.preferred_file)).map((article) => article.file) : articles.map((article) => article.file),
        required_assets: hub.must_have_assets,
        recommendation: exists ? 'Uzupełnij linki zwrotne i assety huba.' : 'Utwórz hub jako centrum tematu i połącz z artykułami.',
      };
    }),
  };
  writeJson(path.join(REPORT_DIR, 'hubs-report.json'), report);
  writeHubsMarkdown(report, path.join(REPORT_DIR, 'hubs-report.md'));
  return report;
}

function writeHubsMarkdown(report, file) {
  const lines = ['# Huby Tematyczne', '', `Wygenerowano: ${report.generated_at}`, ''];
  report.hubs.forEach((hub) => {
    lines.push(`## ${hub.title}`);
    lines.push(`- plik: ${hub.preferred_file}`);
    lines.push(`- istnieje: ${hub.exists ? 'TAK' : 'NIE'}`);
    lines.push(`- artykuły w klastrze: ${hub.article_count}`);
    lines.push(`- brak linku do huba: ${hub.missing_backlinks.slice(0, 12).join(', ') || 'brak'}`);
    lines.push(`- assety: ${hub.required_assets.join('; ')}`);
    lines.push(`- rekomendacja: ${hub.recommendation}`);
    lines.push('');
  });
  writeText(file, lines.join('\n'));
}

function buildLinkAssets() {
  const data = buildGrowthData();
  const candidates = data.articles
    .filter((article) => !article.pdf_links.length || !article.table_count || article.image_sources.length < 3)
    .slice(0, 60)
    .map((article, index) => ({
      nr: index + 1,
      file: article.file,
      title: article.h1 || article.title,
      topic: article.topic,
      needs: [
        !article.pdf_links.length ? 'PDF/checklista' : '',
        !article.table_count ? 'cytowalna tabela HTML' : '',
        article.image_sources.length < 3 ? 'grafika do udostępniania' : '',
      ].filter(Boolean),
      suggested_asset: suggestAsset(article),
    }));
  const report = { generated_at: nowWarsawIso(), candidates };
  writeJson(path.join(REPORT_DIR, 'link-assets.json'), report);
  writeSimpleListMarkdown('Link Earning Assets', candidates, path.join(REPORT_DIR, 'link-assets.md'));
  return report;
}

function suggestAsset(article) {
  if (article.topic === 'sen') return 'checklista higieny snu + tabela przyczyn nocnych pobudek';
  if (article.topic === 'nadcisnienie') return 'karta domowego pomiaru ciśnienia + tabela czerwonych flag';
  if (article.topic === 'bialko') return 'tabela porcji białka + PDF rozkładu białka w dzień';
  if (article.topic === 'trening-silowy') return 'plan startowy 4 tygodnie + tabela progresji';
  if (article.topic === 'metabolizm') return 'tabela przyczyn oponki + checklista pomiarów';
  return 'cytowalna tabela + krótki PDF z checklistą';
}

function writeSimpleListMarkdown(title, candidates, file) {
  const lines = [`# ${title}`, '', `Wygenerowano: ${nowWarsawIso()}`, ''];
  if (!candidates.length) {
    lines.push('Brak kandydatów.');
  }
  candidates.forEach((item) => {
    lines.push(`## ${item.nr}. ${item.file}`);
    for (const [key, value] of Object.entries(item)) {
      if (key === 'nr' || key === 'file') continue;
      lines.push(`- ${key}: ${Array.isArray(value) ? value.join('; ') : JSON.stringify(value)}`);
    }
    lines.push('');
  });
  writeText(file, lines.join('\n'));
}

function extractQuickAnswerText(html) {
  const section = html.match(/<(section|div|aside)\b[^>]*(?:id=["']quick-answer["']|class=["'][^"']*quick-answer[^"']*["'])[^>]*>([\s\S]*?)<\/\1>/i);
  if (!section) return '';
  return stripTags(section[2]);
}

function isGenericQuickAnswer(answer) {
  const text = String(answer || '').replace(/\s+/g, ' ').trim();
  return [
    /Po 50-tce w temacie/i,
    /najlepiej działa plan oparty na danych/i,
    /najpierw sprawdź punkt wyjścia/i,
    /wdrażaj zmiany krokami przez 4-8 tygodni/i,
    /zmniejsz obciążenie i\s*$/i,
  ].some((rx) => rx.test(text));
}

function extractSchemaTypes(html) {
  const types = new Set();
  for (const match of html.matchAll(/"@type"\s*:\s*(?:"([^"]+)"|\[([\s\S]*?)\])/gi)) {
    if (match[1]) types.add(match[1]);
    if (match[2]) {
      for (const inner of match[2].matchAll(/"([^"]+)"/g)) types.add(inner[1]);
    }
  }
  return [...types].sort();
}

function buildAiVisibilityTest() {
  const articles = buildCorpus();
  const prompts = AI_QUESTION_BANK.map((item, index) => {
    const candidates = articles
      .filter((article) => article.topic === item[0])
      .slice(0, 5)
      .map((article) => article.url);
    return {
      id: `AIV-${String(index + 1).padStart(2, '0')}`,
      topic: item[0],
      prompt: item[1],
      expected_fitpo50_urls: candidates,
      channels: ['Perplexity', 'Claude', 'ChatGPT', 'Gemini'],
      fields_to_record: ['is_fitpo50_cited', 'cited_url', 'competitor_domains', 'answer_gap', 'next_article_action'],
    };
  });
  const report = {
    generated_at: nowWarsawIso(),
    status: 'READY_FOR_MANUAL_OR_API_RUN',
    purpose: 'Test widoczności FitPo50 w odpowiedziach AI dla kluczowych pytań.',
    prompts,
  };
  writeJson(path.join(REPORT_DIR, 'ai-visibility-test.json'), report);
  writeAiVisibilityTestMarkdown(report, path.join(REPORT_DIR, 'ai-visibility-test.md'));
  return report;
}

function writeAiVisibilityTestMarkdown(report, file) {
  const lines = ['# AI Visibility Test', '', `Wygenerowano: ${report.generated_at}`, '', `Status: ${report.status}`, ''];
  report.prompts.forEach((item) => {
    lines.push(`## ${item.id} — ${item.topic}`);
    lines.push(`- prompt: ${item.prompt}`);
    lines.push(`- kanały: ${item.channels.join(', ')}`);
    lines.push(`- oczekiwane URL-e FitPo50: ${item.expected_fitpo50_urls.join(', ') || 'brak kandydata'}`);
    lines.push('- zapisz: czy FitPo50 cytowane, URL, konkurenci, luka odpowiedzi.');
    lines.push('');
  });
  writeText(file, lines.join('\n'));
}

function extractSnippetControls(html) {
  const metaRules = [];
  for (const match of html.matchAll(/<meta\b[^>]*(?:name=["'](robots|googlebot)["'][^>]*content=["']([^"']*)["']|content=["']([^"']*)["'][^>]*name=["'](robots|googlebot)["'])[^>]*>/gi)) {
    metaRules.push({
      name: String(match[1] || match[4] || '').toLowerCase(),
      content: String(match[2] || match[3] || '').trim(),
    });
  }
  const dataNosnippetCount = [...html.matchAll(/\bdata-nosnippet\b/gi)].length;
  const maxSnippetRules = metaRules
    .flatMap((rule) => [...rule.content.matchAll(/\bmax-snippet\s*:\s*(-?\d+)/gi)]
      .map((item) => Number(item[1])));
  return {
    meta_rules: metaRules,
    robots_content: metaRules.map((rule) => `${rule.name}:${rule.content}`),
    has_noindex: metaRules.some((rule) => /\bnoindex\b/i.test(rule.content)),
    has_nosnippet: metaRules.some((rule) => /\bnosnippet\b/i.test(rule.content)),
    max_snippet_rules: maxSnippetRules,
    restrictive_max_snippet_rules: maxSnippetRules.filter((value) => value !== -1),
    data_nosnippet_count: dataNosnippetCount,
  };
}

function classifySnippetControls(file, html, controls) {
  const isArticle = /class=["'][^"']*article-page[^"']*["']|"@type"\s*:\s*"BlogPosting"/i.test(html);
  const isSupport = SUPPORT_PAGES.has(file);
  const intentionalNoindex = ['narzedzia.html', 'kalkulator-phenoage-wiek-fenotypowy.html', 'index1.html'].includes(file);
  const issues = [];
  if (controls.has_noindex && isArticle && !intentionalNoindex) {
    issues.push('ARTICLE_NOINDEX');
  }
  if (controls.has_nosnippet && isArticle) {
    issues.push('ARTICLE_NOSNIPPET_BLOCKS_AI_INPUT');
  }
  if (controls.restrictive_max_snippet_rules.length && isArticle) {
    issues.push('ARTICLE_RESTRICTIVE_MAX_SNIPPET');
  }
  if (controls.data_nosnippet_count && isArticle) {
    issues.push('ARTICLE_DATA_NOSNIPPET_REVIEW');
  }
  if (controls.has_noindex && !intentionalNoindex && !isArticle) {
    issues.push('NON_ARTICLE_NOINDEX_REVIEW');
  }
  const status = issues.length ? 'REVIEW' : 'OK';
  return {
    file,
    url: `${SITE_ORIGIN}/${file}`,
    type: isArticle ? 'article' : (isSupport ? 'support' : 'other'),
    status,
    intentional_noindex: intentionalNoindex,
    issues,
    controls,
    recommendation: issues.length
      ? 'Sprawdź ręcznie przed edycją: dla AI Overviews / AI Mode strona musi być zaindeksowana i kwalifikować się do snippetu.'
      : (intentionalNoindex ? 'Wygląda na celowy noindex strony technicznej; monitoruj, bez automatycznej zmiany.' : 'Brak restrykcyjnych kontroli snippetu wymagających reakcji.'),
  };
}

function buildSnippetControlsAudit() {
  const rows = findSeoHtmlFiles(ROOT)
    .map((file) => {
      const html = readTextIfExists(path.join(ROOT, file));
      return classifySnippetControls(file, html, extractSnippetControls(html));
    });
  const review = rows.filter((row) => row.status === 'REVIEW');
  const intentionalNoindex = rows.filter((row) => row.intentional_noindex && row.controls.has_noindex);
  const report = {
    generated_at: nowWarsawIso(),
    status: review.length ? 'REVIEW' : 'PASS',
    purpose: 'Automatyczny audyt oficjalnych kontroli podglądu Google: noindex, nosnippet, max-snippet i data-nosnippet.',
    google_basis: [
      'AI Overviews / AI Mode nie wymagają osobnej techniki GEO ani specjalnego schema.',
      'Strona musi być zaindeksowana i kwalifikować się do snippetu, żeby mogła pojawić się jako supporting link.',
      'nosnippet, data-nosnippet i restrykcyjny max-snippet mogą ograniczać użycie treści w AI Overviews / AI Mode.',
    ],
    summary: {
      scanned_html: rows.length,
      review_count: review.length,
      intentional_noindex_count: intentionalNoindex.length,
      article_noindex: review.filter((row) => row.issues.includes('ARTICLE_NOINDEX')).length,
      article_nosnippet: review.filter((row) => row.issues.includes('ARTICLE_NOSNIPPET_BLOCKS_AI_INPUT')).length,
      article_restrictive_max_snippet: review.filter((row) => row.issues.includes('ARTICLE_RESTRICTIVE_MAX_SNIPPET')).length,
      article_data_nosnippet: review.filter((row) => row.issues.includes('ARTICLE_DATA_NOSNIPPET_REVIEW')).length,
    },
    review,
    intentional_noindex: intentionalNoindex,
    checked_files: rows.map((row) => ({
      file: row.file,
      type: row.type,
      status: row.status,
      controls: row.controls.robots_content,
      data_nosnippet_count: row.controls.data_nosnippet_count,
      max_snippet_rules: row.controls.max_snippet_rules,
    })),
    note: 'Audyt nie sprawdza nagłówków HTTP X-Robots-Tag z produkcji; to wymaga osobnej kontroli live/serwerowej.',
  };
  writeJson(path.join(REPORT_DIR, 'snippet-controls-audit.json'), report);
  writeSnippetControlsMarkdown(report, path.join(REPORT_DIR, 'snippet-controls-audit.md'));
  return report;
}

function writeSnippetControlsMarkdown(report, file) {
  const lines = ['# Snippet Controls Audit', '', `Wygenerowano: ${report.generated_at}`, `Status: ${report.status}`, ''];
  lines.push('## Podstawa Google');
  report.google_basis.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('## Podsumowanie');
  Object.entries(report.summary).forEach(([key, value]) => lines.push(`- ${key}: ${value}`));
  lines.push('');
  if (report.review.length) {
    lines.push('## Do Sprawdzenia');
    report.review.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.file}`);
      lines.push(`   - typ: ${item.type}`);
      lines.push(`   - problemy: ${item.issues.join(', ')}`);
      lines.push(`   - robots: ${item.controls.robots_content.join(' | ') || 'brak'}`);
      lines.push(`   - max-snippet: ${item.controls.max_snippet_rules.join(', ') || 'brak'}; data-nosnippet: ${item.controls.data_nosnippet_count}`);
      lines.push(`   - rekomendacja: ${item.recommendation}`);
    });
    lines.push('');
  }
  lines.push('## Celowe Noindex');
  if (!report.intentional_noindex.length) {
    lines.push('- brak');
  } else {
    report.intentional_noindex.forEach((item) => {
      lines.push(`- ${item.file}: ${item.controls.robots_content.join(' | ')}`);
    });
  }
  lines.push('');
  lines.push(`Uwaga: ${report.note}`);
  writeText(file, lines.join('\n'));
}

function buildEntityGraph() {
  const articles = buildCorpus();
  const hubs = {};
  for (const hub of HUBS) {
    const topicArticles = articles.filter((article) => article.topic === hub.id);
    hubs[hub.id] = {
      title: hub.title,
      preferred_file: hub.preferred_file,
      entity_type: 'TopicCluster',
      related_keywords: hub.keywords,
      required_assets: hub.must_have_assets,
      urls: topicArticles.map((article) => article.url),
      citations: unique(topicArticles.flatMap((article) => article.citations)).slice(0, 40),
      linked_topics: unique(topicArticles.flatMap((article) => article.links)
        .map((link) => articles.find((candidate) => candidate.file === link)?.topic)
        .filter((topic) => topic && topic !== hub.id && topic !== 'inne')),
    };
  }
  const graph = {
    generated_at: nowWarsawIso(),
    site: SITE_ORIGIN,
    author: {
      name: 'Grzegorz Kupiec',
      site_role: 'FitPo50 author/editor',
    },
    hubs,
    articles: articles.map((article) => ({
      file: article.file,
      url: article.url,
      title: article.h1 || article.title,
      topic: article.topic,
      entities: unique([article.topic, ...article.h2.slice(0, 8)]),
      citations: article.citations,
      internal_links: article.links,
      schema_signals: {
        has_blogposting: article.has_blogposting,
        has_faq: article.has_faq,
        has_breadcrumbs: article.has_breadcrumbs,
        has_speakable: article.has_speakable,
      },
    })),
  };
  writeJson(path.join(REPORT_DIR, 'entity-graph.json'), graph);
  writeEntityGraphMarkdown(graph, path.join(REPORT_DIR, 'entity-graph.md'));
  return graph;
}

function writeEntityGraphMarkdown(graph, file) {
  const lines = ['# Entity Graph FitPo50', '', `Wygenerowano: ${graph.generated_at}`, ''];
  Object.entries(graph.hubs).forEach(([id, hub]) => {
    lines.push(`## ${hub.title}`);
    lines.push(`- id: ${id}`);
    lines.push(`- hub: ${hub.preferred_file}`);
    lines.push(`- URL-e: ${hub.urls.length}`);
    lines.push(`- cytowania: ${hub.citations.length}`);
    lines.push(`- powiązane tematy: ${hub.linked_topics.join(', ') || 'brak'}`);
    lines.push('');
  });
  writeText(file, lines.join('\n'));
}

function buildStructuredScore() {
  const articles = buildCorpus();
  const rows = articles.map((article) => {
    const html = readTextIfExists(path.join(ROOT, article.file));
    const schemaTypes = extractSchemaTypes(html);
    const checks = {
      blogposting: article.has_blogposting,
      faqpage: article.has_faq || schemaTypes.includes('FAQPage'),
      breadcrumblist: article.has_breadcrumbs,
      speakable: article.has_speakable || schemaTypes.includes('SpeakableSpecification'),
      author: hasJsonLdAuthor(html),
      date_modified: Boolean(article.date_modified),
      citations_min_4: article.citation_count >= 4,
    };
    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      file: article.file,
      title: article.h1 || article.title,
      topic: article.topic,
      score: Math.round((passed / total) * 100),
      checks,
      schema_types: schemaTypes,
    };
  }).sort((a, b) => a.score - b.score);
  const report = {
    generated_at: nowWarsawIso(),
    average_score: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0,
    articles: rows,
  };
  writeJson(path.join(REPORT_DIR, 'structured-data-score.json'), report);
  writeScoreMarkdown('Structured Data Completeness Score', report, path.join(REPORT_DIR, 'structured-data-score.md'));
  return report;
}

function buildQuickAnswerScore() {
  const articles = buildCorpus();
  const rows = articles.map((article) => {
    const html = readTextIfExists(path.join(ROOT, article.file));
    const answer = extractQuickAnswerText(html);
    const words = answer ? answer.split(/\s+/).length : 0;
    const hasNumber = /\d/.test(answer);
    const mentionsH1Term = tokenizeForScore(article.h1 || article.title).some((token) => answer.toLowerCase().includes(token));
    const generic = isGenericQuickAnswer(answer);
    const score = Math.round(
      (answer ? 25 : 0)
      + (words >= 35 && words <= 80 ? 25 : 0)
      + (hasNumber ? 15 : 0)
      + (mentionsH1Term ? 20 : 0)
      + (!/warto|może|zależy/i.test(answer.slice(0, 80)) ? 15 : 8)
      - (generic ? 60 : 0),
    );
    return {
      file: article.file,
      title: article.h1 || article.title,
      topic: article.topic,
      score,
      words,
      has_number: hasNumber,
      mentions_h1_term: mentionsH1Term,
      generic_template: generic,
      excerpt: answer.slice(0, 220),
    };
  }).sort((a, b) => a.score - b.score);
  const report = {
    generated_at: nowWarsawIso(),
    average_score: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0,
    articles: rows,
  };
  writeJson(path.join(REPORT_DIR, 'quick-answer-score.json'), report);
  writeScoreMarkdown('Quick Answer Quality Score', report, path.join(REPORT_DIR, 'quick-answer-score.md'));
  return report;
}

function readGenerativeAiRows() {
  const files = findReportFiles([
    GSC_INPUT_DIR,
    path.join(ROOT, 'data', 'gsc'),
    path.join(ROOT, 'data', 'reports'),
  ], [
    /generative.*\.(csv|json)$/i,
    /gen[-_ ]?ai.*\.(csv|json)$/i,
    /ai[-_ ]?(overview|mode|search|discover|performance).*\.(csv|json)$/i,
    /(overview|ai-mode|aio).*performance.*\.(csv|json)$/i,
  ]);
  const rows = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const rawRows = ext === '.json'
      ? rowsFromGenerativeAiJson(readJsonIfExists(file))
      : parseCsvRows(file);
    rawRows.forEach((row) => {
      const page = rowValue(row, ['page', 'strona', 'url', 'landing page', 'adres url', 'pages']);
      const filePath = pageToFile(page);
      const impressions = toNumber(rowValue(row, ['impressions', 'wyswietlenia', 'wyświetlenia', 'ai impressions', 'generative ai impressions']));
      const clicks = toNumber(rowValue(row, ['clicks', 'klikniecia', 'kliknięcia']));
      const country = rowValue(row, ['country', 'kraj']);
      const device = rowValue(row, ['device', 'urzadzenie', 'urządzenie']);
      const date = rowValue(row, ['date', 'data', 'day', 'dzien', 'dzień']);
      const feature = rowValue(row, ['feature', 'search feature', 'typ', 'type']) || inferGenerativeAiFeature(file);
      if (!filePath || (!impressions && !clicks)) return;
      rows.push({
        source_file: path.relative(ROOT, file).replace(/^\.\.\//, ''),
        page,
        file: filePath,
        url: filePath.startsWith('http') ? filePath : `${SITE_ORIGIN}/${filePath}`,
        feature,
        impressions,
        clicks,
        country,
        device,
        date,
      });
    });
  }
  return { files, rows };
}

function rowsFromGenerativeAiJson(payload) {
  if (!payload || payload.parse_error) return [];
  if (Array.isArray(payload)) return payload;
  for (const key of ['rows', 'data', 'items', 'pages', 'results']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function inferGenerativeAiFeature(file) {
  const name = String(file || '').toLowerCase();
  if (/discover/.test(name)) return 'Discover generative AI';
  if (/ai[-_ ]?mode/.test(name)) return 'AI Mode';
  if (/overview|aio/.test(name)) return 'AI Overviews';
  return 'Search generative AI';
}

function buildGenerativeAiGscReport() {
  const { files, rows } = readGenerativeAiRows();
  const byUrl = new Map();
  for (const row of rows) {
    const current = byUrl.get(row.file) || {
      file: row.file,
      url: row.url,
      impressions: 0,
      clicks: 0,
      features: new Set(),
      countries: new Set(),
      devices: new Set(),
      latest_date: '',
      source_files: new Set(),
    };
    current.impressions += Number(row.impressions || 0);
    current.clicks += Number(row.clicks || 0);
    if (row.feature) current.features.add(row.feature);
    if (row.country) current.countries.add(row.country);
    if (row.device) current.devices.add(row.device);
    if (row.date && String(row.date) > String(current.latest_date || '')) current.latest_date = String(row.date);
    if (row.source_file) current.source_files.add(row.source_file);
    byUrl.set(row.file, current);
  }
  const pages = [...byUrl.values()]
    .map((item) => ({
      file: item.file,
      url: item.url,
      impressions: Math.round(item.impressions),
      clicks: Math.round(item.clicks),
      features: [...item.features].sort(),
      countries: [...item.countries].sort(),
      devices: [...item.devices].sort(),
      latest_date: item.latest_date,
      source_files: [...item.source_files].sort(),
    }))
    .sort((a, b) => b.impressions - a.impressions || a.file.localeCompare(b.file));
  const report = {
    generated_at: nowWarsawIso(),
    status: pages.length ? 'OK' : 'NO_EXPORT_OR_ROLLOUT_NOT_AVAILABLE',
    input_dir: GSC_INPUT_DIR,
    source_files: files.map((file) => path.relative(ROOT, file).replace(/^\.\.\//, '')),
    expected_export_hint: 'Wrzuć do gsc-auto-input eksport CSV/JSON z raportu Search Generative AI: pages + impressions, opcjonalnie country/device/date/feature.',
    summary: {
      pages: pages.length,
      impressions: pages.reduce((sum, item) => sum + item.impressions, 0),
      clicks: pages.reduce((sum, item) => sum + item.clicks, 0),
    },
    pages,
    recommended_actions: pages.length
      ? [
        'Porównuj URL-e z AI impressions z klasycznym GSC: jeśli AI rośnie bez klików, wzmacniaj CTA i dalsze ścieżki na stronie.',
        'Dla URL-i z AI impressions sprawdź, czy pierwsze 2-4 zdania nadają się do cytowania i czy schema zgadza się z widoczną treścią.',
        'URL-e z AI impressions, ale słabym linkowaniem, wzmacniaj z centrów tematycznych i zwycięskich artykułów.',
      ]
      : [
        'Brak eksportu lub brak dostępu w rollout. Sprawdzaj Search Console okresowo; brak raportu nie oznacza braku widoczności w AI.',
        'Do czasu eksportu używaj AI Visibility Test i ręcznego monitoringu cytowań dla kluczowych pytań.',
      ],
  };
  writeJson(path.join(REPORT_DIR, 'gsc-generative-ai.json'), report);
  writeGenerativeAiGscMarkdown(report, path.join(REPORT_DIR, 'gsc-generative-ai.md'));
  return report;
}

function writeGenerativeAiGscMarkdown(report, file) {
  const lines = ['# GSC Generative AI Visibility', '', `Wygenerowano: ${report.generated_at}`, `Status: ${report.status}`, ''];
  lines.push(`Katalog wejściowy: ${report.input_dir}`);
  lines.push(`Źródła: ${report.source_files.join(', ') || 'brak eksportu'}`);
  lines.push(`Podsumowanie: URL-e=${report.summary.pages}, AI impressions=${report.summary.impressions}, clicks=${report.summary.clicks}`);
  lines.push('');
  if (!report.pages.length) {
    lines.push(`Brak danych: ${report.expected_export_hint}`);
    lines.push('');
  } else {
    lines.push('## URL-e Z Widocznością W AI');
    report.pages.slice(0, 30).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.file}`);
      lines.push(`   - AI impressions: ${item.impressions}; clicks: ${item.clicks}; features: ${item.features.join(', ') || 'brak'}`);
      if (item.countries.length || item.devices.length) lines.push(`   - kraje/urządzenia: ${item.countries.join(', ') || 'brak'} / ${item.devices.join(', ') || 'brak'}`);
    });
    lines.push('');
  }
  lines.push('## Co Robić');
  report.recommended_actions.forEach((item) => lines.push(`- ${item}`));
  writeText(file, lines.join('\n'));
}

function buildPostDeploymentKpiPlan() {
  const data = buildGrowthData();
  const generativeAi = readJsonIfExists(path.join(REPORT_DIR, 'gsc-generative-ai.json')) || buildGenerativeAiGscReport();
  const aiByFile = new Map((generativeAi.pages || []).map((item) => [item.file, item]));
  const candidates = data.articles
    .filter((article) => shouldTrackPostDeployment(article, aiByFile.get(article.file)))
    .slice(0, 40)
    .map((article, index) => {
      const ai = aiByFile.get(article.file) || null;
      return {
        nr: index + 1,
        file: article.file,
        url: article.url,
        topic: article.topic,
        date_modified: article.date_modified || 'MISSING',
        baseline: {
          clicks: Number(article.gsc?.clicks || 0),
          impressions: Number(article.gsc?.impressions || 0),
          ctr: Number(article.gsc?.ctr || 0),
          position: Number(article.gsc?.position || 0),
          ai_impressions: Number(ai?.impressions || 0),
          ai_clicks: Number(ai?.clicks || 0),
        },
        checkpoints: buildKpiCheckpoints(article.date_modified),
        metrics_to_collect: [
          'GSC Web: clicks, impressions, CTR, average position, query changes',
          'GSC Generative AI: impressions by page, country, device, feature, if report is available',
          'GA/analytics: engaged time, scroll depth, outbound PDF clicks, CTA clicks, return visits',
          'Internal: links added from centers and source pages, dateModified, sitemap lastmod',
        ],
        decision_after_28_days: 'Jeśli impressions rosną bez klików: popraw title/meta i pierwszą odpowiedź. Jeśli AI impressions rosną: wzmacniaj cytowalny fragment, źródła i CTA. Jeśli brak crawl/index: sprawdź URL Inspection.',
      };
    });
  const report = {
    generated_at: nowWarsawIso(),
    status: 'TRACK_7_14_28',
    ai_report_status: generativeAi.status,
    candidates,
  };
  writeJson(path.join(REPORT_DIR, 'post-deploy-kpi-plan.json'), report);
  writePostDeploymentKpiMarkdown(report, path.join(REPORT_DIR, 'post-deploy-kpi-plan.md'));
  return report;
}

function shouldTrackPostDeployment(article, ai) {
  if (ai && Number(ai.impressions || 0) > 0) return true;
  if (Number(article.gsc?.impressions || 0) > 0) return true;
  if (/^centrum-/.test(article.file)) return true;
  return Number(article.growth_score || 0) >= 55;
}

function buildKpiCheckpoints(dateModified) {
  const date = parseDate(dateModified);
  if (!date) return null;
  return {
    day_7: addDays(date, 7),
    day_14: addDays(date, 14),
    day_28: addDays(date, 28),
  };
}

function writePostDeploymentKpiMarkdown(report, file) {
  const lines = ['# Post-Deploy KPI Plan', '', `Wygenerowano: ${report.generated_at}`, `Status: ${report.status}`, `GSC Generative AI: ${report.ai_report_status}`, ''];
  report.candidates.slice(0, 30).forEach((item) => {
    lines.push(`## ${item.nr}. ${item.file}`);
    lines.push(`- baseline Web: impr ${item.baseline.impressions}, klik ${item.baseline.clicks}, CTR ${item.baseline.ctr}%, poz ${item.baseline.position}`);
    lines.push(`- baseline AI: impressions ${item.baseline.ai_impressions}, clicks ${item.baseline.ai_clicks}`);
    lines.push(`- checkpointy: ${item.checkpoints ? Object.values(item.checkpoints).join(' / ') : 'brak dateModified'}`);
    lines.push(`- decyzja po 28 dniach: ${item.decision_after_28_days}`);
    lines.push('');
  });
  writeText(file, lines.join('\n'));
}

function buildOriginalityScore() {
  const articles = buildCorpus();
  const rows = articles.map((article) => {
    const html = readTextIfExists(path.join(ROOT, article.file));
    const text = stripTags(html);
    const checks = {
      first_person_or_fitpo50_context: /\b(u mnie|w fitpo50|na fitpo50|moje|moja|sprawdziłem|sprawdzilem|widzę u|z praktyki|podopiecz|czytelnik)\b/i.test(text),
      concrete_numbers_or_thresholds: /(\d+\s?(mg\/dl|mmhg|g|kg|dni|tygodni|powtórze|powtorze|serii|godzin|%|cm)|\bLDL-C\b|\bApoB\b|\bHbA1c\b|\bVO2max\b)/i.test(text),
      case_or_example: /\b(przykład|przyklad|case|scenariusz|u osoby|jeśli masz|jesli masz|gdy masz|dla osoby)\b/i.test(text),
      shareable_asset: article.table_count > 0 || article.pdf_links.length > 0 || article.image_sources.length >= 3,
      safety_or_boundary: article.has_doctor_box || /\b(kiedy do lekarza|przerwij|pilnie|nie stosuj|skonsultuj|przeciwwskaz)\b/i.test(text),
      sources_tied_to_claims: article.citation_count >= 4,
    };
    const score = Math.round((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100);
    return {
      file: article.file,
      title: article.h1 || article.title,
      topic: article.topic,
      score,
      checks,
      gaps: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
      recommendation: originalityRecommendation(checks),
    };
  }).sort((a, b) => a.score - b.score);
  const report = {
    generated_at: nowWarsawIso(),
    average_score: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0,
    articles: rows,
  };
  writeJson(path.join(REPORT_DIR, 'originality-score.json'), report);
  writeOriginalityScoreMarkdown(report, path.join(REPORT_DIR, 'originality-score.md'));
  return report;
}

function originalityRecommendation(checks) {
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  if (!missing.length) return 'OK: treść ma konkret, źródła, granice bezpieczeństwa i element cytowalny.';
  const map = {
    first_person_or_fitpo50_context: 'Dodaj jedną własną obserwację FitPo50 albo konkretny kontekst osoby 50+.',
    concrete_numbers_or_thresholds: 'Dodaj liczby, progi, zakresy albo mierzalną tabelę, jeśli temat na to pozwala.',
    case_or_example: 'Dodaj krótki przykład sytuacji użytkownika zamiast ogólnej porady.',
    shareable_asset: 'Dodaj tabelę HTML, grafikę albo PDF tylko wtedy, gdy pomaga podjąć decyzję.',
    safety_or_boundary: 'Dopisz jasny warunek bezpieczeństwa: kiedy przerwać, skonsultować albo nie stosować.',
    sources_tied_to_claims: 'Uzupełnij realne źródła przy mocnych twierdzeniach.',
  };
  return missing.slice(0, 2).map((key) => map[key]).join(' ');
}

function writeOriginalityScoreMarkdown(report, file) {
  const lines = ['# Originality And Own Data Score', '', `Wygenerowano: ${report.generated_at}`, `Średni wynik: ${report.average_score}%`, ''];
  report.articles.slice(0, 50).forEach((article, index) => {
    lines.push(`${index + 1}. ${article.file}`);
    lines.push(`   - score: ${article.score}%`);
    lines.push(`   - braki: ${article.gaps.join(', ') || 'brak'}`);
    lines.push(`   - rekomendacja: ${article.recommendation}`);
  });
  writeText(file, lines.join('\n'));
}

function tokenizeForScore(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-ząćęłńóśźż0-9]+/i)
    .filter((token) => token.length > 4)
    .slice(0, 10);
}

function writeScoreMarkdown(title, report, file) {
  const lines = [`# ${title}`, '', `Wygenerowano: ${report.generated_at}`, `Średni wynik: ${report.average_score}%`, ''];
  report.articles.slice(0, 40).forEach((article, index) => {
    lines.push(`${index + 1}. ${article.file}`);
    lines.push(`   - score: ${article.score}%`);
    if (article.topic) lines.push(`   - temat: ${article.topic}`);
    if (article.words !== undefined) lines.push(`   - słowa quick answer: ${article.words}`);
    if (article.checks) {
      const failed = Object.entries(article.checks).filter(([, value]) => !value).map(([key]) => key);
      lines.push(`   - braki: ${failed.join(', ') || 'brak'}`);
    }
    if (article.excerpt) lines.push(`   - fragment: ${article.excerpt}`);
  });
  writeText(file, lines.join('\n'));
}

function buildTopicalMap() {
  const articles = buildCorpus();
  const report = {
    generated_at: nowWarsawIso(),
    topics: HUBS.map((hub) => {
      const topicArticles = articles.filter((article) => article.topic === hub.id);
      const avgInbound = topicArticles.length
        ? Number((topicArticles.reduce((sum, article) => sum + article.inbound_link_count, 0) / topicArticles.length).toFixed(1))
        : 0;
      const missingFormats = {
        evidence_box: topicArticles.filter((article) => !article.has_evidence_box).length,
        pdf: topicArticles.filter((article) => !article.pdf_links.length).length,
        shareable_table: topicArticles.filter((article) => !article.table_count).length,
        citations: topicArticles.filter((article) => article.citation_count < 4).length,
      };
      const coverageScore = Math.min(100, Math.round(topicArticles.length * 8 + avgInbound * 8 - Object.values(missingFormats).reduce((sum, value) => sum + value, 0) * 2));
      return {
        id: hub.id,
        title: hub.title,
        preferred_file: hub.preferred_file,
        article_count: topicArticles.length,
        average_inbound_links: avgInbound,
        coverage_score: Math.max(0, coverageScore),
        missing_formats: missingFormats,
        semantic_gaps: hub.must_have_assets,
        articles: topicArticles.map((article) => article.file),
      };
    }),
  };
  writeJson(path.join(REPORT_DIR, 'topical-authority-map.json'), report);
  writeTopicalMapMarkdown(report, path.join(REPORT_DIR, 'topical-authority-map.md'));
  return report;
}

function writeTopicalMapMarkdown(report, file) {
  const lines = ['# Topical Authority Map', '', `Wygenerowano: ${report.generated_at}`, ''];
  report.topics
    .sort((a, b) => a.coverage_score - b.coverage_score)
    .forEach((topic) => {
      lines.push(`## ${topic.title}`);
      lines.push(`- coverage score: ${topic.coverage_score}%`);
      lines.push(`- artykuły: ${topic.article_count}`);
      lines.push(`- średnie inbound links: ${topic.average_inbound_links}`);
      lines.push(`- braki formatów: ${Object.entries(topic.missing_formats).map(([key, value]) => `${key}=${value}`).join(', ')}`);
      lines.push(`- dziury semantyczne: ${topic.semantic_gaps.join('; ')}`);
      lines.push('');
    });
  writeText(file, lines.join('\n'));
}

function buildLlmsCheck() {
  const articles = buildCorpus();
  const llms = readTextIfExists(path.join(ROOT, 'llms.txt'));
  const full = readTextIfExists(path.join(ROOT, 'llms-full.txt'));
  const rows = articles.map((article) => ({
    file: article.file,
    url: article.url,
    in_llms: textHasExactReference(llms, article.file) || textHasExactReference(llms, article.url),
    in_llms_full: textHasExactReference(full, article.file) || textHasExactReference(full, article.url) || textHasExactReference(full, article.h1 || article.title),
  }));
  const missing = rows.filter((row) => !row.in_llms || !row.in_llms_full);
  const report = {
    generated_at: nowWarsawIso(),
    status: missing.length ? 'WARN' : 'PASS',
    articles_total: rows.length,
    missing_count: missing.length,
    missing,
    recommendation: missing.length ? 'Uruchom npm run llms:full i sprawdź ponownie growth:llms-check.' : 'llms.txt/llms-full.txt wyglądają spójnie.',
  };
  writeJson(path.join(REPORT_DIR, 'llms-check.json'), report);
  writeLlmsCheckMarkdown(report, path.join(REPORT_DIR, 'llms-check.md'));
  return report;
}

function writeLlmsCheckMarkdown(report, file) {
  const lines = ['# llms.txt Check', '', `Wygenerowano: ${report.generated_at}`, `Status: ${report.status}`, '', `Braki: ${report.missing_count}`, ''];
  report.missing.slice(0, 80).forEach((row) => {
    lines.push(`- ${row.file}: llms=${row.in_llms ? 'TAK' : 'NIE'}, full=${row.in_llms_full ? 'TAK' : 'NIE'}`);
  });
  lines.push('');
  lines.push(`Rekomendacja: ${report.recommendation}`);
  writeText(file, lines.join('\n'));
}

function buildPerplexityMonitor() {
  const apiKey = process.env.PERPLEXITY_API_KEY || '';
  const prompts = AI_QUESTION_BANK.slice(0, 30).map((item, index) => ({
    id: `PPLX-${String(index + 1).padStart(2, '0')}`,
    topic: item[0],
    prompt: item[1],
    expected_domain: 'fitpo50.pl',
  }));
  const report = {
    generated_at: nowWarsawIso(),
    status: apiKey ? 'API_KEY_PRESENT_NOT_CALLED_BY_DEFAULT' : 'INSUFFICIENT_API_KEY',
    note: apiKey
      ? 'Klucz PERPLEXITY_API_KEY jest dostępny. W tej wersji zapisujemy bezpieczną kolejkę; realne wywołania API można dodać po zatwierdzeniu kosztów i limitów.'
      : 'Brak PERPLEXITY_API_KEY. Raport generuje kolejkę monitoringu bez wykonywania zapytań.',
    prompts,
    results: [],
  };
  writeJson(path.join(REPORT_DIR, 'perplexity-monitor.json'), report);
  writePerplexityMonitorMarkdown(report, path.join(REPORT_DIR, 'perplexity-monitor.md'));
  return report;
}

function writePerplexityMonitorMarkdown(report, file) {
  const lines = ['# Perplexity Rank Monitor', '', `Wygenerowano: ${report.generated_at}`, `Status: ${report.status}`, '', report.note, ''];
  report.prompts.forEach((item) => {
    lines.push(`- ${item.id}: [${item.topic}] ${item.prompt}`);
  });
  writeText(file, lines.join('\n'));
}

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function buildAutopilot() {
  const report = buildReport();
  const evidence = buildEvidencePlan();
  const assets = buildLinkAssets();
  const hubs = buildHubsReport();
  const plan = {
    generated_at: nowWarsawIso(),
    mode: 'NO_WRITE_AUTOPILOT_PLAN',
    chosen_articles: report.priority_articles.slice(0, 3),
    required_manual_ok: true,
    next_step: 'Przygotuj ręcznie propozycje tekstów w rozmowie; edytuj HTML dopiero po akceptacji użytkownika.',
    evidence_candidates: evidence.candidates.slice(0, 10),
    asset_candidates: assets.candidates.slice(0, 10),
    hubs: hubs.hubs,
  };
  writeJson(path.join(REPORT_DIR, 'autopilot-plan.json'), plan);
  writeSimpleListMarkdown('Autopilot Plan', plan.chosen_articles, path.join(REPORT_DIR, 'autopilot-plan.md'));
  return plan;
}

function buildPoprawSeo() {
  const report = buildReport();
  const aiAudit = buildAiAudit();
  const aiVisibilityTest = buildAiVisibilityTest();
  const gscRefresh = buildGscRefresh();
  const evidence = buildEvidencePlan();
  const hubs = buildHubsReport();
  const assets = buildLinkAssets();
  const entities = buildEntityGraph();
  const structuredScore = buildStructuredScore();
  const quickAnswerScore = buildQuickAnswerScore();
  const generativeAiGsc = buildGenerativeAiGscReport();
  const snippetControls = buildSnippetControlsAudit();
  const originalityScore = buildOriginalityScore();
  const postDeployKpi = buildPostDeploymentKpiPlan();
  const topicalMap = buildTopicalMap();
  const llmsCheck = buildLlmsCheck();
  const perplexityMonitor = buildPerplexityMonitor();
  const autopilot = buildAutopilot();
  const unifiedInsights = buildUnifiedInsights();
  const command = {
    generated_at: nowWarsawIso(),
    command: 'popraw-seo',
    status: 'AWAITING_USER_APPROVAL',
    what_happened: [
      'Wygenerowano główny raport growth.',
      'Wygenerowano AI Visibility Audit.',
      'Wygenerowano AI Visibility Test.',
      'Wygenerowano sprint odświeżania GSC.',
      'Sprawdzono Evidence Boxy i bloki bezpieczeństwa.',
      'Sprawdzono huby tematyczne.',
      'Sprawdzono assety do link earningu.',
      'Zbudowano Entity Graph.',
      'Policzono Structured Data Completeness Score.',
      'Policzono Quick Answer Quality Score.',
      'Sprawdzono eksport GSC Generative AI dla AI Overviews / AI Mode / Discover, jeśli jest dostępny.',
      'Sprawdzono snippet controls: noindex, nosnippet, max-snippet i data-nosnippet pod kwalifikację do snippetu Google.',
      'Zbudowano plan KPI po wdrożeniu: Web GSC, AI impressions i zaangażowanie.',
      'Policzono Originality And Own Data Score: własne przykłady, progi, źródła, assety i warunki bezpieczeństwa.',
      'Zbudowano Topical Authority Map.',
      'Sprawdzono llms.txt i llms-full.txt.',
      'Zbudowano kolejkę Perplexity Monitor.',
      'Zbudowano plan autopilota bez zapisu w artykułach.',
      'Połączono raporty GSC/SEO/AEO/GEO/AIO i wyciągnięto kluczowe wnioski.',
      'Uwzględniono zewnętrzny raport GSC content strategy, jeśli istnieje w Downloads albo pod GSC_CONTENT_STRATEGY_REPORT.',
      'Zbudowano paczkę do zatwierdzenia: BOOST dla stron blisko wzrostu, NAPRAWA dla stron słabych lub bez widoczności oraz ROKUJE dla stron z potencjałem po liderach.',
      'Utworzono pełny koszyk MONITORING dla URL-i w cooldownie i działających stron, których nie należy teraz przepisywać.',
    ],
    unified_insights: unifiedInsights,
    approval_wave: unifiedInsights.approval_wave,
    chosen_articles: autopilot.chosen_articles,
    approval_needed: 'Zatwierdź konkretne ID, np. popraw BOOST 1, popraw ROKUJE 1 albo popraw BOOST 1 NAPRAWA 2. Najpierw przygotuję konkretne teksty do akceptacji, bez edycji HTML.',
    safe_next_commands: [
      'npm run popraw-seo',
      'Po akceptacji tekstów: ręczna edycja wskazanego HTML',
      'npm run growth:verify',
    ],
    reports: Object.fromEntries([
      ['growth_report', 'growth-report.md'],
      ['ai_visibility_audit', 'ai-visibility-audit.md'],
      ['ai_visibility_test', 'ai-visibility-test.md'],
      ['gsc_refresh', 'gsc-refresh.md'],
      ['evidence_plan', 'evidence-plan.md'],
      ['hubs_report', 'hubs-report.md'],
      ['link_assets', 'link-assets.md'],
      ['entity_graph', 'entity-graph.md'],
      ['structured_data_score', 'structured-data-score.md'],
      ['quick_answer_score', 'quick-answer-score.md'],
      ['gsc_generative_ai', 'gsc-generative-ai.md'],
      ['snippet_controls_audit', 'snippet-controls-audit.md'],
      ['post_deploy_kpi_plan', 'post-deploy-kpi-plan.md'],
      ['originality_score', 'originality-score.md'],
      ['topical_authority_map', 'topical-authority-map.md'],
      ['llms_check', 'llms-check.md'],
      ['perplexity_monitor', 'perplexity-monitor.md'],
      ['autopilot_plan', 'autopilot-plan.md'],
      ['decision_sheet', 'popraw-seo-decyzje.md'],
      ['unified_insights', 'popraw-seo-insights.md'],
      ['promising_pages', 'popraw-seo-rokuje.md'],
      ['seo_work_history', 'popraw-seo-historia.md'],
      ['gsc_after_change_queue', 'popraw-seo-gsc-po-zmianach.md'],
      ['cannibalization_map', 'popraw-seo-kanibalizacja.md'],
    ].map(([key, file]) => [key, path.join(REPORT_DIR, file)])),
    external_reports: {
      gsc_content_strategy: unifiedInsights.content_strategy?.path || 'MISSING',
    },
    counters: {
      report_articles: report.priority_articles.length,
      ai_questions: aiAudit.prompts.length,
      ai_visibility_prompts: aiVisibilityTest.prompts.length,
      gsc_refresh_candidates: gscRefresh.candidates.length,
      evidence_candidates: evidence.candidates.length,
      hubs: hubs.hubs.length,
      asset_candidates: assets.candidates.length,
      entities_articles: entities.articles.length,
      structured_average_score: structuredScore.average_score,
      quick_answer_average_score: quickAnswerScore.average_score,
      gsc_generative_ai_status: generativeAiGsc.status,
      gsc_generative_ai_pages: generativeAiGsc.summary.pages,
      snippet_controls_status: snippetControls.status,
      snippet_controls_review: snippetControls.summary.review_count,
      post_deploy_kpi_candidates: postDeployKpi.candidates.length,
      originality_average_score: originalityScore.average_score,
      topical_clusters: topicalMap.topics.length,
      llms_missing: llmsCheck.missing_count,
      perplexity_prompts: perplexityMonitor.prompts.length,
      gsc_content_strategy_status: unifiedInsights.content_strategy?.status || 'MISSING',
      gsc_content_strategy_opportunities: unifiedInsights.content_strategy?.opportunity_leaderboard?.length || 0,
      seo_recently_modified: unifiedInsights.seo_work_history?.recently_modified?.length || 0,
      seo_history_urls: unifiedInsights.seo_work_history?.urls?.length || 0,
      gsc_after_change_targets: unifiedInsights.gsc_after_change_queue?.submit_targets?.length || 0,
      cannibalization_conflicts: unifiedInsights.cannibalization_map?.conflicts?.length || 0,
    },
  };
  writeJson(path.join(REPORT_DIR, 'popraw-seo-insights.json'), unifiedInsights);
  writePoprawSeoInsightsMarkdown(unifiedInsights, path.join(REPORT_DIR, 'popraw-seo-insights.md'));
  writeJson(path.join(REPORT_DIR, 'popraw-seo-wnioski-globalne.json'), unifiedInsights.broad_seo_conclusions);
  writeBroadSeoConclusionsMarkdown(unifiedInsights.broad_seo_conclusions, path.join(REPORT_DIR, 'popraw-seo-wnioski-globalne.md'));
  writeJson(path.join(REPORT_DIR, 'popraw-seo-rokuje.json'), {
    generated_at: unifiedInsights.generated_at,
    status: unifiedInsights.approval_wave.status,
    no_generic_text: true,
    promising: unifiedInsights.approval_wave.promising || [],
  });
  writePromisingPagesMarkdown(unifiedInsights, path.join(REPORT_DIR, 'popraw-seo-rokuje.md'));
  writeJson(path.join(REPORT_DIR, 'popraw-seo-historia.json'), unifiedInsights.seo_work_history);
  writeSeoState('popraw-seo-historia.json', unifiedInsights.seo_work_history);
  writeSeoWorkHistoryMarkdown(unifiedInsights.seo_work_history, path.join(REPORT_DIR, 'popraw-seo-historia.md'));
  writeJson(path.join(REPORT_DIR, 'popraw-seo-gsc-po-zmianach.json'), unifiedInsights.gsc_after_change_queue);
  writeSeoState('popraw-seo-gsc-po-zmianach.json', unifiedInsights.gsc_after_change_queue);
  writeGscAfterChangeMarkdown(unifiedInsights.gsc_after_change_queue, path.join(REPORT_DIR, 'popraw-seo-gsc-po-zmianach.md'));
  writeJson(path.join(REPORT_DIR, 'popraw-seo-kanibalizacja.json'), unifiedInsights.cannibalization_map);
  writeSeoState('popraw-seo-kanibalizacja.json', unifiedInsights.cannibalization_map);
  writeCannibalizationMarkdown(unifiedInsights.cannibalization_map, path.join(REPORT_DIR, 'popraw-seo-kanibalizacja.md'));
  writeJson(path.join(REPORT_DIR, 'popraw-seo.json'), command);
  writePoprawSeoMarkdown(command, path.join(REPORT_DIR, 'popraw-seo.md'));
  writePoprawSeoDecisionMarkdown(command, path.join(REPORT_DIR, 'popraw-seo-decyzje.md'));
  return command;
}

function appendContentStrategyMarkdown(lines, strategy) {
  if (!strategy) return;
  lines.push('## Zewnętrzny Raport GSC Content Strategy');
  lines.push(`- status: ${strategy.status}`);
  if (strategy.path) lines.push(`- plik: ${strategy.path}`);
  if (strategy.generated_date) lines.push(`- data raportu: ${strategy.generated_date}`);
  if (strategy.expected_file && strategy.status !== 'OK') lines.push(`- oczekiwany plik: ${strategy.expected_file}`);
  if (strategy.data_quality?.length) {
    lines.push('- Data Quality Gate:');
    strategy.data_quality.slice(0, 4).forEach((item) => lines.push(`  - ${item}`));
  }
  if (strategy.opportunity_leaderboard?.length) {
    lines.push('### Opportunity Leaderboard Z Raportu Strategii');
    strategy.opportunity_leaderboard.slice(0, 10).forEach((item) => {
      lines.push(`${item.rank}. ${item.file}`);
      lines.push(`   - query: ${item.query}; impr ${item.impressions}; poz ${item.position}; score ${item.score}; priorytet ${item.priority}`);
    });
  }
  if (strategy.quick_wins?.length) {
    lines.push('### Quick Wins Z Raportu Strategii');
    strategy.quick_wins.slice(0, 6).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - ${item.metrics}`);
      if (item.conclusion) lines.push(`   - wniosek: ${item.conclusion}`);
    });
  }
  if (strategy.action_cards?.length) {
    lines.push('### Action Cards Z Raportu Strategii');
    strategy.action_cards.forEach((item) => {
      lines.push(`${item.id}. ${item.file}`);
      if (item.metrics) lines.push(`   - metryki: ${item.metrics}`);
      if (item.proposed_title) lines.push(`   - title: ${item.proposed_title}`);
      if (item.proposed_meta_description) lines.push(`   - meta: ${item.proposed_meta_description}`);
      if (item.h2_faq) lines.push(`   - H2/FAQ: ${item.h2_faq}`);
      if (item.link_places) lines.push(`   - linki: ${item.link_places}`);
      if (item.priority_effect) lines.push(`   - efekt: ${item.priority_effect}`);
    });
  }
  if (strategy.cannibalization?.length) {
    lines.push('### Kanibalizacja Z Raportu Strategii');
    strategy.cannibalization.slice(0, 10).forEach((item) => lines.push(`- ${item}`));
  }
  if (strategy.global_extra_topics?.length) {
    lines.push('### GLOBAL_EXTRA Z Raportu Strategii');
    strategy.global_extra_topics.forEach((item) => lines.push(`- ${item}`));
  }
  if (strategy.gsc_submit_queue?.length) {
    lines.push('### GSC Request Indexing Z Raportu Strategii');
    strategy.gsc_submit_queue.forEach((url) => lines.push(`- ${url}`));
  }
  lines.push('');
}

function appendBroadSeoConclusionsMarkdown(lines, conclusions) {
  if (!conclusions) return;
  lines.push('## Wnioski Dla Całej Witryny');
  lines.push(`- status: ${conclusions.status}`);
  if (conclusions.status !== 'OK') {
    lines.push(`- ${conclusions.reason || 'INSUFFICIENT_DATA'}`);
    lines.push('');
    return;
  }
  const summary = conclusions.summary || {};
  lines.push(`- widoczność artykułów: ${summary.visible_articles}/${summary.articles} (${summary.visible_share_pct}%); bez widoczności: ${summary.zero_visibility_articles}.`);
  lines.push(`- bez potwierdzonej indeksacji: ${summary.indexation_problem}; zindeksowane bez wyświetleń: ${summary.indexed_zero_visibility}.`);
  lines.push(`- szybka pula wzrostu: CTR TOP 10 = ${summary.ctr_gap_top10}; pozycje 11-30 = ${summary.position_11_30}; pozycje 31+ = ${summary.deep_31_100}.`);
  lines.push(`- koncentracja: TOP 10 artykułów daje ${summary.top10_click_share_pct}% kliknięć artykułowych.`);
  if (summary.day_28) {
    lines.push(`- trend 28 dni: kliknięcia ${summary.day_28.clicks} (${formatSigned(summary.day_28.clicks_change_pct)}%), wyświetlenia ${summary.day_28.impressions} (${formatSigned(summary.day_28.impressions_change_pct)}%), pozycja ${summary.day_28.position} wobec ${summary.day_28.previous_position}.`);
  }
  lines.push('');
  lines.push('### Priorytety Systemowe');
  (conclusions.priorities || []).forEach((item) => {
    lines.push(`${item.rank}. ${item.area}`);
    lines.push(`   - dane: ${item.evidence}`);
    lines.push(`   - decyzja: ${item.decision}`);
    lines.push(`   - URL-e: ${item.urls.length}`);
  });
  lines.push('');
  lines.push(`- reguła: ${conclusions.operating_rule}`);
  lines.push('');
}

function writeBroadSeoConclusionsMarkdown(conclusions, file) {
  const lines = ['# Popraw SEO — Wnioski Dla Całej Witryny', '', `Wygenerowano: ${nowWarsawIso()}`, ''];
  appendBroadSeoConclusionsMarkdown(lines, conclusions);
  writeText(file, `${lines.join('\n')}\n`);
}

function appendApprovalAutomationMarkdown(lines, item) {
  const gain = item.estimated_traffic_gain;
  if (gain) {
    lines.push(`   - szacowany zysk kliknięć/mc przy CTR 5%: +${gain.estimated_monthly_click_gain} (dane z ${gain.source_window_days} dni przeliczone na 30 dni; surowy wynik ${gain.raw_monthly_click_gain})`);
  }
  const contract = item.content_contract;
  if (contract) {
    lines.push(`   - kontrakt treści: obecny H1 ${contract.current.headline.status} (${contract.current.headline.length} zn.), meta ${contract.current.meta_description.status} (${contract.current.meta_description.length} zn.); propozycje muszą mieć H1 55-70 i meta 145-160 znaków zakończone . ! lub ?`);
  }
  const guard = item.internal_link_guard;
  if (guard) {
    lines.push(`   - strażnik linków: ${guard.status}; przeskanowano ${guard.scanned}, dopuszczono ${guard.accepted}, odrzucono ${guard.rejected.length}`);
  }
}

function formatDecisionDraftLines(item) {
  const lines = [];
  if (item.current_title || item.proposed_title) {
    lines.push(`   - obecny title: ${item.current_title || 'MISSING'}`);
    lines.push(`   - proponowany title: ${item.proposed_title || 'INSUFFICIENT_DATA'}`);
  }
  if (item.current_meta_description || item.proposed_meta_description) {
    lines.push(`   - obecna meta: ${item.current_meta_description || 'MISSING'}`);
    lines.push(`   - proponowana meta: ${item.proposed_meta_description || 'INSUFFICIENT_DATA'}`);
  }
  const link = (item.internal_link_suggestions || [])[0];
  if (link) {
    lines.push(`   - proponowany link: ${link.from} -> ${item.file}, anchor: "${link.anchor || 'INSUFFICIENT_DATA'}"`);
  }
  if (!lines.length) {
    lines.push('   - draft: INSUFFICIENT_DATA; najpierw trzeba przygotować konkretny tekst w rozmowie.');
  }
  return lines;
}

function writePoprawSeoDecisionMarkdown(command, file) {
  const approval = command.approval_wave || {};
  const groups = [
    ['BOOST', approval.boost || []],
    ['ROKUJE', approval.promising || []],
    ['NAPRAWA', approval.repair || []],
    ['MONITORING', approval.monitoring || []],
  ];
  const lines = ['# Popraw SEO — Decyzje', '', `Wygenerowano: ${command.generated_at}`, '', 'Status: AWAITING_USER_APPROVAL', ''];
  lines.push('Wybierz konkretne ID. Agent może edytować HTML dopiero po Twojej akceptacji.');
  lines.push('');
  for (const [kind, items] of groups) {
    lines.push(`## ${kind}`);
    if (!items.length) {
      lines.push('- brak kandydatów w tym koszyku');
      lines.push('');
      continue;
    }
    items.forEach((item) => {
      lines.push(`### ${item.id}: ${item.file}`);
      lines.push(`- URL: ${item.url}`);
      lines.push(`- query: ${item.gsc?.query || 'brak'}; impr ${item.gsc?.impressions || 0}; klik ${item.gsc?.clicks || 0}; CTR ${item.gsc?.ctr || 0}%; poz ${item.gsc?.position || 0}`);
      lines.push(`- powód: ${item.reason}`);
      formatDecisionDraftLines(item).forEach((line) => lines.push(line));
      lines.push(`- aby wdrożyć: \`popraw ${item.id}\``);
      lines.push('');
    });
  }
  const queue = command.unified_insights?.gsc_after_change_queue;
  if (queue?.submit_targets?.length) {
    lines.push('## GSC Po Zmianach');
    queue.submit_targets.slice(0, 20).forEach((url) => lines.push(`- ${url}`));
    lines.push('');
  }
  lines.push('## Zasady');
  lines.push('- Brak draftu oznacza `INSUFFICIENT_DATA`, nie automatyczne dopisywanie ogólników.');
  lines.push('- Po akceptacji ID agent aktualizuje tylko wskazane URL-e, dateModified, sitemap, PDF/mirror i walidację.');
  writeText(file, lines.join('\n'));
}

function writePoprawSeoMarkdown(command, file) {
  const lines = ['# Popraw SEO — Plan Do Zatwierdzenia', '', `Wygenerowano: ${command.generated_at}`, '', `Status: ${command.status}`, ''];
  const insights = command.unified_insights || {};
  const approval = command.approval_wave || insights.approval_wave || {};
  if (Array.isArray(insights.ignored_today) && insights.ignored_today.length) {
    lines.push(`Pominięte dziś: ${insights.ignored_today.join(', ')}`);
    lines.push('');
  }
  if (Array.isArray(insights.key_insights) && insights.key_insights.length) {
    lines.push('## Kluczowe Wnioski Z Raportów');
    insights.key_insights.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }
  appendBroadSeoConclusionsMarkdown(lines, insights.broad_seo_conclusions);
  const layers = insights.gsc_measurement_layers;
  if (layers?.pages?.current && layers?.disclosed_queries?.current) {
    lines.push('## GSC — Warstwy Pomiaru');
    if (layers.property?.current) {
      lines.push(`- Cała usługa (główny KPI): kliknięcia ${Math.round(layers.property.current.total_clicks || 0)}, wyświetlenia ${Math.round(layers.property.current.total_impressions || 0)}.`);
    } else {
      lines.push('- Cała usługa: INSUFFICIENT_DATA; głównym zastępczym wynikiem jest suma stron.');
    }
    lines.push(`- Strony: kliknięcia ${Math.round(layers.pages.current.total_clicks || 0)}, wyświetlenia ${Math.round(layers.pages.current.total_impressions || 0)}.`);
    lines.push(`- Ujawnione zapytania: kliknięcia ${Math.round(layers.disclosed_queries.current.total_clicks || 0)}, wyświetlenia ${Math.round(layers.disclosed_queries.current.total_impressions || 0)}; tej warstwy nie wolno przedstawiać jako wyniku całej witryny.`);
    lines.push('');
  }
  appendContentStrategyMarkdown(lines, insights.content_strategy);
  lines.push('## Paczka Do Zatwierdzenia');
  if (approval.visibility_click_objective) {
    const objective = approval.visibility_click_objective;
    lines.push(`- Cel: ${objective.rule}`);
    lines.push(`- Widoczne artykuły: ${objective.visible_articles}; z kliknięciami: ${objective.clicking_articles}; bez wyświetleń: ${objective.zero_visibility_articles}; szacowany potencjał kliknięć/mies.: ${objective.estimated_monthly_click_gain}.`);
  }
  if (approval.coverage_contract) {
    lines.push(`- Pełne pokrycie: ${approval.coverage_contract.status}; artykuły ${approval.coverage_contract.article_inventory}; przypisane działania ${approval.coverage_contract.assigned_actions}; pominięte ${approval.coverage_contract.omitted_articles.length}.`);
  }
  lines.push('- `BOOST` = strony, które Google już pokazuje; poprawiamy CTR, doprecyzowanie leadu i linkowanie.');
  lines.push('- `ROKUJE` = drugi raport: strony niebędące liderami, ale mające sygnał GSC albo miejsce w strategii; po liderach wzmacniamy je równie konkretnie.');
  lines.push('- `NAPRAWA` = strony słabe albo bez widoczności; najpierw budujemy konkretną odpowiedź, FAQ, źródła i linki.');
  lines.push('- `MONITORING` = strony w cooldownie albo działające targety; pozostają w raporcie, ale bez kolejnej edycji przed wynikiem checkpointu.');
  lines.push('- Zakaz generycznych dopisków: przed edycją HTML agent ma przygotować gotowy tekst w rozmowie i czekać na akceptację.');
  lines.push('');
  if (Array.isArray(approval.boost) && approval.boost.length) {
    lines.push('### BOOST — Strony Blisko Wzrostu');
    approval.boost.forEach((item) => {
      lines.push(`${item.id}. ${item.file}`);
      lines.push(`   - URL: ${item.url}`);
      lines.push(`   - powód: ${item.reason}`);
      lines.push(`   - GSC: query "${item.gsc.query || 'brak'}"; impr ${item.gsc.impressions}; klik ${item.gsc.clicks}; CTR ${item.gsc.ctr}%; poz ${item.gsc.position}`);
      appendApprovalAutomationMarkdown(lines, item);
      if (item.internal_link_suggestions?.length) {
        lines.push(`   - linki do rozważenia: ${item.internal_link_suggestions.map((link) => `${link.from} -> "${link.anchor || 'anchor do przygotowania'}"`).join('; ')}`);
      }
      lines.push(`   - przed edycją przygotuj: ${item.prepare_before_edit.join('; ')}`);
    });
    lines.push('');
  }
  if (Array.isArray(approval.promising) && approval.promising.length) {
    lines.push('### ROKUJE — Drugi Raport Stron Z Potencjałem');
    approval.promising.forEach((item) => {
      lines.push(`${item.id}. ${item.file}`);
      lines.push(`   - URL: ${item.url}`);
      lines.push(`   - powód: ${item.reason}`);
      lines.push(`   - GSC/strategia: query "${item.gsc.query || 'brak'}"; impr ${item.gsc.impressions}; klik ${item.gsc.clicks}; CTR ${item.gsc.ctr}%; poz ${item.gsc.position}`);
      appendApprovalAutomationMarkdown(lines, item);
      if (item.internal_link_suggestions?.length) {
        lines.push(`   - linki do rozważenia: ${item.internal_link_suggestions.map((link) => `${link.from} -> "${link.anchor || 'anchor do przygotowania'}"`).join('; ')}`);
      }
      lines.push(`   - przed edycją przygotuj: ${item.prepare_before_edit.join('; ')}`);
    });
    lines.push('');
  }
  if (Array.isArray(approval.repair) && approval.repair.length) {
    lines.push('### NAPRAWA — Słabe Strony Do Podnoszenia');
    approval.repair.forEach((item) => {
      lines.push(`${item.id}. ${item.file}`);
      lines.push(`   - URL: ${item.url}`);
      lines.push(`   - powód: ${item.reason}`);
      lines.push(`   - wynik SEO/AEO/GEO/AIO: ${item.scores.seo}/${item.scores.aeo}/${item.scores.geo}/${item.scores.aio}`);
      appendApprovalAutomationMarkdown(lines, item);
      if (item.report_tasks?.length) lines.push(`   - zadania z raportu: ${item.report_tasks.join('; ')}`);
      if (item.internal_link_suggestions?.length) {
        lines.push(`   - linki do rozważenia: ${item.internal_link_suggestions.map((link) => `${link.from} -> "${link.anchor || 'anchor do przygotowania'}"`).join('; ')}`);
      }
      lines.push(`   - przed edycją przygotuj: ${item.prepare_before_edit.join('; ')}`);
    });
    lines.push('');
  }
  if (Array.isArray(approval.monitoring) && approval.monitoring.length) {
    lines.push('### MONITORING — Bez Pomijania URL-i');
    approval.monitoring.forEach((item) => {
      lines.push(`${item.id}. ${item.file}`);
      lines.push(`   - URL: ${item.url}`);
      lines.push(`   - powód: ${item.reason}`);
      lines.push(`   - GSC: impr ${item.gsc.impressions}; klik ${item.gsc.clicks}; CTR ${item.gsc.ctr}%; poz ${item.gsc.position}`);
      lines.push(`   - konkretne działanie dla URL-a: ${item.required_action?.required_change || item.report_tasks?.[0] || 'INSUFFICIENT_DATA'}`);
      lines.push(`   - warunek monitoringu: ${item.prepare_before_edit.join('; ')}`);
    });
    lines.push('');
  }
  if (Array.isArray(approval.full_portfolio) && approval.full_portfolio.length) {
    lines.push('### Pełny Portfel — Każdy Artykuł Ma Działanie');
    approval.full_portfolio.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.file} — ${item.diagnosis}; ${item.cooldown_status}`);
      lines.push(`   - działanie: ${item.required_action}`);
    });
    lines.push('');
  }
  lines.push('## Zasada Akceptacji');
  lines.push(`- ${command.approval_needed}`);
  lines.push('- Jeśli użytkownik poda same numery, a numeracja jest niejednoznaczna, agent ma doprecyzować ID przed edycją.');
  lines.push('- Po akceptacji konkretnego ID agent edytuje tylko wskazane strony i zgłasza tylko wynikające z nich URL-e do GSC.');
  lines.push('');
  const push = insights.gsc_priority?.push_to_page_one || [];
  if (push.length) {
    lines.push('## GSC: Najbliżej Wzrostu');
    push.slice(0, 8).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - query: ${item.query || 'brak'}; impr ${item.impressions}; klik ${item.clicks}; CTR ${item.ctr}%; poz ${item.position}`);
      if (item.tasks?.length) lines.push(`   - zadanie: ${item.tasks[0]}`);
    });
    lines.push('');
  }
  const discovery = insights.gsc_priority?.build_discovery || [];
  if (discovery.length) {
    lines.push('## GSC: Budowa Widoczności');
    discovery.slice(0, 6).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - decyzja: ${item.decision}; SEO/AEO/GEO/AIO ${item.seo}/${item.aeo}/${item.geo}/${item.aio}`);
      if (item.tasks?.length) lines.push(`   - zadanie: ${item.tasks[0]}`);
    });
    lines.push('');
  }
  if (insights.generative_ai_visibility) {
    const ai = insights.generative_ai_visibility;
    lines.push('## GSC Generative AI');
    lines.push(`- status: ${ai.status}`);
    lines.push(`- podsumowanie: URL-e ${ai.summary?.pages || 0}, AI impressions ${ai.summary?.impressions || 0}, clicks ${ai.summary?.clicks || 0}`);
    if (ai.source_files?.length) lines.push(`- źródła: ${ai.source_files.join(', ')}`);
    if (ai.top_pages?.length) {
      ai.top_pages.slice(0, 6).forEach((item, idx) => {
        lines.push(`${idx + 1}. ${item.file} — AI impressions ${item.impressions}; features: ${(item.features || []).join(', ') || 'brak'}`);
      });
    } else {
      lines.push('- brak eksportu: gdy raport pojawi się w Search Console, wrzuć CSV/JSON do `gsc-auto-input`.');
    }
    lines.push('');
  }
  if (insights.post_deploy_kpi?.candidates?.length) {
    lines.push('## KPI Po Wdrożeniu');
    lines.push(`- status: ${insights.post_deploy_kpi.status}; GSC Generative AI: ${insights.post_deploy_kpi.ai_report_status}`);
    insights.post_deploy_kpi.candidates.slice(0, 8).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - baseline Web: impr ${item.baseline.impressions}, klik ${item.baseline.clicks}, CTR ${item.baseline.ctr}%, poz ${item.baseline.position}`);
      lines.push(`   - baseline AI: impressions ${item.baseline.ai_impressions}, clicks ${item.baseline.ai_clicks}`);
      lines.push(`   - checkpointy: ${item.checkpoints ? Object.values(item.checkpoints).join(' / ') : 'brak dateModified'}`);
    });
    lines.push('');
  }
  if (insights.seo_work_history?.recently_modified?.length) {
    lines.push('## Historia Poprawek / Cooldown');
    insights.seo_work_history.recently_modified.slice(0, 10).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - dateModified: ${item.date_modified}; wiek ${item.age_days} dni; status ${item.status}; następna kontrola: ${item.next_review}`);
      lines.push(`   - baseline: impr ${item.baseline.impressions}, klik ${item.baseline.clicks}, CTR ${item.baseline.ctr}%, poz ${item.baseline.position}`);
    });
    lines.push('');
  }
  if (insights.gsc_after_change_queue?.items?.length) {
    lines.push('## GSC Po Zaakceptowanych Zmianach');
    lines.push(`- status: ${insights.gsc_after_change_queue.status}; ${insights.gsc_after_change_queue.rule}`);
    insights.gsc_after_change_queue.items.slice(0, 12).forEach((item) => {
      lines.push(`- ${item.id}: ${(item.submit_urls || []).join(', ') || item.target_url}`);
    });
    lines.push('');
  }
  if (insights.cannibalization_map) {
    const map = insights.cannibalization_map;
    lines.push('## Kanibalizacja / Decyzja Głównego URL-a');
    lines.push(`- status: ${map.status}; ${map.rule}`);
    if (map.conflicts?.length) {
      map.conflicts.slice(0, 6).forEach((item, idx) => {
        lines.push(`${idx + 1}. ${item.query}: główny ${item.main_file}; wspierające ${item.supporting_files.join(', ') || 'brak'}`);
      });
    }
    if (map.strategy_notes?.length) {
      lines.push(`- notatki z raportu strategii: ${map.strategy_notes.length}`);
    }
    lines.push('');
  }
  if (insights.originality_attention?.length) {
    lines.push('## Originality / Własne Dane Do Poprawy');
    insights.originality_attention.slice(0, 10).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - score: ${item.score}%; braki: ${item.gaps.join(', ') || 'brak'}`);
      lines.push(`   - rekomendacja: ${item.recommendation}`);
    });
    lines.push('');
  }
  lines.push('## Co się stało');
  command.what_happened.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('## Proponowane artykuły');
  command.chosen_articles.forEach((article) => {
    lines.push(`${article.nr}. ${article.file}`);
    lines.push(`   - temat: ${article.topic}; score: ${article.score}`);
    lines.push(`   - działania: ${article.actions.join(', ')}`);
  });
  lines.push('');
  lines.push('## Co Teraz');
  lines.push(`- ${command.approval_needed}`);
  lines.push('- Realna edycja nie została wykonana.');
  lines.push('- Następny krok to przygotowanie ręcznych tekstów w rozmowie: Evidence Box, linki, ewentualna tabela/checklista i hub-link.');
  lines.push('- HTML edytuj dopiero po akceptacji użytkownika.');
  lines.push('');
  lines.push('## Raporty');
  Object.values(command.reports).forEach((report) => lines.push(`- ${report}`));
  if (command.external_reports?.gsc_content_strategy) {
    lines.push(`- ${command.external_reports.gsc_content_strategy}`);
  }
  writeText(file, lines.join('\n'));
}

function writePromisingPagesMarkdown(insights, file) {
  const approval = insights.approval_wave || {};
  const items = Array.isArray(approval.promising) ? approval.promising : [];
  const lines = ['# Popraw SEO — ROKUJE', '', `Wygenerowano: ${insights.generated_at}`, '', `Status: ${approval.status || 'AWAITING_USER_APPROVAL'}`, ''];
  lines.push('## Jak Czytać Ten Raport');
  lines.push('- To jest drugi raport po liderach: strony nie są jeszcze głównymi zwycięzcami, ale mają realny sygnał z GSC albo raportu strategii.');
  lines.push('- Pracujemy na nich po `BOOST`/najpilniejszych stronach, bo mogą wejść do kolejnej fali wzrostu.');
  lines.push('- Nie wolno dodawać generycznych bloków. Każda zmiana musi wynikać z frazy, metryki, intencji, źródła, progu, liczby albo konkretnej luki w artykule.');
  lines.push('- Po zaakceptowanej edycji zgłaszamy zmieniony URL w GSC oraz, jeśli ma sens, 1-3 strony źródłowe z nowymi linkami wewnętrznymi.');
  lines.push('');
  if (!items.length) {
    lines.push('Brak kandydatów `ROKUJE` w obecnych danych.');
    writeText(file, lines.join('\n'));
    return;
  }
  lines.push('## Kandydaci Do Kolejnej Fali');
  items.forEach((item) => {
    lines.push(`${item.id}. ${item.file}`);
    lines.push(`   - URL: ${item.url}`);
    lines.push(`   - query: ${item.gsc.query || 'brak'}; impr ${item.gsc.impressions}; klik ${item.gsc.clicks}; CTR ${item.gsc.ctr}%; poz ${item.gsc.position}`);
    appendApprovalAutomationMarkdown(lines, item);
    lines.push(`   - dlaczego rokuje: ${item.reason}`);
    lines.push(`   - przygotuj przed HTML: ${item.prepare_before_edit.join('; ')}`);
    if (item.gsc_submit_after_change?.length) lines.push(`   - GSC po zmianie: ${item.gsc_submit_after_change.join(', ')}`);
  });
  lines.push('');
  lines.push('## Zasada Akceptacji');
  lines.push('- Użytkownik zatwierdza konkretne ID, np. `popraw ROKUJE 1`.');
  lines.push('- Jeśli użytkownik poda same numery, agent musi dopytać, czy chodzi o `BOOST`, `ROKUJE` czy `NAPRAWA`.');
  lines.push('- Najpierw pokazujemy gotowe teksty w rozmowie. HTML dopiero po akceptacji.');
  writeText(file, lines.join('\n'));
}

function writeSeoWorkHistoryMarkdown(history, file) {
  const lines = ['# Popraw SEO — Historia I Cooldown', '', `Wygenerowano: ${history?.generated_at || nowWarsawIso()}`, ''];
  lines.push('## Zasada');
  lines.push('- Jeśli URL był świeżo poprawiany, nie wciskamy go od razu do kolejnej fali zmian.');
  lines.push('- Najpierw patrzymy na checkpointy 7/14/28 dni: wyświetlenia, kliknięcia, CTR, pozycję, AI impressions i jakość wizyty.');
  lines.push('- Dopiero po KPI decydujemy, czy poprawiać title/meta, lead, FAQ, linkowanie czy zostawić stronę w spokoju.');
  lines.push('');
  const items = history?.recently_modified || [];
  if (!items.length) {
    lines.push('Brak świeżo modyfikowanych URL-i w ostatnich 45 dniach.');
  } else {
    lines.push('## Ostatnio Zmienione URL-e');
    items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.file}`);
    lines.push(`   - dataModified: ${item.date_modified}; wiek: ${item.age_days} dni; status: ${item.status}`);
    lines.push(`   - baseline: impr ${item.baseline.impressions}; klik ${item.baseline.clicks}; CTR ${item.baseline.ctr}%; poz ${item.baseline.position}`);
    lines.push(`   - obecnie: impr ${item.current.impressions}; klik ${item.current.clicks}; CTR ${item.current.ctr}%; poz ${item.current.position}`);
    lines.push(`   - checkpointy: ${item.checkpoints ? Object.values(item.checkpoints).join(' / ') : 'brak dateModified'}`);
    for (const [label, checkpoint] of Object.entries(item.delta_tracker || {})) {
      if (checkpoint.status !== 'READY') {
        lines.push(`   - delta ${label.replace('_', ' ')}: ${checkpoint.status} do ${checkpoint.date}`);
        continue;
      }
      const delta = checkpoint.delta;
      lines.push(`   - delta ${label.replace('_', ' ')}: impr ${delta.impressions >= 0 ? '+' : ''}${delta.impressions}; klik ${delta.clicks >= 0 ? '+' : ''}${delta.clicks}; CTR ${delta.ctr_percentage_points >= 0 ? '+' : ''}${delta.ctr_percentage_points} pp; poprawa pozycji ${delta.position_improvement >= 0 ? '+' : ''}${delta.position_improvement}`);
    }
    lines.push(`   - następna kontrola: ${item.next_review}`);
    });
  }
  lines.push('');
  lines.push('## Pełny Rejestr URL-i');
  lines.push(`- pokrycie: ${history?.coverage?.urls_with_history || 0}/${history?.coverage?.article_inventory || 0}; pominięte ${(history?.coverage?.omitted_urls || []).length}`);
  (history?.urls || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.file} — dateModified ${item.date_modified}; baseline ${item.baseline.impressions} impr / ${item.baseline.clicks} klik; zdarzenia zmian ${(item.change_events || []).length}`);
  });
  writeText(file, lines.join('\n'));
}

function writeGscAfterChangeMarkdown(queue, file) {
  const lines = ['# Popraw SEO — GSC Po Zmianach', '', `Wygenerowano: ${queue?.generated_at || nowWarsawIso()}`, `Status: ${queue?.status || 'EMPTY_AWAITING_REAL_DEPLOYMENT'}`, ''];
  lines.push('## Zasada');
  lines.push(`- ${queue?.rule || 'Zgłaszamy URL dopiero po realnej zmianie strony.'}`);
  lines.push('- Najpierw akceptacja tekstu, potem HTML, dateModified, sitemap/_site, walidacja, dopiero potem GSC.');
  lines.push('');
  const items = queue?.items || [];
  if (!items.length) {
    lines.push('Brak URL-i w kolejce po zmianach.');
    writeText(file, lines.join('\n'));
    return;
  }
  lines.push('## Kolejka Według ID');
  items.forEach((item) => {
    lines.push(`${item.id}. ${item.file}`);
    lines.push(`   - koszyk: ${item.kind}`);
    lines.push(`   - wdrożone dateModified: ${item.date_modified}`);
    lines.push(`   - zgłoś: ${(item.submit_urls || []).join(', ') || item.target_url}`);
    lines.push(`   - dowód wdrożenia: ${item.deployment_evidence?.status || 'MISSING'}`);
    lines.push(`   - monitoruj: ${item.monitor_after}`);
  });
  lines.push('');
  lines.push('## Płaska Lista URL-i');
  (queue.submit_targets || []).forEach((url) => lines.push(`- ${url}`));
  writeText(file, lines.join('\n'));
}

function writeCannibalizationMarkdown(map, file) {
  const lines = ['# Popraw SEO — Kanibalizacja', '', `Wygenerowano: ${map?.generated_at || nowWarsawIso()}`, `Status: ${map?.status || 'NO_STRONG_CONFLICTS'}`, ''];
  lines.push('## Zasada');
  lines.push(`- ${map?.rule || 'Nie wzmacniaj dwóch URL-i pod tę samą intencję.'}`);
  lines.push('');
  lines.push('## Trwała Mapa Właścicieli Intencji');
  lines.push(`- intencje: ${map?.coverage?.intents || 0}; potwierdzone GSC: ${map?.coverage?.confirmed_by_gsc || 0}; wymagają researchu: ${map?.coverage?.research_required || 0}`);
  (map?.intent_owners || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.intent} → ${item.main_file} (${item.owner_status}; ${item.evidence_source}; ${item.confidence})`);
    if (item.supporting_files?.length) lines.push(`   - wspierające: ${item.supporting_files.join(', ')}`);
  });
  lines.push('');
  if (map?.conflicts?.length) {
    lines.push('## Konflikty Z Danych Lokalnych');
    map.conflicts.forEach((item, index) => {
      lines.push(`${index + 1}. Fraza/intencja: ${item.query}`);
      lines.push(`   - główny URL: ${item.main_file}`);
      lines.push(`   - wspierające: ${item.supporting_files.join(', ') || 'brak'}`);
      lines.push(`   - decyzja: ${item.action}`);
      lines.push(`   - status rekomendacji: ${item.recommendation_status}; ${item.canonical_note}`);
      (item.supporting_pages || []).forEach((support) => {
        lines.push(`   - ${support.file}: ${support.status}${support.suggested_html ? `; HTML: ${support.suggested_html}` : ''}`);
      });
      lines.push(`   - metryki: ${item.metrics.map((metric) => `${metric.file} impr ${metric.impressions}, klik ${metric.clicks}, poz ${metric.position}`).join('; ')}`);
    });
    lines.push('');
  }
  if (map?.strategy_notes?.length) {
    lines.push('## Notatki Z Raportu Strategii');
    map.strategy_notes.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }
  if (!map?.conflicts?.length && !map?.strategy_notes?.length) {
    lines.push('Brak mocnych sygnałów kanibalizacji w obecnych danych.');
  }
  writeText(file, lines.join('\n'));
}

function writePoprawSeoInsightsMarkdown(insights, file) {
  const lines = ['# Popraw SEO — Wnioski Z GSC I Raportów', '', `Wygenerowano: ${insights.generated_at}`, ''];
  if (insights.ignored_today?.length) {
    lines.push(`Pominięte dziś: ${insights.ignored_today.join(', ')}`);
    lines.push('');
  }
  lines.push('## Źródła');
  Object.entries(insights.source_reports || {}).forEach(([key, ok]) => {
    lines.push(`- ${key}: ${ok ? 'OK' : 'brak'}`);
  });
  lines.push('');
  lines.push('## Wnioski');
  (insights.key_insights || []).forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  appendContentStrategyMarkdown(lines, insights.content_strategy);

  const groups = [
    ['GSC: Szybkie Wejście Wyżej', insights.gsc_priority?.push_to_page_one || []],
    ['ROKUJE: Kolejna Fala Po Liderach', (insights.approval_wave?.promising || []).map((item) => ({
      file: item.file,
      query: item.gsc?.query || '',
      impressions: item.gsc?.impressions || 0,
      clicks: item.gsc?.clicks || 0,
      ctr: item.gsc?.ctr || 0,
      position: item.gsc?.position || 0,
      seo: item.scores?.seo || 0,
      aeo: item.scores?.aeo || 0,
      geo: item.scores?.geo || 0,
      aio: item.scores?.aio || 0,
      decision: item.decision || 'wzmocnić po liderach',
      tasks: item.prepare_before_edit || [],
      source_links: (item.internal_link_suggestions || []).map((link) => link.from),
    }))],
    ['GSC: Budowa Widoczności', insights.gsc_priority?.build_discovery || []],
    ['GSC: Skalowanie Zwycięzców', insights.gsc_priority?.scale_winners || []],
    ['Linkowanie Wspierające', insights.gsc_priority?.core_support || []],
  ];
  for (const [title, items] of groups) {
    if (!items.length) continue;
    lines.push(`## ${title}`);
    items.slice(0, 12).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - query: ${item.query || 'brak'}; impr ${item.impressions}; klik ${item.clicks}; CTR ${item.ctr}%; poz ${item.position}`);
      lines.push(`   - SEO/AEO/GEO/AIO: ${item.seo}/${item.aeo}/${item.geo}/${item.aio}; decyzja: ${item.decision}`);
      if (item.source_links?.length) lines.push(`   - linki źródłowe: ${item.source_links.join(', ')}`);
      if (item.tasks?.length) lines.push(`   - pierwsze zadanie: ${item.tasks[0]}`);
    });
    lines.push('');
  }

  if (insights.link_topology_attention?.length) {
    lines.push('## Link Topology Do Sprawdzenia');
    insights.link_topology_attention.forEach((item) => {
      lines.push(`- ${item.file}: inbound ${item.inbound}; kandydaci: ${item.suggested_sources.join(', ') || 'brak'}`);
    });
    lines.push('');
  }

  if (insights.ai_visibility_attention?.length) {
    lines.push('## AI Visibility');
    insights.ai_visibility_attention.forEach((item) => {
      lines.push(`- ${item.engine}: ${item.prompt}`);
      lines.push(`  canonical: ${item.canonical_url}; priorytet: ${item.priority}`);
    });
    lines.push('');
  }

  if (insights.generative_ai_visibility) {
    const ai = insights.generative_ai_visibility;
    lines.push('## GSC Generative AI');
    lines.push(`- status: ${ai.status}`);
    lines.push(`- summary: URL-e ${ai.summary?.pages || 0}, AI impressions ${ai.summary?.impressions || 0}, clicks ${ai.summary?.clicks || 0}`);
    if (ai.source_files?.length) lines.push(`- źródła: ${ai.source_files.join(', ')}`);
    (ai.top_pages || []).slice(0, 10).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}: AI impressions ${item.impressions}; features: ${(item.features || []).join(', ') || 'brak'}`);
    });
    if (!(ai.top_pages || []).length) lines.push('- Brak eksportu albo raport nie jest jeszcze dostępny w rollout.');
    lines.push('');
  }

  if (insights.snippet_controls) {
    const snippet = insights.snippet_controls;
    lines.push('## Snippet Controls');
    lines.push(`- status: ${snippet.status}`);
    lines.push(`- przeskanowane HTML: ${snippet.summary?.scanned_html || 0}; do sprawdzenia: ${snippet.summary?.review_count || 0}; celowe noindex: ${snippet.summary?.intentional_noindex_count || 0}`);
    (snippet.review || []).slice(0, 8).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - problemy: ${item.issues.join(', ')}`);
      lines.push(`   - robots: ${item.controls.robots_content.join(' | ') || 'brak'}`);
    });
    if (!(snippet.review || []).length) lines.push('- Brak restrykcyjnych kontroli snippetu wymagających reakcji na artykułach.');
    lines.push('');
  }

  if (insights.post_deploy_kpi?.candidates?.length) {
    lines.push('## KPI Po Wdrożeniu 7/14/28');
    insights.post_deploy_kpi.candidates.slice(0, 12).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - Web: impr ${item.baseline.impressions}, klik ${item.baseline.clicks}, CTR ${item.baseline.ctr}%, poz ${item.baseline.position}`);
      lines.push(`   - AI: impressions ${item.baseline.ai_impressions}, clicks ${item.baseline.ai_clicks}`);
      lines.push(`   - checkpointy: ${item.checkpoints ? Object.values(item.checkpoints).join(' / ') : 'brak dateModified'}`);
    });
    lines.push('');
  }

  if (insights.seo_work_history?.recently_modified?.length) {
    lines.push('## Historia Poprawek / Cooldown');
    insights.seo_work_history.recently_modified.slice(0, 12).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.file}`);
      lines.push(`   - dateModified: ${item.date_modified}; wiek ${item.age_days} dni; status ${item.status}; następna kontrola: ${item.next_review}`);
    });
    lines.push('');
  }

  if (insights.gsc_after_change_queue?.items?.length) {
    lines.push('## GSC Po Zaakceptowanych Zmianach');
    lines.push(`- ${insights.gsc_after_change_queue.rule}`);
    insights.gsc_after_change_queue.items.slice(0, 15).forEach((item) => {
      lines.push(`- ${item.id}: ${(item.submit_urls || []).join(', ') || item.target_url}`);
    });
    lines.push('');
  }

  if (insights.cannibalization_map) {
    const map = insights.cannibalization_map;
    lines.push('## Kanibalizacja');
    lines.push(`- status: ${map.status}; ${map.rule}`);
    (map.conflicts || []).slice(0, 8).forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.query}: główny ${item.main_file}; wspierające ${item.supporting_files.join(', ') || 'brak'}`);
    });
    if (map.strategy_notes?.length) lines.push(`- notatki strategii: ${map.strategy_notes.length}`);
    lines.push('');
  }

  if (insights.originality_attention?.length) {
    lines.push('## Originality / Własne Dane');
    insights.originality_attention.forEach((item) => {
      lines.push(`- ${item.file}: score ${item.score}%; braki: ${item.gaps.join(', ') || 'brak'}; ${item.recommendation}`);
    });
    lines.push('');
  }

  if (insights.gsc_submit_queue?.length) {
    lines.push('## GSC Submit Queue');
    insights.gsc_submit_queue.slice(0, 25).forEach((url) => lines.push(`- ${url}`));
    lines.push('');
  }

  if (insights.operational_warnings?.length) {
    lines.push('## Ostrzeżenia Operacyjne');
    insights.operational_warnings.forEach((item) => lines.push(`- ${item.label}: ${item.details}`));
    lines.push('');
  }

  writeText(file, lines.join('\n'));
}

function applyGrowth(flags) {
  const file = String(flags.file || '').replace(/^\.?\//, '');
  if (!file || !file.endsWith('.html')) throw new Error('Podaj --file NAZWA.html');
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error(`Nie ma pliku: ${file}`);
  if (flags.write && !flags['allow-generic']) {
    throw new Error('growth:apply nie zapisuje już generycznych bloków. Użyj dry-run, a potem przygotuj ręcznie dopasowaną treść dla konkretnego artykułu.');
  }
  const article = extractArticle(file);
  const blocks = [];
  if (flags['evidence-box']) blocks.push(buildEvidenceBox(article));
  if (flags['doctor-box']) blocks.push(buildDoctorBox(article));
  if (flags['share-table']) blocks.push(buildShareableTable(article));
  if (!blocks.length) throw new Error('Podaj co dodać: --evidence-box, --doctor-box albo --share-table');

  const plan = {
    generated_at: nowWarsawIso(),
    file,
    write: Boolean(flags.write),
    blocks: blocks.map((block) => ({ id: block.id, insert_before: block.insertBefore })),
  };
  writeJson(path.join(REPORT_DIR, 'apply-plan.json'), plan);
  if (!flags.write) {
    console.log(`[GROWTH] dry-run: zapisano ${path.join(REPORT_DIR, 'apply-plan.json')}`);
    return plan;
  }

  let html = article.html;
  for (const block of blocks) {
    if (html.includes(block.marker)) continue;
    const index = html.search(block.insertBefore);
    if (index === -1) throw new Error(`Nie znaleziono punktu wstawienia dla ${block.id}`);
    html = `${html.slice(0, index)}${block.html}\n\n${html.slice(index)}`;
  }
  html = updateModifiedDate(html);
  fs.writeFileSync(abs, html, 'utf8');
  console.log(`[GROWTH] zapisano: ${file}`);
  return plan;
}

function buildEvidenceBox(article) {
  const title = article.h1 || article.title || article.file.replace(/\.html$/, '');
  return {
    id: 'evidence-box',
    marker: 'fitpo50-growth-evidence',
    insertBefore: /<section class="share-article-section|<section[^>]+id="faq"|<footer/i,
    html: `<section class="article-section reveal fitpo50-growth-evidence" aria-labelledby="growth-evidence-title">
  <h2 id="growth-evidence-title">Co mówią badania i praktyka?</h2>
  <div class="evidence-box">
    <p><strong>Najważniejszy wniosek:</strong> ${escapeHtml(title)} warto oceniać przez konkretne objawy, regularność działania i bezpieczeństwo, a nie przez pojedynczą modę lub poradę z internetu.</p>
    <ul>
      <li><strong>Dla kogo:</strong> dla osób po 50. roku życia, które chcą podjąć decyzję praktyczną i możliwą do monitorowania.</li>
      <li><strong>Co sprawdzić:</strong> punkt wyjścia, reakcję organizmu po 2–4 tygodniach oraz czynniki ryzyka zależne od zdrowia i leków.</li>
      <li><strong>Poziom pewności:</strong> najwyższy tam, gdzie zalecenie wspierają wytyczne, badania kliniczne i powtarzalne obserwacje.</li>
    </ul>
  </div>
</section>`,
  };
}

function buildDoctorBox(article) {
  const title = article.h1 || article.title || 'ten temat';
  return {
    id: 'doctor-box',
    marker: 'fitpo50-growth-doctor',
    insertBefore: /<section class="share-article-section|<section[^>]+id="faq"|<footer/i,
    html: `<section class="article-section reveal fitpo50-growth-doctor" aria-labelledby="growth-doctor-title">
  <h2 id="growth-doctor-title">Kiedy do lekarza?</h2>
  <p>Skonsultuj ${escapeHtml(title).toLowerCase()} z lekarzem, jeśli objawy są nagłe, nasilają się, wracają mimo zmian stylu życia albo występują razem z bólem w klatce piersiowej, dusznością, omdleniem, zaburzeniami neurologicznymi lub niepokojącymi wynikami badań.</p>
</section>`,
  };
}

function buildShareableTable(article) {
  return {
    id: 'share-table',
    marker: 'fitpo50-growth-table',
    insertBefore: /<section class="share-article-section|<section[^>]+id="faq"|<footer/i,
    html: `<section class="article-section reveal fitpo50-growth-table" aria-labelledby="growth-table-title">
  <h2 id="growth-table-title">Co zapamiętać z tabeli?</h2>
  <p>Ta tabela porządkuje najprostszy schemat decyzji po przeczytaniu artykułu: co obserwować, jak rozumieć sygnał z organizmu i kiedy nie przeciągać samodzielnych prób. Dzięki temu łatwiej przełożyć wiedzę na bezpieczny następny krok.</p>
  <table>
    <caption>Krótka tabela decyzyjna FitPo50 do wykorzystania przy planowaniu kolejnego kroku.</caption>
    <thead><tr><th>Sygnał</th><th>Co oznacza</th><th>Co zrobić</th></tr></thead>
    <tbody>
      <tr><td>Brak poprawy</td><td>Wybrana metoda może być za słaba lub źle dobrana.</td><td>Sprawdź punkt wyjścia i zmień jeden parametr naraz.</td></tr>
      <tr><td>Objawy alarmowe</td><td>Potrzebna jest ocena medyczna.</td><td>Skontaktuj się z lekarzem zamiast testować kolejne porady.</td></tr>
      <tr><td>Stały postęp</td><td>Organizm dobrze toleruje zmianę.</td><td>Kontynuuj i monitoruj efekt przez kolejne tygodnie.</td></tr>
    </tbody>
  </table>
</section>`,
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateModifiedDate(html) {
  const now = nowWarsawIso();
  return html
    .replace(/("dateModified"\s*:\s*")[^"]+(")/i, `$1${now}$2`)
    .replace(/(property="article:modified_time"\s+content=")[^"]+(")/i, `$1${now}$2`);
}

function verifyGrowth(flags) {
  const data = buildGrowthData();
  const file = flags.file ? String(flags.file).replace(/^\.?\//, '') : '';
  const targets = file ? data.articles.filter((article) => article.file === file) : data.articles.slice(0, 25);
  const failures = [];
  for (const article of targets) {
    if (!article.has_blogposting) failures.push(`${article.file}: brak BlogPosting`);
    if (article.table_count > article.tables_with_caption) failures.push(`${article.file}: tabela bez caption`);
    if (article.internal_link_count < 4) failures.push(`${article.file}: mniej niż 4 linki wewnętrzne`);
  }
  const payload = {
    generated_at: nowWarsawIso(),
    checked: targets.length,
    status: failures.length ? 'FAIL' : 'PASS',
    failures,
  };
  writeJson(path.join(REPORT_DIR, 'verify.json'), payload);
  console.log(`[GROWTH] verify: ${payload.status} checked=${payload.checked} failures=${failures.length}`);
  if (payload.status !== 'PASS') process.exitCode = 1;
  return payload;
}

function buildFullAudit(flags) {
  const steps = [
    ['entities', () => buildEntityGraph()],
    ['structured-score', () => buildStructuredScore()],
    ['quick-answer-score', () => buildQuickAnswerScore()],
    ['gsc-generative-ai', () => buildGenerativeAiGscReport()],
    ['snippet-controls', () => buildSnippetControlsAudit()],
    ['post-deploy-kpi', () => buildPostDeploymentKpiPlan()],
    ['originality-score', () => buildOriginalityScore()],
    ['topical-map', () => buildTopicalMap()],
    ['llms-check', () => buildLlmsCheck()],
    ['verify', () => verifyGrowth(flags)],
    ['report', () => buildReport()],
  ];
  const results = [];
  for (const [name, fn] of steps) {
    const started = Date.now();
    console.log(`[GROWTH] full-audit step: ${name}`);
    const result = fn();
    results.push({
      name,
      duration_ms: Date.now() - started,
      status: process.exitCode && process.exitCode !== 0 ? 'FAIL' : 'PASS',
      generated_at: result && result.generated_at ? result.generated_at : '',
    });
  }
  const payload = {
    generated_at: nowWarsawIso(),
    status: results.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS',
    steps: results,
  };
  writeJson(path.join(REPORT_DIR, 'full-audit.json'), payload);
  writeSimpleListMarkdown('Growth Full Audit', results.map((item, index) => ({
    nr: index + 1,
    file: item.name,
    status: item.status,
    duration_ms: item.duration_ms,
    generated_at: item.generated_at || 'n/a',
  })), path.join(REPORT_DIR, 'full-audit.md'));
  return payload;
}

function runCommand(command, flags) {
  if (command === 'report') return buildReport();
  if (command === 'audit-ai') return buildAiAudit();
  if (command === 'ai-visibility-test') return buildAiVisibilityTest();
  if (command === 'entities') return buildEntityGraph();
  if (command === 'structured-score') return buildStructuredScore();
  if (command === 'quick-answer-score') return buildQuickAnswerScore();
  if (command === 'gsc-generative-ai') return buildGenerativeAiGscReport();
  if (command === 'snippet-controls') return buildSnippetControlsAudit();
  if (command === 'post-deploy-kpi') return buildPostDeploymentKpiPlan();
  if (command === 'originality-score') return buildOriginalityScore();
  if (command === 'topical-map') return buildTopicalMap();
  if (command === 'llms-check') return buildLlmsCheck();
  if (command === 'perplexity-monitor') return buildPerplexityMonitor();
  if (command === 'gsc-refresh') return buildGscRefresh();
  if (command === 'evidence-plan') return buildEvidencePlan();
  if (command === 'hubs') return buildHubsReport();
  if (command === 'link-assets') return buildLinkAssets();
  if (command === 'apply') return applyGrowth(flags);
  if (command === 'verify') return verifyGrowth(flags);
  if (command === 'full-audit') return buildFullAudit(flags);
  if (command === 'autopilot') return buildAutopilot();
  if (command === 'popraw-seo') return buildPoprawSeo();
  if (command === 'doctor') {
    const result = spawnSync('node', ['scripts/fitpo50-doctor.js'], { cwd: ROOT, stdio: 'inherit' });
    return { status: result.status === 0 ? 'PASS' : 'FAIL' };
  }
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return { status: 'HELP' };
  }
  throw new Error(`Nieznana komenda growth: ${command}`);
}

function printHelp() {
  console.log(`FitPo50 Growth Machine

Usage:
  node scripts/growth-tool.js report
  node scripts/growth-tool.js audit-ai
  node scripts/growth-tool.js ai-visibility-test
  node scripts/growth-tool.js entities
  node scripts/growth-tool.js structured-score
  node scripts/growth-tool.js quick-answer-score
  node scripts/growth-tool.js gsc-generative-ai
  node scripts/growth-tool.js snippet-controls
  node scripts/growth-tool.js post-deploy-kpi
  node scripts/growth-tool.js originality-score
  node scripts/growth-tool.js topical-map
  node scripts/growth-tool.js llms-check
  node scripts/growth-tool.js perplexity-monitor
  node scripts/growth-tool.js gsc-refresh
  node scripts/growth-tool.js evidence-plan
  node scripts/growth-tool.js hubs
  node scripts/growth-tool.js link-assets
  node scripts/growth-tool.js autopilot
  node scripts/growth-tool.js popraw-seo
  node scripts/growth-tool.js full-audit
  node scripts/growth-tool.js apply --file artykul.html --evidence-box --doctor-box [--write]
  node scripts/growth-tool.js verify [--file artykul.html]

Default: report
Reports: ${REPORT_DIR}
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runCommand(args.command, args.flags);
  if (args.command !== 'help') {
    const status = process.exitCode && process.exitCode !== 0 ? 'FAIL' : 'OK';
    console.log(`[GROWTH] ${args.command}: ${status}`);
    if (result && result.generated_at) console.log(`[GROWTH] reports: ${REPORT_DIR}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`[GROWTH][FAIL] ${err.message || err}`);
    process.exit(1);
  }
}

module.exports = {
  buildBroadSeoConclusions,
  buildCannibalizationMap,
  buildGscAfterChangeQueue,
  buildSeoApprovalWave,
  buildSeoWorkHistory,
  deploymentEvidenceForArticle,
  estimatedTrafficGain,
  isNoindexSeoFile,
  metricDelta,
  textContract,
};
