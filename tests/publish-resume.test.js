'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createManagedTempDir, disposeTempWorkspace } = require('../scripts/lib/temp-workspace');
const { main, publicationPaths, readPublicationState, savePublicationState, preparedArticleTask } = require('../scripts/publish-article');
const { packageIdentity } = require('../scripts/lib/package-identity');
const { statusPath } = require('../scripts/lib/article-pipeline-status');
const { reportPathForJson } = require('../scripts/lib/article-json-artifact');
const { heroAssetPaths } = require('../scripts/lib/deployment-live-verifier');
const { articleHeroTargets, verifyTargetedRelease, verificationTargetsForMarker, normalizeFinalResult } = require('../scripts/deployment-live-verify');

const ROOT = path.resolve(__dirname, '..');
const MARKERS = ['_site/deployment.json', 'deployment.json'];
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);

async function fixture(callback, { publicChange = false } = {}) {
  const root = fs.realpathSync(createManagedTempDir({ prefix: 'fitpo50-resume-', type: 'publish-resume-test', projectRoot: ROOT }));
  const calls = [];
  const write = (file, data) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), data); };
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw Object.assign(new Error(result.stderr), { exitCode: result.status });
    return result.stdout;
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  write('README.md', 'baseline'); git('add', '--', 'README.md'); git('commit', '-qm', 'baseline');
  const base = git('rev-parse', 'HEAD').trim();
  git('update-ref', 'refs/remotes/origin/main', base);
  let remote = base;
  const files = publicChange ? ['_site/test.html', 'test.html'] : ['README.md'];
  const html = '<link rel="canonical" href="https://fitpo50.pl/test.html">test';
  files.forEach((file) => write(file, publicChange ? html : 'changed'));
  let askCount = 0;
  const options = {
    root, argv: ['--task-files-json', JSON.stringify(files)],
    ask: async () => { askCount += 1; return true; },
    verify: async () => ({ status: 'LIVE_DEPLOYED_AND_VALIDATED', security_status: 'SECURITY_EXPOSURE_PASS' }),
    run: (command, args) => {
      calls.push([command, ...args]);
      if (command === 'git' && args[0] === 'ls-remote') return { stdout: `${remote}\trefs/heads/main\n` };
      if (command === 'git' && args[0] === 'push') { remote = git('rev-parse', 'HEAD').trim(); return { stdout: '' }; }
      if (command === 'git') return { stdout: git(...args) };
      if (command === 'npm' && args[1] === 'deployment:prepare') {
        const releaseFiles = JSON.parse(args[args.indexOf('--files-json') + 1]);
        const marker = {
          version: 4, release_id: 'fixture-release', prepared_from_head: git('rev-parse', 'HEAD').trim(),
          release_files: releaseFiles,
          release_file_hashes: Object.fromEntries(files.map((file) => [file, hash(fs.readFileSync(path.join(root, file)))])),
          change_scope: publicChange ? ['articles'] : ['docs'],
          verification_targets: publicChange ? [{ path: 'test.html', mode: 'sha256', sha256: hash(html) }] : [],
          articles: publicChange ? [{ slug: 'test', url: 'https://fitpo50.pl/test.html' }] : [],
        };
        MARKERS.forEach((file) => write(file, JSON.stringify(marker, null, 2) + '\n'));
        return { stdout: '' };
      }
      throw new Error(`Nieoczekiwana komenda: ${command} ${args.join(' ')}`);
    },
  };
  const count = (name) => calls.filter((call) => call[1] === name).length;
  try { return await callback({ root, base, files, write, git, calls, options, count, asks: () => askCount, setRemote: (sha) => { remote = sha; } }); }
  finally { disposeTempWorkspace(root, { status: 'COMPLETED' }); }
}

