const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { inspectArticlePackage } = require('../scripts/article-package-intake');

function withTempDir(fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'article-package-intake-'));
  try {
    return fn(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function packageFixture(directory) {
  const questions = ['Jak zacząć?', 'Czy to jest bezpieczne?', 'Kiedy ocenić efekty?'];
  const prompts = [
    { section_ref: 'hero', filename_base: 'test-hero-v1', source_file: 'test-hero-v1.jpg' },
    { section_ref: 'sekcja-1', filename_base: 'test-sekcja-v1', source_file: 'test-sekcja-v1.jpg' },
  ];
  prompts.forEach((prompt) => {
    for (const extension of ['jpg', 'webp', 'avif']) {
      fs.writeFileSync(path.join(directory, `${prompt.filename_base}.${extension}`), extension);
    }
  });
  return {
    sections: [{ section_role: 'main' }, { section_role: 'utility' }],
    answer_blocks: questions.map((question) => ({ question, answer_html: '<p>Odpowiedź.</p>' })),
    faq_research: questions.map((question) => ({ question })),
    image_prompts_v4: prompts,
  };
}

test('package intake accepts one-directory Writer and Illustrator handoff', () => withTempDir((directory) => {
  const result = inspectArticlePackage(packageFixture(directory), directory);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(result.summary.faq, 3);
  assert.equal(result.summary.required_images, 2);
}));

test('package intake reports Writer and Illustrator fixes in one pass', () => withTempDir((directory) => {
  const article = packageFixture(directory);
  article.answer_blocks = article.answer_blocks.slice(0, 2);
  article.faq_research = article.faq_research.slice(0, 2);
  article.image_prompts_v4[0].source_file = 'test-hero-v1.jpeg';
  fs.rmSync(path.join(directory, 'test-sekcja-v1.avif'));
  const result = inspectArticlePackage(article, directory);
  assert.equal(result.ok, false);
  assert.match(result.issues.WRITER_FIX_REQUIRED.join('\n'), /source_file|1:1/);
  assert.match(result.issues.WRITER_FIX_REQUIRED.join('\n'), /filename_base \+ \.jpg/);
  assert.match(result.issues.ILLUSTRATOR_FIX_REQUIRED.join('\n'), /test-sekcja-v1\.avif/);
}));

test('package intake rejects stale source references and obsolete editorial handoffs', () => withTempDir((directory) => {
  const article = packageFixture(directory);
  article.sources = [{ url: 'https://example.org/current' }];
  article.image_prompts_v4[0].evidence_source_urls = ['https://example.org/removed'];
  article.editorial_notes = {
    assumptions: ['ZNANA FLAGA WALIDATORA: dawny wyjątek.'],
    local_pipeline_tasks: ['LOCAL_AGENT_REQUIRED: wygeneruj obrazy i uzupełnij FAQ.'],
  };
  const result = inspectArticlePackage(article, directory);
  assert.equal(result.ok, false);
  const writer = result.issues.WRITER_FIX_REQUIRED.join('\n');
  assert.match(writer, /URL spoza finalnego sources/);
  assert.match(writer, /historyczny konflikt/);
  assert.match(writer, /przerzuca zadanie/);
}));

test('package intake requires one image only for main sections', () => withTempDir((directory) => {
  const article = packageFixture(directory);
  article.image_prompts_v4 = article.image_prompts_v4.filter((item) => item.section_ref !== 'sekcja-1');
  const result = inspectArticlePackage(article, directory);
  assert.equal(result.ok, false);
  assert.match(result.issues.WRITER_FIX_REQUIRED.join('\n'), /sekcja-1/);
  assert.doesNotMatch(result.issues.WRITER_FIX_REQUIRED.join('\n'), /sekcja-2/);
}));
