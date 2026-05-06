#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const REELS_DIR = '/Users/grzegorzkupiec/Downloads/Reels';
const KARUZELA_DIR = '/Users/grzegorzkupiec/Downloads/Karuzela';

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function detectLatestSlugFromIndex() {
  const html = readFileSafe(INDEX_HTML);
  const anchor = html.match(/<a[^>]*id="latestArticleLink"[^>]*>/i);
  if (!anchor) return null;
  const href = anchor[0].match(/href="([^"]+\.html)"/i);
  if (href && href[1]) return href[1].replace(/^\.\//, '').replace(/\.html$/i, '').trim();
  return null;
}

function ask(question, rl) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve((answer || '').trim())));
}

function buildReelsBrief(slug, color, category) {
  return [
    'BRIEF REELS (5 slajdow)',
    `Artykul (slug): ${slug}`,
    `Kategoria: ${category || 'do uzupelnienia'}`,
    `Dominanta kolorystyczna: ${color}`,
    '',
    'Struktura:',
    '1) Hook - mocny obraz + mocny tytul/pytanie',
    '2) Tresc 1 - insight #1',
    '3) Tresc 2 - insight #2',
    '4) Tresc 3 - insight #3',
    '5) CTA - przeczytaj caly artykul na fitpo50.pl',
    '',
    'Wymagania:',
    '- format: 1080x1920 (9:16)',
    '- safe area: lewy/prawy min 90px, gora min 220px, dol min 260px',
    '- spojnosc designu wszystkich 5 slajdow',
    '- tylko sprawdzone informacje; ciekawostki po weryfikacji',
    '- finalnie: 1_hook.png..5_cta.png + podpis_reels.txt',
  ].join('\n');
}

function buildKaruzelaBrief(slug, color, category) {
  return [
    'BRIEF KARUZELA INSTAGRAM (5 slajdow)',
    `Artykul (slug): ${slug}`,
    `Kategoria: ${category || 'do uzupelnienia'}`,
    `Dominanta kolorystyczna: ${color}`,
    '',
    'Struktura:',
    '1) Hook',
    '2) Tresc 1',
    '3) Tresc 2',
    '4) Tresc 3',
    '5) CTA',
    '',
    'Wymagania:',
    '- format: 1080x1350 (4:5)',
    '- tresci inne niz reels (nie kopiuj 1:1)',
    '- spojny styl wizualny i typograficzny',
    '- finalnie: 1_hook.png..5_cta.png + podpis_karuzela.txt',
  ].join('\n');
}

function buildChecklist(slug, mode) {
  return [
    'CHECKLISTA QA SOCIAL',
    `Artykul: ${slug}`,
    `Tryb: ${mode}`,
    '',
    '[ ] Temat zgodny z ostatnim opublikowanym artykulem',
    '[ ] Literowki sprawdzone',
    '[ ] Kontrast i czytelnosc mobilna',
    '[ ] Safe area zachowane',
    '[ ] Kolejnosc slajdow 1..5 poprawna',
    '[ ] Nazwy plikow poprawne',
    '[ ] Ciekawostki/fakty zweryfikowane',
  ].join('\n');
}

async function run() {
  const latestSlug = detectLatestSlugFromIndex();
  if (!latestSlug) {
    console.error('[FAIL] Nie wykryto latestArticleLink w index.html');
    process.exit(1);
  }

  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const articleOk = (await ask('Czy artykul jest OK? (tak/nie): ', rl)).toLowerCase();
  if (articleOk !== 'tak') {
    rl.close();
    console.log('[INFO] Przerwano. Najpierw popraw artykul.');
    process.exit(0);
  }

  const modeRaw = (await ask('Generujemy: reels / karuzela / oba ? ', rl)).toLowerCase();
  const mode = ['reels', 'karuzela', 'oba'].includes(modeRaw) ? modeRaw : 'reels';
  const color = (await ask('Jaka dominanta kolorystyczna?: ', rl)) || 'niebieska';
  const category = await ask('Kategoria artykulu (opcjonalnie): ', rl);
  rl.close();

  ensureDir(REELS_DIR);
  ensureDir(KARUZELA_DIR);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const checklist = buildChecklist(latestSlug, mode);

  if (mode === 'reels' || mode === 'oba') {
    const reelsBrief = buildReelsBrief(latestSlug, color, category);
    fs.writeFileSync(path.join(REELS_DIR, `brief_reels_${latestSlug}_${ts}.txt`), reelsBrief + '\n', 'utf8');
    fs.writeFileSync(
      path.join(REELS_DIR, 'podpis_reels.txt'),
      'RTG, CT czy MRI?\nSprawdz, co wybrac i kiedy.\nCaly artykul: fitpo50.pl\n',
      'utf8'
    );
  }

  if (mode === 'karuzela' || mode === 'oba') {
    const karBrief = buildKaruzelaBrief(latestSlug, color, category);
    fs.writeFileSync(path.join(KARUZELA_DIR, `brief_karuzela_${latestSlug}_${ts}.txt`), karBrief + '\n', 'utf8');
    fs.writeFileSync(
      path.join(KARUZELA_DIR, 'podpis_karuzela.txt'),
      'Przewodnik w 5 slajdach.\nNajwazniejsze wnioski z nowego artykulu.\nWiecej: fitpo50.pl\n',
      'utf8'
    );
  }

  const qaOut = mode === 'karuzela' ? KARUZELA_DIR : REELS_DIR;
  fs.writeFileSync(path.join(qaOut, `qa_checklist_${latestSlug}_${ts}.txt`), checklist + '\n', 'utf8');

  console.log('\n[OK] Social handoff gotowy');
  console.log(`- Ostatni artykul: ${latestSlug}`);
  console.log(`- Tryb: ${mode}`);
  console.log(`- Dominanta: ${color}`);
  console.log(`- Reels folder: ${REELS_DIR}`);
  console.log(`- Karuzela folder: ${KARUZELA_DIR}`);
  console.log('- Tryb: tylko PNG + TXT (bez MP4, bez Remotion)');
}

run().catch((err) => {
  console.error(`[FAIL] ${err.message || err}`);
  process.exit(1);
});