test('wznowienie: zatrzymany commit zachowuje zgodę i marker; dokumentacja nie czeka na CDN', () => fixture(async ({ options, count, asks, calls }) => {
  const executor = options.run;
  let fail = true;
  options.verify = async () => { throw new Error('Dokumentacja nie wymaga live'); };
  options.run = (command, args) => {
    if (command === 'git' && args[0] === 'commit' && fail) { fail = false; throw Object.assign(new Error('hook stopped'), { exitCode: 1 }); }
    return executor(command, args);
  };
  await assert.rejects(main(options), /hook stopped/);
  assert.equal(count('push'), 0);
  const result = await main(options);
  assert.equal(result.status, 'PUSHED_NO_PUBLIC_CHANGES');
  assert.equal(calls.filter((call) => call.includes('deployment:prepare')).length, 1);
  assert.equal(count('commit'), 1);
  assert.equal(count('push'), 1);
  assert.equal(asks(), 1);
}));

test('wznowienie: commit zakończony przed zapisem stanu nie jest tworzony drugi raz', () => fixture(async ({ options, count, calls, asks }) => {
  const executor = options.run;
  let interrupt = true;
  options.run = (command, args) => {
    const result = executor(command, args);
    if (command === 'git' && args[0] === 'commit' && interrupt) { interrupt = false; throw new Error('przerwano po commicie'); }
    return result;
  };
  await assert.rejects(main(options), /przerwano po commicie/);
  assert.equal((await main(options)).status, 'PUSHED_NO_PUBLIC_CHANGES');
  assert.equal(count('commit'), 1);
  assert.equal(count('push'), 1);
  assert.equal(calls.filter((call) => call.includes('deployment:prepare')).length, 1);
  assert.equal(asks(), 1);
}));

test('wznowienie: istniejący commit bez dziennika trafia do pusha bez nowego przygotowania', () => fixture(async ({ options, git, files, calls, count, asks, base }) => {
  options.run('npm', ['run', 'deployment:prepare', '--', '--files-json', JSON.stringify([...files, ...MARKERS].sort())]);
  git('add', '--', ...files, ...MARKERS); git('commit', '-qm', 'already committed');
  assert.notEqual(git('rev-parse', 'HEAD').trim(), base);
  calls.length = 0;
  const result = await main(options);
  assert.equal(result.commit, git('rev-parse', 'HEAD').trim());
  assert.equal(count('commit'), 0);
  assert.equal(count('push'), 1);
  assert.equal(calls.some((call) => call.includes('deployment:prepare')), false);
  assert.equal(asks(), 1);
}));

test('wznowienie: nowy katalog nie podmienia zakresu istniejącego commita', () => fixture(async ({ root, options, git, files, write, count }) => {
  options.run('npm', ['run', 'deployment:prepare', '--', '--files-json', JSON.stringify([...files, ...MARKERS].sort())]);
  git('add', '--', ...files, ...MARKERS); git('commit', '-qm', 'pending docs');
  write('package/other.fitpo50.json', JSON.stringify({ slug: 'other' }));
  await assert.rejects(main({ ...options, argv: [path.join(root, 'package')] }), /nie obejmuje wskazanego artykułu/);
  assert.equal(count('push'), 0);
}));

