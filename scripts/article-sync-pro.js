#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();

let articlePolicy = null;
try {
  // Optional dependency: use centralized policy when available.
  articlePolicy = require('./lib/article-policy');
} catch (_) {
  articlePolicy = null;
}

const POLICY = articlePolicy ? articlePolicy.POLICY : null;
const utils = articlePolicy ? articlePolicy.utils : null;
const validators = articlePolicy ? articlePolicy.validators : null;

const CATEGORY_LISTINGS = {
  jedzenie: 'jedzenie.html',
  zdrowie: 'zdrowie.html',
  ciekawe: 'ciekawe.html',
  'rusz-sie': 'rusz-sie.html',
};

function printHelpAndExit() {
  console.error('BŁĄD: Nie podano żadnej flagi synchronizacji.\n');
  console.error('Użycie:');
  console.error('  node scripts/article-sync-pro.js --slug [slug] [flagi]\n');
  console.error('Flagi:');
  console.error('  --sync-seo         Synchronizuj tytuły i meta w artykule i jego mirrorze _site/');
  console.error('  --sync-listings    Synchronizuj karty artykułu na listingach kategorii i porady.html');
  console.error('  --sync-pdf-labels  Synchronizuj etykiety PDF w schema i aria-label');
  console.error('  --dry-run          Tylko podgląd zmian, nic nie zapisuje\n');
  console.error('Przykład:');
  console.error('  node scripts/article-sync-pro.js --slug moj-artykul --sync-seo --sync-listings --dry-run');
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    slug: '',
    syncSeo: false,
    syncListings: false,
    syncPdfLabels: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--slug') {
      out.slug = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--sync-seo') out.syncSeo = true;
    if (token === '--sync-listings') out.syncListings = true;
    if (token === '--sync-pdf-labels') out.syncPdfLabels = true;
    if (token === '--dry-run') out.dryRun = true;
  }
  return out;
}

function readUtf8(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function writeUtf8(relPath, value) {
  fs.writeFileSync(path.join(ROOT, relPath), value, 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function normalizeStrict(text) {
  if (utils && typeof utils.strictNormalize === 'function') {
    return utils.strictNormalize(text);
  }
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function validateMetaDescription(metaDescription) {
  if (validators && typeof validators.validateSeoDescriptionLength === 'function') {
    return validators.validateSeoDescriptionLength(metaDescription);
  }
  const len = String(metaDescription || '').trim().length;
  const ok = len >= 145 && len <= 160 && /[.!?]$/.test(String(metaDescription || '').trim());
  return { ok, error: ok ? null : `Opis ma ${len} znaków albo nie kończy się poprawnym znakiem końca zdania.` };
}

function getJsonFiles() {
  const dir = path.join(ROOT, 'data', 'import');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join('data', 'import', file))
    .sort();
}

function findJsonBySlug(slug) {
  const exact = path.join('data', 'import', `${slug}.json`);
  if (exists(exact)) {
    const parsed = JSON.parse(readUtf8(exact));
    if (String(parsed.slug || '').trim() === slug) return { relPath: exact, data: parsed };
  }

  for (const relPath of getJsonFiles()) {
    try {
      const parsed = JSON.parse(readUtf8(relPath));
      if (String(parsed.slug || '').trim() === slug) {
        return { relPath, data: parsed };
      }
    } catch (_) {
      // Ignore malformed JSONs here; they will fail only if directly targeted.
    }
  }
  return null;
}

function validateInputData(jsonPath, data, slug, warnings, errors) {
  const required = ['slug', 'title', 'seo_title', 'meta_description', 'listing_title', 'listing_desc', 'category'];
  for (const field of required) {
    if (!String(data[field] || '').trim()) {
      errors.push(`Brak wymaganego pola "${field}" w ${jsonPath}.`);
    }
  }

  if (String(data.slug || '').trim() !== slug) {
    errors.push(`Pole slug w ${jsonPath} ma wartość "${data.slug}", oczekiwano "${slug}".`);
  }

  const metaCheck = validateMetaDescription(data.meta_description);
  if (!metaCheck.ok) {
    errors.push(`meta_description: ${metaCheck.error}`);
  }

  if (!CATEGORY_LISTINGS[String(data.category || '').trim()] && String(data.category || '').trim() !== '') {
    warnings.push(`Nieznana kategoria "${data.category}". Skrypt pominie listing kategorii.`);
  }

  if (POLICY && POLICY.TITLE && POLICY.TITLE.MAX && String(data.seo_title || '').trim().length > POLICY.TITLE.MAX) {
    warnings.push(`seo_title ma ${String(data.seo_title || '').trim().length} znaków i przekracza soft-limit ${POLICY.TITLE.MAX}.`);
  }
}

function collectLdJsonScripts(html) {
  const blocks = [];
  const rx = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = rx.exec(html)) !== null) {
    blocks.push({
      fullMatch: match[0],
      body: match[1],
      index: match.index,
    });
  }
  return blocks;
}

function replaceOnce(content, regex, label, newValue, transformOld, transformNew) {
  const match = content.match(regex);
  if (!match) {
    return {
      content,
      found: false,
      changed: false,
      label,
      oldValue: null,
      newValue,
    };
  }

  const oldValue = typeof transformOld === 'function' ? transformOld(match) : match[1];
  const replacement = typeof transformNew === 'function' ? transformNew(match, newValue) : newValue;
  const next = content.replace(regex, replacement);
  return {
    content: next,
    found: true,
    changed: oldValue !== newValue,
    label,
    oldValue,
    newValue,
  };
}

function updateLdJsonBlocks(html, mutateFn, warnings, errors) {
  const blocks = collectLdJsonScripts(html);
  let nextHtml = html;
  let changedAny = false;
  const changes = [];

  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block.body.trim());
    } catch (error) {
      errors.push(`Niepoprawny JSON-LD: ${error.message}`);
      return { html, changedAny: false, changes };
    }

    const mutation = mutateFn(parsed);
    if (!mutation || !mutation.changed) continue;

    const replacement = `<script type="application/ld+json">\n${JSON.stringify(parsed, null, 2)}\n</script>`;
    nextHtml = nextHtml.replace(block.fullMatch, replacement);
    changedAny = true;
    if (Array.isArray(mutation.changes)) {
      changes.push(...mutation.changes);
    }
  }

  if (!changedAny && warnings) {
    // Keep quiet unless caller wants a specific warning.
  }

  return { html: nextHtml, changedAny, changes };
}

