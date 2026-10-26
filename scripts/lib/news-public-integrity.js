'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const IMAGE_EXTS = ['avif', 'webp', 'jpg'];
const PUBLIC_FALLBACK = 'assets/data/news-fallback.json';

function normalizeRelative(value) {
  return String(value || '').trim().replace(/^\.\//, '').replace(/\\/g, '/');
}

function isRuntimeNewsThumb(value) {
  return /^news_20/i.test(path.basename(String(value || ''), path.extname(String(value || ''))));
}

function isGitTracked(root, relative) {
  return spawnSync('git', ['ls-files', '--error-unmatch', '--', relative], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  }).status === 0;
}

function readPublicFallback(root, relative = PUBLIC_FALLBACK) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return { errors: [`Brak pliku: ${relative}`], items: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return { errors: [`${relative}: wymagane version=1 i items[].`], items: [] };
    }
    return { errors: [], items: parsed.items };
  } catch (error) {
    return { errors: [`${relative}: niepoprawny JSON (${error.message}).`], items: [] };
  }
}

function validatePublicNewsCheckout(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const fallback = readPublicFallback(root, options.fallbackPath || PUBLIC_FALLBACK);
  const errors = [...fallback.errors];
  const warnings = [];
  const runtimeImages = [];

  for (const item of fallback.items) {
    if (!item || typeof item !== 'object') {
      errors.push(`${PUBLIC_FALLBACK}: wpis NEWS nie jest obiektem.`);
      continue;
    }
    const title = String(item.title || item.id || '(bez tytułu)');
    if (String(item.status || '').toLowerCase() === 'draft') {
      errors.push(`${PUBLIC_FALLBACK}: publiczny fallback zawiera szkic "${title}".`);
    }
    const image = item.image;
    if (!image || typeof image !== 'object' || Array.isArray(image)) {
      errors.push(`${PUBLIC_FALLBACK}: news "${title}" nie ma obiektu image.`);
      continue;
    }

    let expectedBase = '';
    for (const ext of IMAGE_EXTS) {
      const relative = normalizeRelative(image[ext]);
      if (!relative) {
        errors.push(`${PUBLIC_FALLBACK}: news "${title}" nie ma image.${ext}.`);
        continue;
      }
      if (relative.includes('..') || path.isAbsolute(relative) || !new RegExp(`^assets/news/[A-Za-z0-9_-]+\\.${ext}$`, 'i').test(relative)) {
        errors.push(`${PUBLIC_FALLBACK}: news "${title}" ma niedozwoloną ścieżkę image.${ext}="${relative}".`);
        continue;
      }
      const base = relative.slice(0, -(ext.length + 1));
      if (expectedBase && base !== expectedBase) {
        errors.push(`${PUBLIC_FALLBACK}: news "${title}" używa różnych nazw bazowych wariantów obrazu.`);
      }
      expectedBase = expectedBase || base;

      const mirror = `_site/${relative}`;
      const sourceTracked = isGitTracked(root, relative);
      const mirrorTracked = isGitTracked(root, mirror);
      if (sourceTracked || mirrorTracked) {
        if (sourceTracked && !fs.existsSync(path.join(root, relative))) {
          errors.push(`${relative}: śledzona miniatura NEWS nie istnieje w checkout.`);
        }
        if (mirrorTracked && !fs.existsSync(path.join(root, mirror))) {
          errors.push(`${mirror}: śledzona miniatura NEWS nie istnieje w checkout.`);
        }
        continue;
      }

      if (!isRuntimeNewsThumb(relative)) {
        errors.push(`${relative}: miniatura NEWS nie jest śledzona przez Git ani oznaczona jako runtime news_20*.`);
        continue;
      }
      runtimeImages.push({ title, relative, remotePath: `/${relative.slice('assets/'.length)}` });
    }
  }

  return {
    errors,
    warnings,
    runtimeImages: runtimeImages.sort((left, right) => left.relative.localeCompare(right.relative, 'pl')),
    items: fallback.items,
  };
}

module.exports = {
  IMAGE_EXTS,
  PUBLIC_FALLBACK,
  isGitTracked,
  isRuntimeNewsThumb,
  normalizeRelative,
  readPublicFallback,
  validatePublicNewsCheckout,
};
