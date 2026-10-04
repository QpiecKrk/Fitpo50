const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createVariant, prepareArticleMedia, validateManifestStructure } = require('../scripts/lib/article-media');

function makePackage() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-media-test-'));
}

test('wariant obrazu jest używany ponownie tylko do czasu zmiany pliku źródłowego', () => {
  const dir = makePackage();
  try {
    const source = path.join(dir, 'source.jpg');
    const target = path.join(dir, 'variant.jpg');
    fs.writeFileSync(source, 'wersja-1');
    fs.copyFileSync(source, target);
    const baseTime = Date.now() / 1000;
    fs.utimesSync(source, baseTime - 10, baseTime - 10);
    fs.utimesSync(target, baseTime, baseTime);
    assert.equal(createVariant(source, target, 'jpg'), false);
    fs.writeFileSync(source, 'wersja-2');
    fs.utimesSync(source, baseTime + 10, baseTime + 10);
    assert.equal(createVariant(source, target, 'jpg'), true);
    assert.equal(fs.readFileSync(target, 'utf8'), 'wersja-2');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

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
      no_misleading_text_or_logo: true,
      anatomy_and_equipment_plausible: true,
      embedded_text: { kind: 'NONE' },
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
  const base = path.basename(file).replace(/\.(png|jpe?g|webp|avif)$/i, '');
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
  assert.equal(value.media_manifest.version, 2);
  assert.equal(validateManifestStructure(value).ok, true);
});

test('utrwala dokładny source_file przed utworzeniem wariantu JPG', () => {
  const dir = makePackage();
  const value = article();
  for (const item of value.image_prompts) {
    delete item.source_file;
    for (const extension of ['jpeg', 'webp', 'avif']) fs.writeFileSync(path.join(dir, `${item.filename_base}.${extension}`), item.filename_base);
  }

  const first = prepareArticleMedia(value, { assetsDir: dir, mutate: true, ensureVariants: false, inspectImage: inspector });
  assert.equal(first.ok, false);
  assert.ok(value.image_prompts.every((item) => item.source_file === `${item.filename_base}.jpeg`));

  for (const item of value.image_prompts) fs.writeFileSync(path.join(dir, `${item.filename_base}.jpg`), item.filename_base);
  const second = prepareArticleMedia(value, { assetsDir: dir, mutate: true, ensureVariants: false, inspectImage: inspector });
  assert.equal(second.ok, true, second.errors.join('\n'));
});

test('obsługuje dodatkowe obrazy sekcji bez znoszenia wymaganego obrazu głównego', () => {
  const dir = makePackage();
  const value = article();
  const extra = prompt('sekcja-1-obraz-2', 'dobor-obciazenia-detal', 'Detal ustawienia obciążenia', 'fotografia dokumentalna', 'zbliżenie dłoni przy stosie ciężarów');
  value.image_prompts.splice(2, 0, extra);
  createFiles(dir, value);
  const extraInspector = (file) => {
    const result = inspector(file);
    if (path.basename(file).startsWith('dobor-obciazenia-detal')) return { ...result, perceptual_hash: 'e0'.repeat(256) };
    return result;
  };

  const result = prepareArticleMedia(value, { assetsDir: dir, mutate: true, ensureVariants: false, inspectImage: extraInspector });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(value.sections[0].images.length, 1);
  assert.equal(value.sections[0].images[0].placement, 'sekcja-1-obraz-2');
  assert.equal(value.media_manifest.entries.length, 5);
  assert.equal(validateManifestStructure(value).ok, true);
});

test('pakiet blokuje panoramę, kwadrat i pionową planszę nieobsługiwane przez krajobrazowy layout', () => {
  const dir = makePackage();
  const value = article();
  createFiles(dir, value);
  const dimensions = {
    'trening-silowy-hero': [1200, 500],
    'dobor-obciazenia': [900, 1600],
    'kontrola-techniki': [1000, 1000],
    'regeneracja-treningowa': [1200, 675],
  };
  const mixedInspector = (file) => {
    const base = path.basename(file).replace(/\.(png|jpg|webp|avif)$/i, '');
    const [width, height] = dimensions[base];
    return { ...inspector(file), width, height, aspect_ratio: Number((width / height).toFixed(4)) };
  };
  const result = prepareArticleMedia(value, { assetsDir: dir, mutate: true, ensureVariants: false, inspectImage: mixedInspector });
  assert.equal(result.ok, false);
  assert.equal(value.image_prompts[0].aspect_ratio, '12:5');
  assert.equal(value.image_prompts[1].aspect_ratio, '9:16');
  assert.match(result.errors.join('\n'), /krajobrazowym zakresem 1.2-2.1/);
  assert.match(result.errors.join('\n'), /minimum dla hero to 1024x560/);
});

test('hero 1080x589 przechodzi z zaleceniem zamiast blokady', () => {
  const dir = makePackage();
  const value = article();
  createFiles(dir, value);
  const tolerantInspector = (file) => {
    const result = inspector(file);
    if (path.basename(file).startsWith('trening-silowy-hero')) {
      return { ...result, width: 1080, height: 589, aspect_ratio: Number((1080 / 589).toFixed(4)) };
    }
    return result;
  };
  const result = prepareArticleMedia(value, { assetsDir: dir, mutate: true, ensureVariants: false, inspectImage: tolerantInspector });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.match(result.warnings.join('\n'), /mieści się w bezpiecznym zakresie/);
  assert.match(result.warnings.join('\n'), /1080x600/);
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

test('spójna technika i kompozycja nie blokują, ale wymagają rzeczywistego review kadrów', () => {
  const dir = makePackage();
  const value = article();
  value.image_prompts.forEach((item) => {
    item.technique = 'fotografia stockowa';
    item.composition = 'ten sam szeroki plan';
  });
  createFiles(dir, value);
  const result = prepareArticleMedia(value, { assetsDir: dir, inspectImage: inspector });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.match(result.warnings.join('\n'), /spójna seria jest dozwolona/);
  assert.match(result.warnings.join('\n'), /rzeczywisty review/);
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

test('watermark bez treści merytorycznej nie blokuje zatwierdzonego obrazu', () => {
  const dir = makePackage();
  const value = article();
  value.image_prompts[1].visual_review.embedded_text = { kind: 'WATERMARK_ONLY' };
  createFiles(dir, value);
  const result = prepareArticleMedia(value, { assetsDir: dir, mutate: true, inspectImage: inspector });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(validateManifestStructure(value).ok, true);
});

test('naturalny napis środowiskowy nie blokuje realistycznego zdjęcia', () => {
  const dir = makePackage();
  const value = article();
  value.image_prompts[1].visual_review.embedded_text = {
    kind: 'INCIDENTAL_ENVIRONMENT',
    transcription: 'Centrum medyczne — wejście',
    claims_or_numbers_present: false,
  };
  createFiles(dir, value);
  const result = prepareArticleMedia(value, { assetsDir: dir, mutate: true, inspectImage: inspector });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(validateManifestStructure(value).ok, true);
});

test('napis środowiskowy z twierdzeniem nadal blokuje publikację', () => {
  const dir = makePackage();
  const value = article();
  value.image_prompts[1].visual_review.embedded_text = {
    kind: 'INCIDENTAL_ENVIRONMENT',
    transcription: 'AI wykrywa 99 procent nowotworów',
    claims_or_numbers_present: true,
  };
  createFiles(dir, value);
  const result = prepareArticleMedia(value, { assetsDir: dir, mutate: true, inspectImage: inspector });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /nie może zawierać twierdzeń, liczb ani instrukcji/);
});

test('blokuje nieudokumentowaną liczbę w obrazie oraz błędną anatomię lub sprzęt', () => {
  const dir = makePackage();
  const value = article();
  value.image_prompts[1].visual_review.embedded_text = {
    kind: 'CONTENT',
    claims_or_numbers_present: true,
    matches_article_claims: true,
  };
  value.image_prompts[2].visual_review.anatomy_and_equipment_plausible = false;
  createFiles(dir, value);
  const result = prepareArticleMedia(value, { assetsDir: dir, inspectImage: inspector });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /wymaga transkrypcji/);
  assert.match(result.errors.join('\n'), /wymaga co najmniej jednego URL dowodu/);
  assert.match(result.errors.join('\n'), /anatomy_and_equipment_plausible/);
});
