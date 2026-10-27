'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

function workflows() {
  return fs.readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(WORKFLOWS_DIR, name), 'utf8') }));
}

function jobBlocks(text) {
  const jobsAt = text.search(/^jobs:\s*$/m);
  assert.notEqual(jobsAt, -1, 'workflow nie zawiera sekcji jobs');
  const jobsText = text.slice(jobsAt + text.slice(jobsAt).indexOf('\n') + 1);
  const starts = [...jobsText.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)];
  return starts.map((match, index) => ({
    name: match[1],
    text: jobsText.slice(match.index, starts[index + 1]?.index ?? jobsText.length),
  }));
}

test('workflowy nie zawierają wyjątku [auto-sync]', () => {
  for (const workflow of workflows()) {
    assert.equal(workflow.text.includes('[auto-sync]'), false, workflow.name);
  }
});

test('każdy workflow deklaruje jawne uprawnienia globalnie albo dla każdego joba', () => {
  for (const workflow of workflows()) {
    if (/^permissions:\s*$/m.test(workflow.text)) continue;
    const jobs = jobBlocks(workflow.text);
    assert.ok(jobs.length > 0, workflow.name);
    for (const job of jobs) {
      assert.match(job.text, /^    permissions:\s*$/m, `${workflow.name}:${job.name}`);
    }
  }
});

test('tylko workflowy gsc-* mają uprawnienia write', () => {
  for (const workflow of workflows()) {
    const writePermissions = workflow.text.match(/^\s+[A-Za-z][A-Za-z0-9_-]*:\s*write\s*$/gm) || [];
    if (!workflow.name.startsWith('gsc-')) assert.deepEqual(writePermissions, [], workflow.name);
  }
});

test('workflowy nie używają npm install', () => {
  for (const workflow of workflows()) {
    assert.doesNotMatch(workflow.text, /\bnpm\s+install\b/, workflow.name);
  }
});

test('workflowy gsc-* nadają issues: write wyłącznie na poziomie joba', () => {
  const gsc = workflows().filter((workflow) => workflow.name.startsWith('gsc-'));
  assert.ok(gsc.length > 0);
  for (const workflow of gsc) {
    assert.doesNotMatch(workflow.text, /^  issues:\s*write\s*$/m, workflow.name);
    const matches = workflow.text.match(/^      issues:\s*write\s*$/gm) || [];
    assert.equal(matches.length, 1, workflow.name);
  }
});