function updateArticleHtml(html, data, options) {
  let next = html;
  const changes = [];
  const warnings = [];
  const errors = [];

  if (options.syncSeo) {
    const titleRes = replaceOnce(
      next,
      /<title>([\s\S]*?)<\/title>/i,
      '<title>',
      data.seo_title,
      (m) => m[1],
      (_, value) => `<title>${escapeHtml(value)}</title>`
    );
    next = titleRes.content;
    if (titleRes.found && titleRes.changed) changes.push(titleRes);
    if (!titleRes.found) warnings.push('Nie znaleziono <title>.');

    const metaDescRes = replaceOnce(
      next,
      /<meta\s+name="description"\s+content="([^"]*)">/i,
      'meta description',
      data.meta_description,
      (m) => m[1],
      (_, value) => `<meta name="description" content="${escapeAttr(value)}">`
    );
    next = metaDescRes.content;
    if (metaDescRes.found && metaDescRes.changed) changes.push(metaDescRes);
    if (!metaDescRes.found) warnings.push('Nie znaleziono meta[name="description"].');

    const ogTitleRes = replaceOnce(
      next,
      /<meta\s+property="og:title"\s+content="([^"]*)">/i,
      'og:title',
      data.title,
      (m) => m[1],
      (_, value) => `<meta property="og:title" content="${escapeAttr(value)}">`
    );
    next = ogTitleRes.content;
    if (ogTitleRes.found && ogTitleRes.changed) changes.push(ogTitleRes);
    if (!ogTitleRes.found) warnings.push('Nie znaleziono meta[property="og:title"].');

    const ogDescRes = replaceOnce(
      next,
      /<meta\s+property="og:description"\s+content="([^"]*)">/i,
      'og:description',
      data.meta_description,
      (m) => m[1],
      (_, value) => `<meta property="og:description" content="${escapeAttr(value)}">`
    );
    next = ogDescRes.content;
    if (ogDescRes.found && ogDescRes.changed) changes.push(ogDescRes);
    if (!ogDescRes.found) warnings.push('Nie znaleziono meta[property="og:description"].');

    const twTitleRes = replaceOnce(
      next,
      /<meta\s+name="twitter:title"\s+content="([^"]*)">/i,
      'twitter:title',
      data.title,
      (m) => m[1],
      (_, value) => `<meta name="twitter:title" content="${escapeAttr(value)}">`
    );
    next = twTitleRes.content;
    if (twTitleRes.found && twTitleRes.changed) changes.push(twTitleRes);
    if (!twTitleRes.found) warnings.push('Nie znaleziono meta[name="twitter:title"].');

    const twDescRes = replaceOnce(
      next,
      /<meta\s+name="twitter:description"\s+content="([^"]*)">/i,
      'twitter:description',
      data.meta_description,
      (m) => m[1],
      (_, value) => `<meta name="twitter:description" content="${escapeAttr(value)}">`
    );
    next = twDescRes.content;
    if (twDescRes.found && twDescRes.changed) changes.push(twDescRes);
    if (!twDescRes.found) warnings.push('Nie znaleziono meta[name="twitter:description"].');

    const h1PrimaryRes = replaceOnce(
      next,
      /(<h1\b[^>]*class="[^"]*\barticle-header__title\b[^"]*"[^>]*>)([\s\S]*?)(<\/h1>)/i,
      '<h1.article-header__title>',
      data.title,
      (m) => m[2],
      (m, value) => `${m[1]}${escapeHtml(value)}${m[3]}`
    );
    next = h1PrimaryRes.content;
    if (h1PrimaryRes.found && h1PrimaryRes.changed) changes.push(h1PrimaryRes);
    if (!h1PrimaryRes.found) {
      const h1FallbackRes = replaceOnce(
        next,
        /(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/i,
        '<h1>',
        data.title,
        (m) => m[2],
        (m, value) => `${m[1]}${escapeHtml(value)}${m[3]}`
      );
      next = h1FallbackRes.content;
      if (h1FallbackRes.found && h1FallbackRes.changed) changes.push(h1FallbackRes);
      if (!h1FallbackRes.found) warnings.push('Nie znaleziono żadnego <h1>.');
    }

    const ldSeoRes = updateLdJsonBlocks(next, (parsed) => {
      if (parsed['@type'] !== 'BlogPosting') return { changed: false };
      const localChanges = [];
      if (parsed.headline !== data.title) {
        localChanges.push({ label: 'JSON-LD BlogPosting.headline', oldValue: parsed.headline, newValue: data.title, changed: true, found: true });
        parsed.headline = data.title;
      }
      if (parsed.description !== data.meta_description) {
        localChanges.push({ label: 'JSON-LD BlogPosting.description', oldValue: parsed.description, newValue: data.meta_description, changed: true, found: true });
        parsed.description = data.meta_description;
      }
      if (data.pdf_title && parsed.encoding && typeof parsed.encoding === 'object' && !Array.isArray(parsed.encoding)) {
        if (parsed.encoding['@type'] === 'MediaObject' && parsed.encoding.name !== data.pdf_title) {
          localChanges.push({ label: 'JSON-LD BlogPosting.encoding.name', oldValue: parsed.encoding.name, newValue: data.pdf_title, changed: true, found: true });
          parsed.encoding.name = data.pdf_title;
        }
      }
      return { changed: localChanges.length > 0, changes: localChanges };
    }, warnings, errors);
    next = ldSeoRes.html;
    changes.push(...ldSeoRes.changes);

    if (data.pdf_label) {
      const pdfLabelRes = replaceOnce(
        next,
        /(<a\b[^>]*class="[^"]*\bpdf-hero-download\b[^"]*"[^>]*aria-label=")([^"]*)(")/i,
        'PDF aria-label',
        data.pdf_label,
        (m) => m[2],
        (m, value) => {
          const current = String(m[2] || '');
          if (!/pdf/i.test(current)) return m[0];
          return `${m[1]}${escapeAttr(value)}${m[3]}`;
        }
      );
      next = pdfLabelRes.content;
      if (pdfLabelRes.found && pdfLabelRes.oldValue !== data.pdf_label && /pdf/i.test(String(pdfLabelRes.oldValue || ''))) {
        changes.push(pdfLabelRes);
      }
    }
  }

  if (options.syncPdfLabels) {
    const ldPdfRes = updateLdJsonBlocks(next, (parsed) => {
      if (parsed['@type'] !== 'BlogPosting' || !parsed.encoding || typeof parsed.encoding !== 'object' || Array.isArray(parsed.encoding)) {
        return { changed: false };
      }
      if (parsed.encoding['@type'] !== 'MediaObject') return { changed: false };
      const localChanges = [];
      const pdfTitle = data.pdf_title || `${data.title} (PDF)`;
      if (parsed.encoding.name !== pdfTitle) {
        localChanges.push({ label: 'JSON-LD BlogPosting.encoding.name', oldValue: parsed.encoding.name, newValue: pdfTitle, changed: true, found: true });
        parsed.encoding.name = pdfTitle;
      }
      return { changed: localChanges.length > 0, changes: localChanges };
    }, warnings, errors);
    next = ldPdfRes.html;
    changes.push(...ldPdfRes.changes);

    const fallbackPdfLabel = data.pdf_label || `Pobierz PDF – ${data.title}`;
    const pdfLabelRes = replaceOnce(
      next,
      /(<a\b[^>]*class="[^"]*\bpdf-hero-download\b[^"]*"[^>]*aria-label=")([^"]*)(")/i,
      'PDF aria-label',
      fallbackPdfLabel,
      (m) => m[2],
      (m, value) => {
        const current = String(m[2] || '');
        if (!/pdf/i.test(current)) return m[0];
        return `${m[1]}${escapeAttr(value)}${m[3]}`;
      }
    );
    next = pdfLabelRes.content;
    if (pdfLabelRes.found && pdfLabelRes.oldValue !== fallbackPdfLabel && /pdf/i.test(String(pdfLabelRes.oldValue || ''))) {
      changes.push(pdfLabelRes);
    }
  }

  if (!errors.length) {
    const extracted = {
      meta: (next.match(/<meta\s+name="description"\s+content="([^"]*)">/i) || [null, ''])[1],
      og: (next.match(/<meta\s+property="og:description"\s+content="([^"]*)">/i) || [null, ''])[1],
      twitter: (next.match(/<meta\s+name="twitter:description"\s+content="([^"]*)">/i) || [null, ''])[1],
      schema: '',
    };
    const blocks = collectLdJsonScripts(next);
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block.body.trim());
        if (parsed['@type'] === 'BlogPosting') {
          extracted.schema = String(parsed.description || '');
          break;
        }
      } catch (error) {
        errors.push(`Niepoprawny JSON-LD po aktualizacji: ${error.message}`);
      }
    }
    const values = [extracted.meta, extracted.og, extracted.twitter, extracted.schema].map((value) => normalizeStrict(value));
    const unique = new Set(values);
    if (unique.size > 1) {
      errors.push('Kontrakt SEO description 1:1 nie został zachowany po aktualizacji.');
    }
  }

  return { content: next, changes, warnings, errors };
}

