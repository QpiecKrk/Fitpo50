'use strict';

const { foldPolish } = require('./slugify');

function normalizeInternalHref(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const absolute = new URL(raw, 'https://fitpo50.pl/');
    if (!['fitpo50.pl', 'www.fitpo50.pl'].includes(absolute.hostname.toLowerCase())) return raw;
    return decodeURIComponent(absolute.pathname)
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/');
  } catch (_error) {
    return raw
      .replace(/^https?:\/\/(?:www\.)?fitpo50\.pl\//i, '')
      .replace(/^[./]+/, '')
      .replace(/[?#].*$/, '');
  }
}

function normalizePolishText(value) {
  return foldPolish(String(value || '').normalize('NFC'))
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAnchorTags(value) {
  return String(value || '').replace(/<a\b[^>]*>|<\/a>/gi, '');
}

module.exports = { normalizeInternalHref, normalizePolishText, stripAnchorTags };
