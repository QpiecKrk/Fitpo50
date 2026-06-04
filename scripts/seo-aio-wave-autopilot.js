#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.cwd();
const DEFAULT_WORK_DIR = path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
const DEFAULT_INPUT = path.join(DEFAULT_WORK_DIR, 'seo-aio-command-center.json');
const DEFAULT_OUTPUT_DIR = DEFAULT_WORK_DIR;
const APPLY_CONFIRMATION = 'APPLY_WAVE';

function parseArgs(argv) {
  const out = {
    input: DEFAULT_INPUT,
    outputDir: DEFAULT_OUTPUT_DIR,
    mirrorDir: path.join(ROOT, 'data', 'reports'),
    wave: 'wave_1_fast_page_one',
    limit: 5,
    linksPerTarget: 2,
    mode: 'proposal',
    apply: false,
    confirm: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    const value = String(argv[i + 1] || '').trim();
    if (token === '--input' && value) {
      out.input = path.resolve(ROOT, value);
      i += 1;
      continue;
    }
    if (token === '--output-dir' && value) {
      out.outputDir = path.resolve(ROOT, value);
      i += 1;
      continue;
    }
    if (token === '--mirror-dir' && value) {
      out.mirrorDir = path.resolve(ROOT, value);
      i += 1;
      continue;
    }
    if (token === '--no-mirror') {
      out.mirrorDir = '';
      continue;
    }
    if (token === '--wave' && value) {
      out.wave = normalizeWave(value);
      i += 1;
      continue;
    }
    if (token === '--limit' && value) {
      out.limit = Math.max(1, Number(value) || out.limit);
      i += 1;
      continue;
    }
    if (token === '--links-per-target' && value) {
      out.linksPerTarget = Math.max(1, Number(value) || out.linksPerTarget);
      i += 1;
      continue;
    }
    if (token === '--mode' && value) {
      out.mode = value;
      i += 1;
      continue;
    }
    if (token === '--apply') {
      out.apply = value === 'true';
      i += value ? 1 : 0;
      continue;
    }
    if (token === '--confirm' && value) {
      out.confirm = value;
      i += 1;
    }
  }
  return out;
}

function normalizeWave(input) {
  const value = String(input || '').trim().toLowerCase();
  const aliases = {
    '1': 'wave_1_fast_page_one',
    wave1: 'wave_1_fast_page_one',
    p0: 'wave_1_fast_page_one',
    '2': 'wave_2_discovery',
    wave2: 'wave_2_discovery',
    discovery: 'wave_2_discovery',
    '3': 'wave_3_refresh_geo_aio',
    wave3: 'wave_3_refresh_geo_aio',
    refresh: 'wave_3_refresh_geo_aio',
    '4': 'wave_4_scale_winners',
    wave4: 'wave_4_scale_winners',
    winners: 'wave_4_scale_winners',
    '5': 'wave_5_core_support',
    wave5: 'wave_5_core_support',
    core: 'wave_5_core_support',
  };
  return aliases[value] || value;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeText(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${String(data || '').trimEnd()}\n`, 'utf8');
}

function fileFromUrl(url) {
  try {
    return new URL(String(url || '')).pathname.replace(/^\/+/, '') || 'index.html';
  } catch (_) {
    return String(url || '').replace(/^\.?\//, '');
  }
}

function cleanAnchor(input, fallback) {
  return String(input || fallback || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>"]/g, '')
    .trim()
    .slice(0, 90);
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unique(items) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function buildLinkOperations(cards, linksPerTarget) {
  const ops = [];
  for (const card of cards) {
    const targetFile = fileFromUrl(card.url);
    const sources = Array.isArray(card.internal_link_sources) ? card.internal_link_sources : [];
    for (const source of sources.slice(0, linksPerTarget)) {
      const sourceFile = String(source.from || '').replace(/^\.?\//, '').trim();
      if (!sourceFile || sourceFile === targetFile) continue;
      ops.push({
        target_url: card.url,
        target_file: targetFile,
        source_file: sourceFile,
        anchor: cleanAnchor(source.anchor, card.keyword_plan?.primary || card.title),
        card_type: card.type,
        reason: source.placement || 'Sugerowane źródło z mapy linkowania GSC.',
      });
    }
  }
  return ops;
}

function hasArticleContent(html) {
  return /<article\s+class="article-content">/i.test(html);
}

function hasHrefToTarget(html, targetFile) {
  const escaped = targetFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<a\\b[^>]*href=["'](?:\\.\\/)?${escaped}(?:[?#][^"']*)?["']`, 'i').test(html);
}

function formatWarsawIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+02:00`;
}

function updateModifiedDates(html, iso) {
  let next = html;
  next = next.replace(/(<meta\s+property="article:modified_time"\s+content=")[^"]*(")/i, `$1${iso}$2`);
  next = next.replace(/("dateModified"\s*:\s*")[^"]*(")/g, `$1${iso}$2`);
  return next;
}

function insertContextLink(html, op) {
  if (!hasArticleContent(html)) return { changed: false, reason: 'NO_ARTICLE_CONTENT', html };
  if (hasHrefToTarget(html, op.target_file)) return { changed: false, reason: 'LINK_ALREADY_EXISTS', html };
  const paragraph = [
    '<p>',
    'W tym samym kontekście warto też sprawdzić ',
    `<a href="${escapeHtml(op.target_file)}">${escapeHtml(op.anchor)}</a>`,
    ', bo ten temat pomaga lepiej ułożyć kolejny krok po 50-tce.',
    '</p>',
  ].join('');
  const articleEnd = html.lastIndexOf('</article>');
  if (articleEnd === -1) return { changed: false, reason: 'NO_ARTICLE_END', html };
  const next = `${html.slice(0, articleEnd).trimEnd()}\n${paragraph}\n    ${html.slice(articleEnd)}`;
  return { changed: true, reason: 'INSERTED', html: next };
}

function applySafeLinks(ops) {
  const iso = formatWarsawIso();
  const results = [];
  const grouped = new Map();
  for (const op of ops) {
    if (!grouped.has(op.source_file)) grouped.set(op.source_file, []);
    grouped.get(op.source_file).push(op);
  }

  for (const [sourceFile, sourceOps] of grouped.entries()) {
    const sourcePath = path.join(ROOT, sourceFile);
    const sitePath = path.join(ROOT, '_site', sourceFile);
    if (!fs.existsSync(sourcePath)) {
      results.push({ source_file: sourceFile, changed: false, reason: 'SOURCE_MISSING' });
      continue;
    }
    let html = fs.readFileSync(sourcePath, 'utf8');
    const fileResults = [];
    for (const op of sourceOps) {
      const inserted = insertContextLink(html, op);
      html = inserted.html;
      fileResults.push({ ...op, changed: inserted.changed, reason: inserted.reason });
    }
    const changed = fileResults.some((item) => item.changed);
    if (changed) {
      html = updateModifiedDates(html, iso);
      fs.writeFileSync(sourcePath, html, 'utf8');
      if (fs.existsSync(sitePath)) {
        let siteHtml = fs.readFileSync(sitePath, 'utf8');
        for (const op of sourceOps) {
          siteHtml = insertContextLink(siteHtml, op).html;
        }
        siteHtml = updateModifiedDates(siteHtml, iso);
        fs.writeFileSync(sitePath, siteHtml, 'utf8');
      }
    }
    results.push({ source_file: sourceFile, changed, operations: fileResults });
  }
  return { mode: 'safe-links', modified_at: iso, results };
}

function buildProposal(report, args) {
  const cards = Array.isArray(report.waves?.[args.wave]) ? report.waves[args.wave].slice(0, args.limit) : [];
  const linkOperations = buildLinkOperations(cards, args.linksPerTarget);
  const gscQueue = unique(cards.flatMap((card) => card.promotion_urls || []));
  return {
    generated_at: new Date().toISOString(),
    status: args.apply ? 'APPLY_REQUESTED' : 'AWAITING_USER_APPROVAL',
    approval_gate: {
      default_behavior: 'proposal_only_no_file_changes',
      apply_requires: `--apply true --mode safe-links --confirm ${APPLY_CONFIRMATION}`,
      reason: 'Po komendzie GSC agent ma zaproponować falę i czekać na zatwierdzenie przed edycją artykułów.',
    },
    source_report: args.input,
    wave: args.wave,
    selected_cards: cards,
    proposed_changes: {
      mode: 'safe-links',
      link_operations: linkOperations,
      content_upgrades: cards.map((card) => ({
        url: card.url,
        file: card.file,
        type: card.type,
        tasks: card.tasks,
        validation_commands: card.validation_commands,
        measurement: card.measurement,
        performance_delta: card.performance_delta,
      })),
    },
    gsc_submit_queue: gscQueue,
    validation_after_approval: unique(cards.flatMap((card) => card.validation_commands || []).concat([
      'npm run llms:full',
      'npm run assets:mirror:sync',
      'npm run predeploy:check',
      'npm run gsc:auto',
    ])),
  };
}

function writeMarkdown(proposal, file) {
  const lines = [];
  lines.push('# SEO/AIO Wave Autopilot — propozycja wdrożenia');
  lines.push('');
  lines.push(`Wygenerowano: ${proposal.generated_at}`);
  lines.push(`Status: ${proposal.status}`);
  lines.push(`Fala: ${proposal.wave}`);
  lines.push('');
  lines.push('## Bramka Zatwierdzenia');
  lines.push('- Domyślnie ten raport niczego nie zmienia w artykułach.');
  lines.push(`- Wdrożenie wymaga osobnej komendy: \`npm run seo:aio:apply-wave -- --wave ${proposal.wave} --apply true --mode safe-links --confirm ${APPLY_CONFIRMATION}\``);
  lines.push('- Tryb `safe-links` dodaje tylko linki kontekstowe z raportu i aktualizuje `dateModified`; większe zmiany treściowe wymagają osobnej pracy redakcyjnej.');
  lines.push('');
  lines.push('## Wybrane Karty');
  if (!proposal.selected_cards.length) {
    lines.push('- Brak kart w tej fali.');
  }
  proposal.selected_cards.forEach((card, index) => {
    lines.push(`${index + 1}. ${card.url}`);
    lines.push(`   - typ: ${card.type}, score: ${card.score?.total}, SEO/AEO/GEO/AIO: ${card.score?.seo}/${card.score?.aeo}/${card.score?.geo}/${card.score?.aio}`);
    lines.push(`   - fraza: ${card.keyword_plan?.primary || 'INSUFFICIENT_DATA'}`);
    lines.push(`   - GSC: impr ${card.gsc?.impressions || 0}, clicks ${card.gsc?.clicks || 0}, CTR ${card.gsc?.ctr || 0}%, pos ${card.gsc?.position || 0}`);
    (card.tasks || []).slice(0, 5).forEach((task) => lines.push(`   - zadanie: ${task}`));
  });
  lines.push('');
  lines.push('## Linki Do Wdrożenia Po Zatwierdzeniu');
  if (!proposal.proposed_changes.link_operations.length) {
    lines.push('- Brak bezpiecznych operacji linkowania w tej fali.');
  }
  proposal.proposed_changes.link_operations.forEach((op) => {
    lines.push(`- ${op.source_file} → ${op.target_file} jako "${op.anchor}"`);
  });
  lines.push('');
  lines.push('## URL-e Do GSC Po Wdrożeniu');
  proposal.gsc_submit_queue.forEach((url) => lines.push(`- ${url}`));
  lines.push('');
  lines.push('## Walidacja Po Zatwierdzeniu');
  proposal.validation_after_approval.forEach((cmd) => lines.push(`- \`${cmd}\``));
  if (proposal.apply_result) {
    lines.push('');
    lines.push('## Wynik Wdrożenia');
    proposal.apply_result.results.forEach((row) => {
      lines.push(`- ${row.source_file}: ${row.changed ? 'CHANGED' : 'SKIPPED'}`);
      (row.operations || []).forEach((op) => lines.push(`  - ${op.target_file}: ${op.reason}`));
    });
  }
  writeText(file, lines.join('\n'));
}

