const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeFaqResearch, normalizeImagePromptSectionRef } = require('../scripts/fix-fitpo50-json');

test('JSON fixer preserves provenance required by the FAQ evidence gate', () => {
  const item = {
    question: 'Jak poznać właściwe tempo?',
    source_label: 'CDC — kryterium mowy',
    source_url: 'https://www.cdc.gov/example',
    source_type: 'manual_research',
    query: 'CDC talk test walking',
    research_note: 'Ręczny przegląd źródła potwierdził rzeczywiste pytanie i odpowiedź.',
    checked_at: '2026-08-25',
    url_status: 'reachable',
    http_status: 200,
    final_url: 'https://www.cdc.gov/example',
  };

  assert.deepEqual(normalizeFaqResearch([item]), [item]);
});

test('JSON fixer preserves supplemental section image placement', () => {
  assert.equal(normalizeImagePromptSectionRef('sekcja-2-obraz-3', -1, 4), 'sekcja-2-obraz-3');
  assert.equal(normalizeImagePromptSectionRef('Sekcja-2', -1, 2), 'sekcja-2');
});
