'use strict';

const { spawnSync } = require('node:child_process');

function safeSlug(value) {
  const slug = String(value || '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Niepoprawny slug: ${slug || 'MISSING'}.`);
  return slug;
}

function isSlugPublishedInHead(root, value, runner = spawnSync) {
  const slug = safeSlug(value);
  const result = runner('git', ['cat-file', '-e', `HEAD:${slug}.html`], { cwd: root, encoding: 'utf8' });
  if (result.status === 0) return true;
  const detail = String(result.stderr || result.stdout || `exit ${result.status}`).trim();
  if (result.status === 128 && /does not exist in ['"]?HEAD|exists on disk, but not in ['"]?HEAD/i.test(detail)) return false;
  throw new Error(`Nie można sprawdzić sluga ${slug} w HEAD: ${detail}`);
}

function articleOperationInHead(root, slug, runner = spawnSync) {
  return isSlugPublishedInHead(root, slug, runner) ? 'UPDATE' : 'CREATE';
}

module.exports = { articleOperationInHead, isSlugPublishedInHead };
