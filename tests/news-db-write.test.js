'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WRITER = path.join(ROOT, 'admin', 'helpers', 'news-db-write.php');
const PROBE = path.join(ROOT, 'scripts', 'news-db-write-probe.php');

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
  assert.match(source, /newsDbWriteDiagnosticFields/);
  assert.doesNotMatch(source, /errorInfo\s*\[\s*2\s*\]/);
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

test('panelowa ścieżka mutation normalizuje czas DB dla create, update i delete', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-db-mutation-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const admin = path.join(directory, 'admin');
  const helpers = path.join(admin, 'helpers');
  fs.mkdirSync(helpers, { recursive: true });
  fs.writeFileSync(path.join(admin, 'bootstrap.php'), `<?php define('SITE_ROOT', ${phpString(`${directory}${path.sep}`)});`);
  for (const name of [
    'internal-links.php',
    'news-db.php',
    'news-db-canonical.php',
    'news-db-read.php',
    'news-db-write.php',
    'news.php',
  ]) {
    fs.copyFileSync(path.join(ROOT, 'admin', 'helpers', name), path.join(helpers, name));
  }

  const result = runPhp(`
    require ${phpString(path.join(helpers, 'news.php'))};
    require ${phpString(path.join(helpers, 'news-db-write.php'))};
    $updatedAt = '2026-11-05T12:34:56+01:00';
    $importTime = '2026-11-05 10:00:00.000000';
    $beforeInput = ['id'=>'news_panel','title'=>'Przed','content_html'=>'<p>Treść</p>','status'=>'draft','sort_order'=>1,'image_base'=>'','image_alt'=>'','image_hashes'=>['jpg'=>'','webp'=>'','avif'=>''],'sources'=>[],'created_at'=>'2026-11-05T10:00:00+00:00','updated_at'=>'2026-11-05T10:00:00+00:00','published_at'=>''];
    $beforeRow = newsDbImportMapItem($beforeInput)['row'];
    $before = newsDbCanonicalItemFromDatabaseRow($beforeRow);
    $after = $before;
    $after['title'] = 'Po';
    $after['updated_at'] = $updatedAt;
    $afterRow = newsDbImportMapItem($after)['row'];
    $makeDeps = static function(array $rowsBefore, array $rowsAfter, string $uuid) use ($importTime): array {
      return [
        'uuid'=>fn()=>$uuid,
        'acquire'=>fn()=>true,
        'begin'=>fn()=>null,
        'locked_state'=>fn()=>['rows'=>$rowsBefore,'journal'=>[['journal_id'=>1,'operation'=>'import','snapshot_sha256'=>newsDbSnapshotFromRows($rowsBefore, $importTime),'store_updated_at'=>$importTime]]],
        'apply'=>fn()=>null,
        'rows_after'=>fn()=>$rowsAfter,
        'journal'=>fn()=>null,
        'commit'=>fn()=>true,
        'rollback'=>fn()=>null,
        'release'=>fn()=>null,
      ];
    };
    $results = [
      newsDbWriteMutation('create', null, $after, $updatedAt, $makeDeps([], [$afterRow], '71111111-1111-4111-8111-111111111111')),
      newsDbWriteMutation('update', $before, $after, $updatedAt, $makeDeps([$beforeRow], [$afterRow], '72222222-2222-4222-8222-222222222222')),
      newsDbWriteMutation('delete', $before, null, $updatedAt, $makeDeps([$beforeRow], [], '73333333-3333-4333-8333-333333333333')),
    ];
    echo json_encode($results);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stderr, /Undefined array key|Warning|TypeError/);
  const payloads = JSON.parse(result.stdout);
  assert.deepEqual(payloads.map((payload) => payload.operation), ['create', 'update', 'delete']);
  for (const payload of payloads) {
    assert.match(payload.store_updated_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
  }
});

test('kod panelu nie używa nieistniejącego klucza db z newsDbImportUtc', () => {
  const legacyKeyPattern = /newsDbImportUtc\s*\([\s\S]{0,240}?\)\s*\[\s*['"]db['"]\s*\]/;
  for (const relativeDirectory of ['admin/helpers', 'admin/actions']) {
    const directory = path.join(ROOT, relativeDirectory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.php')) {
        continue;
      }
      const relativeFile = path.join(relativeDirectory, entry.name);
      const source = fs.readFileSync(path.join(ROOT, relativeFile), 'utf8');
      assert.doesNotMatch(source, legacyKeyPattern, `${relativeFile}: używa nieistniejącego klucza ['db']`);
    }
  }
});

test('panel pokazuje jawny błąd redakcyjny prepare, ale ukrywa błąd techniczny', () => {
  const result = runPhp(`
    require ${phpString(WRITER)};
    $cases = [
      newsDbWritePanelError(new NewsEditorValidationException('title', 'Dodaj tytuł newsa.'), 'prepare'),
      newsDbWritePanelError(new RuntimeException('tajna ścieżka /srv/app'), 'prepare'),
      newsDbWritePanelError(new TypeError('tajny typ'), 'write'),
      newsDbWritePanelError(new NewsDbWriteException('NEWS_DB_WRITE_FAILED', 'id', 'apply', '23000', 4025, 'STALE_ITEM'), 'write'),
      newsDbWritePanelError(new NewsDbWriteException('NEWS_DB_WRITE_FAILED', 'id', 'sekret', '23000', 4025, 'sekret'), 'write'),
      newsDbWritePanelError(new RuntimeException('tajny post commit'), 'post_commit'),
    ];
    echo json_encode($cases);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), [
    'Dodaj tytuł newsa.',
    'NEWS_PREPARE_FAILED',
    'NEWS_DB_WRITE_UNEXPECTED',
    'NEWS_DB_WRITE_FAILED [stage=apply; code=STALE_ITEM]',
    'NEWS_DB_WRITE_FAILED [stage=NA; code=NA]',
    'NEWS_POST_COMMIT_FAILED: zapis w bazie został wykonany; nie powtarzaj operacji.',
  ]);
  assert.doesNotMatch(result.stdout, /tajna|tajny|\/srv|23000|4025/);
});

