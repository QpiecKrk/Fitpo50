#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { prepareArticleArchitecture } = require('./lib/article-intent-links');

function parseArgs(argv) {
  const out = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      index += 1;
    }
  }
  out.write = String(out.write).toLowerCase() === 'true';
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log('Użycie: node scripts/prepare-article-architecture.js --file <draft.fitpo50.json> --write true|false');
    return;
  }
  if (!args.file) throw new Error('Użycie: node scripts/prepare-article-architecture.js --file <draft.fitpo50.json> --write true|false');
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw new Error(`Brak pliku: ${file}`);
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = prepareArticleArchitecture(article, { root: process.cwd(), mutate: args.write });
  if (args.write) fs.writeFileSync(file, `${JSON.stringify(article, null, 2)}\n`, 'utf8');

  console.log(`[ARTICLE-ARCHITECTURE] inventory=${result.inventory_count}`);
  console.log(`[ARTICLE-ARCHITECTURE] intent=${result.strategy.search_intent || result.strategy.intent || 'MISSING'} primary=${result.strategy.primary || 'MISSING'}`);
  console.log(`[ARTICLE-ARCHITECTURE] links=${result.confirmed_link_count}/4 added=${result.added_links.length}`);
  console.log(`[ARTICLE-ARCHITECTURE] inbound_suggestions=${result.incoming_link_suggestions.length}`);
  if (result.topic_center_assessment.proposed) {
    console.log(`[ARTICLE-ARCHITECTURE] center=${result.topic_center_assessment.center_name} status=AWAITING_USER_APPROVAL`);
  } else {
    console.log(`[ARTICLE-ARCHITECTURE] center=NO_PROPOSAL fit=${result.topic_center_assessment.fit}`);
  }
  result.warnings.forEach((warning) => console.warn(`[WARN] ${warning}`));
  if (!result.ok) {
    result.errors.forEach((error) => console.error(`[FAIL] ${error}`));
    process.exitCode = 2;
    return;
  }
  console.log('[PASS] Article intent, linking and center assessment OK.');
}

try {
  main();
} catch (error) {
  console.error(`[ARTICLE-ARCHITECTURE][FAIL] ${error.message || error}`);
  process.exit(1);
}

module.exports = { main, parseArgs };