function outputPaths(args) {
  return {
    json: path.join(args.outputDir, 'seo-aio-wave-proposal.json'),
    md: path.join(args.outputDir, 'seo-aio-wave-proposal.md'),
    gsc: path.join(args.outputDir, 'seo-aio-wave-gsc-submit.txt'),
    mirrorJson: args.mirrorDir ? path.join(args.mirrorDir, 'seo-aio-wave-proposal.json') : '',
    mirrorMd: args.mirrorDir ? path.join(args.mirrorDir, 'seo-aio-wave-proposal.md') : '',
    mirrorGsc: args.mirrorDir ? path.join(args.mirrorDir, 'seo-aio-wave-gsc-submit.txt') : '',
  };
}

function writeOutputs(proposal, args) {
  const paths = outputPaths(args);
  writeJson(paths.json, proposal);
  writeMarkdown(proposal, paths.md);
  writeText(paths.gsc, proposal.gsc_submit_queue.join('\n'));
  if (args.mirrorDir) {
    writeJson(paths.mirrorJson, proposal);
    writeMarkdown(proposal, paths.mirrorMd);
    writeText(paths.mirrorGsc, proposal.gsc_submit_queue.join('\n'));
  }
  return paths;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = readJson(args.input);
  const proposal = buildProposal(report, args);
  if (args.apply) {
    if (args.mode !== 'safe-links' || args.confirm !== APPLY_CONFIRMATION) {
      throw new Error(`APPLY_BLOCKED: wdrożenie wymaga --mode safe-links --confirm ${APPLY_CONFIRMATION}`);
    }
    proposal.status = 'APPLIED_SAFE_LINKS';
    proposal.apply_result = applySafeLinks(proposal.proposed_changes.link_operations);
  }
  const paths = writeOutputs(proposal, args);
  console.log(`[SEO-AIO-WAVE] wave=${proposal.wave} cards=${proposal.selected_cards.length} status=${proposal.status}`);
  console.log(`[SEO-AIO-WAVE] proposal: ${paths.md}`);
  console.log(`[SEO-AIO-WAVE] gsc queue: ${paths.gsc}`);
  if (!args.apply) {
    console.log(`[SEO-AIO-WAVE] awaiting approval: npm run seo:aio:apply-wave -- --wave ${proposal.wave} --apply true --mode safe-links --confirm ${APPLY_CONFIRMATION}`);
  }
}

main();
