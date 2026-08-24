const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  assessCenter,
  buildArticleInventory,
  prepareArticleArchitecture,
} = require('../scripts/lib/article-intent-links');

function withTempRepo(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-architecture-'));
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function addArticle(root, file, title, body = '') {
  const html = `<!doctype html><html><head><title>${title} | FitPo50</title><meta name="description" content="${title} — konkretny opis testowy."><script type="application/ld+json">{"@type":"BlogPosting"}</script></head><body><article><h1>${title}</h1><h2>Co trzeba wiedzieć?</h2><p>${body || title}</p></article></body></html>`;
  fs.writeFileSync(path.join(root, file), html);
}

function draft() {
  return {
    slug: 'powrot-do-regularnego-ruchu',
    title: 'Powrót do regularnego ruchu po pięćdziesiątce',
    seo_title: 'Powrót do regularnego ruchu po pięćdziesiątce',
    lead: 'Powrót do regularnego ruchu wymaga dopasowania obciążenia do obecnej sprawności.',
    quick_answer: 'Powrót do regularnego ruchu zaczyna się od oceny tolerancji wysiłku i małych kroków.',
    search_intent: 'how-to',
    primary_keyword: 'powrót do regularnego ruchu',
    supporting_keywords: ['trening siłowy po 50', 'sen i regeneracja', 'białko w diecie', 'pomiar ciśnienia'],
    sections: [
      { paragraphs_html: ['<p>Trening siłowy dla początkujących może być pierwszym elementem planu.</p>'] },
      { paragraphs_html: ['<p>Białko w codziennej diecie pomaga ułożyć posiłki wokół aktywności.</p>'] },
      { paragraphs_html: ['<p>Sen i regeneracja wpływają na gotowość do kolejnej sesji.</p>'] },
      { paragraphs_html: ['<p>Pomiar ciśnienia tętniczego porządkuje ocenę bezpieczeństwa wysiłku.</p>'] },
    ],
  };
}

function addLinkTargets(root) {
  addArticle(root, 'trening-silowy-poczatkujacy.html', 'Trening siłowy dla początkujących');
  addArticle(root, 'bialko-codzienna-dieta.html', 'Białko w codziennej diecie');
  addArticle(root, 'sen-regeneracja.html', 'Sen i regeneracja');
  addArticle(root, 'pomiar-cisnienia.html', 'Pomiar ciśnienia tętniczego');
}

test('inventory contains only real local BlogPosting pages', () => withTempRepo((root) => {
  addArticle(root, 'artykul.html', 'Prawdziwy artykuł');
  fs.writeFileSync(path.join(root, 'porady.html'), '<html><title>Porady</title></html>');
  assert.deepEqual(buildArticleInventory(root).map((item) => item.file), ['artykul.html']);
}));

test('local architecture adds four existing targets on phrases already present in paragraphs', () => withTempRepo((root) => {
  addLinkTargets(root);
  addArticle(root, 'centrum-ruchu-test.html', 'Trening siłowy dla początkujących — centrum');
  const article = draft();
  const result = prepareArticleArchitecture(article, { root, mutate: true });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.inventory_count, 5);
  assert.equal(result.added_links.length, 4);
  assert.equal(result.confirmed_link_count, 4);
  assert.equal(new Set(result.added_links.map((item) => item.target)).size, 4);
  assert.equal(article.internal_link_plan.length, 4);
  assert.equal(article.sections.every((section) => /<a href="[^"]+\.html">/.test(section.paragraphs_html[0])), true);
  assert.equal(article.sections.some((section) => /centrum-/.test(section.paragraphs_html[0])), false);
  assert.equal(result.incoming_link_suggestions.some((item) => item.source.startsWith('centrum-')), false);
}));

test('system blocks generic anchors and targets outside current article inventory', () => withTempRepo((root) => {
  addLinkTargets(root);
  const article = draft();
  article.sections[0].paragraphs_html[0] = '<p><a href="nie-istnieje.html">tutaj</a> znajdziesz plan.</p>';
  const result = prepareArticleArchitecture(article, { root, mutate: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /nie jest istniejącym artykułem BlogPosting/);
  assert.match(result.errors.join('\n'), /generyczny albo nienaturalny/);
}));

test('strong collision requires a concrete intent differentiation before import', () => withTempRepo((root) => {
  addLinkTargets(root);
  addArticle(root, 'istniejacy-powrot.html', 'Powrót do regularnego ruchu po 50');
  const article = draft();
  const result = prepareArticleArchitecture(article, { root, mutate: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /CANNIBALIZATION_REVIEW_REQUIRED/);
  assert.equal(result.cannibalization_candidates[0].file, 'istniejacy-powrot.html');
}));

test('strong center fit is only a proposal awaiting user approval', () => {
  const assessment = assessCenter({
    primary_keyword: 'trening siłowy po 50',
    supporting_keywords: ['progresja ciężaru', 'maszyny na siłowni', 'siła chwytu'],
    title: 'Trening siłowy po 50',
    lead: 'Plan wykorzystuje maszyny i spokojną progresję ciężaru.',
  });
  assert.equal(assessment.fit, 'STRONG');
  assert.equal(assessment.proposed, true);
  assert.equal(assessment.status, 'AWAITING_USER_APPROVAL');
  assert.equal(assessment.center_id, 'strength');
});

test('hub link without explicit user approval is blocked', () => withTempRepo((root) => {
  addLinkTargets(root);
  addArticle(root, 'centrum-treningu-silowego-po-50.html', 'Centrum treningu siłowego po 50');
  const article = draft();
  article.sections[0].paragraphs_html[0] = '<p><a href="centrum-treningu-silowego-po-50.html">trening siłowy po 50</a> może być pierwszym elementem planu.</p>';
  const result = prepareArticleArchitecture(article, { root, mutate: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /nie ma jawnej akceptacji użytkownika/);
}));