test('wznowienie: stary stan nie blokuje następnego wydania, a PUSHED można osobno domknąć live', async () => {
  const statuses = [
    'LIVE_DEPLOYED_AND_VALIDATED',
    'PUSHED',
    'PUSHED_NO_PUBLIC_CHANGES',
    'NO_CHANGES',
    'COMMITTED',
    'APPROVED',
    'LOCAL_READY',
  ];
  const resumeMessage = (status) => `Poprzednie wydanie (${status}) jest niedokończone. Wznów poprzednie wydanie poleceniem publikuj bez katalogu.`;
  const expected = {
    LIVE_DEPLOYED_AND_VALIDATED: 'PUSHED_NO_PUBLIC_CHANGES',
    PUSHED: 'PUSHED_NO_PUBLIC_CHANGES',
    PUSHED_NO_PUBLIC_CHANGES: 'PUSHED_NO_PUBLIC_CHANGES',
    NO_CHANGES: 'PUSHED_NO_PUBLIC_CHANGES',
    COMMITTED: resumeMessage('COMMITTED'),
    APPROVED: resumeMessage('APPROVED'),
    LOCAL_READY: resumeMessage('LOCAL_READY'),
  };
  const outcomes = {};

  for (const status of statuses) {
    await fixture(async ({ root, base, options, write, git, setRemote, count }) => {
      const unfinished = ['COMMITTED', 'APPROVED', 'LOCAL_READY'].includes(status);
      const hasReleaseCommit = ['PUSHED', 'COMMITTED'].includes(status);
      let commit = ['LIVE_DEPLOYED_AND_VALIDATED', 'PUSHED_NO_PUBLIC_CHANGES', 'NO_CHANGES'].includes(status) ? base : '';
      const oldContent = `stare wydanie ${status}`;
      const marker = {
        version: 4,
        release_id: `old-${status}`,
        prepared_from_head: base,
        release_files: ['old-release.txt', ...MARKERS],
        release_file_hashes: { 'old-release.txt': hash(oldContent) },
        change_scope: ['docs'],
        verification_targets: [],
        articles: [],
      };
      if (unfinished || status === 'PUSHED') write('old-release.txt', oldContent);
      if (hasReleaseCommit) {
        MARKERS.forEach((file) => write(file, JSON.stringify(marker, null, 2) + '\n'));
        git('add', '--', 'old-release.txt', ...MARKERS);
        git('commit', '-qm', `old ${status}`);
        commit = git('rev-parse', 'HEAD').trim();
        if (status === 'PUSHED') {
          git('update-ref', 'refs/remotes/origin/main', commit);
          setRemote(commit);
        }
      }
      savePublicationState(root, {}, {
        status,
        approved: status !== 'LOCAL_READY',
        ...(commit ? { commit } : {}),
        head_before_commit: base,
        task_files: ['old-release.txt'],
        files: ['old-release.txt', ...MARKERS],
        approved_hashes: { 'old-release.txt': hash(oldContent) },
        marker,
      });
      try {
        outcomes[status] = (await main(options)).status;
      } catch (error) {
        outcomes[status] = error.message;
      }
      if (unfinished) {
        assert.equal(count('commit'), 0);
        assert.equal(count('push'), 0);
        assert.equal(readPublicationState(root).status, status);
        if (status === 'COMMITTED') {
          assert.equal(readPublicationState(root).commit, commit);
          assert.equal(git('rev-parse', 'refs/remotes/origin/main').trim(), base);
        } else {
          assert.match(git('status', '--short', '--', 'old-release.txt'), /old-release\.txt/);
        }
      }
    });
  }

  assert.deepEqual(outcomes, expected);

  await fixture(async ({ root, base, options, write }) => {
    savePublicationState(root, {}, {
      status: 'LIVE_DEPLOYED_AND_VALIDATED',
      approved: true,
      commit: base,
      task_files: ['old-release.txt'],
      files: ['old-release.txt', ...MARKERS],
      marker: { version: 4, release_id: 'old-directory-release' },
    });
    write('package/example.fitpo50.json', JSON.stringify({ slug: 'example' }));
    const source = path.join(root, 'package/example.fitpo50.json');
    options.argv = [path.dirname(source)];
    options.ask = async () => false;
    const executor = options.run;
    let imports = 0;
    options.run = (command, args) => {
      if (command === 'npm' && args[1] === 'article:add') {
        imports += 1;
        write('example.html', 'article');
        write('_site/example.html', 'article');
        write('data/reports/article-publications/example.json', JSON.stringify({
          slug: 'example',
          status: 'PUBLISHED',
          source_package_sha256: packageIdentity(source, path.dirname(source), { slug: 'example' }).hash,
          files: ['example.html', '_site/example.html'].map((file) => ({ path: file, after_sha256: hash('article') })),
        }));
        return { stdout: '' };
      }
      return executor(command, args);
    };
    assert.equal((await main(options)).status, 'LOCAL_READY');
    assert.equal(imports, 1);
  });

  await fixture(async ({ root, options, git, files, setRemote, count }) => {
    options.run('npm', ['run', 'deployment:prepare', '--', '--files-json', JSON.stringify([...files, ...MARKERS].sort())]);
    git('add', '--', ...files, ...MARKERS);
    git('commit', '-qm', 'pushed release awaiting live');
    const commit = git('rev-parse', 'HEAD').trim();
    setRemote(commit);
    const marker = JSON.parse(fs.readFileSync(path.join(root, 'deployment.json'), 'utf8'));
    savePublicationState(root, {}, {
      status: 'PUSHED',
      approved: true,
      commit,
      head_before_commit: marker.prepared_from_head,
      task_files: files,
      files: [...files, ...MARKERS].sort(),
      marker,
    });
    const result = await main({ ...options, argv: [] });
    assert.equal(result.status, 'LIVE_DEPLOYED_AND_VALIDATED');
    assert.equal(count('push'), 0);
    assert.equal(count('commit'), 0);
  }, { publicChange: true });
});

