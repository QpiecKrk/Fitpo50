const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeFaqResearch } = require('../scripts/fix-fitpo50-json');

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
