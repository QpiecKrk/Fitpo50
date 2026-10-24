'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEPLOYMENT_REGISTRY_RELATIVE = path.join('data', 'reports', 'popraw-seo-deployments.json');

function deploymentKey(deployment) {
  const targets = (Array.isArray(deployment?.targets) ? deployment.targets : [])
    .map((target) => JSON.stringify(target))
    .sort()
    .join('|');
  return `${deployment?.generated_at || ''}|${targets}`;
}

function deploymentEntries(registry) {
  if (!registry || typeof registry !== 'object') return [];
  const entries = Array.isArray(registry.deployments) ? registry.deployments.filter(Boolean) : [];
  const current = Array.isArray(registry.targets) ? {
    version: 1,
    generated_at: registry.generated_at,
    status: registry.status,
    source_report_generated_at: registry.source_report_generated_at,
    approved_ids: registry.approved_ids,
    targets: registry.targets,
  } : null;
  const merged = current ? [...entries, current] : entries;
  const unique = new Map();
  for (const entry of merged) unique.set(deploymentKey(entry), entry);
  return [...unique.values()];
}

function appendDeploymentRegistry(existing, deployment) {
  const previous = deploymentEntries(existing);
  const nextKey = deploymentKey(deployment);
  const history = previous.filter((entry) => deploymentKey(entry) !== nextKey);
  history.push(deployment);
  return {
    ...deployment,
    version: 2,
    deployments: history,
  };
}

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
  for (const deployment of deploymentEntries(registry)) {
    for (const target of Array.isArray(deployment?.targets) ? deployment.targets : []) {
      if (target?.file === articleFile) {
        matches.push({ id: String(target.id || 'UNKNOWN'), role: 'TARGET', file: articleFile });
      }
      for (const source of Array.isArray(target?.source_pages) ? target.source_pages : []) {
        if (source?.file === articleFile) {
          matches.push({ id: String(target.id || 'UNKNOWN'), role: 'SOURCE_PAGE', file: articleFile });
        }
      }
    }
  }
  return [...new Map(matches.map((match) => [`${match.id}:${match.role}:${match.file}`, match])).values()];
}

module.exports = {
  DEPLOYMENT_REGISTRY_RELATIVE,
  appendDeploymentRegistry,
  deploymentEntries,
  deploymentRegistryPath,
  readDeploymentRegistry,
  seoPatchesForArticle,
};
