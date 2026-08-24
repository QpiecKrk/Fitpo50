const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validateArticleEvidence } = require('../scripts/lib/article-evidence');
const { classifyHttpStatus } = require('../scripts/verify-article-evidence');

const REPO = path.resolve(__dirname, '..');
const TODAY = '2026-08-24';

function source(label, url) {
  return {
    label,
    url,
    checked_at: TODAY,
    url_status: 'reachable',
    http_status: 200,
    evidence_level: 'guideline',
  };
}

function validEvidenceJson() {
  const pubmed = 'https://pubmed.ncbi.nlm.nih.gov/12345678/';
  const who = 'https://www.who.int/news-room/fact-sheets/detail/physical-activity';
  const question = 'Czy wynik badania trzeba omówić z lekarzem?';
  return {
    title: 'Badanie laboratoryjne po 50 roku życia',
    category: 'zdrowie',
    sections: [{
      paragraphs_html: ['<p>Badanie wykazało zmniejszenie ryzyka o 20% w obserwowanej grupie.</p>'],
    }],
    answer_blocks: [{ question, answer_html: '<p>Odpowiedź opisuje zakres pytania użytkownika bez dodatkowych twierdzeń.</p>' }],
    faq_research: [{
      question,
      source_label: 'Udokumentowany research redakcyjny FitPo50',
      source_url: pubmed,
      source_type: 'manual_research',
      research_note: 'Pytanie zapisano podczas ręcznego przeglądu intencji użytkowników.',
      checked_at: TODAY,
      url_status: 'reachable',
      http_status: 200,
    }],
    sources: [
      source('PubMed: badanie ryzyka w obserwowanej grupie', pubmed),
      source('WHO: oficjalne zalecenia zdrowotne', who),
    ],
    evidence_claims: [{
      claim: 'Badanie wykazało zmniejszenie ryzyka o 20%',
      location: 'sections[0].paragraphs_html[0]',
      claim_type: 'medical',
      source_urls: [pubmed, who],
    }],
  };
}

