const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '..', 'src', 'lab-results-core.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    target: 'node18'
  });
  const compiled = new Module('lab-results-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'lab-results-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const {
  calculateEgfr2021,
  compareWithLabRange,
  creatinineToMgDl,
  validateLabRange
} = loadCore();

test('porównanie obsługuje zakres dwustronny wraz z granicami', () => {
  assert.equal(compareWithLabRange(69.9, { lower: 70, upper: 99 }), 'below');
  assert.equal(compareWithLabRange(70, { lower: 70, upper: 99 }), 'within');
  assert.equal(compareWithLabRange(99, { lower: 70, upper: 99 }), 'within');
  assert.equal(compareWithLabRange(99.1, { lower: 70, upper: 99 }), 'above');
});

test('porównanie obsługuje zakres z tylko jedną granicą', () => {
  assert.equal(compareWithLabRange(55, { lower: 60, upper: null }), 'below');
  assert.equal(compareWithLabRange(130, { lower: null, upper: 115 }), 'above');
  assert.equal(compareWithLabRange(90, { lower: null, upper: 115 }), 'within');
});

test('brak granic i odwrócony zakres są odrzucane', () => {
  assert.match(validateLabRange({ lower: null, upper: null }), /co najmniej jedną granicę/i);
  assert.match(validateLabRange({ lower: 100, upper: 90 }), /większa od dolnej/i);
});

test('konwersja kreatyniny zachowuje równoważność jednostek', () => {
  assert.ok(Math.abs(creatinineToMgDl(88.4, 'umolL') - 1) < 1e-12);
  assert.equal(creatinineToMgDl(1, 'mgdL'), 1);
});

test('eGFR odtwarza równanie CKD-EPI 2021 publikowane przez NIDDK', () => {
  assert.ok(Math.abs(calculateEgfr2021(1, 60, 'male') - 86.16262077966914) < 1e-10);
  assert.ok(Math.abs(calculateEgfr2021(1, 60, 'female') - 64.4950003539451) < 1e-10);
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'lab-results-interpreter.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function calculateEgfr2021\(/);
});

test('strona pozostaje nieindeksowalna i nie jest podłączona do strony głównej', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '..', 'interpretator-wynikow-badan.html'), 'utf8');
  const homepage = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const hiddenHub = fs.readFileSync(path.resolve(__dirname, '..', 'narzedzia.html'), 'utf8');
  const testSelect = page.match(/<select name="test"[\s\S]*?<\/select>/)?.[0] || '';
  const options = testSelect.match(/<option value="(?!")[^"]+"/g) || [];

  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  assert.equal(options.length, 11);
  assert.match(hiddenHub, /href="interpretator-wynikow-badan\.html"/);
  assert.doesNotMatch(homepage, /interpretator-wynikow-badan\.html/);
  assert.doesNotMatch(homepage, /href="narzedzia\.html"/);
});
