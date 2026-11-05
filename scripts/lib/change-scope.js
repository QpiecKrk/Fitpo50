'use strict';

const { spawnSync } = require('node:child_process');

const LOCAL_ONLY_UNTRACKED = new Set(['docs/fitpo50-modernization-master-plan.md']);
const MARKER_PATHS = new Set(['deployment.json', '_site/deployment.json']);
const ADMIN_TESTS = new Set([
  'tests/news-editor-color.test.js',
  'tests/news-db-write.test.js',
  'tests/news-db-read-cache.test.js',
  'tests/news-db-schema.test.js',
  'tests/news-feed-error-leak.test.js',
  'tests/retired-module-exposure.test.js',
]);

function normalize(file) {
  return String(file || '').replace(/^.* -> /, '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function lines(output) {
  return String(output || '').split('\n').map(normalize).filter(Boolean);
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${String(result.stderr || result.stdout || '').trim()}`);
  return lines(result.stdout);
}

function collectChangedFiles(cwd = process.cwd()) {
  const ahead = git(cwd, ['diff', '--name-only', '--no-renames', 'origin/main...HEAD']);
  const staged = git(cwd, ['diff', '--cached', '--name-only', '--no-renames']);
  const unstaged = git(cwd, ['diff', '--name-only', '--no-renames']);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard'])
    .filter((file) => !LOCAL_ONLY_UNTRACKED.has(file));
  return [...new Set([...ahead, ...staged, ...unstaged, ...untracked])].sort();
}

function withoutSitePrefix(file) {
  return normalize(file).replace(/^_site\//, '');
}

function isNewsPath(file) {
  const value = withoutSitePrefix(file);
  return value === 'data/news-live.json'
    || value.startsWith('data/news-backups/')
    || value.startsWith('assets/news/')
    || value === 'assets/data/news-fallback.json';
}

function isAdminPath(file) {
  const value = withoutSitePrefix(file);
  return value.startsWith('admin/') && !/\.md$/i.test(value);
}

function isArticlePath(file) {
  const value = withoutSitePrefix(file);
  return /^[^/]+\.html$/i.test(value)
    || ['sitemap.xml', 'llms.txt', 'llms-full.txt', 'assets/data/search-index.json'].includes(value)
    || value.startsWith('assets/pdf/')
    || (/^assets\/.+\.(?:avif|webp|jpe?g|png)$/i.test(value) && !value.startsWith('assets/news/'));
}

function isInfrastructurePath(file) {
  const value = normalize(file);
  const withoutSite = withoutSitePrefix(value);
  return /^(?:package(?:-lock)?\.json|\.htaccess)$/.test(withoutSite)
    || value.startsWith('.github/')
    || value.startsWith('.githooks/')
    || value.startsWith('scripts/');
}

function classifyChangedFiles(files) {
  const normalized = [...new Set((files || []).map(normalize).filter(Boolean))]
    .filter((file) => !MARKER_PATHS.has(file))
    .sort();
  const buckets = { admin: [], news: [], articles: [], full: [] };
  for (const file of normalized) {
    if (isInfrastructurePath(file)) buckets.full.push(file);
    else if (isNewsPath(file)) buckets.news.push(file);
    else if (isAdminPath(file) || ADMIN_TESTS.has(file)) buckets.admin.push(file);
    else if (isArticlePath(file)) buckets.articles.push(file);
    else buckets.full.push(file);
  }
  if (buckets.full.length || normalized.length === 0) {
    return { files: normalized, scopes: ['full'], full: true, buckets };
  }
  const scopes = ['admin', 'news', 'articles'].filter((scope) => buckets[scope].length > 0);
  return { files: normalized, scopes, full: false, buckets };
}

function filesForScope(classification, scope) {
  const values = [...(classification?.buckets?.[scope] || [])];
  return (scope === 'admin' ? values.filter(isAdminPath) : values).sort();
}

module.exports = {
  ADMIN_TESTS,
  classifyChangedFiles,
  collectChangedFiles,
  filesForScope,
  isAdminPath,
  isArticlePath,
  isNewsPath,
  normalize,
  withoutSitePrefix,
};
