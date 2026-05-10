#!/usr/bin/env node

/**
 * Legacy compatibility wrapper.
 *
 * `seo:aeo:guard` zostaje jako alias historyczny, ale cała walidacja HTML
 * przechodzi przez jeden silnik: `validate-article-standard.js`.
 */

const { spawnSync } = require('child_process');

function main() {
  const passthrough = process.argv.slice(2);
  const res = spawnSync('node', ['scripts/validate-article-standard.js', ...passthrough], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  process.exit(Number(res.status || 0));
}

main();
