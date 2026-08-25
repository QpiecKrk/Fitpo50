#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.cwd();
const DEFAULT_WORK_DIR = path.join(os.homedir(), 'Downloads', 'gsc-auto-input');
const DEFAULT_INPUT = path.join(DEFAULT_WORK_DIR, 'seo-aio-command-center.json');
const DEFAULT_OUTPUT_DIR = DEFAULT_WORK_DIR;

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

function buildProposal(report, args) {
  const cards = Array.isArray(report.waves?.[args.wave]) ? report.waves[args.wave].slice(0, args.limit) : [];
  const linkOperations = buildLinkOperations(cards, args.linksPerTarget);
  const plannedGscQueue = unique(cards.flatMap((card) => card.promotion_urls || []));
  return {
    generated_at: new Date().toISOString(),
    status: args.apply ? 'APPLY_REQUESTED' : 'AWAITING_USER_APPROVAL',
    approval_gate: {
      default_behavior: 'proposal_only_no_file_changes',
      apply_requires: 'Zatwierdzony data/reports/popraw-seo-patches.json oraz popraw-seo:apply.',
      reason: 'Po komendzie GSC agent ma zaproponować falę i czekać na zatwierdzenie przed edycją artykułów.',
    },
    source_report: args.input,
    wave: args.wave,
    selected_cards: cards,
    proposed_changes: {
      mode: 'proposal_only',
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
    planned_gsc_submit_queue: plannedGscQueue,
    gsc_submit_queue: [],
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
  lines.push('- Stary tryb automatycznego dopisywania linków jest wyłączony, ponieważ tworzył generyczny akapit.');
  lines.push('- Wdrożenie wykonuje wyłącznie `popraw-seo:apply` na konkretnym, zatwierdzonym manifeście patchy.');
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
    throw new Error('APPLY_BLOCKED: generyczny safe-links został wycofany. Użyj zatwierdzonego manifestu przez popraw-seo:apply.');
  }
  const paths = writeOutputs(proposal, args);
  console.log(`[SEO-AIO-WAVE] wave=${proposal.wave} cards=${proposal.selected_cards.length} status=${proposal.status}`);
  console.log(`[SEO-AIO-WAVE] proposal: ${paths.md}`);
  console.log(`[SEO-AIO-WAVE] gsc queue: ${paths.gsc}`);
  if (!args.apply) console.log('[SEO-AIO-WAVE] awaiting approval: dalsze wdrożenie tylko przez konkretny manifest popraw-seo:apply.');
}

main();
