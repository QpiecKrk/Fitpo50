const fs = require('fs');

function firstMatch(raw, regex) {
  const m = String(raw || '').match(regex);
  return m ? String(m[1] || '').trim() : '';
}

function validateArticleHeadContract(raw, opts = {}) {
  const errors = [];
  const warnings = [];
  const limits = {
    titleMax: 65,
    descriptionMin: 145,
    descriptionMax: 160,
    ...opts,
  };

  const title = firstMatch(raw, /<title>([^<]+)<\/title>/i);
  if (!title) {
    errors.push('Brak tagu <title>.');
  } else {
    if (title.length > limits.titleMax) {
      errors.push(`<title> przekracza ${limits.titleMax} znaków (jest ${title.length}).`);
    }
    if (/\s[–-]\s*\|\s*fitpo50\s*$/i.test(title)) {
      errors.push('<title> ma podwójny separator przed "| FitPo50" (np. "– |").');
    }
  }

  const metaDescription = firstMatch(raw, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const ogDescription = firstMatch(raw, /<meta\s+property="og:description"\s+content="([^"]*)"/i);
  const twitterDescription = firstMatch(raw, /<meta\s+name="twitter:description"\s+content="([^"]*)"/i);

  let schemaDescription = '';
  const scripts = [...String(raw || '').matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const scriptMatch of scripts) {
    try {
      const parsed = JSON.parse(String(scriptMatch[1] || '').trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const type = node['@type'];
        const isBlogPosting = type === 'BlogPosting' || (Array.isArray(type) && type.includes('BlogPosting'));
        if (!isBlogPosting) continue;
        schemaDescription = String(node.description || '').trim();
        break;
      }
      if (schemaDescription) break;
    } catch (_err) {
      // ignore invalid json-ld here; other validators handle it
    }
  }

  if (!metaDescription) {
    errors.push('Brak <meta name="description">.');
  } else {
    if (metaDescription.length < limits.descriptionMin || metaDescription.length > limits.descriptionMax) {
      errors.push(`meta description poza zakresem ${limits.descriptionMin}-${limits.descriptionMax} znaków (jest ${metaDescription.length}).`);
    }
    if (!/[.!?]$/.test(metaDescription)) {
      errors.push('meta description wygląda na urwany: powinien kończyć się ".", "!" lub "?".');
    }
  }

  if (!ogDescription) warnings.push('Brak og:description.');
  if (!twitterDescription) warnings.push('Brak twitter:description.');
  if (!schemaDescription) warnings.push('Brak BlogPosting.description w schema JSON-LD.');

  if (metaDescription && ogDescription && metaDescription !== ogDescription) {
    errors.push('Niespójny opis: meta description != og:description.');
  }
  if (metaDescription && twitterDescription && metaDescription !== twitterDescription) {
    errors.push('Niespójny opis: meta description != twitter:description.');
  }
  if (metaDescription && schemaDescription && metaDescription !== schemaDescription) {
    errors.push('Niespójny opis: meta description != BlogPosting.description.');
  }

  return { errors, warnings };
}

function validateArticleHeadFile(filePath, opts = {}) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return validateArticleHeadContract(raw, opts);
}

module.exports = {
  firstMatch,
  validateArticleHeadContract,
  validateArticleHeadFile,
};
