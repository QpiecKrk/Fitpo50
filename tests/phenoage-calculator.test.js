const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '..', 'src', 'phenoage-core.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    target: 'node18'
  });
  const compiled = new Module('phenoage-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'phenoage-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const {
  calculatePhenoAge,
  canonicalizePhenoAgeValues,
  describeAgeDifference
} = loadCore();

const referenceValues = {
  age: 58,
  albumin: 43,
  creatinine: 82,
  glucose: 5.2,
  crp: 0.12,
  lymphocyte: 31,
  mcv: 91,
  rdw: 13.1,
  alp: 72,
  wbc: 6.4
};

test('wzór odtwarza wynik liczony współczynnikami referencyjnego kodu BioAge', () => {
  assert.ok(Math.abs(calculatePhenoAge(referenceValues) - 51.367448008152195) < 1e-10);
});

test('jednostki laboratoryjne są przeliczane na jednostki wzoru', () => {
  const converted = canonicalizePhenoAgeValues({
    ...referenceValues,
    albumin: 4.3,
    creatinine: 82 / 88.4,
    glucose: 5.2 * 18,
    crp: 1.2
  }, {
    albuminUnit: 'gdL',
    creatinineUnit: 'mgdL',
    glucoseUnit: 'mgdL',
    crpUnit: 'mgL'
  });

  assert.ok(Math.abs(converted.albumin - referenceValues.albumin) < 1e-12);
  assert.ok(Math.abs(converted.creatinine - referenceValues.creatinine) < 1e-12);
  assert.ok(Math.abs(converted.glucose - referenceValues.glucose) < 1e-12);
  assert.ok(Math.abs(converted.crp - referenceValues.crp) < 1e-12);
  assert.ok(Math.abs(calculatePhenoAge(converted) - calculatePhenoAge(referenceValues)) < 1e-10);
});

test('CRP równe zero nie tworzy pozornie prawidłowego wyniku', () => {
  assert.equal(Number.isNaN(calculatePhenoAge({ ...referenceValues, crp: 0 })), true);
});

test('opis różnicy nie używa arbitralnego progu trzech lat', () => {
  assert.equal(describeAgeDifference(-0.1), 'poniżej wieku metrykalnego');
  assert.equal(describeAgeDifference(0), 'zbliżony do wieku metrykalnego');
  assert.equal(describeAgeDifference(0.1), 'powyżej wieku metrykalnego');
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'phenoage-calculator.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function calculatePhenoAge\(/);
});
