#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildDeploymentManifest,
  buildPatchedFiles,
  parseIds,
  validatePatchManifest,
  warsawIso,
} = require('./lib/popraw-seo-approved-patches');

const ROOT = process.cwd();
const DEFAULT_MANIFEST = path.join(ROOT, 'data', 'reports', 'popraw-seo-patches.json');
const DEPLOYMENT_MANIFEST = path.join(ROOT, 'data', 'reports', 'popraw-seo-deployments.json');
const RESULT_FILE = path.join(ROOT, 'data', 'reports', 'popraw-seo-apply-result.json');
const CONFIRMATION = 'APPLY_APPROVED_SEO';
const { pageKind } = require('./lib/publication-page-kind');
const { createStagingWorkspace, snapshotCandidates, beginPromotionTransaction, sha256File, recoverInterruptedTransactions } = require('./lib/article-staging');

function parseArgs(argv) {
  const out = { manifest: DEFAULT_MANIFEST, ids: '', confirm: '', dryRun: false, stageOnly: false, internal: false, promoteStage: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    const value = String(argv[index + 1] || '');
    if (token === '--manifest' && value) { out.manifest = path.resolve(ROOT, value); index += 1; }
    else if (token === '--ids' && value) { out.ids = value; index += 1; }
    else if (token === '--confirm' && value) { out.confirm = value; index += 1; }
    else if (token === '--dry-run') out.dryRun = true;
    else if (token === '--stage-only') out.stageOnly = true;
    else if (token === '--promote-stage' && value) { out.promoteStage = path.resolve(value); index += 1; }
    else if (token === '--stage-internal') out.internal = true;
  }
  return out;
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}

function mirrorPath(file) {
  return path.join(ROOT, '_site', file);
}

function snapshot(files) {
  const state = new Map();
  files.forEach((file) => state.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null));
  return state;
}

function restore(state) {
  for (const [file, content] of state.entries()) {
    if (content === null) fs.rmSync(file, { force: true });
    else atomicWrite(file, content);
  }
}