test('wznowienie: CDN ponawia tylko live; lista GSC powstaje dopiero po wszystkich potwierdzeniach', () => fixture(async ({ root, options, calls, count, asks }) => {
  let verifyCount = 0;
  options.verify = async () => (++verifyCount === 1 ? { status: 'CDN_REFRESH_PENDING', errors: ['stary hero'] } : { status: 'LIVE_DEPLOYED_AND_VALIDATED', security_status: 'SECURITY_EXPOSURE_PASS' });
  const pending = await main(options);
  assert.equal(pending.status, 'CDN_REFRESH_PENDING');
  assert.equal(pending.gsc_ready, false);
  assert.deepEqual(pending.gsc_urls, []);
  const commit = pending.commit;
  calls.length = 0;
  const live = await main({ ...options, argv: [] });
  assert.equal(live.commit, commit);
  assert.equal(live.status, 'LIVE_DEPLOYED_AND_VALIDATED');
  assert.equal(live.gsc_ready, true);
  assert.deepEqual(live.gsc_urls, ['https://fitpo50.pl/test.html']);
  assert.equal(count('push'), 0);
  assert.equal(count('commit'), 0);
  assert.equal(calls.some((call) => call[0] === 'npm'), false);
  assert.equal(asks(), 1);
  assert.equal(readPublicationState(root).gsc_ready, true);
}, { publicChange: true }));

test('wznowienie: brak SECURITY_EXPOSURE_PASS nie daje listy gotowej do GSC', () => fixture(async ({ root, options }) => {
  options.verify = async () => ({ status: 'LIVE_DEPLOYED_AND_VALIDATED', security_status: 'SECURITY_EXPOSURE_BLOCKED' });
  await assert.rejects(main(options), /SECURITY_EXPOSURE_PASS/);
  assert.notEqual(readPublicationState(root).gsc_ready, true);
}, { publicChange: true }));

test('wznowienie: awaria kontroli live nie wykorzystuje starego raportu PASS', () => fixture(async ({ root, options, write }) => {
  options.verify = async () => ({ status: 'CDN_REFRESH_PENDING' });
  const pending = await main(options);
  write('data/reports/local/deployment-live-status.json', JSON.stringify({ status: 'LIVE_DEPLOYED_AND_VALIDATED', expected_commit: pending.commit, release_id: pending.marker.release_id }));
  delete options.verify;
  const executor = options.run;
  options.run = (command, args) => {
    if (command === 'node' && args[0] === 'scripts/deployment-live-verify.js') throw new Error('network unavailable');
    return executor(command, args);
  };
  await assert.rejects(main(options), /network unavailable/);
  assert.equal(readPublicationState(root).gsc_ready, false);
}, { publicChange: true }));

