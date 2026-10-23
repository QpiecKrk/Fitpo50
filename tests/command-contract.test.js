const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  loadCommandRegistry,
  validateCommandContract,
  validateRecommendedCommands,
} = require('../scripts/command-contract-check');

const ROOT = path.resolve(__dirname, '..');

test('każda komenda package.json ma dokładnie jeden status w rejestrze', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const registry = loadCommandRegistry(path.join(ROOT, 'docs', 'command-registry.md'));
  const report = validateCommandContract({ packageScripts: packageJson.scripts, registry });
  assert.deepEqual(report.errors, []);
  assert.equal(registry.size, Object.keys(packageJson.scripts).length);
});

test('kontrakt wykrywa publiczną komendę bez dokumentacji i nieistniejącą komendę', () => {
  const registry = new Map([
    ['public:a', { status: 'PUBLIC', description: 'Publiczna.' }],
    ['ghost', { status: 'INTERNAL', description: 'Nie istnieje.' }],
  ]);
  const report = validateCommandContract({
    packageScripts: { 'public:a': 'node a.js', 'public:b': 'node b.js' },
    registry,
  });
  assert.match(report.errors.join('\n'), /public:b/);
  assert.match(report.errors.join('\n'), /ghost/);
});

test('komenda INTERNAL nie może być opisana jako zalecana użytkownikowi', () => {
  const registry = new Map([
    ['internal:a', { status: 'INTERNAL', description: 'Zalecana komenda dla użytkownika.' }],
  ]);
  const report = validateCommandContract({ packageScripts: { 'internal:a': 'node a.js' }, registry });
  assert.match(report.errors.join('\n'), /INTERNAL.*użytkownik/i);
});

test('kanoniczna dokumentacja nie może polecać użytkownikowi komendy INTERNAL', () => {
  const registry = new Map([
    ['article:add', { status: 'PUBLIC', description: 'Publiczna.' }],
    ['private:write', { status: 'INTERNAL', description: 'Wewnętrzna.' }],
  ]);
  assert.deepEqual(validateRecommendedCommands('Uruchom npm run article:add.', registry, 'fixture.md'), []);
  assert.match(
    validateRecommendedCommands('Zalecane wejście: npm run private:write.', registry, 'fixture.md').join('\n'),
    /fixture\.md:1.*INTERNAL.*private:write/i,
  );
});

test('PROJECT_MEMORY zawiera nadrzędne twarde zasady i odsyłacze startowe', () => {
  const memory = fs.readFileSync(path.join(ROOT, 'PROJECT_MEMORY.md'), 'utf8');
  const heading = '## TWARDE ZASADY (czytaj na starcie każdej sesji, wygrywają przy sprzeczności)';
  const start = memory.indexOf(heading);
  const end = memory.indexOf('\n## ', start + heading.length);
  assert.notEqual(start, -1, 'brak kanonicznej sekcji twardych zasad');
  assert.ok(start < 100, 'sekcja twardych zasad nie znajduje się na samej górze PROJECT_MEMORY.md');
  const section = memory.slice(start, end === -1 ? memory.length : end);
  for (const keyword of ['tak', 'IndexNow', 'manual_research', 'p:domain_verify', '--approve-round']) {
    assert.ok(section.includes(keyword), `sekcja twardych zasad nie zawiera: ${keyword}`);
  }
  for (const file of ['AGENTS.md', 'SESSION_START_MAX.md']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(source.slice(0, 700), /TWARDE ZASADY.*PROJECT_MEMORY\.md/s, `brak odsyłacza na początku ${file}`);
  }
});
