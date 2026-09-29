const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({entryPoints:[path.resolve(__dirname,'..','src','relative-strength-core.ts')],bundle:true,platform:'node',format:'cjs',write:false,target:'node18'});
  const compiled = new Module('relative-strength-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'relative-strength-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const { calculateEstimatedOneRepMax, calculateRelativeStrength, describeEstimateQuality, strengthChangePercent } = loadCore();

test('wzór Epleya liczy e1RM dla krótkiej serii', () => {
  assert.equal(calculateEstimatedOneRepMax(60, 5), 70);
  assert.throws(() => calculateEstimatedOneRepMax(60, 11), RangeError);
});

test('siła względna odnosi e1RM do masy ciała', () => {
  const result = calculateRelativeStrength(70, 60, 5);
  assert.equal(result.estimatedOneRepMaxKg, 70);
  assert.equal(result.relativeStrength, 1);
  assert.equal(result.bodyweightPercent, 100);
  assert.ok(Math.abs(result.workingLoadPercent - 85.71428571428571) < 1e-10);
});

test('ocena szacunku ostrzega o serii dalekiej od końca i o maszynie', () => {
  assert.match(describeEstimateQuality('not-near', 'barbell').label, /orientacyjny/);
  assert.match(describeEstimateQuality('near-limit', 'machine').explanation, /tej samym urządzeniu|tym samym urządzeniu/);
});

test('zmiana e1RM jest liczona procentowo względem poprzedniego wyniku', () => {
  assert.equal(strengthChangePercent(110, 100), 10);
});

test('strona jest ukryta, zawiera instrukcję ciężaru i ilustrację człowieka', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '..', 'kalkulator-sily-wzglednej.html'), 'utf8');
  const hub = fs.readFileSync(path.resolve(__dirname, '..', 'narzedzia.html'), 'utf8');
  const homepage = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(page, /relative-strength-human-v1\.webp/);
  assert.match(page, /Gryf \+ wszystkie talerze/);
  assert.match(page, /data-strength-chart/);
  assert.match(hub, /href="kalkulator-sily-wzglednej\.html"/);
  assert.doesNotMatch(homepage, /kalkulator-sily-wzglednej\.html/);
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'relative-strength-calculator.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function calculateRelativeStrength\(/);
});
