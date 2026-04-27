#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const WARN_DATE = new Date('2026-06-02T00:00:00Z');
const FAIL_DATE = new Date('2026-09-16T00:00:00Z');

const warnings = [];
const errors = [];

function readFileSafe(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getWorkflowFiles() {
  if (!fs.existsSync(WORKFLOWS_DIR)) return [];
  return fs.readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => path.join(WORKFLOWS_DIR, f));
}

function parseNodeVersionFindings(content) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/node-version:\s*["']?([0-9]+(?:\.[0-9]+)?)["']?/);
    if (!m) continue;
    findings.push({
      line: i + 1,
      version: m[1],
      raw: line.trim(),
    });
  }
  return findings;
}

function parseActionUseFindings(content) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([^\s]+)/);
    if (!m) continue;
    findings.push({
      line: i + 1,
      action: m[1],
      version: m[2],
    });
  }
  return findings;
}

function major(versionTag) {
  const m = String(versionTag || '').match(/^v?(\d+)/i);
  return m ? Number(m[1]) : NaN;
}

function checkFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const content = readFileSafe(filePath);

  const nodeFindings = parseNodeVersionFindings(content);
  for (const f of nodeFindings) {
    const majorNode = Number(String(f.version).split('.')[0]);
    if (majorNode < 20) {
      errors.push(`${rel}:${f.line} -> node-version ${f.version} jest zbyt stare (minimum 20).`);
      continue;
    }
    if (majorNode === 20) {
      const now = new Date();
      if (now >= FAIL_DATE) {
        errors.push(`${rel}:${f.line} -> node-version 20 po 2026-09-16 (runner remove). Ustaw 24.`);
      } else if (now >= WARN_DATE) {
        warnings.push(`${rel}:${f.line} -> node-version 20 po 2026-06-02 (domyslny runner Node 24). Zaplanuj migracje na 24.`);
      } else {
        warnings.push(`${rel}:${f.line} -> node-version 20 jest jeszcze wspierany, ale zaplanuj migracje na 24.`);
      }
    }
  }

  const actionFindings = parseActionUseFindings(content);
  for (const f of actionFindings) {
    const m = major(f.version);
    if (Number.isNaN(m)) {
      warnings.push(`${rel}:${f.line} -> akcja ${f.action}@${f.version} nie ma wersji major (rozważ pinning).`);
      continue;
    }
    if (f.action === 'actions/checkout' && m < 4) {
      errors.push(`${rel}:${f.line} -> ${f.action}@${f.version} jest przestarzale (minimum v4).`);
    }
    if (f.action === 'actions/setup-node' && m < 4) {
      errors.push(`${rel}:${f.line} -> ${f.action}@${f.version} jest przestarzale (minimum v4).`);
    }
  }
}

function main() {
  const files = getWorkflowFiles();
  if (!files.length) {
    console.log('[WARN] Brak workflowow do sprawdzenia w .github/workflows');
    process.exit(0);
  }

  for (const filePath of files) checkFile(filePath);

  if (warnings.length) {
    console.log('\n[WARN]');
    warnings.forEach((w) => console.log(`- ${w}`));
  }
  if (errors.length) {
    console.log('\n[FAIL]');
    errors.forEach((e) => console.log(`- ${e}`));
    process.exit(1);
  }
  console.log('\n[PASS] Workflow maintenance check OK.');
}

main();
