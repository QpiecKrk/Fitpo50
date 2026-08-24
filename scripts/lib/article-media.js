const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'avif'];
const REQUIRED_VARIANTS = ['jpg', 'webp', 'avif'];
const GENERIC_MEDIA_TEXT = /(grafika artykułu|grafika do artykułu|obraz sekcji|zdjęcie związane z tematem|nowoczesna grafika|ilustracja tematu)/iu;
const VERIFIED_REVIEW = 'VERIFIED';

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return stripTags(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function semanticTokens(value) {
  const stop = new Set(['oraz', 'jest', 'dla', 'przez', 'ktory', 'ktora', 'po', 'sie', 'jak', 'czy', 'ten', 'tej', 'bez', 'nad', 'pod', 'przy']);
  return [...new Set(normalize(value).split(' ').filter((token) => token.length >= 4 && !stop.has(token)).map((token) => token.length >= 7 ? token.slice(0, 7) : token))];
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function inspectImage(file) {
  const identify = spawnSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' });
  if (identify.status !== 0) {
    throw new Error(`Nie można odczytać obrazu ${path.basename(file)}: ${String(identify.stderr || identify.stdout || '').trim()}`);
  }
  const match = String(identify.stdout || '').trim().match(/^(\d+)\s+(\d+)$/);
  if (!match) throw new Error(`Niepoprawne wymiary obrazu: ${path.basename(file)}.`);
  const signature = spawnSync('magick', [file, '-auto-orient', '-resize', '16x16!', '-colorspace', 'Gray', '-depth', '8', 'gray:-'], {
    encoding: null,
    maxBuffer: 1024 * 1024,
  });
  if (signature.status !== 0 || !Buffer.isBuffer(signature.stdout) || signature.stdout.length < 128) {
    throw new Error(`Nie można policzyć sygnatury wizualnej: ${path.basename(file)}.`);
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return {
    width,
    height,
    aspect_ratio: Number((width / height).toFixed(4)),
    bytes: fs.statSync(file).size,
    sha256: sha256(file),
    perceptual_hash: signature.stdout.subarray(0, 256).toString('hex'),
  };
}

function parseRatio(value) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match || Number(match[2]) === 0) return 0;
  return Number(match[1]) / Number(match[2]);
}

function hammingHex(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (!left.length || left.length !== right.length) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return Number((total / left.length).toFixed(3));
}

function commandExists(command) {
  return spawnSync('which', [command], { stdio: 'ignore' }).status === 0;
}

function runConversion(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')}: ${String(result.stderr || result.stdout || 'błąd konwersji').trim()}`);
  }
}

function createVariant(sourceFile, targetFile, extension) {
  if (fs.existsSync(targetFile)) return false;
  const sourceExtension = path.extname(sourceFile).slice(1).toLowerCase();
  if (extension === 'jpg' && ['jpg', 'jpeg'].includes(sourceExtension)) {
    fs.copyFileSync(sourceFile, targetFile);
    return true;
  }
  if (extension === 'jpg') {
    if (!commandExists('magick')) throw new Error('Brak ImageMagick do utworzenia kontrolowanego fallbacku JPG.');
    runConversion('magick', [sourceFile, '-auto-orient', '-strip', '-quality', '88', targetFile]);
    return true;
  }
  const jpgFile = targetFile.replace(/\.(webp|avif)$/i, '.jpg');
  if (!fs.existsSync(jpgFile)) createVariant(sourceFile, jpgFile, 'jpg');
  if (extension === 'webp') {
    if (!commandExists('cwebp')) throw new Error('Brak cwebp do utworzenia WebP.');
    runConversion('cwebp', ['-quiet', '-q', '82', jpgFile, '-o', targetFile]);
    return true;
  }
  if (extension === 'avif') {
    if (!commandExists('avifenc')) throw new Error('Brak avifenc do utworzenia AVIF.');
    runConversion('avifenc', ['--speed', '6', '--min', '20', '--max', '32', jpgFile, targetFile]);
    return true;
  }
  throw new Error(`Nieobsługiwany wariant: ${extension}.`);
}

function exactFilesForBase(assetsDir, base) {
  const files = fs.readdirSync(assetsDir).filter((name) => fs.statSync(path.join(assetsDir, name)).isFile());
  return files.filter((name) => {
    const extension = path.extname(name).slice(1).toLowerCase();
    return SOURCE_EXTENSIONS.includes(extension) && name.slice(0, -(extension.length + 1)) === base;
  });
}

