const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { prepareArticleMedia, validateManifestStructure } = require('../scripts/lib/article-media');

function makePackage() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-media-test-'));
}

function prompt(ref, base, topic, technique, composition) {
  return {
    section_ref: ref,
    filename_base: base,
    source_file: `${base}.png`,
    topic,
    technique,
    composition,
    purpose: 'Wyjaśnienie konkretnego mechanizmu opisanego w tej części artykułu',
    aspect_ratio: '16:9',
    alt_pl: `${topic} pokazany w praktycznej sytuacji osoby po pięćdziesiątce`,
    caption_pl: `${topic} — podpis wyjaśnia, dlaczego ten obraz wspiera dokładnie tę część materiału.`,
    visual_review: {
      status: 'VERIFIED',
      matches_topic: true,
      reviewed_by: 'Codex',
      reviewed_at: '2026-08-24',
      note: `Obejrzano plik: kadr wyraźnie pokazuje ${topic.toLowerCase()} bez przypadkowych elementów.`,
    },
  };
}

function article() {
  return {
    title: 'Trening siłowy po 50: bezpieczny plan progresji',
    lead: 'Plan pokazuje technikę, regenerację i dobór obciążenia dla osoby po pięćdziesiątce.',
    primary_keyword: 'trening siłowy po 50',
    sections: [
      { title: 'Jak dobrać pierwsze obciążenie?', paragraphs_html: ['<p>Dobór obciążenia zaczyna się od kontrolowanego ruchu i zapasu powtórzeń.</p>'], image: {} },
      { title: 'Jak kontrolować technikę ćwiczenia?', paragraphs_html: ['<p>Technika ćwiczenia wymaga stabilnej pozycji i pełnej kontroli ruchu.</p>'], image: {} },
      { title: 'Kiedy zaplanować regenerację?', paragraphs_html: ['<p>Regeneracja między treningami pozwala dostosować kolejną sesję do samopoczucia.</p>'], image: {} },
    ],
    image_prompts: [
      prompt('hero', 'trening-silowy-hero', 'Trening siłowy po 50', 'fotografia dokumentalna', 'szeroki plan sali treningowej'),
      prompt('sekcja-1', 'dobor-obciazenia', 'Dobór obciążenia treningowego', 'ilustracja redakcyjna', 'zbliżenie dłoni i hantla'),
      prompt('sekcja-2', 'kontrola-techniki', 'Kontrola techniki ćwiczenia', 'infografika anatomiczna', 'profil sylwetki podczas ruchu'),
      prompt('sekcja-3', 'regeneracja-treningowa', 'Regeneracja między treningami', 'fotografia lifestyle', 'spokojny plan średni w domu'),
    ],
  };
}

function createFiles(dir, value) {
  for (const item of value.image_prompts) {
    for (const extension of ['png', 'jpg', 'webp', 'avif']) fs.writeFileSync(path.join(dir, `${item.filename_base}.${extension}`), item.filename_base);
  }
}

function inspector(file) {
  const base = path.basename(file).replace(/\.(png|jpg|webp|avif)$/i, '');
  const index = ['trening-silowy-hero', 'dobor-obciazenia', 'kontrola-techniki', 'regeneracja-treningowa'].indexOf(base) + 1;
  return {
    width: 1200,
    height: 675,
    aspect_ratio: 1.7778,
    bytes: 1000,
    sha256: `${base}-${path.extname(file)}`,
    perceptual_hash: `${(index * 32).toString(16).padStart(2, '0')}`.repeat(256),
  };
}

test('tworzy kompletny manifest i mapuje obrazy bez fallbacków', () => {
  const dir = makePackage();
  const value = article();
  createFiles(dir, value);
  const result = prepareArticleMedia(value, { assetsDir: dir, mutate: true, ensureVariants: false, inspectImage: inspector });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(value.hero_image, 'trening-silowy-hero');
  assert.equal(value.hero_width, 1200);
  assert.equal(value.sections[2].image.src, './assets/regeneracja-treningowa.webp');
  assert.equal(value.media_manifest.entries.length, 4);
  assert.equal(validateManifestStructure(value).ok, true);
});

test('nie dopasowuje przybliżonej nazwy pliku', () => {
  const dir = makePackage();
  const value = article();
  createFiles(dir, value);
  fs.renameSync(path.join(dir, 'dobor-obciazenia.png'), path.join(dir, 'Dobór obciążenia.png'));
  const result = prepareArticleMedia(value, { assetsDir: dir, inspectImage: inspector });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /brak zadeklarowanego source_file/);
});

test('blokuje ten sam lub niemal ten sam kadr', () => {
  const dir = makePackage();
  const value = article();
  createFiles(dir, value);
  const duplicateInspector = (file) => ({ ...inspector(file), perceptual_hash: '01'.repeat(256) });
  const result = prepareArticleMedia(value, { assetsDir: dir, inspectImage: duplicateInspector });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Duplikat wizualny/);
});

test('blokuje powtarzanie jednej techniki i kompozycji', () => {
  const dir = makePackage();
  const value = article();
  value.image_prompts.forEach((item) => {
    item.technique = 'fotografia stockowa';
    item.composition = 'ten sam szeroki plan';
  });
  createFiles(dir, value);
  const result = prepareArticleMedia(value, { assetsDir: dir, inspectImage: inspector });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Za mała różnorodność technik/);
  assert.match(result.errors.join('\n'), /Za mała różnorodność kadrów/);
});

test('blokuje obraz bez rzeczywistej kontroli i kompletnego wariantu', () => {
  const dir = makePackage();
  const value = article();
  value.image_prompts[1].visual_review.status = 'PENDING';
  createFiles(dir, value);
  fs.unlinkSync(path.join(dir, 'kontrola-techniki.avif'));
  const result = prepareArticleMedia(value, { assetsDir: dir, inspectImage: inspector });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /visual_review musi mieć status VERIFIED/);
  assert.match(result.errors.join('\n'), /brak wymaganego wariantu kontrola-techniki.avif/);
});