function updateListingHtml(html, slug, data) {
  let next = html;
  const changes = [];
  const warnings = [];
  const errors = [];

  const hrefPattern = `(?:\\.\\/)?${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.html`;
  const cardRx = new RegExp(`<a\\b[^>]*href="${hrefPattern}"[^>]*class="[^"]*\\barticle-index-card\\b[^"]*"[^>]*>[\\s\\S]*?<\\/a>`, 'gi');
  const cardMatches = [...next.matchAll(cardRx)];

  if (cardMatches.length === 0) {
    warnings.push(`Nie znaleziono karty artykułu dla slug "${slug}".`);
  } else {
    next = next.replace(cardRx, (full) => {
      let block = full;
      const titleMatch = block.match(/<h3\b[^>]*class="[^"]*\barticle-index-card__title\b[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
      if (titleMatch && titleMatch[1] !== data.listing_title) {
        changes.push({ label: 'karta .article-index-card__title', oldValue: titleMatch[1], newValue: data.listing_title, changed: true, found: true });
        block = block.replace(/(<h3\b[^>]*class="[^"]*\barticle-index-card__title\b[^"]*"[^>]*>)([\s\S]*?)(<\/h3>)/i, `$1${escapeHtml(data.listing_title)}$3`);
      }

      const descMatch = block.match(/<p\b[^>]*class="[^"]*\barticle-index-card__desc\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      if (descMatch && descMatch[1] !== data.listing_desc) {
        changes.push({ label: 'karta .article-index-card__desc', oldValue: descMatch[1], newValue: data.listing_desc, changed: true, found: true });
        block = block.replace(/(<p\b[^>]*class="[^"]*\barticle-index-card__desc\b[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/i, `$1${escapeHtml(data.listing_desc)}$3`);
      }

      const attrMatch = block.match(/\sdata-article-title="([^"]*)"/i);
      if (attrMatch && attrMatch[1] !== data.listing_title) {
        changes.push({ label: 'karta data-article-title', oldValue: attrMatch[1], newValue: data.listing_title, changed: true, found: true });
        block = block.replace(/\sdata-article-title="([^"]*)"/i, ` data-article-title="${escapeAttr(data.listing_title)}"`);
      }

      return block;
    });
  }

  const ldRes = updateLdJsonBlocks(next, (parsed) => {
    if (parsed['@type'] !== 'ItemList' || !Array.isArray(parsed.itemListElement)) return { changed: false };
    const localChanges = [];
    for (const item of parsed.itemListElement) {
      const url = String(item.url || '');
      if (!url.includes(`${slug}.html`)) continue;
      if (item.name !== data.listing_title) {
        localChanges.push({ label: 'JSON-LD ItemList.name', oldValue: item.name, newValue: data.listing_title, changed: true, found: true });
        item.name = data.listing_title;
      }
    }
    return { changed: localChanges.length > 0, changes: localChanges };
  }, warnings, errors);
  next = ldRes.html;
  changes.push(...ldRes.changes);

  return { content: next, changes, warnings, errors };
}