function selectSourceFile(prompt, assetsDir, errors) {
  const base = String(prompt.filename_base || '').trim();
  const declared = String(prompt.source_file || '').trim();
  if (declared) {
    if (declared !== path.basename(declared) || !declared.startsWith(`${base}.`)) {
      errors.push(`${base}: source_file musi być samą dokładną nazwą pliku z tego katalogu i zaczynać się od filename_base.`);
      return '';
    }
    const target = path.join(assetsDir, declared);
    if (!fs.existsSync(target)) errors.push(`${base}: brak zadeklarowanego source_file ${declared}.`);
    return fs.existsSync(target) ? declared : '';
  }
  const exact = exactFilesForBase(assetsDir, base);
  const preferred = exact.filter((name) => /\.(png|jpe?g)$/i.test(name));
  if (preferred.length === 1) return preferred[0];
  if (preferred.length > 1) {
    errors.push(`${base}: znaleziono kilka możliwych źródeł (${preferred.join(', ')}); podaj dokładne source_file.`);
    return '';
  }
  if (exact.length === 1) return exact[0];
  if (!exact.length) errors.push(`${base}: brak dokładnego pliku źródłowego w ${assetsDir}; wyszukiwanie fuzzy i fallback z innych katalogów są zabronione.`);
  else errors.push(`${base}: niejednoznaczne pliki (${exact.join(', ')}); podaj source_file.`);
  return '';
}

function promptMap(article) {
  const promptsV4 = Array.isArray(article.image_prompts_v4) ? article.image_prompts_v4 : [];
  return promptsV4.length ? promptsV4 : (Array.isArray(article.image_prompts) ? article.image_prompts : []);
}

function expectedPlacements(article) {
  const sections = Array.isArray(article.sections) ? article.sections : [];
  return ['hero', ...sections.map((_section, index) => `sekcja-${index + 1}`)];
}

function placementContext(article, placement) {
  if (placement === 'hero') return `${article.title || ''} ${article.lead || ''} ${article.primary_keyword || ''}`;
  const index = Number((placement.match(/(\d+)/) || [])[1] || 0) - 1;
  const section = article.sections?.[index] || {};
  return `${section.title || ''} ${(section.paragraphs_html || []).map(stripTags).join(' ')}`;
}

function validateDescriptiveFields(prompt, context, placement, errors) {
  const base = String(prompt.filename_base || '').trim();
  const topic = String(prompt.topic || '').trim();
  const technique = String(prompt.technique || '').trim();
  const composition = String(prompt.composition || '').trim();
  const purpose = String(prompt.purpose || '').trim();
  const alt = String(prompt.alt_pl || '').trim();
  const caption = String(prompt.caption_pl || '').trim();
  if (topic.length < 12) errors.push(`${base}: topic musi konkretnie opisywać temat obrazu (min. 12 znaków).`);
  if (technique.length < 4) errors.push(`${base}: brak konkretnej technique.`);
  if (composition.length < 8) errors.push(`${base}: brak opisu composition/kadru.`);
  if (purpose.length < 4) errors.push(`${base}: brak konkretnego purpose.`);
  if (alt.length < 25 || GENERIC_MEDIA_TEXT.test(alt)) errors.push(`${base}: alt_pl jest zbyt krótki albo generyczny.`);
  if (caption.length < 30 || GENERIC_MEDIA_TEXT.test(caption)) errors.push(`${base}: caption_pl jest zbyt krótki albo generyczny.`);
  if (normalize(alt) === normalize(caption)) errors.push(`${base}: alt_pl i caption_pl nie mogą być identyczne.`);
  const contextTokens = new Set(semanticTokens(context));
  const topicTokens = semanticTokens(`${topic} ${alt} ${caption}`);
  if (!topicTokens.some((token) => contextTokens.has(token))) {
    errors.push(`${base}: temat/alt/podpis nie mają semantycznego związku z ${placement}; obraz może być przypadkowy lub niezwiązany.`);
  }
  const review = prompt.visual_review || {};
  if (review.status !== VERIFIED_REVIEW || review.matches_topic !== true) {
    errors.push(`${base}: visual_review musi mieć status VERIFIED i matches_topic=true po rzeczywistym obejrzeniu pliku lokalnie.`);
  }
  if (String(review.reviewed_by || '').trim().length < 3 || !/^\d{4}-\d{2}-\d{2}/.test(String(review.reviewed_at || ''))) {
    errors.push(`${base}: visual_review wymaga reviewed_by i reviewed_at.`);
  }
  if (String(review.note || '').trim().length < 20) errors.push(`${base}: visual_review.note musi konkretnie opisać zgodność obrazu z sekcją.`);
}

