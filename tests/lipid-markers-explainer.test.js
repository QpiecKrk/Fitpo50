const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '..', 'src', 'lipid-markers-core.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    target: 'node18'
  });
  const compiled = new Module('lipid-markers-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'lipid-markers-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const { calculateNonHdl, parseLocalizedNumber, validateLipidValues } = loadCore();

test('non-HDL-C jest różnicą cholesterolu całkowitego i HDL-C', () => {
  assert.equal(calculateNonHdl(210, 55), 155);
  assert.equal(calculateNonHdl(5.42, 1.41), 4);
});

test('przecinek dziesiętny jest obsługiwany', () => {
  assert.equal(parseLocalizedNumber('5,42'), 5.42);
  assert.equal(parseLocalizedNumber(' 1,41 '), 1.41);
});

test('wartości niemożliwe albo z błędną jednostką są odrzucane', () => {
  assert.match(validateLipidValues(50, 60, 'mgdl'), /nie może być wyższe/i);
  assert.match(validateLipidValues(210, 55, 'mmoll'), /jednostkę/i);
  assert.match(validateLipidValues(Number.NaN, 55, 'mgdl'), /oba wyniki/i);
});

test('strona pozostaje ukryta, ma ilustrację i jest podłączona tylko do ukrytego katalogu', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '..', 'lipidogram-apob-ldl-non-hdl.html'), 'utf8');
  const hiddenHub = fs.readFileSync(path.resolve(__dirname, '..', 'narzedzia.html'), 'utf8');
  const homepage = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(page, /lipid-markers-human-v1\.webp/);
  assert.match(page, /data-lipid-form/);
  assert.match(hiddenHub, /href="lipidogram-apob-ldl-non-hdl\.html"/);
  assert.doesNotMatch(homepage, /lipidogram-apob-ldl-non-hdl\.html/);
  assert.doesNotMatch(homepage, /href="narzedzia\.html"/);
});

test('cztery parametry wyjaśniają osobno zawartość, liczbę cząstek i trójglicerydy', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '..', 'lipidogram-apob-ldl-non-hdl.html'), 'utf8');
  assert.match(page, /LDL-C mierzy zawartość, a nie liczbę cząstek LDL/);
  assert.match(page, /ApoB przybliża liczbę cząstek, a nie ilość ich ładunku/);
  assert.match(page, /Trójglicerydy nie są „drugim cholesterolem”/);
  assert.match(page, /cholesterol całkowity minus HDL-C/);
  assert.match(page, /LDL-C pokazuje cholesterol w LDL, a non-HDL-C/);
  assert.match(page, /Nie są cholesterolem/);
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'lipid-markers-explainer.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function calculateNonHdl\(/);
});