test('wznowienie: utrata odpowiedzi po przyjętym pushu nie wysyła drugi raz', () => fixture(async ({ options, calls, count, asks }) => {
  const executor = options.run;
  let lost = true;
  options.run = (command, args) => {
    const result = executor(command, args);
    if (command === 'git' && args[0] === 'push' && lost) { lost = false; throw new Error('utracono odpowiedź'); }
    return result;
  };
  await assert.rejects(main(options), /utracono odpowiedź/);
  calls.length = 0;
  assert.equal((await main(options)).status, 'PUSHED_NO_PUBLIC_CHANGES');
  assert.equal(count('push'), 0);
  assert.equal(count('commit'), 0);
  assert.equal(asks(), 1);
}));

test('wznowienie: odbiera działający push/hook; aktywny kontroler blokuje drugi przebieg', () => fixture(async ({ root, options, calls, setRemote }) => {
  await main(options);
  const state = readPublicationState(root);
  setRemote('b'.repeat(40));
  savePublicationState(root, state, { status: 'PUSH_RUNNING', push: { pid: 987654, exit_code: null } });
  options.isProcessAlive = (pid) => pid === 987654;
  options.wait = async () => { setRemote(state.commit); savePublicationState(root, state, { status: 'PUSH_SENT', push: { pid: 987654, exit_code: 0 } }); };
  calls.length = 0;
  assert.equal((await main(options)).status, 'PUSHED_NO_PUBLIC_CHANGES');
  assert.equal(calls.some((call) => ['push', 'commit'].includes(call[1])), false);
  fs.writeFileSync(publicationPaths(root).lock, JSON.stringify({ type: 'publikuj', root, pid: 987654 }));
  calls.length = 0;
  await main(options);
  assert.equal(calls.length, 0);
}));

test('wznowienie: po zatwierdzeniu zmieniona zawartość wymaga ponownej zgody', () => fixture(async ({ root, options, write, asks }) => {
  const executor = options.run;
  let stopped = false;
  options.run = (command, args) => {
    if (command === 'git' && args[0] === 'commit' && !stopped) { stopped = true; throw new Error('hook'); }
    return executor(command, args);
  };
  await assert.rejects(main(options), /hook/);
  write('README.md', 'new content');
  options.ask = async () => false;
  assert.equal((await main(options)).status, 'LOCAL_READY');
  assert.equal(readPublicationState(root).approved, false);
  assert.equal(asks(), 1);
}));

test('wznowienie: zmiana plików podczas pytania nie trafia do commita', () => fixture(async ({ options, write, count }) => {
  options.ask = async () => { write('README.md', 'changed while asking'); return true; };
  await assert.rejects(main(options), /podczas oczekiwania/);
  assert.equal(count('commit'), 0);
  assert.equal(count('push'), 0);
}));

test('wznowienie: po błędzie środowiska importer może dokończyć lokalny artykuł, potem nie wraca', () => fixture(async ({ root, options, write, calls }) => {
  write('package/example.fitpo50.json', JSON.stringify({ slug: 'example' }));
  const source = path.join(root, 'package/example.fitpo50.json');
  options.argv = [path.dirname(source)];
  options.ask = async () => false;
  const executor = options.run;
  let imports = 0;
  options.run = (command, args) => {
    if (command === 'npm' && args[1] === 'article:add') {
      imports += 1;
      if (imports === 1) throw Object.assign(new Error('environment unavailable'), { exitCode: 30 });
      write('example.html', 'article'); write('_site/example.html', 'article');
      write('data/reports/article-publications/example.json', JSON.stringify({ slug: 'example', status: 'PUBLISHED', source_package_sha256: packageIdentity(source, path.dirname(source), { slug: 'example' }).hash, files: ['example.html', '_site/example.html'].map((file) => ({ path: file, after_sha256: hash('article') })) }));
      return { stdout: '' };
    }
    return executor(command, args);
  };
  await assert.rejects(main(options), (error) => error.exitCode === 30);
  assert.equal((await main(options)).status, 'LOCAL_READY');
  assert.equal((await main(options)).status, 'LOCAL_READY');
  assert.equal(imports, 2);
  assert.equal(calls.some((call) => ['push', 'commit'].includes(call[1])), false);
}));

