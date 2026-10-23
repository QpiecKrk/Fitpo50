'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEPLOYMENT_REGISTRY_RELATIVE = path.join('data', 'reports', 'popraw-seo-deployments.json');

function deploymentRegistryPath(root = process.cwd()) {
  return path.join(root, DEPLOYMENT_REGISTRY_RELATIVE);
}

function readDeploymentRegistry(root = process.cwd()) {
  const file = deploymentRegistryPath(root);
  if (!fs.existsSync(file)) return { file, registry: null };
  return { file, registry: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function seoPatchesForArticle(registry, slug) {
  const articleFile = `${String(slug || '').replace(/\.html$/i, '')}.html`;
  const matches = [];
  for (const target of Array.isArray(registry?.targets) ? registry.targets : []) {
    if (target?.file === articleFile) {
      matches.push({ id: String(target.id || 'UNKNOWN'), role: 'TARGET', file: articleFile });
    }
    for (const source of Array.isArray(target?.source_pages) ? target.source_pages : []) {
      if (source?.file === articleFile) {
        matches.push({ id: String(target.id || 'UNKNOWN'), role: 'SOURCE_PAGE', file: articleFile });
      }
    }
  }
  return matches;
}

module.exports = {
  DEPLOYMENT_REGISTRY_RELATIVE,
  deploymentRegistryPath,
  readDeploymentRegistry,
  seoPatchesForArticle,
};