function ensureMirrorPair(paths, kind, warnings, errors, hardFailure) {
  const [source, mirror] = paths;
  const sourceExists = exists(source);
  const mirrorExists = exists(mirror);
  if (sourceExists && mirrorExists) return true;

  const message = `Brak kompletnej pary ${kind}: ${sourceExists ? '' : source} ${(!sourceExists && !mirrorExists) ? 'oraz ' : ''}${mirrorExists ? '' : mirror}`.trim();
  if (hardFailure) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
  return false;
}

function formatFlags(args) {
  const parts = [];
  if (args.syncSeo) parts.push('--sync-seo');
  if (args.syncListings) parts.push('--sync-listings');
  if (args.syncPdfLabels) parts.push('--sync-pdf-labels');
  if (args.dryRun) parts.push('--dry-run');
  return parts.join(' ');
}

function formatChange(change) {
  const lines = [];
  lines.push(`├─ ${change.label}: zmiana wykryta`);
  if (change.oldValue !== null && change.oldValue !== undefined) {
    lines.push(`│   Stare: "${String(change.oldValue).replace(/\s+/g, ' ').trim()}"`);
    lines.push(`│   Nowe:  "${String(change.newValue).replace(/\s+/g, ' ').trim()}"`);
  }
  return lines.join('\n');
}