function run(label, command, args) {
  console.log(`[POPRAW-SEO APPLY] ${label}`);
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${label}: exit ${result.status ?? 'unknown'}`);
}

function syncMirrorFile(relative) {
  const source = path.join(ROOT, relative);
  const target = mirrorPath(relative);
  if (!fs.existsSync(source)) throw new Error(`Brak pliku do mirroru: ${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  atomicWrite(target, fs.readFileSync(source));
}

function candidateFiles(touched, articleFiles) {
  const files = new Set([path.join(ROOT, 'assets', 'topic-center-contract.css'), path.join(ROOT, '_site', 'assets', 'topic-center-contract.css'), DEPLOYMENT_MANIFEST, RESULT_FILE, path.join(ROOT, 'sitemap.xml'), path.join(ROOT, '_site', 'sitemap.xml')]);
  for (const file of ['llms.txt', 'llms-full.txt', 'assets/data/search-index.json']) {
    files.add(path.join(ROOT, file));
    files.add(mirrorPath(file));
  }
  touched.forEach((relative) => {
    files.add(path.join(ROOT, relative));
    files.add(mirrorPath(relative));
  });
  articleFiles.forEach((relative) => {
    const slug = relative.replace(/\.html$/, '');
    files.add(path.join(ROOT, 'templates', 'topic-centers', relative));
    files.add(path.join(ROOT, relative));
    files.add(mirrorPath(relative));
    files.add(path.join(ROOT, 'assets', 'pdf', `${slug}.pdf`));
    files.add(path.join(ROOT, '_site', 'assets', 'pdf', `${slug}.pdf`));
    files.add(path.join(ROOT, 'data', 'reports', 'article-preview', `${slug}.json`));
    files.add(path.join(ROOT, 'data', 'reports', 'article-preview', `${slug}.md`));
  });
  return [...files];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.manifest)) throw new Error(`Brak manifestu konkretnych patchy: ${args.manifest}`);
  const selectedIds = parseIds(args.ids);
  if (!selectedIds.length) throw new Error('Podaj zatwierdzone ID przez --ids, np. "BOOST 1,NAPRAWA 2".');
  if (!args.dryRun && args.confirm !== CONFIRMATION) throw new Error(`Wdrożenie wymaga --confirm ${CONFIRMATION}.`);
  const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
  const validation = validatePatchManifest(manifest, ROOT, selectedIds);
  if (validation.errors.length) throw new Error(`Manifest patchy jest zablokowany:\n- ${validation.errors.join('\n- ')}`);
  const iso = warsawIso();
  const patched = buildPatchedFiles(manifest, validation.items, ROOT, iso);
  if (args.dryRun) {
    console.log(`[DRY-RUN PASS] ID: ${selectedIds.join(', ')}; pliki: ${[...patched.contents.keys()].join(', ')}`);
    return;
  }
  if (args.internal && process.env.FITPO50_SEO_STAGING !== '1') throw new Error('Prywatny tryb stagingu wymaga kontrolera.');
  if (!args.internal) {
    recoverInterruptedTransactions(ROOT);
    const candidates = candidateFiles(validation.touched, patched.articleFiles).map((file) => path.relative(ROOT, file));
    let stageRoot = args.promoteStage;
    let baseline;
    if (!stageRoot) {
      baseline = snapshotCandidates(ROOT, candidates);
      stageRoot = createStagingWorkspace(ROOT, 'seo');
      console.log(`[STAGING] ${stageRoot}`);
      const stageManifest = path.join(stageRoot, 'seo-input-manifest.json');
      fs.writeFileSync(stageManifest, JSON.stringify(manifest));
      const child = spawnSync('node', ['scripts/popraw-seo-apply.js', '--manifest', stageManifest, '--ids', args.ids, '--confirm', CONFIRMATION, '--stage-internal'], { cwd: stageRoot, stdio: 'inherit', env: { ...process.env, FITPO50_SEO_STAGING: '1' } });
      if (child.status !== 0) throw new Error(`Staging nie przeszedł; źródłowy HTML bez zmian. Podgląd: ${stageRoot}`);
      const hashes = Object.fromEntries(candidates.filter((file) => fs.existsSync(path.join(stageRoot, file))).map((file) => [file, sha256File(path.join(stageRoot, file))]));
      fs.writeFileSync(path.join(stageRoot, 'seo-stage.json'), JSON.stringify({ sourceRoot: ROOT, ids: selectedIds, baseline: [...baseline], hashes }));
      console.log(`[AWAITING_VISUAL_REVIEW] ${stageRoot}`);
      return;
    } else {
      const record = JSON.parse(fs.readFileSync(path.join(stageRoot, 'seo-stage.json'), 'utf8'));
      if (record.sourceRoot !== ROOT || JSON.stringify(record.ids) !== JSON.stringify(selectedIds)) throw new Error('Staging należy do innego repozytorium albo zestawu ID.');
      baseline = new Map(record.baseline);
      for (const [file, hash] of Object.entries(record.hashes)) if (sha256File(path.join(stageRoot, file)) !== hash) throw new Error(`Staging zmieniony po walidacji: ${file}`);
    }
    const transaction = beginPromotionTransaction({ sourceRoot: ROOT, stageRoot, candidates, baseline, transactionId: `seo-${Date.now()}` });
    try {
      for (const file of patched.articleFiles) {
        run(`Walidacja po promocji ${file}`, 'node', ['scripts/validate-article-standard.js', file, `_site/${file}`]);
        run(`Kontrakt po promocji ${file}`, 'node', ['scripts/article-contract-check.js', file]);
      }
      run('Predeploy po promocji', 'node', ['scripts/predeploy-gate.js']);
      transaction.verify();
      transaction.commit();
    } catch (error) { transaction.rollback(error.message); throw error; }
    console.log(`[APPLIED_VALIDATED] Atomowa promocja: ${transaction.changed.length} plików. Podglądy: ${stageRoot}`);
    return;
  }
  const state = snapshot(candidateFiles(validation.touched, patched.articleFiles));
  try {
    for (const [relative, content] of patched.contents.entries()) atomicWrite(path.join(ROOT, relative), content);
    const slugs = patched.articleFiles.map((file) => file.replace(/\.html$/, ''));
    run('PDF ze zmienionego HTML', 'python3', ['scripts/sync_article_pdfs_and_buttons.py', ...slugs.flatMap((slug) => ['--slug', slug])]);
    if (fs.existsSync(path.join(ROOT, 'assets', 'topic-center-contract.css'))) syncMirrorFile('assets/topic-center-contract.css');
    validation.touched.forEach(syncMirrorFile);
    patched.articleFiles.forEach((file) => {
      syncMirrorFile(file);
      const slug = file.replace(/\.html$/, '');
      syncMirrorFile(path.join('assets', 'pdf', `${slug}.pdf`));
    });
    run('Sitemap lastmod', 'node', ['scripts/sync-sitemap-lastmod.js']);
    let llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
    for (const file of patched.articleFiles) {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      if (pageKind(html) !== 'topic_center') continue;
      const url = `https://fitpo50.pl/${file}`;
      const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
      const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
      if (!title || !description) throw new Error(`Brak metadanych centrum: ${file}`);
      const block = `- url: ${url}\n  title: ${JSON.stringify(title)}\n  section: "Centra tematyczne"\n  summary: ${JSON.stringify(description)}\n`;
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = new RegExp(`^- url: ${escaped}\\r?\\n(?:[ \\t]+[^\\n]*\\n)*`, 'm');
      llms = existing.test(llms) ? llms.replace(existing, () => block) : `${llms.trimEnd()}\n${block}`;
    }
    atomicWrite(path.join(ROOT, 'llms.txt'), llms);
    syncMirrorFile('llms.txt');
    run('Indeks wyszukiwania', 'node', ['scripts/generate-search-index.js', '--output', '_site/assets/data/search-index.json']);
    run('Pełny indeks AI', 'node', ['scripts/generate-llms-full.js', '--output', '_site/llms-full.txt']);
    for (const file of patched.articleFiles) {
      const slug = file.replace(/\.html$/, '');
      run(`Standard artykułu ${file}`, 'node', ['scripts/validate-article-standard.js', file, `_site/${file}`]);
      run(`Kontrakt artykułu ${file}`, 'node', ['scripts/article-contract-check.js', file]);
      run(`Render desktop/mobile/PDF ${file}`, 'node', ['scripts/article-preview-gate.js', '--slug', slug]);
      run(`Predeploy ${file}`, 'node', ['scripts/predeploy-gate.js', '--slug', slug]);
    }
    for (const file of patched.articleFiles) {
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      if (pageKind(html) === 'topic_center') atomicWrite(path.join(ROOT, 'templates', 'topic-centers', file), html);
    }
    const deployment = buildDeploymentManifest({
      manifest,
      items: validation.items,
      contents: new Map(patched.articleFiles.map((file) => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')])),
      targetFiles: patched.targetFiles,
      iso,
    });
    for (const target of deployment.targets) {
      for (const entry of [target, ...(target.source_pages || [])]) {
        entry.expected_pdf_sha256 = sha256File(path.join(ROOT, 'assets', 'pdf', entry.file.replace(/\.html$/, '.pdf')));
      }
    }
    atomicWrite(DEPLOYMENT_MANIFEST, `${JSON.stringify(deployment, null, 2)}\n`);
    atomicWrite(RESULT_FILE, `${JSON.stringify({
      version: 1,
      status: 'APPLIED_VALIDATED_AWAITING_GIT_PUSH',
      applied_at: iso,
      approved_ids: selectedIds,
      changed_files: validation.touched,
      target_files: patched.targetFiles,
      changed_article_files: patched.articleFiles,
      next_automatic_step: 'Agent wykonuje commit/push, monitoruje workflow live i zwraca końcową listę GSC.',
    }, null, 2)}\n`);
    console.log(`[APPLIED_VALIDATED] ${selectedIds.join(', ')}. Następny krok agenta: commit, push i kontrola LIVE.`);
  } catch (error) {
    restore(state);
    console.error('[ROLLBACK] Cofnięto cały pakiet popraw-seo po błędzie.');
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`[POPRAW-SEO APPLY][BLOCKED] ${error.message || error}`);
  process.exit(1);
}