test('wznowienie: starszy manifest używa tożsamości paczki z zakończonej transakcji', () => fixture(({ root, write }) => {
  write('package/example.fitpo50.json', JSON.stringify({ slug: 'example' }));
  write('example.html', 'article');
  write('data/reports/article-publications/example.json', JSON.stringify({ slug: 'example', transaction_id: 'tx', status: 'PUBLISHED', files: [{ path: 'example.html', after_sha256: hash('article') }] }));
  const source = path.join(root, 'package/example.fitpo50.json');
  const prepared = path.join(root, 'ready/example.fitpo50.json');
  const status = statusPath(root, 'example');
  fs.mkdirSync(path.dirname(status), { recursive: true });
  fs.writeFileSync(status, JSON.stringify({ status: 'SUCCESS', transaction_id: 'tx', input_cleanup: { path: prepared } }));
  fs.mkdirSync(path.dirname(prepared), { recursive: true });
  fs.writeFileSync(reportPathForJson(prepared), JSON.stringify({ source_file: source, source_package_sha256: packageIdentity(source, path.dirname(source), { slug: 'example' }).hash }));
  assert.equal(preparedArticleTask('example', root, [], source), true);
  fs.writeFileSync(reportPathForJson(prepared), JSON.stringify({ source_file: source }));
  assert.throws(() => preparedArticleTask('example', root, [], source), /Nie powtarzam importu/);
  fs.writeFileSync(reportPathForJson(prepared), JSON.stringify({ source_file: source, source_package_sha256: packageIdentity(source, path.dirname(source), { slug: 'example' }).hash }));
  write('package/example.fitpo50.json', JSON.stringify({ slug: 'example', title: 'changed' }));
  assert.equal(preparedArticleTask('example', root, [], source), false);
  write('example.html', 'changed artifact');
  assert.equal(preparedArticleTask('example', root), false);
}));

