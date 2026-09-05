const path = require('path');
const { spawnSync } = require('child_process');

function validateTopicCenter(file) {
  const result = spawnSync('python3', [path.join(__dirname, '..', 'validate-topic-center.py'), file], { encoding: 'utf8' });
  return { errors: result.status === 0 ? [] : [String(result.stdout || result.stderr || result.error || 'Walidator centrum nie zakończył pracy.')], warnings: [] };
}

module.exports = { validateTopicCenter };