test('complete claim-to-source mapping passes the evidence gate', () => {
  const result = validateArticleEvidence(validEvidenceJson(), { today: TODAY });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('vague references, open metaphors and unsupported conclusions are blocking', () => {
  const vague = validEvidenceJson();
  vague.lead = 'Ta obietnica brzmi przekonująco, ale wymaga ostrożności.';
  assert.match(validateArticleEvidence(vague, { today: TODAY }).errors.join(' '), /skrót logiczny/);

  const metaphor = validEvidenceJson();
  metaphor.lead = 'Metabolizm jest silnikiem metabolizmu, który można łatwo uruchomić.';
  assert.match(validateArticleEvidence(metaphor, { today: TODAY }).errors.join(' '), /metafora bez domknięcia/);

  const conclusion = validEvidenceJson();
  conclusion.lead = 'Dlatego ten plan działa u każdego człowieka.';
  assert.match(validateArticleEvidence(conclusion, { today: TODAY }).errors.join(' '), /wniosek nie wynika/);

  conclusion.logic_links = [{
    conclusion_location: 'lead',
    premise_locations: ['sections[0].paragraphs_html[0]'],
    reasoning: 'Wniosek ogranicza się do wyniku opisanego w przywołanym wcześniej akapicie.',
  }];
  assert.doesNotMatch(validateArticleEvidence(conclusion, { today: TODAY }).errors.join(' '), /wniosek nie wynika/);
});

test('decorative sources and unassigned medical claims are blocking', () => {
  const decorative = validEvidenceJson();
  decorative.sources.push(source('NIH: dodatkowa publikacja bez przypisania', 'https://www.nih.gov/health-information'));
  assert.match(validateArticleEvidence(decorative, { today: TODAY }).errors.join(' '), /dekoracyjna lista źródeł/);

  const unmapped = validEvidenceJson();
  unmapped.evidence_claims = [];
  const errors = validateArticleEvidence(unmapped, { today: TODAY }).errors.join(' ');
  assert.match(errors, /Brak evidence_claims/);
  assert.match(errors, /twierdzenie wymagające dowodu/);
});

test('medical claims require strong domains and explicit evidence level', () => {
  const json = validEvidenceJson();
  json.sources[0].url = 'https://example.org/opinia';
  json.sources[1].url = 'https://blog.example.net/porada';
  json.evidence_claims[0].source_urls = json.sources.map((item) => item.url);
  const errors = validateArticleEvidence(json, { today: TODAY }).errors.join(' ');
  assert.match(errors, /silnego źródła medycznego/);
  assert.match(errors, /67%/);

  const missingLevel = validEvidenceJson();
  delete missingLevel.sources[0].evidence_level;
  assert.match(validateArticleEvidence(missingLevel, { today: TODAY }).errors.join(' '), /evidence_level/);
});

test('FAQ must have documented origin and never accepts artificial variant numbering', () => {
  const json = validEvidenceJson();
  json.answer_blocks[0].question = 'Czy wynik badania trzeba omówić z lekarzem — wariant 2?';
  json.faq_research[0].question = json.answer_blocks[0].question;
  const errors = validateArticleEvidence(json, { today: TODAY }).errors.join(' ');
  assert.match(errors, /wariant N/);

  const missingOrigin = validEvidenceJson();
  delete missingOrigin.faq_research[0].source_type;
  assert.match(validateArticleEvidence(missingOrigin, { today: TODAY }).errors.join(' '), /source_type/);
});

test('stale or broken source verification is blocking', () => {
  const stale = validEvidenceJson();
  stale.sources[0].checked_at = '2025-01-01';
  assert.match(validateArticleEvidence(stale, { today: TODAY }).errors.join(' '), /ponowne sprawdzenie/);

  const broken = validEvidenceJson();
  broken.sources[0].url_status = 'broken';
  broken.sources[0].http_status = 404;
  assert.match(validateArticleEvidence(broken, { today: TODAY }).errors.join(' '), /url_status/);
});

test('URL checker distinguishes a reachable restricted endpoint from a broken address', () => {
  assert.equal(classifyHttpStatus(200), 'reachable');
  assert.equal(classifyHttpStatus(301), 'reachable');
  assert.equal(classifyHttpStatus(403), 'reachable');
  assert.equal(classifyHttpStatus(429), 'reachable');
  assert.equal(classifyHttpStatus(404), 'broken');
  assert.equal(classifyHttpStatus(500), 'broken');
});

test('strict autofix never invents quick answers, FAQ, research or sources', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-no-faq-autofix-'));
  try {
    const file = path.join(dir, 'draft.fitpo50.json');
    const json = {
      title: 'Test bez automatycznego uzupełniania treści',
      seo_title: 'Test bez automatycznego uzupełniania treści',
      answer_blocks: [{ question: 'To samo pytanie?', answer_html: '<p>Pierwsza odpowiedź.</p>' }, { question: 'To samo pytanie?', answer_html: '<p>Druga odpowiedź.</p>' }],
      sources: [],
      sections: [],
    };
    fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    const result = spawnSync('node', ['scripts/json-autofix-strict.js', '--file', file], { cwd: REPO, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(Object.hasOwn(after, 'quick_answer'), false);
    assert.equal(Object.hasOwn(after, 'faq_research'), false);
    assert.equal(after.answer_blocks[0].question, after.answer_blocks[1].question);
    assert.deepEqual(after.sources, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('base JSON fixer preserves missing evidence as blockers instead of fabricating content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-no-content-fixer-'));
  try {
    const file = path.join(dir, 'draft.fitpo50.json');
    fs.writeFileSync(file, `${JSON.stringify({
      slug: 'test-bez-fabrykowania-tresci',
      title: 'Testowy artykuł kontrolujący brak fabrykowania treści',
      seo_title: 'Testowy artykuł kontrolujący brak fabrykowania treści',
      meta_description: 'To kontrolny opis artykułu używany wyłącznie do sprawdzenia, czy fixer nie dopisuje brakujących treści, pytań, odpowiedzi ani przypadkowych źródeł naukowych.',
      category: 'zdrowie',
      date_published: TODAY,
      sections: [],
      key_takeaways: [],
      answer_blocks: [],
      sources: [],
      image_prompts: [],
    }, null, 2)}\n`);
    const result = spawnSync('node', [
      'scripts/fix-fitpo50-json.js', '--file', file, '--write', 'true', '--allow-outside-repo', 'true',
    ], { cwd: REPO, encoding: 'utf8' });
    assert.equal(result.status, 1);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(after.quick_answer, '');
    assert.deepEqual(after.key_takeaways, []);
    assert.deepEqual(after.answer_blocks, []);
    assert.deepEqual(after.faq_research, []);
    assert.deepEqual(after.sources, []);
    assert.deepEqual(after.image_prompts, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