function validateDimensions(entry, placement, declaredRatio, errors) {
  const { width, height, aspect_ratio: ratio } = entry.source;
  const minWidth = placement === 'hero' ? 1080 : 900;
  const minHeight = placement === 'hero' ? 600 : 500;
  if (width < minWidth || height < minHeight) {
    errors.push(`${entry.filename_base}: za mały obraz ${width}x${height}; minimum dla ${placement} to ${minWidth}x${minHeight}.`);
  }
  const parsedRatio = parseRatio(declaredRatio);
  if (!parsedRatio) errors.push(`${entry.filename_base}: aspect_ratio musi mieć format np. 16:9.`);
  else if (Math.abs(parsedRatio - ratio) > 0.04) errors.push(`${entry.filename_base}: rzeczywista proporcja ${ratio} nie zgadza się z deklaracją ${declaredRatio}.`);
  if (ratio < 1.2 || ratio > 2.1) errors.push(`${entry.filename_base}: proporcja ${ratio} jest poza zakresem krajobrazowym 1.2-2.1 wymaganym przez layout artykułu.`);
}

function validateManifestStructure(article) {
  const errors = [];
  const manifest = article.media_manifest;
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['Brak media_manifest utworzonego lokalnie.'] };
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const expected = expectedPlacements(article);
  if (entries.length !== expected.length) errors.push(`media_manifest.entries: wymagane ${expected.length}, jest ${entries.length}.`);
  expected.forEach((placement) => {
    if (entries.filter((entry) => entry.placement === placement).length !== 1) errors.push(`media_manifest: placement ${placement} musi wystąpić dokładnie raz.`);
  });
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(manifest.generated_at || ''))) errors.push('media_manifest: brak poprawnego generated_at.');
  entries.forEach((entry) => {
    for (const field of ['filename_base', 'topic', 'technique', 'composition', 'purpose', 'source_file', 'alt', 'caption']) {
      if (!String(entry?.[field] || '').trim()) errors.push(`media_manifest ${entry?.placement || 'UNKNOWN'}: brak ${field}.`);
    }
    if (!entry?.source?.sha256 || !entry?.source?.width || !entry?.source?.height) errors.push(`media_manifest ${entry?.placement || 'UNKNOWN'}: brak metadanych rzeczywistego źródła.`);
    REQUIRED_VARIANTS.forEach((extension) => {
      const variant = entry?.variants?.[extension];
      if (!variant?.file || !variant?.sha256 || !variant?.width || !variant?.height) errors.push(`media_manifest ${entry?.placement || 'UNKNOWN'}: niepełny wariant ${extension}.`);
      if (variant?.file !== `${entry.filename_base}.${extension}`) errors.push(`media_manifest ${entry?.placement || 'UNKNOWN'}: wariant ${extension} ma inną nazwę niż filename_base.`);
      if (variant?.width !== entry?.source?.width || variant?.height !== entry?.source?.height) errors.push(`media_manifest ${entry?.placement || 'UNKNOWN'}: wariant ${extension} ma inne wymiary niż źródło.`);
      if (hammingHex(entry?.source?.perceptual_hash, variant?.perceptual_hash) > 14) errors.push(`media_manifest ${entry?.placement || 'UNKNOWN'}: wariant ${extension} może przedstawiać inny obraz.`);
    });
    if (entry?.visual_review?.status !== VERIFIED_REVIEW || entry?.visual_review?.matches_topic !== true) errors.push(`media_manifest ${entry?.placement || 'UNKNOWN'}: brak zatwierdzonej kontroli wizualnej.`);
  });
  const hero = entries.find((entry) => entry.placement === 'hero');
  if (hero) {
    if (article.hero_image !== hero.filename_base) errors.push('hero_image nie zgadza się z hero w media_manifest.');
    if (article.hero_alt !== hero.alt) errors.push('hero_alt nie zgadza się z zatwierdzonym altem w media_manifest.');
    if (Number(article.hero_width) !== Number(hero.source?.width) || Number(article.hero_height) !== Number(hero.source?.height)) errors.push('Wymiary hero w JSON nie zgadzają się z media_manifest.');
  }
  entries.filter((entry) => entry.placement !== 'hero').forEach((entry) => {
    const index = Number((entry.placement.match(/(\d+)/) || [])[1] || 0) - 1;
    const image = article.sections?.[index]?.image || {};
    if (image.src !== `./assets/${entry.filename_base}.webp`) errors.push(`${entry.placement}: sections[].image.src nie zgadza się z media_manifest.`);
    if (image.alt !== entry.alt || image.caption !== entry.caption) errors.push(`${entry.placement}: alt lub podpis sekcji nie zgadza się z media_manifest.`);
    if (Number(image.width) !== Number(entry.source?.width) || Number(image.height) !== Number(entry.source?.height)) errors.push(`${entry.placement}: wymiary sekcji nie zgadzają się z media_manifest.`);
  });
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      if (entries[left]?.source?.sha256 === entries[right]?.source?.sha256) errors.push(`media_manifest: duplikat 1:1 ${entries[left].source_file} i ${entries[right].source_file}.`);
      else if (hammingHex(entries[left]?.source?.perceptual_hash, entries[right]?.source?.perceptual_hash) <= 3) errors.push(`media_manifest: niemal ten sam kadr ${entries[left].source_file} i ${entries[right].source_file}.`);
    }
  }
  const techniques = new Set(entries.map((entry) => normalize(entry.technique)).filter(Boolean));
  const compositions = new Set(entries.map((entry) => normalize(entry.composition)).filter(Boolean));
  const requiredDiversity = Math.min(3, entries.length);
  if (techniques.size < requiredDiversity) errors.push(`media_manifest: za mała różnorodność technik (${techniques.size}/${requiredDiversity}).`);
  if (compositions.size < requiredDiversity) errors.push(`media_manifest: za mała różnorodność kadrów (${compositions.size}/${requiredDiversity}).`);
  return { ok: errors.length === 0, errors };
}

