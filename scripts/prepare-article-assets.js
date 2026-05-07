#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const ASSETS = path.join(ROOT, 'assets');
const SITE_ASSETS = path.join(ROOT, '_site', 'assets');
const SOURCE_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'avif'];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const key = t.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function must(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed`);
  }
}

function findSourceImage(baseName, fromDir) {
  const files = fs.readdirSync(fromDir);
  const cleanBase = String(baseName || '')
    .trim()
    .normalize('NFKC')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const exact = files.find((name) => {
    const lower = name.toLowerCase().normalize('NFKC').replace(/[\u00A0\u2007\u202F]/g, ' ');
    return SOURCE_IMAGE_EXT.some((ext) => lower === `${cleanBase}.${ext}`);
  });
  if (exact) return path.join(fromDir, exact);

  const norm = (x) => x
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();
  const target = norm(cleanBase);
  for (const name of files) {
    const ext = path.extname(name).slice(1).toLowerCase();
    if (!SOURCE_IMAGE_EXT.includes(ext)) continue;
    const b = name.slice(0, -(ext.length + 1));
    if (norm(b) === target) return path.join(fromDir, name);
  }
  const tokenize = (x) => x
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
  const targetTokens = tokenize(cleanBase);
  let best = null;
  let bestScore = 0;
  for (const name of files) {
    const ext = path.extname(name).slice(1).toLowerCase();
    if (!SOURCE_IMAGE_EXT.includes(ext)) continue;
    const fileBase = name.slice(0, -(ext.length + 1));
    const fileTokens = new Set(tokenize(fileBase));
    let score = 0;
    for (const t of targetTokens) {
      if (fileTokens.has(t)) score += 1;
      if (t === 'staircase' && (fileTokens.has('schody') || fileTokens.has('stairs'))) score += 1;
      if (t === 'hero' && (fileTokens.has('lead') || fileTokens.has('hero'))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  if (best && bestScore > 0) return path.join(fromDir, best);
  return null;
}

function convertOne(src, targetBaseName) {
  const outJpg = path.join(ASSETS, `${targetBaseName}.jpg`);
  const outWebp = path.join(ASSETS, `${targetBaseName}.webp`);
  const outAvif = path.join(ASSETS, `${targetBaseName}.avif`);

  must('magick', [src, '-quality', '88', outJpg]);
  must('magick', [outJpg, '-quality', '82', outWebp]);
  must('magick', [outJpg, '-quality', '50', outAvif]);

  fs.copyFileSync(outJpg, path.join(SITE_ASSETS, path.basename(outJpg)));
  fs.copyFileSync(outWebp, path.join(SITE_ASSETS, path.basename(outWebp)));
  fs.copyFileSync(outAvif, path.join(SITE_ASSETS, path.basename(outAvif)));
}

function toSlugSectionBase(slug, index) {
  return `${slug}-sekcja-${index + 1}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file ? path.resolve(args.file) : '';
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node scripts/prepare-article-assets.js --file <path.fitpo50.json> [--from <dir>]');
    process.exit(1);
  }
  const fromDir = path.resolve(args.from || path.dirname(file));
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const slug = String(json.slug || '').trim();
  if (!slug) throw new Error('Brak slug w JSON');
  const hero = String(json.hero_image || '').trim();
  if (!hero) throw new Error('Brak hero_image w JSON');

  ensureDir(ASSETS);
  ensureDir(SITE_ASSETS);

  const heroSrc = findSourceImage(hero, fromDir);
  if (!heroSrc) throw new Error(`Brak hero source: ${hero}.* w ${fromDir}`);
  convertOne(heroSrc, hero);
  console.log(`[OK] hero prepared: ${hero}`);

  const promptsV4 = Array.isArray(json.image_prompts_v4) ? json.image_prompts_v4 : [];
  const promptsLegacy = Array.isArray(json.image_prompts) ? json.image_prompts : [];
  const prompts = promptsV4.length ? promptsV4 : promptsLegacy;
  const sectionPrompts = prompts
    .filter((p) => {
      const t = String(p.type || '');
      const r = String(p.section_ref || '');
      return /^section_/i.test(t) || /^sekcja-\d+/i.test(r);
    })
    .sort((a, b) => {
      const pa = String(a.type || a.section_ref || '');
      const pb = String(b.type || b.section_ref || '');
      const ai = Number((pa.match(/(\d+)/) || [])[1] || 0);
      const bi = Number((pb.match(/(\d+)/) || [])[1] || 0);
      return ai - bi;
    });

  if (!sectionPrompts.length) {
    console.log('[WARN] Brak section_* w image_prompts_v4. Pomijam sekcje.');
    return;
  }

  sectionPrompts.forEach((p, idx) => {
    const base = String(p.filename_base || '').trim();
    const src = findSourceImage(base, fromDir);
    if (!src) throw new Error(`Brak section source: ${base}.* w ${fromDir}`);
    const outBases = new Set([toSlugSectionBase(slug, idx), base].filter(Boolean));
    for (const outBase of outBases) {
      convertOne(src, outBase);
      console.log(`[OK] section prepared: ${outBase}`);
    }
  });

  console.log('[PASS] prepare-article-assets OK');
}

main();
