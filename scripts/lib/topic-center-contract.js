const path = require('path');
const { spawnSync } = require('child_process');

function validateTopicCenter(file, { changed = false } = {}) {
  const args = [path.join(__dirname, '..', 'validate-topic-center.py')];
  if (changed) args.push('--changed');
  args.push(file);
  const result = spawnSync('python3', args, { encoding: 'utf8' });
  return { errors: result.status === 0 ? [] : [String(result.stdout || result.stderr || result.error || 'Walidator centrum nie zakończył pracy.')], warnings: [] };
}

module.exports = { validateTopicCenter };