function prepareArticleMedia(article, options = {}) {
  const assetsDir = path.resolve(options.assetsDir || '.');
  const mutate = options.mutate === true;
  const ensureVariants = options.ensureVariants === true;
  const imageInspector = options.inspectImage || inspectImage;
  const errors = [];
  const warnings = [];
  const created = [];
  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    return { ok: false, errors: [`Brak jednego katalogu pakietu mediów: ${assetsDir}.`], warnings, entries: [], created };
  }
  const prompts = promptMap(article);
  const expected = expectedPlacements(article);
  const byPlacement = new Map();
  prompts.forEach((prompt) => {
    const placement = String(prompt?.section_ref || '').trim();
    if (byPlacement.has(placement)) errors.push(`Powtórzony section_ref w image_prompts: ${placement || 'MISSING'}.`);
    byPlacement.set(placement, prompt || {});
  });
  expected.forEach((placement) => {
    if (!byPlacement.has(placement)) errors.push(`Brak obrazu dla ${placement}.`);
  });
  [...byPlacement.keys()].filter((placement) => !expected.includes(placement)).forEach((placement) => errors.push(`Nadmiarowy lub nieznany section_ref: ${placement || 'MISSING'}.`));

  const entries = [];
  for (const placement of expected) {
    const prompt = byPlacement.get(placement);
    if (!prompt) continue;
    const base = String(prompt.filename_base || '').trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(base)) {
      errors.push(`${placement}: filename_base musi być dokładną nazwą kebab-case bez rozszerzenia.`);
      continue;
    }
    validateDescriptiveFields(prompt, placementContext(article, placement), placement, errors);
    const sourceName = selectSourceFile(prompt, assetsDir, errors);
    if (!sourceName) continue;
    const sourcePath = path.join(assetsDir, sourceName);
    let source;
    try {
      source = imageInspector(sourcePath);
    } catch (error) {
      errors.push(error.message || String(error));
      continue;
    }
    const entry = {
      placement,
      filename_base: base,
      topic: String(prompt.topic || '').trim(),
      technique: String(prompt.technique || '').trim(),
      composition: String(prompt.composition || '').trim(),
      purpose: String(prompt.purpose || '').trim(),
      source_file: sourceName,
      aspect_ratio_declared: String(prompt.aspect_ratio || '').trim(),
      alt: String(prompt.alt_pl || '').trim(),
      caption: String(prompt.caption_pl || '').trim(),
      visual_review: prompt.visual_review || {},
      source,
      variants: {},
    };
    validateDimensions(entry, placement, prompt.aspect_ratio, errors);
    for (const extension of REQUIRED_VARIANTS) {
      const variantFile = `${base}.${extension}`;
      const variantPath = path.join(assetsDir, variantFile);
      try {
        if (!fs.existsSync(variantPath) && ensureVariants) {
          if (createVariant(sourcePath, variantPath, extension)) created.push(variantFile);
        }
        if (!fs.existsSync(variantPath)) {
          errors.push(`${base}: brak wymaganego wariantu ${variantFile}.`);
          continue;
        }
        const variant = imageInspector(variantPath);
        entry.variants[extension] = { file: variantFile, ...variant };
        if (variant.width !== source.width || variant.height !== source.height) errors.push(`${base}: ${variantFile} ma inne wymiary niż źródło.`);
        if (hammingHex(source.perceptual_hash, variant.perceptual_hash) > 14) errors.push(`${base}: ${variantFile} nie przedstawia tego samego obrazu co source_file; możliwy ukryty fallback.`);
      } catch (error) {
        errors.push(error.message || String(error));
      }
    }
    entries.push(entry);
  }

  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left];
      const b = entries[right];
      if (a.source.sha256 === b.source.sha256) errors.push(`Duplikat 1:1: ${a.source_file} i ${b.source_file}. Hero i sekcje muszą mieć osobne obrazy.`);
      else if (hammingHex(a.source.perceptual_hash, b.source.perceptual_hash) <= 3) errors.push(`Duplikat wizualny lub niemal ten sam kadr: ${a.source_file} i ${b.source_file}.`);
    }
  }
  const techniques = entries.map((entry) => normalize(entry.technique)).filter(Boolean);
  const compositions = entries.map((entry) => normalize(entry.composition)).filter(Boolean);
  const requiredDiversity = Math.min(3, entries.length);
  if (new Set(techniques).size < requiredDiversity) errors.push(`Za mała różnorodność technik: ${new Set(techniques).size}/${requiredDiversity}.`);
  if (new Set(compositions).size < requiredDiversity) errors.push(`Za mała różnorodność kadrów: ${new Set(compositions).size}/${requiredDiversity}.`);
  const maxRepeat = Math.max(1, Math.ceil(entries.length / 2));
  for (const technique of new Set(techniques)) {
    if (techniques.filter((item) => item === technique).length > maxRepeat) errors.push(`Technika „${technique}” dominuje w pakiecie; maksimum ${maxRepeat}/${entries.length}.`);
  }
  for (const composition of new Set(compositions)) {
    if (compositions.filter((item) => item === composition).length > maxRepeat) errors.push(`Kadr „${composition}” powtarza się zbyt często; maksimum ${maxRepeat}/${entries.length}.`);
  }

  const manifest = {
    version: 1,
    package_directory: path.basename(assetsDir),
    strict_single_directory: true,
    exact_filename_matching: true,
    generated_at: new Date().toISOString(),
    required_variants: REQUIRED_VARIANTS,
    entries,
    diversity: {
      techniques: [...new Set(entries.map((entry) => entry.technique))],
      compositions: [...new Set(entries.map((entry) => entry.composition))],
    },
  };
  if (mutate) {
    article.media_manifest = manifest;
    const hero = entries.find((entry) => entry.placement === 'hero');
    if (hero) {
      article.hero_image = hero.filename_base;
      article.hero_alt = hero.alt;
      article.hero_width = hero.source.width;
      article.hero_height = hero.source.height;
    }
    entries.filter((entry) => entry.placement !== 'hero').forEach((entry) => {
      const index = Number((entry.placement.match(/(\d+)/) || [])[1] || 0) - 1;
      if (!article.sections?.[index]) return;
      article.sections[index].image = {
        src: `./assets/${entry.filename_base}.webp`,
        alt: entry.alt,
        caption: entry.caption,
        width: entry.source.width,
        height: entry.source.height,
      };
    });
  }
  return { ok: errors.length === 0, errors, warnings, entries, manifest, created };
}

module.exports = {
  REQUIRED_VARIANTS,
  hammingHex,
  inspectImage,
  prepareArticleMedia,
  validateManifestStructure,
};
