#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--file') out.file = String(argv[i + 1] || '').trim(), i += 1;
    else if (token === '--map') out.map = String(argv[i + 1] || '').trim(), i += 1;
  }
  return out;
}

function cleanupSeoTitle(raw) {
  return String(raw || '').replace(/\s+/g, ' ').replace(/[–-]\s*$/g, '').trim();
}

function applyLinkMapToHtml(html, mapObj) {
  let out = String(html || '');
  for (const [from, to] of Object.entries(mapObj)) {
    const variants = [
      `./${from.replace(/^\.\//, '').replace(/^\//, '')}`,
      `/${from.replace(/^\.\//, '').replace(/^\//, '')}`,
      from,
    ];
    for (const variant of variants) {
      out = out.split(`href=\"${variant}\"`).join(`href=\"${to}\"`);
      out = out.split(`href='${variant}'`).join(`href='${to}'`);
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Użycie: node scripts/json-autofix-strict.js --file <path.fitpo50.json> [--map data/internal-link-map.json]');
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`[FAIL] Brak pliku: ${filePath}`);
    process.exit(1);
  }
  const mapPath = path.resolve(process.cwd(), args.map || 'data/internal-link-map.json');
  const mapObj = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const changes = [];

  if (Array.isArray(json.key_takeaways) && json.key_takeaways.length > 4) {
    json.key_takeaways = json.key_takeaways.slice(0, 4);
    changes.push('key_takeaways -> przycięto do 4 bez dopisywania treści');
  }

  const nextSeo = cleanupSeoTitle(json.seo_title || json.meta_title || '');
  if (nextSeo && nextSeo !== String(json.seo_title || '')) {
    json.seo_title = nextSeo;
    changes.push('seo_title -> usunięto wyłącznie techniczną urwaną końcówkę');
  }
  if (json.seo_title) {
    const seoTitle = String(json.seo_title).trim();
    if (json.og_title !== seoTitle || json.twitter_title !== seoTitle) {
      json.og_title = seoTitle;
      json.twitter_title = seoTitle;
      changes.push('og_title/twitter_title -> zsynchronizowano z istniejącym seo_title');
    }
  }

  if (Array.isArray(json.sections)) {
    json.sections.forEach((section, index) => {
      if (!Array.isArray(section?.paragraphs_html)) return;
      const patched = section.paragraphs_html.map((html) => applyLinkMapToHtml(html, mapObj));
      if (JSON.stringify(patched) !== JSON.stringify(section.paragraphs_html)) {
        section.paragraphs_html = patched;
        changes.push(`sections[${index}].paragraphs_html -> zaktualizowano wyłącznie istniejące mapowania URL`);
      }
    });
  }

  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log('[OK] json-autofix-strict: struktura techniczna bez generowania treści, FAQ i źródeł');
  changes.forEach((change) => console.log(`- ${change}`));
}

if (require.main === module) main();

module.exports = { applyLinkMapToHtml, cleanupSeoTitle, parseArgs };
