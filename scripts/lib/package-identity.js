'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function referencedPackageFiles(jsonFile, assetsDir, article) {
  void article;
  const files = new Set([path.resolve(jsonFile)]);
  const visit = (directory) => {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.add(path.resolve(target));
    }
  };
  visit(path.resolve(assetsDir));
  for (const prompt of Array.isArray(article?.image_prompts_v4) ? article.image_prompts_v4 : []) {
    const base = String(prompt?.filename_base || '').trim();
    if (!base || base !== path.basename(base)) continue;
    for (const extension of ['avif', 'webp', 'jpg']) files.add(path.resolve(assetsDir, `${base}.${extension}`));
  }
  return [...files].sort((left, right) => left.localeCompare(right, 'pl'));
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
  return { hash, entries };
}

module.exports = { packageIdentity, referencedPackageFiles, sha256File };
