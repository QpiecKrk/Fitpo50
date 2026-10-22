const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { isAuthoritativeDeviceDocumentation, validateArticleEvidence, validateSourceContractFields } = require('../scripts/lib/article-evidence');
const {
  cachedResult,
  classifyHttpStatus,
  decodeAutocompleteBody,
  findExactAutocompleteSuggestion,
  isEnvironmentVerificationFailure,
  parseAutocompleteSuggestions,
  requestUrl,
  requestSourceUrl,
} = require('../scripts/verify-article-evidence');
const { ensureParagraphWrapper } = require('../scripts/fix-fitpo50-json');
const { hasClearQuickAnswerForm } = require('../scripts/json-fitpo50-gate-diff');

const REPO = path.resolve(__dirname, '..');
const TODAY = '2026-08-24';
const HTTP_FIXTURE = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/http/article-evidence-responses.json'), 'utf8'));

function fixtureFetch(calls) {
  return async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers });
    const status = HTTP_FIXTURE.responses[url]?.[options.method];
    if (!status) throw new Error(`Brak atrapy ${options.method} ${url}`);
    return { status, url, headers: { get: () => 'text/html' }, arrayBuffer: async () => new ArrayBuffer(0) };
  };
}

function source(label, url) {
  return {
    label,
    url,
    checked_at: TODAY,
    url_status: 'reachable',
    http_status: 200,
    evidence_level: 'guideline',
    fallback_url: null,
    evidence_scope: null,
    publication_date: null,
    checked_via: 'test_fixture',
    recheck_after: null,
  };
}

test('future publication_date is blocked by the shared source contract', () => {
  const errors = validateSourceContractFields({
    ...source('Badanie z datą w przyszłości', 'https://example.org/future'),
    publication_date: '2999-01-01',
  }, 'sources[0]');
  assert.ok(errors.some((message) => message.includes('nie może być datą z przyszłości')));
});

test('derived section image fields do not duplicate prompt evidence, but overlay claims remain authoritative', () => {
  const url = 'https://pubmed.ncbi.nlm.nih.gov/12345678/';
  const json = validEvidenceJson();
  json.sections[0].image = { placement: 'sekcja-1', alt: 'Wykres wyniku 20 procent', caption: 'Badanie wykazało zmniejszenie ryzyka o 20%.' };
  json.image_prompts_v4 = [{
    section_ref: 'sekcja-1', alt_pl: 'Wykres wyniku 20 procent', caption_pl: 'Badanie wykazało zmniejszenie ryzyka o 20%.',
    overlay_text_pl: 'Zmniejszenie ryzyka o 20%', requires_exact_data_render: true,
    overlay_claims: [{ claim: 'Zmniejszenie ryzyka o 20%', source_url: url }],
  }];
  json.evidence_claims.push({ claim: 'Zmniejszenie ryzyka o 20%', location: 'image_prompts_v4[0].overlay_text_pl', claim_type: 'statistic', source_urls: [url] });
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.doesNotMatch(result.errors.join('\n'), /sections\[0\]\.image/);
});

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

