const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

function loadCore() {
  const result = esbuild.buildSync({entryPoints:[path.resolve(__dirname,'..','src','walking-pace-core.ts')],bundle:true,platform:'node',format:'cjs',write:false,target:'node18'});
  const compiled = new Module('walking-pace-core.test.js', module);
  compiled.filename = path.resolve(__dirname, 'walking-pace-core.test.js');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
}

const {
  calculateWalkingPace,
  convertDistanceToKm,
  describeTalkTest,
  durationToSeconds,
  formatDuration,
  formatPace,
  paceChangeSeconds
} = loadCore();

test('marsz 3 km w 30 minut daje tempo 10:00 min/km i prędkość 6 km/h', () => {
  const result = calculateWalkingPace(3, 30 * 60);
  assert.equal(result.paceSecondsPerKm, 600);
  assert.equal(result.speedKmh, 6);
  assert.equal(formatPace(result.paceSecondsPerKm), '10:00');
});

test('metry i części czasu są poprawnie zamieniane na jednostki obliczeń', () => {
  assert.equal(convertDistanceToKm(1500, 'm'), 1.5);
  assert.equal(durationToSeconds(1, 2, 3), 3723);
  assert.throws(() => durationToSeconds(0, 60, 0), RangeError);
});

test('kalkulator wyznacza czas na 1, 3 i 5 km z tego samego tempa', () => {
  const result = calculateWalkingPace(2, 17 * 60);
  assert.equal(formatDuration(result.oneKmSeconds), '8:30');
  assert.equal(formatDuration(result.threeKmSeconds), '25:30');
  assert.equal(formatDuration(result.fiveKmSeconds), '42:30');
});

test('test rozmowy rozróżnia umiarkowaną intensywność od nieocenionej', () => {
  assert.match(describeTalkTest('moderate').label, /Umiarkowana/);
  assert.match(describeTalkTest('not-checked').explanation, /Sama prędkość nie mówi/);
});

test('ujemna zmiana czasu na kilometr oznacza szybszy marsz', () => {
  assert.equal(paceChangeSeconds(540, 600), -60);
});

test('strona pozostaje ukryta, ma ilustrację człowieka i jest dostępna tylko z ukrytego katalogu', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '..', 'kalkulator-tempa-marszu.html'), 'utf8');
  const hub = fs.readFileSync(path.resolve(__dirname, '..', 'narzedzia.html'), 'utf8');
  const homepage = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(page, /walking-pace-human-v1\.webp/);
  assert.match(page, /data-walk-chart/);
  assert.match(hub, /href="kalkulator-tempa-marszu\.html"/);
  assert.doesNotMatch(homepage, /kalkulator-tempa-marszu\.html/);
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', 'assets', 'walking-pace-human-v1.webp')));
});

test('paczka przeglądarkowa nie zawiera wywołań CommonJS', () => {
  const bundle = fs.readFileSync(path.resolve(__dirname, '..', 'dist', 'walking-pace-calculator.js'), 'utf8');
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.match(bundle, /function calculateWalkingPace\(/);
});
