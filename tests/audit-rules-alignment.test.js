const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { defaultGscWorkDir, resolveGscWorkDir } = require('../scripts/lib/gsc-work-dir');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('zasady sprzątania rozróżniają własny workspace od danych użytkownika i ręcznego cleanupu', () => {
  const hardRules = read('PROJECT_MEMORY.md');
  assert.match(hardRules, /Automatyczne sprzątanie własnego stagingu, locków i workspace bieżącej operacji jest dozwolone/);
  assert.match(hardRules, /Ręczny `tmp:cleanup` i każdy tryb apply wymagają osobnego „tak” użytkownika/);
  assert.match(hardRules, /Wbudowany `tmp:cleanup --dry-run` w `prepush:local` jest dozwolony/);
});

test('session:start jest wyłącznie diagnostyką, a 3+2 zastępuje aktywny model 4/20', () => {
  assert.match(read('docs/command-registry.md'), /nie jest rozpoczęciem sesji agenta/);
  for (const file of ['PROJECT_MEMORY.md', 'AGENTS.md', 'SESSION_START_MAX.md']) {
    const source = read(file);
    assert.match(source, /3 pozycji.*2 rotacyjn/s);
    assert.match(source, /4 \/ 20.*historyczn/i);
  }
});

test('GSC domyślnie używa ignorowanego katalogu repo, a Downloads wymaga jawnego parametru', () => {
  const expected = path.join(ROOT, 'data', 'reports', 'local', 'gsc-current');
  assert.equal(defaultGscWorkDir(ROOT), expected);
  const original = process.env.GSC_WORK_DIR;
  delete process.env.GSC_WORK_DIR;
  assert.equal(resolveGscWorkDir(ROOT), expected);
  process.env.GSC_WORK_DIR = path.join(ROOT, 'custom-gsc');
  assert.equal(resolveGscWorkDir(ROOT), path.join(ROOT, 'custom-gsc'));
  if (original === undefined) delete process.env.GSC_WORK_DIR;
  else process.env.GSC_WORK_DIR = original;

  for (const file of [
    'scripts/gsc-auto-report.js', 'scripts/gsc-data-contract.js', 'scripts/gsc-priority-map.js',
    'scripts/gsc-weekly-csv-report.js', 'scripts/growth-tool.js', 'scripts/seo-aio-command-center.js',
    'scripts/seo-aio-wave-autopilot.js', 'scripts/agent-context.js', 'scripts/fitpo50-doctor.js',
    'scripts/lib/post-publication-monitor.js', 'PROJECT_MEMORY.md', 'SESSION_START_MAX.md',
  ]) {
    const source = read(file);
    assert.match(source, /gsc-current|resolveGscWorkDir|defaultGscWorkDir/);
    assert.doesNotMatch(source, /Downloads\/gsc-auto-input/);
  }
});
