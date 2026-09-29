const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({entryPoints:[path.resolve(__dirname,'..','src','waist-height-core.ts')],bundle:true,platform:'node',format:'cjs',write:false,target:'node18'});
  const compiled = new Module('waist-height-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'waist-height-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const { calculateBmi, calculateWaistHeight, classifyWaistHeightRatio } = loadCore();

test('WHtR jest ilorazem talii i wzrostu', () => {
  const result = calculateWaistHeight(180, 90);
  assert.equal(result.ratio, 0.5);
  assert.equal(result.halfHeightCm, 90);
  assert.equal(result.differenceFromHalfCm, 0);
});

test('klasyfikacja używa tej samej wartości, którą widzi użytkownik', () => {
  const result = calculateWaistHeight(180, 89.9);
  assert.equal(result.ratio, 0.5);
  assert.equal(result.level, 'increased');
});

test('progi klasyfikacji odpowiadają zaleceniom NICE', () => {
  assert.equal(classifyWaistHeightRatio(0.399), 'below-range');
  assert.equal(classifyWaistHeightRatio(0.4), 'healthy');
  assert.equal(classifyWaistHeightRatio(0.499), 'healthy');
  assert.equal(classifyWaistHeightRatio(0.5), 'increased');
  assert.equal(classifyWaistHeightRatio(0.599), 'increased');
  assert.equal(classifyWaistHeightRatio(0.6), 'high');
});

test('opcjonalne BMI jest liczone w jednostkach kg/m²', () => {
  assert.ok(Math.abs(calculateBmi(180, 81) - 25) < 1e-12);
});

test('strona zawiera instrukcję z postacią człowieka i pozostaje odłączona od strony głównej', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '..', 'kalkulator-obwodu-pasa-do-wzrostu.html'), 'utf8');
  const homepage = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(page, /<picture>[\s\S]*waist-measurement-human-v1\.webp[\s\S]*waist-measurement-human-v1\.png[\s\S]*Osoba stojąca przodem[\s\S]*<\/picture>/);
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', 'assets', 'waist-measurement-human-v1.webp')));
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', 'assets', 'waist-measurement-human-v1.png')));
  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  assert.doesNotMatch(homepage, /kalkulator-obwodu-pasa-do-wzrostu\.html/);
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'waist-height-calculator.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function calculateWaistHeight\(/);
});
