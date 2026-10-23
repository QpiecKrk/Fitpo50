const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { collectAssetAudit } = require('../scripts/assets-audit');

test('asset referenced only from a PHP file is not unused', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitpo50-assets-audit-'));
  try {
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(root, 'admin'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets', 'php-only.png'), 'fixture');
    fs.writeFileSync(path.join(root, 'admin', 'widget.php'), '<img src="../assets/php-only.png">');

    const result = collectAssetAudit(root);
    assert.equal(result.referenced.has('assets/php-only.png'), true);
    assert.equal(result.unused.includes('assets/php-only.png'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
