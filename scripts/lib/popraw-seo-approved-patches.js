const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pageKind } = require('./publication-page-kind');

const ALLOWED_BASIS = new Set(['GSC_QUERY', 'SOURCE', 'ARTICLE_FACT', 'SAFETY_RULE', 'INTERNAL_LINK_MAP']);
const GENERIC_PATTERNS = [
  /w tym samym kontekście warto też sprawdzić/i,
  /ten temat pomaga lepiej ułożyć kolejny krok po 50/i,
  /warto pamiętać, że/i,
  /co działa i jak zacząć/i,
  /\b(?:todo|tbd|placeholder|wariant\s+\d+)\b/i,
  /\{\{/,
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseIds(value) {
  return [...new Set(String(value || '').split(',').map(normalizeId).filter(Boolean))];
}

function safeRelativeFile(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!normalized || path.isAbsolute(normalized) || normalized.includes('..') || !normalized.endsWith('.html')) return '';
  if (normalized.startsWith('_site/')) return '';
  return normalized;
}

function validateBasis(basis, label, errors) {
  if (!Array.isArray(basis) || !basis.length) {
    errors.push(`${label}: brak basis[].`);
    return;
  }
  basis.forEach((item, index) => {
    if (!item || typeof item !== 'object' || !ALLOWED_BASIS.has(item.type) || String(item.value || '').trim().length < 8) {
      errors.push(`${label}.basis[${index}]: wymagane type i konkretna value.`);
    }
  });
}

function validateAfterText(after, label, errors) {
  if (typeof after !== 'string' || !after.trim()) {
    errors.push(`${label}: after musi być niepustym, zatwierdzonym tekstem.`);
    return;
  }
  const visibleText = after.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ');
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(visibleText)) errors.push(`${label}: wykryto generyczny tekst lub placeholder (${pattern}).`);
  }
}

function hrefTargets(html) {
  return [...String(html || '').matchAll(/<a\b[^>]*\bhref=["']([^"']+\.html)(?:[?#][^"']*)?["']/gi)]
    .map((match) => String(match[1] || '').replace(/^\.\//, ''))
    .filter((href) => !/^https?:\/\//i.test(href));
}

function validatePatchManifest(manifest, root, selectedIds) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { errors: ['Manifest patchy nie jest obiektem.'], items: [] };
  if (manifest.version !== 1) errors.push('Manifest patchy wymaga version=1.');
  if (manifest.status !== 'AWAITING_USER_APPROVAL') errors.push('Manifest musi mieć status AWAITING_USER_APPROVAL.');
  if (!Array.isArray(manifest.items) || !manifest.items.length) errors.push('Manifest nie zawiera items[].');
  const ids = new Set(selectedIds || []);
  const allItems = Array.isArray(manifest.items) ? manifest.items : [];
  const byId = new Map();
  allItems.forEach((item, index) => {
    const id = normalizeId(item && item.id);
    if (!id) errors.push(`items[${index}]: brak ID.`);
    else if (byId.has(id)) errors.push(`Powtórzone ID w manifeście: ${id}.`);
    else byId.set(id, item);
  });
  ids.forEach((id) => {
    if (!byId.has(id)) errors.push(`Zatwierdzone ID nie istnieje w manifeście: ${id}.`);
  });
  const items = [...ids].map((id) => byId.get(id)).filter(Boolean);
  if (!items.length) errors.push('Nie wybrano żadnego poprawnego ID.');
  const touched = new Set();
  const targetOwners = new Map();
  items.forEach((item) => {
    const id = normalizeId(item.id);
    if (!/^(BOOST|ROKUJE|NAPRAWA) \d+$/.test(id)) errors.push(`${id || 'MISSING'}: do wdrożenia dopuszczone są wyłącznie konkretne ID BOOST, ROKUJE albo NAPRAWA.`);
    const target = safeRelativeFile(item.file);
    if (!target) errors.push(`${id}: file musi wskazywać źródłowy plik HTML.`);
    else if (targetOwners.has(target)) errors.push(`${target}: dwa zatwierdzone ID próbują zmienić ten sam target (${targetOwners.get(target)}, ${id}).`);
    else targetOwners.set(target, id);
    if (!Array.isArray(item.operations) || !item.operations.length) errors.push(`${id}: brak konkretnych operations[].`);
    (item.operations || []).forEach((operation, index) => {
      const label = `${id}.operations[${index}]`;
      const file = safeRelativeFile(operation.file || target);
      if (!file) errors.push(`${label}: nieprawidłowy file.`);
      else touched.add(file);
      if (operation.type !== 'replace_exact') errors.push(`${label}: dozwolone jest wyłącznie replace_exact.`);
      if (typeof operation.before !== 'string' || !operation.before) errors.push(`${label}: brak dokładnego before.`);
      validateAfterText(operation.after, label, errors);
      validateBasis(operation.basis, label, errors);
      if (String(operation.reason || '').trim().length < 12) errors.push(`${label}: reason jest zbyt ogólny.`);
      hrefTargets(operation.after).forEach((href) => {
        if (!safeRelativeFile(href) || !fs.existsSync(path.join(root, href))) errors.push(`${label}: link prowadzi do nieistniejącego celu ${href}.`);
      });
    });
    if (target && !(item.operations || []).some((operation) => safeRelativeFile(operation.file || target) === target)) {
      errors.push(`${id}: pakiet nie zawiera żadnej konkretnej zmiany w docelowym artykule ${target}.`);
    }
  });
  const hashes = manifest.source_hashes;
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) errors.push('Manifest wymaga source_hashes dla każdego zmienianego pliku.');
  touched.forEach((file) => {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) errors.push(`Brak pliku źródłowego: ${file}.`);
    const expected = hashes && hashes[file];
    if (!/^[a-f0-9]{64}$/.test(String(expected || ''))) errors.push(`Brak prawidłowego source_hashes[${file}].`);
    else if (fs.existsSync(abs) && sha256(fs.readFileSync(abs)) !== expected) errors.push(`${file}: plik zmienił się od przygotowania patcha (SHA-256 mismatch).`);
  });
  return { errors, items, touched: [...touched] };
}

function replaceExactlyOnce(html, before, after, label) {
  const first = html.indexOf(before);
  if (first === -1) throw new Error(`${label}: fragment before nie występuje w pliku.`);
  if (html.indexOf(before, first + before.length) !== -1) throw new Error(`${label}: fragment before występuje więcej niż raz.`);
  return `${html.slice(0, first)}${after}${html.slice(first + before.length)}`;
}

function warsawIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'longOffset',
  }).formatToParts(now).reduce((acc, item) => {
    if (item.type !== 'literal') acc[item.type] = item.value;
    return acc;
  }, {});
  const offset = String(parts.timeZoneName || 'GMT+01:00').replace(/^GMT/, '');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

