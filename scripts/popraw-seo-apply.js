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

function parseArgs(argv) {
  const out = { manifest: DEFAULT_MANIFEST, ids: '', confirm: '', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    const value = String(argv[index + 1] || '');
    if (token === '--manifest' && value) { out.manifest = path.resolve(ROOT, value); index += 1; }
    else if (token === '--ids' && value) { out.ids = value; index += 1; }
    else if (token === '--confirm' && value) { out.confirm = value; index += 1; }
    else if (token === '--dry-run') out.dryRun = true;
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
  const files = new Set([DEPLOYMENT_MANIFEST, RESULT_FILE, path.join(ROOT, 'sitemap.xml'), path.join(ROOT, '_site', 'sitemap.xml')]);
  touched.forEach((relative) => {
    files.add(path.join(ROOT, relative));
    files.add(mirrorPath(relative));
  });
  articleFiles.forEach((relative) => {
    const slug = relative.replace(/\.html$/, '');
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
  const state = snapshot(candidateFiles(validation.touched, patched.articleFiles));
  try {
    for (const [relative, content] of patched.contents.entries()) atomicWrite(path.join(ROOT, relative), content);
    const slugs = patched.articleFiles.map((file) => file.replace(/\.html$/, ''));
    run('PDF ze zmienionego HTML', 'python3', ['scripts/sync_article_pdfs_and_buttons.py', ...slugs.flatMap((slug) => ['--slug', slug])]);
    validation.touched.forEach(syncMirrorFile);
    patched.articleFiles.forEach((file) => {
      syncMirrorFile(file);
      const slug = file.replace(/\.html$/, '');
      syncMirrorFile(path.join('assets', 'pdf', `${slug}.pdf`));
    });
    run('Sitemap lastmod', 'node', ['scripts/sync-sitemap-lastmod.js']);
    for (const file of patched.articleFiles) {
      const slug = file.replace(/\.html$/, '');
      run(`Standard artykułu ${file}`, 'node', ['scripts/validate-article-standard.js', file, `_site/${file}`]);
      run(`Kontrakt artykułu ${file}`, 'node', ['scripts/article-contract-check.js', file]);
      run(`Render desktop/mobile/PDF ${file}`, 'node', ['scripts/article-preview-gate.js', '--slug', slug]);
      run(`Predeploy ${file}`, 'node', ['scripts/predeploy-gate.js', '--slug', slug]);
    }
    const deployment = buildDeploymentManifest({
      manifest,
      items: validation.items,
      contents: new Map(patched.articleFiles.map((file) => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')])),
      targetFiles: patched.targetFiles,
      iso,
    });
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