test('manufacturer documentation supports only a model-specific device safety instruction', () => {
  const documentation = {
    label: 'Medtronic MiniMed 780G — instrukcja ustawienia daty i godziny',
    url: 'https://www.minimed.com/en-us/support/product-support/780g/updating-time-date',
    evidence_level: 'technical_documentation',
    fallback_url: null,
    evidence_scope: 'device_instructions_only',
    publication_date: null,
    checked_via: 'test_fixture',
    recheck_after: null,
  };
  assert.equal(isAuthoritativeDeviceDocumentation(documentation, 'Pompa MiniMed 780G wymaga prawidłowej godziny.'), true);
  assert.equal(isAuthoritativeDeviceDocumentation(documentation, 'Każda pompa insulinowa poprawia bezpieczeństwo terapii.'), false);

  const json = validEvidenceJson();
  json.title = 'Zmiana ustawień zegara po zmianie czasu';
  json.category = 'ciekawe';
  json.sections[0].paragraphs_html[0] = '<p>Producent pompy MiniMed 780G podaje, że prawidłowa godzina jest potrzebna do podawania insuliny bazalnej.</p>';
  json.sources = [{ ...documentation, checked_at: TODAY, url_status: 'reachable', http_status: 200 }];
  json.evidence_claims = [{
    claim: 'prawidłowa godzina jest potrzebna do podawania insuliny bazalnej',
    location: 'sections[0].paragraphs_html[0]',
    claim_type: 'safety',
    source_urls: [documentation.url],
  }];
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.equal(result.ok, true, result.errors.join('\n'));

  json.sections[0].paragraphs_html[0] = '<p>Każda pompa insulinowa poprawia bezpieczeństwo terapii.</p>';
  json.evidence_claims[0].claim = 'Każda pompa insulinowa poprawia bezpieczeństwo terapii';
  assert.match(validateArticleEvidence(json, { today: TODAY }).errors.join('\n'), /dokumentacji technicznej producenta wskazanego modelu/);
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

test('autocomplete verification requires the exact normalized FAQ suggestion, not only HTTP 200', () => {
  const question = 'Czy zmiana czasu ma sens?';
  const suggestions = parseAutocompleteSuggestions(JSON.stringify([question, ['czy zmiana czasu ma sens', 'zmiana czasu skutki']]));
  assert.equal(findExactAutocompleteSuggestion(question, suggestions), 'czy zmiana czasu ma sens');
  assert.equal(findExactAutocompleteSuggestion('Czy zmiana czasu zostanie zniesiona?', suggestions), '');

  const json = validEvidenceJson();
  json.answer_blocks[0].question = question;
  json.faq_research[0] = {
    question,
    source_label: 'Google Autocomplete PL',
    source_url: `https://suggestqueries.google.com/complete/search?client=firefox&hl=pl&q=${encodeURIComponent(question)}`,
    source_type: 'autocomplete',
    research_note: 'Pytanie sprawdzono w odpowiedzi Google Suggest dla dokładnego zapytania.',
    checked_at: TODAY,
    url_status: 'reachable',
    http_status: 200,
    intent_verified: false,
  };
  assert.match(validateArticleEvidence(json, { today: TODAY }).errors.join(' '), /nie zawiera pytania FAQ 1:1/);
  json.faq_research[0].intent_verified = true;
  json.faq_research[0].verified_suggestion = 'czy zmiana czasu ma sens';
  assert.doesNotMatch(validateArticleEvidence(json, { today: TODAY }).errors.join(' '), /Google Suggest|verified_suggestion/);
});

test('autocomplete decoding and matching preserve Polish characters consistently', async () => {
  const payload = JSON.stringify(['jak schudnąć po 50?', ['jak schudnąć po 50?']]);
  const bytes = Buffer.from(payload, 'utf8');
  const response = { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  const decoded = await decodeAutocompleteBody(response);
  const suggestions = parseAutocompleteSuggestions(decoded);
  assert.equal(findExactAutocompleteSuggestion('Jak schudnąć po 50?', suggestions), 'jak schudnąć po 50?');
});

test('autocomplete honors ISO-8859-2 charset and shares Polish diacritic normalization', async () => {
  const bytes = Buffer.from(HTTP_FIXTURE.autocomplete_iso_8859_2.bytes);
  const response = {
    headers: { get: () => HTTP_FIXTURE.autocomplete_iso_8859_2.content_type },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
  const suggestions = parseAutocompleteSuggestions(await decodeAutocompleteBody(response));
  assert.equal(findExactAutocompleteSuggestion('Czy załóż?', suggestions), 'czy załóż');
  assert.equal(findExactAutocompleteSuggestion('CZY ZALOZ', suggestions), 'czy załóż');
});

test('qualified publisher block warns while an unqualified 403 remains blocking', () => {
  const qualified = validEvidenceJson();
  qualified.sources[0].url_status = 'blocked_by_publisher';
  qualified.sources[0].http_status = 403;
  qualified.sources[0].pmid = '12345678';
  const qualifiedResult = validateArticleEvidence(qualified, { today: TODAY });
  assert.doesNotMatch(qualifiedResult.errors.join(' '), /wydawca blokuje automat/);
  assert.match(qualifiedResult.warnings.join(' '), /nie blokuje transportowo/);

  const unqualified = validEvidenceJson();
  unqualified.sources[0].url = 'https://commercial-example.test/article';
  unqualified.sources[0].url_status = 'blocked_by_publisher';
  unqualified.sources[0].http_status = 403;
  unqualified.evidence_claims[0].source_urls[0] = unqualified.sources[0].url;
  assert.match(validateArticleEvidence(unqualified, { today: TODAY }).errors.join(' '), /nie ma DOI\/PMID/);
});

test('local verification manifest validates sources and autocomplete without mutating writer-owned arrays', () => {
  const json = validEvidenceJson();
  json.sources[0].url_status = 'requires_local_verification';
  delete json.sources[0].http_status;
  const sourceBefore = JSON.stringify(json.sources);
  const url = json.sources[0].url;
  json.evidence_verification = {
    version: 1,
    entries: {
      [url]: { checked_at: TODAY, url_status: 'reachable', http_status: 200, final_url: url },
    },
  };
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.doesNotMatch(result.errors.join(' '), /nieznany url_status|brak http_status/);
  assert.equal(JSON.stringify(json.sources), sourceBefore);
  assert.equal(json.sources[0].url_status, 'requires_local_verification');
});

test('source checker retries HEAD 403 and 405 with browser-style GET before classifying', async () => {
  const originalFetch = global.fetch;
  try {
    for (const url of ['https://fixture.test/forbidden', 'https://fixture.test/method-not-allowed']) {
      const calls = [];
      global.fetch = fixtureFetch(calls);
      const result = await requestUrl(url, 1000);
      assert.equal(result.url_status, 'blocked_by_publisher');
      assert.deepEqual(calls.map((item) => item.method), ['HEAD', 'GET']);
      assert.match(calls[1].headers['user-agent'], /Mozilla\/5\.0/);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test('source checker uses only the writer-provided fallback after a saved 403 response', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  try {
    global.fetch = fixtureFetch(calls);
    const result = await requestSourceUrl('https://fixture.test/forbidden', [{ fallback_url: 'https://fixture.test/fallback' }], 1000);
    assert.equal(result.url_status, 'reachable');
    assert.equal(result.checked_via, 'fallback_url');
    assert.equal(result.publisher_http_status, 403);
    assert.deepEqual(calls.map((item) => `${item.method} ${item.url}`), [
      'HEAD https://fixture.test/forbidden',
      'GET https://fixture.test/forbidden',
      'HEAD https://fixture.test/fallback',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('saved 200 and 404 HTTP fixtures classify deterministically without internet', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = fixtureFetch([]);
    assert.equal((await requestUrl('https://fixture.test/ok', 1000)).url_status, 'reachable');
    assert.equal((await requestUrl('https://fixture.test/missing', 1000)).url_status, 'broken');
  } finally {
    global.fetch = originalFetch;
  }
});

test('transport and rate-limit failures are environment failures, not content failures', () => {
  assert.equal(isEnvironmentVerificationFailure({ url_status: 'verification_failed' }), true);
  assert.equal(isEnvironmentVerificationFailure({ url_status: 'temporarily_unavailable' }), true);
  assert.equal(isEnvironmentVerificationFailure({ url_status: 'broken' }), false);
  assert.equal(isEnvironmentVerificationFailure({ url_status: 'reachable' }), false);
});

test('evidence locations include image alt, caption and overlay text', () => {
  const json = validEvidenceJson();
  const url = json.sources[0].url;
  json.image_prompts_v4 = [{
    caption_pl: 'Badanie wykazało zmianę ryzyka o 20% w obserwowanej grupie.',
    alt_pl: 'Wykres ryzyka w obserwowanej grupie badania',
    overlay_text_pl: 'Ryzyko niższe o 20%',
  }];
  json.evidence_claims.push({
    claim: 'Badanie wykazało zmianę ryzyka o 20%',
    location: 'image_prompts_v4[0].caption_pl',
    claim_type: 'statistic',
    source_urls: [url],
  }, {
    claim: 'Wykres ryzyka w obserwowanej grupie badania',
    location: 'image_prompts_v4[0].alt_pl',
    claim_type: 'medical',
    source_urls: [url],
  }, {
    claim: 'Ryzyko niższe o 20%',
    location: 'image_prompts_v4[0].overlay_text_pl',
    claim_type: 'statistic',
    source_urls: [url],
  });
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('stale or broken source verification is blocking', () => {
  const stale = validEvidenceJson();
  stale.sources[0].checked_at = '2025-01-01';
  assert.match(validateArticleEvidence(stale, { today: TODAY }).errors.join(' '), /ponowne sprawdzenie/);

  const broken = validEvidenceJson();
  broken.sources[0].url_status = 'broken';
  broken.sources[0].http_status = 404;
  assert.match(validateArticleEvidence(broken, { today: TODAY }).errors.join(' '), /martwe|źródło zastępcze/);
});

test('URL checker distinguishes a reachable restricted endpoint from a broken address', () => {
  assert.equal(classifyHttpStatus(200), 'reachable');
  assert.equal(classifyHttpStatus(301), 'reachable');
  assert.equal(classifyHttpStatus(403), 'blocked_by_publisher');
  assert.equal(classifyHttpStatus(405), 'blocked_by_publisher');
  assert.equal(classifyHttpStatus(429), 'temporarily_unavailable');
  assert.equal(classifyHttpStatus(404), 'broken');
  assert.equal(classifyHttpStatus(410), 'broken');
  assert.equal(classifyHttpStatus(500), 'temporarily_unavailable');
});

test('fresh local URL verification is reused, but stale and failed results are not', () => {
  const url = 'https://example.org/source';
  const now = Date.parse('2026-08-25T10:00:00Z');
  const fresh = { entries: { [url]: { verified_at: '2026-08-24T10:00:00Z', url_status: 'reachable', http_status: 200, final_url: url } } };
  assert.equal(cachedResult(fresh, url, now, 7).cached, true);
  fresh.entries[url].verified_at = '2026-08-01T10:00:00Z';
  assert.equal(cachedResult(fresh, url, now, 7), null);
  fresh.entries[url].verified_at = '2026-08-24T10:00:00Z';
  fresh.entries[url].url_status = 'verification_failed';
  assert.equal(cachedResult(fresh, url, now, 7), null);
});

test('transport failure is not mislabeled as a broken source URL', async () => {
  const originalFetch = global.fetch;
  let result;
  try {
    global.fetch = async () => { throw new Error('ECONNREFUSED fixture'); };
    result = await requestUrl('https://fixture.test/network-error', 1000);
    assert.equal(result.url_status, 'verification_failed');
    assert.equal(result.http_status, 0);
    assert.ok(result.error);
  } finally {
    global.fetch = originalFetch;
  }

  const json = validEvidenceJson();
  json.sources[0] = { ...json.sources[0], url_status: 'verification_failed', http_status: 0 };
  const errors = validateArticleEvidence(json, { today: TODAY }).errors.join(' ');
  assert.match(errors, /DNS, timeoutu, TLS albo połączenia/);
  assert.doesNotMatch(errors, /brak http_status/);
});

test('environment failure exits 30 and leaves the article JSON byte-identical', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-evidence-env-'));
  try {
    const file = path.join(dir, 'draft.fitpo50.json');
    const cache = path.join(dir, 'cache.json');
    const payload = `${JSON.stringify({
      sources: [{ label: 'Niedostępny test', url: 'https://fixture.test/network-error' }],
      faq_research: [],
    }, null, 2)}\n`;
    fs.writeFileSync(file, payload);
    const result = spawnSync('node', [
      'scripts/verify-article-evidence.js', '--file', file, '--write', 'true', '--timeout', '1000', '--cache-file', cache,
      '--http-fixture', path.join(REPO, 'tests/fixtures/http/article-evidence-responses.json'),
    ], { cwd: REPO, encoding: 'utf8' });
    assert.equal(result.status, 30, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.readFileSync(file, 'utf8'), payload);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('trusted institutional guidance and consensus qualify as medical evidence', () => {
  const json = validEvidenceJson();
  json.sources[0].url = 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000743';
  json.sources[0].evidence_level = 'expert_consensus';
  json.sources[1].url = 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics/eggs';
  json.sources[1].evidence_level = 'official_guidance';
  json.evidence_claims[0].source_urls = json.sources.map((item) => item.url);
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('American College of Cardiology guidance is recognized as a strong institutional source', () => {
  const json = validEvidenceJson();
  const acc = 'https://www.acc.org/Latest-in-Cardiology/Articles/2025/07/01/01/Prioritizing-Health-Dietary-Approaches-For-Elevated-LDL-C';
  json.sources[0].url = acc;
  json.sources[0].evidence_level = 'official_guidance';
  json.evidence_claims[0].source_urls = [acc, json.sources[1].url];
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('ESPEN guideline is recognized as a strong institutional source', () => {
  const json = validEvidenceJson();
  const espen = 'https://www.espen.org/files/ESPEN-Guidelines/example.pdf';
  json.sources[0].url = espen;
  json.sources[0].evidence_level = 'guideline';
  json.evidence_claims[0].source_urls = [espen, json.sources[1].url];
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('MedlinePlus guidance is recognized as a strong US public-health source', () => {
  const json = validEvidenceJson();
  const medline = 'https://medlineplus.gov/ency/article/004018.htm';
  json.sources[0].url = medline;
  json.sources[0].evidence_level = 'official_guidance';
  json.evidence_claims[0].source_urls = [medline, json.sources[1].url];
  const result = validateArticleEvidence(json, { today: TODAY });
  assert.equal(result.ok, true, result.errors.join('\n'));
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

test('JSON fixer never wraps semantic block content inside a paragraph', () => {
  const table = '<div class="article-table-wrap"><table><caption>Wyniki</caption></table></div>';
  assert.equal(ensureParagraphWrapper(table), table);
  assert.equal(ensureParagraphWrapper('<table><caption>Wyniki</caption></table>'), '<table><caption>Wyniki</caption></table>');
  assert.equal(ensureParagraphWrapper('Zwykły tekst'), '<p>Zwykły tekst</p>');
});

test('quick answer gate accepts a concise multi-sentence paragraph and decimal values', () => {
  assert.equal(hasClearQuickAnswerForm('Jajka mogą zmieniać LDL. W badaniu różnica wyniosła 8.14 mg/dl. Decyzję oprzyj na swoim wyniku.'), true);
  assert.equal(hasClearQuickAnswerForm('Dr. Kowalski nie zastępuje konsultacji. Jeśli wynik rośnie, omów go z lekarzem.'), true);
  assert.equal(hasClearQuickAnswerForm('urwany fragment bez końca'), false);
  assert.equal(hasClearQuickAnswerForm('Pierwsze. Drugie. Trzecie. Czwarte.'), false);
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

test('base JSON fixer translates legacy Claude source and claim fields without inventing sources', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-legacy-evidence-'));
  try {
    const file = path.join(dir, 'legacy.fitpo50.json');
    fs.writeFileSync(file, `${JSON.stringify({
      slug: 'legacy-evidence-test',
      title: 'Test starszego formatu dowodów w artykule medycznym',
      seo_title: 'Test starszego formatu dowodów w artykule medycznym',
      meta_description: 'Kontrolny opis sprawdzający bezpieczną migrację starszego formatu źródeł i przypisań dowodów bez dopisywania nowych publikacji przez lokalny fixer JSON.',
      category: 'zdrowie',
      date_published: TODAY,
      quick_answer: 'To kontrolny akapit odpowiedzi, który zawiera wystarczającą liczbę słów do przejścia podstawowej normalizacji, ale nie służy do publikacji ani porad medycznych.',
      key_takeaways: ['Jeden', 'Dwa', 'Trzy', 'Cztery'],
      sections: [{ heading: 'Co wykazała kohorta?', paragraphs_html: ['<p>Kohorta wykazała wyższe ryzyko w obserwowanej grupie.</p>'], image: {} }],
      answer_blocks: [],
      sources: [{ id: 'cohort-1', type: 'kohorta populacyjna', citation: 'Autorzy. Badanie kohortowe.', url: 'https://doi.org/10.1000/example' }],
      evidence_claims: [{ claim: 'Wynik kohorty', location: 'sections[0] kohorta, akapit 1', sources: ['cohort-1'] }],
      image_prompts: [],
    }, null, 2)}\n`);
    spawnSync('node', ['scripts/fix-fitpo50-json.js', '--file', file, '--write', 'true', '--allow-outside-repo', 'true'], { cwd: REPO, encoding: 'utf8' });
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(after.sources[0].evidence_level, 'cohort');
    assert.equal(after.evidence_claims[0].location, 'sections[0].paragraphs_html[0]');
    assert.deepEqual(after.evidence_claims[0].source_urls, ['https://doi.org/10.1000/example']);
    assert.match(after.evidence_claims[0].claim, /Kohorta wykazała wyższe ryzyko/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('base JSON fixer preserves evidence claims outside article sections', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-global-evidence-'));
  try {
    const file = path.join(dir, 'global-evidence.fitpo50.json');
    const sourceUrl = 'https://pubmed.ncbi.nlm.nih.gov/25056502/';
    fs.writeFileSync(file, `${JSON.stringify({
      slug: 'global-evidence-test',
      title: 'Test przypisów we wstępie i krótkiej odpowiedzi artykułu',
      seo_title: 'Test przypisów we wstępie i krótkiej odpowiedzi',
      meta_description: 'Kontrolny opis sprawdzający zachowanie przypisów do wstępu, krótkiej odpowiedzi oraz kluczowych wniosków podczas bezpiecznej normalizacji JSON.',
      category: 'zdrowie',
      date_published: TODAY,
      lead: 'Badanie objęło starszych mężczyzn i porównało odpowiedź po różnych ilościach białka.',
      quick_answer: 'Badanie objęło starszych mężczyzn i wykazało różną odpowiedź po kilku ilościach białka podanych w jednym posiłku. To zdanie ma wystarczającą długość do sprawdzenia normalizacji krótkiej odpowiedzi bez dopisywania nowych twierdzeń przez fixer.',
      key_takeaways: ['Badanie objęło starszych mężczyzn.', 'Drugi wniosek.', 'Trzeci wniosek.', 'Czwarty wniosek.'],
      sections: [{ title: 'Co sprawdzono w badaniu?', paragraphs_html: ['<p>Autorzy porównali kilka ilości białka.</p>'], image: {} }],
      answer_blocks: [],
      sources: [{ label: 'Moore et al. 2015 (PubMed)', url: sourceUrl, evidence_level: 'primary_research', checked_at: TODAY, url_status: 'reachable', http_status: 200 }],
      evidence_claims: [
        { claim: 'Badanie objęło starszych mężczyzn', location: 'lead', claim_type: 'general', source_urls: [sourceUrl] },
        { claim: 'Badanie objęło starszych mężczyzn', location: 'quick_answer', claim_type: 'general', source_urls: [sourceUrl] },
        { claim: 'Badanie objęło starszych mężczyzn', location: 'key_takeaways[0]', claim_type: 'general', source_urls: [sourceUrl] },
      ],
      faq_research: [],
      image_prompts: [],
    }, null, 2)}\n`);
    spawnSync('node', ['scripts/fix-fitpo50-json.js', '--file', file, '--write', 'true', '--allow-outside-repo', 'true'], { cwd: REPO, encoding: 'utf8' });
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(after.evidence_claims.map((item) => item.location), ['lead', 'quick_answer', 'key_takeaways[0]']);
    assert.ok(after.evidence_claims.every((item) => item.claim.includes('Badanie objęło starszych mężczyzn')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('base JSON fixer preserves precise canonical claims in sections and image prompts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-canonical-evidence-'));
  try {
    const file = path.join(dir, 'canonical-evidence.fitpo50.json');
    const sourceUrl = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4455479/';
    const sectionClaim = 'prawidłowa godzina pompy jest potrzebna do właściwego podawania insuliny';
    const imageClaim = 'Ryzyko względne wyniosło 1,04';
    fs.writeFileSync(file, `${JSON.stringify({
      slug: 'canonical-evidence-test',
      title: 'Test zachowania dokładnych przypisań dowodów w artykule',
      seo_title: 'Test zachowania dokładnych przypisań dowodów',
      meta_description: 'Kontrolny opis sprawdzający, czy fixer zachowuje dokładne twierdzenia przypisane do akapitów i podpisów obrazów zamiast zastępować je inną treścią.',
      category: 'zdrowie',
      date_published: TODAY,
      quick_answer: 'To kontrolna odpowiedź opisująca warunek i konkretny wynik 1,04, aby sprawdzić zachowanie przypisań bez dopisywania albo podmieniania twierdzeń.',
      key_takeaways: ['Jeden', 'Dwa', 'Trzy', 'Cztery'],
      sections: [{
        title: 'Co pokazuje instrukcja urządzenia?',
        paragraphs_html: [`<p>Producent wyjaśnia, że ${sectionClaim} w tym konkretnym modelu.</p>`],
        image: {},
      }],
      answer_blocks: [],
      sources: [{ label: 'Aldasouqi i Reed 2014 (PMC)', url: sourceUrl, evidence_level: 'primary_research', checked_at: TODAY, url_status: 'reachable', http_status: 200 }],
      evidence_claims: [
        { claim: sectionClaim, location: 'sections[0].paragraphs_html[0]', claim_type: 'safety', source_urls: [sourceUrl] },
        { claim: imageClaim, location: 'image_prompts_v4[0].overlay_text_pl', claim_type: 'statistic', source_urls: [sourceUrl] },
      ],
      faq_research: [],
      image_prompts_v4: [{
        section_ref: 'sekcja-1',
        filename_base: 'canonical-evidence-test-obraz',
        source_file: 'canonical-evidence-test-obraz.jpeg',
        topic: 'Kontrolna grafika danych',
        technique: 'data visualization',
        composition: 'Poziomy wykres na jasnym tle',
        purpose: 'Kontrola zachowania dowodu przypisanego do grafiki',
        aspect_ratio: '16:9',
        prompt_en: 'A clean horizontal chart without decorative content.',
        negative_prompt: 'No logos and no unrelated text.',
        alt_pl: 'Kontrolny wykres ryzyka względnego',
        caption_pl: 'Kontrolny podpis wykresu.',
        overlay_text_pl: imageClaim,
        overlay_claims: [{ claim: imageClaim, source_url: sourceUrl }],
        evidence_source_urls: [sourceUrl],
        requires_exact_data_render: true,
      }],
    }, null, 2)}\n`);
    spawnSync('node', ['scripts/fix-fitpo50-json.js', '--file', file, '--write', 'true', '--allow-outside-repo', 'true'], { cwd: REPO, encoding: 'utf8' });
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(after.evidence_claims.slice(0, 2).map(({ claim, location }) => ({ claim, location })), [
      { claim: sectionClaim, location: 'sections[0].paragraphs_html[0]' },
      { claim: imageClaim, location: 'image_prompts_v4[0].overlay_text_pl' },
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