function updateModified(html, iso, file) {
  let metaCount = 0;
  let schemaCount = 0;
  const next = html
    .replace(/(<meta\s+property="article:modified_time"\s+content=")[^"]*(")/i, (_match, start, end) => {
      metaCount += 1;
      return `${start}${iso}${end}`;
    })
    .replace(/("dateModified"\s*:\s*")[^"]*(")/g, (_match, start, end) => {
      schemaCount += 1;
      return `${start}${iso}${end}`;
    });
  if (metaCount !== 1 || schemaCount < 1) throw new Error(`${file}: nie udało się jednoznacznie zaktualizować article:modified_time i dateModified.`);
  return next;
}

function buildPatchedFiles(manifest, items, root, iso) {
  const contents = new Map();
  const targetFiles = new Set();
  items.forEach((item) => {
    const target = safeRelativeFile(item.file);
    targetFiles.add(target);
    item.operations.forEach((operation, index) => {
      const file = safeRelativeFile(operation.file || target);
      const current = contents.has(file) ? contents.get(file) : fs.readFileSync(path.join(root, file), 'utf8');
      contents.set(file, replaceExactlyOnce(current, operation.before, operation.after, `${normalizeId(item.id)}.operations[${index}]`));
    });
  });
  const articleFiles = new Set(targetFiles);
  for (const file of contents.keys()) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (pageKind(source) !== 'unsupported') articleFiles.add(file);
  }
  articleFiles.forEach((file) => {
    const current = contents.has(file) ? contents.get(file) : fs.readFileSync(path.join(root, file), 'utf8');
    contents.set(file, updateModified(current, iso, file));
  });
  return { contents, targetFiles: [...targetFiles], articleFiles: [...articleFiles] };
}

function normalizedNeedle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function deploymentNeedle(operation, finalHtml) {
  // A whole-document replacement is subsequently enriched with dates and PDF
  // metadata. Verify that final document, rather than the intermediate draft.
  return normalizedNeedle(/^\s*<!doctype\s+html\b/i.test(operation.after)
    ? finalHtml : operation.after);
}

function buildDeploymentManifest({ manifest, items, contents, targetFiles, iso }) {
  const itemByTarget = new Map(items.map((item) => [safeRelativeFile(item.file), item]));
  return {
    version: 1,
    generated_at: iso,
    status: 'COMMITTED_LOCALLY_AWAITING_LIVE_DEPLOYMENT',
    source_report_generated_at: manifest.report_generated_at || '',
    approved_ids: items.map((item) => normalizeId(item.id)),
    targets: targetFiles.map((file) => {
      const item = itemByTarget.get(file);
      const supportFiles = [...new Set(item.operations.map((operation) => safeRelativeFile(operation.file || file)).filter((operationFile) => operationFile !== file))];
      const supportArticleFiles = supportFiles.filter((support) => pageKind(String(contents.get(support) || '')) !== 'unsupported');
      const needles = item.operations
        .filter((operation) => safeRelativeFile(operation.file || file) === file)
        .map((operation) => deploymentNeedle(operation, contents.get(file)))
        .filter(Boolean);
      return {
        id: normalizeId(item.id),
        file,
        url: `https://fitpo50.pl/${file}`,
        date_modified: iso,
        content_needles: needles,
        expected_html_sha256: sha256(Buffer.from(contents.get(file), 'utf8')),
        pdf_url: `https://fitpo50.pl/assets/pdf/${file.replace(/\.html$/, '.pdf')}`,
        source_pages_for_recrawl: supportArticleFiles.map((support) => `https://fitpo50.pl/${support}`),
        source_pages: supportArticleFiles.map((support) => ({
          file: support,
          url: `https://fitpo50.pl/${support}`,
          date_modified: iso,
          expected_html_sha256: contents.has(support) ? sha256(Buffer.from(contents.get(support), 'utf8')) : '',
          pdf_url: `https://fitpo50.pl/assets/pdf/${support.replace(/\.html$/, '.pdf')}`,
          content_needles: item.operations
            .filter((operation) => safeRelativeFile(operation.file || file) === support)
            .map((operation) => deploymentNeedle(operation, contents.get(support)))
            .filter(Boolean),
        })),
      };
    }),
  };
}

module.exports = {
  buildDeploymentManifest,
  buildPatchedFiles,
  normalizeId,
  parseIds,
  replaceExactlyOnce,
  sha256,
  validatePatchManifest,
  warsawIso,
};
