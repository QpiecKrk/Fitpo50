#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const REPORT_DIR = process.env.FITPO50_GROWTH_REPORT_DIR
  ? path.resolve(process.env.FITPO50_GROWTH_REPORT_DIR)
  : path.join(os.homedir(), 'Downloads', 'fitpo50-growth-reports');
const SITE_ORIGIN = 'https://fitpo50.pl';
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
  const rows = parseCsvRows(path.join(ROOT, 'data', 'gsc', 'Strony.csv'));
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
  const topicalMap = buildTopicalMap();
  const llmsCheck = buildLlmsCheck();
  const perplexityMonitor = buildPerplexityMonitor();
  const autopilot = buildAutopilot();
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
      'Zbudowano Topical Authority Map.',
      'Sprawdzono llms.txt i llms-full.txt.',
      'Zbudowano kolejkę Perplexity Monitor.',
      'Zbudowano plan autopilota bez zapisu w artykułach.',
    ],
    chosen_articles: autopilot.chosen_articles,
    approval_needed: 'Napisz: przygotuj poprawki 1, 2 albo 1 i 3. Najpierw pokażę gotowe teksty do zatwierdzenia, bez edycji HTML.',
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
      ['topical_authority_map', 'topical-authority-map.md'],
      ['llms_check', 'llms-check.md'],
      ['perplexity_monitor', 'perplexity-monitor.md'],
      ['autopilot_plan', 'autopilot-plan.md'],
    ].map(([key, file]) => [key, path.join(REPORT_DIR, file)])),
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
      topical_clusters: topicalMap.topics.length,
      llms_missing: llmsCheck.missing_count,
      perplexity_prompts: perplexityMonitor.prompts.length,
    },
  };
  writeJson(path.join(REPORT_DIR, 'popraw-seo.json'), command);
  writePoprawSeoMarkdown(command, path.join(REPORT_DIR, 'popraw-seo.md'));
  return command;
}

function writePoprawSeoMarkdown(command, file) {
  const lines = ['# Popraw SEO — Plan Do Zatwierdzenia', '', `Wygenerowano: ${command.generated_at}`, '', `Status: ${command.status}`, ''];
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

function runCommand(command, flags) {
  if (command === 'report') return buildReport();
  if (command === 'audit-ai') return buildAiAudit();
  if (command === 'ai-visibility-test') return buildAiVisibilityTest();
  if (command === 'entities') return buildEntityGraph();
  if (command === 'structured-score') return buildStructuredScore();
  if (command === 'quick-answer-score') return buildQuickAnswerScore();
  if (command === 'topical-map') return buildTopicalMap();
  if (command === 'llms-check') return buildLlmsCheck();
  if (command === 'perplexity-monitor') return buildPerplexityMonitor();
  if (command === 'gsc-refresh') return buildGscRefresh();
  if (command === 'evidence-plan') return buildEvidencePlan();
  if (command === 'hubs') return buildHubsReport();
  if (command === 'link-assets') return buildLinkAssets();
  if (command === 'apply') return applyGrowth(flags);
  if (command === 'verify') return verifyGrowth(flags);
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
  node scripts/growth-tool.js topical-map
  node scripts/growth-tool.js llms-check
  node scripts/growth-tool.js perplexity-monitor
  node scripts/growth-tool.js gsc-refresh
  node scripts/growth-tool.js evidence-plan
  node scripts/growth-tool.js hubs
  node scripts/growth-tool.js link-assets
  node scripts/growth-tool.js autopilot
  node scripts/growth-tool.js popraw-seo
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

try {
  main();
} catch (err) {
  console.error(`[GROWTH][FAIL] ${err.message || err}`);
  process.exit(1);
}
