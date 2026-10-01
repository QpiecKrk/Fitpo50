#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { STATUS } = require('./lib/external-integration-status');

const reportPath = path.resolve(process.argv[2] || 'data/reports/gsc-weekly-report.json');
if (!fs.existsSync(reportPath)) {
  console.error(`[FAIL] Missing GSC report: ${reportPath}`);
  process.exit(1);
}
let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`[FAIL] Invalid GSC report JSON: ${err.message || err}`);
  process.exit(1);
}
if (report.status !== STATUS.OK_VERIFIED || report.report_kind !== 'DATASET') {
  console.error(`[FAIL] GSC integration status: ${report.status || 'UNKNOWN'} (${report.reason || 'NO_REASON'}).`);
  process.exit(1);
}
console.log(`[PASS] GSC integration status: ${STATUS.OK_VERIFIED}; auth_mode=${report.auth_mode || 'unknown'}.`);
