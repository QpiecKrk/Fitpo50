#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function publicFingerprint(siteDir) {
  const required = ['index.html', 'porady.html', 'sitemap.xml', 'llms.txt', 'ads.txt'];
  const entries = required.map((relativePath) => {
    const absolutePath = path.join(siteDir, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Brak wymaganego pliku eksportu: ${relativePath}`);
    return `${relativePath}\0${sha256(fs.readFileSync(absolutePath))}`;
  });
  return sha256(entries.join('\n'));
}

function prepareDeploymentMarker(rootDir, options = {}) {
  const siteDir = path.join(rootDir, '_site');
  if (!fs.existsSync(siteDir)) throw new Error('Brak katalogu _site. Najpierw wykonaj eksport.');
  const marker = {
    version: 1,
    release_id: options.releaseId || crypto.randomUUID(),
    prepared_at: options.preparedAt || new Date().toISOString(),
    public_fingerprint_sha256: publicFingerprint(siteDir),
  };
  const serialized = `${JSON.stringify(marker, null, 2)}\n`;
  fs.writeFileSync(path.join(rootDir, 'deployment.json'), serialized, 'utf8');
  fs.writeFileSync(path.join(siteDir, 'deployment.json'), serialized, 'utf8');
  return marker;
}

if (require.main === module) {
  try {
    const marker = prepareDeploymentMarker(process.cwd());
    console.log(`[DEPLOYMENT PREPARED] ${marker.release_id}`);
    console.log('Marker: deployment.json oraz _site/deployment.json');
  } catch (error) {
    console.error(`[DEPLOYMENT PREPARE][FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { prepareDeploymentMarker, publicFingerprint, sha256 };