test('wznowienie: proces push zapisuje pełny błąd hooka i kod zakończenia', () => fixture(({ root, write, git }) => {
  const commit = git('rev-parse', 'HEAD').trim();
  savePublicationState(root, {}, { approved: true, status: 'PUSH_STARTING', commit, push: { attempt: 'fixture' } });
  const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  write('bin/git', `#!/bin/sh\nif [ "$1" = "push" ]; then echo 'hook: full error line 1' >&2; echo 'hook: full error line 2' >&2; exit 7; fi\nexec '${realGit}' "$@"\n`);
  fs.chmodSync(path.join(root, 'bin/git'), 0o755);
  const log = fs.openSync(publicationPaths(root).log, 'a');
  let result;
  try { result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/publish-article.js'), '--push-worker', publicationPaths(root).state], { cwd: root, env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}` }, stdio: ['ignore', log, log] }); }
  finally { fs.closeSync(log); }
  assert.equal(result.status, 7);
  assert.equal(readPublicationState(root).push.exit_code, 7);
  assert.equal(readPublicationState(root).status, 'PUSH_FAILED');
  assert.match(fs.readFileSync(publicationPaths(root).log, 'utf8'), /hook: full error line 1\nhook: full error line 2/);
}));

test('live: jeden zestaw URL-i obejmuje stronę i wszystkie warianty hero, bez zmiany markera', () => {
  const baseUrl = 'https://fitpo50.pl';
  const html = '<div class="article-hero"><picture><source srcset="./assets/a.avif"><source srcset="./assets/a.webp"><img src="./assets/a.jpg"></picture></div>';
  const assets = heroAssetPaths(html);
  const marker = { version: 4, release_id: 'r', verification_targets: [{ path: 'test.html', mode: 'sha256', sha256: hash(html) }] };
  const extraTargets = assets.map((file) => ({ path: file, mode: 'sha256', sha256: hash(file) }));
  const targets = verificationTargetsForMarker(baseUrl, marker, [...extraTargets, extraTargets[0]]);
  assert.equal(targets.length, 5);
  const responses = new Map(targets.map((target) => [target.url, { status: 200, body: target.mode === 'marker' ? JSON.stringify(marker, null, 2) + '\n' : target.url.endsWith('.html') ? html : target.url.slice(baseUrl.length + 1) }]));
  const verify = () => normalizeFinalResult(verifyTargetedRelease({ expectedCommit: 'a', remoteCommit: 'a', marker, extraTargets, responses, baseUrl }));
  assert.equal(verify().status, 'LIVE_DEPLOYED_AND_VALIDATED');
  responses.set(`${baseUrl}/${assets[0]}`, { status: 404, body: '' });
  assert.equal(verify().status, 'CDN_REFRESH_PENDING');
  assert.throws(() => heroAssetPaths(html.replace('<source srcset="./assets/a.avif">', '')), /AVIF\/WebP\/JPG/);
});

test('live: JPG artykułu przechodzi po HTTP, typie i wymiarach, bez porównania SHA', () => {
  const baseUrl = 'https://fitpo50.pl';
  const marker = { version: 4, release_id: 'r', verification_targets: [] };
  const extraTargets = [{ path: 'assets/a.jpg', mode: 'jpeg', width: 3, height: 2 }];
  const markerBody = Buffer.from(`${JSON.stringify(marker, null, 2)}\n`);
  const responses = new Map([
    [`${baseUrl}/deployment.json`, { status: 200, body: markerBody }],
    [`${baseUrl}/assets/a.jpg`, { status: 200, contentType: 'image/jpeg', body: jpeg }],
  ]);
  const result = verifyTargetedRelease({ expectedCommit: 'a', remoteCommit: 'a', marker, extraTargets, responses, baseUrl });
  assert.equal(result.status, 'LIVE_DEPLOYED_AND_VALIDATED');
  const wrongSize = Buffer.from(jpeg);
  wrongSize[8] = 0x03;
  responses.set(`${baseUrl}/assets/a.jpg`, { status: 200, contentType: 'image/jpeg', body: wrongSize });
  assert.equal(verifyTargetedRelease({ expectedCommit: 'a', remoteCommit: 'a', marker, extraTargets, responses, baseUrl }).status, 'DEPLOYED');
});

test('live: cele hero pochodzą z rzeczywistego HTML-a i obejmują też niezmienione warianty', () => fixture(({ root, write }) => {
  const html = '<div class="article-hero"><picture><source srcset="./assets/a.avif"><source srcset="./assets/a.webp"><img src="./assets/a.jpg"></picture></div>';
  write('_site/test.html', html);
  for (const file of ['assets/a.avif', 'assets/a.webp', 'assets/a.jpg']) write(`_site/${file}`, file);
  assert.deepEqual(articleHeroTargets({ articles: [{ file: 'test.html' }] }, path.join(root, '_site')), ['assets/a.avif', 'assets/a.webp', 'assets/a.jpg'].map((file) => ({ path: file, mode: 'sha256', sha256: hash(file) })));
  write('_site/centrum-testowe.html', '<main>centrum bez hero</main>');
  write('templates/topic-centers/centrum-testowe.html', 'centrum');
  assert.deepEqual(articleHeroTargets({ articles: [{ file: 'centrum-testowe.html' }] }, path.join(root, '_site')), []);
  assert.deepEqual(articleHeroTargets({ articles: [] }, path.join(root, '_site')), []);
}));