test('formularz zachowuje bezpiecznie dane po błędzie tytułu lub treści i wskazuje pole', () => {
  const save = fs.readFileSync(path.join(ROOT, 'admin', 'actions', 'news-save.php'), 'utf8');
  const form = fs.readFileSync(path.join(ROOT, 'admin', 'news-form.php'), 'utf8');
  const result = runPhp(`
    require ${phpString(WRITER)};
    $post = [
      'id'=>'news_x', 'title'=>'', 'content'=>'<script>zle</script><p>Treść</p>',
      'sort_order'=>'7', 'image_alt'=>'Opis', 'source_label'=>['Nazwa'],
      'source_url'=>['https://example.com'], 'delete_image'=>'1'
    ];
    $state = newsEditorFormState(
      $post,
      new NewsEditorValidationException('title', 'Dodaj tytuł newsa.'),
      true,
      '<p>Treść</p>'
    );
    echo json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    id: 'news_x',
    title: '',
    content: '<p>Treść</p>',
    sort_order: '7',
    image_alt: 'Opis',
    source_label: ['Nazwa'],
    source_url: ['https://example.com'],
    delete_image: true,
    error_field: 'title',
    error_message: 'Dodaj tytuł newsa.',
    image_reselect: true,
  });

  assert.match(save, /new NewsEditorValidationException\(['"]title['"],\s*['"]Dodaj tytuł newsa\./);
  assert.match(save, /new NewsEditorValidationException\(['"]content['"],\s*['"]Dodaj treść newsa\./);
  assert.match(save, /\$_SESSION\[['"]news_form_old['"]\]/);
  assert.match(save, /newsEditorFormState\(\$_POST,\s*\$e,\s*\$hasNewUpload,\s*\$contentHtmlForForm\)/);
  assert.match(form, /\$_SESSION\[['"]news_form_old['"]\]/);
  assert.match(form, /unset\(\$_SESSION\[['"]news_form_old['"]\]\)/);
  assert.match(form, /aria-invalid/);
  assert.match(form, /role=['"]alert['"]/);
  assert.match(form, /Wybierz zdjęcie ponownie\./);
  assert.match(form, /name=['"]title['"][^>]*required/);
  assert.match(form, /aria-required=['"]true['"]/);
});

test('akcje DB oznaczają fazy i commit bezpośrednio po udanej mutacji', () => {
  for (const name of ['news-save.php', 'news-status.php', 'news-delete.php']) {
    const source = fs.readFileSync(path.join(ROOT, 'admin', 'actions', name), 'utf8');
    assert.match(source, /newsStorageMode\(\)\s*===\s*['"]db['"]/);
    assert.match(source, /saveNewsStore\(/, `${name}: brak zachowanego file path`);
    assert.match(source, /\$dbPhase\s*=\s*['"]prepare['"]/);
    assert.match(source, /\$dbCommitted\s*=\s*false/);
    assert.match(source, /\$dbPhase\s*=\s*['"]write['"][\s\S]*newsDbWriteMutation\(/);
    assert.match(source, /newsDbWriteMutation\([\s\S]{0,300}\$dbCommitted\s*=\s*true[\s\S]{0,120}\$dbPhase\s*=\s*['"]post_commit['"]/);
    assert.match(source, /newsDbWritePanelError\(\$e,\s*\$dbPhase\)/);
    assert.match(source, /:\s*\(['"]Błąd: ['"]\s*\.\s*\$e->getMessage\(\)\)/, `${name}: tryb file zmienił obsługę błędu`);
  }
  for (const name of ['news-status.php', 'news-delete.php']) {
    const source = fs.readFileSync(path.join(ROOT, 'admin', 'actions', name), 'utf8');
    assert.match(source, /if\s*\(\$id\s*===\s*['"]['"]\)[\s\S]{0,220}new NewsEditorValidationException\(['"]form['"]/);
    assert.match(source, /\$dbMode\s*\?\s*newsDbWritePanelError\(\$error,\s*['"]prepare['"]\)/);
  }
});

test('nowy obraz jest sprzątany przed commitem, ale nigdy po zatwierdzeniu DB', () => {
  const save = fs.readFileSync(path.join(ROOT, 'admin', 'actions', 'news-save.php'), 'utf8');
  assert.match(save, /catch\s*\(Throwable\s+\$e\)[\s\S]*!\$dbCommitted[\s\S]*\$newUploadedImageBase[\s\S]*deleteNewsImageVariants\(\$newUploadedImageBase\)/);
  assert.ok(save.indexOf('newsDbWriteMutation') < save.indexOf('deleteNewsImageVariants($previousImageBase)'), 'stary obraz jest usuwany przed commitem DB');
});

test('delete usuwa obraz dopiero po commicie, a nieudane usunięcie zostawia kod sieroty', () => {
  const remove = fs.readFileSync(path.join(ROOT, 'admin', 'actions', 'news-delete.php'), 'utf8');
  assert.ok(remove.indexOf('newsDbWrite') < remove.indexOf('deleteNewsImageVariants'), 'delete usuwa obraz przed commitem DB');
  assert.match(remove, /deleteNewsImageVariants[\s\S]{0,180}NEWS_DB_IMAGE_ORPHAN/);
});

test('akcje DB zachowują bezpieczne kody cache i obrazu, a panel nie pokazuje diagnostyki SQL', () => {
  const sources = ['news-save.php', 'news-status.php', 'news-delete.php']
    .map((name) => fs.readFileSync(path.join(ROOT, 'admin', 'actions', name), 'utf8'));
  assert.match(sources[0], /NEWS_DB_IMAGE_ORPHAN/);
  assert.ok(sources.some((source) => source.includes('CACHE_REBUILD_REQUIRED') || source.includes('newsDbRebuildCacheAfterCommit')));
  for (const source of sources) {
    assert.doesNotMatch(source, /sqlState|driverCode|errorInfo|SQLSTATE/);
  }
});

test('błąd cache po commicie ma jawny kod i nie uruchamia rollbacku', () => {
  const source = fs.readFileSync(WRITER, 'utf8');
  assert.match(source, /CACHE_REBUILD_REQUIRED/);
  assert.match(source, /rebuildNewsCacheFromDatabase/);
});

test('diagnostyka PDO loguje etap i bezpieczne kody bez komunikatu sterownika', () => {
  const result = runPhp(`
    ini_set('error_log', 'php://stderr');
    require ${phpString(WRITER)};
    $after = ['id'=>'news_x','title'=>'T','content_html'=>'<p>X</p>','status'=>'draft','sort_order'=>1,'image_base'=>'','image_alt'=>'','image_hashes'=>['jpg'=>'','webp'=>'','avif'=>''],'sources'=>[],'created_at'=>'2026-11-03T12:00:00Z','updated_at'=>'2026-11-03T12:00:00Z','published_at'=>''];
    $updated = '2026-11-03 12:00:00.000000';
    $deps = [
      'uuid'=>fn()=>'44444444-4444-4444-8444-444444444444',
      'acquire'=>fn()=>true,
      'begin'=>fn()=>null,
      'locked_state'=>fn()=>['rows'=>[], 'journal'=>[['journal_id'=>1,'operation'=>'import','snapshot_sha256'=>newsDbSnapshotFromRows([], '2026-11-03 11:00:00.000000'),'store_updated_at'=>'2026-11-03 11:00:00.000000']]],
      'apply'=>function(){ $error = new PDOException('tajne'); $error->errorInfo = ['23000', 4025, 'tajne']; throw $error; },
      'rows_after'=>fn()=>[], 'journal'=>fn()=>null, 'commit'=>fn()=>null,
      'rollback'=>fn()=>null, 'release'=>fn()=>null,
    ];
    try { newsDbWriteTransaction('create', null, $after, $updated, $deps); }
    catch (NewsDbWriteException $e) { echo json_encode(['stage'=>$e->stage,'sqlstate'=>$e->sqlState,'driver_code'=>$e->driverCode]); }
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { stage: 'apply', sqlstate: '23000', driver_code: 4025 });
  assert.match(result.stderr, /stage=apply/);
  assert.match(result.stderr, /sqlstate=23000/);
  assert.match(result.stderr, /driver_code=4025/);
  assert.doesNotMatch(result.stderr, /tajne/);
});

