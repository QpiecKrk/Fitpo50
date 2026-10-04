'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readWorkspaceManifest } = require('./temp-workspace');

const EXPORT_WORKSPACE_TYPES = new Set(['build-export-check', 'prepush-export']);

function resolvedExistingAncestor(targetPath) {
  let current = path.resolve(targetPath);
  const missing = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Nie można ustalić istniejącego rodzica ścieżki: ${targetPath}`);
    missing.unshift(path.basename(current));
    current = parent;
  }
  return path.join(fs.realpathSync(current), ...missing);
}

function isInside(parent, child, allowEqual = false) {
  const relative = path.relative(parent, child);
  return (allowEqual && relative === '') || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertNoSymlinkComponents(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  if (!isInside(basePath, targetPath, true)) throw new Error(`Ścieżka wychodzi poza dozwolony katalog: ${targetPath}`);
  let current = basePath;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink jest niedozwolony w ścieżce destrukcyjnej: ${current}`);
  }
}

function assertPathInside(basePath, targetPath, options = {}) {
  const resolvedBase = path.resolve(basePath);
  if (!fs.existsSync(resolvedBase)) throw new Error(`Dozwolony katalog nie istnieje: ${resolvedBase}`);
  if (fs.lstatSync(resolvedBase).isSymbolicLink()) throw new Error(`Symlink nie może być dozwolonym katalogiem: ${resolvedBase}`);
  const base = fs.realpathSync(resolvedBase);
  const target = resolvedExistingAncestor(targetPath);
  if (!isInside(base, target, Boolean(options.allowEqual))) {
    throw new Error(`Ścieżka poza dozwolonym katalogiem ${base}: ${target}`);
  }
  assertNoSymlinkComponents(base, target);
  if (options.mustExist && !fs.existsSync(target)) throw new Error(`Ścieżka nie istnieje: ${target}`);
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error(`Symlink jest niedozwolony: ${target}`);
    if (options.type === 'file' && !stat.isFile()) throw new Error(`Oczekiwano zwykłego pliku: ${target}`);
    if (options.type === 'directory' && !stat.isDirectory()) throw new Error(`Oczekiwano katalogu: ${target}`);
    const realTarget = fs.realpathSync(target);
    if (!isInside(base, realTarget, Boolean(options.allowEqual))) {
      throw new Error(`Rzeczywista ścieżka wychodzi poza dozwolony katalog ${base}: ${realTarget}`);
    }
  }
  return target;
}

function assertProjectRoot(rootPath) {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root) || fs.lstatSync(root).isSymbolicLink() || !fs.statSync(root).isDirectory()) {
    throw new Error(`Nieprawidłowy root projektu: ${root}`);
  }
  const canonical = fs.realpathSync(root);
  const packageFile = path.join(canonical, 'package.json');
  const exportScript = path.join(canonical, 'scripts', 'export_site.sh');
  if (!fs.existsSync(packageFile) || !fs.existsSync(exportScript)) throw new Error(`To nie jest root FitPo50: ${canonical}`);
  const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  if (packageJson.name !== 'fitpo50') throw new Error(`Nieprawidłowa tożsamość projektu: ${canonical}`);
  return canonical;
}

function assertExportOutput(projectRoot, outputPath) {
  const root = assertProjectRoot(projectRoot);
  const output = resolvedExistingAncestor(outputPath);
  const siteOutput = path.join(root, '_site');
  if (output === siteOutput) {
    assertPathInside(root, output, { mustExist: false });
    return output;
  }
  if (path.basename(output) !== 'site') throw new Error(`Eksport poza _site wymaga katalogu workspace o nazwie site: ${output}`);
  const workspace = path.dirname(output);
  assertPathInside(os.tmpdir(), workspace, { allowEqual: false, mustExist: true, type: 'directory' });
  assertPathInside(workspace, output, { mustExist: false });
  const manifest = readWorkspaceManifest(workspace);
  if (!manifest || manifest.version !== 1 || manifest.status !== 'ACTIVE') {
    throw new Error(`Katalog eksportu nie należy do aktywnego zarządzanego workspace: ${workspace}`);
  }
  if (!EXPORT_WORKSPACE_TYPES.has(manifest.workspace_type)) {
    throw new Error(`Niedozwolony typ workspace eksportu: ${manifest.workspace_type || 'brak'}`);
  }
  if (fs.realpathSync(path.resolve(manifest.project_root || '.')) !== root) {
    throw new Error(`Workspace eksportu należy do innego projektu: ${workspace}`);
  }
  return output;
}

function main(argv) {
  const [command, projectRoot, target] = argv;
  if (command !== 'export-output' || !projectRoot || !target || argv.length !== 3) {
    throw new Error('Użycie: destructive-path-guard.js export-output <project-root> <output-dir>');
  }
  process.stdout.write(`${assertExportOutput(projectRoot, target)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`[DESTRUCTIVE-PATH-GUARD][FAIL] ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  EXPORT_WORKSPACE_TYPES,
  assertExportOutput,
  assertPathInside,
  assertProjectRoot,
  isInside,
  resolvedExistingAncestor,
};
