'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  directoryIdentity,
  promoteValidatedGscDataset,
  promotionPaths,
  recoverGscDatasetPromotion,
} = require('../scripts/lib/gsc-dataset-promotion');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-gsc-promotion-'));
  const source = path.join(root, 'source');
  const target = path.join(root, 'gsc-current');
  fs.mkdirSync(source);
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(source, 'queries.csv'), 'query,clicks\nnowe,1\n');
  fs.writeFileSync(path.join(source, 'pages.csv'), 'page,clicks\n/nowa,1\n');
  fs.writeFileSync(path.join(source, 'query-pages.csv'), 'query,page\nnowe,/nowa\n');
  fs.writeFileSync(path.join(target, 'queries.csv'), 'query,clicks\nstare,1\n');
  fs.writeFileSync(path.join(target, 'automation-run-events.json'), '{"events":[{"id":"old"}]}\n');
  return { root, source, target };
}

test('niepełny staging GSC nie zmienia aktywnego zestawu', () => {
  const { root, source, target } = fixture();
  const before = fs.readFileSync(path.join(target, 'queries.csv'), 'utf8');
  assert.throws(() => promoteValidatedGscDataset({
    sourceDir: source,
    targetDir: target,
    validate: () => ({ blocking: true, errors: ['brak manifestu'] }),
  }), /GSC_DATA_CONTRACT_FAILED/);
  assert.equal(fs.readFileSync(path.join(target, 'queries.csv'), 'utf8'), before);
  fs.rmSync(root, { recursive: true, force: true });
});

test('awaria pomiędzy backupem i promocją cofa aktywny zestaw GSC', () => {
  const { root, source, target } = fixture();
  assert.throws(() => promoteValidatedGscDataset({
    sourceDir: source,
    targetDir: target,
    validate: () => ({ blocking: false, errors: [] }),
    hooks: { afterBackup: () => { throw new Error('symulowane przerwanie'); } },
  }), /symulowane przerwanie/);
  assert.match(fs.readFileSync(path.join(target, 'queries.csv'), 'utf8'), /stare/);
  assert.equal(fs.existsSync(promotionPaths(target).journal), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('recovery po twardym przerwaniu przywraca backup GSC', () => {
  const { root, source, target } = fixture();
  const paths = promotionPaths(target);
  fs.cpSync(source, paths.candidate, { recursive: true });
  const expected = directoryIdentity(paths.candidate);
  fs.renameSync(target, paths.backup);
  fs.writeFileSync(paths.journal, `${JSON.stringify({ version: 1, status: 'BACKED_UP', target, expected_files: expected }, null, 2)}\n`);
  const result = recoverGscDatasetPromotion(target);
  assert.deepEqual(result, { recovered: true, action: 'ROLLED_BACK' });
  assert.match(fs.readFileSync(path.join(target, 'queries.csv'), 'utf8'), /stare/);
  assert.equal(fs.existsSync(paths.journal), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('zwalidowany staging zastępuje aktywny zestaw i zachowuje historię automatyzacji', () => {
  const { root, source, target } = fixture();
  const result = promoteValidatedGscDataset({
    sourceDir: source,
    targetDir: target,
    validate: () => ({ blocking: false, errors: [], status: 'PASS' }),
  });
  assert.equal(result.status, 'PROMOTED');
  assert.match(fs.readFileSync(path.join(target, 'queries.csv'), 'utf8'), /nowe/);
  assert.match(fs.readFileSync(path.join(target, 'automation-run-events.json'), 'utf8'), /old/);
  assert.equal(fs.existsSync(promotionPaths(target).journal), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cleanup starych artefaktów GSC nie jest wykonywany w finally ani przed pełnym raportowaniem', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'gsc-auto-report.js'), 'utf8');
  const main = source.slice(source.indexOf('async function main()'));
  const finallyBlock = main.slice(main.lastIndexOf('} finally {'), main.lastIndexOf('\n}'));
  assert.doesNotMatch(finallyBlock, /cleanupRepoGscArtifacts/);
  const firstPromotion = main.indexOf('promoteValidatedGscDataset');
  const firstCleanup = main.indexOf('cleanupRepoGscArtifacts()', firstPromotion);
  const firstFinish = main.indexOf('finishSuccessfulReports', firstPromotion);
  assert.ok(firstPromotion >= 0 && firstFinish > firstPromotion && firstCleanup > firstFinish);
});