test('diagnostyka RuntimeException zapisuje bezpieczny kod STALE_ITEM na etapie store_check', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-news-db-write-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const admin = path.join(directory, 'admin');
  const helpers = path.join(admin, 'helpers');
  fs.mkdirSync(helpers, { recursive: true });
  fs.writeFileSync(path.join(admin, 'bootstrap.php'), `<?php define('SITE_ROOT', ${phpString(`${directory}${path.sep}`)});`);
  for (const name of [
    'internal-links.php',
    'news-db.php',
    'news-db-canonical.php',
    'news-db-read.php',
    'news-db-write.php',
    'news.php',
  ]) {
    fs.copyFileSync(path.join(ROOT, 'admin', 'helpers', name), path.join(helpers, name));
  }
  const result = runPhp(`
    ini_set('error_log', 'php://stderr');
    require ${phpString(path.join(helpers, 'news.php'))};
    require ${phpString(path.join(helpers, 'news-db-write.php'))};
    $current = ['id'=>'news_x','title'=>'Serwer','content_html'=>'<p>X</p>','status'=>'draft','sort_order'=>1,'image_base'=>'','image_alt'=>'','image_hashes'=>['jpg'=>'','webp'=>'','avif'=>''],'sources'=>[],'created_at'=>'2026-11-03T12:00:00Z','updated_at'=>'2026-11-03T12:00:00Z','published_at'=>''];
    $before = $current; $before['title'] = 'Klient';
    $row = newsDbImportMapItem($current)['row'];
    $importTime = '2026-11-03 11:00:00.000000';
    $deps = [
      'uuid'=>fn()=>'55555555-5555-4555-8555-555555555555',
      'acquire'=>fn()=>true, 'begin'=>fn()=>null,
      'locked_state'=>fn()=>['rows'=>[$row], 'journal'=>[['journal_id'=>1,'operation'=>'import','snapshot_sha256'=>newsDbSnapshotFromRows([$row], $importTime),'store_updated_at'=>$importTime]]],
      'apply'=>fn()=>null, 'rows_after'=>fn()=>[$row], 'journal'=>fn()=>null, 'commit'=>fn()=>null,
      'rollback'=>fn()=>null, 'release'=>fn()=>null,
    ];
    try { newsDbWriteTransaction('update', $before, $before, '2026-11-03 12:00:00.000000', $deps); }
    catch (NewsDbWriteException $e) { echo json_encode(['stage'=>$e->stage,'code'=>$e->diagnosticCode]); }
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { stage: 'store_check', code: 'STALE_ITEM' });
  assert.match(result.stderr, /stage=store_check/);
  assert.match(result.stderr, /code=STALE_ITEM/);
});

test('probe wymusza błąd commit, wykonuje rollback i raportuje ROLLBACK_OK', () => {
  assert.equal(fs.existsSync(PROBE), true, 'Brak scripts/news-db-write-probe.php');
  const result = runPhp(`
    require ${phpString(PROBE)};
    $events = [];
    $importTime = '2026-11-03 11:00:00.000000';
    $deps = [
      'uuid'=>fn()=>'66666666-6666-4666-8666-666666666666',
      'acquire'=>function()use(&$events){$events[]='lock';return true;},
      'begin'=>function()use(&$events){$events[]='begin';},
      'locked_state'=>fn()=>['rows'=>[], 'journal'=>[['journal_id'=>1,'operation'=>'import','snapshot_sha256'=>newsDbSnapshotFromRows([], $importTime),'store_updated_at'=>$importTime]]],
      'apply'=>function()use(&$events){$events[]='apply';},
      'rows_after'=>fn()=>[newsDbImportMapItem(newsDbWriteProbeDraft('news_probe_test', '2026-11-03T12:00:00Z'))['row']],
      'journal'=>function()use(&$events){$events[]='journal';},
      'commit'=>function()use(&$events){$events[]='original_commit_must_not_run';},
      'rollback'=>function()use(&$events){$events[]='rollback';},
      'release'=>function()use(&$events){$events[]='release';},
    ];
    $counts = fn()=>[40,1];
    $probe = newsDbWriteProbeExecute($deps, $counts, 'news_probe_test', '2026-11-03T12:00:00Z');
    echo json_encode(['probe'=>$probe,'events'=>$events]);
  `);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.probe.result, 'ROLLBACK_OK');
  assert.equal(output.probe.stage, 'commit');
  assert.deepEqual(output.events, ['lock', 'begin', 'apply', 'journal', 'rollback', 'release']);
  assert.doesNotMatch(output.events.join(','), /original_commit/);
});

test('probe odmawia poza CLI, a bez --run pokazuje plan przed ładowaniem konfiguracji', () => {
  assert.equal(fs.existsSync(PROBE), true, 'Brak scripts/news-db-write-probe.php');
  const plan = spawnSync('php', [PROBE], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(plan.status, 10, plan.stderr || plan.stdout);
  assert.match(plan.stdout, /PROBE_PLAN=/);
  assert.doesNotMatch(plan.stdout + plan.stderr, /NEWS_DB_CONFIG|DB_CONNECTION/);

  const cgi = spawnSync('php-cgi', [], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      SCRIPT_FILENAME: PROBE,
      REQUEST_METHOD: 'GET',
      REDIRECT_STATUS: '200',
      GATEWAY_INTERFACE: 'CGI/1.1',
    },
  });
  assert.equal(cgi.status, 30, cgi.stderr || cgi.stdout);
  assert.match(cgi.stdout, /PROBE_FAIL: CLI_ONLY/);

  const source = fs.readFileSync(PROBE, 'utf8');
  assert.ok(source.indexOf("PHP_SAPI !== 'cli'") < source.indexOf("admin/bootstrap.php"));
});
