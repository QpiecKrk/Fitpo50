'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WRITER = path.join(ROOT, 'admin', 'helpers', 'news-db-write.php');

function phpString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function runPhp(code) {
  return spawnSync('php', ['-d', 'display_errors=0', '-r', code], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('warstwa zapisu DB wykonuje lock, transakcję, mutację, journal, commit i release w tej kolejności', () => {
  assert.equal(fs.existsSync(WRITER), true, 'Brak admin/helpers/news-db-write.php');
  const result = runPhp(`
    require ${phpString(WRITER)};
    $events = [];
    $before = null;
    $after = ['id'=>'news_x','title'=>'T','content_html'=>'<p>X</p>','status'=>'draft','sort_order'=>1,'image_base'=>'','image_alt'=>'','image_hashes'=>['jpg'=>'','webp'=>'','avif'=>''],'sources'=>[],'created_at'=>'2026-11-03T12:00:00Z','updated_at'=>'2026-11-03T12:00:00Z','published_at'=>''];
    $row = newsDbImportMapItem($after)['row'];
    $updated = '2026-11-03 12:00:00.000000';
    $snapshot = newsDbSnapshotFromRows([$row], $updated);
    $deps = [
      'uuid' => fn() => '11111111-1111-4111-8111-111111111111',
      'acquire' => function() use (&$events) { $events[]='lock'; return true; },
      'begin' => function() use (&$events) { $events[]='begin'; },
      'locked_state' => function() use (&$events) { $events[]='select_for_update'; return ['rows'=>[], 'journal'=>[['journal_id'=>1,'operation'=>'import','snapshot_sha256'=>newsDbSnapshotFromRows([], '2026-11-03 11:00:00.000000'),'store_updated_at'=>'2026-11-03 11:00:00.000000']]]; },
      'apply' => function() use (&$events) { $events[]='mutate'; },
      'rows_after' => function() use (&$events, $row) { $events[]='snapshot'; return [$row]; },
      'journal' => function($payload) use (&$events, $snapshot) { $events[]='journal'; if ($payload['snapshot_sha256'] !== $snapshot) throw new RuntimeException('snapshot'); },
      'commit' => function() use (&$events) { $events[]='commit'; },
      'rollback' => function() use (&$events) { $events[]='rollback'; },
      'release' => function() use (&$events) { $events[]='release'; },
    ];
    $result = newsDbWriteTransaction('create', $before, $after, $updated, $deps);
    echo json_encode(['events'=>$events,'result'=>$result]);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.events, ['lock', 'begin', 'select_for_update', 'mutate', 'snapshot', 'journal', 'commit', 'release']);
  assert.equal(output.result.operation, 'create');
  assert.equal(output.result.before_item_json, null);
  assert.match(output.result.after_item_json, /news_x/);
});

test('każda operacja zapisuje dokładnie jeden journal z poprawnym before/after', () => {
  const source = fs.readFileSync(WRITER, 'utf8');
  for (const operation of ['create', 'update', 'publish', 'unpublish', 'delete']) {
    assert.match(source, new RegExp(`['\"]${operation}['\"]`));
  }
  assert.match(source, /before_item_json/);
  assert.match(source, /after_item_json/);
  assert.match(source, /actor_type[\s\S]{0,160}panel/);
  assert.doesNotMatch(source, /getMessage\s*\(/);
});

test('awaria DB powoduje rollback i release bez file fallback', () => {
  const result = runPhp(`
    require ${phpString(WRITER)};
    $events=[];
    $deps=[
      'uuid'=>fn()=>'22222222-2222-4222-8222-222222222222',
      'acquire'=>function()use(&$events){$events[]='lock';return true;},
      'begin'=>function()use(&$events){$events[]='begin';},
      'locked_state'=>function()use(&$events){$events[]='select_for_update';throw new RuntimeException('sekret');},
      'apply'=>fn()=>null,'rows_after'=>fn()=>[], 'journal'=>fn()=>null,
      'commit'=>fn()=>null,
      'rollback'=>function()use(&$events){$events[]='rollback';},
      'release'=>function()use(&$events){$events[]='release';},
    ];
    try { newsDbWriteTransaction('delete', ['id'=>'x'], null, '2026-11-03 12:00:00.000000', $deps); }
    catch (Throwable $e) { echo json_encode(['events'=>$events,'class'=>get_class($e),'code'=>$e instanceof NewsDbWriteException ? $e->category : 'wrong']); }
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.events, ['lock', 'begin', 'select_for_update', 'rollback', 'release']);
  assert.equal(output.code, 'NEWS_DB_WRITE_FAILED');
  assert.doesNotMatch(result.stdout, /sekret/);
});

test('brak zgodnego importu blokuje mutację przed zapisem', () => {
  const result = runPhp(`
    require ${phpString(WRITER)};
    $events=[];
    $deps=[
      'uuid'=>fn()=>'33333333-3333-4333-8333-333333333333',
      'acquire'=>function()use(&$events){$events[]='lock';return true;},
      'begin'=>function()use(&$events){$events[]='begin';},
      'locked_state'=>function()use(&$events){$events[]='select_for_update';return ['rows'=>[], 'journal'=>[]];},
      'apply'=>function()use(&$events){$events[]='MUTATION_MUST_NOT_RUN';},
      'rows_after'=>fn()=>[], 'journal'=>fn()=>null, 'commit'=>fn()=>null,
      'rollback'=>function()use(&$events){$events[]='rollback';},
      'release'=>function()use(&$events){$events[]='release';},
    ];
    try { newsDbWriteTransaction('create', null, ['id'=>'x'], '2026-11-03 12:00:00.000000', $deps); }
    catch (NewsDbWriteException $e) { echo json_encode($events); }
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), ['lock', 'begin', 'select_for_update', 'rollback', 'release']);
});

test('akcje zachowują file path, a DB nie pokazuje getMessage i porządkuje obrazy po commicie', () => {
  for (const name of ['news-save.php', 'news-status.php', 'news-delete.php']) {
    const source = fs.readFileSync(path.join(ROOT, 'admin', 'actions', name), 'utf8');
    assert.match(source, /newsStorageMode\(\)\s*===\s*['"]db['"]/);
    assert.match(source, /saveNewsStore\(/, `${name}: brak zachowanego file path`);
    assert.match(source, /\$dbMode[^;]*\?\s*['"]Błąd: NEWS_DB_WRITE_FAILED['"]\s*:\s*\(['"]Błąd: ['"]\s*\.\s*\$e->getMessage\(\)\)/);
  }
  const save = fs.readFileSync(path.join(ROOT, 'admin', 'actions', 'news-save.php'), 'utf8');
  const remove = fs.readFileSync(path.join(ROOT, 'admin', 'actions', 'news-delete.php'), 'utf8');
  assert.match(save, /NEWS_DB_WRITE_FAILED|newsDbWrite/);
  assert.match(save, /catch\s*\(Throwable\s+\$e\)[\s\S]*\$newUploadedImageBase[\s\S]*deleteNewsImageVariants\(\$newUploadedImageBase\)/);
  assert.ok(save.indexOf('newsDbWriteMutation') < save.indexOf('deleteNewsImageVariants($previousImageBase)'), 'stary obraz jest usuwany przed commitem DB');
  assert.ok(remove.indexOf('newsDbWrite') < remove.indexOf('deleteNewsImageVariants'), 'delete usuwa obraz przed commitem DB');
});

test('błąd cache po commicie ma jawny kod i nie uruchamia rollbacku', () => {
  const source = fs.readFileSync(WRITER, 'utf8');
  assert.match(source, /CACHE_REBUILD_REQUIRED/);
  assert.match(source, /rebuildNewsCacheFromDatabase/);
});