function runPostWriteChecks(slug) {
  const results = [];
  const predeployPath = path.join(ROOT, 'scripts', 'predeploy-gate.js');
  const validatePath = path.join(ROOT, 'scripts', 'validate-article-standard.js');

  if (fs.existsSync(predeployPath)) {
    const res = spawnSync('node', ['scripts/predeploy-gate.js', '--slug', slug], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    results.push({
      label: 'predeploy-gate',
      ok: res.status === 0,
      output: `${res.stdout || ''}${res.stderr || ''}`.trim(),
    });
  } else {
    results.push({ label: 'predeploy-gate', ok: null, output: 'OSTRZEŻENIE: brak scripts/predeploy-gate.js' });
  }

  if (fs.existsSync(validatePath)) {
    const res = spawnSync('node', ['scripts/validate-article-standard.js', `${slug}.html`], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    results.push({
      label: 'validate-article-standard',
      ok: res.status === 0,
      output: `${res.stdout || ''}${res.stderr || ''}`.trim(),
    });
  } else {
    results.push({ label: 'validate-article-standard', ok: null, output: 'OSTRZEŻENIE: brak scripts/validate-article-standard.js' });
  }

  return results;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.slug || (!args.syncSeo && !args.syncListings && !args.syncPdfLabels)) {
    printHelpAndExit();
  }

  const globalWarnings = [];
  const globalErrors = [];
  const fileReports = [];
  let totalChanges = 0;

  const jsonMatch = findJsonBySlug(args.slug);
  if (!jsonMatch) {
    console.error(`BŁĄD: Nie znaleziono pliku JSON w data/import/ dla slug "${args.slug}".`);
    process.exit(1);
  }

  const jsonData = jsonMatch.data;
  validateInputData(jsonMatch.relPath, jsonData, args.slug, globalWarnings, globalErrors);

  const articlePair = [`${args.slug}.html`, `_site/${args.slug}.html`];
  if (!ensureMirrorPair(articlePair, 'artykułu', globalWarnings, globalErrors, true)) {
    console.error(globalErrors.join('\n'));
    process.exit(1);
  }

  if (args.syncSeo || args.syncPdfLabels) {
    for (const relPath of articlePair) {
      const original = readUtf8(relPath);
      const result = updateArticleHtml(original, jsonData, args);
      if (result.errors.length) {
        globalErrors.push(...result.errors.map((msg) => `${relPath}: ${msg}`));
        continue;
      }
      globalWarnings.push(...result.warnings.map((msg) => `${relPath}: ${msg}`));
      if (result.changes.length > 0) {
        totalChanges += result.changes.length;
      }
      fileReports.push({
        relPath,
        original,
        next: result.content,
        changes: result.changes,
        kind: 'article',
      });
    }
  }

  if (args.syncListings) {
    const listingFiles = [];
    const categoryListing = CATEGORY_LISTINGS[String(jsonData.category || '').trim()];
    if (categoryListing) {
      listingFiles.push([categoryListing, `_site/${categoryListing}`]);
    }
    if (exists('porady.html') || exists('_site/porady.html')) {
      listingFiles.push(['porady.html', '_site/porady.html']);
    }

    for (const pair of listingFiles) {
      const [source, mirror] = pair;
      if (!ensureMirrorPair(pair, 'listingu', globalWarnings, globalErrors, false)) continue;
      for (const relPath of pair) {
        const original = readUtf8(relPath);
        const result = updateListingHtml(original, args.slug, jsonData);
        if (result.errors.length) {
          globalErrors.push(...result.errors.map((msg) => `${relPath}: ${msg}`));
          continue;
        }
        globalWarnings.push(...result.warnings.map((msg) => `${relPath}: ${msg}`));
        if (result.changes.length > 0) {
          totalChanges += result.changes.length;
        }
        fileReports.push({
          relPath,
          original,
          next: result.content,
          changes: result.changes,
          kind: 'listing',
        });
      }
    }
  }

  if (globalErrors.length) {
    console.error(globalErrors.join('\n'));
    process.exit(1);
  }

  const reportsByPath = new Map();
  for (const report of fileReports) {
    if (!reportsByPath.has(report.relPath)) {
      reportsByPath.set(report.relPath, {
        relPath: report.relPath,
        original: report.original,
        next: report.next,
        changes: [...report.changes],
      });
      continue;
    }
    const existing = reportsByPath.get(report.relPath);
    existing.next = report.next;
    existing.changes.push(...report.changes);
  }

  const finalReports = [...reportsByPath.values()].filter((report) => report.changes.length > 0);

  if (args.dryRun) {
    console.log('DRY-RUN: article-sync-pro.js');
    console.log(`Slug: ${args.slug}`);
    console.log(`Tryb: ${formatFlags(args)}`);
    console.log('');

    for (const report of finalReports) {
      console.log(`PLIK: ${report.relPath}`);
      for (const change of report.changes) {
        console.log(formatChange(change));
      }
      console.log('');
    }

    if (globalWarnings.length) {
      console.log('OSTRZEŻENIA:');
      for (const warning of globalWarnings) {
        console.log(`- ${warning}`);
      }
      console.log('');
    }

    console.log(`ŁĄCZNIE: ${totalChanges} zmian w ${finalReports.length} plikach`);
    console.log('Żaden plik nie został zapisany (tryb dry-run).');
    return;
  }

  for (const report of finalReports) {
    writeUtf8(report.relPath, report.next);
  }

  const checkResults = runPostWriteChecks(args.slug);

  console.log('ZAPISANO:');
  for (const report of finalReports) {
    console.log(`- ${report.relPath}: ${report.changes.length} zmian`);
  }

  if (globalWarnings.length) {
    console.log('\nOSTRZEŻENIA:');
    for (const warning of globalWarnings) {
      console.log(`- ${warning}`);
    }
  }

  for (const result of checkResults) {
    const label = result.label === 'predeploy-gate' ? 'WYNIK GATE' : 'WYNIK VALIDATE';
    if (result.ok === null) {
      console.log(`\n${label}: ${result.output}`);
    } else {
      console.log(`\n${label}: ${result.ok ? 'PASS' : 'FAIL'}`);
      if (result.output) {
        console.log(result.output);
      }
    }
  }
}

main();
