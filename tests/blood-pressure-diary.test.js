const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '..', 'src', 'blood-pressure-core.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    target: 'node18'
  });
  const compiled = new Module('blood-pressure-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'blood-pressure-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const { hasSevereReading, summarizeReadings, validateReading } = loadCore();

function reading(day, period, systolic, diastolic, pulse = null) {
  return { day, period, sequence: 1, systolic, diastolic, pulse };
}

test('średnia główna pomija dzień 1', () => {
  const summary = summarizeReadings([
    reading(1, 'morning', 200, 100, 90),
    reading(2, 'morning', 120, 80, 60),
    reading(2, 'evening', 140, 90, 80)
  ]);
  assert.equal(summary.pressure, '130/85');
  assert.equal(summary.morning, '120/80');
  assert.equal(summary.evening, '140/90');
  assert.equal(summary.pulse, 70);
  assert.equal(summary.count, 2);
});

test('niepełna para jest odrzucana', () => {
  assert.match(validateReading(125, null, null), /obie wartości/i);
  assert.match(validateReading(null, 80, 60), /obie wartości/i);
});

test('wartość skurczowa nie może być niższa od rozkurczowej', () => {
  assert.match(validateReading(80, 120, null), /skurczowe powinno być wyższe/i);
});

test('bardzo wysoki odczyt uruchamia warunek bezpieczeństwa', () => {
  assert.equal(hasSevereReading([reading(2, 'morning', 181, 100)]), true);
  assert.equal(hasSevereReading([reading(2, 'morning', 170, 121)]), true);
  assert.equal(hasSevereReading([reading(2, 'morning', 170, 100)]), false);
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'blood-pressure-diary.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function buildDays\(\)/);
});
