'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function articlePackageFileNames(article) {
  const names = new Set();
  const slug = String(article?.slug || '').trim();
  for (const prompt of Array.isArray(article?.image_prompts_v4) ? article.image_prompts_v4 : []) {
    const base = String(prompt?.filename_base || '').trim();
    const sourceFile = String(prompt?.source_file || '').trim();
    if (!slug || (base !== slug && !base.startsWith(`${slug}-`))) continue;
    if (sourceFile && sourceFile === path.basename(sourceFile)) names.add(sourceFile);
    if (!base || base !== path.basename(base)) continue;
    for (const extension of ['avif', 'webp', 'jpg']) names.add(`${base}.${extension}`);
  }
  return names;
}

function referencedPackageFiles(jsonFile, assetsDir, article) {
  const files = new Set([path.resolve(jsonFile)]);
  for (const name of articlePackageFileNames(article)) files.add(path.resolve(assetsDir, name));
  return [...files].sort((left, right) => left.localeCompare(right, 'pl'));
}

function ignoredPackageFiles(jsonFile, assetsDir, article) {
  const root = path.resolve(assetsDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  const referenced = new Set(referencedPackageFiles(jsonFile, root, article).map((file) => path.resolve(file)));
  const discovered = [];
  const visit = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.isFile()) discovered.push(path.resolve(target));
  });
  visit(root);
  return discovered
    .filter((file) => !referenced.has(file))
    .map((file) => path.relative(root, file).replace(/\\/g, '/'))
    .sort((left, right) => left.localeCompare(right, 'pl'));
}

function packageIdentity(jsonFile, assetsDir, article) {
  const root = path.resolve(assetsDir);
  const entries = referencedPackageFiles(jsonFile, root, article).map((file) => ({
    path: path.relative(root, file).replace(/\\/g, '/') || path.basename(file),
    sha256: fs.existsSync(file) && fs.statSync(file).isFile() ? sha256File(file) : null,
  }));
  const hash = crypto.createHash('sha256')
    .update(entries.map((entry) => `${entry.path}\0${entry.sha256 || 'MISSING'}`).join('\n'))
    .digest('hex');
  return { hash, entries, ignored_files: ignoredPackageFiles(jsonFile, root, article) };
}

module.exports = { articlePackageFileNames, ignoredPackageFiles, packageIdentity, referencedPackageFiles, sha256File };
