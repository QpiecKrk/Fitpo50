#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.cwd();
const SOURCES = [
  { name: '.env.local', file: path.join(ROOT, '.env.local') },
  { name: '~/.fitpo50-gsc.env', file: path.join(os.homedir(), '.fitpo50-gsc.env') },
];
const NAMES = [
  'GSC_SITE_URL', 'GSC_SERVICE_ACCOUNT_JSON', 'GSC_SERVICE_ACCOUNT_JSON_B64',
  'GSC_OAUTH_CLIENT_ID', 'GSC_OAUTH_CLIENT_SECRET', 'GSC_OAUTH_REFRESH_TOKEN',
  'INDEXNOW_KEY', 'INDEXNOW_KEY_LOCATION',
];

function variableNames(file) {
  if (!fs.existsSync(file)) return new Set();
  const names = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) names.add(match[1]);
  }
  return names;
}

for (const source of SOURCES) {
  const names = variableNames(source.file);
  console.log(`${source.name}: ${fs.existsSync(source.file) ? 'FOUND' : 'MISSING'}`);
  for (const name of NAMES) console.log(`- ${name}: ${names.has(name) ? 'DECLARED' : 'ABSENT'}`);
}
console.log('GitHub Actions: sprawdź wyłącznie nazwy sekretów w Settings > Secrets and variables > Actions. Wartości nie są odczytywane ani logowane.');
