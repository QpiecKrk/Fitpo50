const path = require('path');

function defaultGscWorkDir(root = process.cwd()) {
  return path.join(path.resolve(root), 'data', 'reports', 'local', 'gsc-current');
}

function resolveGscWorkDir(root = process.cwd()) {
  return process.env.GSC_WORK_DIR
    ? path.resolve(process.env.GSC_WORK_DIR)
    : defaultGscWorkDir(root);
}

module.exports = { defaultGscWorkDir, resolveGscWorkDir };
