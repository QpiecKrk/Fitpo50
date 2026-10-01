const test = require('node:test');
const assert = require('node:assert/strict');
const { TASKS, executionPlan } = require('../scripts/prepush-parallel-checks');

test('każde zadanie prepush jawnie deklaruje odczyt albo zapis', () => {
  for (const [name, task] of Object.entries(TASKS)) assert.ok(['read', 'write'].includes(task.access), name);
});

test('zadania zapisujące nie trafiają do puli równoległej', () => {
  const definitions = {
    readA: { access: 'read' },
    writeA: { access: 'write' },
    readB: { access: 'read' },
    writeB: { access: 'write' },
  };
  const plan = executionPlan(['readA', 'writeA', 'readB', 'writeB'], definitions);
  assert.deepEqual(plan.parallelRead, ['readA', 'readB']);
  assert.deepEqual(plan.sequentialWrite, ['writeA', 'writeB']);
});

test('zadanie bez deklaracji dostępu blokuje wykonanie', () => {
  assert.throws(() => executionPlan(['unknown'], { unknown: {} }), /nie deklaruje access/);
});
