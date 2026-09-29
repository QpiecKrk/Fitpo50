const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '..', 'src', 'protein-core.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    target: 'node18'
  });
  const compiled = new Module('protein-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'protein-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const { calculateProtein, getProteinFactors } = loadCore();

test('mała aktywność rozróżnia osoby 50–64 i 65+', () => {
  assert.deepEqual(getProteinFactors(64, 'low', 'maintain'), [0.83, 1]);
  assert.deepEqual(getProteinFactors(65, 'low', 'maintain'), [1, 1.2]);
});

test('trening siłowy korzysta z zakresu planistycznego 1,2–1,5 g/kg', () => {
  assert.deepEqual(getProteinFactors(58, 'strength', 'maintain'), [1.2, 1.5]);
});

test('redukcja nie podbija wyniku powyżej 1,5 g/kg', () => {
  assert.deepEqual(getProteinFactors(70, 'low', 'reduction'), [1.2, 1.5]);
});

test('wynik dzienny i równy podział na posiłki są zaokrąglane do gramów', () => {
  assert.deepEqual(calculateProtein({
    age: 68,
    weight: 70,
    activity: 'low',
    goal: 'maintain',
    meals: 4
  }), {
    minimumFactor: 1,
    maximumFactor: 1.2,
    minimumDaily: 70,
    maximumDaily: 84,
    minimumMeal: 18,
    maximumMeal: 21
  });
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'protein-calculator.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function calculateProtein\(/);
});
